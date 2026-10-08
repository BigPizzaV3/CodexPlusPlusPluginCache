"""Resolve live UN area names/codes, with versioned DSIR country metadata."""
import difflib
import json
import re
import unicodedata
from pathlib import Path

ALIASES = {"philippines": "Philippines", "菲律宾": "Philippines", "中国": "China", "日本": "Japan",
           "global": "World", "worldwide": "World", "全球": "World",
           "wpro": "WHO Western Pacific", "wpr": "WHO Western Pacific",
           "western pacific region": "WHO Western Pacific", "western pacific": "WHO Western Pacific",
           "西太平洋区域": "WHO Western Pacific", "西太区": "WHO Western Pacific",
           "lao pdr": "Lao People's Democratic Republic", "south korea": "Republic of Korea",
           "north korea": "Democratic People's Republic of Korea", "uk": "United Kingdom of Great Britain and Northern Ireland",
           "usa": "United States of America", "vietnam": "Viet Nam"}


def normalize(value):
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", str(value)).casefold()).strip()


def load_countries():
    return json.loads((Path(__file__).resolve().parents[1] / "references/metadata/who_countries.json").read_text(encoding="utf-8"))


def resolve_locations(names, *, client):
    if isinstance(names, str):
        names = [names]
    if not isinstance(names, list) or not names or any(not isinstance(n, str) or not n.strip() for n in names):
        from sdg_client import SDGError
        raise SDGError("invalid_query", "Supply at least one location name or code.")
    areas, countries = client.areas(), load_countries()
    by_code = {str(int(a["geoAreaCode"])): a for a in areas}
    index = {}
    for a in areas:
        index.setdefault(normalize(a["geoAreaName"]), set()).add(str(int(a["geoAreaCode"])))
    for c in countries:
        code = str(int(c["m49_code"]))
        if code in by_code:
            for value in (c["iso3"], c["name_short"], c["name_official"]):
                index.setdefault(normalize(value), set()).add(code)
    resolved, unresolved = [], []
    for name in names:
        norm = normalize(name)
        norm = normalize(ALIASES.get(norm, norm))
        hits = {str(int(norm))} & by_code.keys() if norm.isdigit() else index.get(norm, set())
        if len(hits) != 1:
            candidates = sorted(hits) if hits else list(dict.fromkeys(code for key in difflib.get_close_matches(norm, index, n=4, cutoff=0.72) for code in sorted(index[key])))
            unresolved.append({"input": name, "reason": "ambiguous" if hits else "unrecognized",
                               "candidates": [by_code[c] for c in candidates]})
            continue
        code = next(iter(hits))
        country = next((c for c in countries if int(c["m49_code"]) == int(code)), None)
        resolved.append({"input": name, "code": code, "name": by_code[code]["geoAreaName"],
                         "iso3": country["iso3"] if country else None,
                         "scope_note": "Official UN-published WHO regional group; membership is defined by this release, not reconstructed by historical year." if by_code[code]["geoAreaName"].startswith("WHO ") else None})
    return {"status": "needs_clarification" if unresolved else "ok", "locations": resolved, "unresolved": unresolved}
