#!/usr/bin/env python3
"""⑦ 自动烧字幕（可选但常备）：用火山词级转写 + 保留段，给成片挂上跟读的字幕。

为什么能做好断句：火山的"词"是单字、不带标点，但每句 utterance 的 text 带标点。
本脚本把带标点的句子稿和词级时间戳对齐，在逗号/句号处断句 → 字幕按语义断，不再从半个词起头。
字体优先使用 Skill 自带的开源中文字体，PIL 渲成 PNG 再 ffmpeg overlay
（不依赖 libass，macOS/Windows 均可烧录）。

用法：make_subtitles.py <原成片mp4> <final_cuts.json> <transcript.json> <segments.json> \
        --out DIR [--font 字体.ttf] [--font-size 92] [--max-width 0.86] [--margin-bottom 170] \
        [--brand-plan 品牌浮层.json]
"""
import argparse, json, math, os, re, subprocess, sys
from pathlib import Path
import jieba
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from runtime_support import FFMPEG, FFPROBE, encoder_attempts

PUNCT = "，。？！、；：,.?!;:"

SKILL_ROOT = Path(__file__).resolve().parents[1]

def _font_path(value=None, preferred="SourceHanSerifSC-Heavy.otf"):
    """解析字体：显式路径 > Skill 自带开源字体 > 系统中文字体。"""
    if value:
        p = Path(value).expanduser()
        if p.is_file():
            return str(p)
        if not p.is_absolute():
            for base in (Path.cwd(), SKILL_ROOT):
                candidate = base / p
                if candidate.is_file():
                    return str(candidate)
    for p in (
        SKILL_ROOT / "assets/fonts" / preferred,
        SKILL_ROOT / "assets/fonts/SourceHanSerifSC-Heavy.otf",
        Path("/System/Library/Fonts/PingFang.ttc"),
        Path("/System/Library/Fonts/STHeiti Medium.ttc"),
    ):
        if p.is_file():
            return str(p)
    raise FileNotFoundError(
        "未找到可用中文字体；请安装 Skill 自带 assets/fonts，或通过 --font 指定已授权字体。")

def keepable(ch):
    # % 可能同时出现在火山单词（"1%"）和带标点全文中；必须参与词长对齐，
    # 否则后面的逗号会错落到“不过”后面。
    return ('一' <= ch <= '鿿') or ch.isalnum() or ch == "%"

# ── 关键词强调:语义标注驱动(AI 读懂内容挑重点,不是 regex 扫数字) ──
# plan = [(词, 颜色)]:金黄=重点/金句/数据/品牌,红=力度/设问/紧迫。由 ④裁决时的语义判断产出。
GOLD = (255, 208, 0, 255)
RED  = (238, 46, 42, 255)
def _col(name):
    m = {"gold": GOLD, "金黄": GOLD, "yellow": GOLD, "red": RED, "红": RED}
    return m.get(str(name).lower().strip(), None) or hex_rgba(str(name))
def apply_corrections(text, corr):
    for a, b in (corr or {}).items(): text = text.replace(a, b)
    return text
def emphasis_colors(text, base, plan):
    """把 plan 里的语义重点词在 text 里染色。长词优先(先长后短,避免子串误盖)。"""
    cols = [base] * len(text)
    for word, col in sorted(plan or [], key=lambda x: -len(x[0])):
        i = text.find(word)
        while i >= 0:
            for j in range(i, i+len(word)): cols[j] = col
            i = text.find(word, i+len(word))
    return cols

PREFERRED_STARTS = (
    "也不过", "不过", "不到", "超过", "至少", "至多", "考上", "拿了",
    "但是", "但", "所以", "那么", "而且", "包括", "如果", "可能", "其实",
    "就是", "为了",
)
BAD_ENDS = (
    "和", "与", "及", "或", "但", "而", "把", "被", "给", "让", "从", "在",
    "因为", "所以", "如果", "那么", "就是", "可能", "为了", "一个", "拿了",
    "考上", "不过", "不到", "超过", "能", "会", "要", "想", "需", "可",
)
BAD_STARTS = ("的", "了", "地", "得", "着", "呢", "啊", "吗", "吧", "呀", "嘛")

def _protected_boundaries(text):
    """数字、百分数、数量+英文词组内部不可断，如 3% / 10个offer / TOP30。"""
    blocked = set()
    patterns = [
        r"\d+(?:\.\d+)?%?",
        r"\d+(?:个|份|条|次|所|名)?[A-Za-z]+(?:\d+)?",
        r"[A-Za-z]+(?:\d+)?",
        r"(?:上|看|拿|走|进|回|想|找|说|聊|搬|换|考|就读)到?过?",
        r"这个(?:高中|初中|小学|学校|孩子|情况)",
        r"(?:这|那|哪)所(?:高中|初中|小学|学校)?",
        r"好(?:高中|初中|小学|学校)",
        r"看的是",
    ]
    for pat in patterns:
        for m in re.finditer(pat, text):
            blocked.update(range(m.start() + 1, m.end()))
    return blocked

