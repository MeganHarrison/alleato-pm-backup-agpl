from services.integrations.microsoft_graph import live_mail


class _Graph:
    GRAPH_BASE = "https://graph.microsoft.com/v1.0"

    def __init__(self):
        self.urls = []

    def is_configured(self):
        return True

    def _get_with_retry(self, url, max_retries=None, base_delay=None):
        self.urls.append(
            {
                "url": url,
                "max_retries": max_retries,
                "base_delay": base_delay,
            }
        )
        return {
            "value": [
                {
                    "id": "message-1",
                    "conversationId": "conversation-1",
                    "subject": " Pay app question ",
                    "from": {
                        "emailAddress": {
                            "name": "Owner",
                            "address": "Owner@Example.com",
                        }
                    },
                    "toRecipients": [
                        {"emailAddress": {"address": "brandon@example.com"}}
                    ],
                    "ccRecipients": [
                        {"emailAddress": {"address": "pm@example.com"}}
                    ],
                    "receivedDateTime": "2026-05-19T12:00:00Z",
                    "bodyPreview": "Can you check the attached pay app?",
                    "hasAttachments": True,
                    "webLink": "https://outlook.office.com/mail/message-1",
                    "importance": "high",
                    "isRead": False,
                }
            ],
            "@odata.nextLink": "https://graph.microsoft.com/v1.0/next",
        }


def test_live_outlook_inbox_reads_graph_and_marks_live_source(monkeypatch):
    graph = _Graph()
    monkeypatch.setattr(live_mail, "get_graph_client", lambda: graph)

    result = live_mail.list_live_outlook_inbox(
        mailbox_user_id="Brandon@Example.com",
        since_iso="2026-05-19T00:00:00.000Z",
        limit=150,
    )

    assert result["source"] == "microsoft_graph_live"
    assert result["mailbox_user_id"] == "brandon@example.com"
    assert result["since_iso"] == "2026-05-19T00:00:00.000Z"
    assert result["count"] == 1
    assert result["truncated"] is True
    assert graph.urls[0]["max_retries"] == 1
    assert graph.urls[0]["base_delay"] == 0.5
    assert "/users/brandon%40example.com/mailFolders/Inbox/messages?" in graph.urls[0]["url"]
    assert "%24top=100" in graph.urls[0]["url"]
    assert "receivedDateTime+ge+2026-05-19T00%3A00%3A00.000Z" in graph.urls[0]["url"]
    assert result["unread_only"] is False

    message = result["messages"][0]
    assert message["id"] == "message-1"
    assert message["graph_message_id"] == "message-1"
    assert message["conversation_id"] == "conversation-1"
    assert message["subject"] == "Pay app question"
    assert message["from_name"] == "Owner"
    assert message["from_email"] == "owner@example.com"
    assert message["to_list"] == ["brandon@example.com"]
    assert message["cc_list"] == ["pm@example.com"]
    assert message["body_text"] == "Can you check the attached pay app?"
    assert message["has_attachments"] is True
    assert message["importance"] == "high"
    assert message["is_read"] is False


def test_live_outlook_inbox_can_filter_to_unread_messages(monkeypatch):
    graph = _Graph()
    monkeypatch.setattr(live_mail, "get_graph_client", lambda: graph)

    result = live_mail.list_live_outlook_inbox(
        mailbox_user_id="Brandon@Example.com",
        since_iso="2026-05-19T00:00:00.000Z",
        limit=5,
        unread_only=True,
    )

    assert result["unread_only"] is True
    assert "isRead+eq+false" in graph.urls[0]["url"]
    assert "receivedDateTime+ge+2026-05-19T00%3A00%3A00.000Z+and+isRead+eq+false" in graph.urls[0]["url"]
