#!/usr/bin/env python3
"""原片/编导成片配对反向分析（只读）。

用人声包络建立成片时间→原片时间映射，再比较同一内容的画面尺度、亮度边缘、
彩色文字层与切换节点。输出机器时间轴、对齐表、证据联系表和初步报告。

这是证据生成器，不把视觉近似值冒充剪映预设名；低置信度结果必须人工复核。
"""
import argparse
import csv
import json
import math
import os
import re
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from runtime_support import FFMPEG, FFPROBE, font_candidates


def run(cmd, binary=False):
    return subprocess.run(cmd, capture_output=True, text=not binary)


def probe(path):
    r = run([
        FFPROBE, "-v", "error", "-show_entries",
        "format=duration:stream=codec_type,width,height,r_frame_rate",
        "-of", "json", str(path),
    ])
    if r.returncode:
        sys.exit(f"ffprobe失败：{r.stderr[-800:]}")
    d = json.loads(r.stdout)
    video = next(s for s in d["streams"] if s.get("codec_type") == "video")
    return {
        "duration": float(d["format"]["duration"]),
        "width": int(video["width"]),
        "height": int(video["height"]),
    }


def read_wav(path):
    with wave.open(str(path), "rb") as w:
        rate, channels, width = w.getframerate(), w.getnchannels(), w.getsampwidth()
        raw = w.readframes(w.getnframes())
    if width != 2:
        raise ValueError("分析器要求probe.py生成的16-bit WAV")
    x = np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768.0
    if channels > 1:
        x = x.reshape(-1, channels).mean(axis=1)
    return x, rate


def rms_envelope(x, rate, hz=100):
    hop = max(1, round(rate / hz))
    n = len(x) // hop
    x = x[:n * hop].reshape(n, hop)
    env = np.sqrt(np.mean(x * x, axis=1) + 1e-10)
    env = np.log1p(env * 80.0)
    # 短平滑抑制采样尖峰，保留说话停连节奏。
    k = np.ones(5, dtype=np.float32) / 5
    return np.convolve(env, k, mode="same").astype(np.float32), hz


def top_matches(raw, raw_fft, cs, cs2, win, fft_n, topk=40):
    w = win.astype(np.float64)
    w -= w.mean()
    wn = float(np.sqrt(np.sum(w * w)))
    if wn < 1e-6:
        return []
    conv = np.fft.irfft(raw_fft * np.fft.rfft(w[::-1], fft_n), fft_n)
    dots = conv[len(w) - 1:len(raw)]
    count = len(dots)
    sums = cs[len(w):len(w) + count] - cs[:count]
    sums2 = cs2[len(w):len(w) + count] - cs2[:count]
    energy = np.maximum(sums2 - sums * sums / len(w), 1e-10)
    scores = dots[:count] / (np.sqrt(energy) * wn)
    if count <= topk:
        idx = np.argsort(scores)[::-1]
    else:
        part = np.argpartition(scores, -topk)[-topk:]
        idx = part[np.argsort(scores[part])[::-1]]
    return [(int(i), float(scores[i])) for i in idx]


