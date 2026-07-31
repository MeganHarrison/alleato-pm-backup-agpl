from src.services.integrations.microsoft_graph import sync
from src.services.integrations.microsoft_graph import onedrive
from src.services.integrations.microsoft_graph.onedrive import SharePointSyncResult


class _FakeGraph:
    def is_configured(self):
        return True


class _FakeSupabase:
    pass


class _EmptyMetadataQuery:
    def select(self, *_args, **_kwargs):
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def execute(self):
        return type("Result", (), {"data": []})()


class _EmptyMetadataSupabase:
    def from_(self, table_name):
        assert table_name == "document_metadata"
        return _EmptyMetadataQuery()


class _FailingDownloadGraph:
    def is_configured(self):
        return True

    def get(self, _path):
        return {"id": "site-id"}

    def get_delta(self, _path, _delta_token):
        return ([
            {
                "id": "file-1",
                "name": "handoff.txt",
                "size": 100,
                "@microsoft.graph.downloadUrl": "https://download.example/file-1",
            }
        ], "new-delta")

    def download_bytes(self, _url):
        raise RuntimeError("temporary download failure")


class _LowContentGraph(_FailingDownloadGraph):
    def download_bytes(self, _url):
        return b"tiny"


class _UnsupportedFileGraph(_FailingDownloadGraph):
    def get_delta(self, _path, _delta_token):
        return ([{"id": "file-2", "name": "estimate.pptx", "size": 100}], "new-delta")


def test_sharepoint_download_failure_preserves_prior_delta(monkeypatch):
    monkeypatch.setattr(onedrive, "get_graph_client", lambda: _FailingDownloadGraph())

    result = onedrive.sync_sharepoint_folder(
        _EmptyMetadataSupabase(),
        "alleato.sharepoint.com",
        "Operations",
        "/SOP",
        "previous-delta",
    )

    assert result.items_synced == 0
    assert result.items_failed == 1
    assert result.retry_required is True
    assert result.delta_token == "previous-delta"


def test_sharepoint_supported_file_with_insufficient_text_preserves_prior_delta(monkeypatch):
    monkeypatch.setattr(onedrive, "get_graph_client", lambda: _LowContentGraph())

    result = onedrive.sync_sharepoint_folder(
        _EmptyMetadataSupabase(),
        "alleato.sharepoint.com",
        "Operations",
        "/SOP",
        "previous-delta",
    )

    assert result.items_synced == 0
    assert result.items_failed == 1
    assert result.retry_required is True
    assert result.delta_token == "previous-delta"
    assert result.retry_reason == (
        "1 SharePoint file(s) failed; the prior delta cursor was preserved for automatic retry."
    )


def test_sharepoint_unsupported_file_type_fails_closed_instead_of_advancing_delta(monkeypatch):
    monkeypatch.setattr(onedrive, "get_graph_client", lambda: _UnsupportedFileGraph())

    result = onedrive.sync_sharepoint_folder(
        _EmptyMetadataSupabase(),
        "alleato.sharepoint.com",
        "Operations",
        "/SOP",
        "previous-delta",
    )

    assert result.items_synced == 0
    assert result.items_failed == 1
    assert result.retry_required is True
    assert result.delta_token == "previous-delta"


def test_sharepoint_file_failures_preserve_delta_and_schedule_recovery(monkeypatch):
    saved_states = []
    runs = []

    monkeypatch.setattr(sync, "get_graph_client", lambda: _FakeGraph())
    monkeypatch.setenv("GRAPH_SYNC_OUTLOOK", "false")
    monkeypatch.setenv("GRAPH_SYNC_TEAMS", "false")
    monkeypatch.setenv("GRAPH_SYNC_TEAMS_DM", "false")
    monkeypatch.setenv("GRAPH_SYNC_ONEDRIVE", "false")
    monkeypatch.setenv("SHAREPOINT_SYNC_FOLDERS", "alleato.sharepoint.com/Operations:/SOP")
    monkeypatch.setattr(sync, "_get_delta_token", lambda *_args, **_kwargs: "previous-delta")
    monkeypatch.setattr(
        sync,
        "sync_sharepoint_folder",
        lambda *_args, **_kwargs: SharePointSyncResult(
            items_synced=3,
            delta_token="previous-delta",
            items_failed=2,
            retry_required=True,
            retry_reason="Two named workbook extractions failed; replay required.",
        ),
    )
    monkeypatch.setattr(sync, "_save_sync_state", lambda *args, **_kwargs: saved_states.append(args))
    monkeypatch.setattr(sync, "_record_sync_run_safe", lambda *_args, **kwargs: runs.append(kwargs))

    result = sync._run_graph_source_reconciliation(
        _FakeSupabase(),
        run_sharepoint=True,
        run_outlook=False,
        run_teams=False,
        run_onedrive=False,
        outlook_users=None,
        verify_outlook_persisted_count=False,
    )

    assert result["sharepoint"] == 3
    assert result["sharepoint_failed"] == 2
    assert result["status"] == "complete_with_errors"
    assert saved_states[0][4] == "previous-delta"
    assert saved_states[0][6] == "warning"
    assert saved_states[0][7] == "Two named workbook extractions failed; replay required."
    assert runs[0]["status"] == "warning"
    assert runs[0]["items_failed"] == 2
    assert runs[0]["error_message"] == "Two named workbook extractions failed; replay required."
    assert runs[0]["metadata"] == {"retry_scheduled": True}


def test_sharepoint_folder_exception_keeps_existing_delta(monkeypatch):
    saved_states = []

    monkeypatch.setattr(sync, "get_graph_client", lambda: _FakeGraph())
    monkeypatch.setenv("GRAPH_SYNC_OUTLOOK", "false")
    monkeypatch.setenv("GRAPH_SYNC_TEAMS", "false")
    monkeypatch.setenv("GRAPH_SYNC_TEAMS_DM", "false")
    monkeypatch.setenv("GRAPH_SYNC_ONEDRIVE", "false")
    monkeypatch.setenv("SHAREPOINT_SYNC_FOLDERS", "alleato.sharepoint.com/Operations:/SOP")
    monkeypatch.setattr(sync, "_get_delta_token", lambda *_args, **_kwargs: "previous-delta")
    monkeypatch.setattr(sync, "sync_sharepoint_folder", lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("temporary Graph outage")))
    monkeypatch.setattr(sync, "_save_sync_state", lambda *args, **_kwargs: saved_states.append(args))
    monkeypatch.setattr(sync, "_record_sync_run_safe", lambda *_args, **_kwargs: None)

    result = sync._run_graph_source_reconciliation(
        _FakeSupabase(),
        run_sharepoint=True,
        run_outlook=False,
        run_teams=False,
        run_onedrive=False,
        outlook_users=None,
        verify_outlook_persisted_count=False,
    )

    assert result["status"] == "complete_with_errors"
    assert saved_states[0][4] == "previous-delta"
    assert saved_states[0][6] == "error"
