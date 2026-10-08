"""Shared fail-closed filesystem policy. No permanent deletion primitives."""
from __future__ import annotations

import contextlib
import ctypes
import fnmatch
import hashlib
import json
import os
from pathlib import Path, PurePosixPath, PureWindowsPath
import stat
import sys
import unicodedata


class SafetyError(Exception):
    """An operation cannot be proven safe enough to attempt."""


VAULT = ".tidyguardian-quarantine"
LOCK = ".tidyguardian.lock"
IGNORE = ".tidyguardianignore"
SYSTEM = {s.casefold() for s in (
    "$RECYCLE.BIN", ".Trashes", ".Trash", ".Spotlight-V100", ".fseventsd",
    ".TemporaryItems", ".DocumentRevisions-V100", "System Volume Information",
    ".git", ".hg", ".svn", ".ssh", ".gnupg", "node_modules", ".venv",
    VAULT, LOCK, IGNORE,
)}
PACKAGES = {".app", ".band", ".photoslibrary", ".imovielibrary", ".logicx", ".fcpxbundle"}
PROJECTS = {".prproj", ".aep", ".als", ".aup3", ".blend", ".drp", ".fcpxml", ".logic", ".lrcat"}
PRESERVE = ("capcut", "davinci", "final cut", "motion array", "motion templates", "premiere", "stock media", "video assets")
SIDECARS = {".xmp", ".aae", ".srt", ".vtt", ".thm", ".lrv"}
KINDS = {
    "video": ".3gp .avi .m4v .mkv .mov .mp4 .mpeg .mpg .mts .mxf .webm .wmv",
    "image": ".arw .bmp .gif .heic .jpeg .jpg .png .raw .tif .tiff .webp .cr2 .cr3 .nef .dng",
    "audio": ".aac .aif .aiff .flac .m4a .mp3 .ogg .wav",
    "document": ".csv .doc .docx .key .md .numbers .pages .pdf .ppt .pptx .rtf .txt .xls .xlsx",
    "archive": ".7z .dmg .gz .iso .pkg .rar .tar .zip",
}


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def collision_key(value):
    return unicodedata.normalize("NFC", value).casefold()


def identity(st):
    return {"dev": st.st_dev, "ino": st.st_ino}


def stamp(st):
    return dict(identity(st), size=st.st_size, mtime_ns=st.st_mtime_ns,
                ctime_ns=st.st_ctime_ns, mode=st.st_mode, nlink=st.st_nlink)


def stable_stamp(st):
    """Metadata comparable across lstat/fstat on supported operating systems."""
    value = stamp(st)
    # Windows can expose a creation/change timestamp with different precision
    # through lstat and fstat immediately after a fixture is created. The
    # descriptor snapshot below still records ctime and verifies it remains
    # stable while reading; this comparison avoids a false pre-read rejection.
    value.pop("ctime_ns")
    return value


def is_link(path):
    st = path.lstat()
    return stat.S_ISLNK(st.st_mode) or bool(getattr(st, "st_file_attributes", 0) & 0x400)


def absolute(path, *, directory=True):
    """Refuse symlinks/reparse points, including intermediate components."""
    p = Path(path).expanduser().absolute()
    if ".." in p.parts:
        raise SafetyError("Parent traversal is not allowed")
    for item in reversed((p, *p.parents)):
        if is_link(item):
            raise SafetyError(f"Symlink/reparse point refused: {item}")
    if directory and not p.is_dir():
        raise SafetyError(f"Not a directory: {p}")
    return p


def parts(rel):
    if not isinstance(rel, str) or not rel or "\\" in rel or ":" in rel:
        raise SafetyError("Expected a nonempty relative POSIX path")
    if PurePosixPath(rel).is_absolute() or PureWindowsPath(rel).drive:
        raise SafetyError("Absolute paths are not allowed in plans")
    bits = rel.split("/")
    if any(b in {"", ".", ".."} or b.endswith((" ", ".")) for b in bits):
        raise SafetyError("Ambiguous or traversing path refused")
    if any(ord(c) < 32 or ord(c) == 127 or 0xD800 <= ord(c) <= 0xDFFF for c in rel):
        raise SafetyError("Control characters or undecodable names require manual review")
    return bits


