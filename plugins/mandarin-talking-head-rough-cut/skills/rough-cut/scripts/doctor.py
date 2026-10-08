#!/usr/bin/env python3
"""检查 rough-cut Skill 的本机运行条件；不读取或打印任何密钥。"""
import argparse
import importlib
import importlib.metadata
import json
import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path
from config_loader import config_candidates, load_config
from runtime_support import FFMPEG, FFPROBE

SKILL_ROOT = Path(__file__).resolve().parents[1]


def inspect_config(explicit=None):
    for path in config_candidates(explicit):
        if path.is_file():
            try:
                data, loaded_path = load_config(explicit)
            except Exception as exc:
                return "error", str(path), f"JSON 无法读取：{exc}"
            asr = data.get("volc_asr")
            tos = data.get("volc_tos")
            if not isinstance(asr, dict) or not isinstance(tos, dict):
                return "error", loaded_path, "缺少 volc_asr 或 volc_tos"

            def usable(value):
                text = str(value or "").strip()
                return bool(text) and not any(mark in text for mark in ("填", "如 "))

            api_key_ok = usable(asr.get("api_key"))
            legacy_ok = usable(asr.get("app_id")) and usable(asr.get("access_token"))
            missing = []
            if not (api_key_ok or legacy_ok):
                missing.append("ASR鉴权（api_key 或 app_id＋access_token）")
            if not usable(asr.get("endpoint")):
                missing.append("ASR endpoint")
            for key in ("access_key", "secret_key", "endpoint", "region", "bucket"):
                if not usable(tos.get(key)):
                    missing.append("TOS " + key)
            if missing:
                return "error", loaded_path, "未填写或仍为占位值：" + "、".join(missing)
            return "ok", loaded_path, "结构完整（密钥未显示）"
    return (
        "error", None,
        "未配置用户自己的火山 ASR/TOS。请运行 scripts/init_config.py，"
        "填写自己的账号和密钥；不会自动使用其他用户的账号。")


