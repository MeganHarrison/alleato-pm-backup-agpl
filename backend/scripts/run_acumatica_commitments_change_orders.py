"""One-off targeted Acumatica import: commitments + change orders only.

Runs the minimal subset of the financial sync needed to bring commitments and
change orders current, without touching AP/AR/budgets/projects/vendors writes.

Entities (in dependency order):
  raw:        change_orders, subcontracts, purchase_orders
  projection: change_orders_projection, commitments_projection

Setup (login + project/vendor/cost-code maps) mirrors sync_all() so the
projection steps can resolve FKs. Reads credentials from the repo-root .env.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = ROOT.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Load credentials from the repo-root .env (Render injects these in prod).
try:
    from dotenv import load_dotenv

    load_dotenv(REPO_ROOT / ".env")
except Exception:  # pragma: no cover - fallback parser
    env_path = REPO_ROOT / ".env"
    if env_path.exists():
        import os

        for line in env_path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))

from src.services.acumatica_sync import AcumaticaFinancialSyncService


# Only the commitments + change-order entities, in dependency order.
TARGET_ENTITIES = (
    "change_orders",
    "subcontracts",
    "purchase_orders",
    "change_orders_projection",
    "commitments_projection",
)


def main() -> int:
    service = AcumaticaFinancialSyncService()

    # Same setup sync_all() performs before running any entity handler.
    service.session.login()
    service.sync_user_id = service._resolve_sync_user_id()
    service.project_map = service._load_project_map()
    service.vendor_map = service._load_vendor_map()
    service.cost_codes = service._load_cost_codes()

    handlers = {
        "change_orders": service._sync_change_orders,
        "subcontracts": service._sync_subcontracts,
        "purchase_orders": service._sync_purchase_orders,
        "change_orders_projection": service._sync_change_orders_projection,
        "commitments_projection": service._sync_commitments_projection,
    }

    results = []
    errors = []
    for entity in TARGET_ENTITIES:
        try:
            result = service._run_entity_sync(entity, handlers[entity])
            results.append(result.as_dict())
            print(f"[ok] {entity}: {json.dumps(result.as_dict())}", flush=True)
        except Exception as exc:  # noqa: BLE001 - report per-entity, keep going
            errors.append(f"{entity}: {exc}")
            print(f"[FAIL] {entity}: {exc}", file=sys.stderr, flush=True)

    summary = {
        "status": "success" if not errors else "partial_failure",
        "results": results,
        "errors": errors,
    }
    print(json.dumps(summary, indent=2))
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
