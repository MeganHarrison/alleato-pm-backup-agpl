import pytest

from src.services.integrations.microsoft_graph import outlook_conversations as conversations


def _row(**overrides):
    base = {
        "id": 1,
        "graph_message_id": "message-1",
        "mailbox_user_id": "megan@example.com",
        "conversation_id": "conversation-1",
        "subject": "RE: Permit package",
        "body_text": "Can you send the latest permit package?",
        "from_name": "Megan",
        "from_email": "megan@example.com",
        "to_list": ["sarah@example.com"],
        "cc_list": [],
        "project_id": 876,
        "received_at": "2026-07-06T13:00:00Z",
        "web_link": "https://outlook.office.com/message-1",
        "deleted_at": None,
    }
    base.update(overrides)
    return base


def test_compile_conversation_payload_builds_stable_email_document():
    rows = [
        _row(
            id=2,
            graph_message_id="message-2",
            from_name="Sarah",
            from_email="sarah@example.com",
            to_list=["megan@example.com"],
            body_text="Yes, the permit package is attached.",
            received_at="2026-07-06T13:10:00Z",
            web_link="https://outlook.office.com/message-2",
        ),
        _row(id=1, received_at="2026-07-06T13:00:00Z"),
    ]

    payload = conversations.compile_conversation_payload(rows)

    assert payload["id"].startswith("outlook_conversation_")
    assert payload["type"] == "email"
    assert payload["category"] == "email"
    assert payload["document_type"] == "email_message"
    assert payload["source"] == "microsoft_graph"
    assert payload["source_system"] == "outlook"
    assert payload["source_item_id"] == "conversation:conversation-1"
    assert payload["status"] == "raw_ingested"
    assert payload["project_id"] == 876
    assert payload["source_web_url"] == "https://outlook.office.com/message-2"
    assert payload["source_metadata"]["message_count"] == 2
    assert payload["source_metadata"]["document_kind"] == "outlook_conversation"
    assert payload["source_metadata"]["source_message_ids"] == ["message-1", "message-2"]
    assert payload["source_metadata"]["content_hash"] == payload["content_hash"]
    assert payload["content"].index("2026-07-06T13:00:00Z") < payload["content"].index(
        "2026-07-06T13:10:00Z"
    )


def test_compile_conversation_payload_fails_loudly_on_project_conflict():
    rows = [
        _row(id=1, project_id=178),
        _row(id=2, graph_message_id="message-2", project_id=31),
    ]

    with pytest.raises(ValueError, match="projects 31, 178"):
        conversations.compile_conversation_payload(rows)


def test_compile_outlook_conversations_skips_unchanged_hash(monkeypatch):
    rows = [_row(id=1), _row(id=2, graph_message_id="message-2", received_at="2026-07-06T13:10:00Z")]
    expected = conversations.compile_conversation_payload(rows)
    documents = []

    class _Store:
        def __init__(self, _client):
            pass

        def fetch_rag_document_metadata(self, _document_id):
            return {"content_hash": expected["content_hash"], "content": expected["content"]}

        def upsert_document_metadata(self, payload):
            documents.append(payload)

    monkeypatch.setattr(conversations, "_fetch_recent_rows", lambda **_kwargs: [rows[-1]])
    monkeypatch.setattr(conversations, "_fetch_conversation_rows", lambda **_kwargs: rows)
    monkeypatch.setattr(conversations, "SupabaseRagStore", _Store)

    result = conversations.compile_outlook_conversations(object(), mailbox_user_id="megan@example.com")

    assert result["status"] == "complete"
    assert result["conversations_seen"] == 1
    assert result["compiled"] == 0
    assert result["unchanged"] == 1
    assert documents == []


def test_compile_outlook_conversations_upserts_changed_document(monkeypatch):
    rows = [_row(id=1), _row(id=2, graph_message_id="message-2", received_at="2026-07-06T13:10:00Z")]
    documents = []

    class _Store:
        def __init__(self, _client):
            pass

        def fetch_rag_document_metadata(self, _document_id):
            return None

        def upsert_document_metadata(self, payload):
            documents.append(payload)

    monkeypatch.setattr(conversations, "_fetch_recent_rows", lambda **_kwargs: [rows[-1], rows[0]])
    monkeypatch.setattr(conversations, "_fetch_conversation_rows", lambda **_kwargs: rows)
    monkeypatch.setattr(conversations, "SupabaseRagStore", _Store)

    result = conversations.compile_outlook_conversations(object(), mailbox_user_id="megan@example.com")

    assert result["status"] == "complete"
    assert result["conversations_seen"] == 1
    assert result["compiled"] == 1
    assert result["documents"][0]["id"] == documents[0]["id"]
    assert documents[0]["source_metadata"]["compiled_from"] == "outlook_email_intake"


def test_compile_outlook_conversations_repairs_missing_content_even_when_hash_matches(monkeypatch):
    rows = [_row(id=1)]
    expected = conversations.compile_conversation_payload(rows)
    documents = []

    class _Store:
        def __init__(self, _client):
            pass

        def fetch_rag_document_metadata(self, _document_id):
            return {"content_hash": expected["content_hash"], "content": None, "raw_text": None}

        def upsert_document_metadata(self, payload):
            documents.append(payload)

    monkeypatch.setattr(conversations, "_fetch_recent_rows", lambda **_kwargs: rows)
    monkeypatch.setattr(conversations, "_fetch_conversation_rows", lambda **_kwargs: rows)
    monkeypatch.setattr(conversations, "SupabaseRagStore", _Store)

    result = conversations.compile_outlook_conversations(object(), mailbox_user_id="megan@example.com")

    assert result["status"] == "complete"
    assert result["compiled"] == 1
    assert documents[0]["content"] == expected["content"]
