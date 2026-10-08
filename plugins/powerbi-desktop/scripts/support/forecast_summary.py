from collections import defaultdict

from forecast_primitives import num


SUMMARY_FIELDNAMES = [
    "forecast_month", "month", "actual_sales", "open_backlog",
    "expected_backlog_revenue", "budget", "roll_forecast",
    "statistical_demand_forecast", "residual_demand_forecast", "raw_ai_forecast",
    "final_ai_forecast", "delta_ai_vs_roll", "delta_ai_vs_budget",
]


def build_summary_rows(detail_rows):
    by_month = defaultdict(lambda: defaultdict(float))
    labels = {}
    for row in detail_rows:
        month_no = int(row["month_no"])
        labels[month_no] = row["forecast_month"]
        update_summary(by_month[month_no], row)
    return [summary_row(month_no, labels[month_no], by_month[month_no]) for month_no in sorted(by_month)]


def update_summary(values, row):
    for fieldname in SUMMARY_FIELDNAMES:
        if fieldname not in ("month", "forecast_month"):
            values[fieldname] += num(row.get(fieldname))


def summary_row(month_no, label, values):
    values["delta_ai_vs_roll"] = values["final_ai_forecast"] - values["roll_forecast"]
    values["delta_ai_vs_budget"] = values["final_ai_forecast"] - values["budget"]
    return {
        "forecast_month": label,
        "month": label,
        **{fieldname: round(value, 2) for fieldname, value in values.items()},
    }


def build_top_delta_rows(detail_rows, limit=200):
    return sorted(detail_rows, key=delta_magnitude, reverse=True)[:limit]


def delta_magnitude(row):
    return abs(num(row.get("final_ai_forecast")) - num(row.get("roll_forecast")))
