#!/usr/bin/env python3
"""Validate a machine-readable Email Love Figma QA snapshot.

Fail-closed contract: a measurement that is missing, mistyped, negative, or
non-finite is a validation error, never a silent zero. Passing here is
SNAPSHOT validation only; production acceptance still requires the recorded
desktop and mobile render evidence.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


ALLOWED_STATES = {
    "complete",
    "canvas and structure ready, exporter verification deferred",
    "batch rejected, repair required",
    "audit incomplete, missing source authority",
}
ALLOWED_RISKS = {
    "photo-crop",
    "grouped-icon-text",
    "multi-column-properties",
    "footer-social",
}
PARITY_KEYS = {
    "content",
    "order",
    "crop",
    "type",
    "color",
    "spacing",
    "desktop",
    "mobileIntent",
}
# Documented render-contract exceptions a snapshot may cite for an unequal
# auto-layout axis pair. Anything else counts as an unintended mismatch.
ALLOWED_AXIS_REASONS = {"top-aligned-multi-column"}
NOTE = ("Snapshot validation only; production acceptance still requires the "
        "recorded desktop and mobile render evidence.")


@dataclass(frozen=True)
class Issue:
    severity: str
    code: str
    location: str
    message: str


def is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def validate(snapshot: dict[str, Any]) -> list[Issue]:
    issues: list[Issue] = []

    def add(severity: str, code: str, location: str, message: str) -> None:
        issues.append(Issue(severity, code, location, message))

    def measured(container: dict[str, Any], field: str, location: str,
                 minimum: float | None = 0.0) -> float | None:
        """A required numeric measurement. Missing or malformed fails closed."""
        value = container.get(field)
        if not is_number(value):
            add("error", "UNKNOWN_MEASUREMENT", f"{location}.{field}",
                f"Measurement is missing or not a finite number: {value!r}.")
            return None
        if minimum is not None and value < minimum:
            add("error", "MEASUREMENT_NEGATIVE", f"{location}.{field}",
                f"Measurement must be at least {minimum:g}, found {value:g}.")
            return None
        return float(value)

    def string_list(container: dict[str, Any], field: str, location: str) -> list[str] | None:
        value = container.get(field)
        if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
            add("error", "LIST_TYPE_INVALID", f"{location}.{field}",
                "Expected an array of strings.")
            return None
        return value

    batch = snapshot.get("batch")
    modules = snapshot.get("modules")
    if not isinstance(batch, dict):
        add("error", "BATCH_MISSING", "batch", "Expected a batch object.")
        batch = {}
    if not isinstance(modules, list):
        add("error", "MODULES_MISSING", "modules", "Expected a modules array.")
        modules = []

    phase = batch.get("phase")
    if phase not in {"proof", "normal"}:
        add("error", "PHASE_INVALID", "batch.phase", "Use 'proof' or 'normal'.")
    if phase in {"proof", "normal"} and len(modules) == 0:
        add("error", "MODULES_EMPTY", "modules",
            "A migration acceptance batch needs at least one measured module; "
            "an empty list is absent evidence, not a pass.")
    if phase == "proof" and len(modules) > 4:
        add("error", "PROOF_TOO_LARGE", "modules", "A proof batch may contain at most four modules.")
    if phase == "normal" and batch.get("proofBatchAccepted") is not True:
        add("error", "PROOF_NOT_ACCEPTED", "batch.proofBatchAccepted", "A normal batch requires an accepted proof batch.")

    if phase == "proof":
        present = string_list(batch, "riskClassesPresent", "batch")
        covered = string_list(batch, "proofRisksCovered", "batch")
        if present is not None and covered is not None:
            unknown = (set(present) | set(covered)) - ALLOWED_RISKS
            if unknown:
                add("error", "PROOF_RISK_INVALID", "batch", f"Unknown risk classes: {sorted(unknown)}")
            missing = set(present) - set(covered)
            if missing:
                add("error", "PROOF_RISK_UNCOVERED", "batch.proofRisksCovered", f"Proof batch does not cover: {sorted(missing)}")

    viewports = batch.get("mobileViewports")
    if not isinstance(viewports, list) or not viewports or not all(is_number(v) and v > 0 for v in viewports):
        add("error", "VIEWPORTS_INVALID", "batch.mobileViewports", "Provide one or more positive mobile viewport widths.")
        viewports = []

    state = batch.get("statusClaim")
    if state not in ALLOWED_STATES:
        add("error", "STATUS_INVALID", "batch.statusClaim", "Use one of the quality-gate completion states.")
    exporter = batch.get("exporter") if isinstance(batch.get("exporter"), dict) else {}
    desktop = exporter.get("desktop")
    mobile = exporter.get("mobile")
    for channel, value in (("desktop", desktop), ("mobile", mobile)):
        if value not in {"pass", "fail", "deferred"}:
            add("error", "EXPORT_STATUS_INVALID", f"batch.exporter.{channel}", "Use pass, fail, or deferred.")
    if state == "complete" and (desktop != "pass" or mobile != "pass"):
        add("error", "COMPLETE_WITHOUT_EXPORT", "batch.statusClaim", "Complete requires desktop and mobile production passes.")
    if "fail" in {desktop, mobile} and state != "batch rejected, repair required":
        add("error", "FAILED_EXPORT_NOT_REJECTED", "batch.statusClaim", "A failed production render requires batch rejection.")
    if state == "canvas and structure ready, exporter verification deferred" and desktop == mobile == "pass":
        add("warning", "STALE_DEFERRED_STATUS", "batch.statusClaim", "Both production renders pass; update the status after remaining gates pass.")

    for index, module in enumerate(modules):
        loc = f"modules[{index}]"
        if not isinstance(module, dict):
            add("error", "MODULE_INVALID", loc, "Expected an object.")
            continue
        name = module.get("name") or f"module {index + 1}"
        mloc = f"{loc} ({name})"

        if not str(module.get("sourceRef") or "").strip():
            add("error", "SOURCE_MISSING", f"{mloc}.sourceRef", "Record the exact source authority.")
        parity = module.get("sourceParity")
        if not isinstance(parity, dict):
            add("error", "PARITY_MISSING", f"{mloc}.sourceParity", "Record every source-parity dimension.")
        else:
            for key in sorted(PARITY_KEYS):
                if parity.get(key) is not True:
                    add("error", "PARITY_FAILED", f"{mloc}.sourceParity.{key}", "Parity is missing or did not pass.")

        structure = module.get("structure")
        if not isinstance(structure, dict):
            add("error", "STRUCTURE_MISSING", f"{mloc}.structure", "Record measured structure results.")
            structure = {}
        artifact_kind = module.get("artifactKind", "module")
        root_tag = structure.get("rootTag", "")
        node_type = structure.get("nodeType", "")
        if artifact_kind == "module":
            if root_tag != "mj-wrapper" or node_type not in {"", None}:
                add("error", "MODULE_ROOT_INVALID", f"{mloc}.structure", "A module is an mj-wrapper with no nodeType marker.")
            if structure.get("directPageChild") is not True:
                add("error", "MODULE_NOT_PAGE_CHILD", f"{mloc}.structure.directPageChild", "A module root must be a direct page child.")
        elif artifact_kind == "email":
            if root_tag not in {"", None} or node_type != "mainFrame":
                add("error", "EMAIL_ROOT_INVALID", f"{mloc}.structure", "An email root has mainFrame and no MJML tag.")
            theme_keys = measured(structure, "themeKeyCount", f"{mloc}.structure")
            if theme_keys is not None and theme_keys < 9:
                add("error", "EMAIL_THEME_KEYS", f"{mloc}.structure.themeKeyCount", "An email root needs all nine root keys.")
            if structure.get("directChildrenAllWrappers") is not True:
                add("error", "EMAIL_CHILDREN_INVALID", f"{mloc}.structure", "An email root's direct children must all be wrappers.")
        else:
            add("error", "ARTIFACT_KIND_INVALID", f"{mloc}.artifactKind", "Use module or email.")

        for field, code in (
            ("untaggedFrameCount", "UNTAGGED_FRAMES"),
            ("unknownTagCount", "UNKNOWN_TAGS"),
            ("incompleteLeafPairCount", "INCOMPLETE_LEAVES"),
            ("unintendedFixedHeightCount", "FIXED_HEIGHTS"),
        ):
            value = measured(structure, field, f"{mloc}.structure")
            if value is not None and value != 0:
                add("error", code, f"{mloc}.structure.{field}", f"Expected 0, found {value:g}.")

        # Unequal auto-layout axes: a documented render-contract exception
        # (e.g. top-aligned multi-column content) may be cited per node.
        # Only UNDOCUMENTED mismatches fail.
        unequal_axes = measured(structure, "unequalAxisCount", f"{mloc}.structure")
        axis_exceptions = structure.get("axisExceptions", [])
        valid_exceptions = 0
        if not isinstance(axis_exceptions, list):
            add("error", "AXIS_EXCEPTIONS_INVALID", f"{mloc}.structure.axisExceptions", "Expected an array.")
        else:
            for exception_index, exception in enumerate(axis_exceptions):
                eloc = f"{mloc}.structure.axisExceptions[{exception_index}]"
                if (not isinstance(exception, dict)
                        or not str(exception.get("node") or "").strip()
                        or exception.get("reason") not in ALLOWED_AXIS_REASONS):
                    add("error", "AXIS_EXCEPTION_INVALID", eloc,
                        f"Each exception needs a node and a documented reason from {sorted(ALLOWED_AXIS_REASONS)}.")
                else:
                    valid_exceptions += 1
        if unequal_axes is not None and unequal_axes > valid_exceptions:
            add("error", "UNEQUAL_AXES", f"{mloc}.structure.unequalAxisCount",
                f"{unequal_axes:g} unequal axis pair(s) but only {valid_exceptions} documented exception(s); "
                "undocumented mismatches are defects.")

        # Inventories are REQUIRED, even when audited empty: an omitted array
        # is absent evidence and fails closed. The census cross-check keeps an
        # empty array from concealing real content.
        census = module.get("census")
        if not isinstance(census, dict):
            add("error", "CENSUS_MISSING", f"{mloc}.census",
                "Record the independently measured node census: images, groups, properties counts.")
            census = {}

        inventories: dict[str, list[Any]] = {}
        for field in ("images", "groups", "properties"):
            value = module.get(field)
            if not isinstance(value, list):
                add("error", "INVENTORY_MISSING", f"{mloc}.{field}",
                    "Inventory array is required, even when audited empty; an omitted array is absent evidence.")
                inventories[field] = []
                continue
            inventories[field] = value
            expected = measured(census, field, f"{mloc}.census") if isinstance(census, dict) else None
            if expected is not None and int(expected) != len(value):
                add("error", "CENSUS_MISMATCH", f"{mloc}.{field}",
                    f"Census counted {int(expected)} {field} but the snapshot records {len(value)}.")

        for image_index, image in enumerate(inventories["images"]):
            iloc = f"{mloc}.images[{image_index}]"
            if not isinstance(image, dict):
                add("error", "IMAGE_INVALID", iloc, "Expected an object.")
                continue
            meaningful = image.get("meaningful", True)
            if image.get("fillType") != "IMAGE":
                add("error", "IMAGE_FILL_INVALID", f"{iloc}.fillType", "A meaningful image must use an IMAGE fill.")
            if not str(image.get("imageHash") or "").strip():
                add("error", "IMAGE_HASH_MISSING", f"{iloc}.imageHash", "Read back a non-empty image hash.")
            if meaningful and not str(image.get("altText") or "").strip():
                add("error", "ALT_TEXT_MISSING", f"{iloc}.altText", "Meaningful imagery needs alt text.")

            rw = measured(image, "rectWidth", iloc)
            rh = measured(image, "rectHeight", iloc)
            aw = measured(image, "assetWidth", iloc)
            ah = measured(image, "assetHeight", iloc)
            if None in (rw, rh, aw, ah):
                continue
            if min(rw, rh, aw, ah) <= 0:
                add("error", "IMAGE_GEOMETRY_INVALID", iloc, "Rectangle and asset dimensions must be positive.")
            else:
                rect_ratio, asset_ratio = rw / rh, aw / ah
                ratio_drift = abs(rect_ratio - asset_ratio) / asset_ratio
                if not image.get("cropApproved", False) and ratio_drift > 0.02:
                    add("error", "IMAGE_ASPECT_MISMATCH", iloc, f"Rectangle/asset aspect ratios drift by {ratio_drift:.1%} without an approved crop.")
                if image.get("role") in {"icon", "social"} and not image.get("nonSquareApproved", False):
                    if abs(rect_ratio - 1.0) > 0.02:
                        add("error", "ICON_NOT_SQUARE", iloc, "Icon rectangle is not square and has no exception.")

        for group_index, group in enumerate(inventories["groups"]):
            gloc = f"{mloc}.groups[{group_index}]"
            if not isinstance(group, dict):
                add("error", "GROUP_INVALID", gloc, "Expected an object.")
                continue
            group_width = measured(group, "width", gloc)
            columns = group.get("columns")
            if group_width is None or group_width <= 0 or not isinstance(columns, list) or len(columns) < 2:
                add("error", "GROUP_GEOMETRY_INVALID", gloc, "A group needs a positive width and at least two columns.")
                continue

            column_widths: list[float] = []
            columns_ok = True
            for column_index, column in enumerate(columns):
                if not isinstance(column, dict):
                    add("error", "COLUMN_INVALID", f"{gloc}.columns[{column_index}]", "Expected an object.")
                    columns_ok = False
                    continue
                width = measured(column, "width", f"{gloc}.columns[{column_index}]")
                if width is None:
                    columns_ok = False
                else:
                    column_widths.append(width)

            # A fixed bordered group may reserve documented headroom (per the
            # render contract): columns then sum SHORT of the outer width by
            # exactly the declared amount. An unexplained gap is a defect.
            headroom = 0.0
            if "borderHeadroom" in group:
                declared = measured(group, "borderHeadroom", gloc)
                if declared is not None:
                    headroom = declared
                    if headroom > 0 and not str(group.get("headroomReason") or "").strip():
                        add("error", "HEADROOM_UNDOCUMENTED", f"{gloc}.headroomReason",
                            "Declared border headroom needs a stated render-contract reason.")
            if columns_ok:
                column_sum = sum(column_widths)
                if abs(column_sum + headroom - group_width) > 0.5:
                    add("error", "GROUP_WIDTH_SUM", gloc,
                        f"Column widths total {column_sum:g} plus declared headroom {headroom:g} "
                        f"does not match group width {group_width:g}.")

            section_left = measured(group, "mobileSectionPaddingLeft", gloc)
            section_right = measured(group, "mobileSectionPaddingRight", gloc)
            if section_left is None or section_right is None:
                continue
            for viewport in viewports:
                mobile_content = float(viewport) - section_left - section_right
                if mobile_content <= 0:
                    add("error", "MOBILE_CONTENT_INVALID", gloc, f"Viewport {viewport:g}px has no positive content box.")
                    continue
                for column_index, column in enumerate(columns):
                    cloc = f"{gloc}.columns[{column_index}]@{viewport:g}px"
                    if not isinstance(column, dict):
                        continue
                    column_width = measured(column, "width", cloc)
                    pad_left = measured(column, "paddingLeft", cloc)
                    pad_right = measured(column, "paddingRight", cloc)
                    if None in (column_width, pad_left, pad_right):
                        continue
                    resolved = column_width / group_width * mobile_content
                    inner = resolved - pad_left - pad_right
                    if inner <= 0:
                        add("error", "MOBILE_INNER_INVALID", cloc, f"Resolved inner width is {inner:.2f}px.")
                        continue
                    content = column.get("content") if isinstance(column.get("content"), dict) else {}
                    kind = content.get("kind")
                    if kind == "image":
                        required = measured(content, "naturalWidth", cloc)
                        if required is None or required <= 0:
                            add("error", "IMAGE_NATURAL_WIDTH_MISSING", cloc, "Record the image's minimum natural display width.")
                        elif inner + 0.01 < required:
                            add("error", "MOBILE_IMAGE_TOO_NARROW", cloc, f"Inner width {inner:.2f}px is below image requirement {required:.2f}px.")
                    elif kind == "text":
                        required = measured(content, "longestUnbreakablePx", cloc)
                        if required is None or required <= 0:
                            add("error", "TEXT_WIDTH_MISSING", cloc, "Record the exported-font unbreakable width.")
                        elif inner + 0.01 < required:
                            add("error", "MOBILE_TEXT_TOO_NARROW", cloc, f"Inner width {inner:.2f}px is below text requirement {required:.2f}px.")
                    else:
                        add("warning", "GROUP_CONTENT_UNMEASURED", cloc, "Content kind is not image or text; disposition manually.")

        for property_index, prop in enumerate(inventories["properties"]):
            ploc = f"{mloc}.properties[{property_index}]"
            if not isinstance(prop, dict):
                add("error", "PROPERTY_INVALID", ploc, "Expected an object.")
                continue
            prop_type = prop.get("type")
            if prop_type not in {"TEXT", "BOOLEAN", "INSTANCE_SWAP", "VARIANT"}:
                add("error", "PROPERTY_TYPE_INVALID", f"{ploc}.type", "Use a Figma component-property type.")
            if not str(prop.get("evidence") or "").strip():
                add("error", "PROPERTY_EVIDENCE_MISSING", f"{ploc}.evidence", "Every property needs a stated use case.")
            binding_count = measured(prop, "bindingCount", ploc)
            if binding_count is not None and binding_count < 1:
                add("error", "PROPERTY_UNBOUND", f"{ploc}.bindingCount", "Read back at least one binding.")
            if prop_type == "BOOLEAN":
                if prop.get("hideScope") != "complete-region":
                    add("error", "BOOLEAN_SCOPE_INCOMPLETE", f"{ploc}.hideScope", "Bind the complete optional semantic region.")
                if prop.get("remainingLayoutComplete") is not True:
                    add("error", "BOOLEAN_FALSE_STATE_BROKEN", ploc, "The false state must leave a finished layout.")
                if prop.get("ancestorRequiredFixedColumn") is True:
                    add("error", "BOOLEAN_EMPTY_COLUMN_RISK", ploc, "The binding sits inside a required fixed column.")
            if prop_type == "TEXT":
                if prop.get("boilerplate") is True:
                    add("error", "TEXT_PROPERTY_BOILERPLATE", ploc, "Do not expose standing boilerplate as campaign copy.")
                if prop.get("linkBearing") is True:
                    add("error", "TEXT_PROPERTY_LINK_RISK", ploc, "Replacing this text can destroy its hyperlink.")

    return issues


def good_fixture() -> dict[str, Any]:
    return {
        "batch": {
            "name": "proof",
            "phase": "proof",
            "emailWidth": 600,
            "contentWidth": 520,
            "mobileViewports": [320, 375, 390],
            "riskClassesPresent": ["grouped-icon-text"],
            "proofRisksCovered": ["grouped-icon-text"],
            "proofBatchAccepted": True,
            "statusClaim": "complete",
            "exporter": {"desktop": "pass", "mobile": "pass"},
        },
        "modules": [{
            "id": "1:1",
            "name": "Safe icon row",
            "artifactKind": "module",
            "sourceRef": "source frame 1:2",
            "sourceParity": {key: True for key in PARITY_KEYS},
            "structure": {
                "rootTag": "mj-wrapper",
                "nodeType": "",
                "directPageChild": True,
                "untaggedFrameCount": 0,
                "unknownTagCount": 0,
                "incompleteLeafPairCount": 0,
                "unequalAxisCount": 0,
                "axisExceptions": [],
                "unintendedFixedHeightCount": 0,
            },
            "census": {"images": 1, "groups": 1, "properties": 1},
            "images": [{
                "name": "sparkle",
                "role": "icon",
                "meaningful": True,
                "fillType": "IMAGE",
                "imageHash": "hash",
                "scaleMode": "FILL",
                "rectWidth": 32,
                "rectHeight": 32,
                "assetWidth": 64,
                "assetHeight": 64,
                "cropApproved": False,
                "altText": "Odor filtration",
            }],
            "groups": [{
                "name": "feature row",
                "width": 520,
                "mobileSectionPaddingLeft": 40,
                "mobileSectionPaddingRight": 40,
                "columns": [
                    {"name": "icon", "width": 96, "paddingLeft": 0, "paddingRight": 10,
                     "content": {"kind": "image", "naturalWidth": 32}},
                    {"name": "text", "width": 424, "paddingLeft": 16, "paddingRight": 0,
                     "content": {"kind": "text", "longestUnbreakablePx": 90}},
                ],
            }],
            "properties": [{
                "name": "Show feature row",
                "type": "BOOLEAN",
                "evidence": "Source family contains a shorter version",
                "bindingCount": 1,
                "hideScope": "complete-region",
                "remainingLayoutComplete": True,
                "ancestorRequiredFixedColumn": False,
            }],
        }],
    }


def error_codes(snapshot: dict[str, Any]) -> set[str]:
    return {issue.code for issue in validate(snapshot) if issue.severity == "error"}


def self_test() -> int:
    failures: list[str] = []

    def expect(label: str, condition: bool) -> None:
        if not condition:
            failures.append(label)

    good_issues = validate(good_fixture())
    expect("good fixture passes", not any(issue.severity == "error" for issue in good_issues))

    bad = good_fixture()
    bad["batch"]["statusClaim"] = "complete"
    bad["batch"]["exporter"]["mobile"] = "deferred"
    module = bad["modules"][0]
    module["images"][0]["fillType"] = "SOLID"
    module["groups"][0]["columns"][0]["width"] = 72
    module["groups"][0]["columns"][1]["width"] = 448
    module["properties"][0]["hideScope"] = "leaf-only"
    module["properties"][0]["remainingLayoutComplete"] = False
    module["properties"][0]["ancestorRequiredFixedColumn"] = True
    expect("classic regression fixture fails with the expected codes", {
        "COMPLETE_WITHOUT_EXPORT",
        "IMAGE_FILL_INVALID",
        "MOBILE_IMAGE_TOO_NARROW",
        "BOOLEAN_SCOPE_INCOMPLETE",
        "BOOLEAN_FALSE_STATE_BROKEN",
        "BOOLEAN_EMPTY_COLUMN_RISK",
    }.issubset(error_codes(bad)))

    # Fail-closed regressions (2026-08-30 review, F2).
    empty = good_fixture()
    empty["modules"] = []
    expect("empty module list on a complete proof batch fails",
           "MODULES_EMPTY" in error_codes(empty))

    omitted = good_fixture()
    for field in ("images", "groups", "properties"):
        del omitted["modules"][0][field]
    codes = error_codes(omitted)
    expect("omitted inventories fail rather than defaulting empty",
           "INVENTORY_MISSING" in codes)

    concealed = good_fixture()
    concealed["modules"][0]["images"] = []
    expect("empty array contradicting the census fails",
           "CENSUS_MISMATCH" in error_codes(concealed))

    no_census = good_fixture()
    del no_census["modules"][0]["census"]
    expect("missing census fails", "CENSUS_MISSING" in error_codes(no_census))

    unknown_pad = good_fixture()
    unknown_pad["modules"][0]["groups"][0]["columns"][0]["width"] = 72
    unknown_pad["modules"][0]["groups"][0]["columns"][1]["width"] = 448
    unknown_pad["modules"][0]["groups"][0]["columns"][0]["paddingRight"] = "unknown"
    expect("unknown padding fails instead of becoming zero",
           "UNKNOWN_MEASUREMENT" in error_codes(unknown_pad))

    malformed_risk = good_fixture()
    malformed_risk["batch"]["riskClassesPresent"] = [{"class": "grouped-icon-text"}]
    try:
        expect("object in risk list is a structured error",
               "LIST_TYPE_INVALID" in error_codes(malformed_risk))
    except TypeError:
        failures.append("object in risk list raised instead of validating")

    # Documented render-contract exceptions (2026-08-30 review, F3).
    top_aligned = good_fixture()
    top_aligned["modules"][0]["structure"]["unequalAxisCount"] = 1
    top_aligned["modules"][0]["structure"]["axisExceptions"] = [
        {"node": "3:7 benefits columns", "reason": "top-aligned-multi-column"}]
    expect("documented top-aligned multi-column exception passes",
           "UNEQUAL_AXES" not in error_codes(top_aligned))

    undocumented_axis = good_fixture()
    undocumented_axis["modules"][0]["structure"]["unequalAxisCount"] = 1
    expect("undocumented unequal axis fails",
           "UNEQUAL_AXES" in error_codes(undocumented_axis))

    bordered = good_fixture()
    bordered["modules"][0]["groups"][0]["width"] = 522
    bordered["modules"][0]["groups"][0]["borderHeadroom"] = 2
    bordered["modules"][0]["groups"][0]["headroomReason"] = "fixed bordered group reserves 1px per side"
    expect("documented border headroom passes",
           "GROUP_WIDTH_SUM" not in error_codes(bordered))

    gap = good_fixture()
    gap["modules"][0]["groups"][0]["width"] = 522
    expect("unexplained width gap fails", "GROUP_WIDTH_SUM" in error_codes(gap))

    # The documented example must validate exactly as written, so the schema
    # reference cannot drift from the validator (2026-08-30 review, F2).
    schema_doc = Path(__file__).resolve().parent.parent / "references" / "snapshot-schema.md"
    expect("snapshot-schema.md is packaged beside the scripts", schema_doc.is_file())
    if schema_doc.is_file():
        text = schema_doc.read_text()
        try:
            fence = text.split("```json", 1)[1].split("```", 1)[0]
            example = json.loads(fence)
        except (IndexError, json.JSONDecodeError):
            failures.append("snapshot-schema.md example is not parseable JSON")
        else:
            example_errors = [issue for issue in validate(example) if issue.severity == "error"]
            if example_errors:
                for issue in example_errors:
                    print(f"  doc example: {issue.code} at {issue.location}", file=sys.stderr)
            expect("documented schema example validates unchanged", not example_errors)

    if failures:
        for failure in failures:
            print(f"self-test failed: {failure}", file=sys.stderr)
        return 1
    print("validate_batch_snapshot.py self-test passed")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("snapshot", nargs="?", type=Path)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        return self_test()
    if args.snapshot is None:
        parser.error("snapshot is required unless --self-test is used")
    try:
        snapshot = json.loads(args.snapshot.read_text())
    except (OSError, json.JSONDecodeError) as exc:
        print(json.dumps({"passed": False, "note": NOTE, "error": str(exc)}, indent=2))
        return 1
    if not isinstance(snapshot, dict):
        print(json.dumps({"passed": False, "note": NOTE, "error": "Top-level JSON must be an object."}, indent=2))
        return 1
    try:
        issues = validate(snapshot)
    except Exception as exc:  # malformed input must yield a structured error, not a traceback
        print(json.dumps({"passed": False, "note": NOTE,
                          "error": f"Snapshot could not be validated: {type(exc).__name__}: {exc}"}, indent=2))
        return 1
    errors = sum(issue.severity == "error" for issue in issues)
    warnings = sum(issue.severity == "warning" for issue in issues)
    print(json.dumps({
        "passed": errors == 0,
        "note": NOTE,
        "errors": errors,
        "warnings": warnings,
        "issues": [asdict(issue) for issue in issues],
    }, indent=2))
    return 0 if errors == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
