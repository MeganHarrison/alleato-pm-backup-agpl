from datetime import datetime, timedelta, timezone

import src.services.health.source_sync_health as source_sync_health_mod
from src.services.health.source_sync_health import (
    _sharepoint_discovery_receipt,
    get_source_sync_health,
    persist_source_sync_alerts,
    record_sync_run,
    update_sync_run,
)


def test_sharepoint_health_reads_latest_discovery_receipt():
    receipt = _sharepoint_discovery_receipt(
        [
            {
                "source": "microsoft_graph_source_sync",
                "metadata": {
                    "sharepoint_discovery": {
                        "scope_count": 54,
                        "bootstrap_pending_count": 51,
                        "resource_ids": ["sharepoint:AlleatoGroup:/project"],
                    }
                },
            }
        ]
    )

    assert receipt["scope_count"] == 54
    assert receipt["bootstrap_pending_count"] == 51


class _Result:
    def __init__(self, data):
        self.data = data


class _TableQuery:
    def __init__(self, db, table_name):
        self.db = db
        self.table_name = table_name
        self.rows = list(db.tables.setdefault(table_name, []))
        self.action = "select"
        self.payload = None
        self.limit_count = None

    def select(self, *_args):
        self.action = "select"
        return self

    def insert(self, payload):
        self.action = "insert"
        self.payload = payload
        return self

    def upsert(self, payload, **_kwargs):
        self.action = "upsert"
        self.payload = payload
        return self

    def update(self, payload):
        self.action = "update"
        self.payload = payload
        return self

    def eq(self, key, value):
        self.rows = [row for row in self.rows if row.get(key) == value]
        return self

    def in_(self, key, values):
        allowed = set(values)
        self.rows = [row for row in self.rows if row.get(key) in allowed]
        return self

    def order(self, key, desc=False):
        self.rows = sorted(self.rows, key=lambda row: row.get(key) or "", reverse=desc)
        return self

    def limit(self, value):
        self.limit_count = value
        return self

    def execute(self):
        table = self.db.tables.setdefault(self.table_name, [])
        if self.action == "insert":
            row = dict(self.payload)
            row.setdefault("id", self.db.next_id(self.table_name))
            table.append(row)
            return _Result([row])
        if self.action == "upsert":
            for row in table:
                if row.get("alert_key") == self.payload.get("alert_key"):
                    row.update(self.payload)
                    return _Result([dict(row)])
            row = dict(self.payload)
            row.setdefault("id", self.db.next_id(self.table_name))
            table.append(row)
            return _Result([row])
        if self.action == "update":
            updated = []
            matching_ids = {id(row) for row in self.rows}
            for row in table:
                if id(row) in matching_ids:
                    row.update(self.payload)
                    updated.append(dict(row))
            return _Result(updated)
        rows = self.rows[: self.limit_count] if self.limit_count is not None else self.rows
        return _Result([dict(row) for row in rows])


class _FakeSupabase:
    def __init__(self):
        self.tables = {}
        self.counters = {}

    def table(self, table_name):
        return _TableQuery(self, table_name)

    def next_id(self, table_name):
        self.counters[table_name] = self.counters.get(table_name, 0) + 1
        return f"{table_name}-{self.counters[table_name]}"


def _seed_empty_tables(supabase):
    for table in [
        "graph_sync_state",
        "document_metadata",
        "document_chunks",
        "fireflies_ingestion_jobs",
        "source_intelligence_jobs",
        "packet_refresh_jobs",
        "tasks",
        "source_sync_health_snapshots",
        "source_sync_runs",
        "graph_subscriptions",
        "project_documents",
        "acumatica_sync_state",
        "system_alerts",
    ]:
        supabase.tables.setdefault(table, [])


def _get_source_sync_health_with_fake_rag(supabase):
    original_get_rag_read_client = source_sync_health_mod.get_rag_read_client
    source_sync_health_mod.get_rag_read_client = lambda: supabase
    try:
        return get_source_sync_health(supabase)
    finally:
        source_sync_health_mod.get_rag_read_client = original_get_rag_read_client


def _with_fake_rag_write(supabase, fn):
    original_get_rag_write_client = source_sync_health_mod.get_rag_write_client
    source_sync_health_mod.get_rag_write_client = lambda: supabase
    try:
        return fn()
    finally:
        source_sync_health_mod.get_rag_write_client = original_get_rag_write_client


