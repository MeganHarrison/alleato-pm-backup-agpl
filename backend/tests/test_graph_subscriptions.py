from datetime import datetime, timedelta, timezone

import src.services.integrations.microsoft_graph.subscriptions as subscriptions_mod
from src.services.integrations.microsoft_graph import subscriptions


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

    def select(self, *_args):
        self.action = "select"
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

    def limit(self, _value):
        return self

    def execute(self):
        table = self.db.tables.setdefault(self.table_name, [])
        if self.action == "upsert":
            for row in table:
                if (
                    row.get("source") == self.payload.get("source")
                    and row.get("resource_id") == self.payload.get("resource_id")
                ):
                    row.update(self.payload)
                    return _Result([dict(row)])
            row = dict(self.payload)
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
        return _Result([dict(row) for row in self.rows])


class _FakeSupabase:
    def __init__(self):
        self.tables = {}

    def table(self, table_name):
        return _TableQuery(self, table_name)


def _route_graph_subscriptions_to_fake_rag(supabase):
    original_read = subscriptions_mod.get_rag_read_client
    original_write = subscriptions_mod.get_rag_write_client
    subscriptions_mod.get_rag_read_client = lambda: supabase
    subscriptions_mod.get_rag_write_client = lambda: supabase
    return original_read, original_write


def _restore_graph_subscriptions_clients(original_read, original_write):
    subscriptions_mod.get_rag_read_client = original_read
    subscriptions_mod.get_rag_write_client = original_write


class _FakeGraph:
    def __init__(self):
        self.posts = []
        self.patches = []
        self.deletes = []
        self.delete_error = None

    def post(self, path, payload):
        self.posts.append((path, payload))
        return {
            "id": "sub-created",
            "expirationDateTime": payload["expirationDateTime"],
        }

    def patch(self, path, payload):
        self.patches.append((path, payload))
        return {"expirationDateTime": payload["expirationDateTime"]}

    def delete(self, path):
        self.deletes.append(path)
        if self.delete_error:
            raise self.delete_error


def test_configured_subscription_targets_from_mailboxes(monkeypatch):
    monkeypatch.setenv("MICROSOFT_SYNC_USERS", "a@example.com, b@example.com")
    monkeypatch.delenv("GRAPH_SUBSCRIBE_TEAMS_TENANT", raising=False)
    monkeypatch.delenv("GRAPH_SUBSCRIBE_TEAMS_CHAT_TENANT", raising=False)
    monkeypatch.delenv("GRAPH_SUBSCRIBE_ONEDRIVE", raising=False)
    monkeypatch.delenv("GRAPH_SUBSCRIBE_SHAREPOINT_DRIVE_IDS", raising=False)

    targets = subscriptions.configured_subscription_targets()

    assert [target.resource for target in targets] == [
        "users/a@example.com/mailFolders('inbox')/messages",
        "users/b@example.com/mailFolders('inbox')/messages",
    ]


def test_configured_subscription_targets_include_opt_in_teams_and_drive_targets(monkeypatch):
    monkeypatch.setenv("MICROSOFT_SYNC_USERS", "a@example.com")
    monkeypatch.setenv("GRAPH_SUBSCRIBE_TEAMS_TENANT", "true")
    monkeypatch.setenv("GRAPH_SUBSCRIBE_TEAMS_CHAT_TENANT", "true")
    monkeypatch.setenv("GRAPH_SUBSCRIBE_ONEDRIVE", "true")
    monkeypatch.setenv("GRAPH_SUBSCRIBE_SHAREPOINT_DRIVE_IDS", "drive-1, drive-2")

    targets = subscriptions.configured_subscription_targets()
    resources = {target.resource: target for target in targets}

    assert "users/a@example.com/mailFolders('inbox')/messages" in resources
    assert "teams/getAllMessages" in resources
    assert "chats/getAllMessages" in resources
    assert "users/a@example.com/drive/root" in resources
    assert "drives/drive-1/root" in resources
    assert "drives/drive-2/root" in resources
    assert resources["teams/getAllMessages"].max_expiration_hours == 1
    assert resources["chats/getAllMessages"].max_expiration_hours == 1


