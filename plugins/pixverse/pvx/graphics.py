"""Deterministic Pillow graphics for word-anchored compositions.

Each component renders one or more transparent PNG states at the full canvas size, so the
composer can overlay them at (0,0) and switch states on script anchors. Components are data
driven: a JSON spec selects the component, the canvas and the states to render.

Components:
  tier-board     rows S/A/B/C/D (configurable) with icons placed per state
  ranked-column  numbered rows revealed per state
  comment-card   a social comment card (name, text, likes)
  reveal-strip   a horizontal strip of slots revealed left to right (emoji/icon/text)
  lower-third    name + subtitle plate
  split-frame    divider and rounded masks for a two-host split layout
  highlight-box  a rounded outline to point at a screen region
  label          a single text label plate (title, verdict, sticker)
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont

FONT_CANDIDATES = {
    "display": (
        "/System/Library/Fonts/Supplemental/Arial Black.ttf",
        "/System/Library/Fonts/Supplemental/Impact.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "C:/Windows/Fonts/ariblk.ttf",
        "C:/Windows/Fonts/impact.ttf",
    ),
    "text": (
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
    ),
    "cjk": (
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/Hiragino Sans GB.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "C:/Windows/Fonts/msyhbd.ttc",
        "C:/Windows/Fonts/msyh.ttc",
    ),
    "emoji": (
        "/System/Library/Fonts/Apple Color Emoji.ttc",
        "/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf",
        "C:/Windows/Fonts/seguiemj.ttf",
    ),
}
TIER_COLORS = {
    "S": (255, 127, 127), "A": (255, 191, 127), "B": (255, 255, 127), "C": (191, 255, 127),
    "D": (127, 191, 255), "E": (191, 127, 255), "F": (255, 127, 191),
}


EMOJI_RE = re.compile(
    "[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F1E6-\U0001F1FF\U00002B00-\U00002BFF\U0000FE0F\U0000200D]+"
)
_EMOJI_BITMAP_SIZE = 109  # Apple Color Emoji ships fixed bitmap strikes; 109 is always present


def _emoji_font():
    for candidate in FONT_CANDIDATES["emoji"]:
        for size in (_EMOJI_BITMAP_SIZE, 136, 96):
            try:
                return ImageFont.truetype(candidate, size)
            except OSError:
                continue
    return None


def _runs(text: str) -> list[tuple[str, bool]]:
    runs: list[tuple[str, bool]] = []
    pos = 0
    for match in EMOJI_RE.finditer(text):
        if match.start() > pos:
            runs.append((text[pos:match.start()], False))
        runs.append((match.group(0), True))
        pos = match.end()
    if pos < len(text):
        runs.append((text[pos:], False))
    return runs


def measure_mixed(draw: ImageDraw.ImageDraw, text: str, font) -> tuple[int, int]:
    """Width/height of a line that may mix emoji and text."""
    line_h = int(font.size * 1.25)
    width = 0
    for run, is_emoji in _runs(text):
        if is_emoji:
            width += int(font.size * 1.15) * max(1, len(EMOJI_RE.findall(run)))
        else:
            box = draw.textbbox((0, 0), run, font=font)
            width += box[2] - box[0]
    return width, line_h


def draw_mixed(canvas: Image.Image, xy: tuple[int, int], text: str, font, fill, *, stroke_width: int = 0, stroke_fill=None) -> int:
    """Draw text with colour emoji fallback. Returns the drawn width. `xy` is the top-left."""
    draw = ImageDraw.Draw(canvas)
    x, y = xy
    line_h = int(font.size * 1.25)
    emoji_font = None
    for run, is_emoji in _runs(text):
        if not is_emoji:
            draw.text((x, y), run, font=font, fill=fill, stroke_width=stroke_width, stroke_fill=stroke_fill)
            box = draw.textbbox((x, y), run, font=font)
            x = box[2]
            continue
        emoji_font = emoji_font or _emoji_font()
        for glyph in EMOJI_RE.findall(run) or [run]:
            cell = int(font.size * 1.15)
            if emoji_font is None:
                draw.text((x, y), glyph, font=font, fill=fill)
            else:
                tile = Image.new("RGBA", (_EMOJI_BITMAP_SIZE * 2, _EMOJI_BITMAP_SIZE * 2), (0, 0, 0, 0))
                try:
                    ImageDraw.Draw(tile).text((10, 10), glyph, font=emoji_font, embedded_color=True)
                except TypeError:  # pragma: no cover - older Pillow
                    ImageDraw.Draw(tile).text((10, 10), glyph, font=emoji_font)
                bbox = tile.getbbox()
                if bbox:
                    glyph_im = tile.crop(bbox)
                    scale = cell / max(glyph_im.width, glyph_im.height)
                    glyph_im = glyph_im.resize((max(1, int(glyph_im.width * scale)), max(1, int(glyph_im.height * scale))), Image.LANCZOS)
                    canvas.alpha_composite(glyph_im, (int(x), int(y + (line_h - glyph_im.height) / 2)))
            x += cell
    return int(x - xy[0])


def _has_cjk(text: str) -> bool:
    return any("\u3040" <= ch <= "\u30ff" or "\u3400" <= ch <= "\u9fff" or "\uac00" <= ch <= "\ud7af" for ch in text)


def load_font(size: int, *, kind: str = "display", text: str = "", explicit: str | None = None):
    candidates: list[str] = []
    if explicit:
        candidates.append(explicit)
    if text and _has_cjk(text):
        candidates.extend(FONT_CANDIDATES["cjk"])
    candidates.extend(FONT_CANDIDATES.get(kind, ()))
    candidates.extend(FONT_CANDIDATES["text"])
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default()


def _rgba(value: Any, default: tuple[int, int, int, int] = (0, 0, 0, 255)) -> tuple[int, int, int, int]:
    if value is None:
        return default
    if isinstance(value, (list, tuple)):
        parts = [int(v) for v in value]
        return tuple(parts + [255] * (4 - len(parts)))[:4]  # type: ignore[return-value]
    text = str(value).strip().lstrip("#")
    if len(text) == 6:
        text += "FF"
    if len(text) != 8:
        raise ValueError(f"colour must be #RRGGBB or #RRGGBBAA, got {value!r}")
    return tuple(int(text[i:i + 2], 16) for i in (0, 2, 4, 6))  # type: ignore[return-value]


def _icon(path: str | Path, size: int, *, shape: str = "circle") -> Image.Image:
    im = Image.open(path).convert("RGBA")
    side = min(im.size)
    im = im.crop(((im.width - side) // 2, (im.height - side) // 2, (im.width + side) // 2, (im.height + side) // 2))
    im = im.resize((size, size), Image.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    if shape == "circle":
        ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    else:
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=size // 6, fill=255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    ImageDraw.Draw(out).ellipse((0, 0, size - 1, size - 1), outline=(255, 255, 255, 255), width=max(2, size // 20)) if shape == "circle" else None
    return out


def _canvas(spec: dict[str, Any]) -> Image.Image:
    canvas = spec.get("canvas") or {}
    return Image.new("RGBA", (int(canvas.get("width", 1080)), int(canvas.get("height", 1920))), (0, 0, 0, 0))


def _text_size(draw: ImageDraw.ImageDraw, text: str, font) -> tuple[int, int]:
    box = draw.textbbox((0, 0), text, font=font)
    return box[2] - box[0], box[3] - box[1]


# ---------------------------------------------------------------------------
# Components
# ---------------------------------------------------------------------------


def tier_board(spec: dict[str, Any], state: dict[str, Any]) -> Image.Image:
    """state: {"placed": {"S": ["coffee"], "D": ["tea"]}} using icon keys from spec["icons"]."""
    board = _canvas(spec)
    d = ImageDraw.Draw(board)
    tiers = list(spec.get("tiers") or ["S", "A", "B", "C", "D"])
    x0 = int(spec.get("x", 44)); y0 = int(spec.get("y", 1010))
    width = int(spec.get("width", 470)); row_h = int(spec.get("row_height", 96))
    gap = int(spec.get("gap", 8)); label_w = int(spec.get("label_width", 96))
    icon_size = int(spec.get("icon_size", max(40, row_h - gap - 20)))
    font = load_font(int(spec.get("font_size", 52)), kind="display", explicit=spec.get("font"))
    plate = _rgba(spec.get("plate_color"), (20, 20, 24, 215))
    icons: dict[str, Image.Image] = {}
    for key, path in (spec.get("icons") or {}).items():
        icons[key] = _icon(path, icon_size, shape=str(spec.get("icon_shape", "circle")))
    placed = state.get("placed") or {}
    for i, tier in enumerate(tiers):
        y = y0 + i * row_h
        colour = _rgba((spec.get("tier_colors") or {}).get(tier), TIER_COLORS.get(tier, (200, 200, 200)) + (255,))
        d.rounded_rectangle((x0, y, x0 + width, y + row_h - gap), radius=14, fill=plate)
        d.rounded_rectangle((x0, y, x0 + label_w, y + row_h - gap), radius=14, fill=colour)
        d.text((x0 + label_w / 2, y + (row_h - gap) / 2), tier, font=font, fill=(20, 20, 20, 255), anchor="mm")
        for k, key in enumerate(placed.get(tier) or []):
            cx = x0 + label_w + 16 + k * (icon_size + 10)
            cy = y + (row_h - gap - icon_size) // 2
            if key in icons:
                board.alpha_composite(icons[key], (cx, cy))
            else:
                small = load_font(int(icon_size * 0.55), kind="text", text=key)
                d.text((cx, cy + icon_size // 2), key, font=small, fill=(255, 255, 255, 255), anchor="lm")
    return board


def ranked_column(spec: dict[str, Any], state: dict[str, Any]) -> Image.Image:
    """state: {"revealed": ["rank-1", "rank-3"]} against spec rows [{"id","rank","label","icon"}]."""
    board = _canvas(spec)
    d = ImageDraw.Draw(board)
    rows = sorted(spec.get("rows") or [], key=lambda r: int(r.get("rank", 0)))
    x0 = int(spec.get("x", 44)); y0 = int(spec.get("y", 900)); width = int(spec.get("width", 520))
    row_h = int(spec.get("row_height", 92)); gap = int(spec.get("gap", 10))
    font = load_font(int(spec.get("font_size", 40)), kind="display", explicit=spec.get("font"))
    num_font = load_font(int(spec.get("font_size", 40)), kind="display")
    revealed = set(state.get("revealed") or [])
    for i, row in enumerate(rows):
        y = y0 + i * row_h
        shown = row.get("id") in revealed or bool(row.get("preset"))
        d.rounded_rectangle((x0, y, x0 + width, y + row_h - gap), radius=14, fill=(20, 20, 24, 215 if shown else 120))
        d.text((x0 + 36, y + (row_h - gap) / 2), str(row.get("rank")), font=num_font, fill=(255, 224, 96, 255), anchor="mm")
        if shown:
            label = str(row.get("label") or "")
            d.text((x0 + 84, y + (row_h - gap) / 2), label, font=load_font(int(spec.get("font_size", 40)), kind="display", text=label, explicit=spec.get("font")), fill=(255, 255, 255, 255), anchor="lm")
        else:
            d.text((x0 + 84, y + (row_h - gap) / 2), "???", font=font, fill=(160, 160, 160, 255), anchor="lm")
    return board


def comment_card(spec: dict[str, Any], state: dict[str, Any]) -> Image.Image:
    """A social-comment card. state: {"name","text","likes","avatar"} (falls back to spec)."""
    canvas = _canvas(spec)
    data = {**spec, **state}
    x = int(data.get("x", 60)); y = int(data.get("y", 420)); width = int(data.get("width", 760))
    name = str(data.get("name") or "user"); text = str(data.get("text") or "")
    likes = data.get("likes")
    name_font = load_font(int(data.get("name_size", 34)), kind="text", text=name)
    text_font = load_font(int(data.get("text_size", 40)), kind="text", text=text)
    d = ImageDraw.Draw(canvas)
    pad = 28; avatar = 72
    lines = _wrap_text(d, text, text_font, width - pad * 2 - avatar - 20)
    line_h = int(text_font.size * 1.3)
    height = pad * 2 + 44 + line_h * max(1, len(lines)) + (44 if likes is not None else 0)
    d.rounded_rectangle((x, y, x + width, y + height), radius=26, fill=_rgba(data.get("plate_color"), (255, 255, 255, 240)))
    ax, ay = x + pad, y + pad
    if data.get("avatar") and Path(str(data["avatar"])).is_file():
        canvas.alpha_composite(_icon(str(data["avatar"]), avatar), (ax, ay))
    else:
        d.ellipse((ax, ay, ax + avatar, ay + avatar), fill=_rgba(data.get("avatar_color"), (104, 81, 235, 255)))
        d.text((ax + avatar / 2, ay + avatar / 2), name[:1].upper(), font=load_font(36, kind="display"), fill=(255, 255, 255, 255), anchor="mm")
    tx = ax + avatar + 20
    draw_mixed(canvas, (tx, ay), name, name_font, (40, 40, 40, 255))
    ty = ay + 44
    for line in lines:
        draw_mixed(canvas, (tx, ty), line, text_font, (20, 20, 20, 255))
        ty += line_h
    if likes is not None:
        draw_mixed(canvas, (tx, ty + 6), f"\u2665 {likes}", load_font(30, kind="text"), (235, 64, 96, 255))
    return canvas


def reveal_strip(spec: dict[str, Any], state: dict[str, Any]) -> Image.Image:
    """Slots revealed left to right. spec slots: [{"text": "<emoji>"} or {"icon": path}]; state: {"revealed": n}."""
    canvas = _canvas(spec)
    d = ImageDraw.Draw(canvas)
    slots = list(spec.get("slots") or [])
    n = max(1, len(slots))
    y = int(spec.get("y", 120)); size = int(spec.get("slot_size", 150)); gap = int(spec.get("gap", 24))
    total = n * size + (n - 1) * gap
    x0 = int(spec.get("x", (canvas.width - total) // 2))
    revealed = int(state.get("revealed", 0))
    for i, slot in enumerate(slots):
        x = x0 + i * (size + gap)
        shown = i < revealed
        d.rounded_rectangle((x, y, x + size, y + size), radius=size // 5,
                            fill=_rgba(spec.get("plate_color"), (255, 255, 255, 235)) if shown else (255, 255, 255, 90))
        if not shown:
            d.text((x + size / 2, y + size / 2), "?", font=load_font(int(size * 0.5), kind="display"), fill=(90, 90, 90, 255), anchor="mm")
            continue
        if slot.get("icon") and Path(str(slot["icon"])).is_file():
            canvas.alpha_composite(_icon(str(slot["icon"]), size - 24, shape="rounded"), (x + 12, y + 12))
        else:
            text = str(slot.get("text") or "")
            emoji = bool(EMOJI_RE.fullmatch(text.strip()))
            font = load_font(int(size * (0.62 if emoji else 0.34)), kind="display", text=text)
            tw, th = measure_mixed(d, text, font)
            draw_mixed(canvas, (int(x + (size - tw) / 2), int(y + (size - th) / 2)), text, font, (20, 20, 20, 255))
    return canvas


def lower_third(spec: dict[str, Any], state: dict[str, Any]) -> Image.Image:
    canvas = _canvas(spec)
    data = {**spec, **state}
    d = ImageDraw.Draw(canvas)
    name = str(data.get("name") or ""); subtitle = str(data.get("subtitle") or "")
    x = int(data.get("x", 60)); y = int(data.get("y", canvas.height - 560))
    name_font = load_font(int(data.get("name_size", 56)), kind="display", text=name, explicit=data.get("font"))
    sub_font = load_font(int(data.get("subtitle_size", 34)), kind="text", text=subtitle)
    nw, nh = measure_mixed(d, name, name_font)
    sw, sh = measure_mixed(d, subtitle, sub_font) if subtitle else (0, 0)
    width = max(nw, sw) + 64
    height = nh + (sh + 8 if subtitle else 0) + 40
    d.rounded_rectangle((x, y, x + width, y + height), radius=18, fill=_rgba(data.get("plate_color"), (16, 16, 20, 220)))
    d.rectangle((x, y, x + 12, y + height), fill=_rgba(data.get("accent_color"), (104, 81, 235, 255)))
    draw_mixed(canvas, (x + 36, y + 20), name, name_font, (255, 255, 255, 255))
    if subtitle:
        draw_mixed(canvas, (x + 36, y + 20 + nh + 8), subtitle, sub_font, (220, 220, 220, 255))
    return canvas


def split_frame(spec: dict[str, Any], state: dict[str, Any]) -> Image.Image:
    """A divider (and optional speaker highlight) for a top/bottom or left/right split layout."""
    canvas = _canvas(spec)
    d = ImageDraw.Draw(canvas)
    orientation = str(spec.get("orientation", "horizontal"))
    thickness = int(spec.get("thickness", 10))
    colour = _rgba(spec.get("color"), (255, 255, 255, 255))
    active = state.get("active")  # "top" | "bottom" | "left" | "right" | None
    hl = _rgba(spec.get("highlight_color"), (255, 224, 96, 255))
    w, h = canvas.size
    if orientation == "horizontal":
        y = int(spec.get("at", h // 2))
        d.rectangle((0, y - thickness // 2, w, y + thickness // 2), fill=colour)
        if active == "top":
            d.rectangle((0, 0, w, y - thickness // 2), outline=hl, width=thickness)
        elif active == "bottom":
            d.rectangle((0, y + thickness // 2, w, h), outline=hl, width=thickness)
    else:
        x = int(spec.get("at", w // 2))
        d.rectangle((x - thickness // 2, 0, x + thickness // 2, h), fill=colour)
        if active == "left":
            d.rectangle((0, 0, x - thickness // 2, h), outline=hl, width=thickness)
        elif active == "right":
            d.rectangle((x + thickness // 2, 0, w, h), outline=hl, width=thickness)
    return canvas


def highlight_box(spec: dict[str, Any], state: dict[str, Any]) -> Image.Image:
    canvas = _canvas(spec)
    data = {**spec, **state}
    d = ImageDraw.Draw(canvas)
    x = int(data.get("x", 100)); y = int(data.get("y", 100)); w = int(data.get("w", 400)); h = int(data.get("h", 200))
    d.rounded_rectangle((x, y, x + w, y + h), radius=int(data.get("radius", 18)),
                        outline=_rgba(data.get("color"), (255, 64, 64, 255)), width=int(data.get("thickness", 8)))
    if data.get("dim_outside"):
        overlay = Image.new("RGBA", canvas.size, (0, 0, 0, int(data.get("dim_alpha", 110))))
        hole = Image.new("L", canvas.size, 255)
        ImageDraw.Draw(hole).rounded_rectangle((x, y, x + w, y + h), radius=int(data.get("radius", 18)), fill=0)
        overlay.putalpha(hole.point(lambda v: int(data.get("dim_alpha", 110)) if v else 0))
        canvas = Image.alpha_composite(overlay, canvas)
    return canvas


def label(spec: dict[str, Any], state: dict[str, Any]) -> Image.Image:
    """A single text plate: title, verdict word, sticker. Rotation and colours are spec choices."""
    canvas = _canvas(spec)
    data = {**spec, **state}
    text = str(data.get("text") or "")
    font = load_font(int(data.get("font_size", 120)), kind="display", text=text, explicit=data.get("font"))
    tmp = Image.new("RGBA", (10, 10))
    tw, th = _text_size(ImageDraw.Draw(tmp), text, font)
    pad = int(data.get("padding", 28))
    plate = Image.new("RGBA", (tw + pad * 2, th + pad * 2), (0, 0, 0, 0))
    pd = ImageDraw.Draw(plate)
    if data.get("plate_color"):
        pd.rounded_rectangle((0, 0, plate.width - 1, plate.height - 1), radius=int(data.get("radius", 22)), fill=_rgba(data["plate_color"]))
    stroke = int(data.get("stroke", 0))
    pd.text((pad, pad - th * 0.15), text, font=font, fill=_rgba(data.get("color"), (255, 255, 255, 255)),
            stroke_width=stroke, stroke_fill=_rgba(data.get("stroke_color"), (0, 0, 0, 255)))
    angle = float(data.get("rotate", 0))
    if angle:
        plate = plate.rotate(angle, expand=True, resample=Image.BICUBIC)
    cx = int(data.get("x", canvas.width // 2)); cy = int(data.get("y", canvas.height // 5))
    canvas.alpha_composite(plate, (cx - plate.width // 2, cy - plate.height // 2))
    return canvas


def kinetic_text(spec: dict[str, Any], state: dict[str, Any]) -> Image.Image:
    """Styled lettering from a style pack (see pvx.kinetic.STYLE_PACKS), placed by centre.

    spec: pack, overrides, canvas; state: text, x, y (centre; px or %), seed, pack/overrides overrides.
    """
    from . import kinetic

    canvas = _canvas(spec)
    data = {**spec, **state}
    text = str(data.get("text") or "")
    overrides = {**(spec.get("overrides") or {}), **(state.get("overrides") or {})}
    for key in ("size", "rotate", "jitter", "fill", "font"):
        if key in state:
            overrides[key] = state[key]
    element = kinetic.render_kinetic_text(text, str(data.get("pack") or "variety-title"), overrides=overrides, seed=int(data.get("seed", 7)))
    cx = _coord(data.get("x", "50%"), canvas.width); cy = _coord(data.get("y", "20%"), canvas.height)
    canvas.alpha_composite(element, (cx - element.width // 2, cy - element.height // 2))
    return canvas


def sticker(spec: dict[str, Any], state: dict[str, Any]) -> Image.Image:
    """A cut-out sticker from a flat-background image (generated or supplied), with outline and shadow."""
    from . import kinetic

    canvas = _canvas(spec)
    data = {**spec, **state}
    element = kinetic.cutout_sticker(
        str(data["source"]), key_color=data.get("key_color"), tolerance=int(data.get("tolerance", 40)),
        outline=int(data.get("outline", 14)), outline_color=data.get("outline_color", "#FFFFFF"),
        shadow=bool(data.get("shadow", True)), size=int(data.get("size", 420)),
    )
    if data.get("flip"):
        element = element.transpose(Image.FLIP_LEFT_RIGHT)
    angle = float(data.get("rotate", 0))
    if angle:
        element = element.rotate(angle, resample=Image.BICUBIC, expand=True)
    cx = _coord(data.get("x", "80%"), canvas.width); cy = _coord(data.get("y", "30%"), canvas.height)
    canvas.alpha_composite(element, (cx - element.width // 2, cy - element.height // 2))
    return canvas


def emoji_sticker(spec: dict[str, Any], state: dict[str, Any]) -> Image.Image:
    """A large colour emoji with a white sticker outline and shadow."""
    from . import kinetic

    canvas = _canvas(spec)
    data = {**spec, **state}
    element = kinetic.emoji_sticker(str(data.get("text") or "\U0001F602"), size=int(data.get("size", 220)), outline=int(data.get("outline", 10)))
    angle = float(data.get("rotate", 0))
    if angle:
        element = element.rotate(angle, resample=Image.BICUBIC, expand=True)
    cx = _coord(data.get("x", "80%"), canvas.width); cy = _coord(data.get("y", "30%"), canvas.height)
    canvas.alpha_composite(element, (cx - element.width // 2, cy - element.height // 2))
    return canvas


def _coord(value: Any, total: int) -> int:
    if isinstance(value, str) and value.strip().endswith("%"):
        return int(round(total * float(value.strip()[:-1]) / 100.0))
    return int(round(float(value)))


COMPONENTS = {
    "tier-board": tier_board,
    "ranked-column": ranked_column,
    "comment-card": comment_card,
    "reveal-strip": reveal_strip,
    "lower-third": lower_third,
    "split-frame": split_frame,
    "highlight-box": highlight_box,
    "label": label,
    "kinetic-text": kinetic_text,
    "sticker": sticker,
    "emoji-sticker": emoji_sticker,
}


def _wrap_text(draw: ImageDraw.ImageDraw, text: str, font, max_width: int) -> list[str]:
    if _has_cjk(text):
        lines: list[str] = []
        current = ""
        for ch in text:
            if _text_size(draw, current + ch, font)[0] > max_width and current:
                lines.append(current)
                current = ch
            else:
                current += ch
        if current:
            lines.append(current)
        return lines or [""]
    words = text.split()
    lines = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if measure_mixed(draw, candidate, font)[0] > max_width and current:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines or [""]


def render_spec(spec: dict[str, Any], to_dir: str | Path) -> list[dict[str, Any]]:
    """Render every state of a component spec. Returns [{"id", "path", "state"}]."""
    component = str(spec.get("component") or "")
    if component not in COMPONENTS:
        raise ValueError(f"unknown component {component!r}; choose from {', '.join(sorted(COMPONENTS))}")
    states = spec.get("states")
    if not isinstance(states, list) or not states:
        states = [{"id": "default"}]
    out_dir = Path(to_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    rows: list[dict[str, Any]] = []
    for index, state in enumerate(states):
        state = dict(state or {})
        state_id = str(state.pop("id", None) or f"state-{index}")
        animate = state.pop("animate", None) or spec.get("animate")
        image = COMPONENTS[component](spec, state)
        path = out_dir / f"{spec.get('id') or component}-{state_id}.png"
        image.save(path)
        row: dict[str, Any] = {"id": state_id, "path": str(path), "state": state}
        if animate:
            from . import kinetic

            settings = animate if isinstance(animate, dict) else {"entrance": str(animate)}
            bbox = image.getbbox()
            if bbox:
                element = image.crop(bbox)
                center = ((bbox[0] + bbox[2]) // 2, (bbox[1] + bbox[3]) // 2)
                manifest = kinetic.animate_element(
                    element, canvas_size=image.size, center=center,
                    entrance=str(settings.get("entrance", "pop")), loop=str(settings.get("loop", "none")),
                    fps=int(settings.get("fps", 24)), entrance_seconds=float(settings.get("seconds", 0.35)),
                    loop_seconds=float(settings.get("loop_seconds", 0.5)),
                    to_dir=out_dir / f"{spec.get('id') or component}-{state_id}-seq", seed=int(settings.get("seed", 3)),
                )
                row["sequence"] = manifest["pattern"]
                row["sequence_dir"] = str(out_dir / f"{spec.get('id') or component}-{state_id}-seq")
                row["fps"] = manifest["fps"]
                row["frames"] = manifest["frames"]
                row["entrance"] = manifest["entrance"]
                row["loop"] = manifest["loop"]
        rows.append(row)
    return rows


def render_spec_file(path: str | Path, to_dir: str | Path) -> list[dict[str, Any]]:
    spec = json.loads(Path(path).read_text(encoding="utf-8"))
    return render_spec(spec, to_dir)
