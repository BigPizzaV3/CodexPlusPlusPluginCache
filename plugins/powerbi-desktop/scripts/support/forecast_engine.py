from collections import defaultdict

from forecast_rates import build_conversion_rates
from forecast_segments import build_segment_context, forecast_segment_month
from forecast_series import build_series
from forecast_targets import build_global_context, build_top_down_targets


def calculate_forecast(
    rows,
    forecast_year,
    start_month,
    end_month,
    as_of_date,
    horizon_months,
    grain,
):
    series, monthly_totals = build_series(rows, grain)
    rates, global_rate = build_conversion_rates(series, forecast_year, start_month)
    context = build_global_context(monthly_totals, forecast_year, start_month)
    targets = build_top_down_targets(
        monthly_totals,
        forecast_year,
        start_month,
        end_month,
        context,
        global_rate,
    )
    detail_rows = build_detail_rows(
        series,
        forecast_year,
        start_month,
        end_month,
        as_of_date,
        grain,
        context,
        rates,
        global_rate,
    )
    return scale_monthly_forecasts(detail_rows, targets)


def build_detail_rows(
    series,
    forecast_year,
    start_month,
    end_month,
    as_of_date,
    grain,
    context,
    rates,
    global_rate,
):
    detail_rows = []
    for key, points in sorted(series.items()):
        segment = build_segment_context(points, forecast_year, context)
        detail_rows.extend(
            forecast_segment_month(
                points,
                key,
                forecast_year,
                month,
                start_month,
                as_of_date,
                grain,
                segment,
                rates,
                global_rate,
            )
            for month in range(start_month, end_month + 1)
        )
    return detail_rows


def scale_monthly_forecasts(rows, targets):
    totals = defaultdict(float)
    for row in rows:
        totals[row["month_no"]] += row["raw_ai_forecast"]
    for row in rows:
        total = totals[row["month_no"]]
        factor = targets[row["month_no"]] / total if total else 0.0
        final = row["raw_ai_forecast"] * factor
        row["final_ai_forecast"] = round(final, 2)
        row["forecast_low"] = round(final * 0.90, 2)
        row["forecast_high"] = round(final * 1.10, 2)
    return rows
