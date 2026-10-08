"""Kinetic text ("hanamoji" / variety-show lettering), stickers and entrance animations.

Style packs describe a complete look: font family, fill, layered strokes, shadow, plate
shape, tilt and per-glyph jitter, plus the entrance and sound that usually go with it and a
prose description the agent can reuse when it asks an image model for matching sticker art.
Rendering is Pillow only; animation writes a PNG sequence that the timeline renderer plays
from an anchor and then holds or loops.
"""
from __future__ import annotations

import glob
import json
import math
import random
from pathlib import Path
from typing import Any

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

# ---------------------------------------------------------------------------
# Fonts (path, face index) by role; CJK variants are chosen automatically for CJK text
# ---------------------------------------------------------------------------

def _asset_fonts(pattern: str) -> list[str]:
    return sorted(glob.glob(f"/System/Library/AssetsV2/com_apple_MobileAsset_Font7/*/AssetData/{pattern}"))


FONT_ROLES: dict[str, list[tuple[str, int]]] = {
    "rounded": [
        ("/Library/Fonts/SF-Pro-Rounded-Black.otf", 0),
        ("/Library/Fonts/SF-Pro-Rounded-Heavy.otf", 0),
        ("/Library/Fonts/Arial Rounded Bold.ttf", 0),
        ("/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf", 0),
        ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 0),
        ("C:/Windows/Fonts/ariblk.ttf", 0),
    ],
    "rounded-cjk": [
        *[(p, 1) for p in _asset_fonts("TsukushiBMaruGothic.ttc")],
        *[(p, 1) for p in _asset_fonts("TsukushiAMaruGothic.ttc")],
        ("/System/Library/Fonts/\u30d2\u30e9\u30ae\u30ce\u4e38\u30b4 ProN W4.ttc", 0),
        ("/System/Library/Fonts/Hiragino Sans GB.ttc", 2),
        ("/System/Library/Fonts/PingFang.ttc", 0),
        ("/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc", 0),
        ("C:/Windows/Fonts/msyhbd.ttc", 0),
    ],
    "heavy": [
        ("/System/Library/Fonts/Supplemental/Arial Black.ttf", 0),
        ("/System/Library/Fonts/Supplemental/Impact.ttf", 0),
        ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 0),
        ("C:/Windows/Fonts/ariblk.ttf", 0),
    ],
    "heavy-cjk": [
        *[(p, 0) for p in _asset_fonts("ToppanBunkyuMidashiGothicStdN-ExtraBold.otf")],
        ("/System/Library/Fonts/Hiragino Sans GB.ttc", 2),
        ("/System/Library/Fonts/PingFang.ttc", 0),
        ("/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc", 0),
        ("/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc", 0),
        ("C:/Windows/Fonts/msyhbd.ttc", 0),
    ],
    "impact": [
        ("/System/Library/Fonts/Supplemental/Impact.ttf", 0),
        ("/System/Library/Fonts/Supplemental/Arial Black.ttf", 0),
        ("C:/Windows/Fonts/impact.ttf", 0),
    ],
    "marker": [
        ("/System/Library/Fonts/MarkerFelt.ttc", 1),
        ("/System/Library/Fonts/Supplemental/Chalkboard.ttc", 1),
        ("/System/Library/Fonts/ChalkboardSE.ttc", 2),
        ("/System/Library/Fonts/Supplemental/Comic Sans MS Bold.ttf", 0),
        ("C:/Windows/Fonts/comicbd.ttf", 0),
    ],
    "marker-cjk": [
        *[(p, 0) for p in _asset_fonts("Klee.ttc")],
        *[(p, 1) for p in _asset_fonts("TsukushiBMaruGothic.ttc")],
        ("/System/Library/Fonts/PingFang.ttc", 0),
    ],
    "comic": [
        ("/System/Library/Fonts/Supplemental/Comic Sans MS Bold.ttf", 0),
        ("/System/Library/Fonts/ChalkboardSE.ttc", 2),
        ("/System/Library/Fonts/Supplemental/Chalkboard.ttc", 1),
        ("C:/Windows/Fonts/comicbd.ttf", 0),
    ],
    "condensed": [
        ("/System/Library/Fonts/Avenir Next Condensed.ttc", 0),
        ("/System/Library/Fonts/Supplemental/Impact.ttf", 0),
        ("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 0),
    ],
    "clean": [
        ("/Library/Fonts/SF-Pro-Text-Black.otf", 0),
        ("/System/Library/Fonts/Helvetica.ttc", 1),
        ("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 0),
        ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 0),
    ],
    "serif": [
        *[(p, 0) for p in _asset_fonts("ToppanBunkyuMidashiMinchoStdN-ExtraBold.otf")],
        ("/System/Library/Fonts/Supplemental/Times New Roman Bold.ttf", 0),
        ("/System/Library/Fonts/Supplemental/Georgia Bold.ttf", 0),
    ],
}
CJK_ROLE = {"rounded": "rounded-cjk", "heavy": "heavy-cjk", "impact": "heavy-cjk", "marker": "marker-cjk",
            "comic": "rounded-cjk", "condensed": "heavy-cjk", "clean": "heavy-cjk", "serif": "serif"}
