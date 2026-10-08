#!/usr/bin/env python3
"""⑤ 把编辑后的 timeline.md 变成词级精确的保留段（spec15 渲染契约）。

输入：编辑后的 timeline.md + segments.json + audio.wav
输出：final_cuts.json（{"keeps":[{start,end}]}，词级精确、已切点吸附），交 render_preview.py 渲 MP4。

核心：④在 timeline.md 上划词/删句/重排 →
  - 一行 [sN] 存在      = 保留该段
  - 行内 ~~词~~         = 从该段挖掉这些词的时间区间（词级精确，就是 ChatCut 的"删字即删片"）
  - 删掉整行            = 删掉该段
  - @编导 开头的行       = 非主讲人，丢弃
  - 行顺序             = 输出播放顺序（重排）
  - %待确认…% 后缀      = 注释，保留该行
时间真值来自 segments.json 的词级时间戳；不在 timeline.md 里写时间码。
"""
import argparse, json, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from snap_cuts import load_audio, valley  # 复用成片A/B验证过的能量谷+过零点吸附

CJK = lambda ch: '一' <= ch <= '鿿'
def _keepable_char(ch): return CJK(ch) or ch.isalnum()

def survivors(line_text, words):
    """按行内 ~~ ~~ 删除线，算出该段存活的词，合并成连续时间子区间。
    对齐失败（④改写了词而非只划删）→ 返回 None，调用方保留整段（漏删不误删）。"""
    # 1) 逐字标注是否被划删
    plain = []  # (char, struck)
    struck = False
    for p in re.split(r'(~~)', line_text):
        if p == '~~': struck = not struck; continue
        for ch in p:
            if _keepable_char(ch): plain.append((ch, struck))
    # 2) 段内词的逐字
    wchars = []  # (char, word_index)
    for wi, w in enumerate(words):
        for ch in w.get("text",""):
            if _keepable_char(ch): wchars.append((ch, wi))
    # 3) 对齐
    if len(plain) != len(wchars) or any(plain[k][0] != wchars[k][0] for k in range(len(plain))):
        return None
    struck_words = {wchars[k][1] for k,(ch,st) in enumerate(plain) if st}
    # 4) 存活词连成区间，只在"被划删的词"处断开——相邻存活词之间的自然停顿保留在区间内
    #    (不再按 20ms 词间隙乱切，避免把一句好话切成一堆碎段再靠气口回退焊回)
    ranges = []
    cur = None
    for wi, w in enumerate(words):
        if wi in struck_words:
            cur = None                      # 划删处断开
            continue
        s, e = w.get("start"), w.get("end")
        if s is None or e is None: continue
        if cur is None:
            cur = [s, e]; ranges.append(cur)
        else:
            cur[1] = e                      # 跨自然停顿延续，保留她说话的自然节奏
    return ranges

