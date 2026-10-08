#!/usr/bin/env python3
"""⑥ 渲染成品 MP4：按 final_cuts 保留段拼接。

口播默认使用画面硬切，并只在每段音频边缘做极短淡入淡出，避免同机位人物在
xfade 中出现双影，也避免相邻字幕在重叠时间内同时显示。保留 crossfade 作为可选模式。
每个保留段的边界已在 render_from_timeline 里留了字尾(字说完)。编码器按系统自动选择：
Windows 优先 NVIDIA NVENC，macOS 优先 VideoToolbox，失败均回退 libx264。
"""
import argparse, json, os, subprocess, sys
from runtime_support import FFMPEG, FFPROBE, encoder_attempts

def ffprobe_dur(video):
    r = subprocess.run([FFPROBE,"-v","error","-select_streams","v:0","-show_entries",
                        "format=duration","-of","default=noprint_wrappers=1:nokey=1", video],
                       capture_output=True, text=True)
    try: return float(r.stdout.strip())
    except: return 1e9

def build_filter(keeps, xf, zooms=None, VW=None, VH=None, transition="hard"):
    """拼接 v/a 保留段。

    hard：画面直接切，音频每段边缘做 8ms 微淡化后 concat，不产生时间重叠。
    crossfade：沿用旧版 xfade/acrossfade，适合确实需要溶解的异景素材。
    zooms={段索引:放大倍数} → 该段做推近(中心裁剪+放回原尺寸)，给结论/金句/CTA 加码强调。"""
    zooms = zooms or {}
    n = len(keeps)
    parts = []
    for i, k in enumerate(keeps):
        s, e = k["start"], k["end"]
        z = zooms.get(i, 1.0)
        zf = f",crop=iw/{z}:ih/{z},scale={VW}:{VH}" if z > 1.001 and VW else ""
        parts.append(f"[0:v]trim=start={s}:end={e},setpts=PTS-STARTPTS{zf},format=yuv420p[v{i}]")
        dur = e - s
        if transition == "hard":
            fade = min(0.008, max(0.002, dur * 0.08))
            out_start = max(0.0, dur - fade)
            parts.append(
                f"[0:a]atrim=start={s}:end={e},asetpts=PTS-STARTPTS,"
                f"afade=t=in:st=0:d={fade:.4f},"
                f"afade=t=out:st={out_start:.4f}:d={fade:.4f}[a{i}]")
        else:
            parts.append(f"[0:a]atrim=start={s}:end={e},asetpts=PTS-STARTPTS[a{i}]")
    if n == 1:
        parts.append("[v0]null[vc];[a0]anull[ac]")
    elif transition == "hard":
        parts.append("".join(f"[v{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=0[vc]")
        parts.append("".join(f"[a{i}]" for i in range(n)) + f"concat=n={n}:v=0:a=1[ac]")
    else:
        vprev, aprev = "v0", "a0"
        running = keeps[0]["end"] - keeps[0]["start"]
        for i in range(1, n):
            off = max(0.0, running - xf)
            vo, ao = f"vx{i}", f"ax{i}"
            parts.append(f"[{vprev}][v{i}]xfade=transition=fade:duration={xf}:offset={off:.4f}[{vo}]")
            parts.append(f"[{aprev}][a{i}]acrossfade=d={xf}:c1=tri:c2=tri[{ao}]")
            vprev, aprev = vo, ao
            running += (keeps[i]["end"] - keeps[i]["start"]) - xf
        parts.append(f"[{vprev}]null[vc];[{aprev}]anull[ac]")
    parts.append("[ac]loudnorm=I=-16:TP=-1.5:LRA=11[aout]")
    parts.append("[vc]null[vout]")
    return ";".join(parts)

def run(cmd): return subprocess.run(cmd, capture_output=True, text=True)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video"); ap.add_argument("final_cuts")
    ap.add_argument("--out", required=True)
    ap.add_argument("--transition", default="hard", choices=["hard", "crossfade"],
                    help="口播默认 hard：画面硬切+音频边缘微淡化；crossfade 为旧版音画溶解")
    ap.add_argument("--xfade", type=float, default=0.07, help="仅 crossfade 模式使用的重叠秒数")
    ap.add_argument("--zoom", help="推近 JSON:{\"3\":1.18,\"8\":1.18} 段索引→放大倍数(结论/金句/CTA处推近)")
    ap.add_argument("--encoder", default="auto",
                    choices=["auto","nvenc","videotoolbox","x264"])
    a = ap.parse_args()
    keeps = json.load(open(a.final_cuts, encoding="utf-8"))["keeps"]
    safe_end = ffprobe_dur(a.video) - 0.05
    keeps = [{"start": k["start"], "end": min(k["end"], safe_end)} for k in keeps
             if min(k["end"], safe_end) - k["start"] > 0.02]
    if not keeps: sys.exit("无保留段")
    # 画面尺寸(推近后 scale 回原尺寸用)
    pr = run([FFPROBE,"-v","error","-select_streams","v:0","-show_entries","stream=width,height","-of","json", a.video])
    st = json.loads(pr.stdout)["streams"][0]; VW, VH = st["width"], st["height"]
    zooms = {int(k): float(v) for k, v in json.load(open(a.zoom, encoding="utf-8")).items()} if a.zoom else {}
    min_dur = min(k["end"]-k["start"] for k in keeps)
    xf = 0.0 if a.transition == "hard" else round(min(a.xfade, max(0.02, min_dur*0.45)), 3)
    fc = build_filter(keeps, xf, zooms, VW, VH, a.transition)
    # 写出每段在成片里的精确起点(供 make_subtitles 对齐字幕，杜绝任何漂移，7分钟也不飘)
    offs = [0.0]; running = keeps[0]["end"] - keeps[0]["start"]
    for i in range(1, len(keeps)):
        offs.append(round(max(0.0, running - xf), 4))
        running += (keeps[i]["end"] - keeps[i]["start"]) - xf
    json.dump({"xf": xf, "offsets": offs}, open(os.path.join(a.out, "render_offsets.json"), "w", encoding="utf-8"))
    out = os.path.join(a.out, "preview.mp4")
    base = [FFMPEG,"-y","-loglevel","error","-i",a.video,"-filter_complex",fc,
            "-map","[vout]","-map","[aout]"]
    tail = ["-c:a","aac","-b:a","192k","-movflags","+faststart",out]
    r = None
    used = None
    for encoder_label, enc_args in encoder_attempts(a.encoder):
        r = run(base + enc_args + tail)
        if r.returncode == 0:
            used = encoder_label
            break
        if a.encoder == "auto":
            print(f"{encoder_label} 编码失败，尝试下一编码器…", file=sys.stderr)
    if r.returncode != 0: sys.exit(f"渲染失败:\n{r.stderr[-1200:]}")
    label = "画面硬切+音频边缘微淡化" if a.transition == "hard" else f"交叉淡化 {xf}s"
    print(f"✓ 成品({label}，{used}): {out}")

if __name__ == "__main__":
    main()
