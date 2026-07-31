from __future__ import annotations

import sys
from pathlib import Path


SCRIPTS_DIR = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import run_graph_sync


def test_cron_exits_nonzero_when_embedding_failed_after_source_writes():
    result = {
        "total_synced": 18,
        "errors": ["Graph embedding failed for 18 document(s)"],
    }

    assert run_graph_sync._exit_code_for_result(result) == 1


def test_cron_exits_zero_only_when_every_phase_succeeded():
    assert run_graph_sync._exit_code_for_result({"total_synced": 18, "errors": []}) == 0
