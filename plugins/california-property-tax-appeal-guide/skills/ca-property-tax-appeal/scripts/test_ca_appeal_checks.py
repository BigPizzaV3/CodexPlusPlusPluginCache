#!/usr/bin/env python3

import unittest

from ca_appeal_checks import analyze


def base_payload():
    return {
        "state": "CA",
        "county": "Los Angeles",
        "assessment_year": 2026,
        "appeal_type": "decline_in_value",
        "valuation_date": "2026-01-01",
        "current_assessed_value": 900000,
        "proposed_value": 800000,
        "factored_base_year_value": 950000,
        "deadline": "2026-11-30",
        "deadline_source": "https://www.boe.ca.gov/proptaxes/pdf/lta26023.pdf",
        "deadline_source_class": "official",
        "as_of_date": "2026-08-30",
        "ad_valorem_rate": 0.0112,
        "ad_valorem_rate_source": "https://auditor.lacounty.gov/tax-rates/",
        "ad_valorem_rate_source_class": "official",
        "fixed_charges": 900,
        "comparables": [
            {
                "address": f"{number} Main St",
                "sale_date": sale_date,
                "sale_price": price,
                "living_area": 1600,
                "source_url": "https://assessor.example.gov/record",
                "source_class": "official",
                "arm_length_verified": True,
            }
            for number, sale_date, price in [
                (1, "2025-12-15", 790000),
                (2, "2026-03-15", 810000),
                (3, "2026-04-01", 805000),
            ]
        ],
    }


class CaliforniaAppealChecksTest(unittest.TestCase):
    def test_valid_decline_in_value_case(self):
        result = analyze(base_payload())
        self.assertTrue(result["valid"])
        self.assertEqual(result["latest_admissible_sale_date"], "2026-04-01")
        self.assertEqual(len(result["admissible_comparables"]), 3)
        self.assertEqual(result["verified_comparable_count"], 3)
        self.assertEqual(result["tax_impact"]["estimated_variable_tax_reduction"], 1120.0)
        self.assertEqual(result["tax_impact"]["fixed_charges_assumed_unchanged"], 900.0)
        self.assertFalse(result["tax_impact"]["fixed_charges_included"])

    def test_ninetieth_day_is_included(self):
        result = analyze(base_payload())
        self.assertTrue(any(c["sale_date"] == "2026-04-01" for c in result["admissible_comparables"]))

    def test_ninety_first_day_is_excluded(self):
        payload = base_payload()
        payload["comparables"][2]["sale_date"] = "2026-04-02"
        result = analyze(payload)
        self.assertEqual(len(result["excluded_comparables"]), 1)
        self.assertEqual(len(result["admissible_comparables"]), 2)

    def test_decline_in_value_requires_january_first(self):
        payload = base_payload()
        payload["valuation_date"] = "2026-01-02"
        result = analyze(payload)
        self.assertFalse(result["valid"])
        self.assertTrue(any("January 1" in error for error in result["errors"]))

    def test_expired_deadline_is_flagged(self):
        payload = base_payload()
        payload["as_of_date"] = "2026-12-01"
        result = analyze(payload)
        self.assertEqual(result["deadline_status"]["status"], "expired")
        self.assertTrue(any("has passed" in warning for warning in result["warnings"]))

    def test_percent_instead_of_decimal_is_rejected(self):
        payload = base_payload()
        payload["ad_valorem_rate"] = 1.12
        result = analyze(payload)
        self.assertFalse(result["valid"])
        self.assertTrue(any("ad_valorem_rate" in error for error in result["errors"]))

    def test_secondary_source_is_candidate_not_verified_comparable(self):
        payload = base_payload()
        payload["comparables"][0]["source_class"] = "secondary"
        result = analyze(payload)
        self.assertTrue(result["valid"])
        self.assertEqual(len(result["admissible_comparables"]), 3)
        self.assertEqual(result["verified_comparable_count"], 2)
        self.assertTrue(any("Fewer than three" in warning for warning in result["warnings"]))

    def test_rate_requires_official_source_label(self):
        payload = base_payload()
        del payload["ad_valorem_rate_source_class"]
        result = analyze(payload)
        self.assertFalse(result["valid"])
        self.assertTrue(any("ad_valorem_rate_source_class" in error for error in result["errors"]))

    def test_missing_factored_base_year_value_limits_prop_8_conclusion(self):
        payload = base_payload()
        del payload["factored_base_year_value"]
        result = analyze(payload)
        self.assertTrue(result["valid"])
        self.assertTrue(any("eligibility cannot be fully confirmed" in warning for warning in result["warnings"]))

    def test_fixed_charges_are_not_counted_as_savings(self):
        result = analyze(base_payload())
        self.assertEqual(result["tax_impact"]["estimated_variable_tax_reduction"], 1120.0)
        self.assertEqual(result["tax_impact"]["fixed_charges_assumed_unchanged"], 900.0)
        self.assertFalse(result["tax_impact"]["fixed_charges_included"])

    def test_verified_fee_produces_cost_benefit_screen(self):
        payload = base_payload()
        payload.update(
            {
                "filing_fee": 290,
                "payment_service_fee": 0,
                "fee_source": "https://cob.santaclaracounty.gov/appeal-your-property-taxes",
                "fee_source_class": "official",
                "fee_nonrefundable": True,
            }
        )
        result = analyze(payload)
        self.assertTrue(result["valid"])
        self.assertEqual(830.0, result["cost_benefit"]["estimated_first_year_net_before_other_costs"])
        self.assertEqual(25892.86, result["cost_benefit"]["break_even_assessed_value_reduction"])
        self.assertEqual("financially_favorable", result["cost_benefit"]["screen"])

    def test_fee_requires_official_source_and_refundability(self):
        payload = base_payload()
        payload["filing_fee"] = 290
        result = analyze(payload)
        self.assertFalse(result["valid"])
        self.assertTrue(any("fee_source" in error for error in result["errors"]))
        self.assertTrue(any("fee_nonrefundable" in error for error in result["errors"]))

    def test_missing_fee_returns_cannot_determine(self):
        result = analyze(base_payload())
        self.assertEqual("cannot_determine", result["cost_benefit"]["screen"])
        self.assertIn("verified filing fee", result["cost_benefit"]["missing_inputs"])

    def test_close_call_and_low_confidence_are_not_overstated(self):
        payload = base_payload()
        payload["proposed_value"] = 873214.29
        payload.update({
            "filing_fee": 290,
            "fee_source": "https://county.example.gov/appeals",
            "fee_source_class": "official",
            "fee_nonrefundable": True,
            "evidence_confidence": "moderate",
        })
        self.assertEqual("close_call", analyze(payload)["cost_benefit"]["screen"])
        payload["evidence_confidence"] = "weak"
        self.assertEqual("cannot_determine", analyze(payload)["cost_benefit"]["screen"])

    def test_multiple_parcels_and_card_fee_are_included(self):
        payload = base_payload()
        payload.update({
            "filing_fee": 290,
            "parcel_count": 2,
            "payment_method": "credit_card",
            "card_service_fee_percent": 2.22,
            "card_service_fee_minimum": 1.49,
            "fee_source": "https://cob.santaclaracounty.gov/appeal-your-property-taxes",
            "fee_source_class": "official",
            "fee_nonrefundable": True,
        })
        result = analyze(payload)
        self.assertEqual(12.88, result["cost_benefit"]["payment_service_fee"])
        self.assertEqual(592.88, result["cost_benefit"]["verified_unavoidable_fees"])


if __name__ == "__main__":
    unittest.main()
