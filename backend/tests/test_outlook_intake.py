from types import SimpleNamespace

import pytest

from services.integrations.microsoft_graph import outlook
from src.services.ingestion.project_assignment import AssignmentTarget


def _route_outlook_intake_clients(monkeypatch, supabase):
    monkeypatch.setattr(outlook, "get_outlook_intake_read_client", lambda: supabase)
    monkeypatch.setattr(outlook, "get_outlook_intake_write_client", lambda: supabase)


class _Result:
    def __init__(self, data=None):
        self.data = data or []


class _Table:
    def __init__(self, store, name):
        self.store = store
        self.name = name
        self.filters = {}
        self.payload = None

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, key, value):
        self.filters[key] = value
        return self

    def gte(self, key, value):
        self.filters[(key, "gte")] = value
        return self

    def is_(self, key, value):
        self.filters[key] = None if value == "null" else value
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def update(self, payload):
        self.payload = payload
        return self

    def insert(self, payload):
        self.payload = payload
        return self

    def upsert(self, payload, **_kwargs):
        self.payload = payload
        return self

    def execute(self):
        rows = self.store.setdefault(self.name, [])
        if self.payload is None:
            matches = [
                row
                for row in rows
                if all(
                    row.get(key[0]) >= value if isinstance(key, tuple) and key[1] == "gte" else row.get(key) == value
                    for key, value in self.filters.items()
                )
            ]
            return _Result(matches)

        if self.filters:
            for row in rows:
                if all(
                    row.get(key[0]) >= value if isinstance(key, tuple) and key[1] == "gte" else row.get(key) == value
                    for key, value in self.filters.items()
                ):
                    row.update(self.payload)
                    return _Result([row])

        row = {"id": len(rows) + 1, **self.payload}
        rows.append(row)
        return _Result([row])


class _Supabase:
    def __init__(self):
        self.store = {}

    def from_(self, name):
        return _Table(self.store, name)

    def table(self, name):
        return self.from_(name)


class _Graph:
    def get(self, *_args, **_kwargs):
        raise AssertionError("attachment already has contentBytes")


class _NoFetchGraph:
    def get(self, *_args, **_kwargs):
        raise AssertionError("large attachment content should not be fetched")


class _DeltaGraph:
    def is_configured(self):
        return True

    def get_delta(self, base_path, _delta_token):
        if "Inbox" not in base_path:
            return [], "sent-token"
        return [
            {
                "id": "message-raw-1",
                "subject": "Project schedule coordination",
                "from": {
                    "emailAddress": {
                        "name": "Walter Allen",
                        "address": "wallen@example.com",
                    }
                },
                "toRecipients": [
                    {
                        "emailAddress": {
                            "name": "Brandon Clymer",
                            "address": "bclymer@alleatogroup.com",
                        }
                    }
                ],
                "ccRecipients": [],
                "receivedDateTime": "2026-06-16T18:00:00Z",
                "bodyPreview": "Please confirm the project schedule coordination path.",
                "body": {
                    "content": "Please confirm the project schedule coordination path for the team."
                },
                "categories": [],
                "importance": "normal",
                "hasAttachments": False,
                "webLink": "https://outlook.office.com/mail/message-raw-1",
                "internetMessageId": "<message-raw-1@example.com>",
                "conversationId": "conversation-raw-1",
                "internetMessageHeaders": [],
            }
        ], "inbox-token"


class _AttachmentListFailureGraph(_DeltaGraph):
    def get_delta(self, base_path, _delta_token):
        rows, token = super().get_delta(base_path, _delta_token)
        for row in rows:
            row["hasAttachments"] = True
        return rows, token

    def get_all_pages(self, *_args, **_kwargs):
        raise TimeoutError("attachment list timed out")


class _AttachmentListCaptureGraph:
    def __init__(self):
        self.calls = []

    def get_all_pages(self, path, params=None, **kwargs):
        self.calls.append({"path": path, "params": params or {}, "kwargs": kwargs})
        return [{"id": "attachment-1", "name": "permit.pdf", "size": 100}]


class _AttachmentDetailCaptureGraph:
    def __init__(self):
        self.calls = []

    def get(self, path, params=None, **kwargs):
        self.calls.append({"path": path, "params": params or {}, "kwargs": kwargs})
        return {"id": "attachment/1=", "contentBytes": "YQ=="}


class _NonProjectFinanceGraph(_DeltaGraph):
    def get_delta(self, base_path, _delta_token):
        if "Inbox" not in base_path:
            return [], "sent-token"
        return [
            {
                "id": "message-finance-1",
                "subject": "Your Venture X Business card statement is ready",
                "from": {
                    "emailAddress": {
                        "name": "Capital One Business",
                        "address": "capitalone@notification.capitalone.com",
                    }
                },
                "toRecipients": [
                    {
                        "emailAddress": {
                            "name": "Brandon Clymer",
                            "address": "bclymer@alleatogroup.com",
                        }
                    }
                ],
                "ccRecipients": [],
                "receivedDateTime": "2026-06-21T16:31:16Z",
                "bodyPreview": "Your business card statement is ready to view online.",
                "body": {
                    "content": (
                        "Your business card statement is ready to view online. "
                        "Please sign in to review account activity and payment options."
                    )
                },
                "categories": [],
                "importance": "normal",
                "hasAttachments": False,
                "webLink": "https://outlook.office.com/mail/message-finance-1",
                "internetMessageId": "<message-finance-1@example.com>",
                "conversationId": "conversation-finance-1",
                "internetMessageHeaders": [],
            }
        ], "inbox-token"


