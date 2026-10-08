#!/usr/bin/env python3
"""Shared contracts for the build-3d-game-rooms skill."""

from __future__ import annotations

import json
from pathlib import Path


SCHEMAS = {
    "room-brief.json": "game-room.room-brief.v1",
    "plan-metadata.json": "game-room.plan-metadata.v1",
    "props.json": "game-room.prop-manifest.v1",
    "room-layout.json": "game-room.layout.v1",
    "openings.json": "game-room.opening-schedule.v1",
    "milestone-reviews.json": "game-room.milestone-reviews.v1",
    "final-report.json": "game-room.room-final-report.v1",
}
GATES = ("function", "form", "runtime")
FORM_CHECKS = (
    "floorPlanParity", "primaryArrival", "symmetry", "shell", "manifold", "booleans",
    "collisions", "support", "attachmentOrientation", "ceilingAttachmentOrientation",
    "seatingOrientation", "focalDistribution", "heroClearance", "colonnades",
    "screenClearance", "scale", "camera", "ceilingCoverage", "environmentCoverage", "provenance",
)
RUNTIME_CHECKS = ("vlow", "textureTiers", "lightmap", "lightingManifest", "performance")


def load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise ValueError(f"missing file: {path}") from None
    except json.JSONDecodeError as error:
        raise ValueError(f"invalid JSON in {path}: {error}") from None


def nonempty(value):
    return isinstance(value, str) and bool(value.strip())


def positive_vector(value, count):
    return isinstance(value, list) and len(value) == count and all(isinstance(item, (int, float)) and item > 0 for item in value)


def existing_relative(package: Path, value):
    return nonempty(value) and (package / value).is_file()


