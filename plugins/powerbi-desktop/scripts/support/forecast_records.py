from forecast_primitives import month_label


def forecast_row(
    points, key, values, as_of_date, forecast_year, month, grain,
    segment, probability, expected, raw,
):
    sample = next(iter(points.values()))
    risk = risk_flag(segment["sparse"], segment["growth"])
    return {
        "as_of_date": as_of_date,
        "forecast_month": month_label(forecast_year, month),
        "grain": grain if not segment["sparse"] else "HierarchyProductLineFallback",
        "customer": sample.get("customer", key[0]),
        "product": sample.get("product", key[1]),
        "customer_hierarchy": sample.get("customer_hierarchy", key[0]),
        "product_line": sample.get("product_line", key[1]),
        "month": month_label(forecast_year, month),
        "month_no": month,
        "actual_sales": round(values["actual"], 2),
        "open_backlog": round(values["backlog"], 2),
        "backlog_conversion_probability": round(probability, 4),
        "expected_backlog_revenue": round(expected, 2),
        "budget": round(values["budget"], 2),
        "roll_forecast": round(values["roll"], 2),
        "statistical_demand_forecast": round(
            max(values["seasonal"], values["trend"], segment["intermittent"]), 2
        ),
        "residual_demand_forecast": round(max(0.0, raw - expected - values["actual"]), 2),
        "raw_ai_forecast": round(raw, 2),
        "final_ai_forecast": 0.0,
        "forecast_low": 0.0,
        "forecast_high": 0.0,
        "confidence": confidence_for(risk),
        "risk_flag": risk,
        "explanation": explanation_for(risk, probability),
    }


def risk_flag(sparse, growth):
    if sparse:
        return "sparse"
    return "volatile" if abs(growth) > 0.30 else "normal"


def confidence_for(risk):
    return {"sparse": "low", "volatile": "medium"}.get(risk, "high")


def explanation_for(risk, probability):
    return (
        f"{risk} segment; learned backlog probability {probability:.0%}; "
        "blended backlog, residual demand, budget, and roll forecast."
    )