# Chinese and Korean text needs fonts whose Han/Hangul coverage is complete; the Japanese
# display faces above miss common simplified characters.
ZH_FONTS: list[tuple[str, int]] = [
    ("/System/Library/Fonts/PingFang.ttc", 0),
    ("/System/Library/Fonts/Hiragino Sans GB.ttc", 2),
    ("/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc", 0),
    ("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc", 0),
    ("C:/Windows/Fonts/msyhbd.ttc", 0),
    ("C:/Windows/Fonts/msyh.ttc", 0),
]
KO_FONTS: list[tuple[str, int]] = [
    ("/System/Library/Fonts/AppleSDGothicNeo.ttc", 0),
    ("/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc", 0),
    ("C:/Windows/Fonts/malgunbd.ttf", 0),
]


def _is_cjk(text: str) -> bool:
    return any("\u3040" <= ch <= "\u30ff" or "\u3400" <= ch <= "\u9fff" or "\uac00" <= ch <= "\ud7af" for ch in text)


def _script_of(text: str) -> str:
    if any("\u3040" <= ch <= "\u30ff" for ch in text):
        return "ja"
    if any("\uac00" <= ch <= "\ud7af" for ch in text):
        return "ko"
    if any("\u3400" <= ch <= "\u9fff" for ch in text):
        return "zh"
    return "latin"


def font_for(role: str, size: int, text: str = "", explicit: str | None = None):
    candidates: list[tuple[str, int]] = []
    if explicit:
        path, _, index = explicit.partition("#")
        candidates.append((path, int(index or 0)))
    lang = _script_of(text) if text else "latin"
    if lang == "ja":
        candidates.extend(FONT_ROLES.get(CJK_ROLE.get(role, "heavy-cjk"), []))
    elif lang == "zh":
        candidates.extend(ZH_FONTS)
        candidates.extend(FONT_ROLES.get(CJK_ROLE.get(role, "heavy-cjk"), []))
    elif lang == "ko":
        candidates.extend(KO_FONTS)
    candidates.extend(FONT_ROLES.get(role, []))
    candidates.extend(FONT_ROLES["heavy"])
    for path, index in candidates:
        try:
            return ImageFont.truetype(path, size, index=index)
        except OSError:
            continue
    return ImageFont.load_default()


# ---------------------------------------------------------------------------
# Style packs
# ---------------------------------------------------------------------------

