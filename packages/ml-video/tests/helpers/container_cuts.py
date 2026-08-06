"""Structural cut-point finders for the two capture containers (2026-08-06 spike, Q3).

These mirror the client-side cutter in ``apps/web/components/monitor/tail-cutter.ts`` and
exist so the server-side fidelity gate can build header+tail files the way the client
does. Cut points are STRUCTURAL boundaries, never recorder-chunk boundaries:

  * **webm**: cluster starts. Clusters are unknown-size in a streaming MediaRecorder webm,
    so they are found by scanning for the 4-byte cluster ID — but a bare ID scan can hit
    payload bytes, so a candidate is only accepted when the full structure parses:
    ``ID + size-vint + Timestamp element (0xE7) + monotonically non-decreasing timestamp``.
    A wrong webm cut is SILENT downstream (the demuxer resyncs, losing up to ~3.4 s of
    head), which is why validation happens here, at cut time.
  * **fMP4**: ``moof`` starts, via the explicit box-length walk (sizes are declared, so the
    walk is exact); the fragment timestamp comes from ``tfdt`` (baseMediaDecodeTime) scaled
    by the track's ``mdhd`` timescale. A wrong fMP4 cut is LOUD (zero packets demux).

Timestamps are returned in ms on the ORIGINAL recording clock — both containers stamp
absolute original-timeline positions (the fact that made the tail-window approach GO).
"""

from __future__ import annotations

_CLUSTER_ID = b"\x1f\x43\xb6\x75"
_TIMESTAMP_ID = 0xE7


def _read_vint(data: bytes, pos: int) -> tuple[int | None, int]:
    """EBML size vint at ``pos`` → ``(value | None-if-unknown-size, byte_length)``.

    Raises ``ValueError`` on a malformed/truncated vint (the caller treats the candidate
    as a false positive)."""
    if pos >= len(data):
        raise ValueError("truncated vint")
    first = data[pos]
    if first == 0:
        raise ValueError("invalid vint (>8 bytes)")
    length = 9 - first.bit_length()
    if pos + length > len(data):
        raise ValueError("truncated vint")
    value = first & (0xFF >> length)
    for i in range(1, length):
        value = (value << 8) | data[pos + i]
    max_val = (1 << (7 * length)) - 1
    return (None if value == max_val else value), length


def _cluster_timestamp_ms(data: bytes, offset: int, prev_ts: float) -> float | None:
    """Validate a cluster-ID candidate at ``offset``; return its timestamp (ms) or None.

    Accepts only ``ID + size-vint + 0xE7 + ts-vint + big-endian ts`` with a timestamp that
    does not run backwards — the structural checks that make a payload-byte false positive
    astronomically unlikely. Timestamp is in TimestampScale ticks; MediaRecorder uses the
    Matroska default scale (1 ms ticks)."""
    try:
        pos = offset + len(_CLUSTER_ID)
        _size, size_len = _read_vint(data, pos)
        pos += size_len
        if pos >= len(data) or data[pos] != _TIMESTAMP_ID:
            return None
        ts_size, ts_size_len = _read_vint(data, pos + 1)
        if ts_size is None or not 1 <= ts_size <= 8:
            return None
        pos += 1 + ts_size_len
        if pos + ts_size > len(data):
            return None
        ts = float(int.from_bytes(data[pos : pos + ts_size], "big"))
    except ValueError:
        return None
    if ts < prev_ts:
        return None
    return ts


def webm_cluster_cuts(data: bytes) -> tuple[int, list[tuple[int, float]]]:
    """``(header_end, [(cluster_offset, cluster_ts_ms), ...])`` for a MediaRecorder webm.

    ``header_end`` is the offset of the first cluster — bytes ``[0, header_end)`` are the
    EBML header + Segment/Info/Tracks prefix every header+tail file must carry."""
    cuts: list[tuple[int, float]] = []
    prev = -1.0
    i = data.find(_CLUSTER_ID)
    header_end = i
    while i != -1:
        ts = _cluster_timestamp_ms(data, i, prev)
        if ts is not None:
            cuts.append((i, ts))
            prev = ts
        i = data.find(_CLUSTER_ID, i + 1)
    if header_end == -1:
        raise ValueError("no webm cluster found")
    return header_end, cuts


