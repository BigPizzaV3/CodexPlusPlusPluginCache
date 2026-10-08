#!/usr/bin/env python3
import argparse
import datetime as dt
import hashlib
import json
import os
import re
import tempfile
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

CORE_NUTRIENTS = ("calories", "protein_g", "protein_credit_g", "carbohydrates_g", "fat_g", "fiber_g")
DEFAULT_NUTRIENTS = CORE_NUTRIENTS + (
    "total_sugars_g", "added_sugars_g", "saturated_fat_g", "trans_fat_g",
    "cholesterol_mg", "sodium_mg", "potassium_mg", "calcium_mg", "iron_mg",
    "magnesium_mg", "phosphorus_mg", "zinc_mg", "copper_mg", "manganese_mg",
    "selenium_mcg", "vitamin_a_mcg_rae", "vitamin_c_mg", "vitamin_d_mcg",
    "vitamin_e_mg", "vitamin_k_mcg", "thiamin_mg", "riboflavin_mg", "niacin_mg",
    "pantothenic_acid_mg", "vitamin_b6_mg", "biotin_mcg", "folate_mcg_dfe",
    "folic_acid_mcg", "vitamin_b12_mcg", "choline_mg", "iodine_mcg",
    "chromium_mcg", "molybdenum_mcg", "monounsaturated_fat_g",
    "polyunsaturated_fat_g", "water_g", "water_oz",
)
MEAL_ORDER = ("Breakfast", "Lunch", "Dinner", "Snacks", "Drinks", "Other")


def _meal_name(entry):
    product = str(entry.get("food_product") or "").strip().lower()
    if product == "water" and entry.get("water_oz") is not None:
        return "Drinks"
    normalized = str(entry.get("meal_category") or "other").strip().lower()
    if normalized in ("breakfast", "brunch"):
        return "Breakfast"
    if normalized == "lunch":
        return "Lunch"
    if normalized == "dinner":
        return "Dinner"
    if normalized in ("snack", "snacks"):
        return "Snacks"
    if normalized in ("drink", "drinks", "beverage", "beverages"):
        return "Drinks"
    return "Other"


def _whole(value):
    if value is None:
        return "unknown"
    return f"{float(value):,.0f}"


def _grams(value):
    return "unknown" if value is None else f"{float(value):.1f} g"


def _kcal(value):
    return "unknown kcal" if value is None else f"{_whole(value)} kcal"


def _complete_total(rows, field):
    values = [row.get(field) for row in rows]
    if not rows or any(value is None for value in values):
        return None
    return round(sum(values), 2)


def _meal_sections(rows):
    grouped = {name: [] for name in MEAL_ORDER}
    for row in rows:
        grouped[_meal_name(row)].append(row)
    return [(name, grouped[name]) for name in MEAL_ORDER if grouped[name]]


def _food_line(entry):
    label = entry.get("food_product") or "Unnamed food"
    brand = entry.get("brand_restaurant_source")
    if brand:
        label += f" ({brand})"
    amount = entry.get("amount_weight") or "amount not logged"
    return (
        f"- {label}, {amount} — {_kcal(entry.get('calories'))} | "
        f"P {_grams(entry.get('protein_g'))} | "
        f"C {_grams(entry.get('carbohydrates_g'))} | "
        f"F {_grams(entry.get('fat_g'))} | Fi {_grams(entry.get('fiber_g'))}"
    )