def align_audio(raw_wav, final_wav, step=1.0, window=4.0):
    rx, rr = read_wav(raw_wav)
    fx, fr = read_wav(final_wav)
    if rr != fr:
        raise ValueError("原片和成片WAV采样率不同")
    r, hz = rms_envelope(rx, rr)
    f, _ = rms_envelope(fx, fr, hz)
    L = round(window * hz)
    half = L // 2
    fft_n = 1 << (len(r) + L - 1).bit_length()
    raw_fft = np.fft.rfft(r.astype(np.float64), fft_n)
    cs = np.concatenate(([0.0], np.cumsum(r.astype(np.float64))))
    cs2 = np.concatenate(([0.0], np.cumsum(r.astype(np.float64) ** 2)))
    rows = []
    centers = np.arange(window / 2, len(f) / hz - window / 2, step)
    for t in centers:
        c = round(t * hz)
        win = f[c - half:c - half + L]
        matches = top_matches(r, raw_fft, cs, cs2, win, fft_n)
        rows.append({
            "final": float(t),
            "candidates": [
                {"raw": (i + half) / hz, "score": s} for i, s in matches
            ],
        })

    # 束搜索：原片时间只能前进；允许低置信窗口暂时“不匹配”，再由前后锚点插值。
    # 这比为了每秒都有答案而跳回原片早段安全。
    if not rows:
        return []
    beam = [(0.0, -1e9, -1, [])]  # cost, last_raw, last_row, chosen indices/None
    beam_width = 120
    for i, row in enumerate(rows):
        expanded = []
        for cost, last_raw, last_row, path in beam:
            # 跳过强音效、切口或大花字覆盖造成的坏窗口。
            expanded.append((cost + 0.72, last_raw, last_row, path + [None]))
            dt = row["final"] - (rows[last_row]["final"] if last_row >= 0 else row["final"])
            for j, c in enumerate(row["candidates"]):
                if last_row >= 0 and c["raw"] - last_raw < max(.15, dt * .10):
                    continue
                if last_row < 0:
                    penalty = 0.0
                else:
                    dr = c["raw"] - last_raw
                    # 连续同速最优；向前跳是合法剪辑但收少量复杂度成本。
                    extra = max(0.0, dr - dt)
                    penalty = min(abs(dr - dt) * .045, .34) + min(extra * .0015, .12)
                expanded.append((
                    cost + penalty - 6.0 * c["score"],
                    c["raw"], i, path + [j]))
        # 按最后raw的0.5秒桶保留最优路径，避免120条束都挤在同一错误候选附近。
        diverse = {}
        for state in sorted(expanded, key=lambda x: x[0]):
            bucket = -1 if state[2] < 0 else round(state[1] * 2)
            if bucket not in diverse:
                diverse[bucket] = state
            if len(diverse) >= beam_width:
                break
        beam = list(diverse.values())
    best = min(beam, key=lambda x: x[0])
    chosen = best[3]

    # 被跳过的窗口用相邻已匹配锚点线性插值；首尾按1×播放速率外推。
    anchors = [i for i, x in enumerate(chosen) if x is not None]
    if len(anchors) < 2:
        chosen = [0 for _ in rows]
        anchors = list(range(len(rows)))
    inferred_raw = [None] * len(rows)
    for i in anchors:
        inferred_raw[i] = rows[i]["candidates"][chosen[i]]["raw"]
    for a, b in zip(anchors, anchors[1:]):
        for i in range(a + 1, b):
            q = (rows[i]["final"] - rows[a]["final"]) / (
                rows[b]["final"] - rows[a]["final"])
            inferred_raw[i] = inferred_raw[a] * (1 - q) + inferred_raw[b] * q
    for i in range(0, anchors[0]):
        inferred_raw[i] = inferred_raw[anchors[0]] - (
            rows[anchors[0]]["final"] - rows[i]["final"])
    for i in range(anchors[-1] + 1, len(rows)):
        inferred_raw[i] = inferred_raw[anchors[-1]] + (
            rows[i]["final"] - rows[anchors[-1]]["final"])
    out = []
    for i, (row, idx) in enumerate(zip(rows, chosen)):
        if idx is None:
            out.append({
                "final": round(row["final"], 3),
                "raw": round(inferred_raw[i], 3),
                "score": 0.0,
                "margin": 0.0,
                "confidence": "interpolated",
            })
            continue
        c = row["candidates"][idx]
        second = max((x["score"] for k, x in enumerate(row["candidates"]) if k != idx),
                     default=0.0)
        out.append({
            "final": round(row["final"], 3),
            "raw": round(c["raw"], 3),
            "score": round(c["score"], 4),
            "margin": round(c["score"] - second, 4),
            "confidence": (
                "high" if c["score"] >= 0.72 else
                "medium" if c["score"] >= 0.55 else "low"),
        })
    return out


def fill_mapping(rows, final_duration):
    good = [r for r in rows if r["score"] >= 0.48]
    if len(good) < 2:
        good = rows
    ft = np.array([r["final"] for r in good], dtype=np.float64)
    rt = np.array([r["raw"] for r in good], dtype=np.float64)
    def mapped(t):
        return float(np.interp(t, ft, rt, left=rt[0] + t - ft[0],
                               right=rt[-1] + t - ft[-1]))
    return mapped


