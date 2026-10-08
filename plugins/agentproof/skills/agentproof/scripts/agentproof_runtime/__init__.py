"""Standalone AgentProof runtime for the Codex plugin."""

from .receipt import (
    AgentProofContractError,
    ReceiptLoadError,
    build_session_receipt,
    canonical_json_bytes,
    load_canonical_receipt,
    verify_session_receipt,
)

__all__ = [
    "AgentProofContractError",
    "ReceiptLoadError",
    "build_session_receipt",
    "canonical_json_bytes",
    "load_canonical_receipt",
    "verify_session_receipt",
]

__version__ = "0.1.0"
