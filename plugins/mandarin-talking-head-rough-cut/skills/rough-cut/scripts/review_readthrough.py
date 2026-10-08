#!/usr/bin/env python3
"""⑤.5 复查：把编辑后的 timeline 生成"成片逐字稿"（删改全应用、按播放顺序连读），
供 Agent 和人站在"观众实际会听到什么"的角度通读一遍再渲染。抄自 ChatCut 剪后复查那一步。

为什么必须有这步：④是在带 ~~删改~~ 标记的稿子上剪的，脑子里想的是"删哪些"；
但观众听到的是"删完剩下的连读"。不把剩下的连起来读一遍，就会漏掉：
  - 主语/指代丢了、下一句凭空蹦出来（如"…立刻提升。最值得借鉴的一个案例。"缺"他是"）
  - 删过头把话切断、或漏清的口误/磕巴
  - 顺序乱、连接词（所以/但是/然后/这）悬空
用法：review_readthrough.py <timeline_edited.md> [segments.json]  # 打印逐字稿+预警+清单
"""
import argparse, json, os, re, sys

# 句首若是这些指代/连接词，多半要靠上一句给落点——重点做承接检查
DANGLING = ["这", "那", "他", "她", "它", "其", "所以", "但是", "而且", "而", "然后",
            "因为", "于是", "这样", "这个", "那个", "它们", "他们", "所以说", "就是"]
# 带货/引流红线：广告法绝对化用语
ADLAW = ["最好", "最佳", "最强", "最高", "第一", "顶级", "顶尖", "国家级", "绝对",
         "100%", "百分之百", "根治", "永久", "最便宜", "最低价", "独家", "唯一"]

def clean_line(s):
    """去掉 @spkX 前缀、[sN] 标记、%待确认%、把 ~~删~~ 的内容真正删掉，返回观众会听到的文本。"""
    s = re.sub(r'~~[^~]*~~', '', s)          # 划删的词组：内容丢掉
    # 只移除明确的 %待确认…% 注释，不能把两个百分数之间的正文吞掉。
    s = re.sub(r'%待确认[^%]*%', '', s)
    s = re.sub(r'@\S+\s*', '', s)            # @spkX / @编导 前缀
    m = re.search(r'\[s\d+\]', s)
    if m: s = s[m.end():]
    return s.strip()

def sid_of(s):
    m = re.search(r'\[s(\d+)\]', s); return m.group(1) if m else None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("timeline")
    ap.add_argument("segments", nargs="?")
    a = ap.parse_args()

    kept = []   # (sid, text, is_editor)
    for raw in open(a.timeline, encoding="utf-8"):
        s = raw.strip()
        if not s or s.startswith("#") or (s.startswith("<!--") and s.endswith("-->")): continue
        if not re.search(r'\[s\d+\]', s): continue
        if re.match(r'^@(编导|非主讲)', s): continue     # 非主讲人不进片
        txt = clean_line(s)
        if txt: kept.append((sid_of(s), txt))

    print("=" * 60)
    print("成片逐字稿（观众实际会听到的，按播放顺序连读）")
    print("=" * 60)
    print("".join(t for _, t in kept))
    print()
    print("—— 逐句（带 sN，便于回改）——")
    for sid, t in kept:
        print(f"[s{sid}] {t}")

    # 自动预警
    warns = []
    for i, (sid, t) in enumerate(kept):
        head = t.lstrip("，。、 ")
        for w in DANGLING:
            if head.startswith(w):
                prev = kept[i-1][1][-14:] if i > 0 else "（这是开头第一句）"
                warns.append(f"[s{sid}] 以「{w}」开头 → 承接检查：上一句「…{prev}」有没有给它落点？")
                break
        for w in ADLAW:
            if w in t:
                warns.append(f"[s{sid}] ⚠广告法：出现绝对化用语「{w}」→ 带货口播必须删/换合规版")
    if a.segments and os.path.exists(a.segments):
        seg = json.load(open(a.segments, encoding="utf-8"))
        total = max(v["out"] for v in seg.values())
        kept_sids = {sid for sid, _ in kept}
        # 粗略：按保留的整段时长估（划删未扣，仅供参考）
        dur = sum(v["out"]-v["in"] for k, v in seg.items() if k in kept_sids)
        ratio = dur/total*100
        print(
            f"\n时长估算：保留约 {dur:.0f}s / 原片 {total:.0f}s"
            f"（删减比例 {100-ratio:.0f}%，仅作记录，不用于判定剪辑质量）")

    print("\n" + "=" * 60)
    print("复查清单（对着上面的逐字稿逐条过，只修明确的问题）")
    print("=" * 60)
    for line in [
        "1. 逻辑链顺不顺？有没有前面删了、后面却接不上/凭空蹦出来的句子（主语、指代、背景丢了）？",
        "2. 连接词悬空没有？所以/但是/而且/然后/这/那——它指的东西还在不在？",
        "3. 删过头没有？有没有把完整的话切断、或该保的卖点/论据删没了？",
        "4. 漏清没有？还剩没剩明显的口误、磕巴、重复、口水（逐词看，别放过'英语英语''对'这种）？",
        "5. 顺序对不对？播放顺序读起来是不是一条顺的线？",
        "6. 意图对不对？有没有把她'讲给自己听的盘算话/编导场外话'当内容留下了？",
        "7. 合规红线（带货/引流）：广告法绝对化用语清干净没有？",
        "8. 开头是不是四种话头之一、结尾收得住、整体还像本人自然说话？",
    ]:
        print("  □ " + line)
    if warns:
        print("\n自动预警（重点看这几处）：")
        for w in warns: print("  ! " + w)
    else:
        print("\n自动预警：无（仍需人工按清单通读）")

if __name__ == "__main__":
    main()
