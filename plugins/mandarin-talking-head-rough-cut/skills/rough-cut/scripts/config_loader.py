#!/usr/bin/env python3
"""Load rough-cut JSON configuration without embedding service credentials."""
from __future__ import annotations

import json
import os
from pathlib import Path


def config_candidates(explicit=None):
    values = []
    if explicit:
        values.append(Path(explicit).expanduser())
    if os.environ.get("ROUGH_CUT_CONFIG"):
        values.append(Path(os.environ["ROUGH_CUT_CONFIG"]).expanduser())
    values.append(Path.cwd() / "config.json")
    return values


def _expand_env(value):
    if isinstance(value, dict):
        return {key: _expand_env(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_expand_env(item) for item in value]
    if isinstance(value, str) and value.startswith("${") and value.endswith("}"):
        name = value[2:-1]
        if name and all(char.isupper() or char.isdigit() or char == "_" for char in name):
            return os.environ.get(name, "")
    return value


def load_config(explicit=None):
    for path in config_candidates(explicit):
        if path.is_file():
            data = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(data, dict):
                raise ValueError(f"配置根节点必须是 JSON 对象：{path}")
            return _expand_env(data), str(path)
    raise FileNotFoundError(
        "未找到配置。请使用 --config、ROUGH_CUT_CONFIG 或当前任务目录的 "
        "config.json；系统不会搜索其他目录或复用其他用户的账号。")