def parse_timeline(md_path, segments):
    """→ 有序的保留子区间列表 [(start,end,note)]，以及统计。"""
    keeps, stats = [], {"lines_kept":0, "lines_deleted":0, "editor_dropped":0, "words_struck":0, "align_fallback":0}
    for raw in open(md_path, encoding="utf-8"):
        line = raw.rstrip("\n")
        s = line.strip()
        if not s or s.startswith("#"): continue          # 注释/表头
        if s.startswith("<!--") and s.endswith("-->"): continue  # 阶段注释
        m = re.search(r'\[s(\d+)\]', s)
        if not m: continue
        sid = m.group(1)
        if sid not in segments: continue
        # 非主讲人行丢弃
        if re.match(r'^@(编导|非主讲)', s):
            stats["editor_dropped"] += 1; continue
        # 取 [sN] 之后的正文，去掉 @前缀、%待确认%后缀
        body = s[m.end():]
        # 只移除明确的 %待确认…% 注释；普通百分数（如 1%、3%）必须保留。
        body = re.sub(r'%待确认[^%]*%', '', body).strip()
        seg = segments[sid]
        if '~~' in body:
            rs = survivors(body, seg["words"])
            if rs is None:
                keeps.append([seg["in"], seg["out"], f"s{sid}(对齐回退,整段保留)"]); stats["align_fallback"] += 1
            else:
                stats["words_struck"] += body.count('~~')//2
                for a,b in rs: keeps.append([a,b,f"s{sid}"])
        else:
            keeps.append([seg["in"], seg["out"], f"s{sid}"])
        stats["lines_kept"] += 1
    return keeps, stats

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("timeline"); ap.add_argument("segments"); ap.add_argument("wav")
    ap.add_argument("--out", required=True)
    ap.add_argument("--no-snap", action="store_true")
    ap.add_argument("--min-gap-db", type=float, default=-38.0, help="段内划词切口两侧气口都弱于此则保留该词(避免硬切)")
    ap.add_argument("--keep-choppy", action="store_true", help="关掉气口感知回退,严格按划词切(可能碎)")
    ap.add_argument("--boundary-overrides",
                    help="听感复查后的边界补偿 JSON，如 {\"s2\":{\"tail\":0.28}}；仍受相邻源段边界保护")
    a = ap.parse_args()
    segments = json.load(open(a.segments, encoding="utf-8"))
    boundary_overrides = json.load(open(a.boundary_overrides, encoding="utf-8")) if a.boundary_overrides else {}
    total_src = max(v["out"] for v in segments.values())
    keeps, stats = parse_timeline(a.timeline, segments)
    if not keeps: sys.exit("timeline.md 没有可保留的行")

    # 切点吸附：每个子区间的入/出点吸到最近能量谷（±0.25s）
    warns = []; restored = 0
    if not a.no_snap:
        try:
            audio, sr = load_audio(a.wav)
            TH = a.min_gap_db  # 两侧气口都弱于此(dB)→视为无气口
            # 气口感知回退(spec14:删了显得硬接就别删)：段内划词切口若两侧都无气口，合并回去=保留该口水词。
            # 只对极短的单口癖(划删跨度 <0.35s，如"呃/额/嗯")生效——绝不能跨过一整句 retake/口误自纠，
            # 否则会把被划掉的整句(如"不要谈具体的数据")又焊回成片。
            MAX_RESTORE_GAP = 0.35
            if not a.keep_choppy:
                merged = [keeps[0]]
                for k in keeps[1:]:
                    prev = merged[-1]
                    gap = k[0] - prev[1]
                    if k[2] == prev[2] and 0.02 < gap < MAX_RESTORE_GAP:  # 同段的极短划词切口
                        _, dprev = valley(audio, sr, prev[1], lo=prev[1]-0.15, hi=prev[1]+0.15)
                        _, dnext = valley(audio, sr, k[0], lo=k[0]-0.15, hi=k[0]+0.15)
                        if dprev > TH and dnext > TH:
                            prev[1] = k[1]; restored += 1; continue  # 无气口→保留
                    merged.append(k)
                keeps = merged
            # 词边界 + 向外留余量：不吸能量谷(连续语速下会切进字中间)，只向外扩让字说完。
            # 但余量只能长进"段间静音"，绝不越过相邻源片段的边界——否则会把上/下一句
            # (尤其被删掉的编导插话/口水句，常与本句零间隔紧挨)的声音带回来。
            LEAD, TAIL, LAST_TAIL = 0.04, 0.08, 0.30
            segs_sorted = sorted(((v["in"], v["out"], sid) for sid, v in segments.items()),
                                 key=lambda x: x[0])
            def _sid(note):
                mm = re.search(r's(\d+)', note or ""); return mm.group(1) if mm else None
            n = len(keeps)
            for idx, k in enumerate(keeps):
                sid = _sid(k[2]); ka, kb = k[0], k[1]
                lo, hi = 0.0, float(total_src)
                for i0, o0, s0 in segs_sorted:          # 卡在最近的"别的源片段"边界上
                    if s0 == sid: continue
                    if o0 <= ka + 1e-6 and o0 > lo: lo = o0
                    if i0 >= kb - 1e-6 and i0 < hi: hi = i0
                # 同一源段里两个保留块之间必然是 timeline 明确划删的内容。
                # 禁止 LEAD/TAIL 向该缺口扩展，否则会把被删词的半个字带回：
                # 例如前一保留块后划删以“不”开头的短语时，TAIL=0.08 可能带回半个“不”，
                # 后一保留块又以“不”开头，造成音频和字幕出现重复字头。
                if idx > 0 and _sid(keeps[idx-1][2]) == sid:
                    lo = max(lo, ka)
                if idx < n-1 and _sid(keeps[idx+1][2]) == sid:
                    hi = min(hi, kb)
                # 若保留块本身从源段中部开始/结束，说明前后是 timeline 明确划删的词。
                # 禁止通用 LEAD/TAIL 向划删前后缀扩展，避免“其实”只带回半个“实”。
                seg_info = segments.get(sid, {})
                if ka > float(seg_info.get("in", ka)) + 0.01:
                    lo = max(lo, ka)
                if kb < float(seg_info.get("out", kb)) - 0.01:
                    hi = min(hi, kb)
                k[0] = round(max(lo, ka - LEAD), 3)             # 入点小幅引入
                override = boundary_overrides.get(f"s{sid}", boundary_overrides.get(str(sid), {}))
                tail = float(override.get(
                    "tail", LAST_TAIL if idx == n-1 else TAIL))  # 听感复查可加长字尾
                if tail < 0 or tail > 0.8:
                    raise ValueError(f"s{sid} tail 必须在 0–0.8 秒")
                k[1] = round(min(hi, kb + tail), 3)
            if restored: warns.append(f"{restored} 处口水词两侧无气口自动保留(避免硬切)")
        except Exception as e:
            warns.append(f"边界处理跳过：{e}")
    stats["fillers_restored_no_breath"] = restored

    keeps_out = [{"start": k[0], "end": k[1], "seg": k[2]} for k in keeps if k[1] > k[0] + 0.02]
    kept_dur = sum(k["end"]-k["start"] for k in keeps_out)
    os.makedirs(a.out, exist_ok=True)
    fp = os.path.join(a.out, "final_cuts.json")
    json.dump({"keeps": keeps_out, "warnings": warns, "stats": stats,
               "src_duration": round(total_src,1), "kept_duration": round(kept_dur,1)},
              open(fp,"w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(
        f"✓ 保留 {len(keeps_out)} 段，成片约 {kept_dur:.1f}s / 原片 {total_src:.1f}s "
        f"（删减比例 {(1-kept_dur/total_src)*100:.0f}%，仅作记录）")
    print(f"  行保留 {stats['lines_kept']} · 编导行丢弃 {stats['editor_dropped']} · "
          f"划删词组 {stats['words_struck']} · 对齐回退 {stats['align_fallback']}")
    for w in warns: print("  ⚠", w)
    print(f"✓ {fp} → 交 render_preview.py 渲 MP4")

if __name__ == "__main__":
    main()
