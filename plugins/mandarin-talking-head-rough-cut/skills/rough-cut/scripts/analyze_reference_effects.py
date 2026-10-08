#!/usr/bin/env python3
"""分析编导参考成片：抽取特效点前后帧，并把混音中的短音效与本地音效库做波形匹配。

输入 JSON:
{
  "samples": [
    {"id":"q1","at":3.24,"note":"疑问拉近","audio":true},
    {"id":"reset","at":5.36,"note":"拉远复位"}
  ]
}

只生成分析证据，不修改视频。音效匹配是“候选排序”而非最终真值：混有人声/BGM时，
低分结果只能归类，不能硬认具体素材。
"""
import argparse
import csv
import json
import math
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from runtime_support import FFMPEG, FFPROBE, font_candidates


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def media_duration(path):
    r = run([
        FFPROBE, "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(path),
    ])
    if r.returncode:
        sys.exit(f"ffprobe 失败：{r.stderr[-600:]}")
    return float(r.stdout.strip())


def extract_frame(video, at, out):
    r = run([
        FFMPEG, "-y", "-loglevel", "error", "-ss", f"{at:.3f}",
        "-i", str(video), "-frames:v", "1", "-q:v", "2", str(out),
    ])
    if r.returncode:
        sys.exit(f"抽帧失败 {at:.3f}s：{r.stderr[-600:]}")


def decode_audio(path, start=None, duration=None, rate=4000):
    cmd = [FFMPEG, "-loglevel", "error"]
    if start is not None:
        cmd += ["-ss", f"{max(0, start):.3f}"]
    cmd += ["-i", str(path)]
    if duration is not None:
        cmd += ["-t", f"{duration:.3f}"]
    cmd += ["-vn", "-ac", "1", "-ar", str(rate), "-f", "f32le", "pipe:1"]
    r = subprocess.run(cmd, capture_output=True)
    if r.returncode:
        return np.zeros(0, dtype=np.float32)
    return np.frombuffer(r.stdout, dtype=np.float32).copy()


def max_xcorr(mix, cand):
    """返回归一化滑动互相关最大值及候选在 mix 中的偏移。"""
    if len(cand) < 80 or len(mix) < len(cand):
        return 0.0, 0.0
    cand = cand - cand.mean()
    cn = float(np.sqrt(np.sum(cand * cand)))
    if cn < 1e-8:
        return 0.0, 0.0
    n = len(mix) + len(cand) - 1
    size = 1 << (n - 1).bit_length()
    conv = np.fft.irfft(
        np.fft.rfft(mix, size) * np.fft.rfft(cand[::-1], size), size
    )
    dots = conv[len(cand) - 1:len(mix)]
    sq = np.concatenate(([0.0], np.cumsum(mix.astype(np.float64) ** 2)))
    energy = sq[len(cand):] - sq[:-len(cand)]
    denom = np.sqrt(np.maximum(energy, 1e-12)) * cn
    scores = dots[:len(denom)] / denom
    idx = int(np.argmax(scores))
    return float(scores[idx]), idx / 4000.0


def load_library(csv_path, cache_dir):
    rows = []
    with open(csv_path, encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            if row.get("类别") != "音效":
                continue
            path = Path(cache_dir) / row["本地文件"]
            if path.is_file():
                rows.append((row["名字"], path))
    return rows


def font(size):
    for p in font_candidates():
        if p.is_file():
            return ImageFont.truetype(str(p), size)
    return ImageFont.load_default()


def make_contact_sheet(frame_rows, out_path):
    thumb_w, thumb_h = 270, 480
    label_h = 72
    canvas = Image.new(
        "RGB", (thumb_w * 3, (thumb_h + label_h) * len(frame_rows)), "white"
    )
    draw = ImageDraw.Draw(canvas)
    ft = font(19)
    for row_i, (sample, paths, times) in enumerate(frame_rows):
        y0 = row_i * (thumb_h + label_h)
        for j, (p, t) in enumerate(zip(paths, times)):
            im = Image.open(p).convert("RGB")
            im.thumbnail((thumb_w, thumb_h), Image.Resampling.LANCZOS)
            x = j * thumb_w + (thumb_w - im.width) // 2
            y = y0 + (thumb_h - im.height) // 2
            canvas.paste(im, (x, y))
            draw.text((j * thumb_w + 8, y0 + thumb_h + 4), f"{t:.2f}s", fill="black", font=ft)
        label = f"{sample['id']}  {sample.get('note','')}"
        draw.text((8, y0 + thumb_h + 34), label[:42], fill=(25, 25, 25), font=ft)
    canvas.save(out_path, quality=92)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("plan")
    ap.add_argument("--out", required=True)
    ap.add_argument("--audio-table")
    ap.add_argument("--audio-cache")
    ap.add_argument("--frame-delta", type=float, default=0.35)
    ap.add_argument("--audio-before", type=float, default=0.7)
    ap.add_argument("--audio-after", type=float, default=3.0)
    args = ap.parse_args()

    video = Path(args.video).resolve()
    plan = json.load(open(args.plan, encoding="utf-8"))
    out = Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    duration = media_duration(video)
    samples = plan.get("samples", [])
    if not samples:
        sys.exit("分析计划没有 samples")

    library = []
    if args.audio_table and args.audio_cache:
        library = load_library(args.audio_table, args.audio_cache)
    decoded_lib = [(name, path, decode_audio(path)) for name, path in library]

    results = []
    frame_rows = []
    with tempfile.TemporaryDirectory(prefix="effect-evidence-") as td:
        td = Path(td)
        for i, sample in enumerate(samples):
            at = float(sample["at"])
            delta = float(sample.get("delta", args.frame_delta))
            times = [
                max(0, at - delta),
                min(duration - 0.02, at),
                min(duration - 0.02, at + delta),
            ]
            paths = []
            for j, t in enumerate(times):
                p = td / f"{i:03d}_{j}.jpg"
                extract_frame(video, t, p)
                paths.append(p)
            frame_rows.append((sample, paths, times))

            item = {
                "id": sample["id"], "at": at, "note": sample.get("note", ""),
                "frame_times": [round(t, 3) for t in times],
            }
            if sample.get("audio") and decoded_lib:
                start = max(0, at - args.audio_before)
                mix = decode_audio(
                    video, start=start,
                    duration=args.audio_before + args.audio_after
                )
                ranked = []
                for name, path, cand in decoded_lib:
                    score, offset = max_xcorr(mix, cand)
                    ranked.append({
                        "name": name, "file": path.name,
                        "score": round(score, 4),
                        "matched_at": round(start + offset, 3),
                    })
                ranked.sort(key=lambda x: x["score"], reverse=True)
                item["audio_candidates"] = ranked[:5]
            results.append(item)

        make_contact_sheet(frame_rows, out / "contact_sheet.jpg")

    json.dump(
        {"video": str(video), "duration": duration, "samples": results},
        open(out / "analysis.json", "w", encoding="utf-8"),
        ensure_ascii=False, indent=2,
    )
    print(f"✓ 参考特效证据：{out / 'contact_sheet.jpg'}")
    print(f"✓ 音效候选与时间：{out / 'analysis.json'}")


if __name__ == "__main__":
    main()
