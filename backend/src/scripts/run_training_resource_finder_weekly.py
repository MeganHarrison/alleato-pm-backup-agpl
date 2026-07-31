"""Run the deterministic weekly training resource finder target."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from src.services.env_loader import load_env
from src.services.training import (
    TrainingResourceFinderError,
    run_weekly_training_resource_finder,
)


def _iso_date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(
            "--for-date must use YYYY-MM-DD"
        ) from exc


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--for-date",
        type=_iso_date,
        help="UTC selection date for deterministic replay; defaults to today.",
    )
    parser.add_argument("--max-results", type=int, default=8)
    parser.add_argument(
        "--commit",
        action="store_true",
        help="Create at most one review candidate. Default execution is read-only.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    load_env()
    args = build_parser().parse_args(argv)
    try:
        result = run_weekly_training_resource_finder(
            run_date=args.for_date,
            dry_run=not args.commit,
            max_search_results=args.max_results,
        )
    except (TrainingResourceFinderError, ValueError) as exc:
        print(
            json.dumps(
                {
                    "status": "failed",
                    "error": f"TRAINING_WEEKLY_RUN_FAILED: {exc}",
                    "runDate": (
                        args.for_date.isoformat() if args.for_date else None
                    ),
                },
                indent=2,
            )
        )
        return 1

    print(json.dumps(result.model_dump(by_alias=True, mode="json"), indent=2))
    return 0 if result.status == "completed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
