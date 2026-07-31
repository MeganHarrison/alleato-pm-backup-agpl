from __future__ import annotations

import json
import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from graph_sync_common import assert_service_role_key
from src.services.env_loader import load_env
from src.services.integrations.microsoft_graph.sync import run_graph_sync
from src.services.supabase_helpers import get_supabase_client


def main() -> int:
    load_env()
    assert_service_role_key("SUPABASE_SERVICE_ROLE_KEY")
    assert_service_role_key("RAG_SUPABASE_SERVICE_ROLE_KEY")

    os.environ["GRAPH_SYNC_OUTLOOK"] = "false"
    os.environ["GRAPH_SYNC_TEAMS"] = "false"
    os.environ["GRAPH_SYNC_TEAMS_DM"] = "true"
    os.environ["GRAPH_SYNC_ONEDRIVE"] = "false"
    os.environ["GRAPH_SYNC_SHAREPOINT"] = "false"

    result = run_graph_sync(
        get_supabase_client(),
        run_outlook=False,
        run_teams=True,
        run_onedrive=False,
        run_sharepoint=False,
        run_embedding=False,
        run_ocr=False,
        run_attachment_promotion=False,
    )
    print(json.dumps(result, indent=2, default=str))
    return 1 if result.get("errors") else 0


if __name__ == "__main__":
    raise SystemExit(main())
