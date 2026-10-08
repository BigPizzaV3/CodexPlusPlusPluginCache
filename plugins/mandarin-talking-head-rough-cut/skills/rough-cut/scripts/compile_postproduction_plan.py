#!/usr/bin/env python3
"""把模块化总计划拆成现有渲染脚本可消费的子计划。

输出：
- brand_plan.json：顶部主题、人物头衔
- effect_plan.json：章节卡、观点花字、累积花字
- emphasis_plan.json：普通字幕关键词着色
- visual_plan.json：故事入口暗角、引语/角色模拟滤镜
- audio_plan.json：已绑定文件的 BGM/SFX
- postproduction_manifest.json：已编译模块和 renderer-pending 模块

本脚本不渲染媒体，不会把尚未支持的模块伪装成已执行。
"""

import argparse
import json
from pathlib import Path


COMPILED_EVENT_MODULES = {
    "chapter-card",
    "cumulative-flower",
    "claim-flower",
    "keyword-emphasis",
    "sfx-cue",
}


def write_json(path, data):
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def flower_event(ev, content, style, start, end, y, color=None):
    text = {
        "mode": "flower",
        "style": style,
        "content": content,
        "y": round(y, 4),
        "hide_captions": True,
    }
    if color:
        text["color"] = color
    return {
        "id": ev["id"],
        "type": ev.get("module"),
        "trigger_text": ev.get("trigger_text"),
        "start": round(float(start), 3),
        "end": round(float(end), 3),
        "text": text,
        "reason": ev.get("reason"),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("plan")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    plan_path = Path(args.plan)
    plan = json.loads(plan_path.read_text(encoding="utf-8"))
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    foundation = (plan.get("modules") or {}).get("foundation") or {}
    topic = foundation.get("topic") or {}
    identity = foundation.get("identity") or {}
    brand = {
        "style": topic.get("style", "headline-yellow"),
        "topic_lines": topic.get("lines", []),
        "start": float(topic.get("start", 0)),
        "end": float(topic.get("end", plan.get("duration", 999))),
    }
    if topic.get("colors"):
        brand["topic_colors"] = topic["colors"]
    elif topic.get("style") == "topic-two-tone":
        brand["topic_colors"] = ["#FFFFFF", "#FFE100"]
    for key in ("title_font", "title_slant", "title_y"):
        if key in topic:
            brand[key] = topic[key]
    if identity.get("name"):
        brand["identity"] = {
            key: value for key, value in identity.items()
            if key not in {"status"}
        }

    effect_events = []
    emphasis = []
    audio_sfx = []
    visual_events = []
    compiled = []
    pending = []

    for ev in plan.get("events", []):
        module = ev.get("module")
        eid = ev.get("id", "unnamed")
        if module == "chapter-card":
            text = ev.get("text") or {}
            content = text.get("content")
            if content and "start" in ev and "end" in ev:
                effect_events.append(flower_event(
                    ev, content, "chapter", ev["start"], ev["end"],
                    float(text.get("y", 0.40)), text.get("color"),
                ))
                compiled.append(eid)
            else:
                pending.append({"id": eid, "module": module, "reason": "缺少文案或成片时间"})
        elif module == "claim-flower":
            text = ev.get("text") or {}
            raw = text.get("content", "")
            lines = [line.strip() for line in str(raw).splitlines() if line.strip()]
            colors = text.get("colors") or []
            if lines and "start" in ev and "end" in ev:
                base_y = float(text.get("y", 0.43))
                gap = float(text.get("line_gap", 0.08))
                for line_i, line in enumerate(lines):
                    item = flower_event(
                        ev, line, "emphasis", ev["start"], ev["end"],
                        base_y + line_i * gap,
                        colors[line_i] if line_i < len(colors) else text.get("color"),
                    )
                    item["id"] = f"{eid}-{line_i + 1}"
                    effect_events.append(item)
                compiled.append(eid)
            else:
                pending.append({"id": eid, "module": module, "reason": "缺少文案或成片时间"})
        elif module == "cumulative-flower":
            text = ev.get("text") or {}
            items = text.get("items") or []
            if items and "end" in ev:
                before = len(effect_events)
                base_y = float(text.get("y", 0.40))
                gap = float(text.get("line_gap", 0.075))
                for item_i, item in enumerate(items):
                    if not item.get("content") or "start" not in item:
                        continue
                    sub = flower_event(
                        ev, item["content"], "emphasis",
                        item["start"], ev["end"],
                        base_y + item_i * gap,
                        item.get("color") or text.get("color"),
                    )
                    sub["id"] = f"{eid}-{item_i + 1}"
                    effect_events.append(sub)
                if len(effect_events) > before:
                    compiled.append(eid)
            else:
                pending.append({"id": eid, "module": module, "reason": "缺少 items 或共同结束时间"})
        elif module == "keyword-emphasis":
            text = ev.get("text") or {}
            words = text.get("words") or (
                [{"word": text.get("word"), "color": text.get("color", "gold")}]
                if text.get("word") else [])
            for item in words:
                if item.get("word"):
                    emphasis.append({
                        "word": item["word"],
                        "color": item.get("color", "gold"),
                    })
            if words:
                compiled.append(eid)
        elif module in {"story-portal", "quote-simulation"}:
            if "start" in ev and "end" in ev:
                visual_events.append({
                    key: value for key, value in ev.items()
                    if key in {
                        "id", "module", "trigger_text", "end_text", "start", "end",
                        "confidence", "reason", "visual",
                    }
                })
                compiled.append(eid)
            else:
                pending.append({
                    "id": eid,
                    "module": module,
                    "reason": "缺少最终成片 start/end",
                })
        elif module == "sfx-cue":
            audio = ev.get("audio") or {}
            if audio.get("file") and ("at" in audio or "start" in ev):
                audio_sfx.append({
                    "name": audio.get("resource_name") or audio.get("category") or eid,
                    "file": audio["file"],
                    "at": float(audio.get("at", ev["start"])),
                    "volume": float(audio.get("volume", 0.16)),
                })
                compiled.append(eid)
            else:
                pending.append({
                    "id": eid,
                    "module": module,
                    "reason": "只确定音效类别，尚未绑定具体文件或时间",
                })
        else:
            status = (ev.get("visual") or {}).get("status") or ev.get("status")
            pending.append({
                "id": eid,
                "module": module,
                "reason": status or "当前渲染器尚未支持该模块",
            })

    audio_cfg = (plan.get("modules") or {}).get("audio") or {}
    bgm = audio_cfg.get("bgm") or {}
    audio_plan = {
        "voice_volume": float(audio_cfg.get("voice_volume", 1.0)),
        "sfx": audio_sfx,
    }
    if bgm.get("enabled") and bgm.get("file"):
        audio_plan["bgm"] = {
            key: value for key, value in bgm.items()
            if key in {"file", "volume", "start", "fade_in", "fade_out"}
        }

    write_json(out / "brand_plan.json", brand)
    write_json(out / "effect_plan.json", {"events": effect_events})
    write_json(out / "emphasis_plan.json", emphasis)
    write_json(out / "visual_plan.json", {"events": visual_events})
    write_json(out / "audio_plan.json", audio_plan)
    manifest = {
        "source_plan": str(plan_path.resolve()),
        "compiled_events": compiled,
        "renderer_pending": pending,
        "outputs": {
            "brand_plan": "brand_plan.json",
            "effect_plan": "effect_plan.json",
            "emphasis_plan": "emphasis_plan.json",
            "visual_plan": "visual_plan.json",
            "audio_plan": "audio_plan.json",
        },
        "note": "renderer_pending 中的模块尚未执行，必须补素材/渲染能力或人工处理。",
    }
    write_json(out / "postproduction_manifest.json", manifest)

    print(f"✓ 品牌计划：{out / 'brand_plan.json'}")
    print(f"✓ 花字计划：{out / 'effect_plan.json'}（{len(effect_events)} 层）")
    print(f"✓ 关键词计划：{out / 'emphasis_plan.json'}（{len(emphasis)} 词）")
    print(f"✓ 视觉滤镜计划：{out / 'visual_plan.json'}（{len(visual_events)} 个事件）")
    print(f"✓ 音频计划：{out / 'audio_plan.json'}（{len(audio_sfx)} 个已绑定音效）")
    print(f"✓ 待执行模块：{len(pending)}（见 postproduction_manifest.json）")


if __name__ == "__main__":
    main()