def _walk_boxes(data: bytes, start: int, end: int):
    """Yield ``(offset, type, header_len, size)`` for each top-level box in [start, end)."""
    pos = start
    while pos + 8 <= end:
        size = int.from_bytes(data[pos : pos + 4], "big")
        btype = data[pos + 4 : pos + 8]
        hdr = 8
        if size == 1:
            if pos + 16 > end:
                raise ValueError("truncated largesize box")
            size = int.from_bytes(data[pos + 8 : pos + 16], "big")
            hdr = 16
        elif size == 0:
            size = end - pos
        if size < hdr:
            raise ValueError("invalid box size")
        yield pos, btype, hdr, size
        pos += size


def _mdhd_timescale(data: bytes, moov_off: int, moov_hdr: int, moov_size: int) -> int:
    """The first video track's ``mdhd`` timescale (moov → trak → mdia → mdhd)."""
    for t_off, t_type, t_hdr, t_size in _walk_boxes(
        data, moov_off + moov_hdr, moov_off + moov_size
    ):
        if t_type != b"trak":
            continue
        for m_off, m_type, m_hdr, m_size in _walk_boxes(data, t_off + t_hdr, t_off + t_size):
            if m_type != b"mdia":
                continue
            for h_off, h_type, h_hdr, _h_size in _walk_boxes(
                data, m_off + m_hdr, m_off + m_size
            ):
                if h_type != b"mdhd":
                    continue
                version = data[h_off + h_hdr]
                ts_off = h_off + h_hdr + 4 + (16 if version == 1 else 8)
                return int.from_bytes(data[ts_off : ts_off + 4], "big")
    raise ValueError("no mdhd timescale found")


def _tfdt_ticks(data: bytes, moof_off: int, moof_hdr: int, moof_size: int) -> int:
    """``tfdt`` baseMediaDecodeTime of a ``moof`` (moof → traf → tfdt), in mdhd ticks."""
    for t_off, t_type, t_hdr, t_size in _walk_boxes(
        data, moof_off + moof_hdr, moof_off + moof_size
    ):
        if t_type != b"traf":
            continue
        for f_off, f_type, f_hdr, _f_size in _walk_boxes(data, t_off + t_hdr, t_off + t_size):
            if f_type != b"tfdt":
                continue
            version = data[f_off + f_hdr]
            base = f_off + f_hdr + 4
            n = 8 if version == 1 else 4
            return int.from_bytes(data[base : base + n], "big")
    raise ValueError("no tfdt found in moof")


def fmp4_moof_cuts(data: bytes) -> tuple[int, list[tuple[int, float]]]:
    """``(header_end, [(moof_offset, tfdt_ms), ...])`` for a growing fragmented MP4.

    ``header_end`` is the offset of the first ``moof`` — bytes ``[0, header_end)`` are the
    init segment (``ftyp`` + ``moov``) every header+tail file must carry. A trailing
    truncated fragment simply yields no further complete boxes (the walk stops)."""
    timescale: int | None = None
    header_end: int | None = None
    cuts: list[tuple[int, float]] = []
    try:
        for off, btype, hdr, size in _walk_boxes(data, 0, len(data)):
            if btype == b"moov":
                timescale = _mdhd_timescale(data, off, hdr, size)
            elif btype == b"moof":
                if header_end is None:
                    header_end = off
                if timescale is None:
                    raise ValueError("moof before moov timescale")
                if off + size <= len(data):  # only COMPLETE fragments are cut points
                    ticks = _tfdt_ticks(data, off, hdr, size)
                    cuts.append((off, ticks * 1000.0 / timescale))
    except ValueError:
        # A truncated trailing box ends the walk; whatever parsed before it stands.
        pass
    if header_end is None:
        raise ValueError("no moof found")
    return header_end, cuts


def build_header_plus_tail(data: bytes, header_end: int, cut_offset: int) -> bytes:
    """The header+tail file: init/header bytes + the contiguous suffix from ``cut_offset``."""
    return data[:header_end] + data[cut_offset:]


def latest_cut_at_or_before(
    cuts: list[tuple[int, float]], target_ms: float
) -> tuple[int, float]:
    """The latest cut whose timestamp is ``<= target_ms`` (the client's cut rule)."""
    eligible = [c for c in cuts if c[1] <= target_ms]
    if not eligible:
        raise ValueError(f"no cut at or before {target_ms} ms")
    return eligible[-1]
