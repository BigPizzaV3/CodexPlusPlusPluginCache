#!/usr/bin/env python3

"""Audit county index completeness and freshness metadata without network access."""

import argparse
import json
from datetime import date
from pathlib import Path


DEFAULT_INDEX = Path(__file__).resolve().parent.parent / "references" / "county-web-index.json"


def audit(data, as_of, max_age_days):
    errors, warnings = [], []
    rows = data.get("counties", [])
    names = [row.get("county") for row in rows]
    if len(rows) != 58 or len(set(names)) != 58:
        errors.append("County index must contain 58 uniquely named counties.")
    for row in rows:
        name = row.get("county", "unknown")
        for field in ("assessor", "appeals_office"):
            if not str(row.get(field, "")).startswith("https://"):
                errors.append(f"{name}: {field} must be an HTTPS discovery root.")
        if row.get("online_portal") is None:
            warnings.append(f"{name}: online portal is unverified, not necessarily unavailable.")
    try:
        verified = date.fromisoformat(data["verified_on"])
        age = (as_of - verified).days
        if age > max_age_days:
            warnings.append(f"County index is {age} days old; refresh the selected county before use.")
    except (KeyError, ValueError):
        errors.append("Index verified_on must be an ISO date.")
        age = None
    return {"valid": not errors, "errors": errors, "warnings": warnings, "county_count": len(rows), "age_days": age}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--index", type=Path, default=DEFAULT_INDEX)
    parser.add_argument("--as-of", type=date.fromisoformat, default=date.today())
    parser.add_argument("--max-age-days", type=int, default=30)
    args = parser.parse_args()
    data = json.loads(args.index.read_text(encoding="utf-8"))
    result = audit(data, args.as_of, args.max_age_days)
    print(json.dumps(result, indent=2))
    return 0 if result["valid"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