def decode_frames(video, fps=2.0, width=180, height=320):
    r = run([
        FFMPEG, "-loglevel", "error", "-i", str(video), "-an",
        "-vf", f"fps={fps},scale={width}:{height}:flags=bilinear",
        "-pix_fmt", "rgb24", "-f", "rawvideo", "pipe:1",
    ], binary=True)
    if r.returncode:
        sys.exit(f"解码低清分析帧失败：{r.stderr[-800:]!r}")
    arr = np.frombuffer(r.stdout, dtype=np.uint8)
    frame_size = width * height * 3
    arr = arr[:len(arr) // frame_size * frame_size]
    return arr.reshape(-1, height, width, 3).copy()


def resize_rgb(a, size):
    return np.asarray(Image.fromarray(a).resize(size, Image.Resampling.BILINEAR))


def crop_zoom(a, zoom):
    h, w = a.shape[:2]
    cw, ch = max(2, round(w / zoom)), max(2, round(h / zoom))
    x0, y0 = (w - cw) // 2, (h - ch) // 2
    return resize_rgb(a[y0:y0 + ch, x0:x0 + cw], (w, h))


def norm_corr(a, b):
    # 避开顶部标题和底部字幕，主要比较人物脸/肩与背景构图。
    h, w = a.shape
    aa = a[round(h * .18):round(h * .58), round(w * .12):round(w * .88)].astype(np.float32)
    bb = b[round(h * .18):round(h * .58), round(w * .12):round(w * .88)].astype(np.float32)
    aa -= aa.mean(); bb -= bb.mean()
    den = float(np.sqrt(np.sum(aa * aa) * np.sum(bb * bb)))
    return float(np.sum(aa * bb) / den) if den > 1e-6 else 0.0


def luma(rgb):
    return (0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2])


def edge_mask(y):
    gx = np.abs(np.diff(y, axis=1, prepend=y[:, :1]))
    gy = np.abs(np.diff(y, axis=0, prepend=y[:1, :]))
    return (gx + gy) > 42


def color_layers(frame):
    f = frame.astype(np.int16)
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    e = edge_mask(luma(frame))
    masks = {
        "yellow": (r > 165) & (g > 120) & (b < 125) & (r > g * .78),
        "red": (r > 155) & (r > g * 1.45) & (r > b * 1.35),
        "cyan": (g > 125) & (b > 115) & (r < g * .85),
        "white": (r > 185) & (g > 185) & (b > 185) &
                 ((np.maximum.reduce([r, g, b]) - np.minimum.reduce([r, g, b])) < 38),
    }
    h = frame.shape[0]
    bands = {
        "top": slice(0, round(h * .27)),
        "middle": slice(round(h * .27), round(h * .64)),
        "caption": slice(round(h * .58), round(h * .82)),
    }
    out = {}
    for name, m in masks.items():
        mm = m & e
        for band, ys in bands.items():
            out[f"{band}_{name}"] = float(mm[ys].mean())
    return out


def vignette_score(raw, final):
    ry, fy = luma(raw), luma(final)
    h, w = ry.shape
    yy, xx = np.mgrid[:h, :w]
    d = np.sqrt(((xx - (w - 1) / 2) / (w / 2)) ** 2 +
                ((yy - (h - 1) / 2) / (h / 2)) ** 2)
    center, edge = d < .42, d > .78
    rr = float(ry[edge].mean() / max(1, ry[center].mean()))
    fr = float(fy[edge].mean() / max(1, fy[center].mean()))
    return fr - rr


def scene_cuts(video, threshold=.08):
    r = run([
        FFMPEG, "-hide_banner", "-loglevel", "info", "-i", str(video),
        "-vf", f"select='gt(scene,{threshold})',metadata=print",
        "-an", "-f", "null", "-",
    ])
    text = r.stderr + "\n" + r.stdout
    times = [float(x) for x in re.findall(r"pts_time:([0-9.]+)", text)]
    scores = [float(x) for x in re.findall(r"lavfi\\.scene_score=([0-9.]+)", text)]
    return [{"at": round(t, 3), "score": round(scores[i], 4) if i < len(scores) else None}
            for i, t in enumerate(times)]


