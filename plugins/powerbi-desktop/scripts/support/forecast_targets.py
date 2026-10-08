from forecast_primitives import conversion_probability


def build_global_context(monthly_totals, forecast_year, start_month):
    ytd_months = range(1, max(1, start_month))
    current = sum(monthly_totals[(forecast_year, month)]["sales"] for month in ytd_months)
    prior = sum(
        monthly_totals[(forecast_year - 1, month)]["sales"] for month in ytd_months
    )
    annual_current = annual_sales(monthly_totals, forecast_year - 1)
    annual_prior = annual_sales(monthly_totals, forecast_year - 2)
    return {
        "ytd_months": ytd_months,
        "growth": growth_rate(current, prior),
        "annual_growth": growth_rate(annual_current, annual_prior),
        "monthly_fallback": annual_current / 12.0 if annual_current else 0.0,
    }


def annual_sales(monthly_totals, year):
    return sum(monthly_totals[(year, month)]["sales"] for month in range(1, 13))


def growth_rate(current, prior):
    return current / prior - 1 if prior else 0.0


def build_top_down_targets(
    monthly_totals,
    forecast_year,
    start_month,
    end_month,
    context,
    global_rate,
):
    return {
        month: month_target(
            monthly_totals[(forecast_year, month)],
            monthly_totals[(forecast_year - 1, month)],
            month,
            start_month,
            context,
            global_rate,
        )
        for month in range(start_month, end_month + 1)
    }


def month_target(current, previous, month, start_month, context, global_rate):
    actual = current["sales"]
    seasonal = previous["sales"] * (1 + context["growth"])
    expected = current["backlog"] * conversion_probability(
        current["backlog"], actual, global_rate
    )
    target = regular_target(current, seasonal, expected, context["annual_growth"])
    if month == start_month and actual > 0:
        target = first_month_target(current, actual, seasonal, expected)
    return target if target > 0 else context["monthly_fallback"]


def regular_target(current, seasonal, expected, annual_growth):
    trend = seasonal * (1 + annual_growth)
    return (
        0.30 * seasonal
        + 0.20 * current["budget"]
        + 0.20 * current["roll"]
        + 0.20 * expected
        + 0.10 * trend
    )


def first_month_target(current, actual, seasonal, expected):
    return (
        0.35 * actual * 18.0 / 5.0
        + 0.25 * seasonal
        + 0.20 * current["budget"]
        + 0.10 * current["roll"]
        + 0.10 * expected
    )
