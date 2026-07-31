from datetime import datetime, timezone

import pytest

from src.services.integrations.microsoft_graph.sharepoint_scopes import (
    discover_sharepoint_project_scopes,
    parse_explicit_sharepoint_scopes,
    select_sharepoint_scopes,
)


class _DiscoveryGraph:
    def get(self, path):
        if path == "/sites/alleato.sharepoint.com:/sites/AlleatoGroup":
            return {"id": "site-id"}
        if path.endswith("Alleato Group/Alleato Group-Shared:/children"):
            return {"value": [
                {"name": "2022 Jobs", "folder": {"childCount": 1}},
                {"name": "2025 Jobs", "folder": {"childCount": 2}},
                {"name": "2026 Jobs", "folder": {"childCount": 4}},
                {"name": "Marketing", "folder": {"childCount": 1}},
            ]}
        if path.endswith("2025 Jobs:/children"):
            return {"value": [
                {
                    "name": "25- 107 Port Collective (Savannah, GA)",
                    "folder": {"childCount": 14},
                },
                {"name": "Project Permits", "folder": {"childCount": 0}},
            ]}
        if path.endswith("2026 Jobs:/children"):
            return {"value": [
                {
                    "name": "26-119 - Union Collective (Union, KY)",
                    "folder": {"childCount": 22},
                },
                {
                    "name": "26 - 123 Wing House (Largo, FL)",
                    "folder": {"childCount": 16},
                },
                {"name": "Team Project Review", "folder": {"childCount": 3}},
                {"name": "Owner_Billings_Tracker.xlsx", "file": {}},
            ]}
        raise AssertionError(path)


def test_explicit_scope_json_preserves_commas_in_real_folder_names():
    scopes = parse_explicit_sharepoint_scopes(
        '["alleato.sharepoint.com/AlleatoGroup:/Alleato Group/'
        'Alleato Group-Shared/2026 Jobs/26-112 - McLane Jazz '
        '(Salt Lake City, UT)"]'
    )

    assert len(scopes) == 1
    assert scopes[0].folder_path.endswith(
        "26-112 - McLane Jazz (Salt Lake City, UT)"
    )


@pytest.mark.parametrize(
    "raw",
    (
        '["unterminated"',
        '{"not": "a list"}',
        '["valid", 42]',
    ),
)
def test_explicit_scope_json_fails_loudly_for_invalid_contract(raw):
    with pytest.raises(ValueError, match="SHAREPOINT_SYNC_FOLDERS"):
        parse_explicit_sharepoint_scopes(raw)


def test_discovery_enumerates_numbered_project_folders_and_dedupes_nested_override(
    monkeypatch,
):
    monkeypatch.setenv("SHAREPOINT_PROJECT_DISCOVERY_ENABLED", "true")
    monkeypatch.setenv("SHAREPOINT_PROJECT_YEAR_LOOKBACK", "2")
    monkeypatch.setenv(
        "SHAREPOINT_SYNC_FOLDERS",
        "alleato.sharepoint.com/AlleatoGroup:/Alleato Group/Alleato Group-Shared/"
        "2026 Jobs/26-119 - Union Collective (Union%2C KY)/05 - Proposal",
    )

    result = discover_sharepoint_project_scopes(
        _DiscoveryGraph(),
        now=datetime(2026, 7, 24, tzinfo=timezone.utc),
    )

    assert [scope.project_number for scope in result.scopes] == [
        "25-107",
        "26-119",
        "26-123",
    ]
    assert result.explicit_scope_count == 0
    assert result.receipt()["scope_count"] == 3
    assert {row["reason"] for row in result.excluded_children} == {
        "outside_governed_year_window",
        "not_a_numbered_project_folder",
        "year_root_non_folder_item",
    }


def test_selection_keeps_established_scopes_current_and_bounds_only_bootstrap(
    monkeypatch,
):
    monkeypatch.setenv("SHAREPOINT_PROJECT_DISCOVERY_ENABLED", "true")
    monkeypatch.setenv("SHAREPOINT_PROJECT_YEAR_LOOKBACK", "2")
    monkeypatch.setenv("SHAREPOINT_SYNC_FOLDERS", "")
    monkeypatch.setenv("SHAREPOINT_BOOTSTRAP_MAX_FOLDERS", "1")

    discovery = discover_sharepoint_project_scopes(
        _DiscoveryGraph(),
        now=datetime(2026, 7, 24, tzinfo=timezone.utc),
    )
    first = discovery.scopes[0]
    states = {
        first.resource_id: {
            "delta_token": "cursor",
            "last_sync_at": "2026-07-24T08:00:00+00:00",
        }
    }

    selection = select_sharepoint_scopes(discovery.scopes, states)

    assert first in selection.selected
    assert selection.established_count == 1
    assert selection.bootstrap_selected_count == 1
    assert selection.bootstrap_pending_count == 1
    assert len(selection.selected) == 2
    bootstrap_scope = next(
        scope for scope in selection.selected if scope is not first
    )
    assert bootstrap_scope.year == 2026


def test_discovery_fails_loudly_when_no_project_folders_exist(monkeypatch):
    class _EmptyGraph(_DiscoveryGraph):
        def get(self, path):
            if path == "/sites/alleato.sharepoint.com:/sites/AlleatoGroup":
                return {"id": "site-id"}
            if path.endswith("Alleato Group/Alleato Group-Shared:/children"):
                return {
                    "value": [
                        {"name": "2026 Jobs", "folder": {"childCount": 1}}
                    ]
                }
            return {
                "value": [
                    {"name": "Team Project Review", "folder": {"childCount": 3}}
                ]
            }

    monkeypatch.setenv("SHAREPOINT_PROJECT_DISCOVERY_ENABLED", "true")
    monkeypatch.setenv("SHAREPOINT_PROJECT_YEAR_LOOKBACK", "2")
    monkeypatch.setenv("SHAREPOINT_SYNC_FOLDERS", "")

    try:
        discover_sharepoint_project_scopes(
            _EmptyGraph(),
            now=datetime(2026, 7, 24, tzinfo=timezone.utc),
        )
    except RuntimeError as exc:
        assert "no numbered project folders" in str(exc)
    else:
        raise AssertionError("discovery should fail when no project folders exist")


def test_discovery_fails_loudly_when_child_pagination_is_capped(monkeypatch):
    class _CappedGraph(_DiscoveryGraph):
        def get(self, path):
            if path == "/sites/alleato.sharepoint.com:/sites/AlleatoGroup":
                return {"id": "site-id"}
            return {
                "value": [{"name": "2026 Jobs", "folder": {"childCount": 1}}],
                "@odata.nextLink": "https://graph.microsoft.test/next",
            }

    monkeypatch.setenv("SHAREPOINT_PROJECT_DISCOVERY_ENABLED", "true")
    monkeypatch.setenv("SHAREPOINT_PROJECT_YEAR_LOOKBACK", "2")
    monkeypatch.setenv("SHAREPOINT_SYNC_FOLDERS", "")
    monkeypatch.setenv("SHAREPOINT_DISCOVERY_MAX_PAGES", "1")

    try:
        discover_sharepoint_project_scopes(
            _CappedGraph(),
            now=datetime(2026, 7, 24, tzinfo=timezone.utc),
        )
    except RuntimeError as exc:
        assert "page cap reached" in str(exc)
    else:
        raise AssertionError("discovery must fail instead of truncating children")