def test_configured_subscription_targets_can_opt_into_whole_mailbox(monkeypatch):
    monkeypatch.setenv("MICROSOFT_SYNC_USERS", "a@example.com")
    monkeypatch.setenv("GRAPH_SUBSCRIBE_OUTLOOK_SCOPE", "all")
    monkeypatch.delenv("GRAPH_SUBSCRIBE_TEAMS_TENANT", raising=False)
    monkeypatch.delenv("GRAPH_SUBSCRIBE_TEAMS_CHAT_TENANT", raising=False)
    monkeypatch.delenv("GRAPH_SUBSCRIBE_ONEDRIVE", raising=False)
    monkeypatch.delenv("GRAPH_SUBSCRIBE_SHAREPOINT_DRIVE_IDS", raising=False)

    targets = subscriptions.configured_subscription_targets()

    assert [target.resource for target in targets] == ["users/a@example.com/messages"]


def test_ensure_subscriptions_caps_target_expiration(monkeypatch):
    monkeypatch.setenv("GRAPH_WEBHOOK_NOTIFICATION_URL", "https://example.com/api/graph/webhooks/notifications")
    monkeypatch.setenv("GRAPH_WEBHOOK_CLIENT_STATE", "state-1")
    supabase = _FakeSupabase()
    graph = _FakeGraph()
    target = subscriptions.GraphSubscriptionTarget(
        source="teams_message",
        resource_id="tenant:teams_channel_messages",
        resource_name="Teams tenant channel messages",
        resource="teams/getAllMessages",
        change_type="created,updated",
        max_expiration_hours=1,
    )

    original_read, original_write = _route_graph_subscriptions_to_fake_rag(supabase)
    try:
        subscriptions.ensure_subscriptions(
            supabase,
            targets=[target],
            graph=graph,
            expiration_hours=48,
        )
    finally:
        _restore_graph_subscriptions_clients(original_read, original_write)

    expiration = datetime.fromisoformat(
        graph.posts[0][1]["expirationDateTime"].replace("Z", "+00:00")
    )
    delta_seconds = (expiration - datetime.now(timezone.utc)).total_seconds()
    assert 0 < delta_seconds <= 3700


def test_ensure_subscriptions_creates_missing_subscription(monkeypatch):
    monkeypatch.setenv("GRAPH_WEBHOOK_NOTIFICATION_URL", "https://example.com/api/graph/webhooks/notifications")
    monkeypatch.setenv("GRAPH_WEBHOOK_CLIENT_STATE", "state-1")
    supabase = _FakeSupabase()
    graph = _FakeGraph()
    target = subscriptions.GraphSubscriptionTarget(
        source="outlook_email",
        resource_id="a@example.com",
        resource_name="Outlook: a@example.com",
        resource="users/a@example.com/messages",
        change_type="created,updated",
    )

    original_read, original_write = _route_graph_subscriptions_to_fake_rag(supabase)
    try:
        result = subscriptions.ensure_subscriptions(supabase, targets=[target], graph=graph)
    finally:
        _restore_graph_subscriptions_clients(original_read, original_write)

    assert result["created"] == 1
    assert graph.posts[0][0] == "/subscriptions"
    stored = supabase.tables["graph_subscriptions"][0]
    assert stored["graph_subscription_id"] == "sub-created"
    assert stored["status"] == "active"
    assert stored["resource"] == "users/a@example.com/messages"


def test_ensure_subscriptions_recreates_subscription_when_resource_drifts(monkeypatch):
    monkeypatch.setenv("GRAPH_WEBHOOK_NOTIFICATION_URL", "https://example.com/api/graph/webhooks/notifications")
    monkeypatch.setenv("GRAPH_WEBHOOK_CLIENT_STATE", "state-1")
    supabase = _FakeSupabase()
    supabase.tables["graph_subscriptions"] = [
        {
            "source": "outlook_email",
            "resource_id": "a@example.com",
            "graph_subscription_id": "sub-old",
            "resource": "users/a@example.com/messages",
            "expiration_at": (datetime.now(timezone.utc) + timedelta(hours=40)).isoformat(),
            "status": "active",
        }
    ]
    graph = _FakeGraph()
    target = subscriptions.GraphSubscriptionTarget(
        source="outlook_email",
        resource_id="a@example.com",
        resource_name="Outlook: a@example.com",
        resource="users/a@example.com/mailFolders('inbox')/messages",
        change_type="created,updated",
    )

    original_read, original_write = _route_graph_subscriptions_to_fake_rag(supabase)
    try:
        result = subscriptions.ensure_subscriptions(supabase, targets=[target], graph=graph)
    finally:
        _restore_graph_subscriptions_clients(original_read, original_write)

    assert result["created"] == 1
    assert graph.deletes == ["/subscriptions/sub-old"]
    assert graph.posts[0][1]["resource"] == "users/a@example.com/mailFolders('inbox')/messages"
    assert supabase.tables["graph_subscriptions"][0]["graph_subscription_id"] == "sub-created"
    assert supabase.tables["graph_subscriptions"][0]["resource"] == "users/a@example.com/mailFolders('inbox')/messages"


