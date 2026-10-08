#!/usr/bin/env python3
"""⑦ 生成剪映草稿。用 pyJianYingDraft（成片 A/B 验证）。
草稿里每个保留段指向原片的一个时间区间——原片一帧没删，拖边缘能长回来。
"""
import argparse, json, os, sys
from runtime_support import FFPROBE

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("final_cuts")
    ap.add_argument("--out", required=True)
    ap.add_argument("--name", required=True)
    a = ap.parse_args()

    try:
        import pyJianYingDraft as draft
        from pyJianYingDraft import trange, TrackType, TrackSpec
    except ImportError:
        sys.exit("未安装 pyjianyingdraft。运行: pip install pyjianyingdraft")

    cuts = json.load(open(a.final_cuts, encoding="utf-8"))
    keeps = cuts["keeps"]
    US = 1_000_000

    # 读分辨率
    meta_path = os.path.join(os.path.dirname(a.final_cuts), "meta.json")
    m = {}
    if os.path.exists(meta_path):
        m = json.load(open(meta_path, encoding="utf-8")); W, H, FPS = m["width"], m["height"], int(round(m["fps"]))
    else:
        W, H, FPS = 1080, 1920, 30

    draft_root = os.path.join(a.out, "剪映草稿")
    os.makedirs(draft_root, exist_ok=True)
    folder = draft.DraftFolder(draft_root)
    script = folder.create_draft(a.name, W, H, fps=FPS, allow_replace=True)
    script.append_track(TrackSpec(TrackType.video, "主视频"))

    # 读视频真实时长，clamp 防止音视频时长差导致越界
    import subprocess
    real_dur = float(subprocess.run(
        [FFPROBE,"-v","error","-select_streams","v:0","-show_entries","stream=duration",
         "-of","default=noprint_wrappers=1:nokey=1", os.path.abspath(a.video)],
        capture_output=True, text=True).stdout.strip() or m.get("duration", 1e9))
    safe_end = real_dur - 0.05

    cursor = 0
    for k in keeps:
        k_end = min(k["end"], safe_end)
        if k_end <= k["start"]:
            continue
        src_start = int(k["start"]*US)
        dur = int((k_end-k["start"])*US)
        seg = draft.VideoSegment(os.path.abspath(a.video),
                                 trange(cursor, dur),
                                 source_timerange=trange(src_start, dur))
        script.add_segment(seg, "主视频")
        cursor += dur

    script.save()
    print(f"✓ 剪映草稿: {draft_root}/{a.name}（{len(keeps)}段, 时间线{cursor/US:.1f}s）")
    print("  剪辑师: 拷进剪映草稿目录 → 重启剪映即见。删掉的内容拖片段边缘可找回。")

if __name__ == "__main__":
    main()
