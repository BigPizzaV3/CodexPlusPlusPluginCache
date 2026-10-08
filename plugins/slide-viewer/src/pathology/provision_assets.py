"""Explicit public-asset provisioning; never imported or invoked by an inference job.

Only the pinned StarDist archive, 2-4 named PUMA public-release specimens and the
small public-domain BBBC007 images/outlines are supported. PUMA ZIPs use bounded
HTTP ranges; context slides are not read. Verified cache hits make no network call.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import re
import struct
import sys
import tempfile
import zipfile
import zlib
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import asdict, dataclass
from http.client import HTTPMessage, HTTPResponse
from pathlib import Path
from urllib.error import URLError
from urllib.parse import urlsplit

# The distributed manual provisioner cannot depend on monorepo-only HTTP clients.
from urllib.request import (  # noqa: TID251 -- standalone fixed-public-asset setup only
    HTTPRedirectHandler,
    Request,
    build_opener,
)

MODEL_URL = (
    "https://github.com/stardist/stardist-models/releases/download/v0.1/python_2D_versatile_he.zip"
)
MODEL_SHA256 = "f1696ef0631bd7e1c0e5c0d3017e2b4c6a95e284c6aab9c22fc2f08317817b28"
LICENSE_URL = "https://raw.githubusercontent.com/stardist/stardist-models/ff53277eb2adbd4b8b25cc37c4c4c68496ca216b/LICENSE.txt"
LICENSE_SHA256 = "d413591c8a0507f0f190c5e83addd7e147b25e064ce439d2d18bc80d865cb50f"
PUMA_RECORD = "https://zenodo.org/records/15050523"
PUMA_METADATA_URL = "https://zenodo.org/api/records/15050523"
PUMA_ARCHIVES = (
    ("01_training_dataset_tif_ROIs", ".tif"),
    ("01_training_dataset_geojson_nuclei", "_nuclei.geojson"),
    ("01_training_dataset_geojson_tissue", "_tissue.geojson"),
)
SAMPLE_NAMES = (
    "training_set_primary_roi_001",
    "training_set_primary_roi_002",
    "training_set_metastatic_roi_001",
    "training_set_metastatic_roi_002",
)
APPROVED_INITIAL_URLS = frozenset(
    {
        MODEL_URL,
        LICENSE_URL,
        PUMA_METADATA_URL,
        *(f"{PUMA_RECORD}/files/{folder}.zip?download=1" for folder, _ in PUMA_ARCHIVES),
        "https://data.broadinstitute.org/bbbc/BBBC007/BBBC007_v1_images.zip",
        "https://data.broadinstitute.org/bbbc/BBBC007/BBBC007_v1_outlines.zip",
    }
)


class ApprovedPublicRedirects(HTTPRedirectHandler):
    """Fixed publisher origins only, including GitHub's expected asset origin."""

    def __init__(self, initial_url: str) -> None:
        super().__init__()
        if initial_url not in APPROVED_INITIAL_URLS:
            raise ValueError("Only the fixed reviewed public asset URLs are permitted")
        self.allowed_hosts = {urlsplit(initial_url).hostname}
        if initial_url == MODEL_URL:
            self.allowed_hosts.add("release-assets.githubusercontent.com")
        self.redirect_count = 0

    def validate_redirect(self, new_url: str) -> None:
        self.redirect_count += 1
        if (
            self.redirect_count > 3
            or len(new_url) > 16_384
            or any(ord(char) <= 32 for char in new_url)
        ):
            raise ValueError("Public asset redirect exceeds its count/URL bound")
        try:
            target = urlsplit(new_url)
            allowed = (
                target.scheme == "https"
                and target.hostname in self.allowed_hosts
                and target.port in (None, 443)
                and target.username is None
                and target.password is None
                and not target.fragment
            )
        except ValueError:
            allowed = False
        if not allowed:
            # A GitHub asset URL may be signed: never include it in diagnostics.
            raise ValueError("Public asset redirect left its approved HTTPS publisher origins")

    def redirect_request(
        self,
        req: Request,
        fp: HTTPResponse,
        code: int,
        msg: str,
        headers: HTTPMessage,
        newurl: str,
    ) -> Request | None:
        self.validate_redirect(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


@contextmanager
def public_response(url: str, headers: dict[str, str]) -> Iterator[HTTPResponse]:
    # Only this explicit setup path performs network I/O. No cookies, credentials,
    # caller URLs, image paths, or inference-job arguments enter this opener.
    redirects = ApprovedPublicRedirects(url)
    opener = build_opener(redirects)
    try:
        with opener.open(Request(url, headers=headers), timeout=60) as response:
            if not isinstance(response, HTTPResponse):
                raise ValueError("Public asset response has an unexpected protocol")
            yield response
    except (URLError, OSError):
        raise ValueError(
            "The bounded public asset request failed; no redirect URL is logged"
        ) from None


@dataclass(frozen=True)
class Receipt:
    path: str
    bytes: int
    sha256: str
    source: str
    member: str | None = None
    archive_crc32: str | None = None


@dataclass(frozen=True)
class Member:
    name: str
    flags: int
    method: int
    crc32: int
    compressed_bytes: int
    decoded_bytes: int
    local_offset: int


def digest(data: bytes) -> str:
    return "sha256:" + hashlib.sha256(data).hexdigest()


def read_cached_asset(root: Path, relative: str, limit: int) -> bytes | None:
    target = root / relative
    if target.is_symlink() or root.resolve() not in target.resolve().parents:
        raise ValueError("Cached asset must remain inside its explicit cache root")
    if not target.exists():
        return None
    if not target.is_file() or target.stat().st_size > limit:
        raise ValueError("Cached asset exceeds its bounded file contract")
    with target.open("rb") as reader:
        data = reader.read(limit + 1)
    if len(data) > limit:
        raise ValueError("Cached asset changed size during its bounded read")
    return data


def download(url: str, limit: int) -> bytes:
    with public_response(
        url, {"User-Agent": "slide-viewer-explicit-public-asset-provisioning/1"}
    ) as response:
        if response.status != 200:
            raise ValueError("Public asset download did not return HTTP 200")
        length = response.headers.get("Content-Length")
        if length is not None and int(length) > limit:
            raise ValueError("Public asset exceeds the explicit download limit")
        data = response.read(limit + 1)
    if len(data) > limit:
        raise ValueError("Public asset exceeds the explicit download limit")
    return data


class RangeZip:
    """Read only bounded members from an immutable public ZIP record."""

    def __init__(self, url: str) -> None:
        self.url = url
        self.total: int | None = None
        self.etag: str | None = None
        self.transferred = 0
        tail = self.read_range("bytes=-65557", 65_557)
        end = tail.rfind(b"PK\x05\x06")
        if end < 0 or end + 22 > len(tail):
            raise ValueError("ZIP end-of-directory record is missing")
        _, disk, directory_disk, disk_entries, entries, size, offset, comment = struct.unpack_from(
            "<4s4H2IH", tail, end
        )
        if (
            disk
            or directory_disk
            or entries != disk_entries
            or entries > 4_096
            or size > 2 * 1024 * 1024
            or end + 22 + comment != len(tail)
        ):
            raise ValueError("Only bounded single-disk non-ZIP64 archives are supported")
        directory = self.read_range(f"bytes={offset}-{offset + size - 1}", size)
        members: dict[str, Member] = {}
        cursor = 0
        for _ in range(entries):
            if directory[cursor : cursor + 4] != b"PK\x01\x02" or cursor + 46 > len(directory):
                raise ValueError("ZIP central directory is malformed")
            flags, method = struct.unpack_from("<2H", directory, cursor + 8)
            crc, compressed, decoded = struct.unpack_from("<3I", directory, cursor + 16)
            name_length, extra_length, comment_length = struct.unpack_from(
                "<3H", directory, cursor + 28
            )
            member_disk = struct.unpack_from("<H", directory, cursor + 34)[0]
            local_offset = struct.unpack_from("<I", directory, cursor + 42)[0]
            stop = cursor + 46 + name_length + extra_length + comment_length
            if stop > len(directory) or member_disk or flags & 1:
                raise ValueError("Encrypted, multi-disk or truncated ZIP members are unsupported")
            name = directory[cursor + 46 : cursor + 46 + name_length].decode(
                "utf-8" if flags & 0x800 else "cp437"
            )
            if name in members:
                raise ValueError("ZIP member names must be unique")
            members[name] = Member(name, flags, method, crc, compressed, decoded, local_offset)
            cursor = stop
        if cursor != len(directory):
            raise ValueError("Unexpected trailing central-directory data")
        self.members = members

    def read_range(self, byte_range: str, limit: int) -> bytes:
        if limit < 1 or limit > 8 * 1024 * 1024 or self.transferred + limit > 32 * 1024 * 1024:
            raise ValueError("Public ZIP range read exceeds its transfer budget")
        headers = {
            "Range": byte_range,
            "Accept-Encoding": "identity",
            "User-Agent": "slide-viewer-explicit-public-asset-provisioning/1",
        }
        if self.etag is not None and not self.etag.startswith("W/"):
            headers["If-Match"] = self.etag
        with public_response(self.url, headers) as response:
            if response.status != 206:
                raise ValueError(
                    "The public ZIP server did not honor bounded HTTP ranges; full-archive fallback is disabled"
                )
            content_range = response.headers.get("Content-Range", "")
            extent = re.fullmatch(r"bytes (\d+)-(\d+)/(\d+)", content_range)
            if extent is None:
                raise ValueError("Range response lacks a valid byte extent")
            first, last, total = (int(value) for value in extent.groups())
            if byte_range.startswith("bytes=-"):
                expected_first, expected_last = max(0, total - int(byte_range[7:])), total - 1
            else:
                expected_first, expected_last = (int(value) for value in byte_range[6:].split("-"))
            if (
                first != expected_first
                or last != expected_last
                or first < 0
                or last >= total
                or last < first
            ):
                raise ValueError("Range response does not match the exact requested extent")
            etag = response.headers.get("ETag")
            if (self.total is not None and self.total != total) or (
                self.etag is not None and self.etag != etag
            ):
                raise ValueError("Public ZIP source changed between range reads")
            self.total, self.etag = total, etag
            data = response.read(limit + 1)
        if len(data) > limit or len(data) != last - first + 1:
            raise ValueError("Range response did not match its exact requested byte budget")
        self.transferred += len(data)
        return data

    def read_member(self, name: str) -> tuple[bytes, Member]:
        member = self.members[name]
        if (
            member.compressed_bytes > 8 * 1024 * 1024
            or member.decoded_bytes > 8 * 1024 * 1024
            or member.method not in (0, 8)
        ):
            raise ValueError("Public ZIP member exceeds supported size or compression limits")
        header = self.read_range(f"bytes={member.local_offset}-{member.local_offset + 29}", 30)
        if header[:4] != b"PK\x03\x04":
            raise ValueError("ZIP local header is malformed")
        name_length, extra_length = struct.unpack_from("<2H", header, 26)
        if name_length + extra_length > 65_535:
            raise ValueError("ZIP local metadata exceeds its limit")
        start = member.local_offset + 30
        metadata = self.read_range(
            f"bytes={start}-{start + name_length + extra_length - 1}", name_length + extra_length
        )
        local_name = metadata[:name_length].decode("utf-8" if member.flags & 0x800 else "cp437")
        if local_name != member.name:
            raise ValueError("ZIP local and central member names disagree")
        start += name_length + extra_length
        compressed = self.read_range(
            f"bytes={start}-{start + member.compressed_bytes - 1}", member.compressed_bytes
        )
        if member.method == 0:
            data = compressed
        else:
            decompressor = zlib.decompressobj(-zlib.MAX_WBITS)
            data = decompressor.decompress(compressed, member.decoded_bytes + 1)
            if not decompressor.eof or decompressor.unused_data:
                raise ValueError("ZIP deflate stream is incomplete or has trailing data")
        if len(data) != member.decoded_bytes or zlib.crc32(data) != member.crc32:
            raise ValueError("ZIP member length or CRC32 verification failed")
        return data, member


def write_asset(
    root: Path, relative: str, data: bytes, source: str, member: Member | None = None
) -> Receipt:
    target = root / relative
    if root.resolve() not in target.resolve().parents or target.is_symlink():
        raise ValueError("Asset path must remain inside the private public-asset cache")
    target.parent.mkdir(parents=True, exist_ok=True)
    if root.resolve() not in target.resolve().parents or target.is_symlink():
        raise ValueError("Asset path changed outside the private public-asset cache")
    try:
        # Exclusive creation also protects a file/symlink created after our path
        # checks: a racing writer is never overwritten, even if bytes differ.
        with target.open("xb") as writer:
            writer.write(data)
    except FileExistsError:
        existing = read_cached_asset(root, relative, len(data))
        if existing != data:
            raise ValueError(
                "Existing cache bytes differ; do not silently overwrite a qualified artifact"
            ) from None
    return Receipt(
        relative,
        len(data),
        digest(data),
        source,
        None if member is None else member.name,
        None if member is None else f"{member.crc32:08x}",
    )


def write_manifest(root: Path, relative: str, text: str) -> None:
    """Atomically replace an explicitly mutable receipt, never an asset or link target."""
    target = root / relative
    if target.parent != root or target.is_symlink() or root.is_symlink():
        raise ValueError("Receipt path must remain a direct regular file in the private cache")
    if target.exists() and not target.is_file():
        raise ValueError("An existing receipt is not a regular file")
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=root, prefix=".receipt-", suffix=".json", delete=False
        ) as writer:
            temporary = Path(writer.name)
            writer.write(text)
        # replace is atomic and does not follow a racing destination symlink.
        os.replace(temporary, target)
        temporary = None
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def provision_model(root: Path) -> list[Receipt]:
    archive_path = root / "python_2D_versatile_he.zip"
    archive = read_cached_asset(root, archive_path.name, 32 * 1024 * 1024)
    if archive is None:
        archive = download(MODEL_URL, 32 * 1024 * 1024)
    if hashlib.sha256(archive).hexdigest() != MODEL_SHA256:
        raise ValueError("StarDist archive does not match the upstream published SHA256")
    receipts = [write_asset(root, archive_path.name, archive, MODEL_URL)]
    with zipfile.ZipFile(io.BytesIO(archive)) as reader:
        for filename in ("config.json", "thresholds.json", "weights_best.h5"):
            candidates = [
                item for item in reader.infolist() if Path(item.filename).name == filename
            ]
            if len(candidates) != 1 or candidates[0].file_size > 32 * 1024 * 1024:
                raise ValueError("Pinned model archive has an unexpected model-file layout")
            data = reader.read(candidates[0])
            receipts.append(
                write_asset(root, f"models/stardist-2d-versatile-he/{filename}", data, MODEL_URL)
            )
    license_path = "models/stardist-2d-versatile-he/LICENSE.txt"
    license_bytes = read_cached_asset(root, license_path, 16_384)
    if license_bytes is None:
        license_bytes = download(LICENSE_URL, 16_384)
    if hashlib.sha256(license_bytes).hexdigest() != LICENSE_SHA256:
        raise ValueError("The model license differs from the reviewed publisher bytes")
    receipts.append(
        write_asset(
            root,
            license_path,
            license_bytes,
            LICENSE_URL,
        )
    )
    write_manifest(
        root,
        "stardist-manifest.json",
        json.dumps(
            {
                "schemaVersion": 1,
                "modelId": "stardist-2d-versatile-he",
                "release": "0.1",
                "license": "BSD-3-Clause",
                "archiveSha256": "sha256:" + MODEL_SHA256,
                "files": [asdict(receipt) for receipt in receipts],
            },
            indent=2,
        )
        + "\n",
    )
    return receipts