class _LearnedNotProjectRuleGraph(_DeltaGraph):
    def get_delta(self, base_path, _delta_token):
        if "Inbox" not in base_path:
            return [], "sent-token"
        return [
            {
                "id": "message-learned-rule-1",
                "subject": "Portal account setup",
                "from": {
                    "emailAddress": {
                        "name": "Admin Vendor",
                        "address": "billing@adminvendor.com",
                    }
                },
                "toRecipients": [
                    {
                        "emailAddress": {
                            "name": "Brandon Clymer",
                            "address": "bclymer@alleatogroup.com",
                        }
                    }
                ],
                "ccRecipients": [],
                "receivedDateTime": "2026-06-21T17:31:16Z",
                "bodyPreview": "Please finish the account setup steps in our portal.",
                "body": {
                    "content": (
                        "Please finish the account setup steps in our portal. "
                        "This administrative email is not tied to a construction project."
                    )
                },
                "categories": [],
                "importance": "normal",
                "hasAttachments": False,
                "webLink": "https://outlook.office.com/mail/message-learned-rule-1",
                "internetMessageId": "<message-learned-rule-1@example.com>",
                "conversationId": "conversation-learned-rule-1",
                "internetMessageHeaders": [],
            }
        ], "inbox-token"


class _ManyMessagesGraph(_DeltaGraph):
    def get_delta(self, base_path, _delta_token):
        if "Inbox" not in base_path:
            return [], "sent-token"
        template = super().get_delta(base_path, _delta_token)[0][0]
        return [
            {
                **template,
                "id": f"message-raw-{index}",
                "subject": f"Project schedule coordination {index}",
                "internetMessageId": f"<message-raw-{index}@example.com>",
                "conversationId": f"conversation-raw-{index}",
            }
            for index in range(1, 5)
        ], "inbox-token"


def test_sync_outlook_emails_assigns_project_before_rag_intake(monkeypatch):
    supabase = _Supabase()
    _route_outlook_intake_clients(monkeypatch, supabase)
    monkeypatch.setattr(outlook, "get_graph_client", lambda: _DeltaGraph())
    monkeypatch.setattr(
        outlook,
        "infer_assignment_target",
        lambda *_args, **_kwargs: AssignmentTarget(
            project_id=876,
            business_area_id=None,
            method="title_match",
            confidence=0.98,
        ),
    )

    synced, token = outlook.sync_outlook_emails(
        supabase,
        "bclymer@alleatogroup.com",
        project_keywords=[],
    )

    assert synced == 1
    assert token == "inbox:inbox-token|sent:sent-token"
    row = supabase.store["outlook_email_intake"][0]
    assert row["graph_message_id"] == "message-raw-1"
    assert row["mailbox_user_id"] == "bclymer@alleatogroup.com"
    assert row["project_id"] == 876
    assert row["match_status"] == "matched"
    assert row["assignment_method"] == "title_match"
    assert row["document_metadata_id"] is not None
    assert row["source_metadata"]["project_assignment"]["status"] == "assigned"
    assert row["source_metadata"]["project_assignment"]["confidence"] == 0.98


def test_sync_outlook_emails_persists_business_area_assignment_without_project_id(monkeypatch):
    supabase = _Supabase()
    _route_outlook_intake_clients(monkeypatch, supabase)
    monkeypatch.setattr(outlook, "get_graph_client", lambda: _DeltaGraph())
    monkeypatch.setattr(
        outlook,
        "infer_assignment_target",
        lambda *_args, **_kwargs: AssignmentTarget(
            project_id=None,
            business_area_id=3,
            legacy_project_id=60,
            method="title_match",
            confidence=0.98,
        ),
    )

    synced, _token = outlook.sync_outlook_emails(
        supabase,
        "bclymer@alleatogroup.com",
        project_keywords=[],
    )

    assert synced == 1
    intake_row = supabase.store["outlook_email_intake"][0]
    assert intake_row["project_id"] is None
    assert intake_row["match_status"] == "matched"
    assert intake_row["status"] == "Matched"
    assignment = intake_row["source_metadata"]["project_assignment"]
    assert assignment["status"] == "assigned"
    assert assignment["target_type"] == "business_area"
    assert assignment["business_area_id"] == 3
    assert assignment["legacy_project_id"] == 60

    document_row = supabase.store["document_metadata"][0]
    assert document_row.get("project_id") is None
    assert document_row["business_area_id"] == 3
    assert "business_area_auto:title_match" in document_row["tags"]


def test_sync_outlook_emails_preserves_existing_business_area_over_conversation_consensus(
    monkeypatch,
):
    supabase = _Supabase()
    _route_outlook_intake_clients(monkeypatch, supabase)
    supabase.store["document_metadata"] = [
        {
            "id": "outlook_message-raw-1",
            "project_id": None,
            "business_area_id": 3,
            "source_metadata": {},
            "tags": "email,outlook",
            "file_path": "outlook/existing.txt",
            "storage_bucket": "documents",
        }
    ]
    monkeypatch.setattr(outlook, "get_graph_client", lambda: _DeltaGraph())
    monkeypatch.setattr(
        outlook,
        "find_outlook_project_consensus",
        lambda *_args, **_kwargs: SimpleNamespace(
            project_id=876,
            confidence=0.99,
            source_method="title_match",
            evidence_row_ids=(7,),
        ),
    )

    def fail_infer(*_args, **_kwargs):
        raise AssertionError("existing document scope should bypass inference")

    monkeypatch.setattr(outlook, "infer_assignment_target", fail_infer)

    synced, _token = outlook.sync_outlook_emails(
        supabase,
        "bclymer@alleatogroup.com",
        project_keywords=[],
    )

    assert synced == 1
    document_row = supabase.store["document_metadata"][0]
    assert document_row.get("project_id") is None
    assert document_row["business_area_id"] == 3
    intake_row = supabase.store["outlook_email_intake"][0]
    assert intake_row["project_id"] is None
    assert intake_row["match_status"] == "matched"
    assignment = intake_row["source_metadata"]["project_assignment"]
    assert assignment["method"] == "existing_document"
    assert assignment["target_type"] == "business_area"
    assert assignment["business_area_id"] == 3


