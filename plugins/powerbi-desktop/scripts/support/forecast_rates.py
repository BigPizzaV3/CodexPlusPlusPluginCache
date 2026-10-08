from forecast_primitives import clamp
from forecast_series import value_for


def build_conversion_rates(series, forecast_year, start_month):
    all_rates = []
    segment_rates = {}
    for key, points in series.items():
        rates = historical_rates(points, forecast_year, start_month)
        if rates:
            segment_rates[key] = sum(rates) / len(rates)
            all_rates.extend(rates)
    average = sum(all_rates) / len(all_rates) if all_rates else 0.50
    return segment_rates, clamp(average, 0.10, 0.90)


def historical_rates(points, forecast_year, start_month):
    rates = []
    for year in range(forecast_year - 3, forecast_year + 1):
        rates.extend(year_rates(points, year, forecast_year, start_month))
    return rates


def year_rates(points, year, forecast_year, start_month):
    rates = []
    for month in range(1, 13):
        if year == forecast_year and month >= start_month:
            continue
        rate = realized_rate(points, year, month)
        if rate is not None:
            rates.append(rate)
    return rates


def realized_rate(points, year, month):
    backlog = value_for(points, year, month, "backlog")
    realized = value_for(points, year, month, "sales")
    if backlog <= 0 or realized <= 0:
        return None
    return clamp(realized / backlog, 0.10, 0.95)