def test_chunk_rows_for_documents_uses_small_batches_for_long_graph_ids():
    class _LimitedInQuery:
        def __init__(self, rows):
            self.rows = rows

        def select(self, *_args):
            return self

        def in_(self, key, values):
            assert len(values) <= source_sync_health_mod.CHUNK_DOCUMENT_ID_BATCH_SIZE
            allowed = set(values)
            self.rows = [row for row in self.rows if row.get(key) in allowed]
            return self

        def execute(self):
            return _Result(self.rows)

    class _LimitedInClient:
        def __init__(self, rows):
            self.rows = rows

        def table(self, table_name):
            assert table_name == "document_chunks"
            return _LimitedInQuery(list(self.rows))

    document_ids = [
        f"outlook_AAMkAGZjYjZlN2VkLTA3MTEtNDc0OC1hZTRiLTlmMDczYTI2YTllYg_{index}"
        for index in range(source_sync_health_mod.CHUNK_DOCUMENT_ID_BATCH_SIZE + 1)
    ]
    rows = [
        {"document_id": document_id, "chunk_id": f"{document_id}__chunk_0"}
        for document_id in document_ids
    ]
    original_get_rag_read_client = source_sync_health_mod.get_rag_read_client
    source_sync_health_mod.get_rag_read_client = lambda: _LimitedInClient(rows)
    try:
        chunk_rows = source_sync_health_mod._chunk_rows_for_documents(
            _LimitedInClient(rows),
            document_ids,
        )
    finally:
        source_sync_health_mod.get_rag_read_client = original_get_rag_read_client

    assert {row["document_id"] for row in chunk_rows} == set(document_ids)


def test_record_sync_run_writes_loud_run_ledger_row():
    supabase = _FakeSupabase()

    row = _with_fake_rag_write(
        supabase,
        lambda: record_sync_run(
            supabase,
            source="outlook_email",
            resource_id="brandon@example.com",
            stage="source_sync",
            status="failed",
            items_seen=3,
            items_failed=1,
            error_code="GRAPH_THROTTLED",
            error_message="Graph returned 429.",
        ),
    )

    assert row["source"] == "outlook_email"
    assert row["resource_id"] == "brandon@example.com"
    assert row["stage"] == "source_sync"
    assert row["status"] == "failed"
    assert row["items_failed"] == 1
    assert row["error_message"] == "Graph returned 429."
    assert len(supabase.tables["source_sync_runs"]) == 1


def test_update_sync_run_finishes_existing_running_row():
    supabase = _FakeSupabase()
    started = datetime.now(timezone.utc)
    row = _with_fake_rag_write(
        supabase,
        lambda: record_sync_run(
            supabase,
            source="fireflies",
            resource_id="fireflies_ingestion_jobs",
            stage="vectorization",
            status="running",
            started_at=started,
            items_seen=10,
        ),
    )

    updated = _with_fake_rag_write(
        supabase,
        lambda: update_sync_run(
            supabase,
            row["id"],
            status="warning",
            items_seen=10,
            items_synced=8,
            items_skipped=2,
            items_failed=0,
            error_code="FIREFLIES_BACKLOG_NON_VECTORIZABLE",
            error_message="2 Fireflies backlog jobs marked non-vectorizable",
        ),
    )

    assert updated["id"] == row["id"]
    assert updated["status"] == "warning"
    assert updated["items_synced"] == 8
    assert updated["items_skipped"] == 2
    assert updated["finished_at"]
    assert len(supabase.tables["source_sync_runs"]) == 1


def test_get_source_sync_health_surfaces_stale_graph_and_vector_backlog():
    supabase = _FakeSupabase()
    _seed_empty_tables(supabase)
    old = (datetime.now(timezone.utc) - timedelta(hours=5)).isoformat()
    recent = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
    supabase.tables["graph_sync_state"] = [
        {
            "source": "outlook_email",
            "resource_id": "brandon@example.com",
            "resource_name": "Brandon mailbox",
            "last_sync_at": old,
            "sync_status": "success",
            "error_message": None,
            "items_synced": 4,
            "updated_at": old,
        }
    ]
    supabase.tables["document_metadata"] = [
        {
            "id": "doc-1",
            "source_system": "microsoft_graph",
            "category": "outlook_email",
            "status": "uploaded",
            "created_at": recent,
        },
        {
            "id": "doc-2",
            "source_system": "microsoft_graph",
            "category": "outlook_email",
            "status": "uploaded",
            "created_at": recent,
        },
    ]
    supabase.tables["document_chunks"] = [
        {"document_id": "doc-1", "chunk_id": "chunk-1"},
    ]
    health = _get_source_sync_health_with_fake_rag(supabase)

    assert health["status"] == "degraded"
    assert health["counts"]["unembedded"] == 1
    assert health["counts"]["uncompiled"] == 0
    outlook = next(row for row in health["sources"] if row["source"] == "outlook_email")
    assert outlook["status"] in {"warning", "critical"}
    assert outlook["unembeddedCount"] == 1
    assert outlook["uncompiledCount"] == 0
    assert health["alerts"]


