#!/usr/bin/env python3
"""音频工具库（被 render_from_timeline.py import）：load_audio 读 wav、valley 找能量谷。
不单独运行——⑤render_from_timeline 用这里的 valley 做气口感知回退(判断划词切口两侧有没有换气声)。
"""
import argparse, json, os, sys, wave
import numpy as np

WIN = 0.010          # 10ms 能量窗
SEARCH = 0.5         # 切点前后搜索半径
MIN_GAP_MS = 120     # 两句空隙<120ms 不在此切（挪走）
ZC_R = 0.006         # 过零点搜索半径

def load_audio(wav):
    w = wave.open(wav)
    sr = w.getframerate()
    a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32)/32768
    return a, sr

def valley(a, sr, t, lo=None, hi=None):
    """在 [t-SEARCH, t+SEARCH]（或指定 lo/hi）找能量最低点，落过零点。"""
    lo = lo if lo is not None else t - SEARCH
    hi = hi if hi is not None else t + SEARCH
    s0, s1 = max(0,int(lo*sr)), min(len(a),int(hi*sr))
    seg = a[s0:s1]
    win = int(WIN*sr); n = len(seg)//win
    if n == 0: return t, 0.0
    db = np.array([20*np.log10(max(np.sqrt((seg[i*win:(i+1)*win]**2).mean()),1e-6)) for i in range(n)])
    i = int(np.argmin(db))
    tt = lo + (i+0.5)*win/sr
    # 落过零点
    c = int(tt*sr)
    zw = a[max(0,c-int(ZC_R*sr)):c+int(ZC_R*sr)]
    zc = np.where(np.diff(np.sign(zw)))[0]
    if len(zc):
        mid = len(zw)//2
        tt += (zc[np.argmin(abs(zc-mid))]-mid)/sr
    return round(tt,4), round(float(db[i]),1)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("decisions")
    ap.add_argument("wav")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    audio, sr = load_audio(a.wav)
    dur = len(audio)/sr
    dels = [d for d in json.load(open(a.decisions, encoding="utf-8")) if d.get("action")=="delete"]
    dels.sort(key=lambda x: x["start"])

    # 每个删除段的入出点吸附到能量谷
    snapped = []
    warnings = []
    for d in dels:
        s, sdb = valley(audio, sr, d["start"])
        e, edb = valley(audio, sr, d["end"])
        # 空隙检查：若吸附点所在处不是真静区（谷值太响），警告
        if sdb > -45 or edb > -45:
            warnings.append(f"{d['start']:.1f}s 附近无明显气口（谷值{max(sdb,edb)}dB），切点可能不干净")
        snapped.append({"del_start": s, "del_end": e, "text": d.get("text",""),
                        "confidence": d.get("confidence","")})

    # 把"删除段"翻成"保留段"
    keeps, cursor = [], 0.0
    for d in snapped:
        if d["del_start"] > cursor + 0.05:
            keeps.append({"start": round(cursor,4), "end": round(d["del_start"],4)})
        cursor = max(cursor, d["del_end"])
    if cursor < dur - 0.05:
        keeps.append({"start": round(cursor,4), "end": round(dur,4)})

    result = {"keeps": keeps, "deletes": snapped, "warnings": warnings,
              "crossfade_ms": 60, "note": "接缝音频60ms交叉淡化，画面硬切"}
    path = os.path.join(a.out, "final_cuts.json")
    json.dump(result, open(path,"w", encoding="utf-8"), ensure_ascii=False, indent=1)
    total_keep = sum(k["end"]-k["start"] for k in keeps)
    print(f"✓ 保留 {len(keeps)} 段，成片约 {total_keep:.1f}s（原 {dur:.1f}s）")
    if warnings:
        print(f"⚠ {len(warnings)} 处切点需注意:")
        for w in warnings[:5]: print("  -", w)
    print(f"✓ {path}")

if __name__ == "__main__":
    main()
