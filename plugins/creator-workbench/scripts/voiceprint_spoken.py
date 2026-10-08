#!/usr/bin/env python3
"""Measure simple spoken-register features from text.

Usage:
    python3 voiceprint_spoken.py FILE
"""
from pathlib import Path
import json, re, statistics as st, sys

MARKERS = re.compile(r"\b(so|right|okay|now|anyway|look|honestly|basically|actually|i mean|you know)\b", re.I)
HEDGES = re.compile(r"\b(kind of|sort of|a bit|maybe|probably|just|really|quite|pretty much)\b", re.I)
WORDS = re.compile(r"[a-z']+", re.I)

def main():
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    t = Path(sys.argv[1]).read_text(encoding="utf-8", errors="ignore")
    words = WORDS.findall(t)
    ss = [x.strip() for x in re.split(r"(?<=[.!?])\s+|\n+", t) if len(x.split()) >= 3]
    n = len(words) or 1
    result = {
        "words": len(words),
        "sentences": len(ss),
        "mean_sentence_words": round(st.mean([len(x.split()) for x in ss]), 2) if ss else 0,
        "discourse_markers_per_1k": round(1000 * len(MARKERS.findall(t)) / n, 2),
        "hedges_per_1k": round(1000 * len(HEDGES.findall(t)) / n, 2),
        "lexical_diversity": round(len(set(w.lower() for w in words)) / n, 3)
    }
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
