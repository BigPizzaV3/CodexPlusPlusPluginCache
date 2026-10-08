"""Frozen plans, live approval, reversible execution, and durable receipts."""
from __future__ import annotations

import contextlib
import json
import os
from pathlib import Path
import stat
import sys
import time
import uuid

from guard import (LOCK, VAULT, Root, SafetyError, absolute, canonical, collision_key,
                   digest, identity, new_report_dir, parts, read_json, rename_backend,
                   same_content, stamp, sync_dir, write_new)

VERSION = 2
ACTIONS = {"MOVE", "QUARANTINE", "METADATA", "RESTORE"}
MAX_OPERATIONS = 1000


def exact_equal(root, left, right):
    """Fresh reads, not filecmp's stat-keyed comparison cache."""
    paths = [root.check(left), root.check(right)]
    with contextlib.ExitStack() as stack:
        handles = []
        for rel in (left, right):
            parent, name = stack.enter_context(root.parent_fd(rel))
            fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=parent)
            handle = stack.enter_context(os.fdopen(fd, "rb"))
            if not stat.S_ISREG(os.fstat(handle.fileno()).st_mode):
                raise SafetyError("Non-regular duplicate")
            handles.append(handle)
        before = [stamp(os.fstat(f.fileno())) for f in handles]
        while True:
            a, b = [f.read(1024 * 1024) for f in handles]
            if a != b:
                return False
            if not a:
                break
        return before == [stamp(os.fstat(f.fileno())) for f in handles] == [stamp(p.lstat()) for p in paths]


