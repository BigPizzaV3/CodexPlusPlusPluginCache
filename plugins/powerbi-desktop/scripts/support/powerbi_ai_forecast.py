import argparse
import csv
import json
from pathlib import Path

from forecast_backtest import BACKTEST_FIELDNAMES, build_backtest_rows
from forecast_engine import calculate_forecast
from forecast_primitives import conversion_probability, load_rows
from forecast_quality import QUALITY_FIELDNAMES, build_quality_rows
from forecast_summary import (
    SUMMARY_FIELDNAMES,
    build_summary_rows,
    build_top_delta_rows,
)


DETAIL_FIELDNAMES = [
    "as_of_date", "forecast_month", "grain", "customer", "product",
    "customer_hierarchy", "product_line", "month", "month_no", "actual_sales",
    "open_backlog", "backlog_conversion_probability", "expected_backlog_revenue",
    "budget", "roll_forecast", "statistical_demand_forecast",
    "residual_demand_forecast", "raw_ai_forecast", "final_ai_forecast",
    "forecast_low", "forecast_high", "confidence", "risk_flag", "explanation",
]


def write_csv(path, rows, fieldnames):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, delimiter=";")
        writer.writeheader()
        writer.writerows(rows)


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output-directory", required=True)
    parser.add_argument("--as-of-date", default="")
    parser.add_argument("--forecast-year", type=int, default=2026)
    parser.add_argument("--start-month", type=int, default=5)
    parser.add_argument("--end-month", type=int, default=12)
    parser.add_argument("--horizon-months", type=int, default=3)
    parser.add_argument(
        "--grain",
        choices=["CustomerProduct", "HierarchyProductLine"],
        default="CustomerProduct",
    )
    parser.add_argument("--backtest", action="store_true")
    return parser.parse_args()


def build_paths(output_dir):
    return {
        "detail": output_dir / "ai-forecast-detail.csv",
        "summary": output_dir / "ai-forecast-summary.csv",
        "top_delta": output_dir / "ai-forecast-top-deltas.csv",
        "backtest": output_dir / "ai-forecast-backtest.csv",
        "quality": output_dir / "ai-forecast-model-quality.csv",
    }


def write_outputs(paths, rows, input_rows, args):
    backtest_rows = build_backtest_rows(
        input_rows,
        args.forecast_year,
        args.start_month,
        args.horizon_months,
        args.grain,
    )
    write_csv(paths["detail"], rows, DETAIL_FIELDNAMES)
    write_csv(paths["summary"], build_summary_rows(rows), SUMMARY_FIELDNAMES)
    write_csv(paths["top_delta"], build_top_delta_rows(rows), DETAIL_FIELDNAMES)
    write_csv(paths["backtest"], backtest_rows, BACKTEST_FIELDNAMES)
    write_csv(paths["quality"], build_quality_rows(backtest_rows), QUALITY_FIELDNAMES)


def summary_payload(paths, rows, args):
    return {
        "schema": "codex.powerbi.aiForecast.v1",
        "rowCount": len(rows),
        "detailPath": str(paths["detail"]),
        "summaryPath": str(paths["summary"]),
        "topDeltaPath": str(paths["top_delta"]),
        "backtestPath": str(paths["backtest"]),
        "modelQualityPath": str(paths["quality"]),
        "forecastYear": args.forecast_year,
        "startMonth": args.start_month,
        "endMonth": args.end_month,
        "asOfDate": args.as_of_date,
        "horizonMonths": args.horizon_months,
        "grain": args.grain,
    }


def main():
    args = parse_args()
    input_rows = load_rows(args.input)
    rows = calculate_forecast(
        input_rows,
        args.forecast_year,
        args.start_month,
        args.end_month,
        args.as_of_date,
        args.horizon_months,
        args.grain,
    )
    paths = build_paths(Path(args.output_directory))
    write_outputs(paths, rows, input_rows, args)
    print(json.dumps(summary_payload(paths, rows, args), indent=2))


if __name__ == "__main__":
    main()
