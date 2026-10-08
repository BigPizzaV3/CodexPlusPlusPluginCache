#!/usr/bin/env python3
"""Guarded Meshy 5 Image-to-3D task submission and artifact tracking."""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


API_ROOT = "https://api.meshy.ai/openapi/v1/image-to-3d"
FINAL_STATUSES = {"SUCCEEDED", "FAILED", "CANCELED"}
ACTIVE_STATUSES = {"SUBMITTING", "SUBMITTED", "PENDING", "IN_PROGRESS"}


def fail(message: str) -> None:
    raise SystemExit(message)


def load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        fail(f"cannot read {path}: {error}")


def atomic_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(handle, "w", encoding="utf-8") as stream:
            json.dump(data, stream, indent=2, sort_keys=True)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def parse_time(value: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (AttributeError, ValueError):
        fail("pricingVerifiedAt must be an ISO-8601 UTC timestamp")
    if parsed.tzinfo is None:
        fail("pricingVerifiedAt must include a timezone")
    return parsed.astimezone(timezone.utc)


def find_asset(manifest, asset_id: str):
    matches = [item for item in manifest.get("assets", []) if item.get("id") == asset_id]
    if len(matches) != 1:
        fail(f"expected exactly one asset {asset_id!r}")
    return matches[0]


def image_data_uri(path: Path) -> tuple[str, str]:
    suffixes = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}
    mime = suffixes.get(path.suffix.lower())
    if not mime or not path.is_file():
        fail("reference image must be an existing PNG or JPEG")
    content = path.read_bytes()
    digest = hashlib.sha256(content).hexdigest()
    return f"data:{mime};base64,{base64.b64encode(content).decode('ascii')}", digest


def api_json(method: str, url: str, key: str, payload=None):
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url, data=body, method=method,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:1000]
        fail(f"Meshy API returned HTTP {error.code}: {detail}")
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
        fail(f"Meshy API request failed: {error}")


def require_key() -> str:
    key = os.environ.get("MESHY_API_KEY")
    if not key:
        fail("MESHY_API_KEY is not set")
    return key


def charged_or_reserved(manifest) -> int:
    estimate = manifest["generation"]["creditsPerTexturedTask"]
    total = 0
    for asset in manifest.get("assets", []):
        for attempt in asset.get("attempts", []):
            consumed = attempt.get("consumedCredits")
            if attempt.get("status") in ACTIVE_STATUSES:
                total += max(consumed if isinstance(consumed, int) else 0, estimate)
            elif isinstance(consumed, int) and consumed > 0:
                total += consumed
    return total


def validate_submission(package: Path, manifest, asset):
    reviews = load_json(package / "milestone-reviews.json")
    if reviews.get("function", {}).get("status") != "approved":
        fail("Function gate is not approved")
    generation = manifest.get("generation", {})
    if generation.get("provider") != "meshy" or generation.get("apiModel") != "meshy-5":
        fail("generation must be pinned to Meshy model meshy-5")
    if generation.get("maxChargedAttemptsPerAsset") != 2:
        fail("maxChargedAttemptsPerAsset must equal 2")
    verified = parse_time(generation.get("pricingVerifiedAt", ""))
    age = datetime.now(timezone.utc) - verified
    if age.total_seconds() < 0 or age.days > 7:
        fail("Meshy pricing verification is stale; recheck the official pricing page")
    if asset.get("image", {}).get("approved") is not True or not asset["image"].get("approvedBy"):
        fail("reference image requires explicit approval")
    attempts = asset.setdefault("attempts", [])
    unresolved = [item for item in attempts if item.get("status") == "SUBMITTING" and not item.get("taskId")]
    if unresolved:
        fail("unresolved SUBMITTING attempt blocks resubmission; reconcile it from the Meshy task list")
    charged = [item for item in attempts if (item.get("consumedCredits") or 0) > 0]
    active = [item for item in attempts if item.get("status") in ACTIVE_STATUSES]
    if active:
        fail("an active or unresolved attempt already exists for this asset")
    if len(charged) >= 2:
        fail("two charged attempts already exist for this asset")
    if charged and not charged[-1].get("rejectionReason"):
        fail("a charged retry requires an objective rejection reason on the previous attempt")
    ceiling = generation.get("hardCreditCeiling", 0)
    estimate = generation.get("creditsPerTexturedTask", 0)
    brief_ceiling = load_json(package / "room-brief.json").get("creditBudget", {}).get("maximumCredits", 0)
    if ceiling <= 0 or brief_ceiling <= 0 or ceiling > brief_ceiling:
        fail("set a positive hardCreditCeiling no greater than room-brief creditBudget.maximumCredits")
    if charged_or_reserved(manifest) + estimate > ceiling:
        fail("submission would exceed the room Meshy credit ceiling")


