#!/usr/bin/env python3
"""Deterministic, standard-library PNG center-crop resizing for note thumbnails."""

from __future__ import annotations

import binascii
import struct
import zlib
from typing import List, Tuple


PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
MAX_PNG_INPUT_BYTES = 50_000_000
MAX_SOURCE_PIXELS = 16_000_000


class PngResizeError(ValueError):
    """Raised when a PNG cannot be resized by the built-in safe path."""


class PngResizeUnsupported(PngResizeError):
    """Raised for a valid PNG encoding that the built-in path does not support."""


def _chunk(kind: bytes, payload: bytes) -> bytes:
    checksum = binascii.crc32(kind + payload) & 0xFFFFFFFF
    return (
        struct.pack(">I", len(payload))
        + kind
        + payload
        + struct.pack(">I", checksum)
    )


def _paeth(left: int, above: int, upper_left: int) -> int:
    estimate = left + above - upper_left
    left_distance = abs(estimate - left)
    above_distance = abs(estimate - above)
    upper_left_distance = abs(estimate - upper_left)
    if left_distance <= above_distance and left_distance <= upper_left_distance:
        return left
    if above_distance <= upper_left_distance:
        return above
    return upper_left


def _decode_rows(data: bytes) -> Tuple[int, int, int, List[bytes]]:
    if len(data) > MAX_PNG_INPUT_BYTES:
        raise PngResizeError("PNG input exceeds the built-in safety limit")
    if not data.startswith(PNG_SIGNATURE):
        raise PngResizeError("input is not a PNG")
    offset = len(PNG_SIGNATURE)
    width = height = channels = 0
    compressed = bytearray()
    saw_iend = False
    while offset + 12 <= len(data):
        length = struct.unpack(">I", data[offset : offset + 4])[0]
        kind = data[offset + 4 : offset + 8]
        end = offset + 12 + length
        if end > len(data):
            raise PngResizeError("PNG chunk is truncated")
        payload = data[offset + 8 : offset + 8 + length]
        stored_crc = struct.unpack(">I", data[offset + 8 + length : end])[0]
        if (binascii.crc32(kind + payload) & 0xFFFFFFFF) != stored_crc:
            raise PngResizeError("PNG chunk checksum is invalid")
        if kind == b"IHDR":
            if width or length != 13:
                raise PngResizeError("PNG header is invalid")
            width, height, bit_depth, color_type, compression, filtering, interlace = (
                struct.unpack(">IIBBBBB", payload)
            )
            if width < 1 or height < 1:
                raise PngResizeError("PNG dimensions are invalid")
            if bit_depth != 8 or color_type not in {2, 6}:
                raise PngResizeUnsupported(
                    "built-in PNG resize supports 8-bit RGB or RGBA images"
                )
            if compression != 0 or filtering != 0 or interlace != 0:
                raise PngResizeUnsupported(
                    "built-in PNG resize requires non-interlaced standard PNG encoding"
                )
            channels = 3 if color_type == 2 else 4
            if width * height > MAX_SOURCE_PIXELS:
                raise PngResizeError("PNG dimensions exceed the built-in safety limit")
        elif kind == b"IDAT":
            compressed.extend(payload)
        elif kind == b"IEND":
            if length != 0 or end != len(data):
                raise PngResizeError("PNG ending is invalid")
            saw_iend = True
            break
        offset = end
    if not width or not compressed or not saw_iend:
        raise PngResizeError("PNG structure is incomplete")
    stride = width * channels
    expected = height * (stride + 1)
    try:
        decompressor = zlib.decompressobj()
        raw = decompressor.decompress(bytes(compressed), expected + 1)
    except zlib.error as exc:
        raise PngResizeError("PNG pixel data is invalid") from exc
    if len(raw) > expected or decompressor.unconsumed_tail:
        raise PngResizeError("PNG pixel data exceeds the declared dimensions")
    if not decompressor.eof or decompressor.unused_data:
        raise PngResizeError("PNG compressed stream is incomplete or has trailing data")
    if len(raw) != expected:
        raise PngResizeError("PNG pixel data length is invalid")
    rows: List[bytes] = []
    previous = bytearray(stride)
    cursor = 0
    for _ in range(height):
        filter_type = raw[cursor]
        cursor += 1
        filtered = raw[cursor : cursor + stride]
        cursor += stride
        reconstructed = bytearray(stride)
        for index, value in enumerate(filtered):
            left = reconstructed[index - channels] if index >= channels else 0
            above = previous[index]
            upper_left = previous[index - channels] if index >= channels else 0
            if filter_type == 0:
                predictor = 0
            elif filter_type == 1:
                predictor = left
            elif filter_type == 2:
                predictor = above
            elif filter_type == 3:
                predictor = (left + above) // 2
            elif filter_type == 4:
                predictor = _paeth(left, above, upper_left)
            else:
                raise PngResizeError("PNG uses an unsupported row filter")
            reconstructed[index] = (value + predictor) & 0xFF
        rows.append(bytes(reconstructed))
        previous = reconstructed
    return width, height, channels, rows