def test_parse_outlook_delta_cursor_contract():
    # Canonical cursor parses to per-folder tokens.
    assert outlook.parse_outlook_delta_cursor("inbox:a|sent:b") == {"inbox": "a", "sent": "b"}
    assert outlook.is_canonical_outlook_delta_cursor("inbox:a|sent:b") is True
    # Legacy/retired/malformed values are rejected (caller must full-resync).
    for bad in [None, "", "retired-inbox-cursor", "inbox:a", "sent:b", "inbox:|sent:b", "inbox:a|sent:b|extra:c"]:
        assert outlook.parse_outlook_delta_cursor(bad) is None
        assert outlook.is_canonical_outlook_delta_cursor(bad) is False


def test_business_area_assignment_metadata_fails_loudly_without_target_id():
    with pytest.raises(
        ValueError,
        match="Assigned Business Area metadata is missing business_area_id",
    ):
        outlook._business_area_id_from_source_metadata(
            {
                "project_assignment": {
                    "status": "assigned",
                    "target_type": "business_area",
                }
            }
        )


def test_sync_outlook_emails_rejects_noncanonical_single_folder_cursor(monkeypatch):
    monkeypatch.setattr(outlook, "get_graph_client", lambda: _DeltaGraph())

    with pytest.raises(ValueError, match="canonical 'inbox:<token>\\|sent:<token>' format"):
        outlook.sync_outlook_emails(
            _Supabase(),
            "bclymer@alleatogroup.com",
            project_keywords=[],
            delta_token="retired-inbox-cursor",
        )


def test_sync_outlook_emails_respects_mailbox_message_cap(monkeypatch):
    supabase = _Supabase()
    _route_outlook_intake_clients(monkeypatch, supabase)
    monkeypatch.setattr(outlook, "get_graph_client", lambda: _ManyMessagesGraph())
    monkeypatch.setattr(outlook, "OUTLOOK_SYNC_MAX_MESSAGES_PER_MAILBOX", 2)
    monkeypatch.setattr(
        outlook,
        "infer_assignment_target",
        lambda *_args, **_kwargs: AssignmentTarget(
            project_id=876,
            business_area_id=None,
            method="title_match",
            confidence=0.98,
        ),
    )

    synced, token = outlook.sync_outlook_emails(
        supabase,
        "bclymer@alleatogroup.com",
        project_keywords=[],
    )

    assert synced == 2
    assert token == "inbox:inbox-token|sent:sent-token"
    assert [row["graph_message_id"] for row in supabase.store["outlook_email_intake"]] == [
        "message-raw-1",
        "message-raw-2",
    ]


def test_sync_outlook_emails_marks_clear_non_project_mail(monkeypatch):
    supabase = _Supabase()
    _route_outlook_intake_clients(monkeypatch, supabase)
    monkeypatch.setattr(outlook, "get_graph_client", lambda: _NonProjectFinanceGraph())
    monkeypatch.setattr(
        outlook,
        "infer_assignment_target",
        lambda *_args, **_kwargs: AssignmentTarget(
            project_id=None,
            business_area_id=None,
            method="unassigned",
            confidence=0.0,
        ),
    )

    synced, _token = outlook.sync_outlook_emails(
        supabase,
        "bclymer@alleatogroup.com",
        project_keywords=[],
    )

    assert synced == 1
    row = supabase.store["outlook_email_intake"][0]
    assert row["project_id"] is None
    assert row["match_status"] == "not_project"
    assert row["assignment_method"] == "non_project:finance_admin"
    assignment = row["source_metadata"]["project_assignment"]
    assert assignment["status"] == "not_project"
    assert assignment["category"] == "finance_admin"


def test_sync_outlook_emails_applies_learned_not_project_rule(monkeypatch):
    supabase = _Supabase()
    _route_outlook_intake_clients(monkeypatch, supabase)
    supabase.store["email_filter_rules"] = [
        {
            "id": "rule-not-project",
            "enabled": True,
            "action": "not_project",
            "sender_pattern": None,
            "sender_domain": "adminvendor.com",
            "subject_pattern": "%portal%",
            "body_pattern": None,
            "label": "Admin vendor non-project",
        }
    ]
    monkeypatch.setattr(outlook, "get_graph_client", lambda: _LearnedNotProjectRuleGraph())

    def fail_infer(*_args, **_kwargs):
        raise AssertionError("learned not_project rules should bypass project inference")

    monkeypatch.setattr(outlook, "infer_assignment_target", fail_infer)

    synced, _token = outlook.sync_outlook_emails(
        supabase,
        "bclymer@alleatogroup.com",
        project_keywords=[],
    )

    assert synced == 1
    row = supabase.store["outlook_email_intake"][0]
    assert row["project_id"] is None
    assert row["document_metadata_id"] == "outlook_message-learned-rule-1"
    assert row["match_status"] == "not_project"
    assert row["assignment_method"] == "non_project:user_filter_rule"
    assert row["assignment_confidence"] == 1.0
    assert row["source_metadata"]["intake_classification"]["category"] == "user_filter_rule_not_project"
    user_rule = row["source_metadata"]["user_filter_rule"]
    assert user_rule["rule_id"] == "rule-not-project"
    assert user_rule["action"] == "not_project"
    assignment = row["source_metadata"]["project_assignment"]
    assert assignment["status"] == "not_project"
    assert assignment["category"] == "learned_rule"
    assert assignment["rule_id"] == "rule-not-project"


def test_sync_outlook_emails_records_attachment_list_failure_on_intake(monkeypatch):
    supabase = _Supabase()
    _route_outlook_intake_clients(monkeypatch, supabase)
    monkeypatch.setattr(outlook, "get_graph_client", lambda: _AttachmentListFailureGraph())
    monkeypatch.setattr(
        outlook,
        "infer_assignment_target",
        lambda *_args, **_kwargs: AssignmentTarget(
            project_id=None,
            business_area_id=None,
            method="unassigned",
            confidence=0.0,
        ),
    )

    synced, _token = outlook.sync_outlook_emails(
        supabase,
        "bclymer@alleatogroup.com",
        project_keywords=[],
    )

    assert synced == 1
    row = supabase.store["outlook_email_intake"][0]
    assert row["has_attachments"] is True
    assert row["source_metadata"]["attachment_errors"] == ["list_failed: attachment list timed out"]
    assert row["source_metadata"]["intake_attachment_count_synced"] == 0


