#!/usr/bin/env python3
"""Tests for the cashback ranking engine.

Run with:  python test_rank_cards.py
Exits non-zero on the first failure, so it works as a pre-commit check.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import rank_cards as engine  # noqa: E402

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

FAILURES: list[str] = []


def check(label: str, actual, expected) -> None:
    if actual != expected:
        FAILURES.append(f"{label}: expected {expected!r}, got {actual!r}")


def check_close(label: str, actual: float, expected: float, tol: float = 0.01) -> None:
    if actual is None or abs(actual - expected) > tol:
        FAILURES.append(f"{label}: expected ~{expected}, got {actual!r}")


def result_for(output: dict, card_id: str) -> dict:
    for row in output["results"]:
        if row.get("card_id") == card_id:
            return row
    raise AssertionError(f"{card_id} missing from results")


# --------------------------------------------------------------------------


def test_data_files_are_valid() -> None:
    merchants = json.loads((DATA_DIR / "merchants.json").read_text(encoding="utf-8"))
    vocabulary = set(merchants["category_vocabulary"])

    for merchant_id, entry in merchants["merchants"].items():
        check(f"{merchant_id} slug is normalized", engine.slug(merchant_id), merchant_id)
        default = entry.get("default_channel")
        if default is not None:
            check(f"{merchant_id} default_channel exists",
                  default in entry.get("variants", {}), True)
        for channel, variant in entry.get("variants", {}).items():
            unknown = set(variant.get("categories", [])) - vocabulary
            check(f"{merchant_id}/{channel} categories are in the vocabulary",
                  unknown, set())
            check(f"{merchant_id}/{channel} has a confidence",
                  variant.get("confidence") in {"high", "medium", "low"}, True)

    for path in sorted(DATA_DIR.glob("cards-*.json")):
        catalog = json.loads(path.read_text(encoding="utf-8"))
        ids = set()
        for card in catalog["cards"]:
            label = f"{path.name}:{card.get('id')}"
            check(f"{label} has a unique id", card["id"] in ids, False)
            ids.add(card["id"])
            for field in ("name", "issuer", "currency", "as_of", "base_rate"):
                check(f"{label} has {field}", field in card, True)
            if card.get("reward_type") == "points":
                check(f"{label} values its points",
                      isinstance(card.get("point_value_cents"), (int, float)), True)
            for rule in card.get("rules", []):
                rlabel = f"{label}/{rule.get('id')}"
                check(f"{rlabel} has a label", bool(rule.get("label")), True)
                check(f"{rlabel} has a confidence",
                      rule.get("confidence") in {"high", "medium", "low"}, True)
                if rule.get("unit") == "points_per_slab":
                    check(f"{rlabel} has a slab", bool(rule.get("slab")), True)
                cap = rule.get("cap")
                if cap:
                    check(f"{rlabel} cap basis is known",
                          cap.get("basis") in {"spend", "reward_cash", "points"}, True)
                    check(f"{rlabel} cap has an amount",
                          isinstance(cap.get("amount"), (int, float)), True)
                # Every rule must actually be reachable by some matcher.
                match = rule.get("match", {})
                check(f"{rlabel} has a matcher",
                      bool(match.get("categories") or match.get("merchants")
                           or match.get("mcc") or match.get("channels")), True)


def test_shell_pump_prefers_gas_card() -> None:
    out = engine.run({
        "today": "2026-05-15",
        "purchase": {"merchant": "Shell", "channel": "pump", "amount": 60,
                     "country": "US"},
        "wallet": ["amex-bcp", "citi-double-cash", "chase-freedom-unlimited"],
    })
    check("shell resolves to gas", out["purchase"]["categories"], ["gas"])
    winner = out["results"][0]
    check("gas winner is the 3% gas card", winner["card_id"], "amex-bcp")
    check_close("amex-bcp on $60 of fuel", winner["net_reward"], 1.80)
    check_close("double cash on $60 of fuel",
                result_for(out, "citi-double-cash")["net_reward"], 1.20)
    check_close("freedom unlimited falls back to base",
                result_for(out, "chase-freedom-unlimited")["net_reward"], 0.90)


def test_ineligible_card_still_earns_its_base_rate() -> None:
    """The original engine zeroed base earning for category-ineligible cards."""
    out = engine.run({
        "today": "2026-05-15",
        "purchase": {"merchant": "Target", "channel": "in_store", "amount": 100,
                     "country": "US"},
        "wallet": ["amex-bcp", "wells-fargo-active-cash"],
    })
    bcp = result_for(out, "amex-bcp")
    check_close("BCP still earns 1% base at Target", bcp["net_reward"], 1.00)
    check("BCP is not treated as blocked", bcp["earning_blocked"], False)
    check("Target beats BCP with a 2% flat card",
          out["results"][0]["card_id"], "wells-fargo-active-cash")


def test_superstore_exclusion_blocks_grocery_bonus() -> None:
    out = engine.run({
        "today": "2026-05-15",
        "purchase": {"merchant": "Walmart", "channel": "in_store", "amount": 200,
                     "country": "US"},
        "wallet": ["amex-bcp", "capital-one-savor"],
    })
    savor = result_for(out, "capital-one-savor")
    check_close("Savor grocery bonus does not apply at Walmart",
                savor["net_reward"], 2.00)
    reasons = " ".join(savor["rules_rejected"])
    check("rejection explains the exclusion", "exclud" in reasons.lower(), True)


def test_neighborhood_market_does_get_the_grocery_bonus() -> None:
    out = engine.run({
        "today": "2026-05-15",
        "purchase": {"merchant": "Walmart", "channel": "neighborhood_market",
                     "amount": 200, "country": "US"},
        "wallet": ["amex-bcp"],
    })
    check_close("BCP earns 6% at Neighborhood Market",
                result_for(out, "amex-bcp")["net_reward"], 12.00)


def test_spend_cap_splits_bonus_and_base() -> None:
    out = engine.run({
        "today": "2026-05-15",
        "purchase": {"merchant": "Kroger", "channel": "in_store", "amount": 500,
                     "country": "US"},
        "wallet": [{"id": "amex-bcp", "cap_used": {"amex-bcp-grocery": 5800}}],
    })
    row = result_for(out, "amex-bcp")
    # 200 at 6% = 12.00, remaining 300 at the 1% base = 3.00
    check_close("cap splits the purchase", row["net_reward"], 15.00)
    check("cap is reported as binding", row["cap_binding"], True)
    check_close("bonus portion is the cap remainder", row["bonus_spend"], 200.0)


def test_reward_cash_cap() -> None:
    out = engine.run({
        "today": "2026-05-15",
        "purchase": {"merchant": "Swiggy", "channel": "delivery", "amount": 4000,
                     "country": "IN"},
        "wallet": [{"id": "hdfc-swiggy", "cap_used_cash": {"hdfc-swiggy-10": 1400}}],
    })
    row = result_for(out, "hdfc-swiggy")
    # 10% of 4000 = 400 but only 100 of the monthly 1500 cap is left.
    check_close("reward cap limits the payout", row["net_reward"], 100.00)
    check("reward cap is binding", row["cap_binding"], True)


def test_points_are_converted_at_their_stated_value() -> None:
    out = engine.run({
        "today": "2026-05-15",
        "purchase": {"merchant": "McDonalds", "channel": "in_store", "amount": 50,
                     "country": "US"},
        "wallet": ["amex-gold", "chase-freedom-unlimited"],
    })
    gold = result_for(out, "amex-gold")
    # 4x on 50 = 200 MR at 1.8c = $3.60
    check_close("Amex Gold dining converts at 1.8c", gold["net_reward"], 3.60)
    check("points valuation is disclosed",
          any("Points valued at" in c for c in gold["caveats"]), True)


def test_card_level_notes_reach_the_answer() -> None:
    """Catalog `notes` carry redemption caveats that change the decision."""
    out = engine.run({
        "today": "2026-05-15",
        "purchase": {"merchant": "McDonalds", "channel": "in_store", "amount": 50,
                     "country": "US"},
        "wallet": ["amex-gold", "costco-anywhere-visa"],
    })
    gold = result_for(out, "amex-gold")
    check("Amex Gold discloses that 1.8c assumes airline transfers",
          any("transferred to airline partners" in c for c in gold["caveats"]), True)
    costco = result_for(out, "costco-anywhere-visa")
    check("Costco discloses the annual certificate",
          any("once a year as a certificate" in c for c in costco["caveats"]), True)


def test_every_catalog_note_is_reachable() -> None:
    """No card should carry a `notes` field the engine silently drops."""
    for path in sorted(DATA_DIR.glob("cards-*.json")):
        catalog = json.loads(path.read_text(encoding="utf-8"))
        for card in catalog["cards"]:
            if not card.get("notes"):
                continue
            out = engine.run({
                "today": "2026-05-15",
                "purchase": {"merchant": "Bob's Corner Shop", "amount": 25,
                             "country": catalog["country"]},
                "wallet": [{"card": card}],
            })
            row = out["results"][0]
            check(f"{card['id']} surfaces its notes",
                  card["notes"] in row["caveats"], True)


def test_slab_earning_floors_the_points() -> None:
    out = engine.run({
        "today": "2026-05-15",
        "purchase": {"merchant": "Best Buy", "channel": "in_store", "amount": 1490,
                     "country": "IN", "currency": "INR"},
        "wallet": [{"card": {
            "id": "slab-test", "name": "Slab Test", "issuer": "Test",
            "currency": "INR", "reward_type": "points", "point_value_cents": 100,
            "base_rate": 5, "base_unit": "points_per_slab", "base_slab": 150,
            "as_of": "2026-05", "rules": [],
        }}],
    })
    # floor(1490/150) = 9 slabs -> 45 points -> Rs 45, NOT 49.67
    check_close("slab earning floors", result_for(out, "slab-test")["net_reward"], 45.0)


def test_indian_fuel_earns_nothing_but_waives_surcharge() -> None:
    out = engine.run({
        "today": "2026-05-15",
        "purchase": {"merchant": "Indian Oil", "channel": "pump", "amount": 2000,
                     "country": "IN", "surcharge_percent": 1},
        "wallet": ["hdfc-millennia", "amex-mrcc"],
    })
    hdfc = result_for(out, "hdfc-millennia")
    check("fuel is flagged as non-earning", hdfc["earning_blocked"], True)
    # 1% of 2000 = 20 surcharge, fully waived (cap 250), so net is 0 not -20.
    check_close("surcharge is waived", hdfc["net_reward"], 0.0)
    amex = result_for(out, "amex-mrcc")
    # Amex has no fuel surcharge waiver in the catalog, so the surcharge bites.
    check_close("no waiver means the surcharge is a real cost",
                amex["net_reward"], -20.0)
    check("card without a waiver ranks below one with it",
          out["results"][0]["card_id"] in {"hdfc-millennia"}, True)


def test_foreign_transaction_fee_can_flip_the_winner() -> None:
    out = engine.run({
        "today": "2026-05-15",
        "purchase": {"merchant": "Amazon", "channel": "online", "amount": 500,
                     "country": "GB", "currency": "GBP"},
        "wallet": [{"card": {
            "id": "us-2pct", "name": "US 2% card", "issuer": "Test",
            "currency": "USD", "reward_type": "cashback", "base_rate": 2,
            "foreign_transaction_fee_percent": 3, "as_of": "2026-05", "rules": [],
        }}, "barclaycard-rewards-uk"],
    })
    us = result_for(out, "us-2pct")
    # 2% of 500 = 10 earned, 3% = 15 fee -> net -5
    check_close("FX fee is charged on the whole purchase", us["net_reward"], -5.0)
    check("no-FX card wins abroad",
          out["results"][0]["card_id"], "barclaycard-rewards-uk")


def test_unactivated_rotating_category_is_not_counted() -> None:
    base = {
        "today": "2026-05-15",
        "purchase": {"merchant": "Kroger", "channel": "in_store", "amount": 100,
                     "country": "US", "categories": ["__rotating__", "grocery"]},
    }
    inactive = engine.run({**base, "wallet": [{"id": "discover-it"}]})
    active = engine.run({**base, "wallet": [{"id": "discover-it", "activated": True}]})
    check_close("unactivated 5% does not count",
                result_for(inactive, "discover-it")["net_reward"], 1.00)
    check_close("activated 5% counts",
                result_for(active, "discover-it")["net_reward"], 5.00)
    check("the reason is reported",
          any("activation" in r for r in
              result_for(inactive, "discover-it")["rules_rejected"]), True)


def test_stacking_offer_is_added_not_compared() -> None:
    out = engine.run({
        "today": "2026-05-15",
        "purchase": {"merchant": "Shell", "channel": "pump", "amount": 100,
                     "country": "US"},
        "wallet": [{"id": "amex-bcp", "offers": [
            {"label": "Amex Offer $10 back on $50", "type": "fixed", "value": 10,
             "min_spend": 50},
        ]}],
    })
    # 3% gas = 3.00 plus the 10.00 offer
    check_close("offer stacks on top of category earning",
                result_for(out, "amex-bcp")["net_reward"], 13.00)


def test_offer_below_minimum_spend_is_refused() -> None:
    out = engine.run({
        "today": "2026-05-15",
        "purchase": {"merchant": "Shell", "channel": "pump", "amount": 20,
                     "country": "US"},
        "wallet": [{"id": "amex-bcp", "offers": [
            {"label": "spend 50 get 10", "type": "fixed", "value": 10, "min_spend": 50},
        ]}],
    })
    row = result_for(out, "amex-bcp")
    check_close("offer is not applied", row["net_reward"], 0.60)
    check("shortfall is explained",
          any("minimum spend" in c for c in row["caveats"]), True)


def test_percent_offer_respects_its_cap() -> None:
    out = engine.run({
        "today": "2026-05-15",
        "purchase": {"merchant": "Target", "channel": "in_store", "amount": 400,
                     "country": "US"},
        "wallet": [{"id": "citi-double-cash", "offers": [
            {"label": "10% back up to $15", "type": "percent", "value": 10, "cap": 15},
        ]}],
    })
    # 2% of 400 = 8.00 plus a 15.00 capped offer (not 40.00)
    check_close("percent offer is capped",
                result_for(out, "citi-double-cash")["net_reward"], 23.00)


def test_network_not_accepted_blocks_the_card() -> None:
    out = engine.run({
        "today": "2026-05-15",
        "purchase": {"merchant": "Costco", "channel": "in_store", "amount": 300,
                     "country": "US", "accepted_networks": ["visa"]},
        "wallet": ["amex-bcp", "costco-anywhere-visa"],
    })
    amex = result_for(out, "amex-bcp")
    check("Amex is blocked at Costco", amex["earning_blocked"], True)
    check_close("blocked card earns nothing", amex["net_reward"], 0.0)
    check("blocked card ranks last", out["results"][-1]["card_id"], "amex-bcp")


def test_stale_catalog_downgrades_confidence() -> None:
    out = engine.run({
        "today": "2027-06-01",
        "purchase": {"merchant": "Shell", "channel": "pump", "amount": 50,
                     "country": "US"},
        "wallet": ["amex-bcp"],
    })
    row = result_for(out, "amex-bcp")
    check("stale data drops confidence to low", row["confidence"], "low")
    check("staleness is surfaced",
          any("last checked" in c for c in row["caveats"]), True)


def test_unknown_card_is_reported_not_guessed() -> None:
    out = engine.run({
        "today": "2026-05-15",
        "purchase": {"merchant": "Shell", "channel": "pump", "amount": 50,
                     "country": "US"},
        "wallet": ["amex-bcp", "some-card-that-does-not-exist"],
    })
    unknown = result_for(out, "some-card-that-does-not-exist")
    check("unknown card is not scored", unknown["net_reward"], None)
    check("unknown card is flagged", unknown["unknown"], True)
    check("a warning is emitted", len(out["warnings"]) >= 1, True)
    check("unknown card sorts last", out["results"][-1]["card_id"],
          "some-card-that-does-not-exist")


def test_unknown_merchant_falls_back_safely() -> None:
    out = engine.run({
        "today": "2026-05-15",
        "purchase": {"merchant": "Bob's Corner Shop", "amount": 40, "country": "US"},
        "wallet": ["amex-bcp", "wells-fargo-active-cash"],
    })
    check("merchant is reported unmatched", out["merchant_resolution"]["matched"], False)
    check("confidence is unknown", out["merchant_resolution"]["confidence"], "unknown")
    check("flat 2% wins with no category",
          out["results"][0]["card_id"], "wells-fargo-active-cash")


def test_missing_channel_warns_when_it_matters() -> None:
    out = engine.run({
        "today": "2026-05-15",
        "purchase": {"merchant": "Shell", "amount": 40, "country": "US"},
        "wallet": ["amex-bcp"],
    })
    caveats = " ".join(out["merchant_resolution"]["caveats"])
    check("multi-channel merchant warns about the channel",
          "codes differently by channel" in caveats, True)


def test_uk_alias_resolves() -> None:
    out = engine.run({
        "today": "2026-05-15",
        "purchase": {"merchant": "Tesco", "channel": "in_store", "amount": 80,
                     "country": "UK"},
        "wallet": ["barclaycard-rewards-uk"],
    })
    check("UK maps to the GB catalog", out["purchase"]["country"], "GB")
    check("currency defaults from the country", out["purchase"]["currency"], "GBP")
    check_close("no spurious FX fee at home",
                result_for(out, "barclaycard-rewards-uk")["net_reward"], 0.20)


def test_near_tie_is_flagged() -> None:
    out = engine.run({
        "today": "2026-05-15",
        "purchase": {"merchant": "Bob's Corner Shop", "amount": 100, "country": "US"},
        "wallet": ["citi-double-cash", "wells-fargo-active-cash"],
    })
    check("tie is flagged as a warning",
          any("tied" in w for w in out["warnings"]), True)


def test_bad_input_is_rejected() -> None:
    cases = [
        ({"purchase": {"merchant": "shell", "amount": -5, "country": "US"},
          "wallet": ["amex-bcp"]}, "negative amount"),
        ({"purchase": {"merchant": "shell", "country": "US"}, "wallet": ["amex-bcp"]},
         "missing amount"),
        ({"purchase": {"merchant": "shell", "amount": 10, "country": "US"},
          "wallet": []}, "empty wallet"),
        ({"wallet": ["amex-bcp"]}, "missing purchase"),
        ({"purchase": {"merchant": "shell", "amount": "lots", "country": "US"},
          "wallet": ["amex-bcp"]}, "non-numeric amount"),
    ]
    for payload, label in cases:
        try:
            engine.run(payload)
        except engine.InputError:
            continue
        FAILURES.append(f"{label}: should have raised InputError")


def test_zero_amount_does_not_divide_by_zero() -> None:
    out = engine.run({
        "today": "2026-05-15",
        "purchase": {"merchant": "Shell", "channel": "pump", "amount": 0,
                     "country": "US"},
        "wallet": ["amex-bcp"],
    })
    check("zero purchase gives a zero rate",
          result_for(out, "amex-bcp")["effective_rate_percent"], 0.0)


def main() -> int:
    tests = [value for name, value in sorted(globals().items())
             if name.startswith("test_") and callable(value)]
    for test in tests:
        try:
            test()
        except Exception as exc:  # noqa: BLE001 - a crash is a failure
            FAILURES.append(f"{test.__name__} raised {type(exc).__name__}: {exc}")

    if FAILURES:
        print(f"FAILED ({len(FAILURES)} of {len(tests)} checks below)")
        for failure in FAILURES:
            print(f"  - {failure}")
        return 1
    print(f"ok - {len(tests)} tests passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
