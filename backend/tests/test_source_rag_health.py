from datetime import datetime, timedelta, timezone

from src.services.health import source_rag_health as source_rag_health_mod
from src.services.health.source_rag_health import (
    SEARCHABLE_MEETING_CHUNK_SOURCE_TYPES,
    _counts_project_intelligence_outcome,
    _counts_task_extraction_outcome,
    _graph_conversation_chunk_alerts,
    _has_project_attribution_review,
    _has_project_intelligence_outcome,
    _has_task_extraction_outcome,
    _is_past_lifecycle_processing_grace,
    _is_project_required_row,
    _latest_job_metadata_by_document_id,
    _load_sharepoint_vector_contract,
    _merge_source_synthesis_metadata,
    main,
)


def test_main_exits_zero_on_a_completed_but_degraded_run(monkeypatch):
    monkeypatch.setattr(
        source_rag_health_mod,
        "run_source_rag_health_check",
        lambda: {"passed": False, "notification": {"status": "sent"}},
    )

    assert main() == 0


def test_main_exits_zero_on_a_healthy_run(monkeypatch):
    monkeypatch.setattr(
        source_rag_health_mod,
        "run_source_rag_health_check",
        lambda: {"passed": True, "notification": {"status": "skipped"}},
    )

    assert main() == 0


def test_main_propagates_an_unhandled_exception(monkeypatch):
    def _raise():
        raise RuntimeError("boom")

    monkeypatch.setattr(source_rag_health_mod, "run_source_rag_health_check", _raise)

    try:
        main()
        assert False, "expected RuntimeError to propagate"
    except RuntimeError as exc:
        assert "boom" in str(exc)


class _ContractQuery:
    def __init__(self, rows):
        self.rows = list(rows)
        self.filters = []
        self.range_start = 0
        self.range_end = 999

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, column, value):
        self.filters.append(("eq", column, value))
        return self

    def in_(self, column, values):
        self.filters.append(("in", column, set(values)))
        return self

    def range(self, start, end):
        self.range_start = start
        self.range_end = end
        return self

    def order(self, *_args, **_kwargs):
        return self

    def limit(self, value):
        self.range_end = self.range_start + value - 1
        return self

    def execute(self):
        rows = self.rows
        for kind, column, value in self.filters:
            if kind == "eq":
                rows = [row for row in rows if row.get(column) == value]
            else:
                rows = [row for row in rows if row.get(column) in value]
        rows = rows[self.range_start : self.range_end + 1]
        return type("Result", (), {"data": rows})()


class _ContractClient:
    def __init__(self, tables):
        self.tables = tables

    def table(self, name):
        return _ContractQuery(self.tables.get(name, []))


def test_searchable_meeting_chunk_source_types_include_summary_repairs():
    assert {
        "meeting_transcript",
        "meeting_summary",
        "meeting_segment_summary",
        "meeting_notes",
        "meeting_section",
    }.issubset(SEARCHABLE_MEETING_CHUNK_SOURCE_TYPES)


