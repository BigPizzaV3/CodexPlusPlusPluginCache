#!/usr/bin/env python3
"""Cross-platform TOS upload → Volc ASR → guaranteed TOS cleanup."""
import argparse
import json
import sys
import urllib.error
import uuid
from pathlib import Path

from transcribe_volc import _cfg as asr_config, transcribe
from upload_tos import _cfg as tos_config, _client


def main():
    ap = argparse.ArgumentParser(
        description="上传本地音频到用户自己的TOS，转写完成或失败后自动删除临时对象")
    ap.add_argument("audio", help="probe.py 生成的 audio.wav")
    ap.add_argument("--out", required=True)
    ap.add_argument("--config", required=True, help="用户自己的火山配置")
    ap.add_argument("--expires", type=int, default=3600)
    args = ap.parse_args()

    audio = Path(args.audio).resolve()
    out = Path(args.out).resolve()
    if not audio.is_file():
        sys.exit(f"音频不存在：{audio}")
    out.mkdir(parents=True, exist_ok=True)

    whole, cfg_path = tos_config(args.config)
    tos_cfg = whole.get("volc_tos") or {}
    asr_cfg, _ = asr_config(args.config)
    client, tos = _client(tos_cfg)
    suffix = audio.suffix.lower() or ".wav"
    key = f"rough-cut-temp/{uuid.uuid4().hex}{suffix}"
    key_file = out / "tos_key.txt"
    uploaded = False
    try:
        client.put_object_from_file(tos_cfg["bucket"], key, str(audio))
        uploaded = True
        key_file.write_text(key, encoding="utf-8")
        signed = client.pre_signed_url(
            tos.HttpMethodType.Http_Method_Get,
            tos_cfg["bucket"],
            key,
            expires=args.expires,
        )
        print(f"✓ 已上传到用户自己的 TOS（配置：{cfg_path}，密钥未显示）")
        result = transcribe(signed.signed_url, audio.suffix.lstrip(".") or "wav", asr_cfg)
        target = out / "transcript.json"
        target.write_text(
            json.dumps(result, ensure_ascii=False, indent=1) + "\n",
            encoding="utf-8",
        )
        words = sum(len(u.get("words", [])) for u in result.get("utterances", []))
        if not result.get("utterances") or not words:
            sys.exit("转写返回但缺少逐句或词级时间戳，已停止后续剪辑。")
        print(f"✓ 火山转写：{len(result['utterances'])} 句 / {words} 词")
        print(f"✓ {target}")
    except urllib.error.HTTPError as exc:
        sys.exit(f"火山 HTTP {exc.code}: {exc.read().decode(errors='replace')[:500]}")
    finally:
        if uploaded:
            try:
                client.delete_object(tos_cfg["bucket"], key)
                key_file.unlink(missing_ok=True)
                print("✓ 已删除用户 TOS 中的临时音频")
            except Exception as cleanup_error:
                print(
                    f"⚠ 临时音频删除失败，请立即按 tos_key.txt 手动清理：{cleanup_error}",
                    file=sys.stderr,
                )


if __name__ == "__main__":
    main()
