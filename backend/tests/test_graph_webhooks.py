import src.services.integrations.microsoft_graph.webhooks as webhooks_mod
import src.services.health.source_sync_health as source_sync_health_mod
from src.services.integrations.microsoft_graph.ingestion_control import (
    graph_ingestion_disabled_reason,
)
from src.services.integrations.microsoft_graph import webhooks


class _Result:
    def __init__(self, data):
        self.data = data


class _TableQuery:
    def __init__(self, db, table_name):
        self.db = db
        self.table_name = table_name
        self.payload = None
        self.action = "select"
        self.rows = list(db.tables.setdefault(table_name, []))

    def insert(self, payload):
        self.action = "insert"
        self.payload = payload
        return self

    def update(self, payload):
        self.action = "update"
        self.payload = payload
        return self

    def eq(self, key, value):
        self.rows = [row for row in self.rows if row.get(key) == value]
        return self

    def limit(self, _value):
        return self

    def select(self, *_args, **_kwargs):
        return self

    def execute(self):
        table = self.db.tables.setdefault(self.table_name, [])
        if self.action == "select":
            return _Result([dict(row) for row in self.rows])
        if self.action == "update":
            updated = []
            matching_ids = {id(row) for row in self.rows}
            for row in table:
                if id(row) in matching_ids:
                    row.update(self.payload)
                    updated.append(dict(row))
            return _Result(updated)
        row = dict(self.payload)
        table.append(row)
        return _Result([row])


class _FakeSupabase:
    def __init__(self):
        self.tables = {}

    def table(self, table_name):
        return _TableQuery(self, table_name)

    def from_(self, table_name):
        return self.table(table_name)


def _route_graph_subscriptions_to_fake_rag(supabase):
    original_read = webhooks_mod.get_rag_read_client
    original_write = webhooks_mod.get_rag_write_client
    original_health_write = source_sync_health_mod.get_rag_write_client
    webhooks_mod.get_rag_read_client = lambda: supabase
    webhooks_mod.get_rag_write_client = lambda: supabase
    source_sync_health_mod.get_rag_write_client = lambda: supabase
    return original_read, original_write, original_health_write


def _restore_graph_subscriptions_clients(original_read, original_write, original_health_write):
    webhooks_mod.get_rag_read_client = original_read
    webhooks_mod.get_rag_write_client = original_write
    source_sync_health_mod.get_rag_write_client = original_health_write


def test_validation_token_returns_plain_text(client):
    response = client.post(
        "/api/graph/webhooks/notifications?validationToken=plain-token-123",
    )

    assert response.status_code == 200
    assert response.text == "plain-token-123"
    assert response.headers["content-type"].startswith("text/plain")


def test_lifecycle_validation_token_returns_plain_text(client):
    response = client.post(
        "/api/graph/webhooks/lifecycle?validationToken=lifecycle-token-123",
    )

    assert response.status_code == 200
    assert response.text == "lifecycle-token-123"
    assert response.headers["content-type"].startswith("text/plain")


def test_webhook_notifications_do_not_write_when_webhook_drain_disabled(client, monkeypatch):
    monkeypatch.setenv("BACKEND_API_ONLY", "true")
    monkeypatch.delenv("GRAPH_API_INGESTION_ENABLED", raising=False)
    monkeypatch.setenv("GRAPH_WEBHOOK_DRAIN_ENABLED", "false")
    monkeypatch.setenv("GRAPH_WEBHOOK_CLIENT_STATE", "expected-state")

    response = client.post(
        "/api/graph/webhooks/notifications",
        json={
            "value": [
                {
                    "subscriptionId": "sub-1",
                    "clientState": "expected-state",
                    "changeType": "created",
                    "resource": "users/a@example.com/messages/message-1",
                    "resourceData": {"id": "message-1"},
                }
            ]
        },
    )

    assert response.status_code == 200
    assert response.json()["status"] == "disabled"
    assert response.json()["recorded"] == 0
    assert "GRAPH_WEBHOOK_DRAIN_ENABLED=false" in response.json()["reason"]