def test_sharepoint_vector_contract_requires_rag_replica_and_chunks(monkeypatch):
    app_client = _ContractClient(
        {
            "document_metadata": [
                {
                    "id": "sharepoint_1",
                    "source_system": "sharepoint",
                    "source_item_id": "1",
                    "status": "embedded",
                    "source_etag": '"one"',
                    "source_path": None,
                    "source_web_url": (
                        "https://alleato.sharepoint.com/sites/AlleatoGroup/"
                        "Shared%20Documents/Alleato%20Group/2026%20Jobs/"
                        "26-119/a.pdf"
                    ),
                    "deleted_at": None,
                },
                {
                    "id": "sharepoint_2",
                    "source_system": "sharepoint",
                    "source_item_id": "2",
                    "status": "raw_ingested",
                    "source_etag": '"two"',
                    "source_path": "/Alleato Group/2026 Jobs/26-119/b.pdf",
                    "deleted_at": None,
                },
            ]
        }
    )
    rag_client = _ContractClient(
        {
            "rag_document_metadata": [
                {
                    "id": "sharepoint_1",
                    "source_system": "sharepoint",
                    "source_item_id": "1",
                    "embedding_status": "embedded",
                    "source_metadata": {
                        "source_folder": "/Alleato Group/2026 Jobs/26-119"
                    },
                }
            ],
            "document_chunks": [{"document_id": "sharepoint_1"}],
        }
    )
    monkeypatch.setattr(
        source_rag_health_mod,
        "get_rag_read_client",
        lambda: rag_client,
    )

    report = _load_sharepoint_vector_contract(app_client)

    assert report["cataloged"] == 2
    assert report["missingRagMetadata"] == 1
    assert report["withoutChunks"] == 1
    assert report["status"] == "degraded"
    assert {
        alert["code"] for alert in report["alerts"]
    } >= {
        "sharepoint_catalog_missing_rag_metadata",
        "sharepoint_catalog_missing_vector_chunks",
    }


def test_sharepoint_vector_contract_passes_exact_catalog_rag_chunk_chain(
    monkeypatch,
):
    app_client = _ContractClient(
        {
            "document_metadata": [
                {
                    "id": "sharepoint_1",
                    "source_system": "sharepoint",
                    "source_item_id": "1",
                    "status": "embedded",
                    "source_etag": '"one"',
                    "source_path": "/Alleato Group/2026 Jobs/26-119/a.pdf",
                    "deleted_at": None,
                }
            ]
        }
    )
    rag_client = _ContractClient(
        {
            "rag_document_metadata": [
                {
                    "id": "sharepoint_1",
                    "source_system": "sharepoint",
                    "source_item_id": "1",
                    "embedding_status": "embedded",
                    "source_metadata": {
                        "source_folder": "/Alleato Group/2026 Jobs/26-119"
                    },
                }
            ],
            "document_chunks": [{"document_id": "sharepoint_1"}],
        }
    )
    monkeypatch.setattr(
        source_rag_health_mod,
        "get_rag_read_client",
        lambda: rag_client,
    )

    report = _load_sharepoint_vector_contract(app_client)

    assert report["status"] == "healthy"
    assert report["withChunks"] == 1
    assert report["alerts"] == []


def test_sharepoint_vector_contract_includes_explicit_discovery_overrides(
    monkeypatch,
):
    app_client = _ContractClient(
        {
            "document_metadata": [
                {
                    "id": "sharepoint_override",
                    "source_system": "sharepoint",
                    "status": "embedded",
                    "source_etag": '"one"',
                    "source_path": "/Special Project Evidence/proposal.pdf",
                    "deleted_at": None,
                }
            ]
        }
    )
    rag_client = _ContractClient(
        {
            "source_sync_runs": [
                {
                    "source": "microsoft_graph_source_sync",
                    "started_at": "2026-07-24T10:00:00Z",
                    "metadata": {
                        "sharepoint_discovery": {
                            "resource_ids": [
                                "sharepoint:AlleatoGroup:/Special Project Evidence"
                            ]
                        }
                    },
                }
            ],
            "rag_document_metadata": [
                {
                    "id": "sharepoint_override",
                    "source_system": "sharepoint",
                    "embedding_status": "embedded",
                    "source_metadata": {
                        "source_folder": "/Special Project Evidence"
                    },
                }
            ],
            "document_chunks": [{"document_id": "sharepoint_override"}],
        }
    )
    monkeypatch.setattr(
        source_rag_health_mod,
        "get_rag_read_client",
        lambda: rag_client,
    )

    report = _load_sharepoint_vector_contract(app_client)

    assert report["status"] == "healthy"
    assert report["cataloged"] == 1
    assert report["withChunks"] == 1


