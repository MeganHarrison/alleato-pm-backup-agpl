from __future__ import annotations

import logging
import os
from datetime import datetime

logger = logging.getLogger(__name__)


def maybe_run_comm_project_backfill(client, *, since: datetime | None = None) -> dict:
    """Run bounded communication project assignment after ingestion jobs."""
    if os.getenv("COMM_PROJECT_BACKFILL_AFTER_SYNC", "true").lower() in ("0", "false", "no"):
        return {"status": "skipped", "reason": "disabled"}

    from .communication_project_backfill import run_incremental_project_backfill

    result = run_incremental_project_backfill(client, since=since)
    if result.get("failed"):
        logger.warning("Communication project backfill reported errors: %s", result)
    else:
        logger.info(
            "Communication project backfill complete: scanned=%d assigned=%d",
            result.get("scanned", 0),
            result.get("assigned", 0),
        )
    return result
