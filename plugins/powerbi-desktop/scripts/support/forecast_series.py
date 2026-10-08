from collections import defaultdict

from forecast_primitives import first_value, num


def build_series(rows, grain):
    series = defaultdict(dict)
    totals = defaultdict(lambda: defaultdict(float))
    for row in rows:
        identity = row_identity(row)
        year = int(row["Dates[Calendar Year]"])
        month = int(row["Dates[Calendar MonthNumber]"])
        key = identity_key(identity, grain)
        point = series[key].setdefault((year, month), empty_point())
        update_point(point, totals[(year, month)], row)
        point.update(identity)
    return series, totals


def row_identity(row):
    customer_hierarchy = row.get("dw Custtable[CustHierachy01]") or "n/a"
    product_line = row.get("dw Inventtable[ProductLineHerachy01]") or "n/a"
    customer = first_value(
        row, ["dw Custtable[AccountNum_nk]", "dw Custtable[AccountNum_sk]", "customer"]
    ) or customer_hierarchy
    product = first_value(
        row, ["dw Inventtable[ItemId_nk]", "dw Inventtable[ItemId_sk]", "product"]
    ) or product_line
    return {
        "customer_hierarchy": customer_hierarchy,
        "product_line": product_line,
        "customer": customer,
        "product": product,
    }


def identity_key(identity, grain):
    if grain == "CustomerProduct":
        return identity["customer"], identity["product"]
    return identity["customer_hierarchy"], identity["product_line"]


def empty_point():
    return {"sales": 0.0, "qty": 0.0, "budget": 0.0, "roll": 0.0, "backlog": 0.0}


def update_point(point, month_total, row):
    values = {
        "sales": num(row.get("[Sales]")),
        "qty": num(row.get("[Qty]")),
        "budget": num(row.get("[Budget]")),
        "roll": num(row.get("[ForecastRoll]")),
        "backlog": num(row.get("[Backlog]")),
    }
    for metric, value in values.items():
        point[metric] += value
        month_total[metric] += value


def value_for(points, year, month, metric):
    return points.get((year, month), {}).get(metric, 0.0)
