import importlib.util
from pathlib import Path

import pytest


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1] / "scripts" / "run_source_sync_health_recompute.py"
)


def _load_entrypoint():
    spec = importlib.util.spec_from_file_location(
        "run_source_sync_health_recompute_entrypoint",
        SCRIPT_PATH,
    )
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize(
    "status",
    ["healthy", "degraded", "unhealthy", ""],
)
def test_main_exits_zero_regardless_of_recomputed_health_status(monkeypatch, status):
    """Guardrail for the 2026-07-24 incident: a degraded/unhealthy status is a
    monitoring result recorded on system_alerts, not a script failure. Exiting
    non-zero here made Render alert "server failure" on every 30-minute cron
    tick for as long as any watched source stayed unhealthy.
    """
    entrypoint = _load_entrypoint()
    monkeypatch.setattr(entrypoint, "load_env", lambda: None)
    monkeypatch.setattr(
        entrypoint,
        "run_source_sync_health_recompute",
        lambda: {"health": {"status": status}},
    )

    assert entrypoint.main() == 0


def test_main_propagates_an_unhandled_exception(monkeypatch):
    """An actual execution failure (bad env, DB unreachable) must still reach
    Render as a real failure."""
    entrypoint = _load_entrypoint()
    monkeypatch.setattr(entrypoint, "load_env", lambda: None)

    def _raise():
        raise RuntimeError("boom")

    monkeypatch.setattr(entrypoint, "run_source_sync_health_recompute", _raise)

    with pytest.raises(RuntimeError, match="boom"):
        entrypoint.main()
