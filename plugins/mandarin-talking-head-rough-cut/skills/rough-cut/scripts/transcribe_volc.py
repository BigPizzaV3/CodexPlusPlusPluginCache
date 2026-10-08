#!/usr/bin/env python3
"""② 转写（火山 大模型录音文件识别 2.0 · 词级 + 说话人）→ transcript.json。

按火山官方文档《录音文件识别标准版HTTP》(大模型2.0)实现，已核对：
- 提交 POST https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit
- 查询 POST https://openspeech.bytedance.com/api/v3/auc/bigmodel/query
- 资源ID：录音文件识别2.0 = volc.seedasr.auc（1.0 才是 volc.bigasr.auc）
- 鉴权头：旧版控制台 X-Api-App-Key + X-Api-Access-Key；新版控制台 X-Api-Key
- 音频：audio.url 必填（火山只收可下载URL，不收本地文件/base64）→ 本地文件须先有 URL

用法：
  transcribe_volc.py <audio.wav> --out DIR --audio-url <URL>
  （音频必须给一个火山能下载的 URL；本地文件先上传到 TOS/云存储拿 URL 再传入）
凭证只读用户显式传入的 --config、ROUGH_CUT_CONFIG 或当前任务目录的 config.json。
绝不向上搜索历史配置或复用其他用户账号（模板见 assets/config.example.json）。
"""
import argparse, json, os, sys, time, uuid
import urllib.request, urllib.error
from config_loader import load_config

def _cfg(explicit=None):
    try:
        data, path = load_config(explicit)
    except (FileNotFoundError, ValueError, json.JSONDecodeError) as exc:
        sys.exit(str(exc))
    if "volc_asr" not in data:
        sys.exit(f"配置缺少 volc_asr：{path}")
    return data["volc_asr"], path

def _headers(cfg, reqid):
    rid = cfg.get("resource_id") or cfg.get("cluster") or "volc.seedasr.auc"
    h = {"Content-Type": "application/json", "X-Api-Resource-Id": rid,
         "X-Api-Request-Id": reqid, "X-Api-Sequence": "-1"}
    if cfg.get("api_key"):  # 新版控制台单Key
        h["X-Api-Key"] = cfg["api_key"]
    else:                    # 旧版控制台 AppID+Token
        h["X-Api-App-Key"] = cfg["app_id"]; h["X-Api-Access-Key"] = cfg["access_token"]
    return h

def _post(url, headers, body):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode()), dict(r.getheaders())

def transcribe(audio_url, fmt, cfg):
    ep = cfg["endpoint"].rstrip("/")
    reqid = str(uuid.uuid4())
    headers = _headers(cfg, reqid)
    submit_body = {
        "user": {"uid": reqid},
        "audio": {"url": audio_url, "format": fmt, "rate": 16000, "bits": 16, "channel": 1},
        "request": {
            "model_name": "bigmodel",
            "enable_itn": True, "enable_punc": True,
            "enable_ddc": False,  # 关顺滑：要保留语气词/重复，交给我们自己判删
            "enable_speaker_info": bool(cfg.get("enable_speaker", True)),
            "show_utterances": True,
        },
    }
    print(f"提交火山转写（resource={headers['X-Api-Resource-Id']}）…")
    _, rh = _post(ep + "/api/v3/auc/bigmodel/submit", headers, submit_body)
    status = rh.get("X-Api-Status-Code") or rh.get("x-api-status-code")
    if status and status not in ("20000000", "0"):
        sys.exit(f"提交失败 status={status} msg={rh.get('X-Api-Message')}")
    # 轮询查询（同一 reqid 作为任务ID）
    for _ in range(200):
        time.sleep(3)
        q, qh = _post(ep + "/api/v3/auc/bigmodel/query", _headers(cfg, reqid), {})
        st = qh.get("X-Api-Status-Code") or qh.get("x-api-status-code")
        if st in ("20000000", "0") and (q.get("result") or q.get("utterances")):
            return _normalize(q)
        if st and st not in ("20000001", "20000002", "0", "20000000"):  # 非处理中/成功
            sys.exit(f"查询失败 status={st} msg={qh.get('X-Api-Message')} body={str(q)[:200]}")
        print("  转写中 …")
    sys.exit("火山转写查询超时")

def _normalize(resp):
    r = resp.get("result") or resp
    utts_raw = r.get("utterances") or []
    utterances, full = [], []
    for sid, u in enumerate(utts_raw):
        words = [{"text": w.get("text",""), "start": _sec(w.get("start_time")), "end": _sec(w.get("end_time"))}
                 for w in (u.get("words") or [])]
        spk = str((u.get("additions") or {}).get("speaker", "") or "")
        text = u.get("text", "".join(x["text"] for x in words))
        utterances.append({"sid": sid, "text": text, "start": _sec(u.get("start_time")),
                           "end": _sec(u.get("end_time")), "speaker": spk, "words": words})
        full.append(text)
    return {"utterances": utterances, "full_text": r.get("text","".join(full)), "engine": "volc-seedasr-2.0"}

def _sec(v):
    return None if v is None else round(float(v)/1000.0, 3)  # 火山返回毫秒

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("wav")
    ap.add_argument("--out", required=True)
    ap.add_argument("--audio-url", required=True, help="火山能下载的音频URL（本地文件先上传TOS/云存储）")
    ap.add_argument("--format", default="wav")
    ap.add_argument("--config", help="火山配置 JSON；也可设置 ROUGH_CUT_CONFIG")
    a = ap.parse_args()
    cfg, cfgpath = _cfg(a.config)
    if "填你的" in (cfg.get("app_id","")+cfg.get("access_token","")+cfg.get("api_key","")):
        sys.exit(f"config.json 火山凭证未填（{cfgpath}）")
    try:
        tr = transcribe(a.audio_url, a.format, cfg)
    except urllib.error.HTTPError as e:
        sys.exit(f"火山 HTTP {e.code}: {e.read().decode()[:300]}")
    os.makedirs(a.out, exist_ok=True)
    p = os.path.join(a.out, "transcript.json")
    json.dump(tr, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    n=len(tr["utterances"]); nw=sum(len(u["words"]) for u in tr["utterances"])
    print(f"✓ 火山转写：{n} 句 / {nw} 词，说话人 {sorted(set(u['speaker'] for u in tr['utterances']))}")
    print(f"✓ {p}")

if __name__ == "__main__":
    main()