def protected_name(name):
    return name.casefold() in SYSTEM or Path(name).suffix.lower() in PACKAGES or any(k in name.casefold() for k in PRESERVE)


class Root:
    def __init__(self, path):
        self.path = absolute(path)
        if self.path == Path(self.path.anchor) or self.path == Path.home():
            raise SafetyError("Choose a specific working folder, not a filesystem root or home")
        if any(protected_name(p) for p in self.path.parts):
            raise SafetyError("Protected root refused")
        blocked = [Path(x) for x in ("/etc", "/usr", "/bin", "/sbin", "/System", "/Library",
                   "/Applications", "/private/etc", "/private/var/db", "/var/db", "/proc", "/sys", "/dev", "/boot")]
        blocked.append(Path.home() / "Library")
        if os.name == "nt":
            blocked = [Path(os.environ[x]) for x in ("SystemRoot", "ProgramFiles", "ProgramFiles(x86)") if x in os.environ]
        if any(self.path == p or self.path.is_relative_to(p) for p in blocked):
            raise SafetyError("Operating-system/application directories are protected")
        self.id = identity(self.path.stat())
        config = self.path / IGNORE
        self.rules = []
        if os.path.lexists(config):
            absolute(config, directory=False)
            if not config.is_file() or config.stat().st_size > 65536:
                raise SafetyError("Invalid ignore configuration")
            self.rules = [s.strip().rstrip("/") for s in config.read_text(encoding="utf-8").splitlines()
                          if s.strip() and not s.lstrip().startswith("#")]
        self.policy = digest(self.rules)

    def check_root(self):
        if absolute(self.path) != self.path or identity(self.path.stat()) != self.id:
            raise SafetyError("Root identity changed or drive was replaced")
        if Root(self.path).policy != self.policy:
            raise SafetyError("Ignore policy changed; create a new plan")

    def check(self, rel, *, internal=False):
        bits = parts(rel)
        start = 1 if internal and bits[0] == VAULT else 0
        for i, bit in enumerate(bits):
            prefix = "/".join(bits[:i + 1])
            if i >= start and protected_name(bit):
                raise SafetyError(f"Protected path: {rel}")
            if any(fnmatch.fnmatchcase(prefix, p) or fnmatch.fnmatchcase(bit, p) for p in self.rules):
                raise SafetyError(f"Ignored path: {rel}")
        p = self.path
        for bit in bits:
            p = p / bit
            if os.path.lexists(p):
                if is_link(p):
                    raise SafetyError(f"Symlink/reparse point refused: {rel}")
                if p.stat().st_dev != self.id["dev"]:
                    raise SafetyError("Cross-device paths are disabled")
        return p

    def protect_project(self, rel):
        """Conservative: do not split a folder containing a recognized project."""
        p = self.check(rel)
        if p.suffix.lower() in PROJECTS or p.suffix.lower() in SIDECARS:
            raise SafetyError("Project/sidecar files require manual organization")
        for parent in (p.parent, *p.parent.parents):
            if not parent.is_relative_to(self.path):
                break
            if not parent.exists():
                continue
            children = list(parent.iterdir())
            if any(c.suffix.lower() in PROJECTS for c in children):
                raise SafetyError("Folder contains a project; preserve its references")
            if parent == p.parent and any(c != p and c.stem.casefold() == p.stem.casefold()
                                         and c.suffix.lower() in SIDECARS for c in children):
                raise SafetyError("Associated sidecar found; keep this group in place")
            if parent == self.path:
                break

    @contextlib.contextmanager
    def parent_fd(self, rel, *, create=False, internal=False):
        self.check_root()
        self.check(rel, internal=internal)
        if os.name != "posix" or not hasattr(os, "O_NOFOLLOW"):
            raise SafetyError("Mutation requires the POSIX no-follow backend")
        flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
        fd = os.open(self.path, flags)
        try:
            if identity(os.fstat(fd)) != self.id:
                raise SafetyError("Root changed")
            for bit in parts(rel)[:-1]:
                if create:
                    try:
                        os.mkdir(bit, mode=0o700, dir_fd=fd)
                        os.fsync(fd)
                    except FileExistsError:
                        pass
                child = os.open(bit, flags, dir_fd=fd)
                os.close(fd)
                fd = child
                if os.fstat(fd).st_dev != self.id["dev"]:
                    raise SafetyError("Cross-device directory refused")
            yield fd, parts(rel)[-1]
        finally:
            os.close(fd)

    def snapshot(self, rel, *, internal=False):
        p = self.check(rel, internal=internal)
        st = p.lstat()
        if not stat.S_ISREG(st.st_mode) or st.st_nlink != 1:
            raise SafetyError("Only regular, single-link files are eligible")
        flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_NONBLOCK", 0)
        if os.name == "posix":
            with self.parent_fd(rel, internal=internal) as (parent, name):
                fd = os.open(name, flags, dir_fd=parent)
        else:
            fd = os.open(p, flags)
        try:
            before = os.fstat(fd)
            if stable_stamp(before) != stable_stamp(st):
                raise SafetyError("File changed before reading")
            h = hashlib.sha256()
            while True:
                block = os.read(fd, 1024 * 1024)
                if not block:
                    break
                h.update(block)
            if stamp(os.fstat(fd)) != stamp(before) or stable_stamp(p.lstat()) != stable_stamp(before):
                raise SafetyError("File changed while reading")
            return dict(stamp(before), sha256=h.hexdigest())
        finally:
            os.close(fd)

    def destination(self, rel, *, internal=False):
        p = self.check(rel, internal=internal)
        if os.path.lexists(p):
            raise SafetyError(f"Destination exists; no overwrite or automatic rename: {rel}")
        if p.parent.exists() and any(collision_key(x.name) == collision_key(p.name) for x in p.parent.iterdir()):
            raise SafetyError("Case/Unicode destination collision")
        return p


