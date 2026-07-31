from src.services.integrations.microsoft_graph import teams
from src.services.supabase_helpers import SupabaseRagStore as _RealSupabaseRagStore


class _Result:
    def __init__(self, data):
        self.data = data


class _StorageBucket:
    def __init__(self):
        self.uploads = []

    def upload(self, path, content, options):
        self.uploads.append((path, content, options))
        return _Result({"path": path})


class _Storage:
    def __init__(self):
        self.bucket = _StorageBucket()

    def from_(self, _bucket_name):
        return self.bucket


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

    def insert(self, payload):
        self.action = "insert"
        self.payload = payload
        return self

    def update(self, payload):
        self.action = "update"
        self.payload = payload
        return self

    def upsert(self, payload, **_kwargs):
        self.action = "upsert"
        self.payload = payload
        return self

    def eq(self, key, value):
        self.rows = [row for row in self.rows if row.get(key) == value]
        return self

    def single(self):
        return self

    def execute(self):
        table = self.db.tables.setdefault(self.table_name, [])
        if self.action == "insert":
            table.append(dict(self.payload))
            return _Result([dict(self.payload)])
        if self.action == "update":
            matching_ids = {id(row) for row in self.rows}
            updated = []
            for row in table:
                if id(row) in matching_ids:
                    row.update(self.payload)
                    updated.append(dict(row))
            return _Result(updated)
        if self.action == "upsert":
            payloads = self.payload if isinstance(self.payload, list) else [self.payload]
            upserted = []
            for payload in payloads:
                existing = None
                for key in ("id", "chunk_id"):
                    value = payload.get(key)
                    if value is not None:
                        existing = next((row for row in table if row.get(key) == value), None)
                    if existing is not None:
                        break
                if existing is None:
                    table.append(dict(payload))
                    upserted.append(dict(payload))
                else:
                    existing.update(payload)
                    upserted.append(dict(existing))
            return _Result(upserted)
        if self.rows and len(self.rows) == 1:
            return _Result(dict(self.rows[0]))
        return _Result([dict(row) for row in self.rows])


class _FakeSupabase:
    def __init__(self):
        self.tables = {}
        self.storage = _Storage()

    def from_(self, table_name):
        return _TableQuery(self, table_name)

    def table(self, table_name):
        return self.from_(table_name)


class _FakeRagStore:
    def __init__(self, client):
        self.store = _RealSupabaseRagStore(client, rag_client=client)

    def upsert_document_metadata(self, payload):
        return self.store.upsert_document_metadata(payload)


class _FakeGraph:
    GRAPH_BASE = "https://graph.microsoft.com/v1.0"

    def __init__(self):
        self.calls = []

    def is_configured(self):
        return True

    def get(self, url, params=None):
        self.calls.append((url, params))
        assert "/chats/getAllMessages" in url
        assert "/chats/chat-1/messages" not in url
        return {
            "value": [
                {
                    "id": "msg-1",
                    "messageType": "message",
                    "chatId": "chat-1",
                    "createdDateTime": "2026-05-06T13:00:00Z",
                    "lastModifiedDateTime": "2026-05-06T13:00:01Z",
                    "from": {"user": {"displayName": "Andrew Cannon", "mail": "acannon@alleatogroup.com"}},
                    "body": {"content": "Westfield owner billing needs the lien waivers sent today."},
                }
            ]
        }


