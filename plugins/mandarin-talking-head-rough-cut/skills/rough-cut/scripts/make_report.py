#!/usr/bin/env python3
"""⑦ 汇总剪辑报告.md —— 从 final_cuts.json(⑤产出的统计) + timeline.md(④裁决稿) 汇总。

报告只是给剪辑师备查的记录(删了多大结构、哪几处 agent 拿不准留着待确认),不是必读。
真正的决策日志就是带删改的 timeline.md 本身。
用法：make_report.py <output目录> --out <output目录>
"""
import argparse, json, os, re

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out_dir")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    d = a.out_dir

    fc = json.load(open(os.path.join(d, "final_cuts.json"), encoding="utf-8")) if os.path.exists(os.path.join(d, "final_cuts.json")) else {}
    st = fc.get("stats", {})
    src = fc.get("src_duration", 0); kept = fc.get("kept_duration", 0)
    ratio = (100 - kept / src * 100) if src else 0

    # 从 timeline.md 捞 %待确认% 的行
    tl = os.path.join(d, "timeline.md")
    pending = []
    if os.path.exists(tl):
        for raw in open(tl, encoding="utf-8"):
            s = raw.strip()
            if s.startswith("#") or not re.search(r'\[s\d+\]', s):
                continue                       # 跳过表头注释、非 [sN] 行
            if re.search(r'%待确认[^%]*%', s):
                sid = re.search(r'\[s(\d+)\]', s)
                pending.append((sid.group(1) if sid else "?", s))

    L = ["# 粗剪报告\n"]
    L.append(
        f"- 原片 {src:.0f}s → 成片 ~{kept:.0f}s"
        f"（删减比例 {ratio:.0f}%，仅作记录，不用于判定剪辑质量）"
        if src else "- （无 final_cuts.json）")
    L.append(f"- 保留 {st.get('lines_kept','?')} 句 · 编导行丢弃 {st.get('editor_dropped',0)} · 句内划删词组 {st.get('words_struck',0)} · 对齐回退 {st.get('align_fallback',0)}")
    if st.get("fillers_restored_no_breath"):
        L.append(f"- {st['fillers_restored_no_breath']} 处口水词两侧无气口，自动保留（避免硬切）")
    L.append("")

    if pending:
        L.append("## ⚠ 待你确认（agent 拿不准，留着没删，请扫一眼）\n")
        for sid, line in pending:
            L.append(f"- [s{sid}] {line}")
        L.append("")

    for w in fc.get("warnings", []):
        L.append(f"- ⚠ {w}")
    if fc.get("warnings"): L.append("")

    L.append("> 完整删改明细见 timeline.md（带 ~~划删~~、删行、@编导 的稿本身就是决策日志）。")

    path = os.path.join(a.out, "剪辑报告.md")
    open(path, "w", encoding="utf-8").write("\n".join(L))
    print(f"✓ 报告: {path}" + (f"（{len(pending)} 处待确认）" if pending else ""))

if __name__ == "__main__":
    main()