def test_list_message_attachments_uses_metadata_only_short_timeout(monkeypatch):
    graph = _AttachmentListCaptureGraph()
    monkeypatch.setattr(outlook, "OUTLOOK_ATTACHMENT_LIST_TIMEOUT_SECONDS", 7)

    attachments = outlook._list_message_attachments(
        graph,
        "bclymer@alleatogroup.com",
        {"id": "message-1", "hasAttachments": True},
        set(),
    )

    assert attachments == [{"id": "attachment-1", "name": "permit.pdf", "size": 100}]
    call = graph.calls[0]
    assert call["path"] == "/users/bclymer@alleatogroup.com/messages/message-1/attachments"
    assert call["params"]["$select"] == "id,name,contentType,size,isInline,lastModifiedDateTime"
    assert "contentBytes" not in call["params"]["$select"]
    assert call["kwargs"]["max_pages"] == 1
    assert call["kwargs"]["max_items"] == outlook.MAX_ATTACHMENTS_PER_EMAIL
    assert call["kwargs"]["timeout"] == 7
    assert call["kwargs"]["max_retries"] == 1


def test_fetch_file_attachment_detail_escapes_graph_path_ids():
    graph = _AttachmentDetailCaptureGraph()

    detail = outlook._fetch_file_attachment_detail(
        graph,
        "awehner@alleatogroup.com",
        "message/1=",
        "attachment/1=",
    )

    assert detail["id"] == "attachment/1="
    call = graph.calls[0]
    assert call["path"] == (
        "/users/awehner@alleatogroup.com/messages/message%2F1%3D/"
        "attachments/attachment%2F1%3D"
    )
    assert call["params"]["$select"] == "id,name,contentType,size,isInline,contentBytes"


def test_outlook_intake_attachment_stores_bytea_hex_content(monkeypatch):
    supabase = _Supabase()
    _route_outlook_intake_clients(monkeypatch, supabase)
    monkeypatch.setattr(outlook, "OUTLOOK_INTAKE_ATTACHMENT_CONTENT_MAX_BYTES", 8 * 1024 * 1024)
    attachment = {
        "@odata.type": "#microsoft.graph.fileAttachment",
        "id": "attachment-1",
        "name": "permit.pdf",
        "contentType": "application/pdf",
        "size": 3,
        "isInline": False,
        "contentBytes": "YWJj",
    }

    wrote = outlook._upsert_outlook_intake_attachment(
        supabase_client=supabase,
        graph=_Graph(),
        user_id="pm@example.com",
        msg_id="message-1",
        intake_email_id=42,
        attachment=attachment,
    )

    assert wrote is True
    row = supabase.store["outlook_email_intake_attachments"][0]
    assert row["intake_email_id"] == 42
    assert row["file_name"] == "permit.pdf"
    assert row["file_size"] == 3
    assert row["content"] == "\\x616263"
    assert row["file_url"] == "graph://messages/message-1/attachments/attachment-1"


def test_outlook_intake_attachment_stores_large_binary_as_metadata_only(monkeypatch):
    supabase = _Supabase()
    _route_outlook_intake_clients(monkeypatch, supabase)
    monkeypatch.setattr(outlook, "OUTLOOK_INTAKE_ATTACHMENT_CONTENT_MAX_BYTES", 10)
    attachment = {
        "@odata.type": "#microsoft.graph.fileAttachment",
        "id": "attachment-1",
        "name": "SUP8319 6-19-26.dwg",
        "contentType": "application/acad",
        "size": 4096,
        "isInline": False,
    }

    wrote = outlook._upsert_outlook_intake_attachment(
        supabase_client=supabase,
        graph=_NoFetchGraph(),
        user_id="pm@example.com",
        msg_id="message-1",
        intake_email_id=42,
        attachment=attachment,
    )

    assert wrote is True
    row = supabase.store["outlook_email_intake_attachments"][0]
    assert row["file_name"] == "SUP8319 6-19-26.dwg"
    assert row["file_size"] == 4096
    assert row["checksum_sha256"] is None
    assert "content" not in row
    assert row["source_metadata"]["content_capture_status"] == "skipped_large_attachment"
    assert row["source_metadata"]["content_capture_limit_bytes"] == 10


def test_outlook_intake_email_updates_existing_graph_message(monkeypatch):
    supabase = _Supabase()
    _route_outlook_intake_clients(monkeypatch, supabase)
    supabase.store["outlook_email_intake"] = [
        {"id": 7, "graph_message_id": "message-1", "project_id": 1, "subject": "Old"}
    ]
    msg = {
        "id": "message-1",
        "subject": "Updated",
        "receivedDateTime": "2026-05-02T10:00:00Z",
        "hasAttachments": True,
        "conversationId": "conversation-1",
        "toRecipients": [{"emailAddress": {"address": "owner@example.com"}}],
    }

    email_id = outlook._upsert_outlook_intake_email(
        supabase_client=supabase,
        project_id=876,
        document_metadata_id="outlook_message-1",
        msg=msg,
        user_email="pm@example.com",
        body_text="Body",
        sender_name="PM",
        sender_addr="pm@example.com",
        assignment_method="project_name",
        assignment_confidence=0.91,
        source_metadata={"outlook_message_id": "message-1"},
    )

    assert email_id == 7
    row = supabase.store["outlook_email_intake"][0]
    assert row["project_id"] == 876
    assert row["document_metadata_id"] == "outlook_message-1"
    assert row["subject"] == "Updated"
    assert row["to_list"] == ["owner@example.com"]
    assert row["mailbox_user_id"] == "pm@example.com"
    assert row["match_status"] == "matched"


