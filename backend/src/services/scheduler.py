"""FastAPI scheduler lifecycle.

The web process intentionally registers no data-sync jobs. Background work must
be owned by an explicit provider service, and Acumatica imports are manual-only.
"""
from __future__ import annotations

import logging
import os
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler

logger = logging.getLogger(__name__)

scheduler: Optional[AsyncIOScheduler] = None


def _backend_api_only() -> bool:
    return os.getenv("BACKEND_API_ONLY", "").lower() in ("1", "true", "yes")


def init_scheduler() -> None:
    """Initialize and start the scheduler. Called from FastAPI startup."""
    global scheduler

    if _backend_api_only():
        logger.critical(
            "[Scheduler] Refusing to start in-process jobs because BACKEND_API_ONLY=true. "
            "The web service is API-only; background work must run in explicit cron services."
        )
        return

    if os.getenv("DISABLE_SCHEDULER", "").lower() in ("1", "true", "yes"):
        logger.info("[Scheduler] Disabled via DISABLE_SCHEDULER env var")
        return

    scheduler = AsyncIOScheduler()

    scheduler.start()
    registered_jobs = scheduler.get_jobs() if hasattr(scheduler, "get_jobs") else getattr(scheduler, "jobs", [])
    logger.info("[Scheduler] Started with %d registered job(s)", len(registered_jobs))


def shutdown_scheduler() -> None:
    """Gracefully shut down the scheduler."""
    global scheduler
    if scheduler and scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("[Scheduler] Shut down")