def validate_package(package: Path, gate: str = "runtime"):
    if gate not in GATES:
        raise ValueError(f"unknown gate {gate!r}")
    errors = []
    docs = {}
    for filename, schema in SCHEMAS.items():
        path = package / filename
        try:
            docs[filename] = load_json(path)
        except ValueError as error:
            errors.append(str(error))
            continue
        if docs[filename].get("schema") != schema:
            errors.append(f"{filename}: expected schema {schema}")
    if errors:
        return errors

    brief = docs["room-brief.json"]
    plan = docs["plan-metadata.json"]
    props = docs["props.json"]
    layout = docs["room-layout.json"]
    openings = docs["openings.json"]
    reviews = docs["milestone-reviews.json"]
    report = docs["final-report.json"]
    room_id = brief.get("roomId")
    if not nonempty(room_id):
        errors.append("room-brief.json: roomId is required")
    for filename, document in docs.items():
        if document.get("roomId") != room_id:
            errors.append(f"{filename}: roomId does not match room brief")
    if plan.get("style") != "monochrome-engineering" or plan.get("projectionSource") != "actual-meshes":
        errors.append("plan-metadata.json: plans must be monochrome engineering projections of actual meshes")
    if plan.get("layers") != ["lower-room", "reflected-ceiling"]:
        errors.append("plan-metadata.json: lower-room and reflected-ceiling layers are required")
    if plan.get("semanticLabelsOutsideImage") is not True:
        errors.append("plan-metadata.json: semantic labels must remain outside the plan image")
    if plan.get("aiInspirationIncluded") is True and not nonempty(plan.get("aiInspirationReason")):
        errors.append("plan-metadata.json: included AI inspiration requires an explicit reason")
    required_plan_coverage = {"room-outline", "cutouts", "openings", "exterior-apron", "main-sign", "ingress-props", "floor-markers", "barriers", "columns", "circulation", "placed-features"}
    if set(plan.get("coverage", [])) != required_plan_coverage:
        errors.append("plan-metadata.json: complete reviewed-space coverage is required")
    if brief.get("family") not in {"display-gallery", "gameplay-room", "social-hub", "custom"}:
        errors.append("room-brief.json: invalid family")
    for field in ("purpose", "runtimeSurface"):
        if not nonempty(brief.get(field)):
            errors.append(f"room-brief.json: {field} is required")
    if not positive_vector(brief.get("boundsMeters"), 3):
        errors.append("room-brief.json: boundsMeters must contain three positive values")
    hero = brief.get("hero", {})
    if not nonempty(hero.get("id")) or not nonempty(hero.get("role")) or not positive_vector(hero.get("reservedBoundsMeters"), 3):
        errors.append("room-brief.json: complete hero contract is required")
    symmetry = brief.get("symmetry", {})
    symmetry_mode = symmetry.get("mode")
    symmetry_order = symmetry.get("order")
    symmetry_targets = symmetry.get("appliesTo")
    symmetry_exceptions = symmetry.get("exceptions")
    if symmetry_mode not in {"none", "bilateral", "radial"}:
        errors.append("room-brief.json: symmetry.mode must be none, bilateral, or radial")
    if not isinstance(symmetry_order, int) or isinstance(symmetry_order, bool):
        errors.append("room-brief.json: symmetry.order must be an integer")
    elif ((symmetry_mode == "none" and symmetry_order != 1)
          or (symmetry_mode == "bilateral" and symmetry_order != 2)
          or (symmetry_mode == "radial" and symmetry_order < 3)):
        errors.append("room-brief.json: symmetry.order must be 1 for none, 2 for bilateral, or at least 3 for radial")
    allowed_symmetry_targets = {"architecture", "barriers", "circulation", "repeatedProps"}
    if not isinstance(symmetry_targets, list) or any(item not in allowed_symmetry_targets for item in symmetry_targets):
        errors.append("room-brief.json: symmetry.appliesTo contains an invalid target")
    elif symmetry_mode in {"bilateral", "radial"} and set(symmetry_targets) != allowed_symmetry_targets:
        errors.append("room-brief.json: declared symmetry must apply to architecture, barriers, circulation, and repeatedProps")
    if not isinstance(symmetry_exceptions, list) or any(not nonempty(item) for item in symmetry_exceptions):
        errors.append("room-brief.json: symmetry.exceptions must be a list of non-empty explanations")
    camera = brief.get("productionCamera", {})
    if not positive_vector(camera.get("viewport"), 2) or not positive_vector([camera.get("verticalFovDegrees", 0)], 1):
        errors.append("room-brief.json: production camera viewport/FOV are required")
    for vector in ("location", "target"):
        if not isinstance(camera.get(vector), list) or len(camera[vector]) != 3:
            errors.append(f"room-brief.json: productionCamera.{vector} requires three numbers")
    artifacts = brief.get("artifacts", {})
    for field in ("floorPlan", "reflectedCeilingPlan", "planMetadata", "visualTarget", "openingContactSheet"):
        if not existing_relative(package, artifacts.get(field)):
            errors.append(f"Function: missing artifact {field}")
    elevations = artifacts.get("wallElevations")
    if not isinstance(elevations, list) or not elevations or any(not existing_relative(package, item) for item in elevations):
        errors.append("Function: at least one existing wall elevation is required")
    for key in ("maxSceneTriangles", "maxVLowBytes", "maxHighTextureBytes"):
        if brief.get("performanceBudget", {}).get(key, 0) <= 0:
            errors.append(f"room-brief.json: positive performanceBudget.{key} is required")
    if brief.get("creditBudget", {}).get("maximumCredits", -1) < 0:
        errors.append("room-brief.json: non-negative credit budget is required")

    generation = props.get("generation", {})
    if generation.get("provider") != "meshy" or generation.get("apiModel") != "meshy-5":
        errors.append("props.json: generation must use Meshy model meshy-5")
    if generation.get("pricingSource") != "https://docs.meshy.ai/en/api/pricing" or not nonempty(generation.get("pricingVerifiedAt")):
        errors.append("props.json: current official Meshy pricing verification is required")
    if not isinstance(generation.get("creditsPerTexturedTask"), int) or generation.get("creditsPerTexturedTask", 0) <= 0:
        errors.append("props.json: positive creditsPerTexturedTask is required")
    hard_ceiling = generation.get("hardCreditCeiling", 0)
    if hard_ceiling <= 0 or hard_ceiling > brief.get("creditBudget", {}).get("maximumCredits", 0):
        errors.append("props.json: hardCreditCeiling must be positive and no greater than the room credit budget")
    if generation.get("maxChargedAttemptsPerAsset") != 2:
        errors.append("props.json: maxChargedAttemptsPerAsset must equal 2")

    asset_ids = set()
    assets = props.get("assets", [])
    if not assets:
        errors.append("props.json: conceive at least one prop before Function approval")
    for asset in assets:
        asset_id = asset.get("id")
        if not nonempty(asset_id) or asset_id in asset_ids:
            errors.append("props.json: asset IDs must be unique and non-empty")
            continue
        asset_ids.add(asset_id)
        for field in ("function", "description"):
            if not nonempty(asset.get(field)):
                errors.append(f"prop {asset_id}: {field} is required")
        if asset.get("class") not in {"reusable", "hero"}:
            errors.append(f"prop {asset_id}: class must be reusable or hero")
        if not positive_vector(asset.get("dimensionsMeters"), 3):
            errors.append(f"prop {asset_id}: three positive dimensions are required")
        if asset.get("attachmentFace") not in {"floor", "wall", "ceiling", "freestanding"}:
            errors.append(f"prop {asset_id}: attachmentFace is invalid")
        if asset.get("semanticFront") not in {"positive-x", "negative-x", "positive-y", "negative-y", "positive-z", "negative-z"}:
            errors.append(f"prop {asset_id}: semanticFront is invalid")
        if not isinstance(asset.get("targetPolycount"), int) or not 100 <= asset.get("targetPolycount", 0) <= 300000:
            errors.append(f"prop {asset_id}: targetPolycount must be 100-300000")
        if not asset.get("rejectionCriteria") or any(not nonempty(item) for item in asset.get("rejectionCriteria", [])):
            errors.append(f"prop {asset_id}: objective rejection criteria are required")
        image = asset.get("image", {})
        if not nonempty(image.get("prompt")) or not nonempty(image.get("generator")):
            errors.append(f"prop {asset_id}: image prompt and generator are required")
        if not existing_relative(package, image.get("source")):
            errors.append(f"prop {asset_id}: approved reference image is missing")
        if image.get("approved") is not True or not nonempty(image.get("approvedBy")):
            errors.append(f"prop {asset_id}: reference image requires explicit approval")

    if layout.get("units") != "meters" or not layout.get("surfaces"):
        errors.append("room-layout.json: meter units and at least one shell surface are required")
    surface_ids = [item.get("id") for item in layout.get("surfaces", [])]
    if any(not nonempty(item) for item in surface_ids) or len(surface_ids) != len(set(surface_ids)):
        errors.append("room-layout.json: surface IDs must be unique and non-empty")
    instance_ids = [item.get("id") for item in layout.get("instances", [])]
    if any(not nonempty(item) for item in instance_ids) or len(instance_ids) != len(set(instance_ids)):
        errors.append("room-layout.json: instance IDs must be unique and non-empty")
    counts = {asset_id: 0 for asset_id in asset_ids}
    for instance in layout.get("instances", []):
        asset_id = instance.get("assetId")
        if asset_id not in asset_ids:
            errors.append(f"room-layout.json: instance references unknown asset {asset_id!r}")
        else:
            counts[asset_id] += 1
    for asset in assets:
        if nonempty(asset.get("id")) and counts.get(asset["id"], 0) != asset.get("intendedInstances"):
            errors.append(f"room-layout.json: instance count for {asset['id']} does not match intendedInstances")
    environment = brief.get("environment", {})
    if environment.get("type") not in {"none", "equirectangular"}:
        errors.append("room-brief.json: environment.type must be none or equirectangular")
    elif environment.get("type") == "equirectangular":
        for field in ("identity", "assignmentKey"):
            if not nonempty(environment.get(field)):
                errors.append(f"room-brief.json: equirectangular environment requires {field}")
        if not existing_relative(package, environment.get("source")):
            errors.append("room-brief.json: equirectangular environment source is missing")

    seen = set()
    for opening in openings.get("openings", []):
        opening_id = opening.get("id")
        if not nonempty(opening_id) or opening_id in seen:
            errors.append("openings.json: opening IDs must be unique and non-empty")
            continue
        seen.add(opening_id)
        kind = opening.get("kind")
        if kind not in {"door", "window", "deep_alcove"}:
            errors.append(f"opening {opening_id}: invalid kind")
        if opening.get("widthMeters", 0) <= 0 or opening.get("heightMeters", 0) <= 0:
            errors.append(f"opening {opening_id}: positive dimensions are required")
        if kind == "window" and opening.get("sillMeters", -1) < 0:
            errors.append(f"opening {opening_id}: window requires sillMeters")
        if kind == "deep_alcove":
            minimum = max(0.35, 0.15 * opening.get("heightMeters", 0))
            if opening.get("depthMeters", 0) < minimum:
                errors.append(f"opening {opening_id}: alcove depth must be at least {minimum:.3f} m")
        if not nonempty(opening.get("destination")):
            errors.append(f"opening {opening_id}: destination/purpose is required")
        for field in ("mask", "cutter"):
            if not existing_relative(package, opening.get(field)):
                errors.append(f"opening {opening_id}: missing {field} artifact")
        if opening.get("approved") is not True:
            errors.append(f"opening {opening_id}: mask/dimensions are not approved")

    primary_arrival = openings.get("primaryArrival", {})
    primary_id = primary_arrival.get("openingId")
    primary_exception = primary_arrival.get("exception")
    if nonempty(primary_id):
        primary = next((item for item in openings.get("openings", []) if item.get("id") == primary_id), None)
        if primary is None:
            errors.append("openings.json: primaryArrival.openingId does not exist")
        elif primary.get("kind") != "door":
            errors.append("openings.json: primary arrival must be a door/passage opening")
        elif primary.get("widthMeters", 0) < 2.4 and not nonempty(primary_exception):
            errors.append("openings.json: primary arrival must be at least 2.4 m wide or have an exception")
    elif not nonempty(primary_exception):
        errors.append("openings.json: primary arrival opening or functional exception is required")

    gate_index = GATES.index(gate)
    for required_gate in GATES[: gate_index + 1]:
        review = reviews.get(required_gate, {})
        if review.get("status") != "approved" or not nonempty(review.get("approvedBy")) or not nonempty(review.get("approvedAt")):
            errors.append(f"{required_gate.title()} gate: explicit approval is required")
        if not review.get("evidence") or any(not existing_relative(package, item) for item in review.get("evidence", [])):
            errors.append(f"{required_gate.title()} gate: existing evidence is required")
        if not nonempty(review.get("strangestElement")):
            errors.append(f"{required_gate.title()} gate: strangestElement review is required")
        if report.get("gates", {}).get(required_gate) is not True:
            errors.append(f"final-report.json: gates.{required_gate} must be true")
    if gate_index >= 1:
        actual_credits = 0
        for asset in assets:
            attempts = asset.get("attempts", [])
            charged = [attempt for attempt in attempts if (attempt.get("consumedCredits") or 0) > 0]
            actual_credits += sum(attempt.get("consumedCredits", 0) or 0 for attempt in attempts)
            if len(charged) > 2:
                errors.append(f"Form gate: prop {asset.get('id')} exceeds two charged Meshy attempts")
            if any(attempt.get("status") in {"SUBMITTING", "SUBMITTED", "PENDING", "IN_PROGRESS"} for attempt in attempts):
                errors.append(f"Form gate: prop {asset.get('id')} has unresolved Meshy work")
            accepted = asset.get("acceptedMesh") or {}
            if not existing_relative(package, accepted.get("path")) or not nonempty(accepted.get("sha256")) or not nonempty(accepted.get("taskId")):
                errors.append(f"Form gate: prop {asset.get('id')} requires an accepted, hashed Meshy GLB")
        if actual_credits > hard_ceiling:
            errors.append("Form gate: actual Meshy credits exceed the hard ceiling")
        for check in FORM_CHECKS:
            if report.get("formChecks", {}).get(check) is not True:
                errors.append(f"Form gate: formChecks.{check} must be true")
        review_renders = report.get("reviewRenders", {})
        corners = review_renders.get("corners", [])
        ceilings = review_renders.get("ceiling", [])
        if len(corners) != 4 or any(not existing_relative(package, item) for item in corners):
            errors.append("Form gate: four existing 120-degree corner renders are required")
        if len(ceilings) != 3 or any(not existing_relative(package, item) for item in ceilings):
            errors.append("Form gate: center-up and two ceiling-oblique renders are required")
        if environment.get("type") == "equirectangular":
            directions = review_renders.get("environment", {})
            for direction in ("front", "right", "rear", "left", "up", "down"):
                if not existing_relative(package, directions.get(direction)):
                    errors.append(f"Form gate: environment-only {direction} render is required")
    if gate_index >= 2:
        for check in RUNTIME_CHECKS:
            if report.get("runtimeChecks", {}).get(check) is not True:
                errors.append(f"Runtime gate: runtimeChecks.{check} must be true")
        capture = report.get("runtimeChecks", {}).get("browserCapture")
        if not existing_relative(package, capture):
            errors.append("Runtime gate: browser capture is required")
        if report.get("runtimeChecks", {}).get("errors") != []:
            errors.append("Runtime gate: browser errors must be empty")
    return errors
