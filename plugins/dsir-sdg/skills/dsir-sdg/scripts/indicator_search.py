"""Rank live indicator and series catalogues. Aliases contain terms, not codes."""
import difflib
import json
import re
import unicodedata
from pathlib import Path
from sdg_client import SDGError, BASE_URL


def words(text):
    text = unicodedata.normalize("NFKC", text).casefold()
    return re.findall(r"[a-z0-9]+", text)


def search_indicators(query, *, client, limit=10):
    if not isinstance(query, str) or not query.strip() or type(limit) is not int or limit < 1:
        raise SDGError("invalid_query", "Provide a nonempty search string and positive limit.")
    aliases = json.loads((Path(__file__).resolve().parents[1] / "references/metadata/search_aliases.json").read_text(encoding="utf-8"))
    expanded = aliases.get(query.strip().casefold(), query)
    stopwords = {"the", "of", "by", "and", "in", "for", "a", "per"}
    terms = set(words(expanded)) - stopwords
    entries = []
    for r in client.indicators():
        entries.append({"indicator_code": r["code"], "series_code": None, "name": r.get("description"), "type": "indicator"})
    for r in client.series():
        for code in r.get("indicator", []):
            entries.append({"indicator_code": code, "series_code": r["code"], "name": r.get("description"),
                            "type": "series", "release": r.get("release")})
    matches = []
    looks_like_code = bool(re.fullmatch(r"[0-9]+\.[0-9a-z]+\.[0-9]+|[A-Z]+_[A-Z0-9_]+", query.strip(), flags=re.I))
    for row in entries:
        label = row["name"] or ""
        candidate = set(words(label)) - stopwords
        exact_code = query.strip().upper() in {str(row["series_code"]).upper(), row["indicator_code"].upper()}
        exact_name = " ".join(words(expanded)) == " ".join(words(label))
        coverage = len(terms & candidate) / max(1, len(terms))
        fuzzy = sum(max((difflib.SequenceMatcher(None, t, c).ratio() for c in candidate), default=0) for t in terms) / max(1, len(terms))
        if exact_code:
            score, reason = 100.0, "exact catalogue code"
        elif looks_like_code:
            continue
        elif exact_name:
            score, reason = 99.0, "exact official name"
        elif terms and terms <= candidate:
            score, reason = 90.0 + min(8, 8 * len(terms) / max(1, len(candidate))), "all keywords match"
        elif coverage >= 0.6:
            score, reason = 60 * coverage + 20 * fuzzy, "partial keyword match; compare the official meaning"
        elif fuzzy >= 0.85:
            score, reason = 60 * fuzzy, "fuzzy name match; confirm before retrieval"
        else:
            continue
        matches.append({**row, "score": round(score, 2), "relevance": reason})
    matches.sort(key=lambda x: (-x["score"], x["type"] != "series", x["indicator_code"], x["series_code"] or ""))
    notes = []
    lower = query.casefold()
    if any(t in lower for t in ("catastrophic", "expenditure", "out of pocket", "che")) and any(t in lower for t in ("10", "25")):
        notes.append("Check the threshold and denominator: a current 40% discretionary-budget series is not a substitute for an older 10%/25% total-budget series. A related search match is not confirmation of the requested definition.")
    return {"status": "ok" if matches else "no_matches", "query": query, "expanded_query": expanded,
            "matches": matches[:limit], "total_matches": len(matches), "notes": notes,
            "source": BASE_URL, "requests": client.trace}


def describe_indicator(code, *, client, series=None):
    indicator = client.indicator(code)
    candidates = client.indicator_series(code)
    if series:
        candidates = [s for s in candidates if s["code"] == series]
        if not candidates:
            raise SDGError("series_not_found", "Series is not linked to this indicator in the live catalogue.")
    details, errors = [], []
    for s in candidates:
        info = {**s, "definition": None, "available_years": None}
        for field, suffix in (("dimensions", "Dimensions"), ("attributes", "Attributes")):
            try:
                value = client.request("Series/" + s["code"] + "/" + suffix)
                if not isinstance(value, list):
                    raise SDGError("invalid_response", "Expected a metadata array.")
                info[field] = value
            except SDGError as exc:
                info[field] = None
                errors.append({"series": s["code"], "field": field, **exc.as_dict()})
        info["units"] = [a for a in info.get("attributes") or [] if a.get("id", "").casefold() == "units"]
        details.append(info)
    return {"status": "ok", "indicator": indicator, "series": details, "metadata_errors": errors,
            "metadata_repository": "https://unstats.un.org/sdgs/metadata/",
            "note": "Descriptions are catalogue labels, not full definitions. Available years depend on area, series and disaggregation; inspect retrieval coverage.",
            "requests": client.trace}
