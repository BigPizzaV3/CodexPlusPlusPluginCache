#!/usr/bin/env python3
"""TidyGuardian v2: review-first, permission-gated, reversible file organization."""
from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
import sys

# Permit direct script execution, importlib loading, and python -m invocation.
HERE = str(Path(__file__).resolve().parent)
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import media_setup
from version import VERSION

from guard import Root, SafetyError, absolute, canonical, new_report_dir, read_json, write_new
from discovery import (cleanup_plan, duplicate_plan, export_csv, move_plan, scan, thumbnails)
from review import save_plan
from workflow import apply, make_plan, restore_plan


def read_csv(path):
    p = absolute(path, directory=False)
    if not p.is_file() or p.stat().st_size > 20 * 1024 * 1024:
        raise SafetyError("Invalid or oversized CSV")
    with p.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames or len(reader.fieldnames) != len(set(reader.fieldnames)):
            raise SafetyError("Missing or duplicate CSV columns")
        rows = list(reader)
        if any(None in r or any(v is None for v in r.values()) for r in rows):
            raise SafetyError("Malformed CSV row")
        return rows


def catalog_input(path, root):
    if Path(path).suffix.lower() == ".json":
        data = read_json(path)
        if data.get("root") != str(root.path) or data.get("root_identity") != root.id:
            raise SafetyError("Catalog root does not match")
        return data
    rows = read_csv(path)
    for row in rows:
        row["size"] = int(row.get("size", 0))
        # Legacy CSVs have no trustworthy eligibility flags: apply current policy.
        root.protect_project(row["rel_path"])
        row["eligible"] = row.get("entry_type", "file") == "file"
    return {"entries": rows}


def command(args):
    if args.command == "apply-plan":
        plan = read_json(args.plan)
        selection = read_json(args.selection) if args.selection else None
        run = apply(plan, args.output_dir, execute=args.execute, selection=selection)
        print(run)
        return 0
    if args.command == "restore-plan":
        plan = restore_plan(args.journal)
        folder = new_report_dir(args.output_dir, Root(plan["root"]))
        save_plan(folder, plan)
        print(folder / "plan.json")
        return 0
    # Fail BEFORE even scanning or writing a candidate when an obsolete destructive
    # invocation is attempted. --execute alone no longer grants file permission.
    if getattr(args, "execute", False):
        raise SafetyError("Legacy --execute is disabled. Generate a frozen plan, review it, then run apply-plan with live confirmation. Permanent deletion is unavailable.")
    if not args.root:
        raise SafetyError("--root is required; a CSV must never choose your filesystem scope")
    root = Root(args.root)
    folder = new_report_dir(args.output_dir, root)
    if args.command == "catalog":
        data = scan(root, inspect_media=args.media_dates)
        write_new(folder / "catalog.json", canonical(data) + "\n")
        export_csv(folder / "catalog.csv", data["entries"], ["rel_path", "kind", "size", "date_iso", "year", "month", "date_basis", "eligible", "reason"])
        export_csv(folder / "skipped.csv", data["skipped"], ["path", "reason"])
        write_new(folder / "receipt.md", f"# Inventory\n\n{len(data['entries'])} files cataloged; {len(data['skipped'])} skipped entries/errors. Source files unchanged.\n\nCSV is a formula-neutralized human report. Use catalog.json for planning. No content is uploaded.\n")
        print(folder / "catalog.json")
        return 0
    if args.command == "thumbnails":
        thumbnails(root, catalog_input(args.catalog, root), folder, args.limit)
        print(folder / "review.html")
        return 0
    if args.command == "plan-move":
        plan = move_plan(root, catalog_input(args.catalog, root), args.organized_root, args.limit)
    elif args.command == "apply-move":
        rows = read_csv(args.plan)
        if any(r.get("action") != "MOVE" for r in rows):
            raise SafetyError("Move CSV contains an unknown action")
        plan = make_plan(root, [{"action": "MOVE", "src": r["src_rel"], "dest": r["dest_rel"],
                                "reason": "Imported legacy CSV; requires fresh review"} for r in rows])
    elif args.command in {"duplicates", "duplicate-audit", "verify-duplicates"}:
        data = scan(root)
        if args.command == "duplicate-audit":
            from collections import defaultdict
            groups = defaultdict(list)
            for row in data["entries"]:
                if row["eligible"] and row["size"] >= args.min_size:
                    groups[row["size"]].append(row)
            rows = [{"group_id": str(size), "size": size, "rel_path": r["rel_path"]}
                    for size, group in groups.items() if len(group) > 1 for r in group]
            export_csv(folder / "duplicate_size_groups.csv", rows, ["group_id", "size", "rel_path"])
            write_new(folder / "catalog.json", canonical(data) + "\n")
            write_new(folder / "receipt.md", "# Size-only candidates\n\nSize is NOT duplicate proof and does NOT authorize any move or deletion. Use duplicates to generate a verified quarantine plan.\n")
            print(folder / "catalog.json")
            return 0
        if args.command == "verify-duplicates" and args.audit:
            # Old audits are only a scope filter, never trusted duplicate proof.
            if Path(args.audit).suffix.lower() == ".json":
                wanted = {r["rel_path"] for r in catalog_input(args.audit, root)["entries"]}
            else:
                wanted = {r["rel_path"] for r in read_csv(args.audit)}
            for rel in wanted:
                root.check(rel)
            data["entries"] = [r for r in data["entries"] if r["rel_path"] in wanted]
        plan = duplicate_plan(root, data, preferred=args.keep, min_size=args.min_size, max_bytes=args.max_bytes)
    elif args.command == "delete-verified":
        rows = read_csv(args.verified)
        requests = []
        for row in rows:
            if row.get("exact_verified") != "true":
                raise SafetyError("Unverified CSV row refused")
            for rel in (row["keep_rel"], row["delete_rel"]):
                if root.snapshot(rel)["sha256"] != row.get("sha256"):
                    raise SafetyError("CSV hash is stale or incorrect")
            requests.append({"action": "QUARANTINE", "src": row["delete_rel"], "keep": row["keep_rel"],
                             "reason": "Legacy delete proposal converted to reversible quarantine; new approval required"})
        plan = make_plan(root, requests)
    elif args.command == "cleanup-metadata":
        plan = cleanup_plan(root)
    else:
        raise SafetyError("Unknown command")
    save_plan(folder, plan)
    print(folder / "plan.json")
    return 0


def positive(value):
    number = int(value)
    if number < 1 or number > 1000:
        raise argparse.ArgumentTypeError("Choose a limit between 1 and 1000")
    return number


def nonnegative(value):
    number = int(value)
    if number < 0:
        raise argparse.ArgumentTypeError("Must be nonnegative")
    return number


def build_parser():
    parser = argparse.ArgumentParser(description="Local, review-first file organization. No permanent deletion.")
    parser.add_argument("--version", action="version", version=f"TidyGuardian {VERSION}")
    sub = parser.add_subparsers(dest="command", required=True)
    media_setup.add_parser(sub)
    names = ["catalog", "thumbnails", "plan-move", "apply-move", "duplicates", "duplicate-audit",
             "verify-duplicates", "delete-verified", "cleanup-metadata", "apply-plan", "restore-plan"]
    for name in names:
        p = sub.add_parser(name)
        p.add_argument("--output-dir", required=True, help="Existing directory outside the source. A unique private run folder is created.")
        if name not in {"apply-plan", "restore-plan"}:
            p.add_argument("--root", required=True)
        if name in {"apply-move", "delete-verified", "cleanup-metadata", "apply-plan"}:
            p.add_argument("--execute", action="store_true", help="Only apply-plan supports execution; live confirmation is still mandatory.")
        if name in {"thumbnails", "plan-move"}:
            p.add_argument("--catalog", required=True)
            p.add_argument("--limit", type=positive, default=100 if name == "thumbnails" else 1000)
        if name == "catalog":
            p.add_argument("--media-dates", action="store_true", help="Opt into local ffprobe/Pillow metadata reads; never upload files")
        if name == "plan-move":
            p.add_argument("--organized-root", default="_TidyGuardian_Organized")
        if name in {"apply-move", "apply-plan"}:
            p.add_argument("--plan", required=True)
        if name == "apply-plan":
            p.add_argument("--selection", help="Selection JSON from the offline review page; not execution authorization")
        if name in {"duplicates", "duplicate-audit", "verify-duplicates"}:
            p.add_argument("--min-size", type=nonnegative, default=1)
            p.add_argument("--max-bytes", type=nonnegative, default=0)
            p.add_argument("--keep", action="append", default=[], help="Relative path to retain; may be repeated")
        if name == "verify-duplicates":
            p.add_argument("--audit")
        if name == "delete-verified":
            p.add_argument("--verified", required=True)
        if name == "restore-plan":
            p.add_argument("--journal", required=True)
    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)
    try:
        if args.command in {"setup", "doctor"}:
            return media_setup.setup_command(args)
        # Preserve immediate refusal of obsolete destructive commands. A dependency
        # setup choice must never weaken the existing file-permission policy.
        if getattr(args, "execute", False) and args.command != "apply-plan":
            return command(args)
        status = media_setup.preflight(
            require_media=args.command == "thumbnails" or getattr(args, "media_dates", False))
        if status:
            return status
        return command(args)
    except KeyboardInterrupt:
        print("Cancelled. Inspect the journal before retrying an interrupted execution.", file=sys.stderr)
        return 130
    except (SafetyError, OSError, ValueError, KeyError, TypeError) as exc:
        print("Stopped safely: " + str(exc), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
