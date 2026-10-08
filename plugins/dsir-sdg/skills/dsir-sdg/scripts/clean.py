"""Exact DSIR sdg_clean 15-column semantics; retain extra fields separately."""
import math
from locations import load_countries
from sdg_client import as_year

CORE_FIELDS = ("source", "id", "indicator", "location", "iso3", "location_name", "year",
               "value", "value_num", "low", "high", "series", "dim1", "dim2", "dim3")


def as_string(value):
    if value is None or isinstance(value, float) and math.isnan(value):
        return None
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, (dict, list)):
        raise ValueError("Expected a scalar JSON value.")
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def as_number(value):
    try:
        number = float(value)
        return number if math.isfinite(number) else None
    except (ValueError, TypeError, OverflowError):
        return None


def row_order(records):
    return sorted(range(len(records)), key=lambda i: (
        records[i].get("geoAreaCode") is None, as_string(records[i].get("geoAreaCode")) or "",
        as_year(records[i].get("timePeriodStart")) is None, as_year(records[i].get("timePeriodStart")) or 0))


def clean_records(records, countries=None):
    if not isinstance(records, list) or any(not isinstance(r, dict) for r in records):
        raise TypeError("records must be a list of dictionaries.")
    countries = load_countries() if countries is None else countries
    mapping = {int(c["m49_code"]): c for c in countries}
    result = []
    for i in row_order(records):
        raw = records[i]
        location = as_string(raw.get("geoAreaCode"))
        country = mapping.get(as_year(location))
        ids = raw.get("indicator")
        code = ids[0] if isinstance(ids, list) and ids else None if isinstance(ids, list) else ids
        result.append(dict(zip(CORE_FIELDS, (
            "sdg", as_string(code), as_string(raw.get("seriesDescription")), location,
            country["iso3"] if country else None,
            country["name_short"] if country else as_string(raw.get("geoAreaName")),
            as_year(raw.get("timePeriodStart")), as_string(raw.get("value")), as_number(raw.get("value")),
            as_number(raw.get("lowerBound")), as_number(raw.get("upperBound")), as_string(raw.get("series")),
            None, None, None))))
    return result


def observation_context(records):
    fields = ("indicator", "goal", "target", "dimensions", "attributes", "source", "footnotes",
              "time_detail", "timeCoverage", "basePeriod", "valueType", "geoInfoUrl")
    return [{"clean_row_index": j, "raw_row_index": i, **{k: records[i].get(k) for k in fields}}
            for j, i in enumerate(row_order(records))]
