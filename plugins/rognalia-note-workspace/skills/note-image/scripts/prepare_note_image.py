#!/usr/bin/env python3
"""Center-crop and resize pixels only; never add text or decorative overlays."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import struct
import subprocess
import sys
from pathlib import Path
from typing import Callable, Optional, Tuple

from png_resize import (
    PngResizeError,
    PngResizeUnsupported,
    resize_png_bytes,
    validate_png_bytes,
)


MAX_IMAGE_BYTES = 50_000_000


def png_dimensions(path: Path) -> Optional[Tuple[int, int]]:
    with path.open("rb") as handle:
        header = handle.read(24)
    if header[:8] != b"\x89PNG\r\n\x1a\n" or header[12:16] != b"IHDR":
        return None
    return struct.unpack(">II", header[16:24])


def jpeg_dimensions(path: Path) -> Optional[Tuple[int, int]]:
    sof_markers = {
        0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7,
        0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF,
    }
    with path.open("rb") as handle:
        if handle.read(2) != b"\xff\xd8":
            return None
        while True:
            prefix = handle.read(1)
            if not prefix:
                return None
            if prefix != b"\xff":
                continue
            marker = handle.read(1)
            while marker == b"\xff":
                marker = handle.read(1)
            if not marker or marker in (b"\xd8", b"\xd9"):
                continue
            if marker == b"\xda":
                return None
            length_bytes = handle.read(2)
            if len(length_bytes) != 2:
                return None
            length = struct.unpack(">H", length_bytes)[0]
            if length < 2:
                return None
            if marker[0] in sof_markers:
                payload = handle.read(5)
                if len(payload) != 5:
                    return None
                height, width = struct.unpack(">HH", payload[1:5])
                return width, height
            handle.seek(length - 2, 1)


def command_dimensions(path: Path) -> Optional[Tuple[int, int]]:
    if shutil.which("sips"):
        try:
            result = subprocess.run(
                ["sips", "-g", "pixelWidth", "-g", "pixelHeight", str(path)],
                check=True,
                capture_output=True,
                text=True,
            )
            width = height = None
            for line in result.stdout.splitlines():
                if "pixelWidth:" in line:
                    width = int(line.rsplit(":", 1)[1].strip())
                elif "pixelHeight:" in line:
                    height = int(line.rsplit(":", 1)[1].strip())
            if width and height:
                return width, height
        except (OSError, ValueError, subprocess.CalledProcessError):
            pass
    if shutil.which("identify"):
        try:
            result = subprocess.run(
                ["identify", "-format", "%w %h", str(path)],
                check=True,
                capture_output=True,
                text=True,
            )
            width_text, height_text = result.stdout.strip().split()
            return int(width_text), int(height_text)
        except (OSError, ValueError, subprocess.CalledProcessError):
            pass
    return None


def dimensions(path: Path) -> Tuple[int, int]:
    result = png_dimensions(path) or jpeg_dimensions(path) or command_dimensions(path)
    if result is None:
        raise RuntimeError(f"画像サイズを確認できません: {path}")
    return result


def native_format(path: Path) -> Optional[str]:
    if png_dimensions(path) is not None:
        return "png"
    if jpeg_dimensions(path) is not None:
        return "jpeg"
    return None


def resize_with_pillow(source: Path, output: Path, width: int, height: int) -> bool:
    try:
        from PIL import Image, ImageOps  # type: ignore
    except ImportError:
        return False
    with Image.open(source) as image:
        image = ImageOps.exif_transpose(image)
        resampling = getattr(Image, "Resampling", Image)
        fitted = ImageOps.fit(
            image,
            (width, height),
            method=resampling.LANCZOS,
            centering=(0.5, 0.5),
        )
        fitted.save(output)
    return True


def resize_with_builtin_png(
    source: Path, output: Path, width: int, height: int
) -> bool:
    if png_dimensions(source) is None or output.suffix.lower() != ".png":
        return False
    try:
        resized = resize_png_bytes(source.read_bytes(), width, height)
    except PngResizeUnsupported:
        return False
    except PngResizeError as exc:
        raise RuntimeError(f"PNGの安全な整形を続けられません: {exc}") from exc
    with output.open("xb") as handle:
        handle.write(resized)
        handle.flush()
        os.fsync(handle.fileno())
    return True


def resize_with_imagemagick(
    source: Path, output: Path, width: int, height: int
) -> bool:
    executable = shutil.which("magick") or shutil.which("convert")
    if not executable:
        return False
    subprocess.run(
        [
            executable,
            str(source),
            "-auto-orient",
            "-resize",
            f"{width}x{height}^",
            "-gravity",
            "center",
            "-extent",
            f"{width}x{height}",
            str(output),
        ],
        check=True,
    )
    return True


def resize_with_sips(source: Path, output: Path, width: int, height: int) -> bool:
    if not shutil.which("sips"):
        return False
    source_width, source_height = dimensions(source)
    target_ratio = width / height
    source_ratio = source_width / source_height
    if source_ratio > target_ratio:
        crop_height = source_height
        crop_width = round(source_height * target_ratio)
    else:
        crop_width = source_width
        crop_height = round(source_width / target_ratio)
    shutil.copy2(source, output)
    subprocess.run(
        [
            "sips",
            "--cropToHeightWidth",
            str(crop_height),
            str(crop_width),
            str(output),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
    )
    subprocess.run(
        [
            "sips",
            "--resampleHeightWidth",
            str(height),
            str(width),
            str(output),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
    )
    output_format = "png" if output.suffix.lower() == ".png" else "jpeg"
    subprocess.run(
        [
            "sips",
            "--setProperty",
            "format",
            output_format,
            str(output),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
    )
    return True


def resize_with_ffmpeg(source: Path, output: Path, width: int, height: int) -> bool:
    if not shutil.which("ffmpeg"):
        return False
    video_filter = (
        f"scale={width}:{height}:force_original_aspect_ratio=increase,"
        f"crop={width}:{height}"
    )
    subprocess.run(
        [
            "ffmpeg",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(source),
            "-vf",
            video_filter,
            "-frames:v",
            "1",
            str(output),
        ],
        check=True,
    )
    return True


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="画像を中央基準で切り抜き、note用の寸法へ整えます。"
    )
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--width", type=int, required=True)
    parser.add_argument("--height", type=int, required=True)
    return parser


def main(argv: Optional[list[str]] = None) -> int:
    args = _parser().parse_args(argv)
    if args.width <= 0 or args.height <= 0:
        raise RuntimeError("幅と高さは正の整数で指定してください。")
    if not args.source.is_absolute() or not args.output.is_absolute():
        raise RuntimeError("入力画像と出力先は絶対pathで指定してください。")
    if not args.source.is_file() or args.source.is_symlink():
        raise RuntimeError(f"入力画像が見つからないか安全ではありません: {args.source}")
    if args.source.stat().st_size <= 0 or args.source.stat().st_size > MAX_IMAGE_BYTES:
        raise RuntimeError("入力画像のfile sizeが許容範囲外です。")
    if args.output.exists() or args.output.is_symlink():
        raise RuntimeError(f"出力先がすでに存在します: {args.output}")
    if args.source.resolve() == args.output.resolve():
        raise RuntimeError("入力画像と出力先は分けてください。")
    suffix = args.output.suffix.lower()
    if suffix not in {".png", ".jpg", ".jpeg"}:
        raise RuntimeError("出力形式はPNGまたはJPEGを指定してください。")
    desired_format = "png" if suffix == ".png" else "jpeg"
    args.output.parent.mkdir(parents=True, exist_ok=True)
    if not args.output.parent.is_dir() or args.output.parent.is_symlink():
        raise RuntimeError("出力先のdirectoryが安全ではありません。")

    source_size = dimensions(args.source)
    source_format = native_format(args.source)
    created = False
    try:
        exact_copy = (
            source_size == (args.width, args.height)
            and source_format == desired_format
        )
        if exact_copy and source_format == "png":
            try:
                validate_png_bytes(args.source.read_bytes())
            except PngResizeUnsupported:
                exact_copy = False
            except PngResizeError as exc:
                raise RuntimeError(
                    f"PNGの安全性を確認できません: {exc}"
                ) from exc
        if exact_copy:
            shutil.copy2(args.source, args.output)
            backend = "copy"
        else:
            backends: Tuple[
                Tuple[str, Callable[[Path, Path, int, int], bool]], ...
            ] = (
                ("python-png", resize_with_builtin_png),
                ("pillow", resize_with_pillow),
                ("imagemagick", resize_with_imagemagick),
                ("sips", resize_with_sips),
                ("ffmpeg", resize_with_ffmpeg),
            )
            backend = ""
            for name, handler in backends:
                if handler(args.source, args.output, args.width, args.height):
                    backend = name
                    break
            if not backend:
                raise RuntimeError(
                    "画像を整形できる処理系がありません。Pillow、ImageMagick、sips、"
                    "ffmpegのいずれかが必要です。"
                )
        created = args.output.exists()
        output_size = dimensions(args.output)
        if output_size != (args.width, args.height):
            raise RuntimeError(
                f"出力寸法が一致しません: {output_size[0]}x{output_size[1]}"
            )
        output_format = native_format(args.output)
        if output_format != desired_format:
            raise RuntimeError("出力画像の実形式が拡張子と一致しません。")
        print(
            json.dumps(
                {
                    "status": "created",
                    "backend": backend,
                    "source": str(args.source),
                    "source_width": source_size[0],
                    "source_height": source_size[1],
                    "source_format": source_format,
                    "source_sha256": hashlib.sha256(args.source.read_bytes()).hexdigest(),
                    "output": str(args.output),
                    "output_width": output_size[0],
                    "output_height": output_size[1],
                    "output_format": output_format,
                    "output_sha256": hashlib.sha256(args.output.read_bytes()).hexdigest(),
                    "external_actions": [],
                },
                ensure_ascii=False,
                sort_keys=True,
            )
        )
        return 0
    except Exception:
        if created or args.output.exists():
            try:
                args.output.unlink()
            except FileNotFoundError:
                pass
        raise


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, RuntimeError, subprocess.CalledProcessError) as exc:
        print(f"画像処理に失敗しました: {exc}", file=sys.stderr)
        raise SystemExit(2) from exc
