#!/usr/bin/env python3
"""Estimate how much draft sentence wording traces to a supplied transcript.

Adapted from charlie947/voiceprint (MIT).
This is a provenance heuristic. It is not a detector guarantee.

Usage:
    python3 voiceprint_trace.py DRAFT TRANSCRIPT [--gate 85]
"""
import difflib, re, sys, os, json

STOP = set("""a an the and or but so if then than that this these those there here is are was
were be been being am do does did doing have has had having will would can could should
of in on at by for with from into to as up down out over under again it its i me my we us
our you your he she they them their what which who not no""".split())

def words(t):
    return re.findall(r"[a-z][a-z'’-]*", t.lower())

def content(t):
    return [w for w in words(t) if w not in STOP and len(w) > 2]

def strip_md(t):
    t = re.sub(r'^---\n.*?\n---\n', '', t, flags=re.S)
    t = re.sub(r'```.*?```', '', t, flags=re.S)
    t = re.sub(r'!\[[^\]]*\]\([^)]*\)', '', t)
    t = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', t)
    return t

def sentences(t):
    out = []
    for block in t.split('\n\n'):
        b = block.strip()
        if not b or b.startswith('#'):
            continue
        for s in re.split(r'(?<=[.!?])\s+', b.replace('\n', ' ')):
            s = s.strip()
            if s and len(s.split()) >= 3 and any(c.isalpha() for c in s):
                out.append(s)
    return out

def best_match(sent_words, src_words, window_pad=12):
    if not sent_words:
        return 0.0
    sm = difflib.SequenceMatcher(None, sent_words, src_words, autojunk=False)
    blocks = [b for b in sm.get_matching_blocks() if b.size]
    if not blocks:
        return 0.0
    big = max(blocks, key=lambda b: b.size)
    lo = max(0, big.b - len(sent_words) - window_pad)
    hi = min(len(src_words), big.b + len(sent_words) + window_pad)
    pool = list(src_words[lo:hi])
    hits = 0
    for w in sent_words:
        if w in pool:
            pool.remove(w)
            hits += 1
    return hits / len(sent_words)

def main():
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    draft_p, src_p = sys.argv[1], sys.argv[2]
    gate = 85.0
    if "--gate" in sys.argv:
        gate = float(sys.argv[sys.argv.index("--gate") + 1])
    draft = strip_md(open(draft_p, encoding="utf-8", errors="ignore").read())
    src_words = content(open(src_p, encoding="utf-8", errors="ignore").read())
    if len(src_words) < 50:
        raise SystemExit("Transcript too short to trace against.")
    rows = []
    for s in sentences(draft):
        sw = content(s)
        score = best_match(sw, src_words)
        tag = "VERBATIM" if score >= 0.85 else ("EDITED" if score >= 0.55 else "COMPOSED")
        rows.append((tag, score, len(s.split()), s))
    total = sum(x[2] for x in rows) or 1
    trace_words = sum(x[2] for x in rows if x[0] in ("VERBATIM", "EDITED"))
    pct = 100 * trace_words / total
    composed = [x[3] for x in rows if x[0] == "COMPOSED"]
    result = {
        "traceable_percent": round(pct, 1),
        "gate": gate,
        "pass": pct >= gate,
        "sentences": len(rows),
        "composed_sentences": composed,
        "note": "Provenance heuristic, not a detector guarantee."
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0 if pct >= gate else 1

if __name__ == "__main__":
    raise SystemExit(main())
