#!/usr/bin/env python3
"""Check structural meme briefs without scoring creativity or claiming virality."""
import argparse
import json
import re
import sys
from datetime import date
from pathlib import Path

FORMS = {"reaction_still", "original_scene", "template", "screenshot",
         "staged_chat", "ui_mock", "object_label", "comparison", "multi_panel",
         "text_led", "video", "visual_only"}
RELATIONS = {"reaction", "dialogue", "understatement", "literalization",
             "labeling", "contrast", "delayed_reveal", "intentional_echo",
             "none", "text_free"}
BRAND_ROLES = {"none", "prop", "character", "product_forward"}
SOURCES = {"original", "licensed", "user_supplied", "unverified_reference"}
PROVENANCE = {"observed", "brief_supplied", "researched", "illustrative"}
RATIOS = {"1:1", "4:5", "9:16", "16:9"}
FRESHNESS = {"evergreen", "verified_recent", "unknown"}
PROMO = re.compile(r"(https?://|www[.]|#[\w]+|\b(?:buy now|order now|sign up|click here)\b|(?:اطلب الآن|اشتر الآن|سجل الآن|اضغط هنا))", re.I)


def check(data):
    errors = []
    if not isinstance(data, dict) or data.get("skill") != "meme-marketing":
        return ["root.skill must be meme-marketing"]
    memes = data.get("memes")
    if not isinstance(memes, list) or not memes:
        return ["root.memes must be a nonempty list"]
    captions = set()
    signatures = set()
    for number, meme in enumerate(memes, 1):
        p = f"memes[{number}]"
        if not isinstance(meme, dict):
            errors.append(f"{p}: expected object")
            continue
        for key in ("moment", "emotion", "humor_mechanism", "form",
                    "image_text_relation", "caption", "on_image_text", "brand_role"):
            if not isinstance(meme.get(key), str):
                errors.append(f"{p}.{key}: expected string")
        for key in ("moment", "emotion", "humor_mechanism", "form", "image_text_relation", "caption"):
            if not isinstance(meme.get(key), str) or not meme[key].strip():
                errors.append(f"{p}.{key}: cannot be blank")
        for key, allowed in (("form", FORMS), ("image_text_relation", RELATIONS),
                             ("brand_role", BRAND_ROLES)):
            if meme.get(key) not in allowed:
                errors.append(f"{p}.{key}: unknown value")
        audience = meme.get("audience")
        if not isinstance(audience, dict) or any(
            not isinstance(audience.get(k), str) or not audience[k].strip()
            for k in ("role", "context", "market", "send_to")
        ):
            errors.append(f"{p}.audience: missing role/context/market/send_to")
        caption = meme.get("caption", "")
        image = meme.get("on_image_text", "")
        relation = meme.get("image_text_relation")
        if isinstance(caption, str):
            normalized = " ".join(caption.lower().split())
            if normalized in captions:
                errors.append(f"{p}.caption: repeated copy in batch")
            captions.add(normalized)
        if isinstance(image, str):
            if PROMO.search(image):
                errors.append(f"{p}.on_image_text: promotional element")
            if image.strip() and isinstance(caption, str) and image.strip().casefold() == caption.strip().casefold():
                errors.append(f"{p}.on_image_text: repeats caption exactly")
            if not image.strip() and relation not in ("none", "text_free"):
                errors.append(f"{p}.image_text_relation: missing image text")
            if image.strip() and relation in ("none", "text_free"):
                errors.append(f"{p}.image_text_relation: text-free mode includes text")
        moment_value = meme.get("moment")
        signature = (moment_value.strip().casefold() if isinstance(moment_value, str) else "", meme.get("humor_mechanism"))
        if signature in signatures:
            errors.append(f"{p}: duplicate moment and humor mechanism")
        signatures.add(signature)
        visual = meme.get("visual")
        if not isinstance(visual, dict):
            errors.append(f"{p}.visual: expected object")
        else:
            for key in ("primary", "fallback", "description"):
                if not isinstance(visual.get(key), str) or not visual[key].strip():
                    errors.append(f"{p}.visual.{key}: missing")
            if visual.get("source") not in SOURCES:
                errors.append(f"{p}.visual.source: invalid")
            if visual.get("primary") == visual.get("fallback"):
                errors.append(f"{p}.visual.fallback: must differ from primary")
            fresh = visual.get("freshness")
            if not isinstance(fresh, dict) or fresh.get("status") not in FRESHNESS:
                errors.append(f"{p}.visual.freshness: invalid")
            elif fresh.get("status") == "verified_recent":
                stamp = fresh.get("verified_at")
                try:
                    checked = date.fromisoformat(stamp)
                    if checked > date.today():
                        errors.append(f"{p}.visual.freshness.verified_at: cannot be in the future")
                except (TypeError, ValueError):
                    errors.append(f"{p}.visual.freshness.verified_at: expected ISO date")
        design = meme.get("design")
        if not isinstance(design, dict):
            errors.append(f"{p}.design: expected object")
        else:
            if design.get("ratio") not in RATIOS:
                errors.append(f"{p}.design.ratio: unsupported")
            for key in ("text_position", "palette"):
                if not isinstance(design.get(key), str) or not design[key].strip():
                    errors.append(f"{p}.design.{key}: missing")
            logo = design.get("logo")
            if not isinstance(logo, dict) or logo.get("variant") not in ("light", "dark", "none"):
                errors.append(f"{p}.design.logo.variant: unsupported")
            elif not isinstance(logo.get("placement"), str):
                errors.append(f"{p}.design.logo.placement: expected string")
        evidence = meme.get("evidence")
        if not isinstance(evidence, dict) or evidence.get("provenance") not in PROVENANCE:
            errors.append(f"{p}.evidence.provenance: missing or invalid")
        elif not isinstance(evidence.get("receipt"), str):
            errors.append(f"{p}.evidence.receipt: expected string")
        for key in ("alternatives", "risk_notes"):
            if not isinstance(meme.get(key), list) or any(not isinstance(item, str) for item in meme[key]):
                errors.append(f"{p}.{key}: expected array of strings")
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("file", type=Path, help="JSON batch to validate")
    args = parser.parse_args()
    try:
        data = json.loads(args.file.read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        print(f"Cannot read batch: {error}", file=sys.stderr)
        return 2
    errors = check(data)
    if errors:
        for error in errors:
            print(f"FAIL {error}")
        return 1
    print(f"PASS: {len(data['memes'])} structurally valid meme spec(s); creativity and rights require review")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
