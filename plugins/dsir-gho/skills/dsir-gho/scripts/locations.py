"""Resolve country and WHO aggregate requests without expanding region membership."""

from __future__ import annotations

import difflib
import json
import re
import unicodedata
from pathlib import Path


METADATA_PATH = Path(__file__).resolve().parents[1] / "references" / "metadata" / "who_countries.json"
REGION_NAMES = {
    "AFR": "Africa", "AMR": "Americas", "SEAR": "South-East Asia",
    "EUR": "Europe", "EMR": "Eastern Mediterranean", "WPR": "Western Pacific",
    "GLOBAL": "Global",
}
REGION_ALIASES = {
    "AFR": ("AFRO", "Africa", "African Region", "WHO African Region", "非洲", "非洲区域"),
    "AMR": ("AMRO", "Americas", "Region of the Americas", "美洲", "美洲区域"),
    "SEAR": ("SEARO", "South-East Asia", "South-East Asia Region", "东南亚", "东南亚区域"),
    "EUR": ("EURO", "Europe", "European Region", "欧洲", "欧洲区域"),
    "EMR": ("EMRO", "Eastern Mediterranean", "Eastern Mediterranean Region", "东地中海", "东地中海区域"),
    "WPR": ("WPRO", "Western Pacific", "Western Pacific Region", "WHO Western Pacific Region",
            "西太", "西太平洋", "西太平洋区域", "西太平洋地区", "西太区", "WHO西太平洋区域"),
    "GLOBAL": ("World", "Global", "Worldwide", "全球", "全世界"),
    "WPR_WO_IDN": ("Western Pacific excluding Indonesia", "Western Pacific without Indonesia",
                   "WPR excluding Indonesia", "WPRO excluding Indonesia", "西太平洋不含印度尼西亚",
                   "西太平洋不含印尼"),
}
COUNTRY_ALIASES = {
    "UK": "GBR", "Russia": "RUS", "Laos": "LAO", "Vietnam": "VNM",
    "South Korea": "KOR", "North Korea": "PRK", "DRC": "COD",
    "菲律宾": "PHL", "印度尼西亚": "IDN", "印尼": "IDN", "中国": "CHN",
    "日本": "JPN", "韩国": "KOR", "朝鲜": "PRK", "越南": "VNM",
    "老挝": "LAO", "美国": "USA", "英国": "GBR", "澳大利亚": "AUS",
    "新西兰": "NZL", "蒙古": "MNG", "柬埔寨": "KHM", "马来西亚": "MYS",
    "新加坡": "SGP", "文莱": "BRN",
}
AMBIGUOUS_NAMES = {
    "congo": ("COG", "COD"), "korea": ("KOR", "PRK"),
    "刚果": ("COG", "COD"), "朝鲜半岛": ("KOR", "PRK"),
}


def load_countries() -> list[dict]:
    """Read the versioned DSIR Member State snapshot without changing its strings."""
    with METADATA_PATH.open(encoding="utf-8-sig") as handle:
        return json.load(handle)


def _normalize(value: str) -> str:
    text = unicodedata.normalize("NFKC", value).casefold().strip()
    return re.sub(r"[\W_]+", " ", text, flags=re.UNICODE).strip()


def _location(code: str, name: str, spatial_type: str, matched_by: str) -> dict:
    return {"code": code, "name": name, "spatial_type": spatial_type, "matched_by": matched_by}


