from __future__ import annotations

from datetime import datetime, timezone

from src.scripts import run_email_digest


class _Result:
    def __init__(self, data):
        self.data = data


class _Query:
    def __init__(self, rows):
        self.rows = list(rows)

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, key, value):
        self.rows = [row for row in self.rows if row.get(key) == value]
        return self

    def gte(self, key, value):
        self.rows = [row for row in self.rows if str(row.get(key) or "") >= str(value)]
        return self

    def lt(self, key, value):
        self.rows = [row for row in self.rows if str(row.get(key) or "") < str(value)]
        return self

    def in_(self, key, values):
        allowed = set(values)
        self.rows = [row for row in self.rows if row.get(key) in allowed]
        return self

    def order(self, key, desc=False):
        self.rows = sorted(self.rows, key=lambda row: str(row.get(key) or ""), reverse=desc)
        return self

    def execute(self):
        return _Result(self.rows)


class _Client:
    def __init__(self):
        self.tables = {
            "outlook_email_intake": [
                {
                    "id": 1,
                    "mailbox_user_id": "bclymer@alleatogroup.com",
                    "subject": "Submittal needs approval",
                    "from_name": "Owner",
                    "from_email": "owner@example.com",
                    "triage_action": "urgent",
                    "received_at": "2026-06-19T15:00:00+00:00",
                    "has_attachments": True,
                },
                {
                    "id": 2,
                    "mailbox_user_id": "bclymer@alleatogroup.com",
                    "subject": "FYI project note",
                    "from_name": "PM",
                    "from_email": "pm@example.com",
                    "triage_action": "fyi",
                    "received_at": "2026-06-19T16:00:00+00:00",
                    "has_attachments": False,
                },
            ],
            "outlook_email_intake_attachments": [
                {
                    "intake_email_id": 1,
                    "file_name": "submittal.pdf",
                    "promotion_status": "promoted",
                    "document_metadata_id": "outlook_attachment_1",
                    "project_document_id": 42,
                }
            ],
            "outlook_email_assistant_reviews": [
                {
                    "mailbox_user_id": "bclymer@alleatogroup.com",
                    "graph_message_id": "message-1",
                    "assistant_action": "reply",
                    "assistant_priority": "urgent",
                    "review_outcome": "draft_copied",
                    "draft_body": "I will review this today.",
                    "created_at": "2026-06-19T17:00:00+00:00",
                }
            ],
        }

    def table(self, name):
        return _Query(self.tables.get(name, []))


def test_email_digest_includes_important_emails_attachments_and_drafts(monkeypatch):
    monkeypatch.setattr(run_email_digest, "get_supabase_client", lambda: _Client())

    digest = run_email_digest.generate_email_digest(
        "bclymer@alleatogroup.com",
        datetime(2026, 6, 19, tzinfo=timezone.utc),
    )

    assert "Urgent (1)" in digest
    assert "Submittal needs approval - Owner" in digest
    assert "Attachments" in digest
    assert "Saved to project documents: 1" in digest
    assert "submittal.pdf" in digest
    assert "Drafts written" in digest
    assert "Total drafts/review events: 1" in digest


def test_send_teams_dm_reports_blocked_without_service_key(monkeypatch):
    monkeypatch.delenv("NOTIFICATION_SERVICE_KEY", raising=False)
    monkeypatch.delenv("EMAIL_DIGEST_DRY_RUN", raising=False)

    result = run_email_digest._send_teams_dm("digest")

    assert result.status == "blocked"
    assert result.sent is False
    assert "NOTIFICATION_SERVICE_KEY" in result.detail


def test_send_teams_dm_reports_dry_run(monkeypatch):
    monkeypatch.setenv("EMAIL_DIGEST_DRY_RUN", "true")
    monkeypatch.delenv("NOTIFICATION_SERVICE_KEY", raising=False)

    result = run_email_digest._send_teams_dm("digest")

    assert result.status == "dry_run"
    assert result.sent is False


def test_send_teams_dm_reports_sent(monkeypatch):
    calls = {}

    class _Response:
        status_code = 202
        text = "accepted"

    def fake_post(url, headers, json, timeout):
        calls["url"] = url
        calls["headers"] = headers
        calls["json"] = json
        calls["timeout"] = timeout
        return _Response()

    monkeypatch.delenv("EMAIL_DIGEST_DRY_RUN", raising=False)
    monkeypatch.setenv("NOTIFICATION_SERVICE_KEY", "service-key")
    monkeypatch.setattr(run_email_digest.httpx, "post", fake_post)

    result = run_email_digest._send_teams_dm("digest")

    assert result.status == "sent"
    assert result.sent is True
    assert result.http_status == 202
    assert calls["json"]["message"] == "digest"


def test_send_teams_dm_reports_failed_http(monkeypatch):
    class _Response:
        status_code = 500
        text = "server error"

    monkeypatch.delenv("EMAIL_DIGEST_DRY_RUN", raising=False)
    monkeypatch.setenv("NOTIFICATION_SERVICE_KEY", "service-key")
    monkeypatch.setattr(run_email_digest.httpx, "post", lambda *_args, **_kwargs: _Response())

    result = run_email_digest._send_teams_dm("digest")

    assert result.status == "failed"
    assert result.sent is False
    assert result.http_status == 500
    assert result.detail == "server error"
