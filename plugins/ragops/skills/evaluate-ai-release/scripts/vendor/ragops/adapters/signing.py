from __future__ import annotations

import os
import stat
import subprocess
import tempfile
from pathlib import Path

from ragops.loader import ContractError

SIGNING_NAMESPACE = "ragops-baseline"
MAX_SIGNED_BYTES = 1_000_000
MAX_SIGNATURE_BYTES = 100_000


def sign_baseline_manifest(
    manifest_path: str | Path,
    key_path: str | Path,
    signature_path: str | Path,
    *,
    executable: str = "ssh-keygen",
) -> None:
    manifest = _bounded_bytes(manifest_path, MAX_SIGNED_BYTES, "baseline manifest")
    try:
        completed = subprocess.run(
            [
                executable,
                "-Y",
                "sign",
                "-f",
                str(key_path),
                "-n",
                SIGNING_NAMESPACE,
            ],
            input=manifest,
            capture_output=True,
            check=False,
        )
    except OSError as exc:
        raise ContractError(f"Cannot execute SSH baseline signer: {exc}") from exc
    if completed.returncode != 0:
        error = completed.stderr.decode("utf-8", errors="replace").strip()
        raise ContractError(f"SSH baseline signing failed: {error}")
    signature = completed.stdout
    if (
        not signature.startswith(b"-----BEGIN SSH SIGNATURE-----")
        or len(signature) > MAX_SIGNATURE_BYTES
    ):
        raise ContractError("SSH baseline signer returned an invalid signature envelope")
    _atomic_private_write(signature_path, signature)


def verify_baseline_signature(
    manifest_path: str | Path,
    signature_path: str | Path,
    allowed_signers_path: str | Path,
    identity: str,
    *,
    executable: str = "ssh-keygen",
) -> None:
    if not isinstance(identity, str) or not identity:
        raise ContractError("Baseline signer identity must be a non-empty string")
    manifest = _bounded_bytes(manifest_path, MAX_SIGNED_BYTES, "baseline manifest")
    _bounded_bytes(signature_path, MAX_SIGNATURE_BYTES, "baseline signature")
    try:
        completed = subprocess.run(
            [
                executable,
                "-Y",
                "verify",
                "-f",
                str(allowed_signers_path),
                "-I",
                identity,
                "-n",
                SIGNING_NAMESPACE,
                "-s",
                str(signature_path),
            ],
            input=manifest,
            capture_output=True,
            check=False,
        )
    except OSError as exc:
        raise ContractError(f"Cannot execute SSH baseline verifier: {exc}") from exc
    if completed.returncode != 0:
        error = completed.stderr.decode("utf-8", errors="replace").strip()
        raise ContractError(f"SSH baseline signature verification failed: {error}")


def _bounded_bytes(path: str | Path, limit: int, label: str) -> bytes:
    try:
        source = Path(path)
        size = source.stat().st_size
        if size < 1 or size > limit:
            raise ContractError(f"{label} must be between 1 and {limit} bytes")
        return source.read_bytes()
    except OSError as exc:
        raise ContractError(f"Cannot read {label} from {path}: {exc}") from exc


def _atomic_private_write(path: str | Path, payload: bytes) -> None:
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.is_symlink():
        raise ContractError("Baseline signature output must not be a symlink")
    temporary_name: str | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="wb",
            dir=destination.parent,
            prefix=f".{destination.name}.",
            delete=False,
        ) as temporary:
            temporary_name = temporary.name
            os.chmod(temporary_name, stat.S_IRUSR | stat.S_IWUSR)
            temporary.write(payload)
            temporary.flush()
            os.fsync(temporary.fileno())
        os.replace(temporary_name, destination)
    finally:
        if temporary_name and Path(temporary_name).exists():
            Path(temporary_name).unlink()
