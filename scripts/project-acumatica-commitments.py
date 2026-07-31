#!/usr/bin/env python3
"""
One-time (or re-runnable) script to project Acumatica subcontracts and
purchase orders from the raw acumatica_* tables into the domain
subcontracts / purchase_orders tables, including SOV line items.

Safe to run multiple times — uses upsert on acumatica_external_key.

Usage:
    cd /Users/meganharrison/Documents/alleato-pm
    python scripts/project-acumatica-commitments.py
"""

import json
import subprocess
import sys
from pathlib import Path

# Activate backend venv if not already in it
backend_dir = Path(__file__).parent.parent / "backend"
venv_python = backend_dir / ".venv" / "bin" / "python"
if venv_python.exists() and sys.executable != str(venv_python):
    # Re-run under the venv python
    result = subprocess.run([str(venv_python), __file__] + sys.argv[1:])
    sys.exit(result.returncode)

# Add backend src to path
sys.path.insert(0, str(backend_dir / "src"))

from services.acumatica_sync import AcumaticaFinancialSyncService


def main() -> None:
    print("=== Acumatica → Commitments Projection ===\n")

    service = AcumaticaFinancialSyncService()

    print("Projecting subcontracts and purchase orders...")
    result = service.project_commitments()

    sc = result["subcontracts_projected"]
    po = result["purchase_orders_projected"]

    print("\n--- Subcontracts ---")
    print(f"  Fetched from acumatica_subcontracts: {sc['fetched']}")
    print(f"  Upserted to subcontracts:            {sc['upserted']}")
    if sc["errors"]:
        print(f"  Errors: {sc['errors']}")

    print("\n--- Purchase Orders ---")
    print(f"  Fetched from acumatica_purchase_orders: {po['fetched']}")
    print(f"  Upserted to purchase_orders:            {po['upserted']}")
    if po["errors"]:
        print(f"  Errors: {po['errors']}")

    print("\nDone.")


if __name__ == "__main__":
    main()
