"""Recursive character chunker with overlap."""
from __future__ import annotations

import re

DEFAULT_SEPARATORS = ["\n\n", "\n", ". ", " ", ""]
MIN_CHUNK_CHARS = 1


def recursive_chunk(
    text: str,
    *,
    size: int,
    overlap: int,
    separators: list[str] | None = None,
) -> list[str]:
    """Split `text` into overlapping chunks of at most `size` characters."""
    if not text:
        return []
    seps = separators or DEFAULT_SEPARATORS
    raw = _split_recursive(text.strip(), seps, size)
    raw = [c.strip() for c in raw if c and c.strip()]
    raw = [c for c in raw if len(c) >= MIN_CHUNK_CHARS]
    return _apply_overlap(raw, overlap)


def _split_recursive(text: str, separators: list[str], size: int) -> list[str]:
    """Greedy split at the deepest separator that produces pieces under `size`."""
    if not separators or len(text) <= size:
        return [text]

    sep = separators[0]
    rest = separators[1:]

    if sep == "":
        return [text[i : i + size] for i in range(0, len(text), size)]

    pieces = text.split(sep)
    out: list[str] = []
    buf = ""

    for piece in pieces:
        candidate = (buf + sep + piece) if buf else piece
        if len(candidate) <= size:
            buf = candidate
        else:
            if buf:
                out.append(buf)
            if len(piece) <= size:
                buf = piece
            else:
                out.extend(_split_recursive(piece, rest, size))
                buf = ""
    if buf:
        out.append(buf)
    return out


_OVERLAP_BOUNDARY = re.compile(r"\s+")


def _apply_overlap(chunks: list[str], overlap: int) -> list[str]:
    """Prepend the last `overlap` chars of each chunk to the next, snapped to word boundary."""
    if overlap <= 0 or len(chunks) <= 1:
        return list(chunks)
    out: list[str] = [chunks[0]]
    for prev, nxt in zip(chunks, chunks[1:]):
        tail = prev[-overlap:]
        m = _OVERLAP_BOUNDARY.search(tail)
        if m:
            tail = tail[m.end():]
        if tail:
            out.append(f"{tail} {nxt}".strip())
        else:
            out.append(nxt)
    return out
