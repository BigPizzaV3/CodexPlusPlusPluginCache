#!/usr/bin/env python3
"""Read-only semantic JSON comparison; Python 3.9+, standard library only."""
import argparse
from decimal import Decimal
import html
import json
from pathlib import Path
import sys

MAX_BYTES = 20 * 1024 * 1024


def json_text(value, pretty=False):
    """Preserve exact decimal numbers without converting them to binary floats."""
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, dict):
        sep = ",\n" if pretty else ","
        return "{" + sep.join(json.dumps(k, ensure_ascii=True) + ": " + json_text(v)
                              for k, v in value.items()) + "}"
    if isinstance(value, list):
        return "[" + ",".join(json_text(v) for v in value) + "]"
    return json.dumps(value, ensure_ascii=True, allow_nan=False)


def reject_constant(value):
    raise ValueError("nonstandard JSON number: " + value)


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate JSON object key: " + json.dumps(key))
        result[key] = value
    return result


def read_json(path):
    with Path(path).open("rb") as stream:
        data = stream.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise ValueError("input exceeds 20 MiB: " + str(path))
    return json.loads(data.decode("utf-8-sig"), object_pairs_hook=unique_object,
                      parse_float=Decimal, parse_constant=reject_constant)


def kind(value):
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, (int, Decimal)):
        return "number"
    if isinstance(value, dict):
        return "object"
    if isinstance(value, list):
        return "array"
    return "string"


def pointer(parent, key):
    return parent + "/" + str(key).replace("~", "~0").replace("/", "~1")


def identity(value):
    if kind(value) not in ("string", "number"):
        raise ValueError("array IDs must be strings or numbers")
    return kind(value), value


def index_array(values, key, path):
    result = {}
    for i, item in enumerate(values):
        if not isinstance(item, dict) or key not in item:
            raise ValueError("missing array ID field " + json.dumps(key) + " at " + pointer(path, i))
        ident = identity(item[key])
        if ident in result:
            raise ValueError("duplicate array ID at " + (path or "<root>"))
        result[ident] = (i, item)
    return result


def validate_arrays(value, key, path=""):
    if isinstance(value, dict):
        for name, child in value.items():
            validate_arrays(child, key, pointer(path, name))
    elif isinstance(value, list):
        if any(isinstance(item, dict) for item in value):
            index_array(value, key, path)
        for i, child in enumerate(value):
            validate_arrays(child, key, pointer(path, i))


def compare(before, after, array_key=None, ignore_keys=(), limit=200):
    if limit < 1:
        raise ValueError("max-changes must be at least 1")
    ignored = set(ignore_keys)
    if array_key in ignored:
        raise ValueError("the array ID field cannot also be ignored")
    if array_key is not None:
        validate_arrays(before, array_key)
        validate_arrays(after, array_key)
    counts = {k: 0 for k in ("added", "removed", "changed", "type_changed")}
    changes = []

    def cleaned(value):
        if isinstance(value, dict):
            return {k: cleaned(v) for k, v in value.items() if k not in ignored}
        if isinstance(value, list):
            return [cleaned(v) for v in value]
        return value

    def emit(change_kind, old_path, new_path, old=None, new=None):
        counts[change_kind] += 1
        if len(changes) >= limit:
            return
        entry = {"kind": change_kind, "before_path": old_path, "after_path": new_path}
        if change_kind != "added":
            entry["before"] = cleaned(old)
        if change_kind != "removed":
            entry["after"] = cleaned(new)
        changes.append(entry)

    def walk(old, new, op, np):
        if kind(old) != kind(new):
            emit("type_changed", op, np, old, new)
        elif isinstance(old, dict):
            for name in sorted((old.keys() | new.keys()) - ignored):
                if name not in old:
                    emit("added", None, pointer(np, name), new=new[name])
                elif name not in new:
                    emit("removed", pointer(op, name), None, old=old[name])
                else:
                    walk(old[name], new[name], pointer(op, name), pointer(np, name))
        elif isinstance(old, list):
            if array_key is not None and any(isinstance(v, dict) for v in old + new):
                oi, ni = index_array(old, array_key, op), index_array(new, array_key, np)
                for ident, (i, item) in oi.items():
                    if ident not in ni:
                        emit("removed", pointer(op, i), None, old=item)
                    else:
                        j, updated = ni[ident]
                        walk(item, updated, pointer(op, i), pointer(np, j))
                for ident, (j, item) in ni.items():
                    if ident not in oi:
                        emit("added", None, pointer(np, j), new=item)
            else:
                for i in range(max(len(old), len(new))):
                    if i >= len(old):
                        emit("added", None, pointer(np, i), new=new[i])
                    elif i >= len(new):
                        emit("removed", pointer(op, i), None, old=old[i])
                    else:
                        walk(old[i], new[i], pointer(op, i), pointer(np, i))
        elif old != new:
            emit("changed", op, np, old, new)

    walk(before, after, "", "")
    total = sum(counts.values())
    return {"summary": {**counts, "total": total},
            "options": {"array_key": array_key, "ignore_keys": sorted(ignored), "max_changes": limit},
            "changes": changes, "omitted": total - len(changes)}


def markdown(report):
    def code(value):
        return "<code>" + html.escape(json_text(value)).replace("|", "&#124;") + "</code>"

    summary = report["summary"]
    lines = ["# JSON Change Lens", "", ", ".join(f"{k}: {v}" for k, v in summary.items()), "",
             "Matching: " + ("object arrays by " + code(report["options"]["array_key"])
                              if report["options"]["array_key"] is not None else "positional arrays"),
             "Ignored object keys: " + code(report["options"]["ignore_keys"]), ""]
    if not summary["total"]:
        lines.append("No differences under the selected rules.")
    else:
        lines += ["| Kind | Before pointer | After pointer | Before | After |",
                  "| --- | --- | --- | --- | --- |"]
        for entry in report["changes"]:
            lines.append("| " + " | ".join(code(entry[field]) if field in entry else "—"
                         for field in ("kind", "before_path", "after_path", "before", "after")) + " |")
    if report["omitted"]:
        lines += ["", f"{report['omitted']} additional changes omitted; totals include them."]
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("before", help="before JSON file (UTF-8, at most 20 MiB)")
    parser.add_argument("after", help="after JSON file")
    parser.add_argument("--array-key", help="unique direct ID field for every array of objects")
    parser.add_argument("--ignore-key", action="append", default=[], help="ignore this object-key name at all depths")
    parser.add_argument("--max-changes", type=int, default=200)
    parser.add_argument("--format", choices=("json", "markdown"), default="markdown")
    parser.add_argument("--output", help="create a new report file; existing paths are refused")
    args = parser.parse_args()
    try:
        report = compare(read_json(args.before), read_json(args.after), args.array_key,
                         args.ignore_key, args.max_changes)
        output = json_text(report, pretty=True) + "\n" if args.format == "json" else markdown(report)
        if args.output:
            with Path(args.output).open("x", encoding="utf-8") as stream:
                stream.write(output)
        else:
            sys.stdout.write(output)
        return 1 if report["summary"]["total"] else 0
    except (OSError, ValueError, RecursionError) as exc:
        message = "input nesting exceeds the supported depth" if isinstance(exc, RecursionError) else str(exc)
        print("json-change-lens: " + message, file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