STYLE_PACKS: dict[str, dict[str, Any]] = {
    "variety-title": {
        "family": "variety", "font": "rounded", "size": 72, "fill": "#1A1A1A",
        "strokes": [[6, "#FFFFFF"]], "shadow": None,
        "plate": {"shape": "skew", "color": "#FFE23A", "padding": [26, 14], "skew": 10, "radius": 14},
        "rotate": -2, "jitter": 0, "entrance": "pop", "sfx": "pop",
        "mood": ["title", "segment name", "topic label", "calm"],
        "prompt": "Japanese variety-show segment title: heavy rounded gothic lettering in near-black on a "
                  "flat lemon-yellow plate, the plate slightly skewed like a slanted sticker, thin white "
                  "inner outline, no shadow, sits low in the frame.",
    },
    "variety-shout": {
        "family": "variety", "font": "rounded", "size": 84, "fill": "#FFFFFF",
        "strokes": [[7, "#0B3C8C"], [12, "#FFFFFF"]], "shadow": None,
        "plate": {"shape": "skew", "color": "#2FC3FF", "padding": [22, 12], "skew": 14, "radius": 12},
        "rotate": -6, "jitter": 2, "entrance": "stamp", "sfx": "boing",
        "mood": ["shout", "exclamation", "surprise", "energetic"],
        "prompt": "Variety-show shout caption: fat white rounded letters with a navy outline and a second "
                  "white outline, on a tilted sky-blue slanted plate, letters bouncing slightly off the "
                  "baseline, exclamation marks welcome.",
    },
    "variety-laugh": {
        "family": "variety", "font": "rounded", "size": 110, "fill": "#FFE23A",
        "strokes": [[8, "#E5322D"], [14, "#FF6EB4"]], "shadow": None,
        "plate": {"shape": "skew", "color": "#FF6EB4", "padding": [24, 14], "skew": 8, "radius": 16},
        "rotate": -4, "jitter": 3, "entrance": "stamp", "sfx": "tada",
        "mood": ["laugh", "big reaction", "punchline", "celebration"],
        "prompt": "Big-laugh variety caption: yellow rounded letters with a thick red outline and a soft "
                  "pink outer edge on a hot-pink slanted plate, large, tilted, each letter jostling.",
    },
    "variety-action": {
        "family": "variety", "font": "rounded", "size": 76, "fill": "#FFE23A",
        "strokes": [[7, "#101010"], [11, "#E5322D"]], "shadow": None,
        "plate": {"shape": "skew", "color": "#E5322D", "padding": [22, 12], "skew": 12, "radius": 12},
        "rotate": -3, "jitter": 1, "entrance": "slide-left", "sfx": "swoosh",
        "mood": ["action", "chase", "mission", "urgency"],
        "prompt": "Variety action caption: yellow rounded letters with a black outline on a red slanted "
                  "plate, urgent and sporty, placed at the bottom corner over the action.",
    },
    "variety-surprise": {
        "family": "variety", "font": "rounded", "size": 80, "fill": "#E5322D",
        "strokes": [[7, "#FFFFFF"], [12, "#FFB300"]], "shadow": None,
        "plate": {"shape": "skew", "color": "#FFE23A", "padding": [22, 12], "skew": 12, "radius": 12},
        "rotate": 6, "jitter": 4, "entrance": "wobble", "sfx": "sparkle",
        "mood": ["surprise", "what?!", "disbelief", "gasp"],
        "prompt": "Variety surprise caption: red rounded letters with a white outline on a yellow slanted "
                  "plate, tilted upward, letters wobbling, with '!?' marks.",
    },
    "manga-burst": {
        "family": "comic", "font": "heavy", "size": 96, "fill": "#FFFFFF",
        "strokes": [[8, "#000000"]], "shadow": None,
        "plate": {"shape": "burst", "color": "#FFD400", "padding": [34, 22], "points": 14, "spike": 0.2, "outline": "#000000", "outline_width": 6},
        "rotate": -8, "jitter": 3, "entrance": "stamp", "sfx": "hit",
        "mood": ["impact", "shock", "sound effect", "comic", "gaming"],
        "prompt": "Manga impact lettering: white comic letters with a heavy black outline inside a yellow "
                  "starburst with a black edge, tilted, like a BAM! effect in a comic panel.",
    },
    "meme-impact": {
        "family": "meme", "font": "impact", "size": 96, "fill": "#FFFFFF",
        "strokes": [[6, "#000000"]], "shadow": {"dx": 0, "dy": 6, "blur": 6, "color": "#00000099"},
        "plate": {"shape": "none"}, "rotate": 0, "jitter": 0, "uppercase": True,
        "entrance": "pop", "sfx": "pop",
        "mood": ["meme", "internet joke", "deadpan", "tiktok", "reels"],
        "prompt": "Classic meme lettering: uppercase Impact in white with a black outline, no plate, "
                  "flat, centred, with a soft drop shadow.",
    },
    "kawaii-pastel": {
        "family": "kawaii", "font": "rounded", "size": 84, "fill": ["#FFB7D5", "#FF7AB6"],
        "strokes": [[7, "#FFFFFF"], [11, "#FF9ECB"]], "shadow": {"dx": 0, "dy": 8, "blur": 10, "color": "#FF7AB655"},
        "plate": {"shape": "none"}, "rotate": -4, "jitter": 2, "entrance": "bounce", "sfx": "bubble",
        "mood": ["cute", "pastel", "cosmetics", "kids", "soft"],
        "prompt": "Cute pastel lettering: rounded letters with a pink gradient fill, thick white outline, a "
                  "soft pink outer edge and a gentle pink shadow, slightly tilted, bubbly and friendly.",
    },
    "neon-sign": {
        "family": "night", "font": "rounded", "size": 84, "fill": "#FFFFFF",
        "strokes": [[4, "#FF2BD6"]], "shadow": None, "glow": {"color": "#FF2BD6", "blur": 18, "width": 14},
        "plate": {"shape": "none"}, "rotate": 0, "jitter": 0, "entrance": "flicker", "sfx": "buzz",
        "mood": ["nightlife", "music", "club", "gaming", "tech"],
        "prompt": "Neon sign lettering: white rounded letters with a magenta glow bleeding into the dark, "
                  "flickering on like a real sign, no plate.",
    },
    "newsflash": {
        "family": "broadcast", "font": "condensed", "size": 70, "fill": "#FFFFFF",
        "strokes": [], "shadow": None, "uppercase": True,
        "plate": {"shape": "bar", "color": "#D8121A", "padding": [30, 14], "accent": "#FFFFFF"},
        "rotate": 0, "jitter": 0, "entrance": "slide-left", "sfx": "swoosh",
        "mood": ["news", "breaking", "announcement", "sports", "serious"],
        "prompt": "Broadcast news flash: uppercase condensed white letters on a solid red bar with a thin "
                  "white accent line, sliding in from the left, no tilt.",
    },
    "marker-note": {
        "family": "handmade", "font": "marker", "size": 78, "fill": "#1F1F1F",
        "strokes": [], "shadow": {"dx": 3, "dy": 4, "blur": 2, "color": "#00000040"},
        "plate": {"shape": "tape", "color": "#FFF6C2", "padding": [26, 14]},
        "rotate": -3, "jitter": 2, "entrance": "drop", "sfx": "tap",
        "mood": ["vlog", "handwritten", "personal", "study", "diy"],
        "prompt": "Handwritten marker note: dark marker-pen letters on a cream masking-tape strip with "
                  "torn ends and a light shadow, slightly rotated, like a note stuck on the screen.",
    },
    "paper-cutout": {
        "family": "handmade", "font": "heavy", "size": 80, "fill": "#E5322D",
        "strokes": [], "shadow": {"dx": 6, "dy": 8, "blur": 6, "color": "#00000066"},
        "plate": {"shape": "rounded", "color": "#FFFFFF", "padding": [26, 14], "radius": 10},
        "rotate": -5, "jitter": 0, "entrance": "drop", "sfx": "tap",
        "mood": ["craft", "collage", "explainer", "education", "documentary"],
        "prompt": "Paper cut-out label: bold red letters on a white paper card with a real drop shadow, "
                  "the card rotated a few degrees like it was glued on by hand.",
    },
    "sports-broadcast": {
        "family": "broadcast", "font": "condensed", "size": 74, "fill": "#FFFFFF",
        "strokes": [[3, "#0A1F44"]], "shadow": None, "uppercase": True,
        "plate": {"shape": "skew", "color": "#0A1F44", "padding": [28, 12], "skew": 18, "radius": 4, "accent": "#F5C400"},
        "rotate": 0, "jitter": 0, "entrance": "slide-right", "sfx": "swoosh",
        "mood": ["sports", "scores", "ranking", "competition", "fitness"],
        "prompt": "Sports broadcast lower graphic: uppercase condensed white letters on a navy "
                  "parallelogram with a gold accent edge, fast slide-in, no tilt.",
    },
    "retro-vhs": {
        "family": "retro", "font": "heavy", "size": 84, "fill": "#FFF04D",
        "strokes": [[4, "#1B1B1B"]], "shadow": {"dx": -6, "dy": 0, "blur": 0, "color": "#FF2BD6CC"},
        "plate": {"shape": "none"}, "rotate": 0, "jitter": 0, "uppercase": True,
        "entrance": "flicker", "sfx": "buzz",
        "mood": ["retro", "80s", "vhs", "synthwave", "nostalgia"],
        "prompt": "Retro VHS caption: yellow heavy letters with a thin dark outline and a magenta "
                  "chromatic offset to the left, no plate, flickers in like old tape.",
    },
    "gold-luxury": {
        "family": "luxury", "font": "serif", "size": 80, "fill": ["#FFF1B0", "#C99A2E"],
        "strokes": [[3, "#3A2A05"]], "shadow": {"dx": 0, "dy": 6, "blur": 8, "color": "#00000066"},
        "plate": {"shape": "none"}, "rotate": 0, "jitter": 0, "entrance": "fade", "sfx": "sparkle",
        "mood": ["luxury", "fashion", "jewelry", "premium", "cinematic"],
        "prompt": "Luxury lettering: extra-bold serif letters filled with a champagne-to-gold gradient, "
                  "a fine dark outline and a soft shadow, no plate, fading in with a sparkle.",
    },
    "clean-minimal": {
        "family": "clean", "font": "clean", "size": 64, "fill": "#FFFFFF",
        "strokes": [], "shadow": {"dx": 0, "dy": 4, "blur": 8, "color": "#00000080"},
        "plate": {"shape": "rounded", "color": "#00000088", "padding": [22, 12], "radius": 12},
        "rotate": 0, "jitter": 0, "entrance": "fade", "sfx": None,
        "mood": ["tech", "product", "tutorial", "corporate", "calm"],
        "prompt": "Minimal caption: clean heavy sans letters in white on a translucent dark rounded plate, "
                  "no tilt, fades in quietly.",
    },
    "speech-bubble": {
        "family": "comic", "font": "comic", "size": 60, "fill": "#111111",
        "strokes": [], "shadow": {"dx": 3, "dy": 5, "blur": 4, "color": "#00000055"},
        "plate": {"shape": "bubble", "color": "#FFFFFF", "padding": [30, 20], "radius": 28, "outline": "#111111", "outline_width": 5, "tail": "bottom-left"},
        "rotate": 0, "jitter": 0, "entrance": "pop", "sfx": "pop",
        "mood": ["inner thought", "aside", "dialogue", "comic", "reaction"],
        "prompt": "Comic speech bubble: dark comic letters inside a white rounded bubble with a black "
                  "outline and a small tail pointing at the speaker, pops in.",
    },
}

