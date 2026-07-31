#!/usr/bin/env python3
"""
Project Acumatica change orders into domain change order tables.

  - revenue_budget_change_total != 0 → prime_contract_change_orders (Prime tab)
  - commitments_change_total != 0    → contract_change_orders (Commitments tab)

Safe to run multiple times.

Usage:
    cd /Users/meganharrison/Documents/alleato-pm
    python scripts/project-acumatica-change-orders.py
"""

import subprocess
import sys
from pathlib import Path

backend_dir = Path(__file__).parent.parent / "backend"
venv_python = backend_dir / ".venv" / "bin" / "python"
if venv_python.exists() and sys.executable != str(venv_python):
    result = subprocess.run([str(venv_python), __file__] + sys.argv[1:])
    sys.exit(result.returncode)

sys.path.insert(0, str(backend_dir / "src"))

from services.acumatica_sync import AcumaticaFinancialSyncService


def main() -> None:
    print("=== Acumatica → Change Orders Projection ===\n")

    service = AcumaticaFinancialSyncService()
    result = service.project_change_orders()

    prime = result["prime_change_orders_projected"]
    commit = result["commitment_change_orders_projected"]

    print("--- Prime Contract Change Orders ---")
    print(f"  Fetched from acumatica_change_orders: {prime['fetched']}")
    print(f"  Upserted to prime_contract_change_orders: {prime['upserted']}")
    if prime["errors"]:
        print(f"  Errors: {prime['errors']}")

    print("\n--- Commitment Change Orders ---")
    print(f"  Fetched from acumatica_change_orders: {commit['fetched']}")
    print(f"  Upserted to contract_change_orders: {commit['upserted']}")
    print(f"  Skipped (no prime contract found): {commit['skipped']}")
    if commit["errors"]:
        print(f"  Errors: {commit['errors']}")

    print("\nDone.")


if __name__ == "__main__":
    main()