def test_sharepoint_vector_contract_rejects_terminal_rows_with_stale_chunks(
    monkeypatch,
):
    app_client = _ContractClient(
        {
            "document_metadata": [
                {
                    "id": "sharepoint_stale",
                    "source_system": "sharepoint",
                    "status": "ocr_failed",
                    "source_etag": '"new"',
                    "source_path": "/Alleato Group/2026 Jobs/26-119/scan.pdf",
                    "deleted_at": None,
                }
            ]
        }
    )
    rag_client = _ContractClient(
        {
            "rag_document_metadata": [
                {
                    "id": "sharepoint_stale",
                    "source_system": "sharepoint",
                    "embedding_status": "error",
                    "source_metadata": {
                        "source_folder": "/Alleato Group/2026 Jobs/26-119"
                    },
                }
            ],
            "document_chunks": [{"document_id": "sharepoint_stale"}],
        }
    )
    monkeypatch.setattr(
        source_rag_health_mod,
        "get_rag_read_client",
        lambda: rag_client,
    )

    report = _load_sharepoint_vector_contract(app_client)

    assert report["status"] == "degraded"
    assert report["terminalWithChunks"] == 1
    assert {
        alert["code"] for alert in report["alerts"]
    } == {"sharepoint_terminal_document_has_stale_chunks"}


def test_graph_conversation_chunk_alerts_pass_for_source_owned_chunks_and_skips():
    now = datetime(2026, 7, 7, tzinfo=timezone.utc)
    report = _graph_conversation_chunk_alerts(
        [
            {
                "id": "outlook_conversation_1",
                "type": "outlook_conversation",
                "source_metadata": {"document_kind": "outlook_conversation"},
                "embedding_status": "embedded",
            },
            {
                "id": "teamsdm_1_2026-07-07",
                "type": "teams_dm_conversation",
                "source_metadata": {"document_kind": "teams_dm_conversation"},
                "embedding_status": "embedded",
            },
            {
                "id": "teamsdm_tiny_2026-07-07",
                "type": "teams_dm_conversation",
                "source_metadata": {"document_kind": "teams_dm_conversation"},
                "embedding_status": "skipped",
            },
            {
                "id": "teams_root_1",
                "type": "teams_message",
                "source_metadata": {"document_kind": "teams_channel_thread"},
                "embedding_status": "embedded",
            },
        ],
        [
            {"document_id": "outlook_conversation_1", "chunk_id": "c1", "source_type": "email"},
            {"document_id": "teamsdm_1_2026-07-07", "chunk_id": "c2", "source_type": "teams_dm"},
            {"document_id": "teams_root_1", "chunk_id": "c3", "source_type": "teams_channel"},
        ],
        now=now,
    )

    assert report["status"] == "healthy"
    assert report["alerts"] == []
    teams_dm = next(summary for summary in report["summaries"] if summary["kind"] == "teams_dm")
    assert teams_dm["docsWithoutChunks"] == 1
    assert teams_dm["embeddedDocsWithoutChunks"] == 0


def test_graph_conversation_chunk_alerts_fail_for_generic_source_types():
    now = datetime(2026, 7, 7, tzinfo=timezone.utc)
    report = _graph_conversation_chunk_alerts(
        [
            {
                "id": "teamsdm_bad_2026-07-07",
                "type": "teams_dm_conversation",
                "source_metadata": {"document_kind": "teams_dm_conversation"},
                "embedding_status": "embedded",
                "title": "Bad Teams DM",
            }
        ],
        [
            {"document_id": "teamsdm_bad_2026-07-07", "chunk_id": "c1", "source_type": "document"},
            {"document_id": "teamsdm_bad_2026-07-07", "chunk_id": "c2", "source_type": "meeting_summary"},
        ],
        now=now,
    )

    assert report["status"] == "degraded"
    assert any(alert["code"] == "graph_conversation_chunk_source_type_drift" for alert in report["alerts"])
    assert report["alerts"][0]["source"] == "teams"
    assert "teamsdm_bad_2026-07-07" in report["alerts"][0]["message"]