ENTRANCES = ["pop", "stamp", "bounce", "drop", "slide-left", "slide-right", "slide-up", "wobble", "flicker", "fade", "none"]
LOOPS = ["shake", "pulse", "sway", "none"]


def style_pack(name: str, overrides: dict[str, Any] | None = None) -> dict[str, Any]:
    if name not in STYLE_PACKS:
        raise ValueError(f"unknown style pack {name!r}; choose from {', '.join(STYLE_PACKS)}")
    pack = json.loads(json.dumps(STYLE_PACKS[name]))
    for key, value in (overrides or {}).items():
        if key == "plate" and isinstance(value, dict):
            pack["plate"] = {**pack.get("plate", {}), **value}
        else:
            pack[key] = value
    pack["name"] = name
    return pack


# ---------------------------------------------------------------------------
# Rendering helpers
# ---------------------------------------------------------------------------


def _rgba(value: Any, default=(0, 0, 0, 255)) -> tuple[int, int, int, int]:
    if value is None:
        return default
    if isinstance(value, (list, tuple)):
        parts = [int(v) for v in value]
        return tuple(parts + [255] * (4 - len(parts)))[:4]  # type: ignore[return-value]
    text = str(value).strip().lstrip("#")
    if len(text) == 6:
        text += "FF"
    return tuple(int(text[i:i + 2], 16) for i in (0, 2, 4, 6))  # type: ignore[return-value]


