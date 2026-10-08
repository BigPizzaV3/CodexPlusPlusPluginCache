"""Validate explicit handoff records; never infer provenance from free text."""
import argparse
import json
from pathlib import Path

LABELS = {"fact", "inference", "assumption", "hypothesis", "narrative", "missing_evidence"}


def validate(context, previous=None):
    errors = []
    if not isinstance(context, dict):
        return ["Handoff must be an object"]
    for field in ("claims", "sources", "options", "open_questions"):
        if not isinstance(context.get(field), list):
            errors.append(f"{field} must be an array")
    if errors:
        return errors
    indexes = {}
    for field in ("claims", "sources", "options"):
        indexes[field] = {}
        for item in context[field]:
            if not isinstance(item, dict) or not isinstance(item.get("id"), str) or not item["id"]:
                errors.append(f"{field}: each record needs a nonempty string id")
                continue
            if item["id"] in indexes[field]:
                errors.append(f"{field}: duplicate id {item['id']}")
            indexes[field][item["id"]] = item
    for claim in indexes["claims"].values():
        label = claim.get("classification")
        refs = claim.get("source_ids")
        if label not in LABELS:
            errors.append(f"{claim['id']}: invalid classification")
        if not isinstance(claim.get("text"), str) or not claim["text"].strip():
            errors.append(f"{claim['id']}: missing text")
        if claim.get("confidence") not in ("low", "medium", "high", "unknown"):
            errors.append(f"{claim['id']}: invalid qualitative confidence")
        if not isinstance(refs, list) or any(not isinstance(ref, str) for ref in refs):
            errors.append(f"{claim['id']}: source_ids must be string array")
        elif any(ref not in indexes["sources"] for ref in refs):
            errors.append(f"{claim['id']}: unknown source reference")
        elif label == "fact" and not refs:
            errors.append(f"{claim['id']}: fact requires a source")
    if previous is not None:
        prior_errors = validate(previous)
        if prior_errors:
            return errors + ["Invalid previous handoff: " + item for item in prior_errors]
        for source in previous["sources"]:
            if indexes["sources"].get(source["id"]) != source:
                errors.append(f"{source['id']}: historical source lineage changed or removed")
        for prior in previous["claims"]:
            current = indexes["claims"].get(prior["id"])
            if current is None:
                errors.append(f"{prior['id']}: historical claim removed")
            elif any(current.get(key) != prior.get(key) for key in
                     ("text", "classification", "source_ids", "confidence")):
                errors.append(f"{prior['id']}: historical claim changed; append a superseding claim instead")
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True)
    parser.add_argument("--previous")
    args = parser.parse_args()
    try:
        context = json.loads(Path(args.input).read_text(encoding="utf-8"))
        previous = json.loads(Path(args.previous).read_text(encoding="utf-8")) if args.previous else None
        errors = validate(context, previous)
    except (ValueError, OSError) as exc:
        errors = [str(exc)]
    print(json.dumps({"valid": not errors, "errors": errors}))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
