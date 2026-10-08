#!/usr/bin/env python3

"""Resolve a US address to a county with the official Census Geocoder."""

import argparse
import json
import urllib.parse
import urllib.request


ENDPOINT = "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress"


def extract(payload):
    matches = payload.get("result", {}).get("addressMatches", [])
    if len(matches) != 1:
        return {"status": "no_unique_match", "match_count": len(matches)}
    match = matches[0]
    counties = match.get("geographies", {}).get("Counties", [])
    if len(counties) != 1:
        return {"status": "no_unique_county", "county_count": len(counties)}
    county = counties[0]
    state_code = str(county.get("STATE", ""))
    name = str(county.get("NAME", "")).removesuffix(" County")
    return {
        "status": "matched",
        "matched_address": match.get("matchedAddress"),
        "county": name,
        "state_fips": state_code,
        "county_fips": str(county.get("COUNTY", "")),
        "is_california": state_code == "06",
        "source": ENDPOINT,
        "requires_county_record_confirmation": True,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("address")
    parser.add_argument("--confirm-external", action="store_true", help="Confirm sending the address to the U.S. Census Geocoder")
    args = parser.parse_args()
    if not args.confirm_external:
        print(json.dumps({"status": "consent_required", "message": "Ask the user before sending the address to the U.S. Census Geocoder."}))
        return 2
    params = urllib.parse.urlencode({"address": args.address, "benchmark": "Public_AR_Current", "vintage": "Current_Current", "format": "json"})
    try:
        with urllib.request.urlopen(f"{ENDPOINT}?{params}", timeout=20) as response:
            payload = json.load(response)
    except Exception as exc:
        print(json.dumps({"status": "service_error", "error": str(exc)}))
        return 1
    print(json.dumps(extract(payload), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
