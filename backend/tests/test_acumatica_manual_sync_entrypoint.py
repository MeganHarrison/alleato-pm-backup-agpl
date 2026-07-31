import importlib.util
from pathlib import Path

import pytest


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_acumatica_financial_sync.py"
)


def _load_entrypoint():
    spec = importlib.util.spec_from_file_location(
        "run_acumatica_financial_sync_entrypoint",
        SCRIPT_PATH,
    )
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize(
    ("argv", "env"),
    [
        ([], {}),
        (["--manual"], {}),
        ([], {"ACUMATICA_MANUAL_SYNC_CONFIRMED": "true"}),
        (
            ["--manual"],
            {"ACUMATICA_MANUAL_SYNC_CONFIRMED": "false"},
        ),
    ],
)
def test_acumatica_entrypoint_fails_closed_without_both_confirmations(argv, env):
    entrypoint = _load_entrypoint()

    with pytest.raises(SystemExit, match="Acumatica automatic sync is disabled"):
        entrypoint.require_manual_sync_confirmation(argv, env)


def test_acumatica_entrypoint_accepts_deliberate_manual_confirmation():
    entrypoint = _load_entrypoint()

    entrypoint.require_manual_sync_confirmation(
        ["--manual"],
        {"ACUMATICA_MANUAL_SYNC_CONFIRMED": "TRUE"},
    )