def _chunk_cost(text, start, end, soft, hard, preferred_breaks=None):
    chunk = text[start:end]
    right = text[end:]
    n = len(chunk)
    if not chunk:
        return 1e9
    cost = (n - soft) ** 2
    if n < 3:
        cost += 120
    if n > hard:
        cost += (n - hard) ** 2 * 18
    if any(chunk.endswith(x) for x in BAD_ENDS):
        cost += 32
    if any(right.startswith(x) for x in BAD_STARTS):
        cost += 36
    if any(right.startswith(x) for x in PREFERRED_STARTS):
        cost -= 10
    if preferred_breaks and end in preferred_breaks:
        cost -= 18
    if chunk.endswith("的") and not right.startswith(("也", "却", "就", "才")):
        cost += 18
    # “……的 / 也不过……”这类省略主语的断法是自然的，允许优先切。
    if chunk.endswith("的") and right.startswith(("也", "却", "就", "才")):
        cost -= 7
    return cost

def semantic_chunks(words, soft_max, preferred_breaks=None):
    """把一个标点内分句切成短而完整的字幕页，返回若干词列表。"""
    if not words:
        return []
    text = "".join(str(w.get("text", "")) for w in words)
    if len(text) <= soft_max:
        return [words]

    word_ends = []
    p = 0
    for w in words:
        p += len(str(w.get("text", "")))
        word_ends.append(p)
    word_end_set = set(word_ends)

    # jieba 只提供可切边界；再与火山词边界取交集，避免拆中文词和英文词。
    safe = set()
    p = 0
    for token in jieba.cut(text):
        p += len(token)
        if p in word_end_set:
            safe.add(p)
    safe.add(len(text))
    safe -= _protected_boundaries(text)
    points = [0] + sorted(x for x in safe if x > 0)
    hard = max(soft_max + 3, 11)

    # 动态规划：兼顾每页阅读量、语法粘连和自然转折，不为凑字数硬切。
    best = {0: (0.0, None)}
    for end in points[1:]:
        choice = None
        for start in points:
            if start >= end or start not in best:
                continue
            n = end - start
            if n > hard + 5 and end != len(text):
                continue
            score = best[start][0] + _chunk_cost(
                text, start, end, soft_max, hard, preferred_breaks)
            if choice is None or score < choice[0]:
                choice = (score, start)
        if choice is not None:
            best[end] = choice
    if len(text) not in best:
        return [words]

    spans = []
    end = len(text)
    while end > 0:
        start = best[end][1]
        if start is None:
            break
        spans.append((start, end))
        end = start
    spans.reverse()

    by_end = {pos: i + 1 for i, pos in enumerate(word_ends)}
    out = []
    for start, end in spans:
        si = by_end.get(start, 0) if start else 0
        ei = by_end.get(end, len(words))
        out.append(words[si:ei])
    out = [x for x in out if x]
    # 末页若只剩 1–2 字，和前页重新均衡，避免“……学生的 / 幻觉”。
    if len(out) > 1 and len("".join(str(w.get("text", "")) for w in out[-1])) <= 2:
        pair = out[-2] + out[-1]
        ptext = "".join(str(w.get("text", "")) for w in pair)
        ends = []
        pp = 0
        for w in pair:
            pp += len(str(w.get("text", "")))
            ends.append(pp)
        choices = [x for x in ends[:-1] if 3 <= x <= len(ptext) - 3]
        if choices:
            cut = min(
                choices,
                key=lambda x: _chunk_cost(ptext, 0, x, soft_max, hard)
                + _chunk_cost(ptext, x, len(ptext), soft_max, hard))
            wi = ends.index(cut) + 1
            out[-2:] = [pair[:wi], pair[wi:]]
    return out

