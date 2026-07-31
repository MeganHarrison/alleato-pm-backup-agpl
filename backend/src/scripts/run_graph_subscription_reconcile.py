"""Cron entrypoint: ensure Microsoft Graph change-notification subscriptions are live.

Runs every 6 hours. Mail subscriptions expire after 48 hours, so this keeps them
renewed well before expiry. Creates new subscriptions if they don't exist.
"""

from __future__ import annotations

import json
import sys

sys.path.insert(0, "/app")

from src.services.env_loader import load_env

load_env()

from src.services.integrations.microsoft_graph.subscriptions import (
    configured_subscription_targets,
    ensure_subscriptions,
)
from src.services.supabase_helpers import get_rag_write_client

supabase = get_rag_write_client()
result = ensure_subscriptions(supabase, targets=configured_subscription_targets())
print(json.dumps(result, indent=2))

failed = result.get("failed", 0)
created = result.get("created", 0)
renewed = result.get("renewed", 0)

if failed > 0 and created == 0 and renewed == 0:
    print("ERROR: All subscription attempts failed.", file=sys.stderr)
    sys.exit(1)
