#!/usr/bin/env python3
"""Run the Outlook email thread intelligence compiler.

Default behaviour: process up to ``--batch`` distinct email threads whose latest
message has not yet been compiled, restricted to messages no older than
``--days``.

Examples:
    cd backend && source venv/bin/activate
    python scripts/run_email_compiler.py --days 14 --batch 100
    python scripts/run_email_compiler.py --status
    python scripts/run_email_compiler.py --conversation-id <conv_id>
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, "src"))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(os.path.join(ROOT, "..", ".env"))
load_dotenv(os.path.join(ROOT, ".env"), override=False)
load_dotenv(os.path.join(ROOT, "..", "frontend", ".env.local"), override=False)

from services.intelligence.email_compiler import (  # noqa: E402
    compile_thread,
    run_email_compiler_batch,
)
from services.supabase_helpers import get_supabase_client  # noqa: E402


def cmd_status(client) -> None:
    result = client.rpc("get_email_compiler_status").execute()
    print(json.dumps(result.data or {}, indent=2, default=str))


def cmd_one(client, conversation_id: str) -> None:
    result = compile_thread(client, conversation_id)
    print(json.dumps(result, indent=2, default=str))


def cmd_batch(client, days: int, batch: int, max_ms: int) -> None:
    since_iso = None
    if days > 0:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        since_iso = cutoff.replace(microsecond=0).isoformat().replace("+00:00", "Z")
    result = run_email_compiler_batch(
        client,
        batch_size=batch,
        since_iso=since_iso,
        max_processing_time_ms=max_ms,
    )
    print(json.dumps(result, indent=2, default=str))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--days",
        type=int,
        default=14,
        help="Only consider threads with at least one message within the last N days. Use 0 for unlimited.",
    )
    parser.add_argument(
        "--batch",
        type=int,
        default=50,
        help="Maximum number of distinct threads to compile in this run (1-100).",
    )
    parser.add_argument(
        "--max-ms",
        type=int,
        default=900_000,
        help="Maximum wall-clock time in ms before the run stops claiming new threads.",
    )
    parser.add_argument(
        "--conversation-id",
        type=str,
        default=None,
        help="Compile a single thread by Outlook conversation_id and exit.",
    )
    parser.add_argument(
        "--status",
        action="store_true",
        help="Print compiler status from get_email_compiler_status() and exit.",
    )
    args = parser.parse_args()

    client = get_supabase_client()

    if args.status:
        cmd_status(client)
        return

    if args.conversation_id:
        cmd_one(client, args.conversation_id)
        return

    cmd_batch(client, args.days, args.batch, args.max_ms)


if __name__ == "__main__":
    main()