def build_cues(fc, transcript, segments, max_chars, xfade=0.07, offsets=None):
    """→ [(out_start, out_end, text)]。时间轴和成片精确对齐：
    offsets(render_preview 写出的每段精确起点)优先——直接读，零漂移，7分钟也不飘；
    没有 offsets 时才退回按 xf 累积(每接缝扣掉交叉淡化 xf 秒)。"""
    utext = {str(u.get("sid", i)): u.get("text", "") for i, u in enumerate(transcript.get("utterances", []))}
    keeps = fc["keeps"]
    min_dur = min(k["end"]-k["start"] for k in keeps) if keeps else 1
    xf = round(min(xfade, max(0.02, min_dur*0.45)), 3)   # 退路:和 render_preview 同一算法
    cues = []; t = 0.0
    for i, k in enumerate(keeps):
        if offsets is not None and i < len(offsets): t = offsets[i]   # ★精确起点,优先
        s, e = k["start"], k["end"]; dur = e - s
        sid = re.search(r's(\d+)', k["seg"]).group(1)
        words = segments[sid]["words"]
        # 1) 对齐带标点句稿 → 每个词后面是否跟标点（断句点）
        strong_after = set()
        weak_after = set()
        wi, ci = 0, 0
        for ch in utext.get(sid, ""):
            if ch in PUNCT:
                if wi - 1 >= 0:
                    if ch in "。？！；.!?;":
                        strong_after.add(wi - 1)
                    else:
                        weak_after.add(wi - 1)
                continue
            if not keepable(ch): continue
            if wi >= len(words): break
            ci += 1
            if ci >= len(str(words[wi].get("text", " "))): wi += 1; ci = 0
        # 2) 收集"词中点"落在保留窗内的存活词（避免边界把划删词首字带进来）
        surv = []
        for gi, w in enumerate(words):
            if w.get("start") is None or w.get("end") is None: continue
            mid = (w["start"] + w["end"]) / 2
            if s <= mid < e: surv.append((gi, w))
        # 3) 先按原句标点分组，再在组内做语义短句分页。
        clauses = []
        clause = []
        for gi, w in surv:
            clause.append(w)
            if gi in strong_after:
                clauses.append(clause)
                clause = []
        if clause:
            clauses.append(clause)
        for clause in clauses:
            local_weak = set()
            cp = 0
            for w in clause:
                cp += len(str(w.get("text", "")))
                if any(
                    gi in weak_after and ww is w
                    for gi, ww in surv
                ):
                    local_weak.add(cp)
            for page in semantic_chunks(clause, max_chars, local_weak):
                txt = "".join(str(x.get("text", "")) for x in page)
                cues.append((
                    t + (page[0]["start"] - s),
                    t + (page[-1]["end"] - s),
                    txt))
        t += dur - xf                     # 扣掉这段接缝的交叉淡化，跟成片时间轴对齐
    cues = [(a, b, txt.strip("，。、,. ")) for a, b, txt in cues if txt.strip("，。、,. ")]
    # 接口绝不能出现两条字幕同时生效；crossfade 模式也把前条结束钳到后条开始。
    nonoverlap = []
    for i, (a, b, txt) in enumerate(cues):
        if i + 1 < len(cues):
            b = min(b, max(a + 0.02, cues[i + 1][0]))
        if b > a:
            nonoverlap.append((a, b, txt))
    return nonoverlap

def write_subtitle_review(cues, path, soft_max):
    """输出全量字幕审查表，强制检查阅读负担、语法断裂和接口重叠。"""
    warnings = []
    lines = [
        "# 字幕审查",
        "",
        f"- 共 {len(cues)} 条字幕；建议单页约 4–{soft_max} 字，语义完整优先于凑字数。",
        "- 检查项：阅读负担、奇怪句尾/句首、数字单位与英文词组、相邻字幕重叠。",
        "",
        "## 自动预警",
        "",
    ]
    for i, (a, b, txt) in enumerate(cues):
        dur = max(0.02, b - a)
        cps = len(txt) / dur
        reasons = []
        if len(txt) > max(11, soft_max + 3):
            reasons.append(f"过长({len(txt)}字)")
        if any(txt.endswith(x) for x in BAD_ENDS):
            reasons.append("句尾疑似悬空")
        if any(txt.startswith(x) for x in BAD_STARTS):
            reasons.append("句首疑似残片")
        if cps > 13:
            reasons.append(f"阅读速度偏快({cps:.1f}字/秒)")
        if i and a < cues[i - 1][1] - 0.001:
            reasons.append("与上一条时间重叠")
        if reasons:
            warnings.append((i, a, b, txt, "；".join(reasons)))
    if warnings:
        for i, a, b, txt, reason in warnings:
            lines.append(f"- [{i:03d}] {a:.2f}–{b:.2f}s `{txt}`：{reason}")
    else:
        lines.append("- 无自动预警。")
    lines += ["", "## 全量字幕", ""]
    for i, (a, b, txt) in enumerate(cues):
        lines.append(f"- [{i:03d}] {a:.2f}–{b:.2f}s　{txt}")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    return len(warnings)

def apply_subtitle_overrides(cues, overrides):
    """按连续文本重排字幕页；只改分页，不改字、不改总时间范围。"""
    for item in overrides or []:
        match = re.sub(r"\s+", "", str(item.get("match", "")))
        pages = [re.sub(r"\s+", "", str(x)) for x in item.get("pages", []) if str(x).strip()]
        if not match or not pages or "".join(pages) != match:
            raise ValueError(f"字幕重排必须逐字守恒：{item}")
        found = None
        for i in range(len(cues)):
            acc = ""
            for j in range(i, len(cues)):
                acc += re.sub(r"\s+", "", cues[j][2])
                if acc == match:
                    found = (i, j + 1)
                    break
                if len(acc) >= len(match) or not match.startswith(acc):
                    break
            if found:
                break
        if not found:
            raise ValueError(f"字幕重排未找到连续原文：{match}")
        i, j = found
        start, end = cues[i][0], cues[j - 1][1]
        total_chars = sum(len(x) for x in pages)
        rebuilt = []
        used = 0
        for k, page in enumerate(pages):
            aa = start + (end - start) * used / total_chars
            used += len(page)
            bb = end if k == len(pages) - 1 else start + (end - start) * used / total_chars
            rebuilt.append((aa, bb, page))
        cues[i:j] = rebuilt
    return cues

