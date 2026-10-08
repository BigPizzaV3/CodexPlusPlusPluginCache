def blended_forecast(values, expected, month, start_month, segment):
    components = [
        (0.25, values["seasonal"] * (1 + segment["growth"])),
        (0.15, values["trend"] * (1 + segment["growth"])),
        (0.10, segment["intermittent"]),
        (0.15, values["budget"]),
        (0.15, values["roll"]),
    ]
    if expected > 0:
        backlog_weight = 0.35 if month <= start_month + 2 else 0.20
        components.append((backlog_weight, expected))
    if values["actual"] > 0 and month == start_month:
        components.append((0.25, values["actual"] * 18.0 / 5.0))
    positive = [(weight, value) for weight, value in components if value > 0]
    total_weight = sum(weight for weight, _ in positive)
    if not total_weight:
        return 0.0
    return sum(weight * value for weight, value in positive) / total_weight