def metadata_safe(root, rel):
    """Narrow signature checks. AppleDouble and arbitrary ._* are never candidates."""
    p = root.check(rel)
    root.snapshot(rel)
    with p.open("rb") as handle:
        head = handle.read(8)
    return ((p.name == ".DS_Store" and head == b"\x00\x00\x00\x01Bud1") or
            (p.name == "Thumbs.db" and head == b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"))


def make_plan(root, requests):
    plan_id = uuid.uuid4().hex
    operations = []
    for index, request in enumerate(requests):
        action = request["action"]
        if action not in ACTIONS:
            raise SafetyError("Unsupported operation; permanent deletion is disabled")
        src = request["src"]
        internal = action == "RESTORE" and parts(src)[0] == VAULT
        if not internal:
            root.protect_project(src)
        before = root.snapshot(src, internal=internal)
        op = {"id": f"{index + 1:04d}", "action": action, "src": src, "before": before,
              "reason": str(request.get("reason", "User-proposed operation"))}
        if action in {"QUARANTINE", "METADATA"}:
            op["dest"] = f"{VAULT}/{plan_id}/{op['id']}/{Path(src).name}"
        else:
            op["dest"] = request["dest"]
        if action == "QUARANTINE":
            keep = request["keep"]
            root.protect_project(keep)
            kept = root.snapshot(keep)
            if identity_dict(before) == identity_dict(kept):
                raise SafetyError("Keep and candidate identify the same file")
            if not same_content(before, kept) or (os.name == "posix" and not exact_equal(root, src, keep)):
                raise SafetyError("Duplicate is not exactly equal")
            op.update(keep=keep, keep_before=kept)
        if action == "METADATA" and not metadata_safe(root, src):
            raise SafetyError("Unrecognized metadata; leave it untouched")
        operations.append(op)
    plan = {"version": VERSION, "id": plan_id, "created": time.time(),
            "root": str(root.path), "root_identity": root.id,
            "policy": root.policy, "operations": operations}
    plan["plan_hash"] = digest(plan)
    preflight(plan, allow_empty=True)
    return plan


def identity_dict(snapshot):
    return {k: snapshot[k] for k in ("dev", "ino")}


def selected_operations(plan, selection=None):
    ops = plan["operations"]
    if selection is None:
        return ops
    if not isinstance(selection, dict) or set(selection) != {"plan_hash", "ids"}:
        raise SafetyError("Selection is not an approval; expected plan_hash and ids only")
    ids = selection["ids"]
    if (selection["plan_hash"] != plan["plan_hash"] or not isinstance(ids, list) or
            any(not isinstance(i, str) for i in ids) or len(ids) != len(set(ids))):
        raise SafetyError("Selection does not match this plan")
    if not set(ids).issubset({op["id"] for op in ops}):
        raise SafetyError("Unknown operation ID")
    return [op for op in ops if op["id"] in ids]


def preflight(plan, selection=None, *, allow_empty=False):
    keys = {"version", "id", "created", "root", "root_identity", "policy", "operations", "plan_hash"}
    if not isinstance(plan, dict) or set(plan) != keys or plan["version"] != VERSION:
        raise SafetyError("Unsupported plan schema; regenerate the plan")
    unsigned = {k: v for k, v in plan.items() if k != "plan_hash"}
    if digest(unsigned) != plan["plan_hash"]:
        raise SafetyError("Plan changed after generation")
    if not isinstance(plan["id"], str) or len(plan["id"]) != 32 or any(c not in "0123456789abcdef" for c in plan["id"]):
        raise SafetyError("Invalid plan ID")
    age = time.time() - plan["created"]
    if age < -60 or age > 86400:
        raise SafetyError("Plan expired or is from the future; generate a fresh plan")
    if not isinstance(plan["operations"], list) or len(plan["operations"]) > MAX_OPERATIONS:
        raise SafetyError("Limit each reviewed plan to 1000 operations")
    root = Root(plan["root"])
    if root.id != plan["root_identity"] or root.policy != plan["policy"]:
        raise SafetyError("Root or policy changed")
    ops = selected_operations(plan, selection)
    if not ops and not allow_empty:
        raise SafetyError("No operations selected")
    sources, dests, identities, ids = set(), set(), set(), set()
    for op in ops:
        required = {"id", "action", "src", "dest", "before", "reason"}
        if not isinstance(op, dict) or op.get("action") not in ACTIONS:
            raise SafetyError("Unknown action; deletion is disabled")
        if op["action"] == "QUARANTINE":
            required |= {"keep", "keep_before"}
        if set(op) != required or op["id"] in ids:
            raise SafetyError("Invalid or repeated operation")
        ids.add(op["id"])
        internal_src = op["action"] == "RESTORE" and parts(op["src"])[0] == VAULT
        if not internal_src:
            root.protect_project(op["src"])
        now = root.snapshot(op["src"], internal=internal_src)
        if now != op["before"]:
            raise SafetyError(f"Source changed: {op['src']}")
        ident = (now["dev"], now["ino"])
        key = collision_key(op["src"])
        destkey = collision_key(op["dest"])
        if key in sources or ident in identities or destkey in dests:
            raise SafetyError("Repeated source, file identity, or destination")
        sources.add(key)
        identities.add(ident)
        dests.add(destkey)
        internal_dest = op["action"] in {"QUARANTINE", "METADATA"}
        if internal_dest and op["dest"] != f"{VAULT}/{plan['id']}/{op['id']}/{Path(op['src']).name}":
            raise SafetyError("Quarantine destination was changed")
        root.destination(op["dest"], internal=internal_dest)
        if not internal_dest:
            root.protect_project(op["dest"])
        if op["action"] == "METADATA" and not metadata_safe(root, op["src"]):
            raise SafetyError("Metadata signature changed")
        if op["action"] == "QUARANTINE":
            root.protect_project(op["keep"])
            kept = root.snapshot(op["keep"])
            if kept != op["keep_before"] or not same_content(now, kept) or ident == (kept["dev"], kept["ino"]):
                raise SafetyError("Retained duplicate changed or identifies the candidate")
            if os.name == "posix" and not exact_equal(root, op["src"], op["keep"]):
                raise SafetyError("Fresh binary comparison failed")
    if sources & dests:
        raise SafetyError("Chained moves, swaps, and self-moves require separate plans")
    if any(collision_key(op.get("keep", "")) in sources for op in ops):
        raise SafetyError("A retained copy is also targeted by this batch")
    all_paths = sources | dests
    if any("/".join(p.split("/")[:i]) in all_paths for p in all_paths for i in range(1, len(p.split("/")))):
        raise SafetyError("Overlapping source/destination paths")
    return root, ops


def confirm(plan, ops):
    """No --yes, environment approval, saved boolean, or piped stdin bypass."""
    if not sys.stdin.isatty() or not sys.stdout.isatty():
        raise SafetyError("Interactive human confirmation required. Run this command yourself in a terminal.")
    scope = digest({"plan_hash": plan["plan_hash"], "ids": [op["id"] for op in ops]})
    print("\nROOT:", json.dumps(plan["root"], ensure_ascii=True))
    print("Plan SHA-256:", plan["plan_hash"])
    print("Selection SHA-256:", scope)
    for op in ops:
        print(canonical({k: op[k] for k in ("id", "action", "src", "dest")}))
        if "keep" in op:
            print("  RETAIN:", json.dumps(op["keep"]))
    print("Only these files will move. Missing destination parents may be created.")
    print("Quarantine does NOT free disk space. No files or directories are permanently deleted.")
    for action in sorted({op["action"] for op in ops}):
        count = sum(op["action"] == action for op in ops)
        phrase = f"APPROVE {action} {count} {scope[:16]}"
        if input(f"Type {phrase} to authorize this action, or anything else to cancel:\n") != phrase:
            raise SafetyError("Cancelled; no source files were changed")


class Journal:
    def __init__(self, folder, plan, ops):
        self.path = folder / "journal.jsonl"
        fd = os.open(self.path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0), 0o600)
        self.file = os.fdopen(fd, "w", encoding="utf-8")
        self.previous = "0" * 64
        sync_dir(folder)
        self.append({"event": "session", "plan": plan, "ids": [op["id"] for op in ops]})

    def append(self, entry):
        record = dict(entry, timestamp=time.time(), previous_hash=self.previous)
        record["record_hash"] = digest(record)
        self.file.write(canonical(record) + "\n")
        self.file.flush()
        os.fsync(self.file.fileno())
        self.previous = record["record_hash"]

    def close(self):
        self.file.close()


@contextlib.contextmanager
def root_lock(root):
    import fcntl
    root.check_root()
    fd = os.open(root.path / LOCK, os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    try:
        st = os.fstat(fd)
        if not stat.S_ISREG(st.st_mode) or st.st_nlink != 1 or st.st_uid != os.getuid():
            raise SafetyError("Invalid operation lock")
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as exc:
            raise SafetyError("Another TidyGuardian session holds this root") from exc
        yield
    finally:
        os.close(fd)  # Persistent lock avoids unlink/recreate races.


def apply(plan, output, *, execute=False, selection=None):
    root, ops = preflight(plan, selection)
    run = new_report_dir(output, root)
    write_new(run / "plan.json", canonical(plan) + "\n")
    write_new(run / "selection.json", canonical({"plan_hash": plan["plan_hash"], "ids": [op["id"] for op in ops]}) + "\n")
    if not execute:
        write_new(run / "receipt.md", f"# Dry run\n\n{len(ops)} selected operations. Source files unchanged.\n")
        return run
    backend = rename_backend()  # Unsupported systems fail before prompting or mutating.
    confirm(plan, ops)
    journal = Journal(run, plan, ops)
    try:
        with root_lock(root):
            preflight(plan, selection)  # Approval never overrides stale files or plans.
            for op in ops:
                one = {"plan_hash": plan["plan_hash"], "ids": [op["id"]]}
                preflight(plan, one)
                internal_src = op["action"] == "RESTORE" and parts(op["src"])[0] == VAULT
                internal_dest = op["action"] in {"QUARANTINE", "METADATA"}
                journal.append({"event": "prepared", "operation": op})
                with root.parent_fd(op["src"], internal=internal_src) as (srcfd, srcname):
                    with root.parent_fd(op["dest"], create=True, internal=internal_dest) as (dstfd, dstname):
                        if stamp(os.stat(srcname, dir_fd=srcfd, follow_symlinks=False)) != {k: v for k, v in op["before"].items() if k != "sha256"}:
                            raise SafetyError("Source changed immediately before move")
                        if any(collision_key(n) == collision_key(dstname) for n in os.listdir(dstfd)):
                            raise SafetyError("Destination appeared after approval")
                        backend(srcfd, srcname, dstfd, dstname)
                        os.fsync(srcfd)
                        os.fsync(dstfd)
                after = root.snapshot(op["dest"], internal=internal_dest)
                if (identity_dict(after) != identity_dict(op["before"]) or not same_content(after, op["before"])):
                    raise SafetyError("Post-move identity/content mismatch. Stop and inspect the journal.")
                journal.append({"event": "done", "operation": op, "after": after})
            journal.append({"event": "complete", "count": len(ops)})
        write_new(run / "receipt.md", f"# Execution receipt\n\nCompleted {len(ops)} approved operations.\n\nNo permanent deletion. Use restore-plan with journal.jsonl to preview reversal.\n")
    except BaseException as exc:
        try:
            journal.append({"event": "stopped", "error": str(exc), "recovery": "Inspect prepared/done records; do not rerun blindly"})
        except OSError:
            pass
        print(f"Stopped. Durable recovery journal: {journal.path}", file=sys.stderr)
        raise
    finally:
        journal.close()
    return run


def restore_plan(journal_path):
    path = absolute(journal_path, directory=False)
    if path.stat().st_size > 64 * 1024 * 1024:
        raise SafetyError("Journal too large")
    events = []
    lines = path.read_text(encoding="utf-8").splitlines()
    previous = "0" * 64
    for index, line in enumerate(lines):
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            if index != len(lines) - 1:
                raise SafetyError("Corrupt journal record before end of file")
            break  # Torn final record: prepared records remain useful for recovery.
        unsigned = {k: v for k, v in entry.items() if k != "record_hash"}
        if entry.get("previous_hash") != previous or digest(unsigned) != entry.get("record_hash"):
            raise SafetyError("Journal integrity check failed")
        previous = entry["record_hash"]
        events.append(entry)
    if not events or events[0].get("event") != "session":
        raise SafetyError("Missing journal header")
    original = events[0]["plan"]
    root = Root(original["root"])
    if root.id != original["root_identity"]:
        raise SafetyError("Original root/drive no longer matches")
    prepared = {e["operation"]["id"]: e["operation"] for e in events if e.get("event") == "prepared"}
    done = {e["operation"]["id"]: e for e in events if e.get("event") == "done"}
    requests = []
    for op_id, op in reversed(list(prepared.items())):
        src = root.check(op["src"], internal=parts(op["src"])[0] == VAULT)
        dest = root.check(op["dest"], internal=parts(op["dest"])[0] == VAULT)
        if src.exists() and not dest.exists() and op_id not in done:
            continue  # Prepared but never moved.
        if src.exists() or not dest.exists():
            raise SafetyError("Restore conflict/uncertain operation; preserve both locations and inspect manually")
        now = root.snapshot(op["dest"], internal=parts(op["dest"])[0] == VAULT)
        expected = done[op_id]["after"] if op_id in done else op["before"]
        if (not same_content(now, expected) or identity_dict(now) != identity_dict(expected) or
                (op_id in done and now != expected)):
            raise SafetyError("Moved file changed; automatic restoration refused")
        # Restoring a prior restore into the vault is intentionally not supported.
        if parts(op["src"])[0] == VAULT:
            raise SafetyError("Undoing a restore requires a new explicit organization plan")
        requests.append({"action": "RESTORE", "src": op["dest"], "dest": op["src"], "reason": "Reverse a journaled operation"})
    return make_plan(root, requests)
