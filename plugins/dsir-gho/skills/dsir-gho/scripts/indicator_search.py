"""Catalogue-backed discovery and modest, auditable search expansion."""
from __future__ import annotations

import difflib
import json
import re
import unicodedata
from pathlib import Path
from gho_client import GHOClient, GHOError, BASE_URL, literal

METADATA = Path(__file__).resolve().parent.parent / "references" / "metadata"


def normalize(text):
    text = unicodedata.normalize("NFKD", str(text)).casefold()
    text = "".join(c for c in text if not unicodedata.combining(c))
    return " ".join(re.findall(r"[^\W_]+|%", text, flags=re.UNICODE))


def _load(name):
    return json.loads((METADATA / name).read_text(encoding="utf-8-sig"))


def basic_metadata(entry):
    code, name = entry["IndicatorCode"], entry["IndicatorName"]
    registry = _load("indicator_notes.json")
    note = registry["indicators"].get(code)
    if note and note["official_name"] == name:
        return {"definition": note["definition"], "unit": note["unit"], "type": note["type"],
                "metadata_source": note["source_url"], "metadata_reviewed_on": registry["reviewed_on"],
                "metadata_basis": "reviewed WHO metadata summary; not refreshed on each query"}
    unit, kind = None, None
    # Extract only explicit unit text, never infer a clinical denominator.
    matches = re.findall(r"\(([^()]*)\)", name)
    for item in matches:
        if item == "%":
            unit, kind = "%", "percentage"
        elif re.match(r"per\s+[\d ,]+", item, re.I):
            unit, kind = item, "rate"
        elif item in {"years", "millions"}:
            unit, kind = item, "years" if item == "years" else "count"
    if unit is None and "in US$" in name:
        unit, kind = "US$ per capita" if "per capita" in name else "US$", "currency"
    if unit is None and name.lower().startswith("number of "):
        unit, kind = name, "count"
    return {"definition": None, "unit": unit, "type": kind,
            "metadata_source": BASE_URL + "/Indicator(" + literal(code) + ")",
            "metadata_reviewed_on": None,
            "metadata_basis": "explicit official catalogue name" if unit else "not supplied by catalogue"}


def search_indicators(query, client=None, limit=10):
    if not isinstance(query, str) or not query.strip() or len(query) > 1000:
        raise GHOError("invalid_query", "Use a nonempty, short indicator search phrase.")
    if not isinstance(limit, int) or isinstance(limit, bool) or not 1 <= limit <= 100:
        raise GHOError("invalid_query", "Search limit must be from 1 to 100.")
    client = client or GHOClient()
    catalogue = client.catalogue()
    normalized = normalize(query)
    variants, notes = [normalized], []
    for alias in _load("indicator_aliases.json")["aliases"]:
        if normalized in [normalize(term) for term in alias["terms"]]:
            variants += [normalize(text) for text in alias["expansions"]]
            if alias.get("clarify"):
                notes.append(alias["clarify"])
    # Two token expansions are deliberately small; they do not select a code.
    expanded = re.sub(r"\btb\b", "tuberculosis", normalized)
    if expanded != normalized:
        variants.append(expanded)
    candidates = []
    for entry in catalogue:
        name, code = entry["IndicatorName"], entry["IndicatorCode"]
        target = normalize(name)
        score, reasons = 0.0, []
        if query.strip().casefold() == code.casefold():
            score, reasons = 1000.0, ["exact verified indicator code"]
        for variant in variants:
            tokens = variant.split()
            words = target.split()
            if variant == target:
                candidate_score, reason = 900.0, "exact official name"
            elif variant in target:
                candidate_score, reason = 800 + 40 * len(variant) / max(len(target), 1), "partial official name"
            elif tokens and all(token in words for token in tokens):
                candidate_score, reason = 650 + 80 * len(tokens) / max(len(words), 1), "all search keywords"
            else:
                ratios = [max((difflib.SequenceMatcher(None, token, word).ratio()
                               for word in words), default=0) for token in tokens]
                # Every token must match reasonably: prevents broad unrelated matches.
                candidate_score = 400 + 100 * sum(ratios) / len(ratios) if ratios and min(ratios) >= 0.76 else 0
                reason = "fuzzy keyword match; review before selection"
            if candidate_score > score:
                score, reasons = candidate_score, [reason]
        if score:
            meta = basic_metadata(entry)
            candidates.append({"code": code, "name": name, "language": entry.get("Language"),
                               "description": meta["definition"], "unit": meta["unit"], "type": meta["type"],
                               "metadata_source": meta["metadata_source"], "score": round(score, 3),
                               "relevance": reasons, "verified_in_catalogue": True})
    candidates.sort(key=lambda item: (-item["score"], len(item["name"]), item["code"]))
    return {"status": "ok" if candidates else "no_matches", "query": query,
            "expanded_queries": list(dict.fromkeys(variants)), "candidates": candidates[:limit],
            "total_matches": len(candidates), "selection_notes": notes,
            "catalogue_source": BASE_URL + "/Indicator", "catalogue_size": len(catalogue),
            "note": "Search rank is not a clinical decision. Check population, unit, method and dimensions."}


def describe_indicator(indicator_code, client=None):
    client = client or GHOClient()
    entry = client.confirm_indicator(indicator_code)
    code = entry["IndicatorCode"]
    declared = client.indicator_dimensions(code)
    fields = ["TimeDim", "SpatialDimType", "Dim1Type", "Dim1", "Dim2Type", "Dim2", "Dim3Type", "Dim3"]
    coverage = client.collection(code, {"$select": ",".join(fields), "$orderby": "Id"}, paged=True)
    rows = coverage["records"]
    years = sorted({r["TimeDim"] for r in rows if isinstance(r.get("TimeDim"), int)})
    observed = {}
    for number in range(1, 4):
        type_key, value_key = f"Dim{number}Type", f"Dim{number}"
        pairs = sorted({(str(r.get(type_key) or ""), str(r[value_key])) for r in rows if r.get(value_key) is not None})
        observed[value_key.lower()] = [{"type": t or None, "code": value} for t, value in pairs]
    return {"status": "ok", "code": code, "name": entry["IndicatorName"],
            **basic_metadata(entry), "available_dimensions": declared,
            "observed_dimension_values": observed, "available_years": years,
            "spatial_types": sorted({r["SpatialDimType"] for r in rows if r.get("SpatialDimType")}),
            "coverage_scope": "All observations for this indicator, before user filters; years need not be available in every location.",
            "observation_count": len(rows), "provenance": coverage["provenance"]}