def test_sync_user_chat_messages_uses_user_export_endpoint(monkeypatch):
    supabase = _FakeSupabase()
    graph = _FakeGraph()
    monkeypatch.setattr(teams, "get_graph_client", lambda: graph)
    monkeypatch.setattr(teams, "_now_graph_iso", lambda: "2026-05-06T14:00:00.000Z")
    monkeypatch.setattr(
        teams,
        "get_user_chats",
        lambda _user_email: [
            {
                "id": "chat-1",
                "display_name": "Andrew Cannon, Fatima Njie",
                "member_names": ["Andrew Cannon <acannon@alleatogroup.com>", "Fatima Njie"],
            }
        ],
    )
    monkeypatch.setattr(teams, "infer_project_id", lambda *_args, **_kwargs: (None, "none", 0.0))
    monkeypatch.setattr(teams, "SupabaseRagStore", _FakeRagStore)
    monkeypatch.setattr(teams, "get_rag_write_client", lambda: supabase)

    count, new_ts = teams.sync_user_chat_messages(
        supabase,
        "acannon@alleatogroup.com",
        "2026-05-06T12:00:00Z",
    )

    assert count == 1
    assert new_ts == "2026-05-06T14:00:00.000Z"
    url, params = graph.calls[0]
    assert url == "https://graph.microsoft.com/v1.0/users/acannon@alleatogroup.com/chats/getAllMessages"
    assert params["$filter"] == (
        "lastModifiedDateTime gt 2026-05-06T12:00:00.000Z "
        "and lastModifiedDateTime lt 2026-05-06T14:00:00.000Z"
    )
    row = supabase.tables["document_metadata"][0]
    assert row["type"] == "teams_dm_conversation"
    assert row["source_system"] == "teams_dm"
    assert row["storage_bucket"] == "documents"
    assert row["status"] == "skipped_low_content"
    assert row["source_metadata"]["document_kind"] == "teams_dm_conversation"
    assert "Andrew Cannon" in row["participants"]
    rag_row = supabase.tables["rag_document_metadata"][0]
    assert rag_row["id"] == row["id"]
    assert rag_row["embedding_status"] is None
    assert rag_row["storage_bucket"] == "documents"
    assert rag_row["storage_path"] == "teams/chats/chat-1/2026-05-06.txt"
    assert "Westfield owner billing" in rag_row["content"]


def test_process_teams_channel_thread_persists_replay_metadata(monkeypatch):
    supabase = _FakeSupabase()

    class _Graph:
        def get_all_pages(self, path):
            assert path == "/teams/team-1/channels/channel-1/messages/root-1/replies"
            return [
                {
                    "id": "reply-1",
                    "messageType": "message",
                    "createdDateTime": "2026-05-06T13:05:00Z",
                    "from": {"user": {"displayName": "Fatima Njie", "mail": "fatima@example.com"}},
                    "body": {"content": "The owner approved the updated site logistics plan."},
                }
            ]

    monkeypatch.setattr(teams, "infer_project_id", lambda *_args, **_kwargs: (None, "none", 0.0))
    monkeypatch.setattr(teams, "SupabaseRagStore", _FakeRagStore)
    monkeypatch.setattr(teams, "get_rag_write_client", lambda: supabase)

    teams._process_teams_message(
        supabase,
        _Graph(),
        {
            "id": "root-1",
            "messageType": "message",
            "createdDateTime": "2026-05-06T13:00:00Z",
            "from": {"user": {"displayName": "Andrew Cannon", "mail": "andrew@example.com"}},
            "body": {"content": "Please confirm the Westfield site logistics plan before noon."},
        },
        "team-1",
        "Operations",
        "channel-1",
        "General",
    )

    row = supabase.tables["document_metadata"][0]
    assert row["id"] == "teams_root-1"
    assert row["source_system"] == "teams"
    assert row["type"] == "teams_message"
    assert row["storage_bucket"] == "documents"
    assert row["source_metadata"] == {
        "document_kind": "teams_channel_thread",
        "team_id": "team-1",
        "team_name": "Operations",
        "channel_id": "channel-1",
        "channel_name": "General",
        "root_message_id": "root-1",
        "message_count": 2,
    }
    rag_row = supabase.tables["rag_document_metadata"][0]
    assert rag_row["id"] == row["id"]
    assert rag_row["embedding_status"] is None
    assert rag_row["storage_bucket"] == "documents"
    assert rag_row["storage_path"] == "teams/team-1/channel-1/root-1.txt"
    assert "Westfield site logistics" in rag_row["content"]