def main():
    ap = argparse.ArgumentParser(description="检查口播粗剪 Skill 的依赖、字体和可选云端配置")
    ap.add_argument("--config", help="config.json 路径；也可设置 ROUGH_CUT_CONFIG")
    ap.add_argument("--json", action="store_true", help="输出机器可读 JSON")
    ap.add_argument(
        "--allow-no-asr", action="store_true",
        help="只处理已有转写时允许缺少 ASR；首次安装和自动转写前不要使用")
    ap.add_argument(
        "--require-optional", action="store_true",
        help="把剪映草稿等可选依赖也作为必需项检查")
    args = ap.parse_args()

    checks = []
    system = platform.system()
    machine = platform.machine()
    checks.append({
        "name": "操作系统",
        "status": "ok" if system in ("Windows", "Darwin", "Linux") else "warn",
        "detail": f"{system} {platform.release()} ({machine})",
    })
    checks.append({
        "name": "64位环境",
        "status": "ok" if sys.maxsize > 2**32 else "error",
        "detail": "64-bit" if sys.maxsize > 2**32 else "检测到32位Python，请安装64位Python 3.11",
    })
    for binary, resolved in (("ffmpeg", FFMPEG), ("ffprobe", FFPROBE)):
        path = resolved if Path(resolved).is_file() else shutil.which(resolved)
        install_hint = (
            "按 references\\windows_setup.md 运行 scripts\\bootstrap_windows.ps1"
            if system == "Windows"
            else "macOS 可运行 brew install ffmpeg")
        checks.append({
            "name": binary, "status": "ok" if path else "error",
            "detail": str(path) if path else f"未安装；{install_hint}",
        })
    for module, label in (
        ("numpy", "numpy"),
        ("PIL", "Pillow"),
        ("jieba", "jieba"),
        ("tos", "火山TOS SDK"),
        ("requests", "requests"),
        ("crcmod", "crcmod"),
    ):
        try:
            importlib.import_module(module)
            distribution = "Pillow" if module == "PIL" else (
                "tos" if module == "tos" else module)
            try:
                version = importlib.metadata.version(distribution)
            except importlib.metadata.PackageNotFoundError:
                version = None
            ok, detail = True, f"已安装{f'（{version}）' if version else ''}"
        except Exception as exc:
            ok, detail = False, f"无法导入：{type(exc).__name__}: {exc}"
        checks.append({
            "name": label, "status": "ok" if ok else "error",
            "detail": detail if ok else (
                f"{detail}；请重新安装 {SKILL_ROOT / 'requirements.txt'}"),
        })
    try:
        importlib.import_module("pyJianYingDraft")
        optional, optional_detail = True, "已安装"
    except Exception as exc:
        optional = False
        optional_detail = f"无法导入：{type(exc).__name__}: {exc}"
    checks.append({
        "name": "pyJianYingDraft",
        "status": "ok" if optional else ("error" if args.require_optional else "warn"),
        "detail": optional_detail if optional else (
            optional_detail + "；只影响可选剪映草稿"),
    })
    if system == "Windows" and optional:
        try:
            importlib.import_module("uiautomation")
            ui_ok, ui_detail = True, "已安装"
        except Exception as exc:
            ui_ok, ui_detail = False, f"无法导入：{type(exc).__name__}: {exc}"
        checks.append({
            "name": "Windows剪映自动化依赖",
            "status": "ok" if ui_ok else (
                "error" if args.require_optional else "warn"),
            "detail": ui_detail,
        })
    fonts = [
        SKILL_ROOT / "assets/fonts/SourceHanSerifSC-Heavy.otf",
        Path("/System/Library/Fonts/PingFang.ttc"),
        Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts/msyh.ttc",
        Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts/simhei.ttf",
    ]
    font = next((p for p in fonts if p.is_file()), None)
    checks.append({
        "name": "中文字体", "status": "ok" if font else "error",
        "detail": str(font) if font else "未找到 Skill 字体或系统回退字体",
    })
    cfg_status, cfg_path, cfg_detail = inspect_config(args.config)
    if args.allow_no_asr and cfg_status == "error":
        cfg_status = "warn"
        cfg_detail += "（当前仅按“已有转写”模式检查）"
    checks.append({
        "name": "火山配置", "status": cfg_status,
        "detail": f"{cfg_path + '；' if cfg_path else ''}{cfg_detail}",
    })
    checks.append({
        "name": "Python", "status": "ok" if sys.version_info >= (3, 10) else "error",
        "detail": sys.version.split()[0],
    })
    free = shutil.disk_usage(Path.cwd()).free
    checks.append({
        "name": "工作盘剩余空间",
        "status": "ok" if free >= 20 * 1024**3 else "warn",
        "detail": f"{free / 1024**3:.1f} GB（建议至少20GB，4K/长视频建议更多）",
    })
    ffmpeg_path = FFMPEG if Path(FFMPEG).is_file() else shutil.which(FFMPEG)
    if ffmpeg_path:
        enc = subprocess.run(
            [str(ffmpeg_path), "-hide_banner", "-encoders"],
            capture_output=True, text=True, errors="replace")
        encoders = enc.stdout + enc.stderr
        preferred = "h264_nvenc" if system == "Windows" else (
            "h264_videotoolbox" if system == "Darwin" else "libx264")
        has_preferred = preferred in encoders
        checks.append({
            "name": "推荐视频编码器",
            "status": "ok" if has_preferred else "warn",
            "detail": (
                f"{preferred} 可用"
                if has_preferred
                else f"{preferred} 未列出；仍会回退 libx264"),
        })
    if system == "Windows":
        nvidia_smi = shutil.which("nvidia-smi")
        checks.append({
            "name": "NVIDIA驱动",
            "status": "ok" if nvidia_smi else "warn",
            "detail": (
                "检测到 nvidia-smi；NVENC 可在真实渲染时进一步验证"
                if nvidia_smi
                else "未检测到 nvidia-smi；更新显卡驱动后可用NVENC，当前仍可回退CPU编码"),
        })

    ready = not any(c["status"] == "error" for c in checks)
    result = {"ready": ready, "skill_root": str(SKILL_ROOT), "checks": checks}
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        icon = {"ok": "✓", "warn": "△", "error": "✗"}
        for check in checks:
            print(f"{icon[check['status']]} {check['name']}：{check['detail']}")
        print("环境就绪" if ready else "环境未就绪：请先处理上面的 ✗ 项")
    raise SystemExit(0 if ready else 1)


if __name__ == "__main__":
    main()