def test_get_source_sync_health_surfaces_sharepoint_recovery_warning():
    supabase = _FakeSupabase()
    _seed_empty_tables(supabase)
    recent = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    supabase.tables["graph_sync_state"] = [
        {
            "source": "sharepoint_file",
            "resource_id": "sharepoint:Operations:/SOP",
            "resource_name": "SharePoint: Operations/SOP",
            "last_sync_at": recent,
            "sync_status": "warning",
            "error_message": "2 SharePoint file(s) failed; the prior delta cursor was preserved for automatic retry.",
            "items_synced": 3,
            "updated_at": recent,
        }
    ]

    health = _get_source_sync_health_with_fake_rag(supabase)

    sharepoint = next(row for row in health["sources"] if row["source"] == "sharepoint_file")
    assert health["status"] == "degraded"
    assert sharepoint["status"] == "critical"
    assert sharepoint["lastSuccessAt"] is None
    assert sharepoint["lastErrorMessage"].startswith("2 SharePoint file")


def test_get_source_sync_health_excludes_retired_teams_chat_live_and_snapshot_rows():
    supabase = _FakeSupabase()
    _seed_empty_tables(supabase)
    old = (datetime.now(timezone.utc) - timedelta(days=80)).isoformat()
    supabase.tables["graph_sync_state"] = [
        {
            "source": "teams_chat",
            "resource_id": "chat:retired",
            "resource_name": "Retired Teams chat",
            "last_sync_at": old,
            "sync_status": "error",
            "error_message": "403 Forbidden",
            "items_synced": 0,
            "updated_at": old,
        }
    ]
    supabase.tables["source_sync_health_snapshots"] = [
        {
            "source": "teams_chat",
            "resource_id": "chat:retired-snapshot",
            "resource_name": "Retired Teams chat snapshot",
            "status": "critical",
            "last_sync_at": old,
            "last_success_at": None,
            "last_error_at": old,
            "last_error_message": "403 Forbidden",
            "items_synced": 0,
            "unprocessed_count": 0,
            "unembedded_count": 0,
            "stale_minutes": 115200,
            "metadata": {},
        }
    ]

    health = _get_source_sync_health_with_fake_rag(supabase)

    assert all(row["source"] != "teams_chat" for row in health["sources"])
    assert all(alert["source"] != "teams_chat" for alert in health["alerts"])
    assert health["counts"]["sources"] == 0
    assert health["counts"]["alerts"] == 0
    assert health["status"] == "healthy"


def test_document_health_excludes_terminal_and_stub_rows_from_rag_backlog():
    supabase = _FakeSupabase()
    _seed_empty_tables(supabase)
    recent = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
    supabase.tables["document_metadata"] = [
        {
            "id": "doc-real-email",
            "source_system": "microsoft_graph",
            "category": "outlook_email",
            "type": "email",
            "status": "uploaded",
            "created_at": recent,
        },
        {
            "id": "doc-ai-stub",
            "source_system": "ai_assistant",
            "category": "ai_assistant",
            "type": "ai_assistant_task",
            "status": "done",
            "created_at": recent,
        },
        {
            "id": "doc-agenda-stub",
            "source_system": "meeting_agenda",
            "category": "meeting_agenda",
            "type": "meeting_agenda_task",
            "status": "done",
            "created_at": recent,
        },
        {
            "id": "doc-low-content",
            "source_system": "microsoft_graph",
            "category": "outlook_email",
            "type": "email",
            "status": "skipped_low_content",
            "created_at": recent,
        },
    ]

    health = _get_source_sync_health_with_fake_rag(supabase)

    assert health["counts"]["unembedded"] == 1
    assert health["counts"]["uncompiled"] == 0
    assert health["pipeline"]["unembeddedBySource"] == {"outlook_email": 1}
    assert health["pipeline"]["uncompiledBySource"] == {}


def test_embedded_document_does_not_require_per_document_synthesis():
    supabase = _FakeSupabase()
    _seed_empty_tables(supabase)
    recent = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
    supabase.tables["graph_sync_state"] = [
        {
            "source": "outlook_email",
            "resource_id": "mailbox@example.com",
            "resource_name": "Mailbox",
            "last_sync_at": recent,
            "sync_status": "success",
            "error_message": None,
            "items_synced": 1,
            "updated_at": recent,
        }
    ]
    supabase.tables["document_metadata"] = [
        {
            "id": "doc-compiled-later",
            "source_system": "microsoft_graph",
            "category": "outlook_email",
            "type": "email",
            "status": "embedded",
            "created_at": recent,
        }
    ]
    supabase.tables["document_chunks"] = [
        {"document_id": "doc-compiled-later", "chunk_id": "chunk-1"},
    ]

    health = _get_source_sync_health_with_fake_rag(supabase)

    outlook = next(row for row in health["sources"] if row["source"] == "outlook_email")
    assert outlook["status"] == "healthy"
    assert outlook["uncompiledCount"] == 0
    assert health["pipeline"]["uncompiledBySource"] == {}
    assert not any(alert["code"] == "compiler_backlog" for alert in health["alerts"])


