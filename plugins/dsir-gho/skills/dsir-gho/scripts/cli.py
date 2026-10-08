"""Small command-line interface used by the skill; stdout is structured JSON."""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import sys
from pathlib import Path

from gho_client import GHOClient, GHOError, BASE_URL, utc_now
from indicator_search import search_indicators, describe_indicator, basic_metadata
from locations import resolve_locations
from clean import clean_records, CORE_FIELDS, _as_string, _as_integer
from qa import qa_records

VERSION = "0.1.0"


def build_response(result, client, resolved=None):
    raw = result["records"]
    data = clean_records(raw, client.catalogue())
    query = result["query"]
    expected = {**query, **query["dimensions"]}
    qa = qa_records(data, raw=raw, expected=expected)
    meta = basic_metadata(result["indicator"])
    summaries, metadata_errors = {}, []
    for number in range(1, 4):
        type_key, code_key = f"Dim{number}Type", f"Dim{number}"
        pairs = sorted({(str(row.get(type_key) or ""), str(row[code_key]))
                        for row in raw if row.get(code_key) is not None})
        values = []
        for dimension in dict.fromkeys(pair[0] for pair in pairs):
            lookup = {}
            if dimension:
                try:
                    lookup = {row["Code"]: row.get("Title") for row in client.dimension_values(dimension)}
                except GHOError as exc:
                    metadata_errors.append({"dimension": dimension, **exc.as_dict()})
            values += [{"type": dimension or None, "code": code, "label": lookup.get(code)}
                       for dim, code in pairs if dim == dimension]
        summaries[code_key.lower()] = values
    context_fields = ["Id", "SpatialDimType", "SpatialDim", "TimeDim", "TimeDimType",
                      "Dim1Type", "Dim1", "Dim2Type", "Dim2", "Dim3Type", "Dim3",
                      "ParentLocationCode", "ParentLocation", "DataSourceDimType", "DataSourceDim",
                      "Comments", "Date", "TimeDimensionValue", "TimeDimensionBegin", "TimeDimensionEnd"]
    # Keep the WHO Id with all raw context; core `id` is the indicator code in DSIR.
    raw_order = sorted(enumerate(raw), key=lambda pair: (
        _as_string(pair[1].get("SpatialDim")) is None, _as_string(pair[1].get("SpatialDim")) or "",
        _as_integer(pair[1].get("TimeDim")) is None, _as_integer(pair[1].get("TimeDim")) or 0))
    context = [{"clean_row_index": index, "raw_row_index": raw_index,
                **{key: row.get(key) for key in context_fields}}
               for index, (raw_index, row) in enumerate(raw_order)]
    years = sorted({row["year"] for row in data if row["year"] is not None})
    requested = query.get("locations") or sorted({r["location"] for r in data if r["location"] is not None})
    coverage = [{"location": code, "years": sorted({r["year"] for r in data
                 if r["location"] == code and r["year"] is not None}),
                 "row_count": sum(r["location"] == code for r in data)} for code in requested]
    missing_locations = [r["location"] for r in coverage if not r["row_count"]]
    if missing_locations:
        qa["issues"].append({"severity": "warning", "code": "locations_without_data",
                             "message": "No observations match the filters for: " + ", ".join(missing_locations)})
        if qa["status"] == "pass":
            qa["status"] = "warning"
    region_notes = []
    if query["spatial_type"] == "REGION":
        region_notes.append("Official WHO regional observations were retrieved directly; no country aggregation was computed.")
        if set(query.get("locations") or []).intersection({"WPR", "WPR_WO_IDN", "SEAR", "SEAR_W_IDN"}):
            region_notes.append("Indonesia moved WHO regions in May 2025. Region codes refer to the series published in the current WHO release, not a year-by-year historical membership reconstruction. WPR_WO_IDN and SEAR_W_IDN are separately named WHO groups; do not splice their historical values into WPR/SEAR.")
    return {"schema_version": VERSION, "status": "qa_failed" if qa["status"] == "fail" else result["status"],
            "indicator": {"code": result["indicator"]["IndicatorCode"],
                          "name": result["indicator"]["IndicatorName"], **meta},
            "query": query, "resolved_locations": resolved, "region_scope_notes": region_notes,
            "available_years_in_result": years, "coverage_by_location": coverage, "row_count": len(data),
            "dimension_summary": summaries, "metadata_errors": metadata_errors, "qa": qa,
            "provenance": {**result["provenance"], "requests": client.trace,
                           "skill_version": VERSION, "reference_dsir_version": "0.9.0",
                           "reference_dsir_commit": "e2ff6735d174769b55f9a3e55f9f36c75ce9f397"},
            "baseline_probe": result.get("baseline_probe"), "data": data,
            "observation_context": context,
            "limitations": ["A WHO release may revise past observations. Retrieval time is not the observation year.",
                            "All returned strata are preserved. Do not sum or average rows with different dimensions or sources.",
                            "WHO has announced retirement of this GHO API; availability is checked for each run."]}


