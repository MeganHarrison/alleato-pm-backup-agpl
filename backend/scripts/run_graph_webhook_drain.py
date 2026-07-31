from __future__ import annotations

import json
import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.services.env_loader import load_env
from src.services.ops.db_pressure_guard import enforce_app_db_pressure_guard
from src.services.supabase_helpers import get_supabase_client
from src.services.integrations.microsoft_graph.sync import drain_pending_outlook_mailboxes


def main(limit: int | None = None) -> int:
    load_env()
    enforce_app_db_pressure_guard("graph_webhook_drain")

    resolved_limit = limit
    if resolved_limit is None:
        resolved_limit = max(
            1,
            int(os.getenv("GRAPH_WEBHOOK_DRAIN_MAX_MAILBOXES", "3")),
        )

    result = drain_pending_outlook_mailboxes(
        get_supabase_client(),
        limit=resolved_limit,
    )
    print(json.dumps(result, indent=2, default=str))

    failed = int(result.get("failed") or 0)
    processed = int(result.get("processed") or 0)
    return 1 if failed > 0 and processed == 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
