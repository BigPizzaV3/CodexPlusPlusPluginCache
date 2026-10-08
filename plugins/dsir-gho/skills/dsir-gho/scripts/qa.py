"""Check GHO output quality and filter fidelity without modifying observations."""

from __future__ import annotations

from collections import Counter
import math

from clean import CORE_FIELDS, _as_integer, _as_number, _as_string


def _values(value):
    if value is None:
        return None
    return value if isinstance(value, (list, tuple, set)) else [value]


def _signature(row, fields):
    return tuple(repr(row.get(field)) for field in fields)


def qa_records(cleaned: list[dict], raw: list[dict] | None = None, expected: dict | None = None) -> dict:
    """Return pass/warning/fail with explicit issues; retain duplicates and strata.

    expected accepts indicator/indicator_codes, area/locations, spatial_type,
    year_from, year_to and dim1/dim2/dim3, optionally nested under filters.
    The supplied raw records must correspond to this complete cleaned pull.
    """
    if not isinstance(cleaned, list) or any(not isinstance(row, dict) for row in cleaned):
        raise TypeError("cleaned must be a list of dictionaries.")
    if raw is not None and (not isinstance(raw, list) or any(not isinstance(row, dict) for row in raw)):
        raise TypeError("raw must be a list of dictionaries or None.")
    if expected is not None and not isinstance(expected, dict):
        raise TypeError("expected must be a dictionary or None.")
    expected = dict(expected or {})
    expected = {**expected, **expected.get("filters", {})}
    issues = []
    counts = {"rows": len(cleaned), "raw_rows": len(raw) if raw is not None else None}

    def issue(severity, code, message, count=None):
        item = {"severity": severity, "code": code, "message": message}
        if count is not None:
            item["count"] = count
        issues.append(item)

    if not cleaned:
        issue("warning", "empty_result", "No observations were returned; this is not evidence of a zero indicator value.")
    bad_schema = sum(set(row) != set(CORE_FIELDS) for row in cleaned)
    if bad_schema:
        issue("error", "schema_mismatch", "Rows must contain exactly the 15 DSIR core fields.", bad_schema)
    invalid_types = 0
    string_fields = set(CORE_FIELDS) - {"year", "value_num", "low", "high"}
    for row in cleaned:
        bad = any(row.get(field) is not None and not isinstance(row[field], str) for field in string_fields)
        year = row.get("year")
        bad = bad or year is not None and (not isinstance(year, int) or isinstance(year, bool))
        for field in ("value_num", "low", "high"):
            value = row.get(field)
            bad = bad or value is not None and (
                not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(value)
            )
        invalid_types += int(bad)
    if invalid_types:
        issue("error", "invalid_core_type", "Core values must be nullable strings, integer years and finite numbers.", invalid_types)
    if raw is not None and len(raw) != len(cleaned):
        issue("error", "row_count_changed", "Raw and cleaned row counts differ; cleaning must retain all observations.")
    wrong_source = sum(row.get("source") != "gho" for row in cleaned)
    if wrong_source:
        issue("error", "source_mismatch", "The source field must be gho.", wrong_source)
    missing_identity = sum(row.get("id") in (None, "") or row.get("location") in (None, "") for row in cleaned)
    if missing_identity:
        issue("warning", "missing_identity", "Some rows lack an indicator code or location code.", missing_identity)

    exact_counts = Counter(_signature(row, CORE_FIELDS) for row in cleaned)
    key_fields = ("source", "id", "location", "year", "series", "dim1", "dim2", "dim3")
    key_counts = Counter(_signature(row, key_fields) for row in cleaned)
    counts["duplicate_rows"] = sum(number - 1 for number in exact_counts.values() if number > 1)
    counts["duplicate_keys"] = sum(number - 1 for number in key_counts.values() if number > 1)
    if counts["duplicate_rows"]:
        issue("warning", "duplicate_rows", "Exact duplicate core rows were retained; review the raw records before deduplicating.", counts["duplicate_rows"])
    if counts["duplicate_keys"] > counts["duplicate_rows"]:
        issue("warning", "duplicate_observation_keys", "More than one observation shares an indicator/location/year/dimension key; no rows were dropped.", counts["duplicate_keys"])
    counts["missing_numeric"] = sum(row.get("value_num") is None for row in cleaned)
    counts["missing_year"] = sum(row.get("year") is None for row in cleaned)
    counts["missing_indicator_name"] = sum(row.get("indicator") is None for row in cleaned)
    counts["missing_location_name"] = sum(row.get("location_name") is None for row in cleaned)
    for count_key, code, message in (
        ("missing_numeric", "missing_numeric", "Some observations have no numeric estimate; raw text values were retained."),
        ("missing_year", "missing_year", "Some observations have no usable integer year."),
        ("missing_indicator_name", "missing_indicator_name", "Some indicator codes have no catalogue name."),
        ("missing_location_name", "missing_location_name", "Some locations are outside the DSIR naming snapshot; retain their raw codes and consult live metadata."),
    ):
        if counts[count_key]:
            issue("warning", code, message, counts[count_key])

    invalid_bounds = outside_bounds = 0
    for row in cleaned:
        lower, upper, value = (_as_number(row.get(field)) for field in ("low", "high", "value_num"))
        if lower is not None and upper is not None and lower > upper:
            invalid_bounds += 1
        if value is not None:
            tolerance = max(1.0, abs(value)) * 1e-10
            if lower is not None and value < lower - tolerance or upper is not None and value > upper + tolerance:
                outside_bounds += 1
    counts.update(invalid_bounds=invalid_bounds, estimates_outside_bounds=outside_bounds)
    if invalid_bounds:
        issue("error", "reversed_bounds", "The lower uncertainty bound exceeds the upper bound.", invalid_bounds)
    if outside_bounds:
        issue("warning", "estimate_outside_bounds", "Some estimates fall outside their reported uncertainty bounds.", outside_bounds)

    if raw is not None:
        counts["nonnumeric_years"] = sum(row.get("TimeDim") is not None and _as_integer(row.get("TimeDim")) is None for row in raw)
        counts["fractional_years"] = sum(
            _as_number(row.get("TimeDim")) is not None and not _as_number(row.get("TimeDim")).is_integer()
            for row in raw
        )
        if counts["nonnumeric_years"]:
            issue("warning", "nonnumeric_year", "Some raw TimeDim values could not be converted to integer years.", counts["nonnumeric_years"])
        if counts["fractional_years"]:
            issue("warning", "fractional_year", "Fractional TimeDim values were truncated toward zero, following DSIR.", counts["fractional_years"])
        dim_fields = ("id", "location", "year", "dim1", "dim2", "dim3")
        projected_raw = [{
            "id": _as_string(row.get("IndicatorCode")),
            "location": _as_string(row.get("SpatialDim")),
            "year": _as_integer(row.get("TimeDim")),
            "dim1": _as_string(row.get("Dim1")),
            "dim2": _as_string(row.get("Dim2")),
            "dim3": _as_string(row.get("Dim3")),
        } for row in raw]
        dimensions_preserved = Counter(_signature(row, dim_fields) for row in projected_raw) == Counter(
            _signature(row, dim_fields) for row in cleaned
        )
        counts["dimensions_preserved"] = dimensions_preserved
        if not dimensions_preserved:
            issue("error", "dimensions_changed", "The indicator/location/year/dimension combinations differ between raw and cleaned data.")

    # A filter mismatch means the exported data do not answer the request.
    requested_codes = _values(expected.get("indicator_codes", expected.get("indicator")))
    areas = _values(expected.get("area", expected.get("locations")))
    if areas is not None:
        areas = [item.get("code") if isinstance(item, dict) else item for item in areas]
    for field, allowed, label in [("id", requested_codes, "indicator"), ("location", areas, "area")]:
        if allowed is not None:
            bad = sum(row.get(field) not in allowed for row in cleaned)
            if bad:
                issue("error", f"{label}_filter_mismatch", f"Returned rows violate the requested {label} filter.", bad)
    for field in ("dim1", "dim2", "dim3"):
        allowed = _values(expected.get(field))
        if allowed is not None:
            bad = sum(row.get(field) not in allowed for row in cleaned)
            if bad:
                issue("error", "dimension_filter_mismatch", f"Returned rows violate the requested {field} filter.", bad)
    for field, compare in (("year_from", lambda year, bound: year < bound), ("year_to", lambda year, bound: year > bound)):
        bound = _as_number(expected.get(field))
        if bound is not None:
            bad = sum(_as_number(row.get("year")) is None or compare(_as_number(row.get("year")), bound) for row in cleaned)
            if bad:
                issue("error", "year_filter_mismatch", f"Returned rows violate the requested {field} filter.", bad)
    spatial_type = expected.get("spatial_type")
    if spatial_type is not None:
        if raw is None:
            issue("warning", "spatial_type_unverified", "Raw records are needed to verify SpatialDimType.")
        else:
            bad = sum(str(row.get("SpatialDimType", "")).casefold() != str(spatial_type).casefold() for row in raw)
            if bad:
                issue("error", "spatial_type_filter_mismatch", "Raw rows violate the requested spatial type filter.", bad)
    counts["locations"] = len({row.get("location") for row in cleaned if isinstance(row.get("location"), str)})
    counts["indicators"] = len({row.get("id") for row in cleaned if isinstance(row.get("id"), str)})
    counts["dimension_combinations"] = len({_signature(row, ("dim1", "dim2", "dim3")) for row in cleaned})
    status = "fail" if any(item["severity"] == "error" for item in issues) else "warning" if issues else "pass"
    return {"status": status, "issues": issues, "counts": counts, "rows_modified": False}
