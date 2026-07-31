from __future__ import annotations

import json
import os
from base64 import urlsafe_b64decode


def bool_env(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def bounded_int_env(name: str, default: int, minimum: int, maximum: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except ValueError:
        value = default
    return max(minimum, min(value, maximum))


def jwt_role_for_key(value: str) -> str | None:
    parts = value.split(".")
    if len(parts) != 3:
        return None
    try:
        payload = json.loads(
            urlsafe_b64decode(parts[1] + "=" * (-len(parts[1]) % 4)).decode("utf-8")
        )
    except Exception:  # noqa: BLE001 - best-effort claim inspection only
        return None
    role = payload.get("role")
    return str(role) if role else None


def assert_service_role_key(env_name: str) -> None:
    value = os.getenv(env_name)
    if not value:
        raise RuntimeError(f"Missing required Supabase service credential: {env_name}")

    role = jwt_role_for_key(value)
    if role and role != "service_role":
        raise RuntimeError(
            f"{env_name} is configured with JWT role '{role}', not 'service_role'. "
            "The direct Graph sync owner will hit row-level security errors until this "
            "service is redeployed with the correct service-role key."
        )
