#!/usr/bin/env python3
"""① 探测视频参数 + 抽取分析用音频。原片只读。"""
import argparse, json, subprocess, os, sys
from fractions import Fraction
from runtime_support import FFMPEG, FFPROBE

def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"命令失败: {' '.join(cmd)}\n{r.stderr}")
    return r.stdout

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)

    # ffprobe 读参数
    out = run([FFPROBE, "-v", "error", "-print_format", "json",
               "-show_format", "-show_streams", a.video])
    probe = json.loads(out)
    v = next(s for s in probe["streams"] if s["codec_type"] == "video")
    meta = {
        "source": os.path.abspath(a.video),
        "duration": float(probe["format"]["duration"]),
        "width": v["width"], "height": v["height"],
        "fps": float(Fraction(v["r_frame_rate"])),
        "is_vertical": v["height"] > v["width"],
    }
    with open(os.path.join(a.out, "meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)

    # 抽 16kHz 单声道 wav（转写和切点分析都用）
    wav = os.path.join(a.out, "audio.wav")
    run([FFMPEG, "-y", "-loglevel", "error", "-i", a.video,
         "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav])

    print(f"✓ 时长 {meta['duration']:.1f}s, {meta['width']}x{meta['height']}, "
          f"{'竖屏' if meta['is_vertical'] else '横屏'}")
    print(f"✓ 音频: {wav}")

if __name__ == "__main__":
    main()