def test_source_sync_health_does_not_read_retired_synthesis_queues():
    supabase = _FakeSupabase()
    _seed_empty_tables(supabase)

    health = _get_source_sync_health_with_fake_rag(supabase)

    assert health["pipeline"]["sourceJobsByStatus"] == {}
    assert health["pipeline"]["sourceJobsByStatusRaw"] == {}
    assert health["pipeline"]["retiredSourceJobsByStatus"] == {}
    assert health["pipeline"]["packetJobsByStatus"] == {}
    assert health["pipeline"]["packetJobsByStatusRaw"] == {}
    assert health["pipeline"]["retiredPacketJobsByStatus"] == {}
    assert not any(alert["code"] == "compiler_backlog" for alert in health["alerts"])
    assert not any(alert["code"] == "packet_refresh_failed" for alert in health["alerts"])


def test_get_source_sync_health_surfaces_unconfigured_graph_subscription(monkeypatch):
    monkeypatch.setenv("MICROSOFT_SYNC_USERS", "active@example.com")
    supabase = _FakeSupabase()
    _seed_empty_tables(supabase)
    supabase.tables["graph_subscriptions"] = [
        {
            "source": "outlook_email",
            "resource_id": "stale@example.com",
            "resource_name": "Stale mailbox",
            "status": "renewal_due",
            "expiration_at": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat(),
            "last_error_message": "Microsoft Graph lifecycle event: reauthorizationRequired",
        }
    ]

    health = _get_source_sync_health_with_fake_rag(supabase)

    assert health["status"] == "degraded"
    assert health["pipeline"]["unconfiguredGraphSubscriptions"] == 1
    assert any(alert["code"] == "unconfigured_graph_subscription" for alert in health["alerts"])


def test_get_source_sync_health_includes_recent_runs_and_stuck_items():
    supabase = _FakeSupabase()
    _seed_empty_tables(supabase)
    old = (datetime.now(timezone.utc) - timedelta(hours=6)).isoformat()
    recent = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    supabase.tables["source_sync_runs"] = [
        {
            "id": "run-1",
            "source": "fireflies",
            "resource_id": "fireflies_ingestion_jobs",
            "resource_name": "Fireflies meetings",
            "stage": "vectorization",
            "status": "failed",
            "started_at": recent,
            "finished_at": recent,
            "items_seen": 10,
            "items_synced": 8,
            "items_failed": 2,
            "error_code": "BACKLOG_FAILED",
            "error_message": "2 Fireflies backlog jobs failed",
            "metadata": {"limit": 10},
        }
    ]
    supabase.tables["document_metadata"] = [
        {
            "id": "doc-image",
            "title": "Mech Screening Picture.png",
            "type": "image/png",
            "category": "file",
            "status": "error",
            "project_id": 43,
            "created_at": old,
        }
    ]
    supabase.tables["fireflies_ingestion_jobs"] = [
        {
            "fireflies_id": "ff-image",
            "metadata_id": "doc-image",
            "stage": "error",
            "error_message": "Cannot extract text from file: Mech Screening Picture.png",
            "last_attempt_at": recent,
            "updated_at": recent,
        }
    ]

    health = _get_source_sync_health_with_fake_rag(supabase)

    assert health["recentRuns"][0]["source"] == "fireflies"
    assert health["recentRuns"][0]["itemsFailed"] == 2
    assert health["stuckItems"][0]["resourceName"] == "Mech Screening Picture.png"
    assert health["stuckItems"][0]["status"] == "failed"
    assert health["counts"]["stuckItems"] == 1


