#!/usr/bin/env python3
"""渲染通用口播的程序化视觉状态。

已支持：
- story-portal：故事/回忆入口的柔和暗角，短淡入淡出；
- quote-simulation：引语/角色模拟的克制色调区分、轻暗角和可选文字标签。

输入既可为编译后的 visual_plan.json，也可为含 events 的总后期计划。
不覆盖输入视频；默认输出 preview_视觉滤镜.mp4。
"""

import argparse
import json
import math
import os
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from runtime_support import FFMPEG, FFPROBE, encoder_attempts


SUPPORTED = {"story-portal", "quote-simulation"}
QUOTE_PRESETS = {
    "neutral": {
        "saturation": 0.84,
        "contrast": 1.04,
        "brightness": -0.008,
        "mixer": None,
        "vignette_angle": "PI/9",
    },
    "cool": {
        "saturation": 0.76,
        "contrast": 1.06,
        "brightness": -0.012,
        "mixer": "rr=.95:gg=.99:bb=1.06",
        "vignette_angle": "PI/9",
    },
    "warm": {
        "saturation": 0.82,
        "contrast": 1.05,
        "brightness": -0.008,
        "mixer": "rr=1.05:gg=1.01:bb=.95",
        "vignette_angle": "PI/10",
    },
    "memory": {
        "saturation": 0.68,
        "contrast": 1.04,
        "brightness": -0.006,
        "mixer": "rr=1.04:gg=1.01:bb=.96",
        "vignette_angle": "PI/8",
    },
}


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def probe(video):
    r = run([
        FFPROBE, "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=width,height,r_frame_rate:format=duration",
        "-of", "json", str(video),
    ])
    if r.returncode:
        sys.exit(f"ffprobe 失败：{r.stderr[-800:]}")
    data = json.loads(r.stdout)
    stream = data["streams"][0]
    rate = stream.get("r_frame_rate", "30/1")
    num, den = rate.split("/")
    fps = float(num) / max(float(den), 1.0)
    return {
        "width": int(stream["width"]),
        "height": int(stream["height"]),
        "fps": fps,
        "duration": float(data["format"]["duration"]),
    }


def package_font():
    skill_root = Path(__file__).resolve().parents[1]
    candidates = [
        skill_root / "assets/fonts/SourceHanSerifSC-Heavy.otf",
        Path("/System/Library/Fonts/PingFang.ttc"),
        Path("/System/Library/Fonts/STHeiti Medium.ttc"),
    ]
    for path in candidates:
        if path.is_file():
            return path
    return None


def rgba(hex_color, alpha=255):
    value = str(hex_color).lstrip("#")
    if len(value) == 6:
        return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4)) + (alpha,)
    if len(value) == 8:
        return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4, 6))
    return (255, 255, 255, alpha)