def test_lifecycle_webhook_does_not_write_when_graph_ingestion_disabled(client, monkeypatch):
    monkeypatch.delenv("BACKEND_API_ONLY", raising=False)
    monkeypatch.setenv("GRAPH_API_INGESTION_ENABLED", "false")
    monkeypatch.setenv("GRAPH_WEBHOOK_CLIENT_STATE", "expected-state")

    response = client.post(
        "/api/graph/webhooks/lifecycle",
        json={
            "value": [
                {
                    "subscriptionId": "sub-removed",
                    "clientState": "expected-state",
                    "tenantId": "tenant-1",
                    "lifecycleEvent": "subscriptionRemoved",
                }
            ]
        },
    )

    assert response.status_code == 200
    assert response.json()["status"] == "disabled"
    assert response.json()["recorded"] == 0
    assert "GRAPH_API_INGESTION_ENABLED=false" in response.json()["reason"]


def test_graph_ingestion_guard_fails_closed_when_backend_api_only(monkeypatch):
    monkeypatch.setenv("BACKEND_API_ONLY", "true")

    assert "BACKEND_API_ONLY=true" in graph_ingestion_disabled_reason()


def test_api_only_mode_does_not_block_webhook_queue_guard(monkeypatch):
    monkeypatch.setenv("BACKEND_API_ONLY", "true")
    monkeypatch.delenv("GRAPH_API_INGESTION_ENABLED", raising=False)
    monkeypatch.delenv("GRAPH_WEBHOOK_DRAIN_ENABLED", raising=False)
    monkeypatch.delenv("GRAPH_SYNC_ENABLED", raising=False)

    assert graph_ingestion_disabled_reason(mode="webhook") is None


def test_handle_graph_notifications_rejects_bad_client_state(monkeypatch):
    monkeypatch.setenv("GRAPH_WEBHOOK_CLIENT_STATE", "expected-state")

    try:
        webhooks.handle_graph_notifications(
            _FakeSupabase(),
            {
                "value": [
                    {
                        "subscriptionId": "sub-1",
                        "clientState": "wrong-state",
                        "resource": "users/a@example.com/messages",
                    }
                ]
            },
        )
    except webhooks.GraphWebhookAuthError as exc:
        assert "clientState" in str(exc)
    else:
        raise AssertionError("bad clientState should fail")


def test_handle_graph_notifications_records_valid_notification(monkeypatch):
    monkeypatch.setenv("GRAPH_WEBHOOK_CLIENT_STATE", "expected-state")
    supabase = _FakeSupabase()
    original_read, original_write, original_health_write = _route_graph_subscriptions_to_fake_rag(supabase)

    try:
        result = webhooks.handle_graph_notifications(
            supabase,
            {
                "value": [
                    {
                        "subscriptionId": "sub-1",
                        "clientState": "expected-state",
                        "changeType": "created,updated",
                        "tenantId": "tenant-1",
                        "resource": "users/a@example.com/messages",
                        "resourceData": {"id": "message-1"},
                    }
                ]
            },
        )
    finally:
        _restore_graph_subscriptions_clients(original_read, original_write, original_health_write)

    assert result == {
        "status": "accepted",
        "notification_count": 1,
        "recorded": 1,
        "queued_mailboxes": 1,
        "queued_realtime": 0,
    }
    row = supabase.tables["source_sync_runs"][0]
    assert row["source"] == "outlook_email"
    assert row["stage"] == "webhook"
    assert row["status"] == "queued"
    assert row["metadata"]["subscription_id"] == "sub-1"
    state_row = supabase.tables["graph_sync_state"][0]
    assert state_row["resource_id"] == "a@example.com"
    assert state_row["sync_status"] == "webhook_pending"