def cached_puma_receipts(root: Path) -> tuple[list[str], dict[str, Receipt], dict[str, int]]:
    manifest_bytes = read_cached_asset(root, "puma-manifest.json", 1024 * 1024)
    if manifest_bytes is None:
        return [], {}, {}
    manifest = json.loads(manifest_bytes)
    if (
        not isinstance(manifest, dict)
        or manifest["schemaVersion"] != 1
        or manifest["record"] != PUMA_RECORD
        or manifest["recordVersion"] != "v5"
        or manifest["datasetLicense"] != "CC0-1.0"
    ):
        raise ValueError("Cached PUMA manifest does not identify the reviewed release")
    samples = manifest["samples"]
    if (
        not isinstance(samples, list)
        or not 2 <= len(samples) <= 4
        or any(not isinstance(sample, str) or sample not in SAMPLE_NAMES for sample in samples)
        or len(set(samples)) != len(samples)
    ):
        raise ValueError("Cached PUMA manifest has an unexpected sample selection")
    expected: dict[str, tuple[str, str | None]] = {
        "puma-record-metadata.json": (PUMA_METADATA_URL, None)
    }
    for folder, suffix in PUMA_ARCHIVES:
        for sample in samples:
            expected[f"puma/{sample}{suffix}"] = (
                f"{PUMA_RECORD}/files/{folder}.zip?download=1",
                f"{folder}/{sample}{suffix}",
            )
    files = manifest["files"]
    if not isinstance(files, list) or len(files) != len(expected):
        raise ValueError("Cached PUMA manifest has unexpected file coverage")
    receipts: dict[str, Receipt] = {}
    for item in files:
        if not isinstance(item, dict) or set(item) != {
            "path",
            "bytes",
            "sha256",
            "source",
            "member",
            "archive_crc32",
        }:
            raise ValueError("Cached PUMA file receipt has an unexpected schema")
        path, size, sha = item["path"], item["bytes"], item["sha256"]
        if (
            not isinstance(path, str)
            or path not in expected
            or path in receipts
            or isinstance(size, bool)
            or not isinstance(size, int)
            or not 1 <= size <= 8 * 1024 * 1024
            or not isinstance(sha, str)
            or re.fullmatch(r"sha256:[0-9a-f]{64}", sha) is None
        ):
            raise ValueError("Cached PUMA file receipt exceeds its path/size/digest contract")
        source, member = expected[path]
        crc = item["archive_crc32"]
        if (
            item["source"] != source
            or item["member"] != member
            or (
                (member is None and crc is not None)
                or (
                    member is not None
                    and (not isinstance(crc, str) or re.fullmatch(r"[0-9a-f]{8}", crc) is None)
                )
            )
        ):
            raise ValueError("Cached PUMA file receipt changed its publisher/member provenance")
        data = read_cached_asset(root, path, size)
        if data is None or len(data) != size or digest(data) != sha:
            raise ValueError("Cached PUMA asset failed its qualified content digest")
        receipts[path] = Receipt(path, size, sha, source, member, crc)
    transfers = manifest["transferredBytes"]
    if (
        not isinstance(transfers, dict)
        or set(transfers) != {folder for folder, _ in PUMA_ARCHIVES}
        or any(
            isinstance(count, bool)
            or not isinstance(count, int)
            or not 0 <= count <= 128 * 1024 * 1024
            for count in transfers.values()
        )
    ):
        raise ValueError("Cached PUMA transfer receipt exceeds its bound")
    return samples, receipts, transfers


