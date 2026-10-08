#!/usr/bin/env python3
"""③ 生成剪辑真值：transcript.json → segments.json + timeline.md（spec15 机制）。

- segments.json：每个 [sN] 的源时间 + 词级时间（渲染层的时间真值，不进 timeline.md）
- timeline.md：转写稿，一行一个 [sN]。④裁决就是在这份稿上划词/删句/重排（像改文档）。

timeline.md 语法（供 ④ 使用，render_from_timeline.py 解析）：
  [s5] 这一句话              → 保留整句
  [s5] 这一句~~呢~~话         → 删除 ~~ ~~ 内的词（对应音频被切掉）
  删掉整行                    → 删掉那句
  移动行顺序                  → 重排播放顺序
  @编导 [s3] 对对对           → 非主讲人；④应删掉这行（删行=删段）
  [s7] ……这段 %待确认：疑似跑题% → 保留该行，把理由留给编导看
  <!-- 前摇 --> / <!-- 收工 --> → 阶段注释；对应区间的行 ④应删掉
"""
import argparse, json, os

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("transcript")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    tr = json.load(open(a.transcript, encoding="utf-8"))
    utts = tr["utterances"]
    speakers = sorted(set(str(u.get("speaker","")) for u in utts if u.get("speaker","")!=""))
    multi = len(speakers) > 1

    segments = {}
    lines = ["# timeline.md — 中文口播剪辑稿",
             "# 规则：删词用 ~~ ~~，删句删整行，重排移动行，@编导行应删，%待确认%保留。",
             "# ④裁决就在这份稿上做（结构删除 + 逐句清口水/磕巴/重复），改完交 render_from_timeline.py。",
             ""]
    for u in utts:
        sid = u["sid"]
        segments[str(sid)] = {
            "in": u["start"], "out": u["end"], "speaker": str(u.get("speaker","")),
            "words": u["words"],
        }
        spk = str(u.get("speaker",""))
        prefix = (f"@spk{spk} " if multi and spk else "")
        lines.append(f"{prefix}[s{sid}] {u['text']}")

    os.makedirs(a.out, exist_ok=True)
    sp = os.path.join(a.out, "segments.json")
    tp = os.path.join(a.out, "timeline.md")
    json.dump(segments, open(sp,"w", encoding="utf-8"), ensure_ascii=False, indent=1)
    open(tp,"w", encoding="utf-8").write("\n".join(lines)+"\n")
    print(f"✓ segments.json：{len(segments)} 段（时间真值）")
    print(f"✓ timeline.md：{len(utts)} 句" + (f"，{len(speakers)} 个说话人 {speakers}" if multi else "，单说话人"))
    print(f"  → ④裁决在 {tp} 上改（划词/删句/重排），然后 render_from_timeline.py")

if __name__ == "__main__":
    main()