def transcript_words(path):
    if not path or not Path(path).is_file():
        return []
    d = json.load(open(path, encoding="utf-8"))
    words = []
    for key, seg in d.items():
        for w in seg.get("words", []):
            if "start" in w and "end" in w:
                words.append((float(w["start"]), float(w["end"]), str(w.get("text", ""))))
    return sorted(words)


def text_at(words, a, b):
    return "".join(t for s, e, t in words if e >= a and s <= b)


def contiguous_ranges(rows, pred, min_len=1):
    out, start = [], None
    for i, row in enumerate(rows):
        yes = pred(row)
        if yes and start is None:
            start = i
        if start is not None and (not yes or i == len(rows) - 1):
            end = i if not yes else i + 1
            if end - start >= min_len:
                out.append((start, end))
            start = None
    return out


def visual_analysis(raw_video, final_video, mapping, raw_duration, final_duration,
                    fps=2.0):
    raw = decode_frames(raw_video, fps=fps)
    final = decode_frames(final_video, fps=fps)
    zooms = [1.0, 1.08, 1.15, 1.22, 1.30]
    rows = []
    for i, ff in enumerate(final):
        t = i / fps
        rt = max(0, min(raw_duration - 1 / fps, mapping(t)))
        ri = min(len(raw) - 1, max(0, round(rt * fps)))
        rf = raw[ri]
        fy = luma(ff)
        best = None
        for z in zooms:
            zr = crop_zoom(rf, z)
            c = norm_corr(luma(zr), fy)
            if best is None or c > best[0]:
                best = (c, z, zr)
        layers = color_layers(ff)
        rows.append({
            "final": round(t, 3), "raw": round(rt, 3),
            "zoom": best[1], "corr": round(best[0], 4),
            "vignette_delta": round(vignette_score(best[2], ff), 4),
            **{k: round(v, 6) for k, v in layers.items()},
        })
    return rows


def detect_events(rows, cuts, words):
    events = []
    # 近景：相对1.0达到至少1.15，且画面匹配不是完全失效。
    for a, b in contiguous_ranges(
            rows, lambda r: r["zoom"] >= 1.15 and r["corr"] >= .28, min_len=2):
        s, e = rows[a]["final"], rows[b - 1]["final"] + .5
        z = float(np.median([r["zoom"] for r in rows[a:b]]))
        rt0, rt1 = rows[a]["raw"], rows[b - 1]["raw"] + .5
        events.append({
            "type": "close-shot", "start": s, "end": e,
            "value": round(z, 2), "confidence": "medium",
            "transcript": text_at(words, rt0, rt1),
        })
    # 暗角：相对原片边缘/中心比显著下降。
    for a, b in contiguous_ranges(
            rows, lambda r: r["vignette_delta"] < -.09 and r["corr"] >= .25, min_len=2):
        s, e = rows[a]["final"], rows[b - 1]["final"] + .5
        rt0, rt1 = rows[a]["raw"], rows[b - 1]["raw"] + .5
        events.append({
            "type": "vignette", "start": s, "end": e,
            "value": round(float(np.median([r["vignette_delta"] for r in rows[a:b]])), 3),
            "confidence": "medium", "transcript": text_at(words, rt0, rt1),
        })
    # 中区彩色文字显著增加：花字/圈画候选。
    for color in ("yellow", "red", "cyan"):
        key = f"middle_{color}"
        threshold = .0010 if color != "red" else .00065
        for a, b in contiguous_ranges(rows, lambda r, k=key, th=threshold: r[k] > th,
                                      min_len=2):
            s, e = rows[a]["final"], rows[b - 1]["final"] + .5
            rt0, rt1 = rows[a]["raw"], rows[b - 1]["raw"] + .5
            events.append({
                "type": f"{color}-overlay-candidate", "start": s, "end": e,
                "value": round(float(max(r[key] for r in rows[a:b])), 5),
                "confidence": "medium", "transcript": text_at(words, rt0, rt1),
            })
    for c in cuts:
        events.append({
            "type": "visual-cut", "start": c["at"], "end": c["at"],
            "value": c.get("score"), "confidence": "high", "transcript": "",
        })
    events.sort(key=lambda x: (x["start"], x["type"]))
    return events