def _gradient(size: tuple[int, int], top: Any, bottom: Any) -> Image.Image:
    w, h = size
    c1, c2 = _rgba(top), _rgba(bottom)
    grad = Image.new("RGBA", (w, h))
    px = grad.load()
    for y in range(h):
        t = y / max(1, h - 1)
        colour = tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(4))
        for x in range(w):
            px[x, y] = colour
    return grad


def _text_block(text: str, pack: dict[str, Any], size: int, jitter: float, rng: random.Random) -> Image.Image:
    """Render the lettering (fill + strokes + glow), glyph by glyph when jitter is requested."""
    font = font_for(str(pack.get("font", "heavy")), size, text, pack.get("explicit_font"))
    if pack.get("uppercase") and not _is_cjk(text):
        text = text.upper()
    strokes = [(int(w), _rgba(c)) for w, c in (pack.get("strokes") or [])]
    max_stroke = max([w for w, _ in strokes] + [0])
    glow = pack.get("glow")
    pad = max_stroke + (int(glow["blur"]) + int(glow.get("width", 8)) if glow else 0) + int(size * 0.35)
    lines = text.split("\n")
    spacing = int(size * float(pack.get("line_spacing", 1.15)))
    tmp = ImageDraw.Draw(Image.new("RGBA", (10, 10)))
    widths = [tmp.textbbox((0, 0), line, font=font)[2] for line in lines]
    block_w = max(widths) + pad * 2
    block_h = spacing * len(lines) + pad * 2
    layer = Image.new("RGBA", (block_w, block_h), (0, 0, 0, 0))

    # glyph placements
    placements: list[tuple[str, int, int, float]] = []  # char, x, y, angle
    for li, line in enumerate(lines):
        x = pad + (max(widths) - widths[li]) // 2
        y = pad + li * spacing
        chars = list(line) if jitter else [line]
        for ch in chars:
            angle = rng.uniform(-jitter * 2.2, jitter * 2.2) if jitter else 0.0
            dy = rng.uniform(-jitter * 1.6, jitter * 1.6) if jitter else 0.0
            placements.append((ch, x, int(y + dy), angle))
            if jitter:
                x += tmp.textbbox((0, 0), ch, font=font)[2] + int(size * float(pack.get("tracking", 0.0)))

    def paint(stroke_w: int, colour, target: Image.Image) -> None:
        for ch, x, y, angle in placements:
            if not ch.strip():
                continue
            if angle:
                box = tmp.textbbox((0, 0), ch, font=font)
                gw, gh = box[2] + stroke_w * 2 + 8, box[3] + stroke_w * 2 + 8
                glyph = Image.new("RGBA", (gw, gh), (0, 0, 0, 0))
                ImageDraw.Draw(glyph).text((stroke_w + 4, stroke_w + 4), ch, font=font, fill=colour,
                                           stroke_width=stroke_w, stroke_fill=colour)
                glyph = glyph.rotate(angle, resample=Image.BICUBIC, expand=True)
                target.alpha_composite(glyph, (x - stroke_w - 4 - (glyph.width - gw) // 2, y - stroke_w - 4 - (glyph.height - gh) // 2))
            else:
                ImageDraw.Draw(target).text((x, y), ch, font=font, fill=colour, stroke_width=stroke_w, stroke_fill=colour)

    if glow:
        glow_layer = Image.new("RGBA", layer.size, (0, 0, 0, 0))
        paint(int(glow.get("width", 8)), _rgba(glow["color"]), glow_layer)
        glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(int(glow["blur"])))
        layer.alpha_composite(glow_layer)
        layer.alpha_composite(glow_layer)
    for w, colour in sorted(strokes, key=lambda s: -s[0]):
        paint(w, colour, layer)
    fill = pack.get("fill", "#FFFFFF")
    if isinstance(fill, list) and len(fill) == 2:
        mask = Image.new("RGBA", layer.size, (0, 0, 0, 0))
        paint(0, (255, 255, 255, 255), mask)
        grad = _gradient(layer.size, fill[0], fill[1])
        grad.putalpha(ImageChops.multiply(grad.getchannel("A"), mask.getchannel("A")))
        layer.alpha_composite(grad)
    else:
        paint(0, _rgba(fill), layer)
    return layer


def _plate(size: tuple[int, int], plate: dict[str, Any]) -> tuple[Image.Image, tuple[int, int]]:
    """Return the plate image and the offset at which the text block sits on it."""
    shape = str(plate.get("shape", "none"))
    if shape == "none":
        return Image.new("RGBA", size, (0, 0, 0, 0)), (0, 0)
    px, py = (plate.get("padding") or [24, 14])[:2]
    w, h = size[0] + px * 2, size[1] + py * 2
    colour = _rgba(plate.get("color"), (255, 226, 58, 255))
    outline = _rgba(plate.get("outline"), (0, 0, 0, 255)) if plate.get("outline") else None
    ow = int(plate.get("outline_width", 0))
    if shape == "burst":
        spike = float(plate.get("spike", 0.28)); points = int(plate.get("points", 14))
        extra = int(max(w, h) * spike) + ow
        im = Image.new("RGBA", (w + extra * 2, h + extra * 2), (0, 0, 0, 0))
        cx, cy = im.width / 2, im.height / 2
        rx, ry = w / 2 + extra, h / 2 + extra
        poly = []
        for i in range(points * 2):
            a = math.pi * 2 * i / (points * 2) - math.pi / 2
            r = 1.0 if i % 2 == 0 else 1.0 - spike
            poly.append((cx + math.cos(a) * rx * r, cy + math.sin(a) * ry * r))
        d = ImageDraw.Draw(im)
        if outline:
            d.polygon(poly, fill=outline)
            inner = [(cx + (x - cx) * (1 - ow / rx), cy + (y - cy) * (1 - ow / ry)) for x, y in poly]
            d.polygon(inner, fill=colour)
        else:
            d.polygon(poly, fill=colour)
        return im, (extra + px, extra + py)
    if shape == "bubble":
        tail = str(plate.get("tail", "bottom-left"))
        th = int(h * 0.35)
        im = Image.new("RGBA", (w + 4, h + th + 4), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        r = int(plate.get("radius", 26))
        if outline:
            d.rounded_rectangle((0, 0, w + 3, h + 3), radius=r, fill=outline)
        d.rounded_rectangle((ow, ow, w + 3 - ow, h + 3 - ow), radius=max(1, r - ow), fill=colour)
        tx = int(w * 0.2) if tail.endswith("left") else int(w * 0.8)
        tri = [(tx - int(h * 0.12), h - 6), (tx + int(h * 0.12), h - 6), (tx - int(w * 0.05), h + th)]
        if outline:
            d.polygon([(tri[0][0] - ow, tri[0][1]), (tri[1][0] + ow, tri[1][1]), (tri[2][0] - ow, tri[2][1] + ow)], fill=outline)
        d.polygon(tri, fill=colour)
        return im, (2 + px, 2 + py)
    if shape == "tape":
        im = Image.new("RGBA", (w + 24, h), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        pts = [(12, 0), (w + 12, 0), (w + 24, h // 2), (w + 12, h), (12, h), (0, h // 2)]
        # torn ends
        d.polygon(pts, fill=colour)
        for i in range(0, h, 8):
            d.rectangle((0, i, 4, i + 3), fill=(0, 0, 0, 0))
            d.rectangle((w + 20, i + 4, w + 24, i + 7), fill=(0, 0, 0, 0))
        return im, (12 + px, py)
    if shape == "bar":
        im = Image.new("RGBA", (w, h), colour)
        d = ImageDraw.Draw(im)
        if plate.get("accent"):
            d.rectangle((0, 0, w, 6), fill=_rgba(plate["accent"]))
        return im, (px, py)
    skew = int(plate.get("skew", 0)) if shape == "skew" else 0
    im = Image.new("RGBA", (w + abs(skew), h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    r = int(plate.get("radius", 12))
    if skew:
        poly = [(skew, 0), (w + skew, 0), (w, h), (0, h)] if skew > 0 else [(0, 0), (w, 0), (w - skew, h), (-skew, h)]
        d.polygon(poly, fill=colour)
        # soften the corners with small circles
        for (x, y) in poly:
            d.ellipse((x - r // 2, y - r // 2, x + r // 2, y + r // 2), fill=colour)
        if plate.get("accent"):
            d.polygon([(poly[3][0], h - 6), (poly[2][0], h - 6), (poly[2][0], h), (poly[3][0], h)], fill=_rgba(plate["accent"]))
        return im, ((skew if skew > 0 else 0) + px, py)
    d.rounded_rectangle((0, 0, w - 1, h - 1), radius=r, fill=colour)
    return im, (px, py)


def render_kinetic_text(
    text: str,
    pack_name: str,
    *,
    overrides: dict[str, Any] | None = None,
    seed: int = 7,
) -> Image.Image:
    """Render one piece of styled lettering on a transparent, tightly cropped image."""
    pack = style_pack(pack_name, overrides)
    rng = random.Random(seed)
    size = int(pack.get("size", 80))
    block = _text_block(text, pack, size, float(pack.get("jitter", 0)), rng)
    bbox = block.getbbox() or (0, 0, block.width, block.height)
    block = block.crop(bbox)
    plate, offset = _plate(block.size, pack.get("plate") or {"shape": "none"})
    canvas_w = max(plate.width, block.width + offset[0])
    canvas_h = max(plate.height, block.height + offset[1])
    margin = 40
    im = Image.new("RGBA", (canvas_w + margin * 2, canvas_h + margin * 2), (0, 0, 0, 0))
    shadow = pack.get("shadow")
    if shadow:
        sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
        sh_layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
        sh_layer.alpha_composite(plate, (margin, margin))
        sh_layer.alpha_composite(block, (margin + offset[0], margin + offset[1]))
        alpha = sh_layer.getchannel("A")
        tint = Image.new("RGBA", im.size, _rgba(shadow.get("color"), (0, 0, 0, 120)))
        tint.putalpha(ImageChops.multiply(alpha, tint.getchannel("A")))
        if shadow.get("blur"):
            tint = tint.filter(ImageFilter.GaussianBlur(int(shadow["blur"])))
        sh.alpha_composite(tint, (int(shadow.get("dx", 0)), int(shadow.get("dy", 0))))
        im.alpha_composite(sh)
    im.alpha_composite(plate, (margin, margin))
    im.alpha_composite(block, (margin + offset[0], margin + offset[1]))
    angle = float(pack.get("rotate", 0))
    if angle:
        im = im.rotate(angle, resample=Image.BICUBIC, expand=True)
    bbox = im.getbbox()
    return im.crop(bbox) if bbox else im


# ---------------------------------------------------------------------------
# Stickers from generated art
# ---------------------------------------------------------------------------


def cutout_sticker(
    source: str | Path,
    *,
    key_color: Any = None,
    tolerance: int = 40,
    outline: int = 14,
    outline_color: Any = "#FFFFFF",
    shadow: bool = True,
    size: int | None = None,
) -> Image.Image:
    """Turn a flat-background sticker image into a cut-out with a thick outline (sticker look)."""
    im = Image.open(source).convert("RGBA")
    if size:
        im.thumbnail((size, size), Image.LANCZOS)
    px = im.load()
    w, h = im.size
    if key_color is None:
        corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
        key = tuple(sum(c[i] for c in corners) // 4 for i in range(3))
    else:
        key = _rgba(key_color)[:3]
    # flood from the border so same-coloured pixels inside the subject survive
    mask = Image.new("L", (w, h), 255)
    mpx = mask.load()
    visited = bytearray(w * h)
    stack = [(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)] + [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)]
    while stack:
        x, y = stack.pop()
        if x < 0 or y < 0 or x >= w or y >= h or visited[y * w + x]:
            continue
        visited[y * w + x] = 1
        r, g, b, a = px[x, y]
        if abs(r - key[0]) + abs(g - key[1]) + abs(b - key[2]) > tolerance * 3:
            continue
        mpx[x, y] = 0
        stack.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1))
    cut = im.copy()
    cut.putalpha(ImageChops.multiply(cut.getchannel("A"), mask))
    bbox = cut.getbbox()
    if bbox:
        cut = cut.crop(bbox)
    pad = outline + 24
    out = Image.new("RGBA", (cut.width + pad * 2, cut.height + pad * 2), (0, 0, 0, 0))
    if outline:
        alpha = Image.new("L", out.size, 0)
        alpha.paste(cut.getchannel("A"), (pad, pad))
        grown = alpha.filter(ImageFilter.MaxFilter(outline * 2 + 1))
        ring = Image.new("RGBA", out.size, _rgba(outline_color))
        ring.putalpha(grown)
        if shadow:
            sh = Image.new("RGBA", out.size, (0, 0, 0, 110))
            sh.putalpha(ImageChops.multiply(grown, Image.new("L", out.size, 110)))
            out.alpha_composite(sh.filter(ImageFilter.GaussianBlur(6)), (4, 8))
        out.alpha_composite(ring)
    out.alpha_composite(cut, (pad, pad))
    return out


def emoji_sticker(text: str, size: int = 220, outline: int = 10) -> Image.Image:
    from .graphics import _emoji_font, EMOJI_RE  # local import to avoid a cycle

    font = _emoji_font()
    tile = Image.new("RGBA", (400, 400), (0, 0, 0, 0))
    if font is not None:
        try:
            ImageDraw.Draw(tile).text((40, 40), text, font=font, embedded_color=True)
        except TypeError:  # pragma: no cover
            ImageDraw.Draw(tile).text((40, 40), text, font=font)
    bbox = tile.getbbox()
    glyph = tile.crop(bbox) if bbox else tile
    scale = size / max(glyph.size)
    glyph = glyph.resize((max(1, int(glyph.width * scale)), max(1, int(glyph.height * scale))), Image.LANCZOS)
    return _outline_only(glyph, outline)


def _outline_only(glyph: Image.Image, outline: int) -> Image.Image:
    pad = outline + 16
    out = Image.new("RGBA", (glyph.width + pad * 2, glyph.height + pad * 2), (0, 0, 0, 0))
    alpha = Image.new("L", out.size, 0)
    alpha.paste(glyph.getchannel("A"), (pad, pad))
    grown = alpha.filter(ImageFilter.MaxFilter(outline * 2 + 1))
    ring = Image.new("RGBA", out.size, (255, 255, 255, 255))
    ring.putalpha(grown)
    sh = Image.new("RGBA", out.size, (0, 0, 0, 255))
    sh.putalpha(ImageChops.multiply(grown, Image.new("L", out.size, 100)))
    out.alpha_composite(sh.filter(ImageFilter.GaussianBlur(5)), (3, 6))
    out.alpha_composite(ring)
    out.alpha_composite(glyph, (pad, pad))
    return out


# ---------------------------------------------------------------------------
# Entrance / loop animation as PNG sequences
# ---------------------------------------------------------------------------


def _ease_out_back(t: float, s: float = 1.7) -> float:
    t -= 1.0
    return t * t * ((s + 1) * t + s) + 1.0


def _place(canvas_size: tuple[int, int], element: Image.Image, center: tuple[int, int], *, scale: float = 1.0,
           angle: float = 0.0, dx: float = 0.0, dy: float = 0.0, opacity: float = 1.0) -> Image.Image:
    frame = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    el = element
    if scale != 1.0:
        el = el.resize((max(1, int(el.width * scale)), max(1, int(el.height * scale))), Image.LANCZOS)
    if angle:
        el = el.rotate(angle, resample=Image.BICUBIC, expand=True)
    if opacity < 1.0:
        a = el.getchannel("A").point(lambda v: int(v * opacity))
        el = el.copy()
        el.putalpha(a)
    frame.alpha_composite(el, (int(center[0] + dx - el.width / 2), int(center[1] + dy - el.height / 2)))
    return frame


def animate_element(
    element: Image.Image,
    *,
    canvas_size: tuple[int, int],
    center: tuple[int, int],
    entrance: str = "pop",
    loop: str = "none",
    fps: int = 24,
    entrance_seconds: float = 0.35,
    loop_seconds: float = 0.5,
    to_dir: str | Path,
    seed: int = 3,
) -> dict[str, Any]:
    """Write entrance frames followed by loop frames. The renderer holds the last frame or loops the tail."""
    out = Path(to_dir)
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("f*.png"):
        old.unlink()
    rng = random.Random(seed)
    frames: list[Image.Image] = []
    n = max(1, int(round(entrance_seconds * fps)))
    W, H = canvas_size
    for i in range(n):
        t = (i + 1) / n
        if entrance == "pop":
            frames.append(_place(canvas_size, element, center, scale=max(0.05, _ease_out_back(t))))
        elif entrance == "stamp":
            s = 1.6 - 0.6 * min(1.0, t * 1.4)
            frames.append(_place(canvas_size, element, center, scale=s, opacity=min(1.0, t * 3)))
        elif entrance == "bounce":
            drop = (1 - t) ** 2 * H * 0.35
            bounce = abs(math.sin(t * math.pi * 2.2)) * (1 - t) * 40
            frames.append(_place(canvas_size, element, center, dy=-drop - bounce))
        elif entrance == "drop":
            frames.append(_place(canvas_size, element, center, dy=-(1 - t) ** 2 * H * 0.25, scale=1.0 + (1 - t) * 0.25, opacity=min(1.0, t * 2)))
        elif entrance.startswith("slide-"):
            direction = entrance.split("-", 1)[1]
            k = (1 - _ease_out_back(t, 1.2))
            dx = -W * 0.6 * k if direction == "left" else W * 0.6 * k if direction == "right" else 0.0
            dy = H * 0.3 * k if direction == "up" else -H * 0.3 * k if direction == "down" else 0.0
            frames.append(_place(canvas_size, element, center, dx=dx, dy=dy))
        elif entrance == "wobble":
            frames.append(_place(canvas_size, element, center, scale=max(0.05, _ease_out_back(t)), angle=math.sin(t * math.pi * 3) * (1 - t) * 14))
        elif entrance == "flicker":
            on = rng.random() > 0.35 or t > 0.7
            frames.append(_place(canvas_size, element, center, opacity=1.0 if on else 0.15))
        elif entrance == "fade":
            frames.append(_place(canvas_size, element, center, opacity=t))
        else:  # none
            frames.append(_place(canvas_size, element, center))
    m = max(0, int(round(loop_seconds * fps))) if loop and loop != "none" else 0
    for i in range(m):
        t = i / max(1, m)
        if loop == "shake":
            frames.append(_place(canvas_size, element, center, dx=rng.uniform(-5, 5), dy=rng.uniform(-4, 4), angle=rng.uniform(-2, 2)))
        elif loop == "pulse":
            frames.append(_place(canvas_size, element, center, scale=1.0 + 0.05 * math.sin(t * math.pi * 2)))
        elif loop == "sway":
            frames.append(_place(canvas_size, element, center, angle=4 * math.sin(t * math.pi * 2)))
    for i, frame in enumerate(frames):
        frame.save(out / f"f{i:04d}.png")
    manifest = {
        "format": "pvx.sequence@1", "fps": fps, "frames": len(frames), "entrance_frames": n, "loop_frames": m,
        "entrance": entrance, "loop": loop or "none", "canvas": {"width": W, "height": H}, "center": list(center),
        "pattern": str(out / "f%04d.png"),
    }
    (out / "sequence.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest
