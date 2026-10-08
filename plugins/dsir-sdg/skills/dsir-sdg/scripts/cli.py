"""Command-line entry point for the DSIR SDG skill; JSON answers and safe exports."""
import argparse
import csv
import hashlib
import json
import sys
from pathlib import Path

from sdg_client import SDGClient, SDGError, BASE_URL, utc_now
from indicator_search import search_indicators, describe_indicator
from locations import resolve_locations
from clean import clean_records, observation_context, CORE_FIELDS
from qa import qa_records

VERSION = "0.1.0"


def build_response(result, client, resolved=None):
    raw = result["records"]
    data = clean_records(raw)
    qa = qa_records(raw, data)
    requested = result["query"]["locations"] or sorted({r["location"] for r in data})
    coverage = [{"location": code, "years": sorted({r["year"] for r in data if r["location"] == code and r["year"] is not None}),
                 "row_count": sum(r["location"] == code for r in data)} for code in requested]
    missing = [c["location"] for c in coverage if c["row_count"] == 0]
    if missing:
        qa["issues"].append({"severity": "warning", "code": "locations_without_data", "message": "No matching observations for: " + ", ".join(missing)})
        if qa["status"] == "pass":
            qa["status"] = "warning"
    return {"schema_version": VERSION, "status": "qa_failed" if qa["status"] == "fail" else result["status"],
            "indicator": result["indicator"], "series_catalogue": result["series_catalogue"],
            "query": result["query"], "resolved_locations": resolved,
            "row_count": len(data), "retrieved_row_count": result["retrieved_row_count"], "pages": result["pages"],
            "coverage_by_location": coverage, "metadata": result["metadata"], "qa": qa,
            "data": data, "observation_context": observation_context(raw), "baseline_probe": result["baseline_probe"],
            "provenance": {"source": "UN SDG Global Database (UNSD)", "api": BASE_URL,
                           "requests": list(client.trace), "retrieved_at": utc_now(), "skill_version": VERSION,
                           "dsir_reference_version": "0.9.0", "dsir_reference_commit": "e2ff6735d174769b55f9a3e55f9f36c75ce9f397"},
            "limitations": ["Official UN observations may include WHO as a custodian; do not relabel this API as WHO GHO.",
                            "The live release may revise historical values and definitions. Do not splice different methodologies.",
                            "Regional observations use the group definition of the current source release; no country averages or historical membership reconstruction were computed.",
                            "The 15-column DSIR core omits SDG dimensions and units; use observation_context and observations.csv when interpreting values."]}


def write_result(output_dir, response, raw):
    destination = Path(output_dir).expanduser().resolve()
    try:
        destination.mkdir(parents=True, exist_ok=False)
    except FileExistsError as exc:
        raise SDGError("output_exists", "Choose a new output directory; existing results will not be overwritten.", path=str(destination)) from exc
    for name, value in (("response.json", response), ("raw.json", raw)):
        (destination / name).write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    with (destination / "dsir_clean.csv").open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=CORE_FIELDS)
        writer.writeheader()
        writer.writerows(response["data"])
    # A self-contained table is the default user export; the core is for DSIR parity.
    extra = ("dimensions_json", "attributes_json", "unit", "observation_source", "footnotes_json", "indicator_codes_json")
    with (destination / "observations.csv").open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=(*CORE_FIELDS, *extra))
        writer.writeheader()
        for row, ctx in zip(response["data"], response["observation_context"]):
            writer.writerow({**row, "dimensions_json": json.dumps(ctx["dimensions"], ensure_ascii=False),
                             "attributes_json": json.dumps(ctx["attributes"], ensure_ascii=False),
                             "unit": (ctx["attributes"] or {}).get("Units"), "observation_source": ctx["source"],
                             "footnotes_json": json.dumps(ctx["footnotes"], ensure_ascii=False),
                             "indicator_codes_json": json.dumps(ctx["indicator"], ensure_ascii=False)})
    manifest = {"created_at": utc_now(), "files": {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in destination.iterdir()}}
    (destination / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return {p.name: str(p) for p in destination.iterdir()}


def filter_args(values):
    result = {}
    for value in values or []:
        key, sep, code = value.partition("=")
        if not sep or not key or not code:
            raise SDGError("invalid_query", "Use --dimension 'Name=Code' or --attribute 'Name=Code'.")
        result.setdefault(key, []).append(code)
    return result


def parser():
    root = argparse.ArgumentParser(description="Discover and retrieve UN SDG data without R.")
    root.add_argument("--page-size", type=int, default=1000)
    root.add_argument("--timeout", type=float, default=45)
    commands = root.add_subparsers(dest="command", required=True)
    commands.add_parser("doctor")
    search = commands.add_parser("search")
    search.add_argument("query")
    search.add_argument("--limit", type=int, default=10)
    describe = commands.add_parser("describe")
    describe.add_argument("indicator")
    describe.add_argument("--series")
    locations = commands.add_parser("locations")
    locations.add_argument("names", nargs="+")
    get = commands.add_parser("get")
    get.add_argument("indicator")
    get.add_argument("--locations", nargs="+")
    get.add_argument("--series", nargs="+")
    get.add_argument("--year-from", type=int)
    get.add_argument("--year-to", type=int)
    get.add_argument("--dimension", action="append")
    get.add_argument("--attribute", action="append")
    get.add_argument("--output-dir", required=True)
    return root


def main(argv=None):
    # Windows console/pipe defaults may not encode official UN Unicode labels.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")
    args = parser().parse_args(argv)
    try:
        client = SDGClient(page_size=args.page_size, timeout=args.timeout)
        if args.command == "doctor":
            output = {"status": "ok", "indicator_count": len(client.indicators()), "source": BASE_URL,
                      "python": sys.version.split()[0], "r_required": False, "requests": client.trace}
        elif args.command == "search":
            output = search_indicators(args.query, client=client, limit=args.limit)
        elif args.command == "describe":
            output = describe_indicator(args.indicator, client=client, series=args.series)
        elif args.command == "locations":
            output = resolve_locations(args.names, client=client)
        else:
            resolved = resolve_locations(args.locations, client=client) if args.locations else None
            if resolved and resolved["status"] != "ok":
                print(json.dumps(resolved, ensure_ascii=False, indent=2))
                return 2
            codes = [r["code"] for r in resolved["locations"]] if resolved else None
            result = client.get_sdg_data(args.indicator, codes, args.year_from, args.year_to, args.series,
                                         filter_args(args.dimension), filter_args(args.attribute))
            response = build_response(result, client, resolved)
            files = write_result(args.output_dir, response, result["records"])
            output = {k: v for k, v in response.items() if k not in {"data", "observation_context", "metadata", "series_catalogue"}}
            output.update({"files": files, "preview": response["data"][:8], "preview_context": response["observation_context"][:8],
                           "preview_is_complete": len(response["data"]) <= 8,
                           "instruction": "Read response.json or observations.csv for the complete result, units and population strata."})
        print(json.dumps(output, ensure_ascii=False, indent=2, allow_nan=False))
        return 0 if output["status"] in {"ok", "no_matches", "indicator_no_data", "filters_no_data"} else 2
    except SDGError as exc:
        print(json.dumps(exc.as_dict(), ensure_ascii=False, indent=2))
        return 2
    except (OSError, ValueError, TypeError) as exc:
        print(json.dumps({"status": "error", "error": {"code": "local_processing_failed", "message": str(exc)}}))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
