"""Run the Microsoft Executive Assistant scheduled check."""

from __future__ import annotations

import json
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from src.services.env_loader import load_env
from src.services.ops.db_pressure_guard import enforce_app_db_pressure_guard
from src.services.agents.microsoft_executive_assistant.triggers import (
    run_scheduled_microsoft_executive_assistant_check,
)


def main() -> int:
    load_env()
    enforce_app_db_pressure_guard("microsoft_executive_assistant_check")
    result = run_scheduled_microsoft_executive_assistant_check()
    print(json.dumps(result, indent=2, default=str))
    return 1 if result.get("status") in {"failed", "blocked"} else 0


if __name__ == "__main__":
    raise SystemExit(main())