def test_get_source_sync_health_attributes_shared_queue_stuck_items_by_real_source():
    supabase = _FakeSupabase()
    _seed_empty_tables(supabase)
    recent = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    supabase.tables["document_metadata"] = [
        {
            "id": "doc-email",
            "title": "Owner email thread",
            "source": "microsoft_graph",
            "source_system": "microsoft_graph",
            "category": "outlook_email",
            "type": "email",
            "status": "error",
            "created_at": recent,
        },
        {
            "id": "doc-teams",
            "title": "Teams DM conversation",
            "source": "microsoft_graph",
            "source_system": "microsoft_graph",
            "category": "teams_message",
            "type": "teams_dm_conversation",
            "status": "error",
            "created_at": recent,
        },
    ]
    supabase.tables["fireflies_ingestion_jobs"] = [
        {
            "fireflies_id": "outlook_1",
            "metadata_id": "doc-email",
            "stage": "error",
            "error_message": "Server disconnected",
            "last_attempt_at": recent,
            "updated_at": recent,
        },
        {
            "fireflies_id": "teamsdm_1",
            "metadata_id": "doc-teams",
            "stage": "error",
            "error_message": "ConnectionTerminated",
            "last_attempt_at": recent,
            "updated_at": recent,
        },
    ]

    health = _get_source_sync_health_with_fake_rag(supabase)

    stuck_sources = {item["resourceId"]: item["source"] for item in health["stuckItems"]}
    assert stuck_sources["doc-email"] == "outlook_email"
    assert stuck_sources["doc-teams"] == "teams_chat_export"


def test_get_source_sync_health_reports_task_extraction_freshness():
    supabase = _FakeSupabase()
    _seed_empty_tables(supabase)
    recent = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    supabase.tables["tasks"] = [
        {
            "id": "task-1",
            "metadata_id": "doc-1",
            "source_system": "fireflies",
            "extraction_source": "scheduled_task_extraction",
            "created_at": recent,
            "updated_at": recent,
        }
    ]

    health = _get_source_sync_health_with_fake_rag(supabase)

    task_source = next(row for row in health["sources"] if row["source"] == "task_extraction")
    assert task_source["status"] == "healthy"
    assert task_source["itemsSynced"] == 1
    assert health["pipeline"]["tasksBySourceSystem"]["fireflies"] == 1


def test_get_source_sync_health_surfaces_acumatica_payment_application_failure():
    supabase = _FakeSupabase()
    _seed_empty_tables(supabase)
    now = datetime.now(timezone.utc).isoformat()
    supabase.tables["acumatica_sync_state"] = [
        {
            "entity_name": "ar_payments",
            "status": "success",
            "last_started_at": now,
            "last_success_at": now,
            "last_error": None,
            "last_stats": {"upserted": 31},
            "updated_at": now,
        },
        {
            "entity_name": "payment_applications",
            "status": "failed",
            "last_started_at": now,
            "last_success_at": None,
            "last_error": "Expose a Generic Inquiry or endpoint with applied invoice fields.",
            "last_stats": None,
            "updated_at": now,
        },
    ]

    health = _get_source_sync_health_with_fake_rag(supabase)

    row = next(source for source in health["sources"] if source["source"] == "acumatica_financial_sync")
    assert health["status"] == "degraded"
    assert row["status"] == "critical"
    assert row["lastErrorMessage"] == "Expose a Generic Inquiry or endpoint with applied invoice fields."
    assert row["metadata"]["failedEntities"] == ["payment_applications"]


def test_get_source_sync_health_treats_acumatica_warning_fallback_as_warning_not_critical():
    supabase = _FakeSupabase()
    _seed_empty_tables(supabase)
    now = datetime.now(timezone.utc).isoformat()
    supabase.tables["acumatica_sync_state"] = [
        {
            "entity_name": "ar_payments",
            "status": "success",
            "last_started_at": now,
            "last_success_at": now,
            "last_error": None,
            "last_stats": {"upserted": 31},
            "updated_at": now,
        },
        {
            "entity_name": "payment_applications",
            "status": "warning",
            "last_started_at": now,
            "last_success_at": now,
            "last_error": "Projected prime contract payments directly from acumatica_payments using unique customer-to-project mapping.",
            "last_stats": {"projected": 43, "errors": 0, "warnings": ["fallback projection"]},
            "updated_at": now,
        },
    ]

    health = _get_source_sync_health_with_fake_rag(supabase)

    row = next(source for source in health["sources"] if source["source"] == "acumatica_financial_sync")
    assert health["status"] == "degraded"
    assert row["status"] == "warning"
    assert row["metadata"]["failedEntities"] == []
    assert row["metadata"]["warningEntities"] == ["payment_applications"]
    alert = next(alert for alert in health["alerts"] if alert["source"] == "acumatica_financial_sync")
    assert alert["severity"] == "warning"
    assert alert["code"] == "source_sync_error"


