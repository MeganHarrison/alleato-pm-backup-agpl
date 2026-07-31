#!/usr/bin/env python3
"""Report app DB pressure using the same bucketed snapshot as production jobs."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))


def _load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        os.environ.setdefault(key, value.strip().strip("'\""))


def main() -> int:
    _load_env_file(ROOT / ".env")
    override_env_file = os.environ.get("ALLEATO_ENV_FILE")
    if override_env_file:
        _load_env_file(Path(override_env_file))
    from src.services.ops.db_pressure_guard import _database_url, _fetch_pressure_snapshot

    database_url = _database_url()
    if not database_url:
        print(json.dumps({"ok": False, "error": "APP_DATABASE_URL, DATABASE_URL, or SUPABASE_DB_URL is missing"}))
        return 1

    snapshot = _fetch_pressure_snapshot(database_url)
    print(json.dumps({"ok": True, "snapshot": snapshot.to_dict()}, indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