def test_ensure_subscriptions_renews_expiring_subscription(monkeypatch):
    monkeypatch.setenv("GRAPH_WEBHOOK_NOTIFICATION_URL", "https://example.com/api/graph/webhooks/notifications")
    monkeypatch.setenv("GRAPH_WEBHOOK_CLIENT_STATE", "state-1")
    supabase = _FakeSupabase()
    soon = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    supabase.tables["graph_subscriptions"] = [
        {
            "source": "outlook_email",
            "resource_id": "a@example.com",
            "graph_subscription_id": "sub-existing",
            "expiration_at": soon,
            "status": "active",
        }
    ]
    graph = _FakeGraph()
    target = subscriptions.GraphSubscriptionTarget(
        source="outlook_email",
        resource_id="a@example.com",
        resource_name="Outlook: a@example.com",
        resource="users/a@example.com/messages",
        change_type="created,updated",
    )

    original_read, original_write = _route_graph_subscriptions_to_fake_rag(supabase)
    try:
        result = subscriptions.ensure_subscriptions(supabase, targets=[target], graph=graph)
    finally:
        _restore_graph_subscriptions_clients(original_read, original_write)

    assert result["renewed"] == 1
    assert graph.patches[0][0] == "/subscriptions/sub-existing"
    assert supabase.tables["graph_subscriptions"][0]["status"] == "active"


def test_ensure_subscriptions_recreates_expired_reauthorization_subscription(monkeypatch):
    monkeypatch.setenv("GRAPH_WEBHOOK_NOTIFICATION_URL", "https://example.com/api/graph/webhooks/notifications")
    monkeypatch.setenv("GRAPH_WEBHOOK_CLIENT_STATE", "state-1")
    supabase = _FakeSupabase()
    expired = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    supabase.tables["graph_subscriptions"] = [
        {
            "source": "outlook_email",
            "resource_id": "a@example.com",
            "graph_subscription_id": "sub-expired",
            "resource": "users/a@example.com/mailFolders('inbox')/messages",
            "expiration_at": expired,
            "status": "renewal_due",
            "last_error_message": "Microsoft Graph lifecycle event: reauthorizationRequired",
        }
    ]
    graph = _FakeGraph()
    target = subscriptions.GraphSubscriptionTarget(
        source="outlook_email",
        resource_id="a@example.com",
        resource_name="Outlook: a@example.com",
        resource="users/a@example.com/mailFolders('inbox')/messages",
        change_type="created,updated",
    )

    original_read, original_write = _route_graph_subscriptions_to_fake_rag(supabase)
    try:
        result = subscriptions.ensure_subscriptions(supabase, targets=[target], graph=graph)
    finally:
        _restore_graph_subscriptions_clients(original_read, original_write)

    assert result["created"] == 1
    assert result["renewed"] == 0
    assert graph.patches == []
    assert graph.deletes == ["/subscriptions/sub-expired"]
    assert graph.posts[0][0] == "/subscriptions"
    assert supabase.tables["graph_subscriptions"][0]["graph_subscription_id"] == "sub-created"
    assert supabase.tables["graph_subscriptions"][0]["status"] == "active"


def test_ensure_subscriptions_creates_fresh_when_stale_delete_fails(monkeypatch):
    monkeypatch.setenv("GRAPH_WEBHOOK_NOTIFICATION_URL", "https://example.com/api/graph/webhooks/notifications")
    monkeypatch.setenv("GRAPH_WEBHOOK_CLIENT_STATE", "state-1")
    supabase = _FakeSupabase()
    expired = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    supabase.tables["graph_subscriptions"] = [
        {
            "source": "outlook_email",
            "resource_id": "a@example.com",
            "graph_subscription_id": "sub-expired",
            "resource": "users/a@example.com/mailFolders('inbox')/messages",
            "expiration_at": expired,
            "status": "renewal_due",
        }
    ]
    graph = _FakeGraph()
    graph.delete_error = RuntimeError("subscription was not found")
    target = subscriptions.GraphSubscriptionTarget(
        source="outlook_email",
        resource_id="a@example.com",
        resource_name="Outlook: a@example.com",
        resource="users/a@example.com/mailFolders('inbox')/messages",
        change_type="created,updated",
    )

    original_read, original_write = _route_graph_subscriptions_to_fake_rag(supabase)
    try:
        result = subscriptions.ensure_subscriptions(supabase, targets=[target], graph=graph)
    finally:
        _restore_graph_subscriptions_clients(original_read, original_write)

    assert result["created"] == 1
    assert result["failed"] == 0
    assert graph.deletes == ["/subscriptions/sub-expired"]
    assert graph.posts[0][0] == "/subscriptions"
    assert supabase.tables["graph_subscriptions"][0]["graph_subscription_id"] == "sub-created"