def test_get_source_sync_health_alerts_when_graph_docs_missing_project_documents():
    supabase = _FakeSupabase()
    _seed_empty_tables(supabase)
    recent = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    supabase.tables["document_metadata"] = [
        {
            "id": "onedrive_drive-item-1",
            "title": "Scope.txt",
            "source": "microsoft_graph",
            "source_system": "microsoft_graph",
            "category": "document",
            "type": "document",
            "status": "embedded",
            "project_id": 25125,
            "created_at": recent,
            "tags": "onedrive,txt",
        },
        {
            "id": "sharepoint_drive-item-2",
            "title": "RFI.pdf",
            "source": "microsoft_graph",
            "source_system": "sharepoint",
            "source_item_id": "drive-item-2",
            "category": "document",
            "type": "document",
            "status": "embedded",
            "project_id": 25125,
            "created_at": recent,
        },
    ]
    supabase.tables["project_documents"] = [
        {
            "id": 1,
            "project_id": 25125,
            "source_system": "sharepoint",
            "source_item_id": "drive-item-2",
            "deleted_at": None,
        }
    ]

    health = _get_source_sync_health_with_fake_rag(supabase)

    promotion = health["pipeline"]["graphProjectDocumentPromotion"]
    assert promotion["promoted"] == 1
    assert promotion["missing"] == 1
    assert promotion["missing_onedrive"] == 1
    assert any(alert["code"] == "graph_project_document_promotion_gap" for alert in health["alerts"])


def test_get_source_sync_health_caps_returned_sources_and_alerts():
    supabase = _FakeSupabase()
    _seed_empty_tables(supabase)
    old = (datetime.now(timezone.utc) - timedelta(hours=8)).isoformat()
    supabase.tables["source_sync_health_snapshots"] = [
        {
            "source": "teams_message",
            "resource_id": f"channel-{index}",
            "resource_name": f"Teams Channel {index}",
            "status": "critical",
            "last_sync_at": old,
            "last_success_at": old,
            "last_error_at": None,
            "last_error_message": None,
            "items_synced": 0,
            "unprocessed_count": 0,
            "unembedded_count": 100,
            "uncompiled_count": 100,
            "stale_minutes": 480,
            "metadata": {},
        }
        for index in range(120)
    ]

    health = _get_source_sync_health_with_fake_rag(supabase)

    assert health["counts"]["sources"] == 120
    assert health["counts"]["alerts"] >= 120
    assert len(health["sources"]) == health["thresholds"]["maxReturnedSources"]
    assert len(health["alerts"]) == health["thresholds"]["maxReturnedAlerts"]


def test_snapshot_fallback_does_not_restore_retired_compiler_backlog():
    supabase = _FakeSupabase()
    _seed_empty_tables(supabase)
    recent = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    supabase.tables["source_sync_health_snapshots"] = [
        {
            "source": "teams_message",
            "resource_id": "channel-legacy-snapshot",
            "resource_name": "Teams legacy snapshot",
            "status": "warning",
            "last_sync_at": recent,
            "last_success_at": recent,
            "last_error_at": None,
            "last_error_message": None,
            "items_synced": 5,
            "unprocessed_count": 0,
            "unembedded_count": 0,
            "uncompiled_count": 9,
            "stale_minutes": 5,
            "metadata": {},
        }
    ]

    health = _get_source_sync_health_with_fake_rag(supabase)

    row = next(
        source
        for source in health["sources"]
        if source["resourceId"] == "channel-legacy-snapshot"
    )
    assert row["status"] == "healthy"
    assert row["uncompiledCount"] == 0
    assert health["counts"]["uncompiled"] == 0
    assert not any(alert["code"] == "compiler_backlog" for alert in health["alerts"])


def test_detect_alerts_does_not_label_fresh_backlog_source_as_stale():
    """A source synced minutes ago but warning on embedding backlog must NOT emit
    a 'Last sync is N minutes old' stale alert (the fireflies '4 minutes old' bug)."""
    now = datetime.now(timezone.utc)
    sources = [
        {
            "source": "fireflies",
            "resourceId": "document_metadata",
            "resourceName": "Fireflies meetings",
            "status": "warning",
            "staleMinutes": 4,
            "lastErrorMessage": None,
            "unembeddedCount": 40,
            "uncompiledCount": 0,
        }
    ]

    alerts = source_sync_health_mod.detect_source_sync_alerts(sources, {}, now)

    assert all(alert["code"] != "source_sync_stale" for alert in alerts)
    assert not any("minutes old" in alert["message"] for alert in alerts)


def test_detect_alerts_flags_genuinely_stale_source():
    now = datetime.now(timezone.utc)
    sources = [
        {
            "source": "outlook_email",
            "resourceId": "brandon@example.com",
            "resourceName": "Outlook: brandon",
            "status": "critical",
            "staleMinutes": 3000,
            "lastErrorMessage": None,
        }
    ]

    alerts = source_sync_health_mod.detect_source_sync_alerts(sources, {}, now)

    assert any(
        alert["code"] == "source_sync_stale" and "minutes old" in alert["message"]
        for alert in alerts
    )