def resolve_locations(inputs: str | list[str], client=None, spatial_type=None) -> dict:
    """Resolve exact names/codes and a small auditable alias set.

    Live COUNTRY/REGION/GLOBAL codelists supplement the historical Member
    State snapshot. A region stays an official aggregate code; this function
    never converts it into a static list of countries. API errors propagate.
    """
    items = [inputs] if isinstance(inputs, str) else inputs
    if not isinstance(items, list) or any(not isinstance(item, str) for item in items):
        raise TypeError("inputs must be a location string or list of location strings.")
    requested_type = str(spatial_type).casefold() if spatial_type is not None else None
    if requested_type not in (None, "country", "region", "global"):
        raise ValueError("spatial_type must be country, region, global, or None.")
    countries = load_countries()
    by_iso3 = {row["iso3"]: row for row in countries}
    aliases = {_normalize(name): code for name, code in COUNTRY_ALIASES.items()}
    regions = {_normalize(name): code for code, names in REGION_ALIASES.items()
               for name in (code, *names)}
    local_index = {}
    for row in countries:
        for field, matched_by in (("iso3", "iso3"), ("iso2", "iso2"),
                                  ("name_official", "country_name"), ("name_short", "country_name")):
            local_index.setdefault(_normalize(row[field]), []).append(
                _location(row["iso3"], row["name_short"], "country", matched_by)
            )

    live_cache = {}

    def live(kind):
        if client is None:
            return []
        if kind not in live_cache:
            rows = client.dimension_values(kind.upper())
            if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
                raise ValueError("Live location metadata must be a list of dictionaries.")
            live_cache[kind] = rows
        return live_cache[kind]

    def live_matches(query, kinds):
        matches = []
        for kind in kinds:
            for row in live(kind):
                code = row.get("Code")
                title = row.get("Title")
                if not isinstance(code, str):
                    continue
                if query == _normalize(code):
                    matches.append(_location(code, title or code, kind, "live_code"))
                elif isinstance(title, str) and query == _normalize(title):
                    matches.append(_location(code, title, kind, "live_name"))
        return matches

    def deduplicate(matches):
        seen = set()
        unique = []
        for match in matches:
            key = (match["spatial_type"], match["code"])
            if key not in seen and (requested_type is None or match["spatial_type"] == requested_type):
                unique.append(match)
                seen.add(key)
        return unique

    result = {"status": "ok", "locations": [], "candidates": [], "notes": [], "unresolved": []}
    if not items:
        result.update(status="unknown_location", unresolved=[""])
        result["notes"].append("No locations were supplied.")
        return result
    for supplied in items:
        query = _normalize(supplied)
        matches = []
        is_ambiguous_name = query in AMBIGUOUS_NAMES
        if is_ambiguous_name:
            matches = [_location(code, by_iso3[code]["name_official"], "country", "ambiguous_name")
                       for code in AMBIGUOUS_NAMES[query]]
        elif query in regions:
            code = regions[query]
            kind = "global" if code == "GLOBAL" else "region"
            matches = live_matches(_normalize(code), [kind])
            if matches:
                matches = [{**row, "matched_by": "official_aggregate"} for row in matches]
            elif code in REGION_NAMES and client is None:
                matches = [_location(code, REGION_NAMES[code], kind, "region_alias")]
                result["notes"].append("Aggregate code resolved from local reference; live availability was not checked.")
            elif client is not None:
                # A service may publish the requested aggregate under a variant
                # code. Match its exact title, but never substitute membership.
                names = {_normalize(name) for name in REGION_ALIASES[code]}
                for row in live(kind):
                    if isinstance(row.get("Title"), str) and _normalize(row["Title"]) in names:
                        matches.append(_location(row["Code"], row["Title"], kind, "official_aggregate"))
            if not matches and code == "WPR_WO_IDN":
                result["notes"].append("WPR_WO_IDN requires confirmation in live REGION metadata; no country expansion was used.")
        elif query in aliases:
            code = aliases[query]
            matches = [_location(code, by_iso3[code]["name_short"], "country", "country_alias")]
        elif query in local_index:
            matches = local_index[query]
        elif query:
            kinds = [requested_type] if requested_type else ["country", "region", "global"]
            matches = live_matches(query, kinds)

        matches = deduplicate(matches)
        if len(matches) == 1 and not is_ambiguous_name:
            result["locations"].extend(matches)
        elif len(matches) > 1 or is_ambiguous_name and matches:
            result["status"] = "needs_clarification"
            result["unresolved"].append(supplied)
            result["candidates"].extend({**row, "input": supplied} for row in matches)
            result["notes"].append(f"'{supplied}' matches more than one location; select an explicit code.")
        else:
            if result["status"] != "needs_clarification":
                result["status"] = "unknown_location"
            result["unresolved"].append(supplied)
            result["notes"].append(f"'{supplied}' could not be resolved; it was not omitted from the request silently.")
            # Suggestions are never accepted automatically.
            keys = difflib.get_close_matches(query, list(local_index), n=3, cutoff=0.8) if query else []
            suggested = deduplicate([row for key in keys for row in local_index[key]])
            result["candidates"].extend({**row, "input": supplied, "matched_by": "suggestion"} for row in suggested)
    result["locations"] = deduplicate(result["locations"])
    result["notes"] = list(dict.fromkeys(result["notes"]))
    return result
