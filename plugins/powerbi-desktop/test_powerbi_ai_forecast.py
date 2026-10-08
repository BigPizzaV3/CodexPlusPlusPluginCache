import json
import sys
import unittest
from pathlib import Path


PLUGIN_ROOT = Path(__file__).parent
SUPPORT_DIRECTORY = PLUGIN_ROOT / "scripts" / "support"
sys.path.insert(0, str(SUPPORT_DIRECTORY))

from powerbi_ai_forecast import calculate_forecast, conversion_probability  # noqa: E402


FIXTURE_PATH = PLUGIN_ROOT / "examples" / "ai-forecast" / "segment-monthly.json"


class ForecastWorkerTests(unittest.TestCase):
    def setUp(self):
        self.rows = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))["rows"]

    def test_conversion_probability_is_bounded(self):
        self.assertEqual(conversion_probability(0, 200, 0.5), 0.0)
        self.assertEqual(conversion_probability(100, 500, 0.5), 0.95)

    def test_forecast_returns_reconciled_rows(self):
        rows = calculate_forecast(
            self.rows,
            2026,
            5,
            6,
            "2026-05-31",
            2,
            "HierarchyProductLine",
        )
        self.assertGreater(len(rows), 0)
        self.assertTrue(all(row["final_ai_forecast"] >= 0 for row in rows))
        self.assertTrue(
            all(row["forecast_low"] <= row["final_ai_forecast"] for row in rows)
        )
        self.assertTrue(
            all(row["final_ai_forecast"] <= row["forecast_high"] for row in rows)
        )


if __name__ == "__main__":
    unittest.main()