def test_graph_conversation_chunk_alerts_fail_for_embedded_doc_without_chunks():
    now = datetime(2026, 7, 7, tzinfo=timezone.utc)
    report = _graph_conversation_chunk_alerts(
        [
            {
                "id": "outlook_conversation_missing",
                "type": "outlook_conversation",
                "source_metadata": {"document_kind": "outlook_conversation"},
                "embedding_status": "embedded",
            }
        ],
        [],
        now=now,
    )

    assert report["status"] == "degraded"
    assert any(alert["code"] == "graph_conversation_embedded_without_chunks" for alert in report["alerts"])
    assert report["alerts"][0]["source"] == "emails"


def test_latest_job_metadata_prefers_source_intelligence_task_outcome():
    metadata_by_id = _latest_job_metadata_by_document_id(
        [
            {
                "source_document_id": "doc-email",
                "metadata": {"embedding_path": "microsoft_graph.embed_graph_document"},
                "updated_at": "2026-07-07T05:37:16+00:00",
            },
            {
                "source_document_id": "doc-email",
                "metadata": {
                    "task_extraction_status": "no_actionable_tasks",
                    "tasks_created_count": 0,
                },
                "updated_at": "2026-07-07T05:36:45+00:00",
            },
        ]
    )

    assert metadata_by_id["doc-email"]["task_extraction_status"] == "no_actionable_tasks"
    assert _has_task_extraction_outcome("doc-email", set(), metadata_by_id)


def test_meeting_task_extraction_counts_existing_evidence_as_processed():
    assert _counts_task_extraction_outcome(
        family="meetings",
        document_id="meeting-doc",
        task_ids=set(),
        evidence_ids={"meeting-doc"},
        job_metadata_by_id={},
    )
    assert not _counts_task_extraction_outcome(
        family="emails",
        document_id="email-doc",
        task_ids=set(),
        evidence_ids={"email-doc"},
        job_metadata_by_id={},
    )


def test_project_intelligence_outcome_counts_source_synthesis_metadata():
    metadata_by_id = {
        "doc-email": {
            "source_synthesis_id": "source-synthesis-1",
            "_updated_at": "2026-07-07T05:36:45+00:00",
        }
    }

    assert _has_project_intelligence_outcome("doc-email", set(), metadata_by_id)
    assert _has_project_intelligence_outcome("doc-with-evidence", {"doc-with-evidence"}, {})
    assert not _has_project_intelligence_outcome("doc-missing", set(), {})


def test_project_attribution_review_counts_pending_null_project_candidate():
    assert _has_project_attribution_review("doc-review", {"doc-review"})
    assert not _has_project_attribution_review("doc-missing", {"doc-review"})


def test_source_synthesis_rows_backfill_project_intelligence_metadata():
    metadata_by_id = {"sharepoint-doc": {"_updated_at": "2026-07-07T04:22:54+00:00"}}

    _merge_source_synthesis_metadata(
        metadata_by_id,
        [
            {
                "id": "source-synthesis-1",
                "source_document_id": "sharepoint-doc",
                "project_id": 178,
                "tasks": [{"title": "Follow up"}],
                "metadata": {"deterministic_signal_type": "task"},
                "updated_at": "2026-07-07T11:40:00+00:00",
            }
        ],
    )

    assert metadata_by_id["sharepoint-doc"]["source_synthesis_id"] == "source-synthesis-1"
    assert metadata_by_id["sharepoint-doc"]["source_synthesis_signal_type"] == "task"
    assert metadata_by_id["sharepoint-doc"]["task_extraction_status"] == "task_signal_staged"
    assert _has_project_intelligence_outcome("sharepoint-doc", set(), metadata_by_id)
    assert _has_task_extraction_outcome("sharepoint-doc", set(), metadata_by_id)


