"""Ownership and dispatch tests for the canonical backend Project Intelligence runner."""

from __future__ import annotations

from pathlib import Path

import pytest

from src.services.project_intelligence import runner
from src.services.project_intelligence.projections import domain_packets
from src.services.project_intelligence.ownership import (
    FORMER_IMPORT_MARKERS,
    FORMER_PROJECTION_PATHS,
    assert_former_projection_paths_absent,
)


def _disable_startup_side_effects(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(runner, "load_env", lambda: None)
    monkeypatch.setattr(runner, "assert_former_projection_paths_absent", lambda _root: None)


def test_runner_dispatches_domain_packets_with_explicit_policy(monkeypatch: pytest.MonkeyPatch) -> None:
    _disable_startup_side_effects(monkeypatch)
    observed = {}

    def fake_run(args):
        observed.update(vars(args))
        return 7

    monkeypatch.setattr(runner, "_run_domain_packets", fake_run)
    result = runner.main(
        ["domain-packets", "--lookback-days", "21", "--doc-limit", "55", "--target-slug", "accounting"]
    )

    assert result == 7
    assert observed == {
        "projection": "domain-packets",
        "lookback_days": 21,
        "doc_limit": 55,
        "target_slug": "accounting",
    }


def test_runner_dispatches_project_sweep_with_explicit_policy(monkeypatch: pytest.MonkeyPatch) -> None:
    _disable_startup_side_effects(monkeypatch)
    observed = {}

    def fake_run(args):
        observed.update(vars(args))
        return 3

    monkeypatch.setattr(runner, "_run_project_sweep", fake_run)
    result = runner.main(
        [
            "project-sweep",
            "--max-projects",
            "40",
            "--max-extractions-per-project",
            "8",
            "--since-days",
            "10",
        ]
    )

    assert result == 3
    assert observed == {
        "projection": "project-sweep",
        "max_projects": 40,
        "max_extractions_per_project": 8,
        "since_days": 10,
    }


def test_former_projection_paths_are_absent_from_repository() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    assert_former_projection_paths_absent(repo_root)


def test_backend_has_no_imports_from_former_projection_modules() -> None:
    backend_root = Path(__file__).resolve().parents[1]
    ownership_file = backend_root / "src/services/project_intelligence/ownership.py"
    violations = []
    for source_root in (backend_root / "src", backend_root / "tests", backend_root / "unit_tests"):
        for path in source_root.rglob("*.py"):
            if path == ownership_file or "__pycache__" in path.parts:
                continue
            content = path.read_text(encoding="utf-8")
            for marker in FORMER_IMPORT_MARKERS:
                if marker in content:
                    violations.append(f"{path.relative_to(backend_root)}: {marker}")
    assert violations == []


def test_ownership_guard_names_reintroduced_path(tmp_path: Path) -> None:
    former_path = FORMER_PROJECTION_PATHS[0]
    candidate = tmp_path / former_path
    candidate.parent.mkdir(parents=True)
    candidate.write_text("functional copy", encoding="utf-8")

    with pytest.raises(RuntimeError, match=former_path):
        assert_former_projection_paths_absent(tmp_path)


def test_domain_batch_uses_one_cumulative_projection_budget(monkeypatch: pytest.MonkeyPatch) -> None:
    class Response:
        data = [
            {"id": "target-1", "slug": "accounting", "name": "Accounting"},
            {"id": "target-2", "slug": "operations", "name": "Operations"},
        ]

    class Query:
        def select(self, *_args):
            return self

        def eq(self, *_args):
            return self

        def execute(self):
            return Response()

    class Supabase:
        def table(self, *_args):
            return Query()

    observed_budget_ids = []

    def fake_compile(_supabase, target_id, **kwargs):
        budget = kwargs["projection_budget_counts"]
        observed_budget_ids.append(id(budget))
        budget["intelligence_packets"] = budget.get("intelligence_packets", 0) + 1
        return {"status": "compiled", "target_id": target_id}

    monkeypatch.setattr(domain_packets, "compile_domain_packet", fake_compile)
    summary = domain_packets.compile_all_domain_packets(Supabase())

    assert len(set(observed_budget_ids)) == 1
    assert summary["pm_projection_rows"] == {"intelligence_packets": 2}
    assert summary["compiled"] == 2
    assert summary["skipped"] == 0


def test_domain_stale_reconciliation_is_bounded_and_excludes_current_findings(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class Response:
        data = [
            {"id": "current", "metadata": {"finding_key": "still-current"}},
            {"id": "stale-1", "metadata": {"finding_key": "old-one"}},
            {"id": "stale-2", "metadata": {"finding_key": "old-two"}},
            {"id": "stale-3", "metadata": {"finding_key": "old-three"}},
        ]

    class Query:
        def select(self, *_args):
            return self

        def eq(self, *_args):
            return self

        def in_(self, *_args):
            return self

        def limit(self, *_args):
            return self

        def execute(self):
            return Response()

    class Supabase:
        def table(self, *_args):
            return Query()

    monkeypatch.setattr(domain_packets, "MAX_STALE_UPDATES_PER_TARGET", 2)

    candidates = domain_packets._load_stale_card_candidates(
        Supabase(),
        "target-1",
        {"still-current"},
    )

    assert [row["id"] for row in candidates] == ["stale-1", "stale-2"]


def test_domain_exit_code_rejects_partial_batch_hidden_by_skipped_target() -> None:
    summary = {
        "status": "partial",
        "compiled": 0,
        "skipped": 1,
        "failed": 4,
    }

    assert runner._domain_exit_code(summary) == 1


def test_domain_exit_code_accepts_compiled_batch_with_non_runnable_skip() -> None:
    summary = {
        "status": "ok",
        "compiled": 4,
        "skipped": 1,
        "failed": 0,
    }

    assert runner._domain_exit_code(summary) == 0
