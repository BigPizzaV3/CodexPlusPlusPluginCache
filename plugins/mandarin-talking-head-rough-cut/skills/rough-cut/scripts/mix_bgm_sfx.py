#!/usr/bin/env python3
"""给已完成的口播 MP4 混入低音量 BGM 和按时间点触发的音效。

用法：
  python scripts/mix_bgm_sfx.py input.mp4 audio_plan.json --out output/

计划文件中的音量是线性倍率：1.0=原音量，0.05≈-26dB，0.2≈-14dB。
脚本复制视频流，只重编码音频；不会覆盖输入文件。
"""
import argparse
import json
import math
import os
import subprocess
import sys
from pathlib import Path
from runtime_support import FFMPEG, FFPROBE


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def probe(path):
    r = run([
        FFPROBE, "-v", "error", "-show_entries",
        "format=duration:stream=index,codec_type,codec_name,sample_rate,channels",
        "-of", "json", str(path),
    ])
    if r.returncode:
        sys.exit(f"无法读取媒体文件 {path}：\n{r.stderr[-800:]}")
    data = json.loads(r.stdout)
    duration = float(data.get("format", {}).get("duration", 0))
    return duration, data.get("streams", [])


def resolve_media(raw, plan_dir):
    path = Path(os.path.expandvars(os.path.expanduser(str(raw))))
    if not path.is_absolute():
        path = (plan_dir / path).resolve()
    if not path.is_file():
        sys.exit(f"音频文件不存在：{path}")
    duration, streams = probe(path)
    if not any(s.get("codec_type") == "audio" for s in streams):
        sys.exit(f"文件没有音频流：{path}")
    return path, duration


def number(value, label, low=None, high=None):
    try:
        value = float(value)
    except (TypeError, ValueError):
        sys.exit(f"{label} 必须是数字")
    if not math.isfinite(value):
        sys.exit(f"{label} 必须是有限数字")
    if low is not None and value < low:
        sys.exit(f"{label} 不能小于 {low}")
    if high is not None and value > high:
        sys.exit(f"{label} 不能大于 {high}")
    return value


def main():
    ap = argparse.ArgumentParser(description="给口播成片加入低音量 BGM 与定点音效")
    ap.add_argument("video", help="已完成字幕/包装的 MP4")
    ap.add_argument("plan", help="audio_plan.json")
    ap.add_argument("--out", required=True, help="输出目录")
    ap.add_argument("--name", default="preview_字幕包装_音效版.mp4", help="输出文件名")
    ap.add_argument("--dry-run", action="store_true", help="只验证计划，不渲染")
    args = ap.parse_args()

    video = Path(args.video).resolve()
    plan_path = Path(args.plan).resolve()
    if not video.is_file():
        sys.exit(f"视频不存在：{video}")
    if not plan_path.is_file():
        sys.exit(f"计划不存在：{plan_path}")
    video_duration, streams = probe(video)
    if video_duration <= 0 or not any(s.get("codec_type") == "audio" for s in streams):
        sys.exit("输入视频必须包含有效音轨")

    with plan_path.open(encoding="utf-8") as f:
        plan = json.load(f)
    plan_dir = plan_path.parent
    voice_volume = number(plan.get("voice_volume", 1.0), "voice_volume", 0, 2)
    bgm = plan.get("bgm")
    sfx = plan.get("sfx", [])
    if not bgm and not sfx:
        sys.exit("计划中至少需要 bgm 或 sfx")

    inputs = ["-i", str(video)]
    filters = [
        f"[0:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,"
        f"volume={voice_volume:.6f}[voice]"
    ]
    mix_labels = ["[voice]"]
    summary = []
    input_index = 1

    if bgm:
        bgm_path, _ = resolve_media(bgm["file"], plan_dir)
        volume = number(bgm.get("volume", 0.05), "bgm.volume", 0, 1)
        fade_in = number(bgm.get("fade_in", 0.8), "bgm.fade_in", 0, video_duration)
        fade_out = number(bgm.get("fade_out", 1.2), "bgm.fade_out", 0, video_duration)
        start = number(bgm.get("start", 0), "bgm.start", 0, video_duration)
        inputs += ["-stream_loop", "-1", "-i", str(bgm_path)]
        chain = (
            f"[{input_index}:a]aresample=48000,"
            f"aformat=sample_fmts=fltp:channel_layouts=stereo,"
            f"atrim=duration={max(0, video_duration-start):.6f},asetpts=PTS-STARTPTS,"
            f"volume={volume:.6f}"
        )
        if fade_in > 0:
            chain += f",afade=t=in:st=0:d={fade_in:.6f}"
        if fade_out > 0:
            fade_start = max(0, video_duration - start - fade_out)
            chain += f",afade=t=out:st={fade_start:.6f}:d={fade_out:.6f}"
        if start > 0:
            chain += f",adelay={round(start*1000)}:all=1"
        chain += "[bgm]"
        filters.append(chain)
        mix_labels.append("[bgm]")
        summary.append(f"BGM {bgm_path.name} @ {volume:.3f}")
        input_index += 1

    for i, event in enumerate(sfx):
        sfx_path, sfx_duration = resolve_media(event["file"], plan_dir)
        at = number(event.get("at"), f"sfx[{i}].at", 0, video_duration)
        volume = number(event.get("volume", 0.18), f"sfx[{i}].volume", 0, 2)
        trim = number(event.get("duration", sfx_duration), f"sfx[{i}].duration", 0.01)
        trim = min(trim, sfx_duration, max(0.01, video_duration - at))
        inputs += ["-i", str(sfx_path)]
        label = f"sfx{i}"
        filters.append(
            f"[{input_index}:a]aresample=48000,"
            f"aformat=sample_fmts=fltp:channel_layouts=stereo,"
            f"atrim=duration={trim:.6f},asetpts=PTS-STARTPTS,"
            f"volume={volume:.6f},adelay={round(at*1000)}:all=1[{label}]"
        )
        mix_labels.append(f"[{label}]")
        summary.append(f"SFX {at:.3f}s {event.get('name', sfx_path.name)} @ {volume:.3f}")
        input_index += 1

    filters.append(
        "".join(mix_labels)
        + f"amix=inputs={len(mix_labels)}:duration=first:dropout_transition=0:normalize=0,"
          "alimiter=limit=0.95:attack=5:release=50,"
          f"atrim=duration={video_duration:.6f}[aout]"
    )
    out_dir = Path(args.out).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / args.name
    if out_path.resolve() == video:
        sys.exit("输出文件不能覆盖输入视频")

    print(f"✓ 计划有效：视频 {video_duration:.3f}s；" + "；".join(summary))
    if args.dry_run:
        return

    cmd = [
        FFMPEG, "-y", "-loglevel", "error", *inputs,
        "-filter_complex", ";".join(filters),
        "-map", "0:v:0", "-map", "[aout]",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart", "-shortest", str(out_path),
    ]
    r = run(cmd)
    if r.returncode:
        sys.exit(f"混音失败：\n{r.stderr[-1600:]}")
    out_duration, out_streams = probe(out_path)
    if abs(out_duration - video_duration) > 0.12:
        sys.exit(
            f"输出时长异常：输入 {video_duration:.3f}s，输出 {out_duration:.3f}s；"
            f"文件已保留供排查：{out_path}"
        )
    if not any(s.get("codec_type") == "audio" for s in out_streams):
        sys.exit(f"输出缺少音轨：{out_path}")
    print(f"✓ 音效版成片：{out_path}")


if __name__ == "__main__":
    main()