def test_source_synthesis_non_task_signal_counts_as_no_actionable_tasks():
    metadata_by_id = {}

    _merge_source_synthesis_metadata(
        metadata_by_id,
        [
            {
                "id": "source-synthesis-1",
                "source_document_id": "email-doc",
                "project_id": 754,
                "tasks": [],
                "metadata": {"deterministic_signal_type": "project_update"},
                "updated_at": "2026-07-07T11:40:00+00:00",
            }
        ],
    )

    assert metadata_by_id["email-doc"]["task_extraction_status"] == "no_actionable_tasks"
    assert _has_task_extraction_outcome("email-doc", set(), metadata_by_id)


def test_meeting_project_intelligence_counts_existing_evidence_without_source_read_proof():
    assert _counts_project_intelligence_outcome(
        family="meetings",
        document_id="meeting-1",
        evidence_ids={"meeting-1"},
        job_metadata_by_id={},
    )


def test_meeting_project_intelligence_requires_full_read_for_metadata_only_outcome():
    metadata_by_id = {
        "meeting-1": {
            "source_synthesis_id": "source-synthesis-1",
            "_updated_at": "2026-07-07T05:36:45+00:00",
        },
        "meeting-2": {
            "source_synthesis_id": "source-synthesis-2",
            "read_proof": {
                "status": "full_source_read",
                "scope": "full_transcript",
            },
            "_updated_at": "2026-07-07T05:36:45+00:00",
        },
    }

    assert not _counts_project_intelligence_outcome(
        family="meetings",
        document_id="meeting-1",
        evidence_ids=set(),
        job_metadata_by_id=metadata_by_id,
    )
    assert _counts_project_intelligence_outcome(
        family="meetings",
        document_id="meeting-2",
        evidence_ids=set(),
        job_metadata_by_id=metadata_by_id,
    )


def test_meeting_project_intelligence_counts_packet_refresh_job():
    metadata_by_id = {
        "meeting-1": {
            "path": "project_intelligence.refresh_project_intelligence",
            "packet_id": "packet-1",
            "compiler_version": "project_intelligence_synthesis_v1",
            "_updated_at": "2026-07-07T18:25:28+00:00",
        }
    }

    assert _counts_project_intelligence_outcome(
        family="meetings",
        document_id="meeting-1",
        evidence_ids=set(),
        job_metadata_by_id=metadata_by_id,
    )


def test_meeting_project_intelligence_counts_durable_source_synthesis_signal():
    metadata_by_id = {
        "meeting-1": {
            "source_synthesis_id": "source-synthesis-1",
            "source_synthesis_signal_type": "task",
            "_updated_at": "2026-07-07T14:17:01+00:00",
        }
    }

    assert _counts_project_intelligence_outcome(
        family="meetings",
        document_id="meeting-1",
        evidence_ids=set(),
        job_metadata_by_id=metadata_by_id,
    )


def test_project_required_fallback_excludes_empty_anonymized_teams_dm():
    row = {
        "id": "teamsdm_empty_2026-07-06",
        "title": "Teams DM Conversation: 19:d5788d4ad",
        "family": "teams",
        "category": "teams_message",
        "type": "teams_dm_conversation",
        "status": "embedded",
        "project_id": None,
        "content": "",
    }

    assert not _is_project_required_row(row, {})


def test_project_required_fallback_excludes_internal_teams_conversation():
    row = {
        "id": "teamsdm_internal_2026-07-06",
        "title": "Teams DM Conversation: Indiana Office",
        "family": "teams",
        "category": "teams_message",
        "type": "teams_dm_conversation",
        "status": "embedded",
        "project_id": None,
        "content": "",
    }

    assert not _is_project_required_row(row, {})


