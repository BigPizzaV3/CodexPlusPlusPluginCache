#!/usr/bin/env python3

"""Return the indexed official discovery roots for one California county."""

import argparse
import json
from pathlib import Path


INDEX = Path(__file__).resolve().parent.parent / "references" / "county-web-index.json"


def normalize(value: str) -> str:
    value = " ".join(value.strip().lower().replace("-", " ").split())
    if value.endswith(" county"):
        value = value[:-7].rstrip()
    return value


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Look up official California county Assessor and appeals-office roots."
    )
    parser.add_argument("county", help="County name, with or without the word County")
    args = parser.parse_args()

    data = json.loads(INDEX.read_text(encoding="utf-8"))
    wanted = normalize(args.county)
    matches = [row for row in data["counties"] if normalize(row["county"]) == wanted]
    if not matches:
        print(json.dumps({"error": "county_not_found", "county": args.county}))
        return 2

    result = dict(matches[0])
    result["state_directory"] = data["state_directory"]
    result["index_verified_on"] = data["verified_on"]
    result["refresh_required"] = True
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
