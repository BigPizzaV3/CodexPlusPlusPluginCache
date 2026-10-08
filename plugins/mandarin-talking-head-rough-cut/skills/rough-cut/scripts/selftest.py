#!/usr/bin/env python3
"""Cross-platform installation self-test using generated, non-user media."""
import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import runtime_support
from runtime_support import FFMPEG, FFPROBE


def run(command, label):
    result = subprocess.run(
        command, capture_output=True, text=True, errors="replace")
    if result.returncode:
        raise RuntimeError(
            f"{label}失败（exit={result.returncode}）：\n"
            f"{(result.stderr or result.stdout)[-1200:]}")
    return result


def main():
    ap = argparse.ArgumentParser(description="验证UTF-8路径、FFmpeg、脚本入口和成片渲染")
    ap.add_argument("--quick", action="store_true", help="跳过合成视频渲染")
    args = ap.parse_args()
    scripts = Path(__file__).resolve().parent

    # Confirm platform selection logic without depending on the current host.
    original = runtime_support.platform.system
    try:
        runtime_support.platform.system = lambda: "Windows"
        assert runtime_support.encoder_attempts("auto")[0][0] == "NVIDIA NVENC"
        runtime_support.platform.system = lambda: "Darwin"
        assert runtime_support.encoder_attempts("auto")[0][0] == "Apple VideoToolbox"
    finally:
        runtime_support.platform.system = original

    with tempfile.TemporaryDirectory(prefix="rough-cut-selftest-") as tmp:
        root = Path(tmp) / "中文 空格 路径"
        root.mkdir(parents=True)
        sample_json = root / "中文.json"
        sample_json.write_text(
            json.dumps({"字幕": "中文路径正常"}, ensure_ascii=False),
            encoding="utf-8")
        assert json.loads(sample_json.read_text(encoding="utf-8"))["字幕"] == "中文路径正常"

        for script in scripts.glob("*.py"):
            if script.name in ("selftest.py",):
                continue
            run([sys.executable, str(script), "--help"], f"{script.name} --help")

        run([FFPROBE, "-version"], "ffprobe")
        if not args.quick:
            source = root / "测试 输入.mp4"
            generated = [
                FFMPEG, "-y", "-loglevel", "error",
                "-f", "lavfi", "-i", "color=c=blue:s=360x640:r=30:d=1.2",
                "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=1.2",
                "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p",
                "-c:a", "aac", str(source),
            ]
            run(generated, "生成自检视频")
            probe_out = root / "探测 输出"
            run(
                [sys.executable, str(scripts / "probe.py"), str(source),
                 "--out", str(probe_out)],
                "probe.py真实运行")
            cuts = root / "final_cuts.json"
            cuts.write_text(
                json.dumps({"keeps": [{"start": 0.1, "end": 1.0}]}),
                encoding="utf-8")
            render_out = root / "渲染 输出"
            render_out.mkdir()
            run(
                [sys.executable, str(scripts / "render_preview.py"), str(source),
                 str(cuts), "--out", str(render_out), "--encoder", "auto"],
                "render_preview.py真实运行")
            rendered = render_out / "preview.mp4"
            if not rendered.is_file() or rendered.stat().st_size < 1024:
                raise RuntimeError("自检成片未生成或文件异常小")
            run([FFPROBE, "-v", "error", str(rendered)], "自检成片ffprobe")

            visual_plan = root / "visual_plan.json"
            visual_plan.write_text(
                json.dumps({
                    "events": [{
                        "module": "story-portal",
                        "start": 0.1,
                        "end": 0.7,
                        "visual": {"strength": 0.22, "fade": 0.1},
                    }]
                }, ensure_ascii=False),
                encoding="utf-8")
            visual_out = root / "视觉 输出"
            run(
                [sys.executable, str(scripts / "apply_visual_filters.py"),
                 str(rendered), str(visual_plan), "--out", str(visual_out),
                 "--encoder", "auto"],
                "apply_visual_filters.py真实运行")
            visual_video = visual_out / "preview_视觉滤镜.mp4"
            run([FFPROBE, "-v", "error", str(visual_video)], "视觉滤镜成片ffprobe")

            audio_plan = root / "audio_plan.json"
            audio_plan.write_text(
                json.dumps({
                    "voice_volume": 1.0,
                    "sfx": [{
                        "file": str(source),
                        "at": 0.25,
                        "duration": 0.15,
                        "volume": 0.03,
                    }],
                }, ensure_ascii=False),
                encoding="utf-8")
            audio_out = root / "音效 输出"
            run(
                [sys.executable, str(scripts / "mix_bgm_sfx.py"),
                 str(visual_video), str(audio_plan), "--out", str(audio_out)],
                "mix_bgm_sfx.py真实运行")
            audio_video = audio_out / "preview_字幕包装_音效版.mp4"
            run([FFPROBE, "-v", "error", str(audio_video)], "音效成片ffprobe")

    print(
        "✓ 跨平台自检通过：UTF-8路径、脚本入口、FFmpeg、视觉滤镜、"
        "音效混音和成片渲染均正常")


if __name__ == "__main__":
    main()
