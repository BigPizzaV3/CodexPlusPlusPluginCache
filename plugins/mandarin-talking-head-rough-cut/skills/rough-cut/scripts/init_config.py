#!/usr/bin/env python3
"""为新用户生成自己的火山 ASR/TOS 配置模板；永不覆盖已有配置。"""
import argparse
import os
import shutil
import sys
from pathlib import Path

SKILL_ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = SKILL_ROOT / "assets/config.example.json"


def main():
    ap = argparse.ArgumentParser(
        description="在当前任务目录生成空白 config.json，供用户填写自己的火山凭证")
    ap.add_argument(
        "--out", default="config.json",
        help="输出配置路径，默认当前目录 config.json")
    args = ap.parse_args()
    out = Path(args.out).expanduser().resolve()
    if out.exists():
        sys.exit(
            f"已存在配置，未覆盖：{out}\n"
            "如需更换账号，请人工确认后编辑或另选 --out 路径。")
    if not TEMPLATE.is_file():
        sys.exit(f"配置模板缺失：{TEMPLATE}")
    out.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(TEMPLATE, out)
    if os.name != "nt":
        os.chmod(out, 0o600)
    print(f"✓ 已生成空白配置：{out}")
    print("下一步：打开该文件，填写你自己的火山 ASR 与 TOS 凭证。")
    print("注意：不要使用他人的账号，不要把真实密钥发给 Agent、写入 Skill 或提交到版本库。")
    print(
        f"填写后检查：使用当前虚拟环境Python运行 {SKILL_ROOT / 'scripts/doctor.py'} "
        f"--config {out}")


if __name__ == "__main__":
    main()
