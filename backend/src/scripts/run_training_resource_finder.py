"""Run the free-only training resource finder for one role/topic."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from src.services.env_loader import load_env
from src.services.training import (
    TrainingFinderRequest,
    TrainingResourceFinderError,
    run_training_resource_finder,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--role", required=True, help="Active training role slug.")
    parser.add_argument("--topic", required=True, help="Active training topic slug.")
    parser.add_argument("--max-results", type=int, default=8)
    parser.add_argument("--max-inserts", type=int, default=3)
    parser.add_argument(
        "--commit",
        action="store_true",
        help="Create review candidates. Without this flag the runner is read-only.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    load_env()
    args = build_parser().parse_args(argv)
    request = TrainingFinderRequest(
        roleSlug=args.role,
        topicSlug=args.topic,
        maxSearchResults=args.max_results,
        maxInserts=args.max_inserts,
        dryRun=not args.commit,
    )
    try:
        result = run_training_resource_finder(request)
    except TrainingResourceFinderError as exc:
        print(
            json.dumps(
                {
                    "status": "failed",
                    "error": str(exc),
                    "roleSlug": request.role_slug,
                    "topicSlug": request.topic_slug,
                },
                indent=2,
            )
        )
        return 1

    print(json.dumps(result.model_dump(by_alias=True), indent=2))
    return 0 if result.status == "completed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
