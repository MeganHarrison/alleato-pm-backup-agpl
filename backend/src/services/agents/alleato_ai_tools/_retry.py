"""Retry wrapper for transient Postgres/Supabase connection failures.

Supabase's session pooler (`*.pooler.supabase.com`) intermittently returns
auth-timeout and checkout-timeout errors under bursty load (e.g., when
parallel sub-agents each open a connection within milliseconds of each
other). Most failures clear on retry within a few seconds.

The PostgREST RPC path (`client.rpc(...).execute()`) has the same problem on a
different layer: when several vector searches fire concurrently (the Microsoft
Executive Assistant runs email + Teams + files searches at once), the
`search_document_chunks` halfvec query can exceed the per-statement timeout and
PostgREST returns HTTP 500 / "canceling statement due to statement timeout". The
2026-06-24 resignation-search incident was exactly this: an intermittent RPC 500
that was swallowed into a confident "no matching passages." These are
load-induced (identical concurrent calls returned 200), so they clear on retry.

This module exposes `with_db_retry`, a tiny decorator that retries on the
specific error classes we've seen in production. It's intentionally narrow:
retry ONLY on known-transient markers; never on SQL errors, permission errors,
or anything that would just mask a real bug.
"""

from __future__ import annotations

import logging
import time
from collections.abc import Callable
from functools import wraps
from typing import TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")

_TRANSIENT_MARKERS = (
    # Connection / pooler failures (SQLAlchemy path).
    "ECHECKOUTTIMEOUT",
    "authentication did not complete",
    "could not translate host name",
    "connection terminated",
    "SSL connection has been closed",
    "server closed the connection unexpectedly",
    # PostgREST RPC path: load-induced statement timeout / gateway blips. A vector
    # search that times out under concurrency must retry, not be reported as a
    # clean "no results". (2026-06-24 degraded-search incident.)
    "canceling statement due to statement timeout",
    "statement timeout",
    "57014",  # SQLSTATE query_canceled
    "Internal Server Error",
    "502 Bad Gateway",
    "503 Service",
    "504 Gateway",
)


def _is_transient(exc: BaseException) -> bool:
    msg = str(exc)
    return any(marker in msg for marker in _TRANSIENT_MARKERS)


# Markers that mean "we could not reach / talk to the database at all" — a
# connectivity/network failure, NOT a SQL or logic error. This is the class of
# failure that must surface loudly (the 2026-07-09 IPv6 DATABASE_URL drift, where
# psycopg2 raised "Network is unreachable" and the agent silently answered
# "no portfolio data"). Kept deliberately distinct from `_TRANSIENT_MARKERS`:
# a statement-timeout is transient-but-connected and must NOT be treated as an
# outage, so those markers (statement timeout / 57014 / 5xx) are excluded here.
_CONNECTION_MARKERS = (
    "Network is unreachable",
    "No route to host",
    "could not connect",
    "Connection refused",
    "connection refused",
    "could not translate host name",
    "Name or service not known",
    "Temporary failure in name resolution",
    "nodename nor servname provided",
    "server closed the connection unexpectedly",
    "SSL connection has been closed",
    "connection terminated",
    "Connection terminated",
    "connection timed out",
    "timeout expired",
    "Is the server running",
    "ECHECKOUTTIMEOUT",
    "authentication did not complete",
    "password authentication failed",
    "too many connections",
    "remaining connection slots",
)


def _exception_messages(exc: BaseException) -> str:
    """Flatten an exception plus its cause/context/`.orig` chain into one string.

    SQLAlchemy wraps the real DBAPI error (psycopg2) under `.orig` and the
    __cause__/__context__ chain, so the connectivity marker often is not in
    `str(exc)` itself. Walk the whole chain so detection is robust.
    """
    parts: list[str] = []
    seen: set[int] = set()
    cur: BaseException | None = exc
    while cur is not None and id(cur) not in seen:
        seen.add(id(cur))
        parts.append(str(cur))
        orig = getattr(cur, "orig", None)
        if isinstance(orig, BaseException) and id(orig) not in seen:
            seen.add(id(orig))
            parts.append(str(orig))
        cur = cur.__cause__ or cur.__context__
    return " || ".join(parts)


def is_connection_error(exc: BaseException) -> bool:
    """True when a failure means the app database was unreachable.

    Distinguishes a genuine connectivity/network outage (bad DATABASE_URL host,
    DNS failure, refused/timed-out connection, pooler auth) from a SQL error or
    a query-level statement timeout. Tools and the agent runtime use this to
    decide whether to surface a loud "database unreachable" signal instead of a
    misleading empty/partial answer.
    """
    return any(marker in _exception_messages(exc) for marker in _CONNECTION_MARKERS)


def with_db_retry(
    fn: Callable[..., T],
    *,
    max_attempts: int = 3,
    base_delay: float = 1.0,
) -> Callable[..., T]:
    """Retry `fn` on transient Supabase failures with exponential backoff.

    Catches any exception whose message matches a known transient marker
    (connection-pooler blips AND PostgREST RPC statement-timeout / 5xx). Anything
    else propagates immediately so real bugs are never masked.
    """

    @wraps(fn)
    def wrapper(*args: object, **kwargs: object) -> T:
        last_exc: BaseException | None = None
        for attempt in range(1, max_attempts + 1):
            try:
                return fn(*args, **kwargs)
            except Exception as exc:  # noqa: BLE001 — re-raised unless known-transient
                if not _is_transient(exc) or attempt == max_attempts:
                    raise
                last_exc = exc
                delay = base_delay * (2 ** (attempt - 1))
                logger.warning(
                    "transient DB error on %s (attempt %d/%d), retrying in %.1fs: %s",
                    fn.__name__,
                    attempt,
                    max_attempts,
                    delay,
                    str(exc).splitlines()[0][:200],
                )
                time.sleep(delay)
        # unreachable but keeps mypy happy
        raise last_exc  # type: ignore[misc]

    return wrapper
