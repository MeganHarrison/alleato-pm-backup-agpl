from pathlib import Path

import pytest

from src.services.project_intelligence.projections.operating_record import (
    apply_controlled_current_state_projection,
)


class _Result:
    def __init__(self, data):
        self.data = data

    def execute(self):
        return self


class _Client:
    def __init__(self, data):
        self.data = data
        self.rpc_name = None
        self.rpc_payload = None

    def rpc(self, name, payload):
        self.rpc_name = name
        self.rpc_payload = payload
        return _Result(self.data)


def test_controlled_current_state_writer_requires_applied_or_skipped_outcome(monkeypatch):
    monkeypatch.setattr(
        "src.services.project_intelligence.projections.operating_record.enforce_pm_app_final_projection_guard",
        lambda *args, **kwargs: None,
    )
    client = _Client([{"outcome": "applied", "project_id": 10}])
    result = apply_controlled_current_state_projection(
        client,
        project_id=10,
        projection={"health_status": "watch"},
        writer="compiler",
        provenance={"packet_id": "packet"},
    )
    assert result["outcome"] == "applied"
    assert client.rpc_name == "apply_project_current_state_projection"

    with pytest.raises(RuntimeError, match="rejected the compiler projection"):
        apply_controlled_current_state_projection(
            _Client([{"outcome": "rejected"}]),
            project_id=10,
            projection={},
            writer="compiler",
            provenance={},
        )


def test_shared_compiler_cannot_direct_write_operating_snapshot_or_current_state():
    source = Path("src/services/intelligence/compiler.py").read_text()
    assert 'table("project_operating_snapshots")' not in source
    assert 'rpc("apply_project_current_state_projection"' not in source
    assert "persist_project_operating_snapshot(" in source
    assert "apply_controlled_current_state_projection(" in source
