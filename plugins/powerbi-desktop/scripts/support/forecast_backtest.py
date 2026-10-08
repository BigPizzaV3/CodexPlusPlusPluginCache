from forecast_engine import calculate_forecast
from forecast_primitives import MONTH_NAMES, month_label, num
from forecast_summary import build_summary_rows


BACKTEST_FIELDNAMES = [
    "as_of_month", "forecast_month", "horizon_months", "actual_sales",
    "ai_forecast", "roll_forecast", "absolute_error", "roll_absolute_error", "bias",
]


def build_backtest_rows(rows, forecast_year, start_month, horizon_months, grain):
    detail_rows = []
    for as_of_month in range(1, max(1, start_month)):
        detail_rows.extend(
            backtest_month(rows, forecast_year, as_of_month, horizon_months, grain)
        )
    return detail_rows


def backtest_month(rows, forecast_year, as_of_month, horizon_months, grain):
    horizon_end = min(12, as_of_month + horizon_months)
    simulated = calculate_forecast(
        rows,
        forecast_year,
        as_of_month + 1,
        horizon_end,
        month_label(forecast_year, as_of_month),
        horizon_months,
        grain,
    )
    return [backtest_row(row, as_of_month) for row in build_summary_rows(simulated)]


def backtest_row(row, as_of_month):
    actual = num(row["actual_sales"])
    ai_forecast = num(row["final_ai_forecast"])
    roll = num(row["roll_forecast"])
    return {
        "as_of_month": row["forecast_month"],
        "forecast_month": row["forecast_month"],
        "horizon_months": month_number(row["forecast_month"]) - as_of_month,
        "actual_sales": round(actual, 2),
        "ai_forecast": round(ai_forecast, 2),
        "roll_forecast": round(roll, 2),
        "absolute_error": round(abs(ai_forecast - actual), 2),
        "roll_absolute_error": round(abs(roll - actual), 2),
        "bias": round(ai_forecast - actual, 2),
    }


def month_number(label):
    return next(number for number, name in MONTH_NAMES.items() if label.startswith(name))