def test_ensure_subscriptions_marks_out_of_config_rows_removed(monkeypatch):
    monkeypatch.setenv("GRAPH_WEBHOOK_NOTIFICATION_URL", "https://example.com/api/graph/webhooks/notifications")
    monkeypatch.setenv("GRAPH_WEBHOOK_CLIENT_STATE", "state-1")
    supabase = _FakeSupabase()
    supabase.tables["graph_subscriptions"] = [
        {
            "source": "outlook_email",
            "resource_id": "stale@example.com",
            "graph_subscription_id": "sub-stale",
            "resource": "users/stale@example.com/mailFolders('inbox')/messages",
            "expiration_at": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat(),
            "status": "renewal_due",
            "last_error_message": "Microsoft Graph lifecycle event: reauthorizationRequired",
        }
    ]
    graph = _FakeGraph()
    target = subscriptions.GraphSubscriptionTarget(
        source="outlook_email",
        resource_id="active@example.com",
        resource_name="Outlook: active@example.com",
        resource="users/active@example.com/mailFolders('inbox')/messages",
        change_type="created,updated",
    )

    original_read, original_write = _route_graph_subscriptions_to_fake_rag(supabase)
    try:
        result = subscriptions.ensure_subscriptions(supabase, targets=[target], graph=graph)
    finally:
        _restore_graph_subscriptions_clients(original_read, original_write)

    assert result["stale_removed"] == 1
    stale_row = next(row for row in supabase.tables["graph_subscriptions"] if row["resource_id"] == "stale@example.com")
    assert stale_row["status"] == "removed"
    assert stale_row["last_error_message"] is None
    assert stale_row["metadata"]["removal_reason"] == "not_in_configured_subscription_targets"
    active_row = next(row for row in supabase.tables["graph_subscriptions"] if row["resource_id"] == "active@example.com")
    assert active_row["status"] == "active"


def test_ensure_subscriptions_does_not_recount_already_removed_stale_rows(monkeypatch):
    monkeypatch.setenv("GRAPH_WEBHOOK_NOTIFICATION_URL", "https://example.com/api/graph/webhooks/notifications")
    monkeypatch.setenv("GRAPH_WEBHOOK_CLIENT_STATE", "state-1")
    supabase = _FakeSupabase()
    supabase.tables["graph_subscriptions"] = [
        {
            "source": "outlook_email",
            "resource_id": "stale@example.com",
            "status": "removed",
            "metadata": {"removal_reason": "not_in_configured_subscription_targets"},
        }
    ]
    graph = _FakeGraph()
    target = subscriptions.GraphSubscriptionTarget(
        source="outlook_email",
        resource_id="active@example.com",
        resource_name="Outlook: active@example.com",
        resource="users/active@example.com/mailFolders('inbox')/messages",
        change_type="created,updated",
    )

    original_read, original_write = _route_graph_subscriptions_to_fake_rag(supabase)
    try:
        result = subscriptions.ensure_subscriptions(supabase, targets=[target], graph=graph)
    finally:
        _restore_graph_subscriptions_clients(original_read, original_write)

    assert result["stale_removed"] == 0
    assert supabase.tables["graph_subscriptions"][0]["status"] == "removed"


def test_delete_subscription_marks_removed():
    supabase = _FakeSupabase()
    supabase.tables["graph_subscriptions"] = [
        {"graph_subscription_id": "sub-existing", "status": "active"}
    ]
    graph = _FakeGraph()

    original_read, original_write = _route_graph_subscriptions_to_fake_rag(supabase)
    try:
        result = subscriptions.delete_subscription(
            supabase,
            graph_subscription_id="sub-existing",
            graph=graph,
        )
    finally:
        _restore_graph_subscriptions_clients(original_read, original_write)

    assert result["status"] == "removed"
    assert graph.deletes == ["/subscriptions/sub-existing"]
    assert supabase.tables["graph_subscriptions"][0]["status"] == "removed"