def make_sheet(raw_video, final_video, events, mapping, out, limit=30):
    chosen = []
    last = -99.0
    priority = {
        "vignette": 0, "yellow-overlay-candidate": 1, "red-overlay-candidate": 1,
        "cyan-overlay-candidate": 1, "close-shot": 2, "visual-cut": 3,
    }
    for ev in sorted(events, key=lambda e: (priority.get(e["type"], 9), e["start"])):
        if ev["start"] - last < .6:
            continue
        chosen.append(ev); last = ev["start"]
        if len(chosen) >= limit:
            break
    if not chosen:
        return []
    fw, fh, label = 240, 426, 82
    canvas = Image.new("RGB", (fw * 4, (fh + label) * len(chosen)), "white")
    draw = ImageDraw.Draw(canvas)
    ft = next((ImageFont.truetype(str(p), 18) for p in font_candidates() if p.is_file()),
              ImageFont.load_default())
    tmp = out / "_evidence_frames"
    tmp.mkdir(exist_ok=True)
    manifest = []
    for i, ev in enumerate(chosen):
        t = max(.02, ev["start"])
        rt = mapping(t)
        specs = [
            (raw_video, rt, "原片对齐"),
            (final_video, max(.02, t - .30), "成片前"),
            (final_video, t, "成片点"),
            (final_video, min(probe(final_video)["duration"] - .02, t + .30), "成片后"),
        ]
        paths = []
        for j, (video, at, tag) in enumerate(specs):
            p = tmp / f"{i:03d}_{j}.jpg"
            r = run([
                FFMPEG, "-y", "-loglevel", "error", "-ss", f"{at:.3f}",
                "-i", str(video), "-frames:v", "1", "-q:v", "2", str(p),
            ])
            if r.returncode:
                continue
            paths.append(str(p))
            im = Image.open(p).convert("RGB")
            im.thumbnail((fw, fh), Image.Resampling.LANCZOS)
            x = j * fw + (fw - im.width) // 2
            y = i * (fh + label) + (fh - im.height) // 2
            canvas.paste(im, (x, y))
            draw.text((j * fw + 6, i * (fh + label) + fh + 4),
                      f"{tag} {at:.2f}s", fill="black", font=ft)
        txt = f"{ev['type']} {ev['start']:.2f}-{ev['end']:.2f}s {ev.get('transcript','')}"
        draw.text((6, i * (fh + label) + fh + 34), txt[:64],
                  fill=(20, 20, 20), font=ft)
        manifest.append({**ev, "raw_at": round(rt, 3), "frames": paths})
    canvas.save(out / "paired_contact_sheet.jpg", quality=92)
    return manifest