def provision_puma(root: Path, samples: list[str]) -> list[Receipt]:
    if (
        len(samples) < 2
        or len(samples) > 4
        or len(set(samples)) != len(samples)
        or any(sample not in SAMPLE_NAMES for sample in samples)
    ):
        raise ValueError("Choose two to four distinct approved public PUMA specimens")
    cached_samples, cached, transfers = cached_puma_receipts(root)
    if set(samples).issubset(cached_samples):
        return list(cached.values())
    samples = [sample for sample in SAMPLE_NAMES if sample in {*samples, *cached_samples}]
    receipts: list[Receipt] = []
    # Publisher download/view counters can change; preserve the qualified record
    # bytes instead of re-fetching mutable metadata on an otherwise valid cache.
    metadata_bytes = read_cached_asset(root, "puma-record-metadata.json", 1024 * 1024)
    if metadata_bytes is None:
        metadata_bytes = download(PUMA_METADATA_URL, 1024 * 1024)
    metadata = json.loads(metadata_bytes)
    if metadata["id"] != 15050523 or metadata["metadata"]["license"]["id"] != "cc-zero":
        raise ValueError(
            "PUMA record or published dataset license differs from the reviewed release"
        )
    receipts.append(
        write_asset(
            root,
            "puma-record-metadata.json",
            metadata_bytes,
            PUMA_METADATA_URL,
        )
    )
    for folder, suffix in PUMA_ARCHIVES:
        archive: RangeZip | None = None
        for sample in samples:
            path = f"puma/{sample}{suffix}"
            if path in cached:
                receipts.append(cached[path])
                continue
            if archive is None:
                archive = RangeZip(f"{PUMA_RECORD}/files/{folder}.zip?download=1")
            member_name = f"{folder}/{sample}{suffix}"
            data, member = archive.read_member(member_name)
            receipts.append(write_asset(root, path, data, archive.url, member))
        transfers[folder] = transfers.get(folder, 0) + (
            0 if archive is None else archive.transferred
        )
    write_manifest(
        root,
        "puma-manifest.json",
        json.dumps(
            {
                "schemaVersion": 1,
                "record": PUMA_RECORD,
                "recordVersion": "v5",
                "datasetLicense": "CC0-1.0",
                "source": "public-training-release-not-hidden-challenge-test",
                "reportedNominalMicronsPerSourcePixel": 0.23,
                "calibrationNote": "Reported nominal scale, not authority for calibrated measurements; actual source resolution metadata may differ",
                "samples": samples,
                "transferredBytes": transfers,
                "archiveChecksumVerification": "range-member CRC32 and recorded member SHA256; full archive MD5 not recomputed",
                "files": [asdict(receipt) for receipt in receipts],
            },
            indent=2,
        )
        + "\n",
    )
    return receipts


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--cache-root", type=Path, default=Path(__file__).resolve().parents[2] / ".pathology-assets"
    )
    parser.add_argument("--download-model", action="store_true")
    parser.add_argument("--download-bbbc007", action="store_true")
    parser.add_argument("--puma-sample", choices=SAMPLE_NAMES, action="append", default=[])
    args = parser.parse_args()
    if not args.download_model and not args.puma_sample and not args.download_bbbc007:
        parser.error("Choose an explicit model and/or public-fixture provisioning action")
    args.cache_root.mkdir(parents=True, exist_ok=True)
    receipts = provision_model(args.cache_root) if args.download_model else []
    if args.puma_sample:
        receipts.extend(provision_puma(args.cache_root, args.puma_sample))
    if args.download_bbbc007:
        receipts.extend(provision_bbbc007(args.cache_root))
    sys.stdout.write(
        json.dumps(
            {
                "cacheRoot": str(args.cache_root.resolve()),
                "files": [asdict(receipt) for receipt in receipts],
            },
            indent=2,
        )
        + "\n"
    )


