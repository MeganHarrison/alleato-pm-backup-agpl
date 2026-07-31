from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.services.ingestion.fireflies_pipeline import FirefliesIngestionPipeline
from src.services.ingestion.sync_followups import maybe_run_comm_project_backfill
from src.services.env_loader import load_env
from src.services.ops.db_pressure_guard import enforce_app_db_pressure_guard
from src.services.supabase_helpers import SupabaseRagStore, get_supabase_client


def main(limit: int = 25) -> int:
    load_env()
    enforce_app_db_pressure_guard("fireflies_sync")
    sync_started_at = datetime.now(timezone.utc)
    client = get_supabase_client()
    store = SupabaseRagStore(client)
    pipeline = FirefliesIngestionPipeline(store)
    result = pipeline.sync_recent_transcripts(limit=limit)
    result["project_backfill"] = maybe_run_comm_project_backfill(
        client,
        since=sync_started_at,
    )
    print(json.dumps(result if isinstance(result, dict) else {"result": str(result)}, indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
