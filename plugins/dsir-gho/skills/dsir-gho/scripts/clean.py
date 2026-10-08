"""Clean GHO records to the exact, ordered DSIR 0.9.0 core schema."""

from __future__ import annotations

import math
from typing import Any

from locations import load_countries


CORE_FIELDS = (
    "source", "id", "indicator", "location", "iso3", "location_name",
    "year", "value", "value_num", "low", "high", "series", "dim1", "dim2", "dim3",
)

REGION_NAMES = {
    "AFR": "Africa", "AMR": "Americas", "SEAR": "South-East Asia",
    "EUR": "Europe", "EMR": "Eastern Mediterranean", "WPR": "Western Pacific",
    "GLOBAL": "Global",
}


def _as_string(value: Any) -> str | None:
    """Keep literal strings, including empty strings and the text 'NA'."""
    if value is None or isinstance(value, float) and math.isnan(value):
        return None
    if isinstance(value, str):
        return value
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, (int, float)):
        if isinstance(value, float) and value.is_integer():
            return str(int(value))
        return str(value)
    raise ValueError("GHO source values must be scalar JSON values.")


def _as_number(value: Any) -> float | None:
    if value is None or isinstance(value, (dict, list, tuple)):
        return None
    try:
        number = float(value)
    except (ValueError, TypeError, OverflowError):
        return None
    return number if math.isfinite(number) else None


def _as_integer(value: Any) -> int | None:
    number = _as_number(value)
    if number is None:
        return None
    integer = int(number)
    # R's NA_integer_ occupies the minimum signed 32-bit integer.
    return integer if -2147483647 <= integer <= 2147483647 else None


def clean_records(
    records: list[dict], catalogue: list[dict], countries: list[dict] | None = None
) -> list[dict]:
    """Preserve DSIR mappings, missingness, duplicates and stable row ordering.

    The caller supplies the indicator catalogue: cleaning itself performs no
    network calls. None is the JSON representation of a missing scalar. A
    separate schema document supplies types even when the result is empty.
    """
    if not isinstance(records, list) or any(not isinstance(row, dict) for row in records):
        raise TypeError("records must be a list of dictionaries.")
    if not isinstance(catalogue, list) or any(not isinstance(row, dict) for row in catalogue):
        raise TypeError("catalogue must be a list of dictionaries.")
    countries = load_countries() if countries is None else countries
    country_names = {row["iso3"]: row["name_short"] for row in countries}
    indicator_names = {}
    for row in catalogue:
        code = _as_string(row.get("IndicatorCode"))
        if code is not None:
            indicator_names.setdefault(code, _as_string(row.get("IndicatorName")))

    cleaned = []
    for row in records:
        code = _as_string(row.get("IndicatorCode"))
        location = _as_string(row.get("SpatialDim"))
        cleaned.append({
            "source": "gho",
            "id": code,
            "indicator": indicator_names.get(code),
            "location": location,
            "iso3": location if location in country_names else None,
            "location_name": country_names.get(location, REGION_NAMES.get(location)),
            "year": _as_integer(row.get("TimeDim")),
            "value": _as_string(row.get("Value")),
            "value_num": _as_number(row.get("NumericValue")),
            "low": _as_number(row.get("Low")),
            "high": _as_number(row.get("High")),
            "series": None,
            "dim1": _as_string(row.get("Dim1")),
            "dim2": _as_string(row.get("Dim2")),
            "dim3": _as_string(row.get("Dim3")),
        })
    return sorted(cleaned, key=lambda row: (
        row["location"] is None, row["location"] or "",
        row["year"] is None, row["year"] if row["year"] is not None else 0,
    ))