def render_daily_report(ledger, date, view="panel"):
    """Render every human-readable daily nutrition report from one contract."""
    if view not in ("panel", "foods"):
        raise ValueError("view must be panel or foods")
    totals, rows = totals_for(ledger, date)
    timezone = timezone_name_for(ledger)
    heading = "Nutrition Panel" if view == "panel" else "Foods Eaten"
    weight = weight_for(ledger, date)
    lines = [
        f"{heading} — {date} ({timezone})",
        f"Entries: {len(rows)} | Weight: {f'{float(weight):.1f} lb' if weight is not None else 'not logged'}",
        "",
    ]

    if view == "panel":
        calories = totals.get("calories") or 0
        protein = totals.get("protein_g") or 0
        calorie_target = ledger.get("targets", {}).get("daily_calories")
        protein_target = ledger.get("targets", {}).get("daily_protein_g")
        calorie_progress = (
            f"{_whole(calories)} / {_whole(calorie_target)} kcal ({_whole(calorie_target - calories)} remaining)"
            if calorie_target is not None else _kcal(totals.get("calories"))
        )
        protein_progress = (
            f"{float(protein):.1f} / {float(protein_target):.1f} g ({float(protein_target - protein):.1f} remaining)"
            if protein_target is not None else _grams(totals.get("protein_g"))
        )
        water_oz = totals.get("water_oz")
        hydration = "not logged" if water_oz is None else f"{round(float(water_oz) * 29.5735):,.0f} mL ({float(water_oz):.1f} fl oz)"
        lines.extend([
            "Progress",
            f"Calories: {calorie_progress}",
            f"Protein: {protein_progress}",
            f"Carbs: {_grams(totals.get('carbohydrates_g'))} | Fat: {_grams(totals.get('fat_g'))} | Fiber: {_grams(totals.get('fiber_g'))}",
            f"Hydration: {hydration}",
            "",
        ])

    lines.append("Meals")
    sections = _meal_sections(rows)
    if not sections:
        lines.append("No foods logged.")
    else:
        for meal, entries in sections:
            item_word = "item" if len(entries) == 1 else "items"
            lines.append(f"{meal} — {len(entries)} {item_word} | {_kcal(_complete_total(entries, 'calories'))} | P {_grams(_complete_total(entries, 'protein_g'))}")
            lines.extend(_food_line(entry) for entry in entries)

    if view == "foods":
        water_oz = totals.get("water_oz")
        hydration = "not logged" if water_oz is None else f"{round(float(water_oz) * 29.5735):,.0f} mL ({float(water_oz):.1f} fl oz)"
        lines.extend([
            "",
            "Daily totals",
            f"Calories: {_kcal(totals.get('calories'))} | Protein: {_grams(totals.get('protein_g'))}",
            f"Carbs: {_grams(totals.get('carbohydrates_g'))} | Fat: {_grams(totals.get('fat_g'))} | Fiber: {_grams(totals.get('fiber_g'))}",
            f"Hydration: {hydration}",
        ])

    lines.extend([
        "",
        "Data quality",
        "Active entries only. Unknown means untracked, not zero.",
    ])
    return "\n".join(lines)


