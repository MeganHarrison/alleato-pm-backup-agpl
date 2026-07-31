from __future__ import annotations

import base64
import sys
from pathlib import Path

import pytest


SCRIPTS_DIR = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import run_graph_sync  # noqa: E402


def test_cron_exits_nonzero_when_embedding_failed_after_source_writes():
    result = {
        "total_synced": 18,
        "errors": ["Graph embedding failed for 18 document(s)"],
    }

    assert run_graph_sync._exit_code_for_result(result) == 1


def test_cron_exits_zero_only_when_every_phase_succeeded():
    assert run_graph_sync._exit_code_for_result({"total_synced": 18, "errors": []}) == 0


def test_ocr_phase_receipt_fails_loudly_for_document_failures():
    result = run_graph_sync._build_ocr_phase_result(
        {
            "seen": 2,
            "ocr_full": 1,
            "ocr_partial": 0,
            "failed": 1,
        }
    )

    assert result["status"] == "complete_with_errors"
    assert result["errors"] == ["OCR failed for 1 document(s)"]
    assert run_graph_sync._exit_code_for_result(result) == 1


def test_sharepoint_scope_override_is_shell_safe_and_exact(monkeypatch):
    monkeypatch.delenv("SHAREPOINT_PROJECT_DISCOVERY_ENABLED", raising=False)
    monkeypatch.delenv("SHAREPOINT_SYNC_FOLDERS", raising=False)
    raw = (
        '["alleato.sharepoint.com/AlleatoGroup:/Alleato Group/'
        "Alleato Group-Shared/2026 Jobs/26-114 - GW - Brookville Road "
        '(Brookville Road, IN)"]'
    )
    encoded = base64.b64encode(raw.encode("utf-8")).decode("ascii")

    selected = run_graph_sync._apply_sharepoint_scope_override(encoded)

    assert selected == [
        "alleato.sharepoint.com/AlleatoGroup:/Alleato Group/"
        "Alleato Group-Shared/2026 Jobs/26-114 - GW - Brookville Road "
        "(Brookville Road, IN)"
    ]
    assert run_graph_sync.os.environ["SHAREPOINT_PROJECT_DISCOVERY_ENABLED"] == "false"
    assert run_graph_sync.os.environ["SHAREPOINT_SYNC_FOLDERS"] == raw


@pytest.mark.parametrize(
    "encoded",
    (
        "not-base64",
        base64.b64encode(b'{"not": "a list"}').decode("ascii"),
        base64.b64encode(
            b"alleato.sharepoint.com/AlleatoGroup:/A/B,"
            b"alleato.sharepoint.com/AlleatoGroup:/C/D"
        ).decode("ascii"),
    ),
)
def test_sharepoint_scope_override_fails_loudly_for_invalid_input(encoded):
    with pytest.raises(
        ValueError,
        match="sharepoint-scopes-base64|SHAREPOINT_SYNC_FOLDERS",
    ):
        run_graph_sync._apply_sharepoint_scope_override(encoded)


def test_sharepoint_scope_override_requires_sharepoint_phase(capsys):
    raw = '["alleato.sharepoint.com/AlleatoGroup:/A/B"]'
    encoded = base64.b64encode(raw.encode("utf-8")).decode("ascii")

    with pytest.raises(SystemExit) as exc:
        run_graph_sync.main(
            [
                "--phase",
                "ocr",
                "--sharepoint-scopes-base64",
                encoded,
            ]
        )

    assert exc.value.code == 2
    assert "requires --phase sharepoint" in capsys.readouterr().err


def test_cron_runs_every_isolated_phase_even_after_one_fails(monkeypatch):
    calls = []
    exit_codes = iter([0, 1, *([0] * (len(run_graph_sync.PHASES) - 2))])
    receipts = []

    def fake_run(command, **kwargs):
        calls.append((command, kwargs))
        return type("Completed", (), {"returncode": next(exit_codes)})()

    monkeypatch.setattr(run_graph_sync.subprocess, "run", fake_run)
    monkeypatch.setattr(
        run_graph_sync,
        "_record_orchestration_receipts",
        lambda results, *, started_at: receipts.append((results, started_at)),
    )

    assert run_graph_sync._run_isolated_phases() == 1
    assert [call[0][-1] for call in calls] == list(run_graph_sync.PHASES)
    assert all(call[1]["check"] is False for call in calls)
    assert all(call[1]["timeout"] == 480 for call in calls)
    assert run_graph_sync.PHASES[-2:] == ("ocr", "embedding")
    orchestration_started_values = {
        call[1]["env"][run_graph_sync.ORCHESTRATION_STARTED_AT_ENV] for call in calls
    }
    assert len(orchestration_started_values) == 1
    assert len(receipts) == 1
    assert receipts[0][0][1]["phase"] == "sharepoint"
    assert receipts[0][0][1]["exit_code"] == 1
    assert receipts[0][0][1]["status"] == "failed"
    assert receipts[0][0][1]["result"] == {}


def test_timed_out_phase_fails_loudly_and_later_phases_continue(monkeypatch):
    calls = []
    receipts = []

    def fake_run(command, **kwargs):
        phase = command[-1]
        calls.append(phase)
        if phase == "sharepoint":
            raise run_graph_sync.subprocess.TimeoutExpired(command, kwargs["timeout"])
        return type("Completed", (), {"returncode": 0})()

    monkeypatch.setattr(run_graph_sync.subprocess, "run", fake_run)
    monkeypatch.setattr(
        run_graph_sync,
        "_record_orchestration_receipts",
        lambda results, *, started_at: receipts.append(results),
    )

    assert run_graph_sync._run_isolated_phases() == 1
    assert calls == list(run_graph_sync.PHASES)
    timed_out = next(
        result for result in receipts[0] if result["phase"] == "sharepoint"
    )
    assert timed_out["exit_code"] == 124
    assert timed_out["status"] == "failed"
    assert "exceeded 480 seconds" in timed_out["error"]


def test_phase_receipt_metadata_preserves_real_counts_without_full_payload():
    result = {
        "status": "complete_with_errors",
        "total_synced": 499,
        "sharepoint": 499,
        "sharepoint_failed": 1,
        "errors": ["one file failed"],
        "source_sync": {"large": "payload"},
        "sharepoint_discovery": {"resource_ids": ["many"]},
    }

    metadata = run_graph_sync._bounded_phase_receipt_metadata(result)

    assert metadata == {
        "status": "complete_with_errors",
        "total_synced": 499,
        "sharepoint": 499,
        "sharepoint_failed": 1,
        "errors": ["one file failed"],
    }