def rename_backend():
    """Atomic no-replace only; NEVER fall back to shutil.move or os.replace."""
    # Reject unsupported platforms before loading any native library.  Apart from
    # making the capability boundary explicit, this prevents a Windows/unknown
    # caller from probing or invoking a POSIX backend during the safety check.
    if not (sys.platform.startswith("linux") or sys.platform == "darwin"):
        raise SafetyError("Atomic no-replace moves are unsupported on this platform")
    libc = ctypes.CDLL(None, use_errno=True)
    if sys.platform.startswith("linux") and hasattr(libc, "renameat2"):
        fn, flag = libc.renameat2, 1  # RENAME_NOREPLACE
    elif sys.platform == "darwin" and hasattr(libc, "renameatx_np"):
        fn, flag = libc.renameatx_np, 4  # RENAME_EXCL
    else:
        raise SafetyError("Atomic no-replace moves are unsupported on this platform")
    fn.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p, ctypes.c_uint]
    fn.restype = ctypes.c_int

    def move(src_fd, src_name, dst_fd, dst_name):
        if fn(src_fd, os.fsencode(src_name), dst_fd, os.fsencode(dst_name), flag) != 0:
            err = ctypes.get_errno()
            raise OSError(err, os.strerror(err))
    return move


def same_content(a, b):
    return a["size"] == b["size"] and a["sha256"] == b["sha256"]


def new_report_dir(output, root=None):
    import uuid
    parent = absolute(output)
    if root and (parent == root.path or parent.is_relative_to(root.path)):
        raise SafetyError("Reports must be outside the source folder")
    dest = parent / ("tidyguardian-" + uuid.uuid4().hex)
    dest.mkdir(mode=0o700)
    sync_dir(parent)
    return dest


def write_new(path, text):
    """Exclusive creation: never truncate an existing report or follow a link."""
    absolute(path.parent)
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(path, flags, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8", newline="") as f:
        f.write(text)
        f.flush()
        os.fsync(f.fileno())
    sync_dir(path.parent)


def sync_dir(path):
    if os.name == "posix":
        fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)


def read_json(path):
    p = absolute(path, directory=False)
    if not p.is_file() or p.stat().st_size > 20 * 1024 * 1024:
        raise SafetyError("Invalid or oversized JSON document")
    def pairs(values):
        obj = {}
        for key, value in values:
            if key in obj:
                raise SafetyError("Duplicate JSON key")
            obj[key] = value
        return obj
    return json.loads(p.read_text(encoding="utf-8"), object_pairs_hook=pairs)
