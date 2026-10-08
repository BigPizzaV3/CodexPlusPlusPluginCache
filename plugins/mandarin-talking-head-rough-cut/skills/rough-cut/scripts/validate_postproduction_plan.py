#!/usr/bin/env python3
"""校验通用口播模块化后期计划。

只检查计划结构、时间、模块依赖、字幕让位、素材归因和基础冲突；
不修改任何音视频文件。
"""

import argparse
import json
import sys
from pathlib import Path


FOUNDATION = {"topic", "captions", "identity", "voice"}
EVENT_MODULES = {
    "hook-intro",
    "shot-state",
    "chapter-card",
    "chapter-nav",
    "cumulative-flower",
    "claim-flower",
    "keyword-emphasis",
    "semantic-icon",
    "broll-evidence",
    "story-portal",
    "quote-simulation",
    "cta",
    "sfx-cue",
}
FLOWER_MODULES = {"chapter-card", "cumulative-flower", "claim-flower"}
MAJOR_MODULES = {
    "hook-intro",
    "chapter-card",
    "cumulative-flower",
    "claim-flower",
    "semantic-icon",
    "broll-evidence",
    "story-portal",
    "quote-simulation",
    "cta",
}
REGION_DEFAULTS = {
    "chapter-card": "center",
    "cumulative-flower": "caption-zone",
    "claim-flower": "caption-zone",
    "semantic-icon": "subject-side",
    "broll-evidence": "lower-media",
    "story-portal": "full-frame",
    "quote-simulation": "full-frame",
}
SERIOUS_PROFILES = {"serious-commentary", "structured-knowledge"}
LIGHT_MOODS = {"happy", "playful", "upbeat", "light-cheerful", "轻快", "欢快"}


def issue(bucket, code, message, event_id=None):
    item = {"code": code, "message": message}
    if event_id:
        item["event_id"] = event_id
    bucket.append(item)


def interval(ev):
    if "start" not in ev or "end" not in ev:
        return None
    try:
        return float(ev["start"]), float(ev["end"])
    except (TypeError, ValueError):
        return None