def write_result(output_dir, response, raw):
    destination = Path(output_dir).expanduser().resolve()
    try:
        destination.mkdir(parents=True, exist_ok=False)
    except FileExistsError as exc:
        raise GHOError("output_exists", "Use a new output directory; existing results are never overwritten.", path=str(destination)) from exc
    json_path, raw_path = destination / "response.json", destination / "raw.json"
    json_path.write_text(json.dumps(response, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    raw_path.write_text(json.dumps(raw, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    csv_path = destination / "data.csv"
    with csv_path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=CORE_FIELDS)
        writer.writeheader()
        writer.writerows(response["data"])
    files = {"response_json": str(json_path), "raw_json": str(raw_path), "data_csv": str(csv_path)}
    manifest = {"created_at": utc_now(), "files": {path.name: hashlib.sha256(path.read_bytes()).hexdigest()
                                                   for path in (json_path, raw_path, csv_path)}}
    (destination / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return files


def parser():
    root = argparse.ArgumentParser(description="Discover and retrieve public WHO GHO data, without R.")
    root.add_argument("--page-size", type=int, default=1000)
    commands = root.add_subparsers(dest="command", required=True)
    commands.add_parser("doctor", help="Check Python and actual WHO API connectivity.")
    search = commands.add_parser("search")
    search.add_argument("query")
    search.add_argument("--limit", type=int, default=10)
    describe = commands.add_parser("describe")
    describe.add_argument("indicator")
    location = commands.add_parser("locations")
    location.add_argument("names", nargs="+")
    location.add_argument("--spatial-type", choices=["COUNTRY", "REGION", "GLOBAL"])
    get = commands.add_parser("get")
    get.add_argument("indicator")
    get.add_argument("--locations", nargs="+")
    get.add_argument("--spatial-type", choices=["COUNTRY", "REGION", "GLOBAL"])
    get.add_argument("--year-from", type=int)
    get.add_argument("--year-to", type=int)
    for number in range(1, 4):
        get.add_argument(f"--dim{number}", nargs="+")
    get.add_argument("--output-dir", required=True, help="New directory for complete JSON, CSV and raw observations.")
    return root


def main(argv=None):
    args = parser().parse_args(argv)
    try:
        client = GHOClient(page_size=args.page_size)
        if args.command == "doctor":
            probe = client.collection("Indicator", {"$top": 1})
            if not probe["records"] or "IndicatorCode" not in probe["records"][0]:
                raise GHOError("invalid_response", "WHO catalogue connectivity check returned no valid entry.")
            output = {"status": "ok", "python_version": sys.version.split()[0],
                      "r_required": False, "who_api_access": True, "source": BASE_URL,
                      "checked_at": utc_now(), "note": "This check applies to this execution environment only."}
        elif args.command == "search":
            output = search_indicators(args.query, client=client, limit=args.limit)
        elif args.command == "describe":
            output = describe_indicator(args.indicator, client=client)
        elif args.command == "locations":
            output = resolve_locations(args.names, client=client, spatial_type=args.spatial_type)
        else:
            resolved = resolve_locations(args.locations, client=client, spatial_type=args.spatial_type) if args.locations else None
            if resolved and resolved["status"] != "ok":
                print(json.dumps(resolved, ensure_ascii=False, indent=2))
                return 2
            codes = [item["code"] for item in resolved["locations"]] if resolved else None
            types = {item["spatial_type"] for item in resolved["locations"]} if resolved else set()
            if len(types) > 1:
                raise GHOError("invalid_query", "Query countries and regional aggregates separately.")
            spatial_type = next(iter(types)) if types else args.spatial_type
            dimensions = {f"dim{i}": getattr(args, f"dim{i}") for i in range(1, 4) if getattr(args, f"dim{i}")}
            result = client.get_gho_data(args.indicator, codes, args.year_from, args.year_to, dimensions, spatial_type)
            response = build_response(result, client, resolved)
            files = write_result(args.output_dir, response, result["records"])
            output = {key: value for key, value in response.items() if key not in {"data", "observation_context"}}
            output.update({"files": files, "preview": response["data"][:12],
                           "preview_is_complete": len(response["data"]) <= 12,
                           "instruction": "Read response.json or data.csv for the complete result; do not interpret the preview as the full series."})
        print(json.dumps(output, ensure_ascii=False, indent=2, allow_nan=False))
        return 0 if output["status"] in {"ok", "no_matches", "indicator_no_data", "filters_no_data"} else 2
    except GHOError as exc:
        print(json.dumps(exc.as_dict(), ensure_ascii=False, indent=2))
        return 2
    except OSError as exc:
        print(json.dumps({"status": "error", "error": {"code": "local_io_failed", "message": str(exc)}}, indent=2))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