def write_report(path, raw_meta, final_meta, alignment, events, evidence):
    high = sum(r["confidence"] == "high" for r in alignment)
    med = sum(r["confidence"] == "medium" for r in alignment)
    low = sum(r["confidence"] == "low" for r in alignment)
    by_type = {}
    for e in events:
        by_type[e["type"]] = by_type.get(e["type"], 0) + 1
    lines = [
        "# 口播素材｜后期效果反向分析（自动初扫）", "",
        "## 分析对象", "",
        f"- 原片：{raw_meta['duration']:.1f}s，{raw_meta['width']}×{raw_meta['height']}",
        f"- 编导成片：{final_meta['duration']:.1f}s，{final_meta['width']}×{final_meta['height']}",
        f"- 时长压缩：{(1-final_meta['duration']/raw_meta['duration'])*100:.1f}%",
        f"- 音频对齐窗口：高置信{high}、中置信{med}、低置信{low}", "",
        "## 方法与边界", "",
        "- 以4秒人声包络窗口建立成片→原片单调时间映射，允许剪辑向前跳。",
        "- 同内容帧比较只报告景别、暗角和文字颜色层的视觉结果，不冒充剪映预设名。",
        "- OCR、音效库匹配和人工证据复核完成后，才把候选升级为确认事件。",
        "- 低置信度窗口通常位于切口、音效覆盖或大花字遮挡处，应保留为待确认。", "",
        "## 自动检测概览", "",
    ]
    for k, v in sorted(by_type.items()):
        lines.append(f"- `{k}`：{v}处")
    lines += ["", "## 自动事件时间轴", "",
              "| 成片时间 | 类型 | 数值 | 置信度 | 对应原片台词 |",
              "|---:|---|---:|---|---|"]
    for e in events:
        if e["type"] == "visual-cut" and len(events) > 80:
            continue
        tr = e.get("transcript", "").replace("|", "｜")[:36]
        lines.append(
            f"| {e['start']:.2f}–{e['end']:.2f}s | {e['type']} | "
            f"{e.get('value','')} | {e['confidence']} | {tr} |")
    lines += ["", "## 证据联系表", "",
              f"- 自动选取{len(evidence)}个代表节点，见 `paired_contact_sheet.jpg`。",
              "- 每行依次为：原片同内容、成片节点前、节点时刻、节点后。",
              "", "## 尚需二次确认", "",
              "- 彩色文字候选需要结合OCR区分：花字、顶部主题、身份名牌或环境本色。",
              "- 景别倍率是配对画面近似值；人物移动和手机运动会降低置信度。",
              "- 暗角候选需查看联系表，排除树荫、曝光变化和原片环境光。",
              "- 音效与BGM将在音频库匹配结果合并后单列。",
    ]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main():
    ap = argparse.ArgumentParser(description="原片/成片配对后期反向分析")
    ap.add_argument("raw_video")
    ap.add_argument("final_video")
    ap.add_argument("--raw-audio", required=True)
    ap.add_argument("--final-audio", required=True)
    ap.add_argument("--segments", help="原片segments.json，用于给事件附台词")
    ap.add_argument("--out", required=True)
    ap.add_argument("--step", type=float, default=1.0)
    ap.add_argument("--window", type=float, default=4.0)
    ap.add_argument("--visual-fps", type=float, default=2.0)
    args = ap.parse_args()

    raw_video, final_video = Path(args.raw_video).resolve(), Path(args.final_video).resolve()
    out = Path(args.out).resolve(); out.mkdir(parents=True, exist_ok=True)
    raw_meta, final_meta = probe(raw_video), probe(final_video)
    print("① 音频配对对齐…", flush=True)
    alignment = align_audio(args.raw_audio, args.final_audio, args.step, args.window)
    json.dump(alignment, open(out / "alignment.json", "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)
    with open(out / "alignment.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=["final", "raw", "score", "margin", "confidence"])
        w.writeheader(); w.writerows(alignment)
    mapping = fill_mapping(alignment, final_meta["duration"])
    print("② 解码低清配对帧并估计景别/暗角/文字颜色层…", flush=True)
    visual = visual_analysis(raw_video, final_video, mapping, raw_meta["duration"],
                             final_meta["duration"], args.visual_fps)
    json.dump(visual, open(out / "visual_metrics.json", "w", encoding="utf-8"),
              ensure_ascii=False)
    print("③ 检测画面切换…", flush=True)
    cuts = scene_cuts(final_video)
    words = transcript_words(args.segments)
    events = detect_events(visual, cuts, words)
    json.dump(events, open(out / "effect_timeline.auto.json", "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)
    print("④ 生成配对证据联系表…", flush=True)
    evidence = make_sheet(raw_video, final_video, events, mapping, out)
    json.dump(evidence, open(out / "evidence_manifest.json", "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)
    write_report(out / "后期效果反向分析_自动初扫.md", raw_meta, final_meta,
                 alignment, events, evidence)
    print(f"✓ 对齐：{out / 'alignment.csv'}")
    print(f"✓ 时间轴：{out / 'effect_timeline.auto.json'}")
    print(f"✓ 证据：{out / 'paired_contact_sheet.jpg'}")
    print(f"✓ 初扫报告：{out / '后期效果反向分析_自动初扫.md'}")


if __name__ == "__main__":
    main()
