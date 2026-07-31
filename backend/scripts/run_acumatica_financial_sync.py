from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Mapping, Sequence

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

MANUAL_FLAG = "--manual"
CONFIRMATION_ENV = "ACUMATICA_MANUAL_SYNC_CONFIRMED"


def require_manual_sync_confirmation(
    argv: Sequence[str],
    env: Mapping[str, str],
) -> None:
    confirmed = env.get(CONFIRMATION_ENV, "").strip().lower() == "true"
    if MANUAL_FLAG not in argv or not confirmed:
        raise SystemExit(
            "Acumatica automatic sync is disabled. A deliberate manual import "
            f"requires {MANUAL_FLAG} and {CONFIRMATION_ENV}=true."
        )


def main(argv: Sequence[str] | None = None) -> None:
    args = list(sys.argv[1:] if argv is None else argv)
    require_manual_sync_confirmation(args, os.environ)

    # Delay imports until after the manual-only guard so an accidental cron
    # invocation cannot initialize provider or database clients.
    from src.services.acumatica_sync import run_acumatica_financial_sync
    from src.services.ops.db_pressure_guard import enforce_app_db_pressure_guard

    enforce_app_db_pressure_guard("acumatica_financial_sync")
    result = run_acumatica_financial_sync()
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
