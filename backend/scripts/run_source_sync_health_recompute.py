from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.services.env_loader import load_env
from src.services.health.source_sync_health_recompute import (
    run_source_sync_health_recompute,
)


def main() -> int:
    """Exit 0 whenever the recompute completes and produces a result.

    A degraded/unhealthy status is a monitoring result recorded on
    system_alerts, not a script failure — see the identical rationale in
    `src/services/health/source_rag_health.py::main`. An unhandled exception
    here (bad env, DB unreachable, etc.) still propagates and exits non-zero.
    """
    load_env()
    result = run_source_sync_health_recompute()
    print(json.dumps(result, indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