def provision_bbbc007(root: Path) -> list[Receipt]:
    """Explicit small public-domain images plus genuine nucleus/cell outlines."""
    receipts: list[Receipt] = []
    total_download = 0
    total_decoded = 0
    for archive_name in ("BBBC007_v1_images.zip", "BBBC007_v1_outlines.zip"):
        url = f"https://data.broadinstitute.org/bbbc/BBBC007/{archive_name}"
        cached = root / "bbbc007" / archive_name
        if cached.is_file() and cached.stat().st_size <= 8 * 1024 * 1024:
            data = cached.read_bytes()
        else:
            data = download(url, min(8 * 1024 * 1024, 10 * 1024 * 1024 - total_download))
            total_download += len(data)
        receipts.append(write_asset(root, f"bbbc007/{archive_name}", data, url))
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            if len(archive.infolist()) > 256:
                raise ValueError("BBBC007 archive has an unexpected number of members")
            for entry in archive.infolist():
                if entry.is_dir() or Path(entry.filename).suffix.lower() not in (".tif", ".tiff"):
                    continue
                total_decoded += entry.file_size
                if entry.file_size > 8 * 1024 * 1024 or total_decoded > 32 * 1024 * 1024:
                    raise ValueError("BBBC007 decoded image budget exceeded")
                category = "images" if "images" in archive_name else "outlines"
                receipts.append(
                    write_asset(
                        root,
                        f"bbbc007/{category}/{Path(entry.filename).name}",
                        archive.read(entry),
                        url,
                    )
                )
    write_manifest(
        root,
        "bbbc007-manifest.json",
        json.dumps(
            {
                "schemaVersion": 1,
                "dataset": "BBBC007v1",
                "record": "https://bbbc.broadinstitute.org/BBBC007",
                "rights": "Publisher states all copyright and related rights waived by Anne Carpenter",
                "reference": "Hand-outlined DNA nuclei and actin whole-cell boundaries; not a model-generated pseudo-label",
                "downloadedBytes": total_download,
                "decodedBytes": total_decoded,
                "checksumMeaning": "SHA256 of actual publisher-origin downloads and ZIP-CRC-verified extracted members, not a separately published upstream SHA256",
                "files": [asdict(receipt) for receipt in receipts],
            },
            indent=2,
        )
        + "\n",
    )
    return receipts


if __name__ == "__main__":
    main()