def test_reconcile_outlook_project_assignment_uses_document_metadata_project(monkeypatch):
    supabase = _Supabase()
    _route_outlook_intake_clients(monkeypatch, supabase)
    supabase.store["document_metadata"] = [
        {"id": "outlook_message-1", "project_id": 178}
    ]
    supabase.store["project_emails"] = [
        {"id": 9, "graph_message_id": "message-1", "project_id": 31}
    ]
    supabase.store["outlook_email_intake"] = [
        {
            "id": 7,
            "graph_message_id": "message-1",
            "project_id": 31,
            "match_status": "matched",
            "assignment_method": "project_directory_email",
        }
    ]

    project_id = outlook._reconcile_outlook_project_assignment(
        supabase_client=supabase,
        msg_id="message-1",
        document_metadata_id="outlook_message-1",
        intake_email_id=7,
        inferred_project_id=31,
        assignment_method="project_directory_email",
        assignment_confidence=0.9,
    )

    assert project_id == 178
    assert supabase.store["project_emails"][0]["project_id"] == 31
    intake = supabase.store["outlook_email_intake"][0]
    assert intake["project_id"] == 178
    assert intake["document_metadata_id"] == "outlook_message-1"
    assert intake["assignment_method"] == "document_metadata_reconcile"
    assert intake["assignment_confidence"] == 1.0


def test_backfill_outlook_intake_project_assignments_updates_intake_and_rag(monkeypatch):
    supabase = _Supabase()
    _route_outlook_intake_clients(monkeypatch, supabase)
    monkeypatch.setattr(outlook, "get_rag_write_client", lambda: supabase)
    monkeypatch.setattr(
        outlook,
        "infer_assignment_target",
        lambda *_args, **_kwargs: AssignmentTarget(
            project_id=178,
            business_area_id=None,
            method="content_match",
            confidence=0.82,
        ),
    )
    supabase.store["outlook_email_intake"] = [
        {
            "id": 7,
            "subject": "Superior Beverage coordination",
            "body_text": "SYS-24-0008319 Superior Beverage project coordination.",
            "from_name": "Vendor",
            "from_email": "vendor@example.com",
            "to_list": ["bclymer@alleatogroup.com"],
            "cc_list": [],
            "bcc_list": [],
            "project_id": None,
            "document_metadata_id": "outlook_message-1",
            "source_metadata": {"project_assignment": {"status": "deferred"}},
            "received_at": "2026-06-19T20:00:00Z",
            "graph_message_id": "message-1",
            "mailbox_user_id": "bclymer@alleatogroup.com",
        },
        {
            "id": 8,
            "subject": "Older Superior Beverage coordination",
            "body_text": "SYS-24-0008319 older project coordination.",
            "from_name": "Vendor",
            "from_email": "vendor@example.com",
            "to_list": ["bclymer@alleatogroup.com"],
            "cc_list": [],
            "bcc_list": [],
            "project_id": None,
            "document_metadata_id": "outlook_message-old",
            "source_metadata": {"project_assignment": {"status": "deferred"}},
            "received_at": "2026-05-01T20:00:00Z",
            "graph_message_id": "message-old",
            "mailbox_user_id": "bclymer@alleatogroup.com",
        }
    ]
    supabase.store["document_metadata"] = [{"id": "outlook_message-1", "project_id": None}]
    supabase.store["rag_document_metadata"] = [{"id": "outlook_message-1", "project_id": None}]

    result = outlook.backfill_outlook_intake_project_assignments(
        supabase,
        mailbox_user_id="bclymer@alleatogroup.com",
        limit=10,
        since="2026-06-07T00:00:00Z",
    )

    assert result["scanned"] == 1
    assert result["assigned"] == 1
    intake = supabase.store["outlook_email_intake"][0]
    assert intake["project_id"] == 178
    assert intake["match_status"] == "matched"
    assert intake["assignment_method"] == "content_match"
    assert intake["source_metadata"]["project_assignment"]["status"] == "assigned"
    assert supabase.store["document_metadata"][0]["project_id"] == 178
    assert supabase.store["rag_document_metadata"][0]["project_id"] == 178
    assert supabase.store["outlook_email_intake"][1]["project_id"] is None


def test_backfill_outlook_intake_assignments_persists_business_area(monkeypatch):
    supabase = _Supabase()
    _route_outlook_intake_clients(monkeypatch, supabase)
    monkeypatch.setattr(outlook, "get_rag_write_client", lambda: supabase)
    monkeypatch.setattr(
        outlook,
        "infer_assignment_target",
        lambda *_args, **_kwargs: AssignmentTarget(
            project_id=None,
            business_area_id=3,
            legacy_project_id=60,
            method="content_match",
            confidence=0.82,
        ),
    )
    supabase.store["outlook_email_intake"] = [
        {
            "id": 7,
            "subject": "Finance policy coordination",
            "body_text": "Finance policy and accounting workflow coordination.",
            "from_name": "Controller",
            "from_email": "controller@example.com",
            "to_list": ["bclymer@alleatogroup.com"],
            "cc_list": [],
            "bcc_list": [],
            "project_id": None,
            "document_metadata_id": "outlook_message-finance",
            "source_metadata": {"project_assignment": {"status": "deferred"}},
            "received_at": "2026-06-19T20:00:00Z",
            "graph_message_id": "message-finance",
            "mailbox_user_id": "bclymer@alleatogroup.com",
        }
    ]
    supabase.store["document_metadata"] = [
        {
            "id": "outlook_message-finance",
            "project_id": None,
            "business_area_id": None,
        }
    ]
    supabase.store["rag_document_metadata"] = [
        {"id": "outlook_message-finance", "project_id": None}
    ]

    result = outlook.backfill_outlook_intake_project_assignments(
        supabase,
        mailbox_user_id="bclymer@alleatogroup.com",
        limit=10,
        since="2026-06-07T00:00:00Z",
    )

    assert result["assigned"] == 1
    intake = supabase.store["outlook_email_intake"][0]
    assert intake["project_id"] is None
    assert intake["match_status"] == "matched"
    assignment = intake["source_metadata"]["project_assignment"]
    assert assignment["target_type"] == "business_area"
    assert assignment["business_area_id"] == 3
    assert assignment["legacy_project_id"] == 60
    document = supabase.store["document_metadata"][0]
    assert document["project_id"] is None
    assert document["business_area_id"] == 3
    rag = supabase.store["rag_document_metadata"][0]
    assert rag["project_id"] is None
    assert rag["source_metadata"]["project_assignment"]["business_area_id"] == 3