def overlaps(a, b):
    return min(a[1], b[1]) - max(a[0], b[0]) > 0.08


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("plan")
    ap.add_argument("--json", action="store_true", help="以 JSON 输出检查结果")
    args = ap.parse_args()

    path = Path(args.plan)
    try:
        plan = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        sys.exit(f"计划读取失败：{exc}")

    errors, warnings = [], []
    if not isinstance(plan, dict):
        sys.exit("计划根节点必须是 JSON object")

    profile = plan.get("profile")
    if profile not in {
        "serious-commentary",
        "structured-knowledge",
        "light-leadgen",
        "story-quote",
        "custom",
    }:
        issue(errors, "invalid-profile", "profile 不在规范支持的预设中")

    duration = plan.get("duration")
    if duration is not None:
        try:
            duration = float(duration)
            if duration <= 0:
                raise ValueError
        except (TypeError, ValueError):
            issue(errors, "invalid-duration", "duration 必须是正数秒")
            duration = None

    modules = plan.get("modules") or {}
    foundation = modules.get("foundation") or {}
    missing = sorted(m for m in FOUNDATION if m not in foundation)
    if missing:
        issue(errors, "missing-foundation", f"缺少基础模块：{', '.join(missing)}")

    topic = foundation.get("topic") or {}
    if not topic.get("lines"):
        issue(errors, "missing-topic", "topic.lines 不能为空")
    if len(topic.get("lines") or []) > 2:
        issue(errors, "topic-too-many-lines", "顶部主题最多两行")

    captions = foundation.get("captions") or {}
    if captions.get("max_chars_soft", 8) > 10:
        issue(warnings, "caption-reading-load", "字幕软字数超过 10，需人工检查阅读负担")

    identity = foundation.get("identity") or {}
    spans = identity.get("spans") or []
    for i, span in enumerate(spans):
        if not isinstance(span, list) or len(span) != 2:
            issue(errors, "invalid-identity-span", f"identity.spans[{i}] 必须为 [start,end]")
            continue
        try:
            aa, bb = map(float, span)
        except (TypeError, ValueError):
            issue(errors, "invalid-identity-span", f"identity.spans[{i}] 时间不是数字")
            continue
        if bb <= aa:
            issue(errors, "invalid-identity-span", f"identity.spans[{i}] 结束时间必须晚于开始")
        if duration and (aa < 0 or bb > duration + 0.05):
            issue(errors, "identity-out-of-range", f"identity.spans[{i}] 超出视频时长")

    events = plan.get("events")
    if not isinstance(events, list):
        issue(errors, "missing-events", "events 必须是数组")
        events = []

    ids = set()
    timed = []
    for index, ev in enumerate(events):
        if not isinstance(ev, dict):
            issue(errors, "invalid-event", f"events[{index}] 必须是 object")
            continue
        eid = str(ev.get("id") or f"events[{index}]")
        if eid in ids:
            issue(errors, "duplicate-event-id", f"重复事件 id：{eid}", eid)
        ids.add(eid)

        module = ev.get("module")
        if module not in EVENT_MODULES:
            issue(errors, "invalid-module", f"未知事件模块：{module}", eid)

        if not ev.get("trigger_text"):
            issue(errors, "missing-trigger", "缺少 trigger_text，不能只按秒数设计", eid)
        if not ev.get("reason"):
            issue(errors, "missing-reason", "缺少 reason，无法解释为什么使用效果", eid)
        if ev.get("confidence") not in {"default", "conditional", "candidate"}:
            issue(errors, "invalid-confidence", "confidence 必须为 default/conditional/candidate", eid)

        iv = interval(ev)
        if iv:
            aa, bb = iv
            if bb <= aa:
                issue(errors, "invalid-event-time", "end 必须晚于 start", eid)
            if aa < 0 or (duration and bb > duration + 0.05):
                issue(errors, "event-out-of-range", "事件时间超出视频范围", eid)
            timed.append((ev, iv))
        elif "start" in ev or "end" in ev:
            issue(errors, "invalid-event-time", "start/end 必须同时存在且为数字", eid)

        if module in FLOWER_MODULES:
            policy = ev.get("caption_policy")
            if policy != "hide":
                issue(errors, "flower-caption-conflict", "花字必须设置 caption_policy=hide", eid)
            text = ev.get("text") or {}
            if not text.get("content") and not text.get("items"):
                issue(errors, "flower-missing-text", "花字缺少 content 或 items", eid)

        if module == "broll-evidence":
            media = ev.get("media") or {}
            if not media.get("source_credit"):
                issue(errors, "broll-missing-credit", "第三方 B-roll 必须提供 source_credit", eid)
            if not media.get("file") and not media.get("status"):
                issue(warnings, "broll-missing-asset", "B-roll 尚未绑定素材文件", eid)

        if module == "semantic-icon":
            visual = ev.get("visual") or {}
            allowed_status = {"procedural", "requires-asset", "renderer-pending"}
            if (
                not visual.get("asset")
                and not visual.get("generator")
                and visual.get("status") not in allowed_status
            ):
                issue(
                    warnings,
                    "icon-source-undefined",
                    "语义图形需声明 generator、asset 或 procedural/requires-asset 状态",
                    eid,
                )

        if module == "quote-simulation" and ev.get("confidence") != "candidate":
            issue(errors, "quote-evidence-limit", "角色模拟目前证据不足，只能标 candidate", eid)

        if module == "sfx-cue":
            audio = ev.get("audio") or {}
            if not audio.get("resource_name") and not audio.get("category"):
                issue(errors, "sfx-missing-source", "音效必须给 resource_name 或 category", eid)

    # 同一区域的两个主要视觉模块不应大面积重叠。
    for i, (a, ia) in enumerate(timed):
        ma = a.get("module")
        if ma not in MAJOR_MODULES:
            continue
        ra = (a.get("visual") or {}).get("region") or REGION_DEFAULTS.get(ma)
        for b, ib in timed[i + 1:]:
            mb = b.get("module")
            if mb not in MAJOR_MODULES:
                continue
            rb = (b.get("visual") or {}).get("region") or REGION_DEFAULTS.get(mb)
            if ra and rb and ra == rb and overlaps(ia, ib):
                issue(
                    warnings,
                    "visual-region-overlap",
                    f"{a.get('id')} 与 {b.get('id')} 在 {ra} 区域重叠",
                )

    audio = modules.get("audio") or {}
    bgm = audio.get("bgm") or {}
    if bgm.get("enabled"):
        for key in ("file", "mood", "fit_reason"):
            if not bgm.get(key):
                issue(errors, "bgm-missing-rationale", f"启用 BGM 时缺少 {key}")
        if profile in SERIOUS_PROFILES and str(bgm.get("mood", "")).lower() in LIGHT_MOODS:
            issue(errors, "bgm-style-mismatch", "严肃/知识型视频不得默认使用轻快或欢快 BGM")

    if duration:
        major_count = sum(1 for ev in events if ev.get("module") in MAJOR_MODULES)
        per_min = major_count / (duration / 60)
        limit = 8.0 if profile == "light-leadgen" else 6.0
        if per_min > limit:
            issue(
                warnings,
                "effect-density-high",
                f"主要效果密度约 {per_min:.1f}/分钟，高于预设建议 {limit:.1f}/分钟",
            )

    result = {
        "plan": str(path.resolve()),
        "valid": not errors,
        "errors": errors,
        "warnings": warnings,
        "summary": {
            "events": len(events),
            "errors": len(errors),
            "warnings": len(warnings),
        },
    }
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        mark = "✓" if not errors else "✗"
        print(f"{mark} 后期计划：{path}")
        print(f"  事件 {len(events)}，错误 {len(errors)}，提醒 {len(warnings)}")
        for item in errors:
            print(f"  ERROR [{item['code']}] {item['message']}")
        for item in warnings:
            print(f"  WARN  [{item['code']}] {item['message']}")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