def wrap(draw, text, font, max_px, stroke):
    """过宽折成最多两行，取中间断点。"""
    if draw.textbbox((0,0), text, font=font, stroke_width=stroke)[2] <= max_px or len(text) < 4:
        return [text]
    mid = len(text) // 2
    return [text[:mid], text[mid:]]

def hex_rgba(s, default_alpha=255):
    """#RRGGBB 或 #RRGGBBAA 或 颜色名(white/black/yellow/red...) → (r,g,b,a)。"""
    named = {"white": "#FFFFFF", "black": "#000000", "yellow": "#FFE000",
             "red": "#FF3B30", "orange": "#FF9500", "green": "#34C759"}
    s = named.get(s.lower().strip(), s).lstrip("#")
    if len(s) == 6: s += f"{default_alpha:02X}"
    return tuple(int(s[i:i+2], 16) for i in (0, 2, 4, 6))

def render_png(text, font, max_px, path, fill, shadow, tracking, bold, colors=None):
    """白字 + 柔和投影 + 逐字字距 + 白色加粗。colors=每字颜色(关键词金黄),None=全白。"""
    lines = [ln for ln in wrap(ImageDraw.Draw(Image.new("RGBA",(10,10))), text, font, max_px, bold) if ln]
    asc, desc = font.getmetrics(); lh = asc + desc
    def lw(t): return (sum(font.getlength(c)+tracking for c in t) - tracking) if t else 0
    widths = [lw(t) for t in lines]; maxw = max(widths) if widths else 1
    gap = int(lh*0.18)
    sdx, sdy, sblur, scol = shadow if shadow else (0, 0, 0, (0,0,0,0))
    pad = 30 + (sblur*2 + max(abs(sdx), abs(sdy)) if shadow else 0)
    W = int(maxw) + pad*2; H = len(lines)*lh + (len(lines)-1)*gap + pad*2
    def paint(per_char):     # per_char(gi)->颜色
        layer = Image.new("RGBA", (W, H), (0,0,0,0)); d = ImageDraw.Draw(layer)
        y = pad; gi = 0
        for t, w in zip(lines, widths):
            x = (W - w) / 2
            for ch in t:
                c = per_char(gi)
                d.text((x, y), ch, font=font, fill=c, stroke_width=bold, stroke_fill=c)
                x += font.getlength(ch) + tracking; gi += 1
            y += lh + gap
        return layer
    color_of = (lambda gi: colors[gi] if colors and gi < len(colors) else fill)
    base = Image.new("RGBA", (W, H), (0,0,0,0))
    if shadow:                                   # 投影统一暗色(不跟随金黄)
        base.alpha_composite(paint(lambda gi: scol).filter(ImageFilter.GaussianBlur(sblur)), (sdx, sdy))
    base.alpha_composite(paint(color_of), (0, 0))
    base.save(path); return W, H

def _fit_font(font_path, text, max_size, min_size, max_width, stroke=0, index=0):
    """把单行文字缩到指定宽度内。"""
    probe = ImageDraw.Draw(Image.new("RGBA", (10, 10)))
    for size in range(max_size, min_size - 1, -2):
        f = ImageFont.truetype(font_path, size, index=index)
        if probe.textbbox((0, 0), text, font=f, stroke_width=stroke)[2] <= max_width:
            return f
    return ImageFont.truetype(font_path, min_size, index=index)

def _shadow_text(canvas, xy, text, font, fill, stroke_width=0, stroke_fill=None,
                 shadow=(4, 7, 7, (0, 0, 0, 190)), tracking=0):
    """画带柔和投影的文字，适合复杂视频背景。"""
    x, y = xy
    dx, dy, blur, color = shadow
    sh = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    def draw_text(draw, px, py, ink, outline):
        if not tracking:
            draw.text((px, py), text, font=font, fill=ink,
                      stroke_width=stroke_width, stroke_fill=outline)
            return
        for ch in text:
            draw.text((px, py), ch, font=font, fill=ink,
                      stroke_width=stroke_width, stroke_fill=outline)
            px += font.getlength(ch) + tracking
    draw_text(sd, x + dx, y + dy, color, color)
    canvas.alpha_composite(sh.filter(ImageFilter.GaussianBlur(blur)))
    draw_text(ImageDraw.Draw(canvas), x, y, fill, stroke_fill or fill)