def test_backfill_outlook_intake_project_assignments_normalizes_existing_project(monkeypatch):
    supabase = _Supabase()
    _route_outlook_intake_clients(monkeypatch, supabase)
    monkeypatch.setattr(outlook, "get_rag_write_client", lambda: supabase)

    def fail_infer(*_args, **_kwargs):
        raise AssertionError("existing project rows should not rerun inference")

    monkeypatch.setattr(outlook, "infer_assignment_target", fail_infer)
    supabase.store["outlook_email_intake"] = [
        {
            "id": 7,
            "subject": "Vermillion Rise permit set",
            "body_text": "Existing assigned email.",
            "from_name": "Vendor",
            "from_email": "vendor@example.com",
            "to_list": ["bclymer@alleatogroup.com"],
            "cc_list": [],
            "bcc_list": [],
            "project_id": 67,
            "document_metadata_id": "outlook_message-1",
            "assignment_method": "existing_document",
            "assignment_confidence": 1.0,
            "source_metadata": {},
            "received_at": "2026-06-19T20:00:00Z",
            "graph_message_id": "message-1",
            "mailbox_user_id": "bclymer@alleatogroup.com",
        }
    ]
    supabase.store["document_metadata"] = [
        {"id": "outlook_message-1", "project_id": 67, "business_area_id": None}
    ]
    supabase.store["rag_document_metadata"] = [{"id": "outlook_message-1", "project_id": None}]

    result = outlook.backfill_outlook_intake_project_assignments(
        supabase,
        mailbox_user_id="bclymer@alleatogroup.com",
        limit=10,
        since="2026-06-07T00:00:00Z",
    )

    assert result["scanned"] == 1
    assert result["assigned"] == 1
    assert result["normalized_existing"] == 1
    intake = supabase.store["outlook_email_intake"][0]
    assert intake["match_status"] == "matched"
    assert intake["source_metadata"]["project_assignment"] == {
        "status": "assigned",
        "target_type": "project",
        "method": "existing_document",
        "confidence": 1.0,
        "backfilled_at": intake["source_metadata"]["project_assignment"]["backfilled_at"],
    }
    assert supabase.store["rag_document_metadata"][0]["project_id"] == 67
    assert supabase.store["rag_document_metadata"][0]["source_metadata"]["project_assignment"]["status"] == "assigned"


def test_backfill_outlook_intake_project_assignments_categorizes_clear_non_project(monkeypatch):
    supabase = _Supabase()
    _route_outlook_intake_clients(monkeypatch, supabase)
    monkeypatch.setattr(outlook, "get_rag_write_client", lambda: supabase)
    monkeypatch.setattr(
        outlook,
        "infer_assignment_target",
        lambda *_args, **_kwargs: AssignmentTarget(
            project_id=None,
            business_area_id=None,
            method="unassigned",
            confidence=0.0,
        ),
    )
    supabase.store["outlook_email_intake"] = [
        {
            "id": 7,
            "subject": "Your Venture X Business card statement is ready",
            "body_text": "Your business card statement is ready to view online.",
            "from_name": "Capital One Business",
            "from_email": "capitalone@notification.capitalone.com",
            "to_list": ["bclymer@alleatogroup.com"],
            "cc_list": [],
            "bcc_list": [],
            "project_id": None,
            "document_metadata_id": "outlook_message-finance",
            "assignment_method": "unassigned",
            "assignment_confidence": 0.0,
            "source_metadata": {},
            "received_at": "2026-06-21T16:31:16Z",
            "graph_message_id": "message-finance",
            "mailbox_user_id": "bclymer@alleatogroup.com",
        },
        {
            "id": 8,
            "subject": "Uni Qlo - need portal opened for invoice entry",
            "body_text": "Please open the portal for invoice entry on this active project.",
            "from_name": "Vendor",
            "from_email": "vendor@example.com",
            "to_list": ["bclymer@alleatogroup.com"],
            "cc_list": [],
            "bcc_list": [],
            "project_id": None,
            "document_metadata_id": "outlook_message-project-review",
            "assignment_method": "unassigned",
            "assignment_confidence": 0.0,
            "source_metadata": {},
            "received_at": "2026-06-21T15:31:16Z",
            "graph_message_id": "message-project-review",
            "mailbox_user_id": "bclymer@alleatogroup.com",
        },
    ]
    supabase.store["rag_document_metadata"] = [
        {"id": "outlook_message-finance", "project_id": None},
        {"id": "outlook_message-project-review", "project_id": None},
    ]

    result = outlook.backfill_outlook_intake_project_assignments(
        supabase,
        mailbox_user_id="bclymer@alleatogroup.com",
        limit=10,
        since="2026-06-07T00:00:00Z",
    )

    assert result["scanned"] == 2
    assert result["not_project"] == 1
    assert result["review_needed"] == 1
    finance = supabase.store["outlook_email_intake"][0]
    assert finance["match_status"] == "not_project"
    assert finance["assignment_method"] == "non_project:finance_admin"
    assert finance["source_metadata"]["project_assignment"]["status"] == "not_project"
    assert finance["source_metadata"]["project_assignment"]["category"] == "finance_admin"
    project_review = supabase.store["outlook_email_intake"][1]
    assert project_review["match_status"] == "unassigned"
    assert project_review["source_metadata"]["project_assignment"]["status"] == "review_needed"


