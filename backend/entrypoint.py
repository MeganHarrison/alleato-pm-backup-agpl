#!/usr/bin/env python3
import os
import sys


def _is_truthy(value: str | None) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "on"}


def _is_render_runtime() -> bool:
    return bool(
        os.environ.get("RENDER_SERVICE_ID")
        or os.environ.get("RENDER_EXTERNAL_URL")
        or _is_truthy(os.environ.get("RENDER"))
        or os.environ.get("ALLEATO_RUNTIME_ENV") == "production"
    )


def _require_production_env() -> None:
    if not _is_render_runtime():
        return

    missing = []
    if not os.environ.get("AI_GATEWAY_API_KEY"):
        missing.append("AI_GATEWAY_API_KEY")
    if not os.environ.get("SUPABASE_URL"):
        missing.append("SUPABASE_URL")
    if not os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
        missing.append("SUPABASE_SERVICE_ROLE_KEY")

    if missing:
        print(
            "Fatal Render config error: missing required production env vars: "
            + ", ".join(missing),
            file=sys.stderr,
        )
        sys.stderr.flush()
        sys.exit(1)


_require_production_env()

port = os.environ.get("PORT", "8000")
print(f"Starting uvicorn on port {port}...")
sys.stdout.flush()

os.execvp("uvicorn", [
    "uvicorn",
    "src.api.main:app",
    "--host", "0.0.0.0",
    "--port", port
])
