from collections import defaultdict

from forecast_primitives import num


QUALITY_FIELDNAMES = [
    "horizon_months", "segment", "actual_sales", "ai_forecast", "roll_forecast",
    "wape", "roll_wape", "bias", "risk_flag",
]


def build_quality_rows(backtest_rows):
    by_horizon = defaultdict(lambda: defaultdict(float))
    for row in backtest_rows:
        values = by_horizon[int(row["horizon_months"])]
        add_quality_values(values, row)
    if not by_horizon:
        return [insufficient_quality_row()]
    return [quality_row(horizon, values) for horizon, values in sorted(by_horizon.items())]


def add_quality_values(values, row):
    for fieldname in quality_input_fields():
        values[fieldname] += num(row[fieldname])


def quality_input_fields():
    return [
        "actual_sales", "ai_forecast", "roll_forecast", "absolute_error",
        "roll_absolute_error",
    ]


def quality_row(horizon, values):
    actual = values["actual_sales"]
    bias = values["ai_forecast"] - actual
    wape = values["absolute_error"] / actual if actual else 0.0
    roll_wape = values["roll_absolute_error"] / actual if actual else 0.0
    bias_ratio = bias / actual if actual else 0.0
    return {
        "horizon_months": horizon,
        "segment": "Total",
        "actual_sales": round(actual, 2),
        "ai_forecast": round(values["ai_forecast"], 2),
        "roll_forecast": round(values["roll_forecast"], 2),
        "wape": round(wape, 6),
        "roll_wape": round(roll_wape, 6),
        "bias": round(bias_ratio, 6),
        "risk_flag": quality_risk(wape, roll_wape, bias_ratio),
    }


def quality_risk(wape, roll_wape, bias_ratio):
    if wape > roll_wape:
        return "advisory_only"
    return "biased" if abs(bias_ratio) > 0.03 else "normal"


def insufficient_quality_row():
    return {
        "horizon_months": 1,
        "segment": "Total",
        "actual_sales": 0.0,
        "ai_forecast": 0.0,
        "roll_forecast": 0.0,
        "wape": 0.0,
        "roll_wape": 0.0,
        "bias": 0.0,
        "risk_flag": "insufficient_history",
    }
