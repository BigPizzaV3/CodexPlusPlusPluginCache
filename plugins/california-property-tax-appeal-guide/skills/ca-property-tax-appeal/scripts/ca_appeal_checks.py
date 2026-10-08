#!/usr/bin/env python3
"""Deterministic checks for a California residential assessment-appeal evidence file.

Usage:
  python3 ca_appeal_checks.py evidence.json

Required JSON fields:
  state, county, assessment_year, appeal_type, valuation_date,
  current_assessed_value, proposed_value, deadline, deadline_source,
  deadline_source_class, as_of_date, comparables

Optional:
  ad_valorem_rate (decimal, e.g. 0.0112), ad_valorem_rate_source,
  ad_valorem_rate_source_class, fixed_charges, factored_base_year_value,
  filing_fee, payment_service_fee, fee_source, fee_source_class,
  fee_nonrefundable, parcel_count, other_unavoidable_costs,
  card_service_fee_percent, card_service_fee_minimum, payment_method,
  evidence_confidence

Each comparable requires:
  address, sale_date, sale_price, living_area, source_url,
  source_class, arm_length_verified
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date, timedelta
from pathlib import Path
from typing import Any


ALLOWED_APPEAL_TYPES = {
    "decline_in_value",
    "base_year_or_supplemental",
    "escape_assessment",
    "calamity",
}
ALLOWED_SOURCE_CLASSES = {"official", "primary_document", "secondary", "unverified_lead"}


def parse_iso(value: Any, field: str, errors: list[str]) -> date | None:
    if not isinstance(value, str):
        errors.append(f"{field} must be an ISO date string (YYYY-MM-DD).")
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        errors.append(f"{field} is not a valid ISO date: {value!r}.")
        return None


def positive_number(value: Any, field: str, errors: list[str]) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or value <= 0:
        errors.append(f"{field} must be a positive number.")
        return None
    return float(value)


def analyze(payload: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []

    state = str(payload.get("state", "")).strip().upper()
    if state not in {"CA", "CALIFORNIA"}:
        errors.append("state must be CA or California for California checks.")

    county = str(payload.get("county", "")).strip()
    if not county:
        errors.append("county is required.")

    year = payload.get("assessment_year")
    if isinstance(year, bool) or not isinstance(year, int) or not 1900 <= year <= 2200:
        errors.append("assessment_year must be a four-digit integer.")

    appeal_type = payload.get("appeal_type")
    if appeal_type not in ALLOWED_APPEAL_TYPES:
        errors.append(f"appeal_type must be one of {sorted(ALLOWED_APPEAL_TYPES)}.")

    valuation_date = parse_iso(payload.get("valuation_date"), "valuation_date", errors)
    deadline = parse_iso(payload.get("deadline"), "deadline", errors)
    as_of = parse_iso(payload.get("as_of_date"), "as_of_date", errors)
    deadline_source = str(payload.get("deadline_source", "")).strip()
    if not deadline_source.startswith("https://"):
        errors.append("deadline_source must be a direct HTTPS official-source URL.")
    if payload.get("deadline_source_class") != "official":
        errors.append("deadline_source_class must be 'official'.")

    current_value = positive_number(payload.get("current_assessed_value"), "current_assessed_value", errors)
    proposed_value = positive_number(payload.get("proposed_value"), "proposed_value", errors)
    if current_value is not None and proposed_value is not None and proposed_value >= current_value:
        warnings.append("proposed_value is not lower than current_assessed_value; no reduction is indicated.")

    if appeal_type == "decline_in_value" and valuation_date is not None:
        expected = date(valuation_date.year, 1, 1)
        if valuation_date != expected:
            errors.append("A California decline_in_value valuation_date must be January 1 of the appeal year.")
        if isinstance(year, int) and valuation_date.year != year:
            errors.append("For decline_in_value, valuation_date year must equal assessment_year.")
        factored_base = payload.get("factored_base_year_value")
        if factored_base is None:
            warnings.append("factored_base_year_value is missing; Proposition 8 eligibility cannot be fully confirmed.")
        else:
            factored_base_value = positive_number(factored_base, "factored_base_year_value", errors)
            if (
                factored_base_value is not None
                and proposed_value is not None
                and proposed_value >= factored_base_value
            ):
                warnings.append("proposed_value is not below factored_base_year_value; Proposition 8 decline-in-value eligibility is not indicated.")

    latest_sale_date = valuation_date + timedelta(days=90) if valuation_date else None
    admissible_comps: list[dict[str, Any]] = []
    verified_comps: list[dict[str, Any]] = []
    excluded_comps: list[dict[str, str]] = []
    comparables = payload.get("comparables")
    if not isinstance(comparables, list):
        errors.append("comparables must be an array.")
        comparables = []

    for index, comp in enumerate(comparables):
        prefix = f"comparables[{index}]"
        if not isinstance(comp, dict):
            errors.append(f"{prefix} must be an object.")
            continue
        address = str(comp.get("address", "")).strip()
        if not address:
            errors.append(f"{prefix}.address is required.")
        sale_date = parse_iso(comp.get("sale_date"), f"{prefix}.sale_date", errors)
        price = positive_number(comp.get("sale_price"), f"{prefix}.sale_price", errors)
        area = positive_number(comp.get("living_area"), f"{prefix}.living_area", errors)
        source_url = str(comp.get("source_url", "")).strip()
        if not source_url.startswith("https://"):
            errors.append(f"{prefix}.source_url must be a direct HTTPS URL.")
        source_class = comp.get("source_class")
        if source_class not in ALLOWED_SOURCE_CLASSES:
            errors.append(f"{prefix}.source_class must be one of {sorted(ALLOWED_SOURCE_CLASSES)}.")
        if comp.get("arm_length_verified") is not True:
            warnings.append(f"{prefix} is not verified as arm's-length.")

        if sale_date and latest_sale_date and sale_date > latest_sale_date:
            excluded_comps.append({
                "address": address or prefix,
                "reason": f"sale date {sale_date.isoformat()} is more than 90 days after valuation date",
            })
            continue

        if sale_date and price and area and address and source_url.startswith("https://"):
            result_comp = {
                "address": address,
                "sale_date": sale_date.isoformat(),
                "sale_price": price,
                "living_area": area,
                "unadjusted_price_per_sqft": round(price / area, 2),
                "source_class": source_class,
                "verified_for_confidence_count": (
                    source_class in {"official", "primary_document"}
                    and comp.get("arm_length_verified") is True
                ),
            }
            admissible_comps.append(result_comp)
            if result_comp["verified_for_confidence_count"]:
                verified_comps.append(result_comp)

    if len(verified_comps) < 3:
        warnings.append("Fewer than three official/primary, arm's-length-verified, date-admissible comparables remain; evidence confidence is insufficient or weak.")

    tax_impact = None
    cost_benefit = None
    fixed_charges = payload.get("fixed_charges", 0)
    if (
        isinstance(fixed_charges, bool)
        or not isinstance(fixed_charges, (int, float))
        or fixed_charges < 0
    ):
        errors.append("fixed_charges must be a non-negative number when supplied.")
        fixed_charges = None
    rate = payload.get("ad_valorem_rate")
    if rate is not None:
        rate_source = str(payload.get("ad_valorem_rate_source", "")).strip()
        if not rate_source.startswith("https://"):
            errors.append("ad_valorem_rate_source must be a direct HTTPS official-source URL when ad_valorem_rate is supplied.")
        if payload.get("ad_valorem_rate_source_class") != "official":
            errors.append("ad_valorem_rate_source_class must be 'official' when ad_valorem_rate is supplied.")
        if isinstance(rate, bool) or not isinstance(rate, (int, float)) or not 0 < rate < 0.1:
            errors.append("ad_valorem_rate must be a decimal greater than 0 and less than 0.1 (for example 0.0112).")
        elif current_value is not None and proposed_value is not None:
            reduction = max(current_value - proposed_value, 0.0)
            tax_impact = {
                "assessed_value_reduction": round(reduction, 2),
                "ad_valorem_rate": float(rate),
                "estimated_variable_tax_reduction": round(reduction * float(rate), 2),
                "fixed_charges_assumed_unchanged": round(float(fixed_charges), 2) if fixed_charges is not None else None,
                "fixed_charges_included": False,
            }

    filing_fee = payload.get("filing_fee")
    payment_service_fee = payload.get("payment_service_fee", 0)
    parcel_count = payload.get("parcel_count", 1)
    other_costs = payload.get("other_unavoidable_costs", 0)
    if isinstance(parcel_count, bool) or not isinstance(parcel_count, int) or parcel_count < 1:
        errors.append("parcel_count must be a positive integer when supplied.")
    if isinstance(other_costs, bool) or not isinstance(other_costs, (int, float)) or other_costs < 0:
        errors.append("other_unavoidable_costs must be a non-negative number when supplied.")
    if filing_fee is not None:
        if (
            isinstance(filing_fee, bool)
            or not isinstance(filing_fee, (int, float))
            or filing_fee < 0
        ):
            errors.append("filing_fee must be a non-negative number when supplied.")
        if (
            isinstance(payment_service_fee, bool)
            or not isinstance(payment_service_fee, (int, float))
            or payment_service_fee < 0
        ):
            errors.append("payment_service_fee must be a non-negative number when supplied.")
        fee_source = str(payload.get("fee_source", "")).strip()
        if not fee_source.startswith("https://"):
            errors.append("fee_source must be a direct HTTPS official-source URL when filing_fee is supplied.")
        if payload.get("fee_source_class") != "official":
            errors.append("fee_source_class must be 'official' when filing_fee is supplied.")
        if not isinstance(payload.get("fee_nonrefundable"), bool):
            errors.append("fee_nonrefundable must be true or false when filing_fee is supplied.")
        percent = payload.get("card_service_fee_percent")
        minimum = payload.get("card_service_fee_minimum", 0)
        if percent is not None:
            if isinstance(percent, bool) or not isinstance(percent, (int, float)) or percent < 0 or percent >= 100:
                errors.append("card_service_fee_percent must be a percentage from 0 up to 100.")
            elif (
                payload.get("payment_method") == "credit_card"
                and isinstance(filing_fee, (int, float))
                and not isinstance(filing_fee, bool)
                and isinstance(parcel_count, int)
                and not isinstance(parcel_count, bool)
                and parcel_count >= 1
            ):
                if isinstance(minimum, bool) or not isinstance(minimum, (int, float)) or minimum < 0:
                    errors.append("card_service_fee_minimum must be non-negative.")
                else:
                    payment_service_fee = max(float(filing_fee) * int(parcel_count) * float(percent) / 100, float(minimum))
        if (
            tax_impact is not None
            and isinstance(filing_fee, (int, float))
            and not isinstance(filing_fee, bool)
            and filing_fee >= 0
            and isinstance(payment_service_fee, (int, float))
            and not isinstance(payment_service_fee, bool)
            and payment_service_fee >= 0
            and isinstance(parcel_count, int)
            and not isinstance(parcel_count, bool)
            and parcel_count >= 1
            and isinstance(other_costs, (int, float))
            and not isinstance(other_costs, bool)
            and other_costs >= 0
        ):
            total_fees = float(filing_fee) * int(parcel_count) + float(payment_service_fee) + float(other_costs)
            annual_reduction = tax_impact["estimated_variable_tax_reduction"]
            net = annual_reduction - total_fees
            close_threshold = max(25.0, total_fees * 0.10)
            confidence = payload.get("evidence_confidence")
            if confidence in {"weak", "insufficient"}:
                screen = "cannot_determine"
            elif abs(net) <= close_threshold:
                screen = "close_call"
            elif net > 0:
                screen = "financially_favorable"
            else:
                screen = "financially_unfavorable"
            cost_benefit = {
                "estimated_one_year_variable_tax_reduction": annual_reduction,
                "verified_unavoidable_fees": round(total_fees, 2),
                "estimated_first_year_net_before_other_costs": round(net, 2),
                "break_even_assessed_value_reduction": round(total_fees / float(rate), 2),
                "parcel_count": int(parcel_count),
                "payment_service_fee": round(float(payment_service_fee), 2),
                "screen": screen,
                "not_probability_adjusted": True,
                "future_years_not_guaranteed": True,
            }

    if cost_benefit is None:
        missing_cost_inputs = []
        if tax_impact is None:
            missing_cost_inputs.append("supported value reduction and official ad valorem rate")
        if filing_fee is None:
            missing_cost_inputs.append("verified filing fee")
        cost_benefit = {"screen": "cannot_determine", "missing_inputs": missing_cost_inputs}

    deadline_status = None
    if deadline and as_of:
        days = (deadline - as_of).days
        deadline_status = {
            "days_remaining": days,
            "status": "expired" if days < 0 else "due_today" if days == 0 else "open",
        }
        if days < 0:
            warnings.append("The supplied formal filing deadline has passed; do not present the regular appeal as timely.")
        elif days <= 14:
            warnings.append("The supplied formal filing deadline is within 14 days; lead with filing protection.")

    return {
        "valid": not errors,
        "errors": errors,
        "warnings": warnings,
        "latest_admissible_sale_date": latest_sale_date.isoformat() if latest_sale_date else None,
        "admissible_comparables": admissible_comps,
        "verified_comparables": verified_comps,
        "verified_comparable_count": len(verified_comps),
        "excluded_comparables": excluded_comps,
        "deadline_status": deadline_status,
        "tax_impact": tax_impact,
        "cost_benefit": cost_benefit,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("evidence_json", type=Path)
    args = parser.parse_args()
    try:
        payload = json.loads(args.evidence_json.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(json.dumps({"valid": False, "errors": [str(exc)]}, indent=2))
        return 2
    if not isinstance(payload, dict):
        print(json.dumps({"valid": False, "errors": ["Root JSON value must be an object."]}, indent=2))
        return 2
    result = analyze(payload)
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if result["valid"] else 1


if __name__ == "__main__":
    sys.exit(main())