def command_submit(args, package: Path, manifest_path: Path, manifest, asset):
    validate_submission(package, manifest, asset)
    image_path = package / asset["image"]["source"]
    data_uri, image_hash = image_data_uri(image_path)
    payload = {
        "image_url": data_uri,
        "model_type": "standard",
        "ai_model": "meshy-5",
        "should_texture": True,
        "enable_pbr": True,
        "texture_resolution": "2k",
        "should_remesh": True,
        "topology": "triangle",
        "target_polycount": asset["targetPolycount"],
        "target_formats": ["glb"],
        "moderation": True,
    }
    if asset.get("texturePrompt"):
        payload["texture_prompt"] = asset["texturePrompt"]
    sanitized = {key: value for key, value in payload.items() if key != "image_url"}
    sanitized["imageSha256"] = image_hash
    if args.dry_run:
        print(json.dumps(sanitized, indent=2, sort_keys=True))
        return
    if not args.confirm_spend:
        fail("submission requires --confirm-spend")
    attempt = {
        "number": len(asset["attempts"]) + 1,
        "createdAt": now(),
        "status": "SUBMITTING",
        "taskId": None,
        "request": sanitized,
        "consumedCredits": None,
        "rejectionReason": "",
        "task": {},
    }
    asset["attempts"].append(attempt)
    atomic_json(manifest_path, manifest)
    response = api_json("POST", API_ROOT, require_key(), payload)
    task_id = response.get("result")
    if not isinstance(task_id, str) or not task_id:
        fail("Meshy response did not include a task ID; attempt remains unresolved")
    attempt["taskId"] = task_id
    attempt["status"] = "SUBMITTED"
    attempt["submittedAt"] = now()
    atomic_json(manifest_path, manifest)
    print(task_id)


def latest_task_attempt(asset):
    attempts = [item for item in asset.get("attempts", []) if item.get("taskId")]
    if not attempts:
        fail("asset has no persisted Meshy task")
    return attempts[-1]


def command_status(manifest_path: Path, manifest, asset):
    attempt = latest_task_attempt(asset)
    task = api_json("GET", f"{API_ROOT}/{urllib.parse.quote(attempt['taskId'], safe='')}", require_key())
    attempt["status"] = task.get("status", attempt["status"])
    attempt["consumedCredits"] = task.get("consumed_credits", attempt.get("consumedCredits"))
    attempt["checkedAt"] = now()
    attempt["task"] = task
    atomic_json(manifest_path, manifest)
    print(json.dumps({"taskId": attempt["taskId"], "status": attempt["status"], "progress": task.get("progress"), "consumedCredits": attempt.get("consumedCredits")}, sort_keys=True))


def meshy_download_url(attempt) -> str:
    if attempt.get("status") != "SUCCEEDED":
        fail("latest Meshy task has not succeeded")
    url = attempt.get("task", {}).get("model_urls", {}).get("glb")
    parsed = urllib.parse.urlparse(url or "")
    if parsed.scheme != "https" or not (parsed.hostname == "meshy.ai" or (parsed.hostname or "").endswith(".meshy.ai")):
        fail("task does not contain a trusted Meshy GLB URL")
    return url


def command_download(package: Path, manifest_path: Path, manifest, asset):
    attempt = latest_task_attempt(asset)
    url = meshy_download_url(attempt)
    target = package / "meshes" / f"{asset['id']}-attempt-{attempt['number']}.glb"
    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        with urllib.request.urlopen(url, timeout=120) as response:
            content = response.read()
    except (urllib.error.URLError, TimeoutError) as error:
        fail(f"GLB download failed: {error}")
    target.write_bytes(content)
    attempt["downloadedMesh"] = {"path": str(target.relative_to(package)), "sha256": hashlib.sha256(content).hexdigest(), "downloadedAt": now()}
    atomic_json(manifest_path, manifest)
    print(target.resolve())


def command_reject(args, manifest_path: Path, manifest, asset):
    attempt = latest_task_attempt(asset)
    if attempt.get("status") not in FINAL_STATUSES:
        fail("only a finished attempt can be rejected")
    if not args.reason.strip():
        fail("rejection requires an objective reason")
    attempt["rejectionReason"] = args.reason.strip()
    attempt["rejectedAt"] = now()
    atomic_json(manifest_path, manifest)


def command_accept(package: Path, manifest_path: Path, manifest, asset):
    attempt = latest_task_attempt(asset)
    downloaded = attempt.get("downloadedMesh")
    if attempt.get("status") != "SUCCEEDED" or not downloaded or not (package / downloaded["path"]).is_file():
        fail("download a successful GLB before acceptance")
    asset["acceptedMesh"] = {**downloaded, "taskId": attempt["taskId"], "acceptedAt": now()}
    atomic_json(manifest_path, manifest)


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    for command in ("submit", "status", "download", "reject", "accept"):
        child = sub.add_parser(command)
        child.add_argument("package", type=Path)
        child.add_argument("--asset", required=True)
        if command == "submit":
            child.add_argument("--confirm-spend", action="store_true")
            child.add_argument("--dry-run", action="store_true")
        if command == "reject":
            child.add_argument("--reason", required=True)
    args = parser.parse_args()
    package = args.package.resolve()
    manifest_path = package / "props.json"
    manifest = load_json(manifest_path)
    asset = find_asset(manifest, args.asset)
    if args.command == "submit":
        command_submit(args, package, manifest_path, manifest, asset)
    elif args.command == "status":
        command_status(manifest_path, manifest, asset)
    elif args.command == "download":
        command_download(package, manifest_path, manifest, asset)
    elif args.command == "reject":
        command_reject(args, manifest_path, manifest, asset)
    else:
        command_accept(package, manifest_path, manifest, asset)


if __name__ == "__main__":
    main()
