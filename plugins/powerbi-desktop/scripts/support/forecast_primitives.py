import json
import math


MONTH_NAMES = {
    1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "May", 6: "Jun",
    7: "Jul", 8: "Aug", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dec",
}


def num(value):
    if value is None:
        return 0.0
    try:
        if isinstance(value, float) and math.isnan(value):
            return 0.0
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def clamp(value, low, high):
    return max(low, min(high, value))


def load_rows(input_path):
    with open(input_path, "r", encoding="utf-8-sig") as handle:
        return json.load(handle).get("rows", [])


def first_value(row, names):
    for name in names:
        value = row.get(name)
        if value not in (None, ""):
            return value
    return None


def month_label(year, month):
    name = MONTH_NAMES.get(month)
    return f"{name} {year}" if name else f"{month:02d}/{year}"


def conversion_probability(backlog, realized_sales, fallback):
    if backlog <= 0:
        return 0.0
    observed = realized_sales / backlog
    if observed > 0:
        return clamp(observed, 0.10, 0.95)
    return fallback
