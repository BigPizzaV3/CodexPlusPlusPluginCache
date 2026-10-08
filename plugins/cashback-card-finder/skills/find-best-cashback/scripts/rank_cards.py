#!/usr/bin/env python3
"""Rank cashback / rewards cards for one specific purchase.

The engine is deliberately explicit: every number in the output can be traced
to a rule in the card catalog plus a merchant resolution. It never invents a
rate. If the catalog has no entry, the card is reported as `unknown` rather
than silently earning the base rate.

Typical use:

    rank_cards.py --merchant shell --channel pump --amount 60 \
        --country US --cards amex-bcp,citi-custom-cash,chase-freedom-unlimited

    rank_cards.py request.json
    rank_cards.py --explain-merchant walmart --country US
    rank_cards.py --list-cards IN
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
STALE_AFTER_DAYS = 120

CONFIDENCE_ORDER = {"high": 3, "medium": 2, "low": 1, "unknown": 0}

# Users say "UK" and "USA"; the catalogs are keyed on ISO codes.
COUNTRY_ALIASES = {
    "UK": "GB", "ENGLAND": "GB", "SCOTLAND": "GB", "WALES": "GB",
    "USA": "US", "U.S.": "US", "U.S.A.": "US", "AMERICA": "US",
    "INDIA": "IN", "BHARAT": "IN", "CANADA": "CA",
}

DEFAULT_CURRENCY = {"US": "USD", "IN": "INR", "GB": "GBP", "CA": "CAD"}


def normalize_country(value: str) -> str:
    code = str(value or "US").strip().upper()
    return COUNTRY_ALIASES.get(code, code)


# --------------------------------------------------------------------------
# small helpers
# --------------------------------------------------------------------------


class InputError(ValueError):
    """Raised for anything wrong with caller-supplied JSON."""


def num(value: Any, field: str, *, default: float | None = None) -> float:
    if value is None:
        if default is None:
            raise InputError(f"{field} is required")
        return float(default)
    if isinstance(value, bool):
        raise InputError(f"{field} must be a number, not a boolean")
    try:
        result = float(value)
    except (TypeError, ValueError) as exc:
        raise InputError(f"{field} must be a number") from exc
    if not math.isfinite(result):
        raise InputError(f"{field} must be a finite number")
    if result < 0:
        raise InputError(f"{field} cannot be negative")
    return result


def slug(value: str) -> str:
    return "".join(ch if ch.isalnum() else "-" for ch in value.strip().lower()).strip("-")


def as_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [str(item) for item in value]
    raise InputError(f"expected a string or list, got {type(value).__name__}")


def parse_day(value: str | None, field: str) -> date | None:
    if not value:
        return None
    text = str(value)
    for fmt in ("%Y-%m-%d", "%Y-%m", "%Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    raise InputError(f"{field} must look like YYYY-MM-DD, YYYY-MM or YYYY")


# --------------------------------------------------------------------------
# catalog loading
# --------------------------------------------------------------------------


def load_json(path: Path) -> dict:
    if not path.exists():
        raise InputError(f"missing data file: {path.name}")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise InputError(f"{path.name} is not valid JSON: {exc}") from exc


def load_cards(country: str) -> dict:
    code = normalize_country(country)
    path = DATA_DIR / f"cards-{code.lower()}.json"
    if not path.exists():
        available = sorted(
            p.stem.split("-", 1)[1].upper() for p in DATA_DIR.glob("cards-*.json")
        )
        raise InputError(
            f"no bundled catalog for country {code!r}; available: {', '.join(available)}. "
            "Pass full card definitions inline instead."
        )
    return load_json(path)


def load_merchants() -> dict:
    return load_json(DATA_DIR / "merchants.json")


# --------------------------------------------------------------------------
# merchant resolution
# --------------------------------------------------------------------------


def resolve_merchant(name: str, channel: str | None, country: str,
                     catalog: dict) -> dict:
    """Map a store name + purchase channel onto spend categories and MCCs.

    Returns a resolution dict even when the merchant is unknown, so the caller
    always gets an auditable record of what was assumed.
    """
    wanted = slug(name)
    merchants = catalog.get("merchants", {})

    entry = merchants.get(wanted)
    if entry is None:
        for key, candidate in merchants.items():
            aliases = {slug(a) for a in candidate.get("aliases", [])}
            aliases.add(key)
            if wanted in aliases:
                entry = candidate
                wanted = key
                break

    if entry is None:
        return {
            "merchant": name,
            "merchant_id": None,
            "matched": False,
            "channel": channel or "unspecified",
            "categories": [],
            "mcc": [],
            "confidence": "unknown",
            "caveats": [
                f"{name!r} is not in the bundled merchant table. Resolve its category "
                "from live research or ask the user how the purchase is likely to code."
            ],
        }

    countries = [normalize_country(c) for c in entry.get("countries", [])]
    code = normalize_country(country)
    caveats: list[str] = []
    if countries and code not in countries:
        caveats.append(
            f"Bundled coding notes for {entry.get('display_name', name)} were written for "
            f"{', '.join(countries)}; behaviour in {code} may differ."
        )

    variants = entry.get("variants", {})
    default_key = entry.get("default_channel")
    chosen_key = channel or default_key
    variant = variants.get(chosen_key) if chosen_key else None

    if variant is None:
        variant = variants.get(default_key, {}) if default_key else {}
        if channel:
            caveats.append(
                f"Channel {channel!r} is not modelled for this merchant; used "
                f"{default_key!r} instead."
            )
        chosen_key = default_key

    if not channel and len(variants) > 1:
        caveats.append(
            "Channel was not specified and this merchant codes differently by channel "
            f"({', '.join(sorted(variants))}); assumed {chosen_key!r}. Confirm with "
            "the user before treating the answer as settled."
        )

    caveats.extend(variant.get("caveats", []))
    caveats.extend(entry.get("caveats", []))

    # A store format that issuers treat as a separate merchant (Walmart
    # Neighborhood Market, a supermarket's fuel forecourt) gets its own id so
    # that a by-name exclusion on the parent brand does not wrongly catch it.
    resolved_id = variant.get("merchant_id", wanted)

    return {
        "merchant": variant.get("display_name", entry.get("display_name", name)),
        "merchant_id": resolved_id,
        "matched": True,
        "channel": chosen_key or "unspecified",
        "categories": list(variant.get("categories", [])),
        "mcc": list(variant.get("mcc", [])),
        "confidence": variant.get("confidence", "low"),
        "caveats": caveats,
        "source": entry.get("source"),
    }


# --------------------------------------------------------------------------
# rule matching
# --------------------------------------------------------------------------


def rule_matches(rule: dict, ctx: dict) -> tuple[bool, str | None]:
    """Does this earning rule apply to the purchase? Returns (ok, reason_if_not)."""
    # Exclusions are checked first: "Walmart is excluded from the grocery
    # category" is a far more useful explanation than "category did not match",
    # and it is the reason users most often get a surprising answer.
    excludes = rule.get("excludes", {})
    bad_categories = set(as_list(excludes.get("categories"))) & set(ctx["categories"])
    if bad_categories:
        return False, f"excluded category: {', '.join(sorted(bad_categories))}"
    if ctx["merchant_id"] and ctx["merchant_id"] in set(as_list(excludes.get("merchants"))):
        return False, f"{ctx['merchant']} is explicitly excluded by this rule"
    bad_mcc = set(as_list(excludes.get("mcc"))) & set(ctx["mcc"])
    if bad_mcc:
        return False, f"excluded MCC: {', '.join(sorted(bad_mcc))}"

    match = rule.get("match", {})

    want_categories = set(as_list(match.get("categories")))
    want_merchants = set(as_list(match.get("merchants")))
    if want_categories or want_merchants:
        by_category = bool(want_categories & set(ctx["categories"]))
        by_merchant = bool(want_merchants) and ctx["merchant_id"] in want_merchants
        if not (by_category or by_merchant):
            if want_merchants and not want_categories:
                return False, "merchant not in the rule's merchant list"
            return False, "category does not match"

    want_mcc = set(as_list(match.get("mcc")))
    if want_mcc and not want_mcc & set(ctx["mcc"]):
        return False, "MCC not in the rule's MCC list"

    want_channels = set(as_list(match.get("channels")))
    if want_channels and ctx["channel"] not in want_channels:
        return False, f"rule applies only to channel(s) {', '.join(sorted(want_channels))}"

    return True, None


def earn_cash(rule: dict, spend: float, card: dict) -> tuple[float, float, str]:
    """Convert spend under one rule into cash value.

    Returns (cash, raw_points, human readable rate label).
    """
    unit = rule.get("unit", "percent")
    point_value = num(
        rule.get("point_value_cents", card.get("point_value_cents", 1.0)),
        "point_value_cents",
        default=1.0,
    )

    if unit == "percent":
        rate = num(rule.get("rate"), "rate")
        return spend * rate / 100.0, 0.0, f"{rate:g}%"

    if unit == "points_per_unit":
        rate = num(rule.get("rate"), "rate")
        points = spend * rate
        return points * point_value / 100.0, points, f"{rate:g}x points"

    if unit == "points_per_slab":
        rate = num(rule.get("rate"), "rate")
        slab = num(rule.get("slab"), "slab")
        if slab <= 0:
            raise InputError("slab must be greater than zero")
        points = math.floor(spend / slab) * rate
        return points * point_value / 100.0, points, f"{rate:g} pts / {slab:g} spent"

    raise InputError(f"unknown rule unit {unit!r}")


def cap_limited_spend(rule: dict, spend: float,
                      used: float) -> tuple[float, bool, str | None]:
    """Apply a cap to the spend eligible for a bonus rule.

    Only spend-basis caps can be resolved here; reward-basis caps are applied
    after the reward is computed.
    """
    cap = rule.get("cap")
    if not cap:
        return spend, False, None

    basis = cap.get("basis", "spend")
    amount = num(cap.get("amount"), "cap.amount")
    period = cap.get("period", "year")

    if basis != "spend":
        return spend, False, None

    remaining = max(amount - used, 0.0)
    if spend <= remaining:
        return spend, False, None
    note = (
        f"Bonus rate is capped at {amount:g} spend per {period}"
        + (f"; {used:g} already used" if used else "")
        + f", so only {remaining:g} of this purchase earns the bonus rate."
    )
    return remaining, True, note


def apply_reward_cap(rule: dict, cash: float, points: float, used_cash: float,
                     used_points: float) -> tuple[float, bool, str | None]:
    cap = rule.get("cap")
    if not cap:
        return cash, False, None
    basis = cap.get("basis", "spend")
    if basis not in {"reward_cash", "points"}:
        return cash, False, None

    amount = num(cap.get("amount"), "cap.amount")
    period = cap.get("period", "year")

    if basis == "reward_cash":
        remaining = max(amount - used_cash, 0.0)
        if cash <= remaining:
            return cash, False, None
        return remaining, True, (
            f"Reward is capped at {amount:g} cash back per {period}; this purchase "
            f"only earns {remaining:.2f} at the bonus rate."
        )

    remaining_points = max(amount - used_points, 0.0)
    if points <= remaining_points or points <= 0:
        return cash, False, None
    scaled = cash * (remaining_points / points)
    return scaled, True, (
        f"Reward is capped at {amount:g} points per {period}; this purchase is limited "
        f"to {remaining_points:g} points."
    )


# --------------------------------------------------------------------------
# per-card evaluation
# --------------------------------------------------------------------------


def evaluate_card(card: dict, state: dict, ctx: dict) -> dict:
    name = card.get("name") or card.get("id") or "unnamed card"
    amount = ctx["amount"]
    caveats: list[str] = []
    confidence = ctx["confidence"]

    # A card can be blocked at the merchant entirely (network not accepted,
    # or the issuer earns nothing on this category at all).
    no_earn = set(as_list(card.get("no_earn_categories")))
    blocked_by = no_earn & set(ctx["categories"])
    network_ok = True
    if ctx["accepted_networks"] and card.get("network"):
        network_ok = card["network"] in ctx["accepted_networks"]

    base_rule = {
        "id": "base",
        "label": card.get("base_label", "base rate"),
        "unit": card.get("base_unit", "percent"),
        "rate": card.get("base_rate", 0),
        "slab": card.get("base_slab"),
    }

    candidates: list[dict] = []
    rejections: list[str] = []

    for rule in card.get("rules", []):
        ok, why = rule_matches(rule, ctx)
        if not ok:
            rejections.append(f"{rule.get('label', rule.get('id', 'rule'))}: {why}")
            continue

        needs_activation = bool(rule.get("activation_required"))
        activated = bool(state.get("activated", False))
        if needs_activation and not activated:
            rejections.append(
                f"{rule.get('label', 'bonus rule')}: requires activation and the user "
                "has not confirmed it is activated"
            )
            continue

        candidates.append(rule)

    # Pick the single best-paying applicable bonus rule. Real issuers pay one
    # category rate per transaction; they do not stack.
    chosen = None
    best_cash = -1.0
    for rule in candidates:
        preview_cash, _, _ = earn_cash(rule, amount, card)
        if preview_cash > best_cash:
            best_cash, chosen = preview_cash, rule

    bonus_cash = bonus_points = 0.0
    bonus_spend = 0.0
    cap_binding = False
    rate_label = None

    if blocked_by or not network_ok:
        base_cash = base_points = 0.0
        base_spend = 0.0
        if blocked_by:
            caveats.append(
                f"This card earns nothing on {', '.join(sorted(blocked_by))} purchases."
            )
        if not network_ok:
            caveats.append(
                f"{ctx['merchant']} does not accept {card.get('network', 'this network')}."
            )
        rate_label = "not earning"
    else:
        if chosen is not None:
            cap_key = chosen.get("cap", {}).get("shared_key", chosen.get("id", "bonus"))
            used_spend = num(state.get("cap_used", {}).get(cap_key, 0), "cap_used",
                             default=0)
            used_cash = num(state.get("cap_used_cash", {}).get(cap_key, 0),
                            "cap_used_cash", default=0)
            used_points = num(state.get("cap_used_points", {}).get(cap_key, 0),
                              "cap_used_points", default=0)

            bonus_spend, capped, cap_note = cap_limited_spend(
                chosen, amount, used_spend
            )
            bonus_cash, bonus_points, rate_label = earn_cash(chosen, bonus_spend, card)
            bonus_cash, reward_capped, reward_note = apply_reward_cap(
                chosen, bonus_cash, bonus_points, used_cash, used_points
            )
            cap_binding = capped or reward_capped
            for note in (cap_note, reward_note):
                if note:
                    caveats.append(note)
            if chosen.get("note"):
                caveats.append(chosen["note"])
            if chosen.get("confidence"):
                confidence = min(
                    confidence, chosen["confidence"], key=lambda c: CONFIDENCE_ORDER[c]
                )
        else:
            rate_label = None

        base_spend = amount - bonus_spend
        base_cash, base_points, base_label = earn_cash(base_rule, base_spend, card)
        if rate_label is None:
            rate_label = base_label

    # Runtime offers (Amex Offers, Chase Offers, issuer statement credits) do
    # stack on top of category earning, so they are added, not compared.
    offers_cash = 0.0
    for offer in state.get("offers", []):
        label = offer.get("label", "issuer offer")
        min_spend = num(offer.get("min_spend", 0), f"{label}.min_spend", default=0)
        if amount < min_spend:
            caveats.append(
                f"Offer {label!r} needs {min_spend:g} minimum spend; this purchase "
                "does not qualify."
            )
            continue
        value = num(offer.get("value", 0), f"{label}.value", default=0)
        if offer.get("type") == "percent":
            value = amount * value / 100.0
            cap = offer.get("cap")
            if cap is not None:
                value = min(value, num(cap, f"{label}.cap"))
        offers_cash += value
        caveats.append(f"Includes {label}: {value:.2f} credit.")

    # Fees
    fees_cash = 0.0
    if ctx["currency"] != card.get("currency", ctx["currency"]):
        fx = num(card.get("foreign_transaction_fee_percent", 0),
                 "foreign_transaction_fee_percent", default=0)
        if fx:
            fee = amount * fx / 100.0
            fees_cash += fee
            caveats.append(
                f"{fx:g}% foreign transaction fee applies ({fee:.2f}) because the "
                f"purchase is in {ctx['currency']}."
            )

    surcharge_percent = num(ctx.get("surcharge_percent", 0), "surcharge_percent",
                            default=0)
    if surcharge_percent:
        gross_surcharge = amount * surcharge_percent / 100.0
        waiver = card.get("surcharge_waiver")
        waived = 0.0
        if waiver and set(as_list(waiver.get("categories"))) & set(ctx["categories"]):
            within_range = True
            lo = waiver.get("min_txn")
            hi = waiver.get("max_txn")
            if lo is not None and amount < num(lo, "surcharge_waiver.min_txn"):
                within_range = False
            if hi is not None and amount > num(hi, "surcharge_waiver.max_txn"):
                within_range = False
            if within_range:
                waived = min(gross_surcharge,
                             num(waiver.get("cap_per_cycle", gross_surcharge),
                                 "surcharge_waiver.cap_per_cycle"))
            else:
                caveats.append(
                    "Surcharge waiver has a transaction size limit that this purchase "
                    "falls outside of."
                )
        net_surcharge = max(gross_surcharge - waived, 0.0)
        fees_cash += net_surcharge
        if waived:
            caveats.append(
                f"{surcharge_percent:g}% surcharge of {gross_surcharge:.2f} is waived "
                f"by {waived:.2f}."
            )
        elif net_surcharge:
            caveats.append(
                f"{surcharge_percent:g}% surcharge of {net_surcharge:.2f} is not waived "
                "on this card."
            )

    gross = bonus_cash + base_cash
    net = gross + offers_cash - fees_cash

    if card.get("reward_type") == "points":
        pv = card.get("point_value_cents")
        caveats.append(
            f"Points valued at {pv:g} cents each; the real value depends on how the "
            "user redeems."
        )

    minimum = card.get("minimum_redemption")
    if minimum and net < num(minimum, "minimum_redemption"):
        caveats.append(
            f"Rewards are only redeemable in blocks of {minimum:g}; a single purchase "
            "may not be redeemable on its own."
        )

    # Card-level context: how the rewards actually redeem, acceptance limits,
    # what the headline multiplier hides. This is often the most decision-
    # changing thing in the catalog, so it has to reach the user.
    if card.get("notes"):
        caveats.append(card["notes"])

    as_of = card.get("as_of")
    stale_days = None
    if as_of and ctx["today"]:
        parsed = parse_day(as_of, f"{name}.as_of")
        if parsed:
            stale_days = (ctx["today"] - parsed).days
            if stale_days > STALE_AFTER_DAYS:
                confidence = "low"
                caveats.append(
                    f"Catalog terms for this card were last checked {as_of} "
                    f"({stale_days} days ago). Verify before relying on this number."
                )

    return {
        "card_id": card.get("id"),
        "name": name,
        "issuer": card.get("issuer"),
        "network": card.get("network"),
        "currency": card.get("currency", ctx["currency"]),
        "applied_rule": (chosen or base_rule).get("label", "base rate")
        if not (blocked_by or not network_ok) else "none",
        "rate_label": rate_label,
        "bonus_spend": round(bonus_spend, 2),
        "base_spend": round(max(amount - bonus_spend, 0.0) if not (blocked_by or not network_ok) else 0.0, 2),
        "gross_reward": round(gross, 2),
        "offers": round(offers_cash, 2),
        "fees": round(fees_cash, 2),
        "net_reward": round(net, 2),
        "effective_rate_percent": round(net / amount * 100, 3) if amount else 0.0,
        "cap_binding": cap_binding,
        "earning_blocked": bool(blocked_by) or not network_ok,
        "confidence": confidence,
        "caveats": caveats,
        "rules_rejected": rejections,
        "annual_fee": card.get("annual_fee"),
        "data_as_of": as_of,
        "source": card.get("source"),
    }


# --------------------------------------------------------------------------
# top level
# --------------------------------------------------------------------------


def build_context(purchase: dict, resolution: dict, today: date | None) -> dict:
    categories = as_list(purchase.get("categories")) or resolution["categories"]
    mcc = as_list(purchase.get("mcc")) or resolution["mcc"]
    country = normalize_country(purchase.get("country", "US"))
    return {
        "amount": num(purchase.get("amount"), "purchase.amount"),
        "currency": str(purchase.get("currency") or
                        DEFAULT_CURRENCY.get(country, "USD")).upper(),
        "country": country,
        "merchant": resolution["merchant"],
        "merchant_id": resolution["merchant_id"],
        "channel": resolution["channel"],
        "categories": categories,
        "mcc": mcc,
        "confidence": resolution["confidence"],
        "accepted_networks": as_list(purchase.get("accepted_networks")),
        "surcharge_percent": purchase.get("surcharge_percent", 0),
        "today": today,
    }


def sort_key(result: dict) -> tuple:
    return (
        0 if result["earning_blocked"] else 1,
        round(result["net_reward"], 2),
        CONFIDENCE_ORDER.get(result["confidence"], 0),
        0 if result["cap_binding"] else 1,
        -len(result["caveats"]),
    )


def run(request: dict) -> dict:
    purchase = request.get("purchase")
    if not isinstance(purchase, dict):
        raise InputError("request.purchase must be an object")

    country = normalize_country(purchase.get("country", "US"))
    today = parse_day(request.get("today"), "today") or date.today()

    merchant_catalog = load_merchants()
    resolution = resolve_merchant(
        str(purchase.get("merchant", "")), purchase.get("channel"), country,
        merchant_catalog,
    )
    ctx = build_context(purchase, resolution, today)
    if not ctx["categories"]:
        resolution["caveats"].append(
            "No spend category could be determined, so every card falls back to its "
            "base rate. Determine the category before presenting a winner."
        )

    wallet = request.get("wallet")
    if not isinstance(wallet, list) or not wallet:
        raise InputError("request.wallet must be a non-empty list")

    catalog: dict = {}
    catalog_meta: dict = {}
    try:
        catalog_file = load_cards(country)
        catalog_meta = {
            "country": catalog_file.get("country"),
            "as_of": catalog_file.get("as_of"),
            "currency": catalog_file.get("currency"),
        }
        catalog = {card["id"]: card for card in catalog_file.get("cards", [])}
    except InputError as exc:
        catalog_meta = {"error": str(exc)}

    warnings: list[str] = []
    results: list[dict] = []
    seen: set[str] = set()

    for index, held in enumerate(wallet):
        if isinstance(held, str):
            held = {"id": held}
        if not isinstance(held, dict):
            raise InputError(f"wallet[{index}] must be a string id or an object")

        card = held.get("card")
        if card is None:
            card_id = held.get("id")
            if not card_id:
                raise InputError(f"wallet[{index}] needs an 'id' or an inline 'card'")
            card = catalog.get(card_id)
            if card is None:
                warnings.append(
                    f"Card id {card_id!r} is not in the {country} catalog. Research its "
                    "current terms and pass them inline, or ask the user for the rate."
                )
                results.append({
                    "card_id": card_id,
                    "name": held.get("name", card_id),
                    "net_reward": None,
                    "confidence": "unknown",
                    "earning_blocked": False,
                    "cap_binding": False,
                    "caveats": ["Terms unknown - not scored."],
                    "unknown": True,
                })
                continue

        if card.get("id") in seen:
            warnings.append(f"Duplicate card {card.get('id')!r} in wallet; scored once.")
            continue
        seen.add(card.get("id"))

        results.append(evaluate_card(card, held, ctx))

    scored = [r for r in results if not r.get("unknown")]
    unknown = [r for r in results if r.get("unknown")]
    scored.sort(key=sort_key, reverse=True)

    if len(scored) >= 2:
        top, second = scored[0], scored[1]
        if abs(top["net_reward"] - second["net_reward"]) < 0.01:
            warnings.append(
                f"{top['name']} and {second['name']} are effectively tied. Break the tie "
                "on redemption friction or merchant-coding confidence, not on the number."
            )

    return {
        "purchase": {
            "merchant": ctx["merchant"],
            "channel": ctx["channel"],
            "amount": ctx["amount"],
            "currency": ctx["currency"],
            "country": ctx["country"],
            "categories": ctx["categories"],
            "mcc": ctx["mcc"],
        },
        "merchant_resolution": resolution,
        "catalog": catalog_meta,
        "evaluated_on": today.isoformat(),
        "results": scored + unknown,
        "warnings": warnings,
    }


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Request JSON schema:

{
  "today": "2026-07-25",
  "purchase": {
    "merchant": "shell",           # store name or id from merchants.json
    "channel": "pump",             # pump | convenience_store | in_store | online | app | delivery
    "amount": 60,
    "currency": "USD",
    "country": "US",
    "categories": ["gas"],         # optional override of merchant resolution
    "mcc": ["5541"],               # optional, if the user knows the code
    "surcharge_percent": 0,        # e.g. 1 for an Indian fuel surcharge
    "accepted_networks": []        # e.g. ["visa","mastercard"] where Amex is refused
  },
  "wallet": [
    "amex-bcp",
    {"id": "chase-freedom-flex", "activated": true,
     "cap_used": {"rotating-5": 1200},
     "offers": [{"label": "Chase Offer 10%", "type": "percent", "value": 10, "cap": 15}]},
    {"card": { ...full inline card definition... }}
  ]
}
""",
    )
    parser.add_argument("input", nargs="?", type=Path,
                        help="path to a request JSON file, or - for stdin")
    parser.add_argument("--merchant")
    parser.add_argument("--channel")
    parser.add_argument("--amount", type=float)
    parser.add_argument("--currency")
    parser.add_argument("--country", default="US")
    parser.add_argument("--cards", help="comma separated card ids from the catalog")
    parser.add_argument("--today", help="override today's date, YYYY-MM-DD")
    parser.add_argument("--list-cards", metavar="COUNTRY",
                        help="print the card ids available for a country")
    parser.add_argument("--explain-merchant", metavar="NAME",
                        help="print how a merchant is expected to code")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    try:
        if args.list_cards:
            data = load_cards(args.list_cards)
            print(json.dumps({
                "country": data.get("country"),
                "as_of": data.get("as_of"),
                "cards": [
                    {"id": c["id"], "name": c["name"], "issuer": c.get("issuer"),
                     "annual_fee": c.get("annual_fee")}
                    for c in data.get("cards", [])
                ],
            }, indent=2))
            return 0

        if args.explain_merchant:
            catalog = load_merchants()
            entry = catalog.get("merchants", {}).get(slug(args.explain_merchant))
            if entry is None:
                out = resolve_merchant(args.explain_merchant, args.channel,
                                       args.country, catalog)
            else:
                out = {"merchant_id": slug(args.explain_merchant), **entry}
            print(json.dumps(out, indent=2))
            return 0

        if args.input:
            raw = sys.stdin.read() if str(args.input) == "-" else \
                args.input.read_text(encoding="utf-8")
            request = json.loads(raw)
        elif args.merchant and args.amount is not None and args.cards:
            request = {
                "today": args.today,
                "purchase": {
                    "merchant": args.merchant,
                    "channel": args.channel,
                    "amount": args.amount,
                    "currency": args.currency or
                    DEFAULT_CURRENCY.get(normalize_country(args.country), "USD"),
                    "country": args.country,
                },
                "wallet": [c.strip() for c in args.cards.split(",") if c.strip()],
            }
        else:
            build_parser().print_help()
            return 2

        print(json.dumps(run(request), indent=2))
    except InputError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    except json.JSONDecodeError as exc:
        print(f"error: invalid JSON input: {exc}", file=sys.stderr)
        return 2
    except OSError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