def test_project_required_fallback_keeps_project_signal_teams_content_required():
    row = {
        "id": "teamsdm_project_2026-07-06",
        "title": "Teams DM Conversation: Champaign",
        "family": "teams",
        "category": "teams_message",
        "type": "teams_dm_conversation",
        "status": "embedded",
        "project_id": None,
        "content": "Sarah: Need RFI pricing and permit drawings for the sprinkler penetration work.",
    }

    assert _is_project_required_row(row, {})


def test_project_required_fallback_keeps_anonymized_teams_with_project_signal_required():
    row = {
        "id": "teamsdm_project_2026-07-06",
        "title": "Teams DM Conversation: 19:8704ffd5b",
        "family": "teams",
        "category": "teams_message",
        "type": "teams_dm_conversation",
        "status": "embedded",
        "project_id": None,
        "content": "Hunter: Need drawings and pricing for Exol PA Phase 2 guardrails.",
    }

    assert _is_project_required_row(row, {})


def test_project_required_metadata_overrides_fallback_classifier():
    row = {
        "id": "teamsdm_empty_2026-07-06",
        "title": "Teams DM Conversation: 19:d5788d4ad",
        "family": "teams",
        "category": "teams_message",
        "type": "teams_dm_conversation",
        "status": "embedded",
        "project_id": None,
        "content": "",
    }

    assert _is_project_required_row(row, {"teamsdm_empty_2026-07-06": {"project_required": True}})


def test_lifecycle_processing_grace_excludes_fresh_rows():
    now = datetime(2026, 7, 7, 14, 30, tzinfo=timezone.utc)

    assert not _is_past_lifecycle_processing_grace(
        {"created_at": (now - timedelta(minutes=5)).isoformat()},
        now,
    )
    assert _is_past_lifecycle_processing_grace(
        {"created_at": (now - timedelta(hours=2)).isoformat()},
        now,
    )


# ---------------------------------------------------------------------------
# Teams-alert delivery gate (PR #98 review findings)
# ---------------------------------------------------------------------------

import sys
import types

# Reuse the already-imported module object (imported via `from ... import` at the
# top) rather than adding a second `import` statement for the same module.
srh = sys.modules["src.services.health.source_rag_health"]


def _gate_health(sources=None, alerts=None):
    return {
        "generatedAt": "2026-07-22T23:00:00+00:00",
        "sources": sources or [],
        "alerts": alerts or [],
        "counts": {},
        "recentRuns": [],
    }


def _gate_lifecycle(alerts=None):
    return {"alerts": alerts or [], "latestPacketAt": None}


def _run_gate(monkeypatch, *, health, lifecycle, persist_notified, digest_due, trigger_remediation=True):
    stub = types.ModuleType("src.services.ops.db_pressure_guard")
    stub.enforce_app_db_pressure_guard = lambda *_a, **_k: None
    monkeypatch.setitem(sys.modules, "src.services.ops.db_pressure_guard", stub)

    monkeypatch.setattr(srh, "get_supabase_client", object)
    monkeypatch.setattr(srh, "get_source_sync_health", lambda _s: health)
    monkeypatch.setattr(srh, "_load_recent_rag_lifecycle_alerts", lambda _s: lifecycle)
    monkeypatch.setattr(
        srh,
        "_load_sharepoint_vector_contract",
        lambda _s: {"status": "healthy", "alerts": []},
    )
    monkeypatch.setattr(srh, "update_source_health_snapshot", lambda *_a, **_k: None)

    calls = {"reserve": None, "digest_mark": None, "posts": 0, "resolves": 0}

    def fake_persist(_s, alerts, *, reserve_notifications=False):
        calls["reserve"] = reserve_notifications
        return {"upserted": len(alerts), "resolved": 0, "notified": list(persist_notified)}

    def fake_digest(_s, *, mark_notified=False):
        calls["digest_mark"] = mark_notified
        return digest_due

    def fake_resolve(_s):
        calls["resolves"] += 1
        return True

    def fake_post(_r):
        calls["posts"] += 1
        return {"status": "sent", "channel": "teams"}

    monkeypatch.setattr(srh, "persist_source_sync_alerts", fake_persist)
    monkeypatch.setattr(srh, "reserve_health_digest_notification", fake_digest)
    monkeypatch.setattr(srh, "resolve_health_digest_notification", fake_resolve)
    monkeypatch.setattr(srh, "_post_teams_alert", fake_post)
    monkeypatch.setattr(srh, "_trigger_remediation_task", lambda _r: {"triggered": False})

    report = srh.run_source_rag_health_check(trigger_remediation=trigger_remediation)
    return report, calls