def test_handle_graph_notifications_enqueues_outlook_realtime(monkeypatch):
    monkeypatch.setenv("GRAPH_WEBHOOK_CLIENT_STATE", "expected-state")
    supabase = _FakeSupabase()
    queued = []
    original_read, original_write, original_health_write = _route_graph_subscriptions_to_fake_rag(supabase)

    try:
        result = webhooks.handle_graph_notifications(
            supabase,
            {
                "value": [
                    {
                        "subscriptionId": "sub-1",
                        "clientState": "expected-state",
                        "changeType": "created",
                        "resource": "users/a@example.com/messages/message-1",
                        "resourceData": {"id": "message-1"},
                    }
                ]
            },
            on_realtime_notification=lambda notification: queued.append(notification) or True,
        )
    finally:
        _restore_graph_subscriptions_clients(original_read, original_write, original_health_write)

    assert result["queued_mailboxes"] == 1
    assert result["queued_realtime"] == 1
    assert queued[0]["resource"] == "users/a@example.com/messages/message-1"


def test_webhook_notifications_endpoint_queues_microsoft_assistant_event(client, monkeypatch):
    monkeypatch.delenv("BACKEND_API_ONLY", raising=False)
    monkeypatch.delenv("GRAPH_API_INGESTION_ENABLED", raising=False)
    monkeypatch.delenv("GRAPH_WEBHOOK_DRAIN_ENABLED", raising=False)
    monkeypatch.setenv("GRAPH_WEBHOOK_CLIENT_STATE", "expected-state")
    monkeypatch.setenv("MICROSOFT_EXECUTIVE_ASSISTANT_WEBHOOK_ENABLED", "true")
    supabase = _FakeSupabase()
    original_read, original_write, original_health_write = _route_graph_subscriptions_to_fake_rag(supabase)
    queued_events = []

    monkeypatch.setattr(
        "src.services.supabase_helpers.get_supabase_client",
        lambda: supabase,
    )
    monkeypatch.setattr(
        "src.services.agents.microsoft_executive_assistant.triggers.run_outlook_event_microsoft_executive_assistant",
        lambda *, sync_result: queued_events.append(sync_result)
        or {"status": "completed", "messageId": sync_result.get("message_id")},
    )

    try:
        response = client.post(
            "/api/graph/webhooks/notifications",
            json={
                "value": [
                    {
                        "subscriptionId": "sub-1",
                        "clientState": "expected-state",
                        "changeType": "created",
                        "resource": "users/bclymer@alleatogroup.com/messages/message-1",
                        "resourceData": {"id": "message-1"},
                    }
                ]
            },
        )
    finally:
        _restore_graph_subscriptions_clients(original_read, original_write, original_health_write)

    assert response.status_code == 200
    assert response.json()["queued_mailboxes"] == 1
    assert response.json()["queued_realtime"] == 1
    assert queued_events == [
        {
            "mailbox": "bclymer@alleatogroup.com",
            "message_id": "message-1",
            "subscription_id": "sub-1",
            "change_type": "created",
        }
    ]


def test_handle_graph_lifecycle_marks_subscription_removed(monkeypatch):
    monkeypatch.setenv("GRAPH_WEBHOOK_CLIENT_STATE", "expected-state")
    supabase = _FakeSupabase()
    supabase.tables["graph_subscriptions"] = [
        {"graph_subscription_id": "sub-removed", "status": "active"}
    ]

    original_read, original_write, original_health_write = _route_graph_subscriptions_to_fake_rag(supabase)
    try:
        result = webhooks.handle_graph_lifecycle_notifications(
            supabase,
            {
                "value": [
                    {
                        "subscriptionId": "sub-removed",
                        "clientState": "expected-state",
                        "tenantId": "tenant-1",
                        "lifecycleEvent": "subscriptionRemoved",
                    }
                ]
            },
        )
    finally:
        _restore_graph_subscriptions_clients(original_read, original_write, original_health_write)

    assert result == {"status": "accepted", "notification_count": 1, "recorded": 1}
    assert supabase.tables["graph_subscriptions"][0]["status"] == "removed"
    assert supabase.tables["graph_subscriptions"][0]["last_lifecycle_event_at"]
    row = supabase.tables["source_sync_runs"][0]
    assert row["stage"] == "webhook"
    assert row["status"] == "warning"
    assert row["metadata"]["lifecycle_event"] == "subscriptionRemoved"
