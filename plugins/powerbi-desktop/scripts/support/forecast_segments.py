from forecast_blending import blended_forecast
from forecast_primitives import clamp, conversion_probability
from forecast_records import forecast_row
from forecast_series import value_for


def build_segment_context(points, forecast_year, context):
    ytd_months = context["ytd_months"]
    current = sum(value_for(points, forecast_year, month, "sales") for month in ytd_months)
    prior = sum(
        value_for(points, forecast_year - 1, month, "sales") for month in ytd_months
    )
    raw_growth = current / prior - 1 if prior else context["growth"]
    shrink_weight = clamp(prior / 100000.0, 0.0, 1.0)
    history = historical_sales(points, forecast_year)
    history_months = len(history)
    history_sales = sum(history)
    return {
        "growth": clamp(
            shrink_weight * raw_growth + (1 - shrink_weight) * context["growth"],
            -0.40,
            0.60,
        ),
        "intermittent": intermittent_sales(history_sales, history_months),
        "sparse": history_months < 6 and history_sales < 50000,
    }


def historical_sales(points, forecast_year):
    return [
        values["sales"]
        for (year, _), values in points.items()
        if year < forecast_year and values["sales"] > 0
    ]


def intermittent_sales(history_sales, history_months):
    if not history_months:
        return 0.0
    return (history_sales / history_months) * clamp(history_months / 12.0, 0.05, 1.0)


def forecast_segment_month(
    points,
    key,
    forecast_year,
    month,
    start_month,
    as_of_date,
    grain,
    segment,
    conversion_rates,
    global_rate,
):
    values = month_values(points, forecast_year, month)
    probability = conversion_probability(
        values["backlog"], values["actual"], conversion_rates.get(key, global_rate)
    )
    expected = values["backlog"] * probability
    raw = blended_forecast(values, expected, month, start_month, segment)
    return forecast_row(
        points, key, values, as_of_date, forecast_year, month, grain,
        segment, probability, expected, raw,
    )


def month_values(points, forecast_year, month):
    history = [
        value_for(points, year, month, "sales")
        for year in (forecast_year - 3, forecast_year - 2, forecast_year - 1)
    ]
    history = [value for value in history if value > 0]
    seasonal = value_for(points, forecast_year - 1, month, "sales")
    return {
        "actual": value_for(points, forecast_year, month, "sales"),
        "budget": value_for(points, forecast_year, month, "budget"),
        "roll": value_for(points, forecast_year, month, "roll"),
        "backlog": value_for(points, forecast_year, month, "backlog"),
        "seasonal": seasonal,
        "trend": sum(history) / len(history) if history else seasonal,
    }