def test_graph_sources_inherit_parent_source_reconciliation_run_freshness():
    """A quiet mailbox whose own last_sync lags but whose parent microsoft_graph
    sync ran minutes ago is healthy — not falsely stale."""
    supabase = _FakeSupabase()
    _seed_empty_tables(supabase)
    stale = (datetime.now(timezone.utc) - timedelta(hours=10)).isoformat()
    fresh = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
    supabase.tables["graph_sync_state"] = [
        {
            "source": "outlook_email",
            "resource_id": "mbox@example.com",
            "resource_name": "Mailbox",
            "last_sync_at": stale,
            "sync_status": "success",
            "error_message": None,
            "items_synced": 1,
            "updated_at": stale,
        }
    ]
    supabase.tables["document_metadata"] = [
        {
            "id": "doc-graph",
            "source_system": "microsoft_graph",
            "category": None,
            "type": "unknown",
            "status": "embedded",
            "created_at": stale,
        }
    ]
    supabase.tables["document_chunks"] = [
        {"document_id": "doc-graph", "chunk_id": "chunk-graph"}
    ]
    supabase.tables["source_sync_runs"] = [
        {
            "id": "run-graph",
            "source": "microsoft_graph_source_sync",
            "resource_id": "graph",
            "stage": "source_sync",
            "status": "success",
            "started_at": fresh,
            "finished_at": fresh,
        }
    ]

    health = _get_source_sync_health_with_fake_rag(supabase)

    outlook = next(row for row in health["sources"] if row["source"] == "outlook_email")
    graph = next(row for row in health["sources"] if row["source"] == "microsoft_graph")
    assert outlook["status"] == "healthy"
    assert graph["status"] == "healthy"
    assert not any(
        alert["source"] == "outlook_email" and alert["code"] == "source_sync_stale"
        for alert in health["alerts"]
    )


def test_persist_source_sync_alerts_surfaces_rls_drift_as_actionable_error():
    class _RlsClient:
        def __init__(self):
            self._upsert = False

        def table(self, _name):
            return self

        def select(self, *_a, **_k):
            return self

        def eq(self, *_a, **_k):
            return self

        def limit(self, *_a, **_k):
            return self

        def upsert(self, *_a, **_k):
            self._upsert = True
            return self

        def execute(self):
            if self._upsert:
                raise RuntimeError(
                    '{"message":"new row violates row-level security policy for table '
                    '\\"system_alerts\\"","code":"42501"}'
                )
            return _Result([])

    client = _RlsClient()
    original = source_sync_health_mod.get_rag_write_client
    source_sync_health_mod.get_rag_write_client = lambda: client
    try:
        raised = None
        try:
            source_sync_health_mod.persist_source_sync_alerts(
                _RlsClient(),
                [
                    {
                        "severity": "warning",
                        "code": "embedding_backlog",
                        "source": "vectorization",
                        "resourceId": "document_chunks",
                        "message": "Backlog.",
                        "detectedAt": "2026-05-07T00:00:00+00:00",
                    }
                ],
            )
        except RuntimeError as exc:
            raised = exc
    finally:
        source_sync_health_mod.get_rag_write_client = original

    assert raised is not None
    assert "service_role" in str(raised)
    assert "RAG_SUPABASE_SERVICE_ROLE_KEY" in str(raised)


def test_persist_source_sync_alerts_upserts_and_resolves():
    supabase = _FakeSupabase()
    _seed_empty_tables(supabase)

    original_get_rag_write_client = source_sync_health_mod.get_rag_write_client
    source_sync_health_mod.get_rag_write_client = lambda: supabase
    try:
        first = persist_source_sync_alerts(
            supabase,
            [
                {
                    "severity": "warning",
                    "code": "embedding_backlog",
                    "source": "vectorization",
                    "resourceId": "document_chunks",
                    "message": "Backlog detected.",
                    "detectedAt": "2026-05-07T00:00:00+00:00",
                }
            ],
        )
        second = persist_source_sync_alerts(supabase, [])
    finally:
        source_sync_health_mod.get_rag_write_client = original_get_rag_write_client

    assert first == {"upserted": 1, "resolved": 0, "notified": []}
    assert second == {"upserted": 0, "resolved": 1, "notified": []}
    alert = supabase.tables["system_alerts"][0]
    assert alert["alert_key"] == "source_sync:embedding_backlog:vectorization:document_chunks"
    assert alert["status"] == "resolved"
    assert alert["resolved_at"]


