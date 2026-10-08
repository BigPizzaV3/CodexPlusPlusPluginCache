#!/usr/bin/env python3
"""②a 把本地音频上传到火山 TOS(对象存储)，返回一个可下载的预签名 URL，供火山 ASR 使用。

火山录音文件识别只收音频 URL，本地文件先经这一步。音频只进你自己的私有 TOS 桶。
凭证只读用户显式传入的 --config、ROUGH_CUT_CONFIG 或当前任务目录的 config.json。
绝不向上搜索历史配置或复用其他用户账号（模板见 assets/config.example.json）。

用法：upload_tos.py <本地音频文件>   # 打印一行 URL
"""
import argparse, json, os, sys, uuid
from pathlib import Path
from config_loader import load_config

def _cfg(explicit=None):
    try:
        return load_config(explicit)
    except (FileNotFoundError, ValueError, json.JSONDecodeError) as exc:
        sys.exit(str(exc))

def _client(t):
    import tos
    return tos.TosClientV2(t["access_key"], t["secret_key"], t["endpoint"], t["region"]), tos

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("file", nargs="?", help="要上传的本地音频")
    ap.add_argument("--expires", type=int, default=3600)
    ap.add_argument("--delete", metavar="KEY", help="转写完后删除 TOS 上的这个对象(省存储/隐私)")
    ap.add_argument("--key-out", help="把上传后的对象 key 写到这个文件，供后续删除")
    ap.add_argument("--config", help="火山配置 JSON；也可设置 ROUGH_CUT_CONFIG")
    a = ap.parse_args()
    cfg, cfgpath = _cfg(a.config)
    t = cfg.get("volc_tos")
    if not t or "填" in str(t.get("access_key","")):
        sys.exit(f"config.json 里 volc_tos 还没填（{cfgpath}）：需要 access_key/secret_key/endpoint/region/bucket")
    try:
        client, tos = _client(t)
    except ImportError:
        sys.exit("未装 tos SDK：请用当前虚拟环境安装 requirements.txt")
    if a.delete:  # 清理模式
        client.delete_object(t["bucket"], a.delete)
        print(f"已删除 TOS 对象 {a.delete}")
        return
    if not a.file: sys.exit("要么给音频文件上传，要么 --delete KEY 清理")
    suffix = Path(a.file).suffix.lower() or ".bin"
    key = f"rough-cut-temp/{uuid.uuid4().hex}{suffix}"
    client.put_object_from_file(t["bucket"], key, a.file)
    out = client.pre_signed_url(tos.HttpMethodType.Http_Method_Get, t["bucket"], key, expires=a.expires)
    if a.key_out: open(a.key_out, "w", encoding="utf-8").write(key)
    print(out.signed_url)

if __name__ == "__main__":
    main()
