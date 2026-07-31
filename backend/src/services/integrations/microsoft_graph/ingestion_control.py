"""Runtime controls for Microsoft Graph ingestion.

The web service can stay online while Graph writes are disabled. This module is
the single switchboard for that behavior so scheduler flags, manual endpoints,
and webhook handling do not drift apart during incidents.
"""

from __future__ import annotations

import os
from typing import Literal, Optional


TRUTHY_VALUES = {"1", "true", "yes", "on"}
FALSY_VALUES = {"0", "false", "no", "off"}


def _env_normalized(name: str) -> str:
    return os.getenv(name, "").strip().lower()


def _env_true(name: str) -> bool:
    return _env_normalized(name) in TRUTHY_VALUES


def _env_false(name: str) -> bool:
    return _env_normalized(name) in FALSY_VALUES


GraphIngestionMode = Literal["manual", "webhook"]


def graph_ingestion_disabled_reason(mode: GraphIngestionMode = "manual") -> Optional[str]:
    """Return a public reason when Graph ingestion must not write.

    `BACKEND_API_ONLY=true` blocks manual write-heavy Graph work on the web
    service. Webhook mode is different: after the realtime sync path was
    removed, webhook handling is only allowed to validate and queue lightweight
    follow-up work. Explicit Graph flags still disable both modes.
    """

    if mode == "manual" and _env_true("BACKEND_API_ONLY"):
        return (
            "Microsoft Graph ingestion is disabled because BACKEND_API_ONLY=true. "
            "The backend is in API-only/DB-pressure-guard mode."
        )
    if _env_false("GRAPH_API_INGESTION_ENABLED"):
        return (
            "Microsoft Graph ingestion is disabled because "
            "GRAPH_API_INGESTION_ENABLED=false."
        )
    if _env_false("GRAPH_SYNC_ENABLED"):
        return "Microsoft Graph ingestion is disabled because GRAPH_SYNC_ENABLED=false."
    if mode == "webhook" and _env_false("GRAPH_WEBHOOK_DRAIN_ENABLED"):
        return (
            "Microsoft Graph webhook ingestion is disabled because "
            "GRAPH_WEBHOOK_DRAIN_ENABLED=false."
        )
    return None


def graph_ingestion_enabled(mode: GraphIngestionMode = "manual") -> bool:
    return graph_ingestion_disabled_reason(mode=mode) is None
