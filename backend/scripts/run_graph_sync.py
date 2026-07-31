from __future__ import annotations

import json
import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from graph_sync_common import assert_service_role_key, bool_env, bounded_int_env
from src.services.env_loader import load_env
from src.services.integrations.microsoft_graph.sync import run_graph_sync
from src.services.supabase_helpers import get_supabase_client


def _exit_code_for_result(result: dict) -> int:
    """Fail the scheduler whenever any source or downstream phase failed.

    A successful source write does not compensate for failed vectorization: the
    resulting documents are invisible to retrieval and Project Intelligence.
    """
    return 1 if result.get("errors") else 0


def main() -> int:
    load_env()
    assert_service_role_key("SUPABASE_SERVICE_ROLE_KEY")
    assert_service_role_key("RAG_SUPABASE_SERVICE_ROLE_KEY")

    result = run_graph_sync(
        get_supabase_client(),
        run_outlook=bool_env("GRAPH_SYNC_OUTLOOK", True),
        run_teams=bool_env("GRAPH_SYNC_TEAMS", False),
        run_onedrive=bool_env("GRAPH_SYNC_ONEDRIVE", False),
        run_sharepoint=bool_env("GRAPH_SYNC_SHAREPOINT", True),
        run_embedding=bool_env("GRAPH_SYNC_RUN_EMBEDDING", True),
        embed_limit=bounded_int_env("GRAPH_EMBEDDING_LIMIT", 25, 1, 25),
        verify_outlook_persisted_count=bool_env("GRAPH_VERIFY_OUTLOOK_PERSISTED_COUNT", True),
    )
    print(json.dumps(result, indent=2, default=str))
    return _exit_code_for_result(result)


if __name__ == "__main__":
    raise SystemExit(main())