def test_apply_outlook_filter_rule_to_intake_marks_matching_review_rows(monkeypatch):
    supabase = _Supabase()
    _route_outlook_intake_clients(monkeypatch, supabase)
    monkeypatch.setattr(outlook, "get_rag_write_client", lambda: supabase)
    supabase.store["email_filter_rules"] = [
        {
            "id": "rule-not-project",
            "enabled": True,
            "action": "not_project",
            "sender_pattern": None,
            "sender_domain": "adminvendor.com",
            "subject_pattern": "%portal%",
            "body_pattern": None,
            "label": "Admin vendor non-project",
        }
    ]
    supabase.store["outlook_email_intake"] = [
        {
            "id": 7,
            "subject": "Portal account setup",
            "body_text": "Please finish the account setup steps in our portal.",
            "from_name": "Admin Vendor",
            "from_email": "billing@adminvendor.com",
            "project_id": None,
            "document_metadata_id": "outlook_message-learned-rule",
            "source_metadata": {"project_assignment": {"status": "review_needed"}},
            "received_at": "2026-06-21T17:31:16Z",
            "graph_message_id": "message-learned-rule",
            "mailbox_user_id": "bclymer@alleatogroup.com",
        },
        {
            "id": 8,
            "subject": "Portal account setup",
            "body_text": "Already assigned project email.",
            "from_name": "Admin Vendor",
            "from_email": "billing@adminvendor.com",
            "project_id": 178,
            "document_metadata_id": "outlook_message-assigned",
            "source_metadata": {"project_assignment": {"status": "assigned"}},
            "received_at": "2026-06-21T16:31:16Z",
            "graph_message_id": "message-assigned",
            "mailbox_user_id": "bclymer@alleatogroup.com",
        },
        {
            "id": 9,
            "subject": "Portal account setup",
            "body_text": "Already assigned Business Area email.",
            "from_name": "Admin Vendor",
            "from_email": "billing@adminvendor.com",
            "project_id": None,
            "document_metadata_id": "outlook_message-business-area",
            "source_metadata": {
                "project_assignment": {
                    "status": "assigned",
                    "target_type": "business_area",
                    "business_area_id": 3,
                }
            },
            "received_at": "2026-06-21T15:31:16Z",
            "graph_message_id": "message-business-area",
            "mailbox_user_id": "bclymer@alleatogroup.com",
        },
    ]
    supabase.store["rag_document_metadata"] = [
        {"id": "outlook_message-learned-rule", "project_id": None, "source_metadata": {}},
        {"id": "outlook_message-assigned", "project_id": 178, "source_metadata": {}},
        {
            "id": "outlook_message-business-area",
            "project_id": None,
            "source_metadata": {"business_area_id": 3},
        },
    ]

    result = outlook.apply_outlook_filter_rule_to_intake(
        supabase,
        rule_id="rule-not-project",
        mailbox_user_id="bclymer@alleatogroup.com",
        limit=10,
        since="2026-06-07T00:00:00Z",
    )

    assert result["status"] == "applied"
    assert result["scanned"] == 3
    assert result["matched"] == 1
    assert result["updated"] == 1
    assert result["skipped_existing_project"] == 2
    row = supabase.store["outlook_email_intake"][0]
    assert row["match_status"] == "not_project"
    assert row["assignment_method"] == "non_project:user_filter_rule"
    assert row["assignment_confidence"] == 1.0
    assert row["source_metadata"]["user_filter_rule"]["rule_id"] == "rule-not-project"
    assignment = row["source_metadata"]["project_assignment"]
    assert assignment["status"] == "not_project"
    assert assignment["category"] == "learned_rule"
    assert assignment["rule_id"] == "rule-not-project"
    rag = supabase.store["rag_document_metadata"][0]
    assert rag["source_metadata"]["project_assignment"]["status"] == "not_project"
    assert supabase.store["outlook_email_intake"][1].get("match_status") != "not_project"
    branch_assignment = supabase.store["outlook_email_intake"][2]["source_metadata"][
        "project_assignment"
    ]
    assert branch_assignment["status"] == "assigned"
    assert branch_assignment["business_area_id"] == 3


def test_refresh_outlook_intake_vectorization_statuses_projects_chunk_state(monkeypatch):
    supabase = _Supabase()
    _route_outlook_intake_clients(monkeypatch, supabase)
    supabase.store["outlook_email_intake"] = [
        {
            "id": 7,
            "document_metadata_id": "outlook_message-1",
            "source_metadata": {},
            "received_at": "2026-06-19T20:00:00Z",
            "mailbox_user_id": "bclymer@alleatogroup.com",
        },
        {
            "id": 8,
            "document_metadata_id": None,
            "source_metadata": {},
            "received_at": "2026-05-01T19:00:00Z",
            "mailbox_user_id": "bclymer@alleatogroup.com",
        },
    ]
    supabase.store["rag_document_metadata"] = [
        {"id": "outlook_message-1", "embedding_status": "embedded"}
    ]
    supabase.store["document_chunks"] = [
        {"chunk_id": "chunk-1", "document_id": "outlook_message-1", "embedding": [0.1, 0.2]}
    ]

    result = outlook.refresh_outlook_intake_vectorization_statuses(
        mailbox_user_id="bclymer@alleatogroup.com",
        limit=10,
        since="2026-06-07T00:00:00Z",
    )

    assert result["scanned"] == 1
    assert result["updated"] == 1
    assert result["statuses"] == {"embedded": 1}
    embedded_row = supabase.store["outlook_email_intake"][0]
    assert embedded_row["vectorization_status"] == "embedded"
    assert embedded_row["vectorization_chunk_count"] == 1
    assert embedded_row["source_metadata"]["vectorization"]["status"] == "embedded"
    no_document_row = supabase.store["outlook_email_intake"][1]
    assert "vectorization_status" not in no_document_row