def test_persist_source_sync_alerts_bounds_payload_fields():
    supabase = _FakeSupabase()
    _seed_empty_tables(supabase)

    original_get_rag_write_client = source_sync_health_mod.get_rag_write_client
    source_sync_health_mod.get_rag_write_client = lambda: supabase
    try:
        persist_source_sync_alerts(
            supabase,
            [
                {
                    "severity": "critical",
                    "code": "source_sync_error",
                    "source": "teams_chat",
                    "resourceId": "chat:" + ("a" * 1200),
                    "message": "Client error " + ("403 Forbidden " * 200),
                    "detectedAt": "2026-05-07T00:00:00+00:00",
                }
            ],
        )
    finally:
        source_sync_health_mod.get_rag_write_client = original_get_rag_write_client

    alert = supabase.tables["system_alerts"][0]
    assert len(alert["resource_id"]) <= 500
    assert len(alert["message"]) <= 1200
    assert isinstance(alert["metadata"]["source"], str)
    assert len(alert["metadata"]["resourceId"]) <= 500


def test_persist_source_sync_alerts_can_skip_resolving_missing_alerts():
    supabase = _FakeSupabase()
    _seed_empty_tables(supabase)
    supabase.tables["system_alerts"] = [
        {
            "id": "existing-alert",
            "alert_key": "source_sync:old:source:resource",
            "category": "source_sync",
            "status": "active",
        }
    ]

    original_get_rag_write_client = source_sync_health_mod.get_rag_write_client
    source_sync_health_mod.get_rag_write_client = lambda: supabase
    try:
        result = persist_source_sync_alerts(supabase, [], resolve_missing=False)
    finally:
        source_sync_health_mod.get_rag_write_client = original_get_rag_write_client

    assert result == {"upserted": 0, "resolved": 0, "notified": []}
    assert supabase.tables["system_alerts"][0]["status"] == "active"


def test_persist_source_sync_alerts_throttles_repeat_notifications(monkeypatch):
    """reserve_notifications must fire once per alert, then throttle re-nags.

    Regression guard for the 'RAG pipeline health is degraded' Teams flood: the
    source-rag health cron ran every few minutes and posted the same alert set on
    every degraded run. With the notified_at reservation, the same active alert is
    only eligible again after RAG_HEALTH_RENOTIFY_HOURS.
    """
    supabase = _FakeSupabase()
    _seed_empty_tables(supabase)

    alert = {
        "severity": "critical",
        "code": "source_sync_error",
        "source": "outlook_email",
        "resourceId": "awehner@alleatogroup.com",
        "message": "Outlook delta cursor must use the canonical format.",
        "detectedAt": "2026-07-22T00:00:00+00:00",
    }

    base = datetime(2026, 7, 22, 0, 0, tzinfo=timezone.utc)
    clock = {"now": base}
    monkeypatch.setattr(source_sync_health_mod, "_utcnow", lambda: clock["now"])

    original = source_sync_health_mod.get_rag_write_client
    source_sync_health_mod.get_rag_write_client = lambda: supabase
    try:
        first = persist_source_sync_alerts(supabase, [alert], reserve_notifications=True)

        # 5 minutes later — same alert still active, must be throttled.
        clock["now"] = base + timedelta(minutes=5)
        second = persist_source_sync_alerts(supabase, [alert], reserve_notifications=True)

        # Past the re-nag window — eligible to notify again.
        clock["now"] = base + timedelta(hours=source_sync_health_mod.RAG_HEALTH_RENOTIFY_HOURS, minutes=1)
        third = persist_source_sync_alerts(supabase, [alert], reserve_notifications=True)
    finally:
        source_sync_health_mod.get_rag_write_client = original

    alert_key = "source_sync:source_sync_error:outlook_email:awehner@alleatogroup.com"
    assert first["notified"] == [alert_key]
    assert second["notified"] == []
    assert third["notified"] == [alert_key]


def test_persist_source_sync_alerts_does_not_reserve_by_default():
    """Non-notifying callers must never stamp notified_at (no reservation)."""
    supabase = _FakeSupabase()
    _seed_empty_tables(supabase)

    original = source_sync_health_mod.get_rag_write_client
    source_sync_health_mod.get_rag_write_client = lambda: supabase
    try:
        result = persist_source_sync_alerts(
            supabase,
            [
                {
                    "severity": "warning",
                    "code": "embedding_backlog",
                    "source": "vectorization",
                    "resourceId": "document_chunks",
                    "message": "Backlog detected.",
                    "detectedAt": "2026-07-22T00:00:00+00:00",
                }
            ],
        )
    finally:
        source_sync_health_mod.get_rag_write_client = original

    assert result["notified"] == []
    assert supabase.tables["system_alerts"][0].get("notified_at") is None