def render_quote_label(text, width, height, out, plan):
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    font_path = Path(plan.get("font") or package_font() or "")
    size = int(width * float(plan.get("label_size", 0.045)))
    if font_path.is_file():
        font = ImageFont.truetype(str(font_path), size)
    else:
        font = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    pad_x = int(width * 0.028)
    pad_y = int(height * 0.010)
    box_w = tw + pad_x * 2
    box_h = th + pad_y * 2
    side = plan.get("label_side", "left")
    x = int(width * (0.08 if side == "left" else 0.92)) - (0 if side == "left" else box_w)
    y = int(height * float(plan.get("label_y", 0.55)))
    bg = rgba(plan.get("label_box_color", "#111827"), 174)
    accent = rgba(plan.get("label_accent_color", "#39D8D0"), 255)
    color = rgba(plan.get("label_color", "#FFFFFF"), 255)
    radius = int(width * 0.018)
    draw.rounded_rectangle((x, y, x + box_w, y + box_h), radius=radius, fill=bg)
    bar = max(5, int(width * 0.007))
    draw.rounded_rectangle((x, y, x + bar, y + box_h), radius=bar // 2, fill=accent)
    tx = x + pad_x
    ty = y + pad_y - bbox[1]
    shadow = max(2, int(width * 0.002))
    draw.text((tx + shadow, ty + shadow), text, font=font, fill=(0, 0, 0, 180))
    draw.text((tx, ty), text, font=font, fill=color)
    canvas.save(out)


def weight_expr(start, end, fade):
    duration = end - start
    fade = min(max(0.04, fade), max(0.04, duration / 2))
    # blend 的 T 是秒；入口、稳定、出口组成一个平滑三段权重。
    return (
        f"between(T,{start:.4f},{end:.4f})"
        f"*min(1,max(0,(T-{start:.4f})/{fade:.4f}))"
        f"*min(1,max(0,({end:.4f}-T)/{fade:.4f}))"
    )


def clip_events(events, offset, duration):
    clipped = []
    window_end = offset + duration
    for raw in events:
        if raw.get("module") not in SUPPORTED:
            continue
        if "start" not in raw or "end" not in raw:
            continue
        start = float(raw["start"])
        end = float(raw["end"])
        if end <= offset or start >= window_end:
            continue
        ev = dict(raw)
        ev["start"] = max(start, offset) - offset
        ev["end"] = min(end, window_end) - offset
        if ev["end"] - ev["start"] >= 0.08:
            clipped.append(ev)
    clipped.sort(key=lambda x: (float(x["start"]), float(x["end"])))
    return clipped


def build_filter(events):
    parts = ["[0:v]setpts=PTS-STARTPTS,format=yuv420p[v0]"]
    current = "v0"
    label_events = []
    for index, ev in enumerate(events, start=1):
        module = ev["module"]
        visual = ev.get("visual") or {}
        start = float(ev["start"])
        end = float(ev["end"])
        fade = float(visual.get("fade", 0.18))
        weight = weight_expr(start, end, fade)
        base = f"vb{index}"
        fx = f"vf{index}"
        done = f"vd{index}"
        parts.append(f"[{current}]split=2[{base}][{fx}]")

        if module == "story-portal":
            strength = min(0.45, max(0.12, float(visual.get("strength", 0.28))))
            # vignette 的 angle 越大越明显；按规范限制在克制范围。
            angle = math.pi * (0.105 + strength * 0.19)
            parts.append(
                f"[{fx}]vignette=angle={angle:.5f}:eval=frame:mode=forward[{fx}x]")
        else:
            preset_name = visual.get("preset", "neutral")
            preset = QUOTE_PRESETS.get(preset_name, QUOTE_PRESETS["neutral"])
            saturation = float(visual.get("saturation", preset["saturation"]))
            contrast = float(visual.get("contrast", preset["contrast"]))
            brightness = float(visual.get("brightness", preset["brightness"]))
            chain = (
                f"eq=saturation={saturation:.4f}:"
                f"contrast={contrast:.4f}:brightness={brightness:.4f}"
            )
            mixer = visual.get("mixer", preset["mixer"])
            if mixer:
                chain += f",colorchannelmixer={mixer}"
            if visual.get("vignette", True):
                chain += (
                    f",vignette=angle={preset['vignette_angle']}:"
                    "eval=frame:mode=forward"
                )
            parts.append(f"[{fx}]{chain}[{fx}x]")
            if visual.get("label", True):
                label_events.append((ev, visual))

        # A 为原画面，B 为效果画面，按时间权重混合。
        parts.append(
            f"[{base}][{fx}x]blend=all_expr="
            f"'A*(1-({weight}))+B*({weight})':shortest=1[{done}]"
        )
        current = done
    parts.append(f"[{current}]null[vfiltered]")
    return ";".join(parts), label_events


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("plan")
    ap.add_argument("--out", required=True)
    ap.add_argument("--name", default="preview_视觉滤镜.mp4")
    ap.add_argument("--encoder", default="auto",
                    choices=["auto", "nvenc", "videotoolbox", "x264"])
    ap.add_argument("--preview-start", type=float, default=0.0,
                    help="只渲染短预览时的原视频起点；正式渲染保持 0")
    ap.add_argument("--preview-duration", type=float,
                    help="只渲染指定长度，供效果 QA；正式渲染省略")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    video = Path(args.video).resolve()
    plan_path = Path(args.plan).resolve()
    out_dir = Path(args.out).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    info = probe(video)
    source_plan = json.loads(plan_path.read_text(encoding="utf-8"))
    offset = max(0.0, args.preview_start)
    duration = min(
        args.preview_duration or (info["duration"] - offset),
        info["duration"] - offset,
    )
    if duration <= 0:
        sys.exit("预览时间范围无效")
    events = clip_events(source_plan.get("events", []), offset, duration)
    if not events:
        sys.exit("计划中没有落在当前时间范围内的 story-portal/quote-simulation 事件")

    filter_graph, label_events = build_filter(events)
    output = out_dir / args.name
    report = {
        "input": str(video),
        "plan": str(plan_path),
        "output": str(output),
        "preview_start": offset,
        "duration": duration,
        "events": events,
        "status": "dry-run" if args.dry_run else "rendered",
    }
    (out_dir / "visual_effects_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    if args.dry_run:
        print(f"✓ 视觉计划可执行：{len(events)} 个事件")
        print(f"✓ 检查报告：{out_dir / 'visual_effects_report.json'}")
        return

    with tempfile.TemporaryDirectory(prefix="rough-cut-visual-") as temp:
        temp = Path(temp)
        image_inputs = []
        overlays = []
        current = "vfiltered"
        for label_index, (ev, visual) in enumerate(label_events, start=1):
            label_path = temp / f"quote_label_{label_index:02d}.png"
            label_text = str(visual.get("label_text", "引用内容"))
            render_quote_label(
                label_text, info["width"], info["height"], label_path, visual
            )
            image_inputs += ["-loop", "1", "-framerate", f"{info['fps']:.3f}", "-i", str(label_path)]
            out_label = f"vl{label_index}"
            input_index = label_index
            overlays.append(
                f"[{current}][{input_index}:v]overlay=0:0:"
                f"enable='between(t,{float(ev['start']):.4f},{float(ev['end']):.4f})'"
                f"[{out_label}]"
            )
            current = out_label
        if overlays:
            filter_graph += ";" + ";".join(overlays)
        filter_graph += f";[{current}]null[vout]"

        base = [FFMPEG, "-y", "-loglevel", "error"]
        if offset > 0:
            base += ["-ss", f"{offset:.4f}"]
        base += ["-t", f"{duration:.4f}", "-i", str(video)]
        base += image_inputs
        common = [
            "-filter_complex", filter_graph,
            "-map", "[vout]", "-map", "0:a?",
            "-t", f"{duration:.4f}",
            "-c:a", "copy", "-movflags", "+faststart",
            str(output),
        ]
        result = None
        used = None
        for encoder_label, enc_args in encoder_attempts(args.encoder):
            result = run(base + enc_args + common)
            if result.returncode == 0:
                used = encoder_label
                break
            if args.encoder == "auto":
                print(f"{encoder_label} 编码失败，尝试下一编码器…", file=sys.stderr)
        if result.returncode:
            sys.exit(f"视觉滤镜渲染失败：\n{result.stderr[-1600:]}")

    print(f"✓ 视觉滤镜成片（{used}）：{output}")
    print(f"✓ 已渲染事件：{len(events)}（故事暗角/引语滤镜）")


if __name__ == "__main__":
    main()