def test_backfill_outlook_intake_rag_documents_links_missing_document(monkeypatch):
    supabase = _Supabase()
    _route_outlook_intake_clients(monkeypatch, supabase)
    supabase.store["outlook_email_intake"] = [
        {
            "id": 7,
            "graph_message_id": "message-1",
            "mailbox_user_id": "bclymer@alleatogroup.com",
            "subject": "Project document backfill",
            "body_text": "This project email has enough body text to be indexed into the RAG system.",
            "from_name": "Vendor",
            "from_email": "vendor@example.com",
            "to_list": ["bclymer@alleatogroup.com"],
            "cc_list": [],
            "project_id": 178,
            "assignment_method": "content_match",
            "received_at": "2026-06-19T20:00:00Z",
            "web_link": "https://outlook.office.com/mail/message-1",
            "document_metadata_id": None,
            "source_metadata": {},
        },
        {
            "id": 8,
            "graph_message_id": "message-old",
            "mailbox_user_id": "bclymer@alleatogroup.com",
            "subject": "Old project document backfill",
            "body_text": "This old project email has enough body text but is outside the requested window.",
            "from_name": "Vendor",
            "from_email": "vendor@example.com",
            "to_list": ["bclymer@alleatogroup.com"],
            "cc_list": [],
            "project_id": 178,
            "assignment_method": "content_match",
            "received_at": "2026-05-01T20:00:00Z",
            "web_link": "https://outlook.office.com/mail/message-old",
            "document_metadata_id": None,
            "source_metadata": {},
        }
    ]

    result = outlook.backfill_outlook_intake_rag_documents(
        supabase,
        mailbox_user_id="bclymer@alleatogroup.com",
        limit=10,
        since="2026-06-07T00:00:00Z",
    )

    assert result["scanned"] == 1
    assert result["created"] == 1
    intake = supabase.store["outlook_email_intake"][0]
    assert intake["document_metadata_id"] == "outlook_message-1"
    assert intake["vectorization_status"] == "pending"
    assert intake["source_metadata"]["rag_document_backfill"]["status"] == "created"
    assert supabase.store["document_metadata"][0]["id"] == "outlook_message-1"
    assert supabase.store["document_metadata"][0]["project_id"] == 178
    assert supabase.store["outlook_email_intake"][1]["document_metadata_id"] is None


def test_backfill_outlook_intake_rag_documents_keeps_business_area_scope(monkeypatch):
    supabase = _Supabase()
    _route_outlook_intake_clients(monkeypatch, supabase)
    store_class = outlook.SupabaseRagStore
    monkeypatch.setattr(
        outlook,
        "SupabaseRagStore",
        lambda client: store_class(client=client, rag_client=client),
    )
    supabase.store["outlook_email_intake"] = [
        {
            "id": 7,
            "graph_message_id": "message-finance",
            "mailbox_user_id": "bclymer@alleatogroup.com",
            "subject": "Finance workflow backfill",
            "body_text": "This finance email has enough body text to be indexed into the RAG system.",
            "from_name": "Controller",
            "from_email": "controller@example.com",
            "to_list": ["bclymer@alleatogroup.com"],
            "cc_list": [],
            "project_id": None,
            "assignment_method": "content_match",
            "received_at": "2026-06-19T20:00:00Z",
            "web_link": "https://outlook.office.com/mail/message-finance",
            "document_metadata_id": None,
            "source_metadata": {
                "project_assignment": {
                    "status": "assigned",
                    "target_type": "business_area",
                    "business_area_id": 3,
                    "legacy_project_id": 60,
                }
            },
        }
    ]

    result = outlook.backfill_outlook_intake_rag_documents(
        supabase,
        mailbox_user_id="bclymer@alleatogroup.com",
        limit=10,
        since="2026-06-07T00:00:00Z",
    )

    assert result["created"] == 1
    document = supabase.store["document_metadata"][0]
    assert document.get("project_id") is None
    assert document["business_area_id"] == 3
    assert "business_area_auto:content_match" in document["tags"]
    rag = supabase.store["rag_document_metadata"][0]
    assert rag.get("project_id") is None
    assert rag["source_metadata"]["business_area_id"] == 3


def test_record_outlook_skip_audit_writes_classifier_snapshot(monkeypatch):
    supabase = _Supabase()
    _route_outlook_intake_clients(monkeypatch, supabase)
    msg = {
        "id": "message-1",
        "subject": "Accepted: OAC Meeting",
        "receivedDateTime": "2026-05-12T15:00:00Z",
        "internetMessageId": "<message-1@example.com>",
        "conversationId": "conversation-1",
        "webLink": "https://outlook.office.com/mail/message-1",
    }

    outlook._record_outlook_skip_audit(
        supabase_client=supabase,
        msg=msg,
        user_email="pm@example.com",
        body_text="Accepted OAC Meeting When: Tuesday Where: Teams",
        sender_name="Owner",
        sender_addr="owner@example.com",
        source_metadata={
            "outlook_message_id": "message-1",
            "intake_classification": {
                "action": "skip",
                "category": "calendar_rsvp",
                "confidence": 0.98,
                "reason": "RSVP response has no substantive typed content.",
                "signals": ["rsvp_subject", "calendar_header"],
            },
        },
    )

    row = supabase.store["outlook_email_skip_audit"][0]
    assert row["graph_message_id"] == "message-1"
    assert row["mailbox_user_id"] == "pm@example.com"
    assert row["classification_action"] == "skip"
    assert row["classification_category"] == "calendar_rsvp"
    assert row["classification_confidence"] == 0.98
    assert row["classification_signals"] == ["rsvp_subject", "calendar_header"]
    assert row["body_preview"] == "Accepted OAC Meeting When: Tuesday Where: Teams"
