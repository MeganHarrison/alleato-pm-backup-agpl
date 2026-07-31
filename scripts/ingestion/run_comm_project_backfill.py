#!/usr/bin/env python3
"""Run the bounded communications project attribution backfill."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from src.services.env_loader import load_env
from src.services.ingestion.communication_project_backfill import (
    run_incremental_project_backfill,
)
from src.services.supabase_helpers import get_supabase_client


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--min-confidence", type=float, default=None)
    args = parser.parse_args()

    load_env()
    client = get_supabase_client()
    result = run_incremental_project_backfill(
        client,
        limit=args.limit,
        min_confidence=args.min_confidence,
    )
    print(result)
    return 1 if result.get("failed") else 0


if __name__ == "__main__":
    raise SystemExit(main())