def test_gate_degraded_without_alert_rows_still_notifies_via_digest(monkeypatch):
    # A watched source is warning but produced no discrete alert row.
    health = _gate_health(
        sources=[{"source": "outlook_email", "resourceId": "u@x", "resourceName": "Outlook: u@x", "status": "warning"}],
        alerts=[],
    )
    report, calls = _run_gate(monkeypatch, health=health, lifecycle=_gate_lifecycle(), persist_notified=[], digest_due=True)

    assert report["passed"] is False
    assert calls["reserve"] is True
    assert calls["posts"] == 1  # first DM fires despite empty combined_alerts
    assert report["notification"]["status"] == "sent"


def test_gate_degraded_all_throttled_suppresses_dm(monkeypatch):
    alert = {"severity": "critical", "code": "source_sync_error", "source": "emails", "resourceId": "e", "message": "boom"}
    report, calls = _run_gate(
        monkeypatch,
        health=_gate_health(alerts=[alert]),
        lifecycle=_gate_lifecycle(),
        persist_notified=[],
        digest_due=False,
    )

    assert report["passed"] is False
    assert calls["posts"] == 0
    assert report["notification"]["status"] == "throttled"


def test_gate_new_alert_within_digest_window_does_not_bypass_digest_throttle(monkeypatch):
    alert = {"severity": "critical", "code": "source_sync_error", "source": "emails", "resourceId": "e", "message": "boom"}
    _report, calls = _run_gate(
        monkeypatch,
        health=_gate_health(alerts=[alert]),
        lifecycle=_gate_lifecycle(),
        persist_notified=["source_sync:source_sync_error:emails:e"],
        digest_due=False,
    )

    assert calls["posts"] == 0
    # Per-alert reservations still record the finding, but must not cause a
    # report-level DM while the digest itself is inside its cooldown window.
    assert calls["digest_mark"] is False
    assert _report["notification"]["status"] == "throttled"


def test_gate_non_delivering_readback_does_not_reserve(monkeypatch):
    alert = {"severity": "critical", "code": "source_sync_error", "source": "emails", "resourceId": "e", "message": "boom"}
    _report, calls = _run_gate(
        monkeypatch,
        health=_gate_health(alerts=[alert]),
        lifecycle=_gate_lifecycle(),
        persist_notified=[],
        digest_due=True,
        trigger_remediation=False,
    )

    assert calls["reserve"] is False    # no reservation consumed
    assert calls["posts"] == 0          # no delivery attempted
    assert calls["digest_mark"] is None  # digest never touched


def test_gate_recovery_resolves_digest(monkeypatch):
    report, calls = _run_gate(
        monkeypatch,
        health=_gate_health(sources=[], alerts=[]),
        lifecycle=_gate_lifecycle(),
        persist_notified=[],
        digest_due=False,
    )

    assert report["passed"] is True
    assert calls["resolves"] == 1
    assert calls["posts"] == 0


def test_main_does_not_turn_degraded_health_into_a_cron_failure(monkeypatch, capsys):
    monkeypatch.setattr(srh, "run_source_rag_health_check", lambda: {"passed": False, "status": "degraded"})

    assert srh.main() == 0
    assert '"status": "degraded"' in capsys.readouterr().out