def load(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def atomic_write(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def timezone_name_for(ledger):
    timezone = str(ledger.get("timezone") or "").strip()
    if not timezone:
        raise ValueError("timezone is required; configure an IANA timezone such as Europe/London")
    try:
        ZoneInfo(timezone)
    except ZoneInfoNotFoundError as exc:
        raise ValueError(f"timezone must be a valid IANA timezone, got {timezone!r}") from exc
    return timezone


def timezone_for(ledger):
    return ZoneInfo(timezone_name_for(ledger))


def now_in_timezone(ledger, now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=dt.timezone.utc)
    return now.astimezone(timezone_for(ledger))


def current_local_date(ledger, now=None):
    return now_in_timezone(ledger, now).date().isoformat()


def validate_date_argument_policy(requested_date=None, date_source="inferred"):
    """Fail closed when a caller supplies a date without declaring its provenance."""
    if requested_date is not None and date_source != "user_explicit":
        raise ValueError(
            "an explicit date requires date_source=user_explicit; "
            "omit the date to derive it from the persisted IANA timezone"
        )


def resolve_entry_date(ledger, requested_date=None, date_source="inferred", now=None):
    validate_date_argument_policy(requested_date, date_source)
    today = current_local_date(ledger, now)
    if not requested_date or requested_date == "today":
        return today
    return requested_date


def now_iso(ledger):
    return now_in_timezone(ledger).isoformat(timespec="seconds")


DEFAULT_DAILY_SYNC_TIME_LOCAL = "23:55"


def validate_sync_time(value):
    value = str(value or "").strip()
    if not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", value):
        raise ValueError("sync time must use zero-padded local HH:MM in 24-hour format")
    return value


def scheduled_sync_task_config(ledger):
    """Return the host-automation contract for the daily combined sync."""
    timezone = timezone_name_for(ledger)
    sync = ledger.get("sync", {})
    sync_time = validate_sync_time(sync.get("daily_sync_time_local", DEFAULT_DAILY_SYNC_TIME_LOCAL))
    return {
        "title": "Fitness Ledger Daily Sync",
        "timing_mode": "exact_schedule",
        "default_timezone": timezone,
        "sync_time_local": sync_time,
        "schedule": "BEGIN:VEVENT\nRRULE:FREQ=DAILY\nEND:VEVENT",
        "prompt": (
            "Run the combined Fitness Ledger synchronization for the current local day. "
            "Pull nutrition, Caliber workouts, Apple Health workouts, and Apple Health activity. "
            "Reconcile sources, keep raw observations, use Apple Health as canonical for steps, "
            "and report a clear success or failure. Do not publish derived fitness facts from "
            "incomplete source responses. Run this even when there are no workouts."
        ),
    }


def initialize_ledger(timezone, targets=None, sources=None, sync_time=DEFAULT_DAILY_SYNC_TIME_LOCAL):
    """Create a minimal, explicit local ledger without credentials or live connections."""
    template = {"timezone": timezone}
    timezone_name_for(template)
    sync_time = validate_sync_time(sync_time)
    targets = {key: value for key, value in (targets or {}).items() if value is not None}
    adapters = {
        source: {"status": "configured", "configured_at": now_iso(template)}
        for source in (sources or [])
    }
    ledger = {
        "schema_version": "1.0.0",
        "tracker_id": "nutrition-ledger",
        "timezone": timezone,
        "targets": targets,
        "source_adapters": adapters,
        "sync": {
            "pending_excel_sync": False,
            "daily_sync_enabled": True,
            "daily_sync_time_local": sync_time,
            "last_combined_sync_at": None,
        },
        "entries": [],
        "weights": [],
        "food_master": [],
        "audit_log": [{"event": "ledger_initialized", "at": now_iso(template)}],
    }
    ledger["sync"]["automation"] = scheduled_sync_task_config(ledger)
    return ledger


def nutrient_fields(ledger):
    return tuple(ledger.get("nutrient_units", {}).keys()) or DEFAULT_NUTRIENTS


def totals_for(ledger, date):
    rows = [e for e in ledger["entries"] if e["date"] == date and e.get("deleted_at") is None]
    totals = {}
    for field in nutrient_fields(ledger):
        values = [e.get(field) for e in rows if e.get(field) is not None]
        totals[field] = round(sum(values), 2) if values else None
    totals["entry_count"] = len(rows)
    return totals, rows


def ledger_fingerprint(ledger, date):
    """Stable fingerprint for the active entries used by the daily cache."""
    rows = [e for e in ledger["entries"] if e["date"] == date and e.get("deleted_at") is None]
    payload = [{k: e.get(k) for k in ("entry_id", "revision", *nutrient_fields(ledger))} for e in rows]
    return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()


def cache_matches(ledger, date):
    cached = ledger.get("daily_cache", {}).get(date, {})
    return cached.get("ledger_fingerprint") == ledger_fingerprint(ledger, date)


def state_matches(ledger, state, date):
    if not isinstance(state, dict) or state.get("current_date") != date:
        return False
    return state.get("ledger_fingerprint") == ledger_fingerprint(ledger, date) and cache_matches(ledger, date)


def confidence_for(ledger, rows):
    weights = ledger.get("confidence_weights", {"A": 1.0, "B": 0.9, "C": 0.5, "D": 0.0})
    result = {}
    for field in nutrient_fields(ledger):
        tier_amounts = {tier: 0.0 for tier in "ABCD"}
        tier_entry_counts = {tier: 0 for tier in "ABCD"}
        known_amount = 0.0
        weighted_amount = 0.0
        for entry in rows:
            value = entry.get(field)
            tier = entry.get("nutrient_provenance", {}).get(field, {}).get("tier", "D")
            tier = tier if tier in weights else "D"
            tier_entry_counts[tier] += 1
            if value is not None:
                tier_amounts[tier] += float(value)
                known_amount += abs(float(value))
                weighted_amount += abs(float(value)) * weights[tier]
        known_entries = sum(v for k, v in tier_entry_counts.items() if k != "D")
        result[field] = {
            "score": round(weighted_amount / known_amount, 4) if known_amount else None,
            "known_entry_coverage": round(known_entries / len(rows), 4) if rows else None,
            "tier_amounts": {k: round(v, 4) for k, v in tier_amounts.items()},
            "tier_entry_counts": tier_entry_counts,
        }
    return result


def weight_for(ledger, date):
    rows = [w for w in ledger.get("weights", []) if w["date"] == date and w.get("deleted_at") is None]
    return rows[-1]["weight_lb"] if rows else None


def rebuild(ledger, state_path, date):
    totals, rows = totals_for(ledger, date)
    confidence = confidence_for(ledger, rows)
    ctarget = ledger.get("targets", {}).get("daily_calories")
    ptarget = ledger.get("targets", {}).get("daily_protein_g")
    state = {
        "schema_version": ledger["schema_version"],
        "tracker_id": ledger["tracker_id"],
        "timezone": ledger["timezone"],
        "current_date": date,
        "updated_at": now_iso(ledger),
        "targets": {"calories": ctarget, "protein_g": ptarget},
        "totals": totals,
        "remaining": {
            "calories": round(ctarget - (totals["calories"] or 0), 2) if ctarget is not None else None,
            "protein_g": round(ptarget - (totals["protein_credit_g"] or 0), 2) if ptarget is not None else None,
        },
        "progress": {"calories": round((totals["calories"] or 0) / ctarget, 6) if ctarget else None, "protein": round((totals["protein_credit_g"] or 0) / ptarget, 6) if ptarget else None},
        "nutrient_confidence": confidence,
        "body_weight_lb": weight_for(ledger, date),
        "entries": [{k: e.get(k) for k in ("entry_id", "meal_category", "food_product", "amount_weight", "calories", "protein_g")} for e in rows],
        "pending_excel_sync": ledger["sync"].get("pending_excel_sync", True),
        "canonical_ledger_filename": "Fitness_Ledger_Nutrition_Ledger.json",
        "ledger_fingerprint": ledger_fingerprint(ledger, date),
    }
    ledger.setdefault("daily_cache", {})[date] = {**totals, "body_weight_lb": state["body_weight_lb"], "calorie_progress": state["progress"]["calories"], "protein_progress": state["progress"]["protein"], "nutrient_confidence": confidence}
    ledger["daily_cache"][date]["ledger_fingerprint"] = state["ledger_fingerprint"]
    atomic_write(state_path, state)
    return state


def next_id(rows, date, prefix=""):
    stem = date.replace("-", "")
    seqs = []
    for row in rows:
        rid = row.get("entry_id") or row.get("weight_id") or ""
        if stem in rid:
            try:
                seqs.append(int(rid.rsplit("-", 1)[1]))
            except (ValueError, IndexError):
                pass
    return f"{prefix}{stem}-{max(seqs, default=0)+1:03d}"


def mark_mutated(ledger):
    stamp = now_iso(ledger)
    ledger["last_updated_at"] = stamp
    ledger["sync"]["pending_excel_sync"] = True
    return stamp


def validate(ledger):
    errors = []
    ids = [e["entry_id"] for e in ledger.get("entries", [])]
    if len(ids) != len(set(ids)):
        errors.append("duplicate entry_id")
    wids = [w["weight_id"] for w in ledger.get("weights", [])]
    if len(wids) != len(set(wids)):
        errors.append("duplicate weight_id")
    for e in ledger.get("entries", []):
        if not e.get("date") or not e.get("food_product"):
            errors.append(f"incomplete entry {e.get('entry_id')}")
        try:
            dt.date.fromisoformat(e.get("date", ""))
        except (TypeError, ValueError):
            errors.append(f"invalid date in {e.get('entry_id')}: {e.get('date')!r}")
        for field in nutrient_fields(ledger):
            value = e.get(field)
            if value is not None and not isinstance(value, (int, float)):
                errors.append(f"non-numeric {field} in {e.get('entry_id')}")
            if isinstance(value, (int, float)) and value < 0:
                errors.append(f"negative {field} in {e.get('entry_id')}")
            if ledger.get("schema_version", "1").startswith("2"):
                provenance = e.get("nutrient_provenance", {}).get(field)
                if not provenance or provenance.get("tier") not in ("A", "B", "C", "D"):
                    errors.append(f"missing/invalid provenance for {field} in {e.get('entry_id')}")
                elif value is None and provenance.get("tier") != "D":
                    errors.append(f"unknown {field} must use Tier D in {e.get('entry_id')}")
                elif value is not None and provenance.get("tier") == "D":
                    errors.append(f"known {field} cannot use Tier D in {e.get('entry_id')}")
        if ledger.get("schema_version", "1").startswith("2") and not e.get("food_master_id"):
            errors.append(f"missing food_master_id in {e.get('entry_id')}")
        if isinstance(e.get("quantity"), (int, float)) and e["quantity"] < 0:
            errors.append(f"negative quantity in {e.get('entry_id')}")
    for weight in ledger.get("weights", []):
        if isinstance(weight.get("weight_lb"), (int, float)) and weight["weight_lb"] < 0:
            errors.append(f"negative weight in {weight.get('weight_id')}")
    master_ids = [m.get("food_master_id") for m in ledger.get("food_master", [])]
    if len(master_ids) != len(set(master_ids)):
        errors.append("duplicate food_master_id")
    return errors


def correct_entry(ledger, entry_id, fields, stamp):
    matches = [e for e in ledger.get("entries", []) if e.get("entry_id") == entry_id]
    if len(matches) != 1:
        raise ValueError(f"entry not found or ambiguous: {entry_id}")
    entry = matches[0]
    before = json.loads(json.dumps(entry))
    entry.update(fields)
    entry["revision"] = entry.get("revision", 1) + 1
    entry["updated_at"] = stamp
    ledger.setdefault("audit_log", []).append({"event": "entry_corrected", "timestamp": stamp, "entry_id": entry_id, "before": before, "after": json.loads(json.dumps(entry))})
    return entry


def tombstone_entry(ledger, entry_id, stamp):
    matches = [e for e in ledger.get("entries", []) if e.get("entry_id") == entry_id]
    if len(matches) != 1:
        raise ValueError(f"entry not found or ambiguous: {entry_id}")
    entry = matches[0]
    before = json.loads(json.dumps(entry))
    entry["deleted_at"] = stamp
    entry["revision"] = entry.get("revision", 1) + 1
    entry["updated_at"] = stamp
    ledger.setdefault("audit_log", []).append({"event": "entry_tombstoned", "timestamp": stamp, "entry_id": entry_id, "before": before, "after": json.loads(json.dumps(entry))})
    return entry


def upsert_food_master(ledger, record):
    record = json.loads(json.dumps(record))
    mid = record.get("food_master_id") or food_master_id({"food_product": record.get("food_name"), "brand_restaurant_source": record.get("brand")})
    record["food_master_id"] = mid
    masters = ledger.setdefault("food_master", [])
    existing = next((m for m in masters if m.get("food_master_id") == mid), None)
    if existing is None:
        masters.append(record)
        return record
    existing.update(record)
    return existing


def parse_fields(raw):
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError("--fields must be a JSON object")
    return data


def infer_tier(fields):
    explicit = fields.pop("confidence_tier", None)
    if explicit in ("A", "B", "C", "D"):
        return explicit
    text = " ".join(str(fields.get(k, "")) for k in ("accuracy", "source_id", "notes")).lower()
    if any(x in text for x in ("package label", "manufacturer", "label verified", "product_specific")):
        return "A"
    if any(x in text for x in ("usda", "fooddata central", "fndds", "foundation", "commodity_reference", "reference_exact")):
        return "B"
    return "C" if fields.get("is_estimate") or text.strip() else "D"


def food_master_id(fields):
    key = "|".join(re.sub(r"[^a-z0-9]+", " ", str(fields.get(k, "")).lower()).strip() for k in ("food_product", "brand_restaurant_source"))
    return "FM-" + hashlib.sha256(key.encode("utf-8")).hexdigest()[:12].upper()


def ensure_v2_entry(ledger, fields, stamp):
    if not ledger.get("schema_version", "1").startswith("2"):
        return fields
    tier = infer_tier(fields)
    mid = fields.setdefault("food_master_id", food_master_id(fields))
    provided = fields.get("nutrient_provenance", {})
    provenance = {}
    for nutrient in nutrient_fields(ledger):
        fields.setdefault(nutrient, None)
        value = fields.get(nutrient)
        p = dict(provided.get(nutrient, {}))
        field_tier = p.get("tier") or (tier if value is not None else "D")
        if value is None: field_tier = "D"
        p.update({
            "tier": field_tier,
            "source_type": p.get("source_type") or ({"A":"label_or_direct_product_source","B":"authoritative_analytical_reference","C":"reconstructed_estimate","D":"unknown"}[field_tier]),
            "source_id": p.get("source_id") if "source_id" in p else (fields.get("source_id") if field_tier != "D" else None),
            "method": p.get("method") or ("direct" if field_tier in ("A", "B") else ("reconstructed" if field_tier == "C" else "unknown")),
            "verified_at": p.get("verified_at") or stamp,
            "food_master_id": mid,
        })
        provenance[nutrient] = p
    fields["nutrient_provenance"] = provenance
    masters = ledger.setdefault("food_master", [])
    master = next((m for m in masters if m.get("food_master_id") == mid), None)
    if master is None:
        master = {
            "food_master_id": mid, "food_name": fields.get("food_product"),
            "brand": fields.get("brand_restaurant_source"), "variant_flavor": fields.get("variant_flavor"),
            "upc_barcode": fields.get("upc_barcode"), "serving_description": fields.get("amount_weight"),
            "serving_weight_g": fields.get("serving_weight_g"),
            "nutrients": {n: fields.get(n) for n in nutrient_fields(ledger)},
            "nutrient_provenance": json.loads(json.dumps(provenance)),
            "source_type": fields.get("source_type") or provenance.get("calories", {}).get("source_type"),
            "source_url_or_id": fields.get("source_id"), "usda_fdc_id": fields.get("usda_fdc_id"),
            "date_last_verified": stamp[:10], "notes": fields.get("master_notes") or "Created during conversational logging.", "active": True,
        }
        masters.append(master)
    return fields


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--ledger", required=True)
    p.add_argument("--state", required=True)
    sub = p.add_subparsers(dest="command", required=True)
    init = sub.add_parser("init")
    init.add_argument("--timezone", required=True)
    init.add_argument("--sync-time", default=DEFAULT_DAILY_SYNC_TIME_LOCAL)
    init.add_argument("--daily-calories", type=float)
    init.add_argument("--daily-protein-g", type=float)
    init.add_argument("--daily-carbohydrates-g", type=float)
    init.add_argument("--daily-fat-g", type=float)
    init.add_argument("--daily-fiber-g", type=float)
    init.add_argument("--source", action="append", choices=("apple-health", "caliber"), default=[])
    init.add_argument("--force", action="store_true")
    for name in ("today", "validate"):
        sub.add_parser(name)
    day = sub.add_parser("day"); day.add_argument("--date")
    panel = sub.add_parser("panel"); panel.add_argument("--date")
    foods = sub.add_parser("foods"); foods.add_argument("--date")
    rebuild_p = sub.add_parser("rebuild-state"); rebuild_p.add_argument("--date", required=True)
    add = sub.add_parser("add"); add.add_argument("--date"); add.add_argument("--date-source", choices=("inferred", "user_explicit"), default="inferred"); add.add_argument("--fields", required=True)
    correct = sub.add_parser("correct"); correct.add_argument("--entry-id", required=True); correct.add_argument("--fields", required=True)
    weight = sub.add_parser("weight"); weight.add_argument("--date"); weight.add_argument("--date-source", choices=("inferred", "user_explicit"), default="inferred"); weight.add_argument("--weight-lb", required=True, type=float); weight.add_argument("--notes", default="")
    delete = sub.add_parser("delete"); delete.add_argument("--entry-id", required=True)
    find_master = sub.add_parser("food-master-find"); find_master.add_argument("--query", required=True)
    upsert_master = sub.add_parser("food-master-upsert"); upsert_master.add_argument("--record", required=True)
    add_master = sub.add_parser("add-from-master"); add_master.add_argument("--date"); add_master.add_argument("--date-source", choices=("inferred", "user_explicit"), default="inferred"); add_master.add_argument("--food-master-id", required=True); add_master.add_argument("--meal", required=True); add_master.add_argument("--amount", required=True); add_master.add_argument("--factor", type=float, default=1.0)
    args = p.parse_args()
    if args.command == "init":
        ledger_path = Path(args.ledger)
        if ledger_path.exists() and not args.force:
            raise SystemExit(f"ledger already exists: {ledger_path}; use --force only to replace it")
        ledger = initialize_ledger(
            timezone=args.timezone,
            targets={
                "daily_calories": args.daily_calories,
                "daily_protein_g": args.daily_protein_g,
                "daily_carbohydrates_g": args.daily_carbohydrates_g,
                "daily_fat_g": args.daily_fat_g,
                "daily_fiber_g": args.daily_fiber_g,
            },
            sources=args.source,
            sync_time=args.sync_time,
        )
        state = rebuild(ledger, args.state, current_local_date(ledger))
        atomic_write(args.ledger, ledger)
        print(json.dumps({"ok": True, "initialized": True, "timezone": ledger["timezone"], "targets": ledger["targets"], "source_adapters": ledger["source_adapters"], "sync": ledger["sync"], "state": state}, indent=2)); return
    ledger = load(args.ledger)

    if args.command == "today":
        # Never trust a cached state file without reconciling it to the canonical ledger.
        current_date = current_local_date(ledger)
        state = rebuild(ledger, args.state, current_date)
        atomic_write(args.ledger, ledger)
        print(json.dumps(state, indent=2)); return
    if args.command == "validate":
        errors = validate(ledger)
        print(json.dumps({"valid": not errors, "errors": errors}, indent=2))
        raise SystemExit(1 if errors else 0)
    if args.command == "day":
        report_date = current_local_date(ledger) if args.date in (None, "today") else args.date
        totals, rows = totals_for(ledger, report_date)
        print(json.dumps({"date": report_date, "timezone": timezone_name_for(ledger), "totals": totals, "confidence": confidence_for(ledger, rows), "entries": rows, "body_weight_lb": weight_for(ledger, report_date)}, indent=2)); return
    if args.command in ("panel", "foods"):
        report_date = current_local_date(ledger) if args.date in (None, "today") else args.date
        print(render_daily_report(ledger, report_date, view=args.command)); return
    if args.command == "food-master-find":
        terms = set(re.sub(r"[^a-z0-9]+", " ", args.query.lower()).split())
        matches = []
        for master in ledger.get("food_master", []):
            hay = re.sub(r"[^a-z0-9]+", " ", " ".join(str(master.get(k, "")) for k in ("food_name", "brand", "variant_flavor", "upc_barcode")).lower())
            score = sum(1 for term in terms if term in hay)
            if score: matches.append((score, master))
        print(json.dumps([m for _, m in sorted(matches, key=lambda x: -x[0])[:10]], indent=2)); return
    if args.command == "rebuild-state":
        state = rebuild(ledger, args.state, args.date)
        atomic_write(args.ledger, ledger)
        print(json.dumps(state, indent=2)); return

    if args.command in ("add", "add-from-master", "weight"):
        args.date = resolve_entry_date(ledger, args.date, args.date_source)
    stamp = mark_mutated(ledger)
    affected_date = None
    if args.command == "add":
        fields = ensure_v2_entry(ledger, parse_fields(args.fields), stamp); affected_date = args.date
        entry = {"entry_id": next_id(ledger["entries"], args.date), "date": args.date, "date_source": args.date_source, **fields}
        entry.setdefault("protein_credit_g", entry.get("protein_g"))
        entry.update({"deleted_at": None, "revision": 1, "created_at": stamp, "updated_at": stamp})
        ledger["entries"].append(entry)
    elif args.command == "add-from-master":
        affected_date = args.date
        matches = [m for m in ledger.get("food_master", []) if m.get("food_master_id") == args.food_master_id and m.get("active", True)]
        if len(matches) != 1:
            raise SystemExit(f"food master not found or ambiguous: {args.food_master_id}")
        master = matches[0]
        fields = {
            "meal_category": args.meal, "food_product": master.get("food_name"),
            "brand_restaurant_source": master.get("brand"), "amount_weight": args.amount,
            "food_master_id": master.get("food_master_id"), "source_id": master.get("source_url_or_id"),
            "accuracy": "reused_food_master", "is_estimate": False,
            "notes": f"Scaled {args.factor:g}× from food master {master.get('food_master_id')}.",
        }
        for nutrient in nutrient_fields(ledger):
            value = master.get("nutrients", {}).get(nutrient)
            fields[nutrient] = round(value * args.factor, 6) if value is not None else None
        fields["nutrient_provenance"] = json.loads(json.dumps(master.get("nutrient_provenance", {})))
        fields = ensure_v2_entry(ledger, fields, stamp)
        entry = {"entry_id": next_id(ledger["entries"], args.date), "date": args.date, "date_source": args.date_source, **fields}
        entry.setdefault("protein_credit_g", entry.get("protein_g"))
        entry.update({"deleted_at": None, "revision": 1, "created_at": stamp, "updated_at": stamp})
        ledger["entries"].append(entry)
    elif args.command == "food-master-upsert":
        record = parse_fields(args.record)
        upsert_food_master(ledger, record)
        affected_date = max((e["date"] for e in ledger.get("entries", [])), default=current_local_date(ledger))
    elif args.command == "correct":
        fields = parse_fields(args.fields)
        entry = correct_entry(ledger, args.entry_id, fields, stamp); affected_date = entry["date"]
        if ledger.get("schema_version", "1").startswith("2"):
            refreshed = ensure_v2_entry(ledger, dict(entry), stamp)
            entry.clear(); entry.update(refreshed)
    elif args.command == "weight":
        affected_date = args.date
        row = {"weight_id": next_id(ledger.get("weights", []), args.date, "W-"), "date": args.date, "date_source": args.date_source, "weight_lb": args.weight_lb, "notes": args.notes, "deleted_at": None, "revision": 1, "created_at": stamp, "updated_at": stamp}
        ledger.setdefault("weights", []).append(row)
    elif args.command == "delete":
        entry = tombstone_entry(ledger, args.entry_id, stamp); affected_date = entry["date"]

    state = rebuild(ledger, args.state, affected_date)
    errors = validate(ledger)
    if errors:
        raise SystemExit("; ".join(errors))
    atomic_write(args.ledger, ledger)
    print(json.dumps({"ok": True, "date": affected_date, "state": state}, indent=2))


if __name__ == "__main__":
    main()