def _slant_rgba(layer, degrees):
    """只倾斜非透明内容；正数让字顶端向右倾，模拟剪映标题伪斜体。"""
    if abs(degrees) < 0.1:
        return layer
    bbox = layer.getbbox()
    if not bbox:
        return layer
    crop = layer.crop(bbox)
    shear = math.tan(math.radians(degrees))
    extra = int(abs(shear) * crop.height) + 4
    tilted = crop.transform(
        (crop.width + extra, crop.height),
        Image.Transform.AFFINE,
        (1, shear, -extra if shear > 0 else 0, 0, 1, 0),
        resample=Image.Resampling.BICUBIC)
    out = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    x = max(0, bbox[0] - extra // 2)
    out.alpha_composite(tilted, (x, bbox[1]))
    return out

def render_brand_overlays(plan, VW, VH, font_path, out_dir):
    """把品牌计划渲染为静态透明 PNG。

    返回 [(path, x_expr, y_expr, start, end)]。支持：
    - headline-yellow：顶部居中黄字+黑影
    - topic-two-tone：顶部居中，首行白、次行黄
    - card-left：左上半透明圆角卡，首行白、次行黄
    - identity：人物肩侧姓名+身份；spans 可分段复现
    """
    duration = float(plan.get("_video_duration", 1e9))
    start = float(plan.get("start", 0))
    end = float(plan.get("end", duration))
    style = plan.get("style", "headline-yellow")
    title_lines = plan.get("topic_lines") or ([plan["topic"]] if plan.get("topic") else [])
    try:
        title_font_path = _font_path(
            plan.get("title_font"), preferred="SourceHanSerifSC-Heavy.otf")
    except FileNotFoundError:
        title_font_path = font_path
    title_font_index = int(plan.get("title_font_index", 0))
    items = []

    if title_lines:
        canvas = Image.new("RGBA", (VW, VH), (0, 0, 0, 0))
        if style == "card-left":
            x = int(VW * 0.08); y = int(VH * 0.065)
            maxw = int(VW * 0.70)
            fonts = [
                _fit_font(title_font_path, line, int(VW * 0.060), int(VW * 0.038), maxw,
                          index=title_font_index)
                for line in title_lines[:2]
            ]
            heights = [sum(f.getmetrics()) for f in fonts]
            gap = int(VH * 0.008)
            box_h = sum(heights) + gap * (len(fonts) - 1) + int(VH * 0.040)
            box_w = max(
                ImageDraw.Draw(canvas).textbbox((0, 0), line, font=f)[2]
                for line, f in zip(title_lines, fonts)
            ) + int(VW * 0.07)
            ImageDraw.Draw(canvas).rounded_rectangle(
                (x, y, x + box_w, y + box_h),
                radius=int(VW * 0.025), fill=(205, 225, 255, 155))
            ty = y + int(VH * 0.018)
            for i, (line, f, h) in enumerate(zip(title_lines[:2], fonts, heights)):
                color = (255, 255, 255, 255) if i == 0 else (255, 219, 42, 255)
                _shadow_text(canvas, (x + int(VW * 0.035), ty), line, f, color,
                             shadow=(3, 5, 5, (20, 35, 60, 150)))
                ty += h + gap
        else:
            # 截图一：顶部居中、单行优先；过长时按 plan 中的 topic_lines 分行。
            maxw = int(VW * 0.88)
            fonts = [
                _fit_font(title_font_path, line, int(VW * 0.095), int(VW * 0.055), maxw, 1,
                          index=title_font_index)
                for line in title_lines[:2]
            ]
            topic_colors = plan.get("topic_colors") or (
                ["#FFFFFF", "#FFE100"] if style == "topic-two-tone"
                else ["#FFE100", "#FFE100"])
            y = int(VH * float(plan.get("title_y", 0.145)))
            for line_i, (line, f) in enumerate(zip(title_lines[:2], fonts)):
                bbox = ImageDraw.Draw(canvas).textbbox((0, 0), line, font=f, stroke_width=1)
                x = (VW - (bbox[2] - bbox[0])) // 2
                color = hex_rgba(topic_colors[min(line_i, len(topic_colors) - 1)])
                _shadow_text(canvas, (x, y), line, f, color,
                             stroke_width=max(1, int(VW * 0.0015)),
                             stroke_fill=(80, 60, 0, 255),
                             shadow=(
                                 max(5, int(VW * 0.0045)),
                                 max(8, int(VH * 0.0040)),
                                 max(1, int(VW * 0.0015)),
                                 (0, 0, 0, 225)))
                y += sum(f.getmetrics()) + int(VH * 0.006)
            canvas = _slant_rgba(canvas, float(plan.get("title_slant", 0)))
        p = os.path.join(out_dir, "brand_topic.png")
        canvas.save(p)
        items.append((p, "0", "0", start, end))

    ident = plan.get("identity") or {}
    if ident.get("name"):
        canvas = Image.new("RGBA", (VW, VH), (0, 0, 0, 0))
        side = ident.get("side", "left")
        x = int(VW * (0.12 if side == "left" else 0.60))
        y = int(VH * float(ident.get("y", 0.57)))
        maxw = int(VW * 0.34)
        try:
            identity_font_path = _font_path(ident.get("font") or font_path)
        except FileNotFoundError:
            identity_font_path = font_path
        identity_font_index = int(ident.get("font_index", 0))
        shadow_raw = ident.get("shadow", [3, 5, 2, [0, 0, 0, 220]])
        identity_shadow = (
            int(shadow_raw[0]), int(shadow_raw[1]), int(shadow_raw[2]),
            tuple(int(v) for v in shadow_raw[3]))
        name_font = _fit_font(
            identity_font_path, ident["name"],
            int(VW * float(ident.get("name_size", 0.044))),
            int(VW * 0.030), maxw, index=identity_font_index)
        _shadow_text(
            canvas, (x, y), ident["name"], name_font,
            hex_rgba(ident.get("name_color", "#39D8D0")),
            shadow=identity_shadow,
            tracking=int(ident.get("name_tracking", -1)))
        y += sum(name_font.getmetrics()) + int(
            VH * float(ident.get("name_to_body_gap", 0.001)))
        for line in ident.get("lines", [])[:3]:
            f = _fit_font(
                identity_font_path, line,
                int(VW * float(ident.get("line_size", 0.038))),
                int(VW * 0.026), maxw, index=identity_font_index)
            _shadow_text(
                canvas, (x, y), line, f,
                hex_rgba(ident.get("line_color", "#FFFFFF")),
                shadow=identity_shadow,
                tracking=int(ident.get("line_tracking", 0)))
            y += sum(f.getmetrics()) + int(VH * float(ident.get("line_gap", 0.001)))
        p = os.path.join(out_dir, "brand_identity.png")
        canvas.save(p)
        spans = ident.get("spans") or [[
            float(ident.get("start", start)),
            float(ident.get("end", end))
        ]]
        for aa, bb in spans:
            aa = max(0.0, float(aa))
            bb = min(duration, float(bb))
            if bb > aa:
                items.append((p, "0", "0", aa, bb))
    return items

def render_brand_preview(video, brand_items, out_path, at=1.0):
    """抽一帧叠上品牌层，供交付前检查版式；不烧字幕，避免把瞬时字幕误当固定布局。"""
    base_path = out_path + ".base.jpg"
    rr = subprocess.run(
        [FFMPEG, "-y", "-loglevel", "error", "-ss", str(at), "-i", video,
         "-frames:v", "1", base_path],
        capture_output=True, text=True)
    if rr.returncode != 0:
        print("  ⚠ 品牌预览帧生成失败（不影响视频）", file=sys.stderr)
        return
    base = Image.open(base_path).convert("RGBA")
    for p, _, _, aa, bb in brand_items:
        if aa <= at <= bb:
            base.alpha_composite(Image.open(p).convert("RGBA"))
    base.convert("RGB").save(out_path, quality=92)
    os.remove(base_path)

def render_effect_overlays(plan, VW, VH, font_path, out_dir):
    """按 effect_plan 渲染少量定时花字。

    text.style=chapter：统一章节卡，用于“准则／误区1／误区2／误区3”。
    text.style=emphasis：无底卡的大号强调字，用于句内观点、态度和方法。
    """
    items = []
    hidden = []
    for i, ev in enumerate((plan or {}).get("events", [])):
        text = ev.get("text") or {}
        if text.get("mode") != "flower" or not text.get("content"):
            continue
        aa = float(ev.get("start", 0))
        bb = float(ev.get("end", aa + 1.8))
        if bb <= aa:
            continue
        content = str(text["content"])
        canvas = Image.new("RGBA", (VW, VH), (0, 0, 0, 0))
        style = text.get("style", "emphasis")
        y = int(VH * float(text.get("y", 0.43)))
        if style == "chapter":
            maxw = int(VW * 0.72)
            f = _fit_font(font_path, content, int(VW * 0.066), int(VW * 0.044), maxw)
            draw = ImageDraw.Draw(canvas)
            bbox = draw.textbbox((0, 0), content, font=f)
            tw = bbox[2] - bbox[0]
            th = sum(f.getmetrics())
            pad_x = int(VW * 0.055)
            pad_y = int(VH * 0.018)
            box_w = tw + pad_x * 2
            box_h = th + pad_y * 2
            x = (VW - box_w) // 2
            draw.rounded_rectangle(
                (x, y, x + box_w, y + box_h),
                radius=int(VW * 0.025),
                fill=hex_rgba(text.get("box_color", "#15212DB8")))
            draw.rounded_rectangle(
                (x, y, x + int(VW * 0.012), y + box_h),
                radius=int(VW * 0.006),
                fill=hex_rgba(text.get("accent_color", "#FFE100")))
            _shadow_text(
                canvas, (x + pad_x, y + pad_y), content, f,
                hex_rgba(text.get("color", "#FFFFFF")),
                shadow=(2, 4, 4, (0, 0, 0, 150)))
        else:
            maxw = int(VW * 0.72)
            f = _fit_font(
                font_path, content, int(VW * 0.090), int(VW * 0.052), maxw,
                max(1, int(VW * 0.0015)))
            draw = ImageDraw.Draw(canvas)
            bbox = draw.textbbox((0, 0), content, font=f)
            x = (VW - (bbox[2] - bbox[0])) // 2
            color = hex_rgba(text.get("color", "#E7F54A"))
            _shadow_text(
                canvas, (x, y), content, f, color,
                stroke_width=max(1, int(VW * 0.0015)),
                stroke_fill=(45, 55, 15, 245),
                shadow=(
                    max(4, int(VW * 0.004)),
                    max(6, int(VH * 0.003)),
                    max(2, int(VW * 0.002)),
                    (0, 0, 0, 205)))
        p = os.path.join(out_dir, f"effect_flower_{i:02d}.png")
        canvas.save(p)
        items.append((p, "0", "0", aa, bb))
        if text.get("hide_captions", True):
            hidden.append((aa, bb))
    return items, hidden

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video"); ap.add_argument("final_cuts"); ap.add_argument("transcript"); ap.add_argument("segments")
    ap.add_argument("--out", required=True)
    # 通用字幕默认规格：开源中文字体、白字、柔和投影、自然字重、中下部。
    ap.add_argument("--font", default=None, help="已授权字体；默认使用 Skill 自带字体")
    ap.add_argument("--font-size", type=int, default=0, help="0=按画面宽自动(宽×0.064)")
    ap.add_argument("--font-color", default="#FFFFFF", help="字幕主色，默认白")
    ap.add_argument("--bold", type=int, default=0, help="加粗量(白描边像素)。0=自然字重(定稿)。嫌细可调 2")
    ap.add_argument("--letter-spacing", type=float, default=-0.03, help="字距(占字号比例)，负=收紧。定稿 -0.03")
    ap.add_argument("--shadow", default="on", choices=["on","off"], help="柔和投影。默认开")
    ap.add_argument("--shadow-alpha", type=int, default=200, help="投影浓度 0-255")
    ap.add_argument("--xfade", type=float, default=0.07, help="退路值;优先读 render_offsets.json 精确对齐")
    ap.add_argument("--max-width", type=float, default=0.9, help="字幕最大宽度占画面比例，超了折两行")
    ap.add_argument("--margin-bottom", type=int, default=0, help="0=按画面高自动(高×0.25，中下部)")
    ap.add_argument("--max-chars", type=int, default=8,
                    help="字幕语义分页的软目标；允许为保持完整短语适度超过，默认8")
    ap.add_argument("--emphasis-plan", help="语义标注 JSON:[{\"word\":\"关键步骤\",\"color\":\"gold\"},{\"word\":\"注意风险\",\"color\":\"red\"}] —— AI读懂内容挑的重点")
    ap.add_argument("--corrections", help="纠错 JSON:{\"示力\":\"示例\",\"方按\":\"方案\"} —— ASR错字改对")
    ap.add_argument("--brand-plan", help="品牌浮层 JSON：主题大字/标题卡 + 可分段人物身份名牌；见 references/brand_overlays.md")
    ap.add_argument("--effect-plan", help="后期效果 JSON：目前执行带成片时间的 flower 花字，并在对应区间隐藏普通字幕")
    ap.add_argument("--subtitle-overrides",
                    help="全量通读后的语义重排 JSON；match 与 pages 必须逐字守恒，只改分页不改内容")
    ap.add_argument("--encoder", default="auto",
                    choices=["auto", "nvenc", "videotoolbox", "x264"],
                    help="auto：Windows优先NVENC，macOS优先VideoToolbox，失败回退x264")
    a = ap.parse_args()
    try:
        a.font = _font_path(a.font)
    except FileNotFoundError as exc:
        sys.exit(str(exc))

    fc = json.load(open(a.final_cuts, encoding="utf-8"))
    tr = json.load(open(a.transcript, encoding="utf-8"))
    seg = json.load(open(a.segments, encoding="utf-8"))
    # 画面宽
    r = subprocess.run([FFPROBE,"-v","error","-select_streams","v:0","-show_entries","stream=width,height:format=duration",
                        "-of","json", a.video], capture_output=True, text=True)
    st = json.loads(r.stdout)["streams"][0]; VW, VH = st["width"], st["height"]
    video_duration = float(json.loads(r.stdout).get("format", {}).get("duration", 1e9))
    fs = a.font_size or int(VW * 0.064)                              # 字号:按画面宽自动
    mb = a.margin_bottom or int(VH * 0.25)                           # 底距:中下部
    font = ImageFont.truetype(a.font, fs)
    fill = hex_rgba(a.font_color)
    bold = a.bold if a.bold >= 0 else max(2, fs // 22)
    tracking = round(fs * a.letter_spacing)                           # 字距(负=收紧)
    shadow = (0, max(3, fs//16), max(4, fs//12), (0,0,0,a.shadow_alpha)) if a.shadow=="on" else None
    max_px = int(VW * a.max_width)

    # 优先读渲染写出的精确每段起点(零漂移);没有再退回按 xf 推算
    ofp = os.path.join(os.path.dirname(a.final_cuts), "render_offsets.json")
    offsets = None
    if os.path.exists(ofp):
        rm = json.load(open(ofp, encoding="utf-8")); offsets = rm.get("offsets"); a.xfade = rm.get("xf", a.xfade)
        print(f"  用渲染精确起点对齐字幕({len(offsets)}段)")
    cues = build_cues(fc, tr, seg, a.max_chars, a.xfade, offsets)
    subs = os.path.join(a.out, "subs"); os.makedirs(subs, exist_ok=True)
    for f in os.listdir(subs): os.remove(os.path.join(subs, f))
    pngs = []
    corr = json.load(open(a.corrections, encoding="utf-8")) if a.corrections else {}
    plan_raw = json.load(open(a.emphasis_plan, encoding="utf-8")) if a.emphasis_plan else []
    plan = [(d["word"], _col(d.get("color", "gold"))) for d in plan_raw]
    effect = json.load(open(a.effect_plan, encoding="utf-8")) if a.effect_plan else {}
    effect_items, hidden_ranges = render_effect_overlays(effect, VW, VH, a.font, subs)
    if hidden_ranges:
        visible = []
        for aa, bb, txt in cues:
            keep = True
            for ha, hb in hidden_ranges:
                if bb <= ha + 0.01 or aa >= hb - 0.01:
                    continue
                if aa < ha < bb <= hb:
                    bb = ha
                elif ha <= aa < hb < bb:
                    aa = hb
                else:
                    keep = False
                    break
            if keep and bb - aa >= 0.08:
                visible.append((aa, bb, txt))
        cues = visible
    cues = [(aa, bb, apply_corrections(txt, corr)) for aa, bb, txt in cues]
    if a.subtitle_overrides:
        overrides = json.load(open(a.subtitle_overrides, encoding="utf-8"))
        cues = apply_subtitle_overrides(cues, overrides)
        print(f"✓ 人工语义重排 {len(overrides)} 处（逐字守恒）")
    nwarn = write_subtitle_review(
        cues, os.path.join(a.out, "字幕审查.md"), a.max_chars)
    print(f"✓ 字幕审查：{os.path.join(a.out, '字幕审查.md')}（自动预警 {nwarn} 条）")
    nemph = 0
    for i, (aa, bb, txt) in enumerate(cues):
        p = os.path.join(subs, f"s{i:03d}.png")
        cols = emphasis_colors(txt, fill, plan)
        if any(c != fill for c in cols): nemph += 1
        render_png(txt, font, max_px, p, fill, shadow, tracking, bold, cols); pngs.append((p, aa, bb))
    print(f"✓ {len(pngs)} 条字幕，字号 {fs} 字距 {tracking}，{nemph} 条有语义强调")

    # 品牌浮层和逐句字幕同一次编码完成，避免二次压制。
    brand_items = []
    if a.brand_plan:
        brand = json.load(open(a.brand_plan, encoding="utf-8"))
        brand["_video_duration"] = video_duration
        brand_items = render_brand_overlays(brand, VW, VH, a.font, subs)
        render_brand_preview(
            a.video, brand_items, os.path.join(a.out, "brand_preview.jpg"),
            min(1.0, max(0.0, video_duration / 2)))
        print(f"✓ 品牌浮层 {len(brand_items)} 层（主题/人物名牌）")
    if effect_items:
        print(f"✓ 计划花字 {len(effect_items)} 处，隐藏冲突字幕区间 {len(hidden_ranges)} 处")
    overlay_items = brand_items + effect_items + [
        (p, "(W-w)/2", f"H-h-{mb}", aa, bb) for p, aa, bb in pngs
    ]
    inputs = ["-i", a.video]
    for p,_,_,_,_ in overlay_items: inputs += ["-i", p]
    parts = []; cur = "[0:v]"
    for idx, (p, xx, yy, aa, bb) in enumerate(overlay_items, start=1):
        out = f"[v{idx}]"
        parts.append(
            f"{cur}[{idx}:v]overlay={xx}:{yy}:"
            f"enable='gte(t,{aa:.3f})*lt(t,{bb:.3f})'{out}")
        cur = out
    out_name = "preview_字幕包装.mp4" if a.brand_plan else "preview_字幕.mp4"
    outp = os.path.join(a.out, out_name)
    base = [FFMPEG,"-y","-loglevel","error", *inputs,
            "-filter_complex", ";".join(parts), "-map", cur, "-map", "0:a"]
    tail = ["-c:a", "copy", outp]
    rr = None
    used = None
    for encoder_label, enc_args in encoder_attempts(a.encoder):
        rr = subprocess.run(base + enc_args + tail, capture_output=True, text=True)
        if rr.returncode == 0:
            used = encoder_label
            break
        if a.encoder == "auto":
            print(f"{encoder_label} 编码失败，尝试下一编码器…", file=sys.stderr)
    if rr.returncode != 0: sys.exit("烧字幕失败:\n"+rr.stderr[-800:])
    print(f"✓ 带字幕成片（{used}）：{outp}")

if __name__ == "__main__":
    main()
