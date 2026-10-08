"""Preserve strata and flag data quality issues without inventing observations."""
import json
from collections import Counter, defaultdict
from clean import CORE_FIELDS, observation_context


def qa_records(records, cleaned):
    issues = []
    if len(records) != len(cleaned) or any(tuple(row) != CORE_FIELDS for row in cleaned):
        issues.append({"severity": "error", "code": "schema_or_row_loss", "message": "Cleaning changed row count or core schema."})
    contexts = observation_context(records)
    groups, keys = defaultdict(list), Counter()
    for row, ctx in zip(cleaned, contexts):
        dimensions, attributes = ctx.get("dimensions") or {}, ctx.get("attributes") or {}
        if not isinstance(dimensions, dict) or not isinstance(attributes, dict):
            issues.append({"severity": "error", "code": "invalid_dimensions", "message": "Observation dimensions and attributes must be objects."})
            continue
        units = attributes.get("Units")
        group = (row["location"], row["series"], json.dumps(dimensions, sort_keys=True), units)
        groups[group].append(row)
        keys[group + (row["year"], ctx.get("source"))] += 1
        if row["year"] is None or row["location"] is None or row["series"] is None:
            issues.append({"severity": "error", "code": "missing_identity", "message": "An observation lacks area, year or series."})
        if row["low"] is not None and row["high"] is not None and row["low"] > row["high"]:
            issues.append({"severity": "error", "code": "reversed_interval", "message": "Lower bound exceeds upper bound."})
        if row["value_num"] is not None and ((row["low"] is not None and row["value_num"] < row["low"]) or (row["high"] is not None and row["value_num"] > row["high"])):
            issues.append({"severity": "warning", "code": "value_outside_interval", "message": "Point value lies outside its interval; retain the source values."})
    duplicates = sum(n - 1 for n in keys.values() if n > 1)
    if duplicates:
        issues.append({"severity": "warning", "code": "duplicate_observation_keys", "message": f"{duplicates} rows share series/area/year/dimensions/unit/source; retained for inspection."})
    censored = sum(r["value"] not in (None, "") and r["value_num"] is None for r in cleaned)
    if censored:
        issues.append({"severity": "warning", "code": "nonnumeric_values", "message": f"{censored} values are censored or nonnumeric; display their original text, never replace them with zero."})
    if len({(g[1], g[2], g[3]) for g in groups}) > 1:
        issues.append({"severity": "warning", "code": "multiple_strata", "message": "Multiple series, dimensions or units remain. Report separately or clarify the intended population; do not sum/average them."})
    summaries = [{"location": k[0], "series": k[1], "dimensions": json.loads(k[2]), "unit": k[3],
                  "years": sorted({r['year'] for r in values if r['year'] is not None}), "rows": len(values)}
                 for k, values in groups.items()]
    return {"status": "fail" if any(i['severity'] == 'error' for i in issues) else "warning" if issues else "pass",
            "issues": issues, "summaries": summaries, "row_count": len(cleaned),
            "missing_numeric": sum(r["value_num"] is None for r in cleaned)}
