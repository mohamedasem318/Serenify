#!/usr/bin/env python3
"""Decode an anchor bytea blob and print summary statistics.

A debugging helper (resolved-decision 1). Accepts a Postgres ``\\x``-hex bytea
literal, a plain hex string, or base64 — passed inline or via ``--file``.

    uv run python scripts/inspect_anchor.py '\\xabcd...'
    uv run python scripts/inspect_anchor.py --base64 'AAAA...'
    uv run python scripts/inspect_anchor.py --file dump.txt
"""

from __future__ import annotations

import argparse
import base64
import sys

import numpy as np

from ml_video.features import FEATURE_DIM

EXPECTED_BYTES = FEATURE_DIM * 4  # 2958 little-endian float32 = 11832 bytes


def decode_blob(raw: str, *, prefer_base64: bool = False) -> bytes:
    raw = raw.strip()
    if raw.startswith(("\\x", "\\X")):
        return bytes.fromhex(raw[2:])
    if prefer_base64:
        return base64.b64decode(raw)
    try:
        return bytes.fromhex(raw)
    except ValueError:
        return base64.b64decode(raw)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Inspect an anchor bytea blob.")
    parser.add_argument("blob", nargs="?", help="\\x-hex / hex / base64 blob")
    parser.add_argument("--file", help="read the blob from this file instead")
    parser.add_argument("--base64", action="store_true", help="treat input as base64")
    args = parser.parse_args(argv)

    if args.file:
        with open(args.file, encoding="utf-8") as fh:
            raw = fh.read()
    elif args.blob:
        raw = args.blob
    else:
        parser.error("provide a blob argument or --file")

    data = decode_blob(raw, prefer_base64=args.base64)
    if len(data) != EXPECTED_BYTES:
        print(
            f"WARNING: {len(data)} bytes, expected {EXPECTED_BYTES} "
            f"({FEATURE_DIM} little-endian float32)",
            file=sys.stderr,
        )

    vec = np.frombuffer(data, dtype="<f4")
    print(f"shape: {vec.shape}")
    print(f"dtype: {vec.dtype}")
    print(f"min:   {float(vec.min()):.6f}")
    print(f"max:   {float(vec.max()):.6f}")
    print(f"mean:  {float(vec.mean()):.6f}")
    print(f"lbp[0:90] sum:  {float(vec[:90].sum()):.6f}  (expect ~9.0 if L1-normalized)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
