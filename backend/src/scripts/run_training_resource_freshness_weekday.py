"""Revalidate the oldest published training resources and stage review evidence."""

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
    TrainingResourceFreshnessError,
    run_training_resource_freshness,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--max-resources",
        type=int,
        default=20,
        help="Oldest/never-checked published resources to inspect (1-100).",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    load_env()
    args = build_parser().parse_args(argv)
    try:
        result = run_training_resource_freshness(
            max_resources=args.max_resources,
        )
    except (TrainingResourceFreshnessError, RuntimeError, ValueError) as exc:
        print(
            json.dumps(
                {
                    "status": "failed",
                    "error": f"TRAINING_RESOURCE_FRESHNESS_RUN_FAILED: {exc}",
                },
                indent=2,
            )
        )
        return 1

    print(json.dumps(result.model_dump(by_alias=True, mode="json"), indent=2))
    return 0 if result.status == "completed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