def _axis_samples(
    source_length: int,
    crop_start: float,
    crop_length: float,
    target_length: int,
) -> List[Tuple[int, int, float]]:
    samples: List[Tuple[int, int, float]] = []
    for target_index in range(target_length):
        position = (
            crop_start
            + (target_index + 0.5) * crop_length / target_length
            - 0.5
        )
        position = min(max(position, 0.0), source_length - 1.0)
        lower = int(position)
        upper = min(lower + 1, source_length - 1)
        samples.append((lower, upper, position - lower))
    return samples


def validate_png_bytes(data: bytes) -> Tuple[int, int, int]:
    width, height, channels, _ = _decode_rows(data)
    return width, height, channels


def resize_png_bytes(data: bytes, width: int, height: int) -> bytes:
    if width < 1 or height < 1:
        raise PngResizeError("target dimensions must be positive")
    if width * height > MAX_SOURCE_PIXELS:
        raise PngResizeError("target dimensions exceed the built-in safety limit")
    source_width, source_height, channels, rows = _decode_rows(data)
    target_ratio = width / height
    source_ratio = source_width / source_height
    if source_ratio > target_ratio:
        crop_height = float(source_height)
        crop_width = crop_height * target_ratio
        crop_left = (source_width - crop_width) / 2.0
        crop_top = 0.0
    else:
        crop_width = float(source_width)
        crop_height = crop_width / target_ratio
        crop_left = 0.0
        crop_top = (source_height - crop_height) / 2.0
    x_samples = _axis_samples(source_width, crop_left, crop_width, width)
    y_samples = _axis_samples(source_height, crop_top, crop_height, height)
    output = bytearray()
    for y0, y1, y_weight in y_samples:
        output.append(0)
        row0 = rows[y0]
        row1 = rows[y1]
        for x0, x1, x_weight in x_samples:
            offset00 = x0 * channels
            offset01 = x1 * channels
            offset10 = x0 * channels
            offset11 = x1 * channels
            if channels == 4:
                weights = (
                    (1.0 - x_weight) * (1.0 - y_weight),
                    x_weight * (1.0 - y_weight),
                    (1.0 - x_weight) * y_weight,
                    x_weight * y_weight,
                )
                pixels = (
                    row0[offset00 : offset00 + 4],
                    row0[offset01 : offset01 + 4],
                    row1[offset10 : offset10 + 4],
                    row1[offset11 : offset11 + 4],
                )
                alpha = sum(pixel[3] * weight for pixel, weight in zip(pixels, weights))
                if alpha <= 0.0:
                    output.extend((0, 0, 0, 0))
                else:
                    for channel in range(3):
                        premultiplied = sum(
                            pixel[channel] * pixel[3] * weight / 255.0
                            for pixel, weight in zip(pixels, weights)
                        )
                        value = round(premultiplied * 255.0 / alpha)
                        output.append(min(255, max(0, value)))
                    output.append(min(255, max(0, round(alpha))))
                continue
            for channel in range(3):
                top = (
                    row0[offset00 + channel] * (1.0 - x_weight)
                    + row0[offset01 + channel] * x_weight
                )
                bottom = (
                    row1[offset00 + channel] * (1.0 - x_weight)
                    + row1[offset01 + channel] * x_weight
                )
                value = round(top * (1.0 - y_weight) + bottom * y_weight)
                output.append(min(255, max(0, value)))
    color_type = 2 if channels == 3 else 6
    header = struct.pack(">IIBBBBB", width, height, 8, color_type, 0, 0, 0)
    return (
        PNG_SIGNATURE
        + _chunk(b"IHDR", header)
        + _chunk(b"IDAT", zlib.compress(bytes(output), 9))
        + _chunk(b"IEND", b"")
    )
