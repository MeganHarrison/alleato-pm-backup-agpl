"""Governed SharePoint project-folder discovery and sync selection.

The production sync used to treat ``SHAREPOINT_SYNC_FOLDERS`` as the complete
source universe. That made three hand-entered subfolders look healthy while
dozens of project folders were never enumerated. This module makes the
SharePoint tree the inventory owner and keeps the env list only as an additive
override for exceptional folders.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import json
import os
import re
from typing import Any, Iterable, Mapping, Sequence
from urllib.parse import unquote


DEFAULT_SITE = "alleato.sharepoint.com/AlleatoGroup"
DEFAULT_PROJECTS_BASE = "Alleato Group/Alleato Group-Shared"
YEAR_FOLDER_PATTERN = re.compile(r"^(?P<year>20\d{2}) Jobs$", re.IGNORECASE)
JOB_FOLDER_PATTERN = re.compile(r"^(?P<number>\d{2}\s*-\s*\d{3})\b")


def _bounded_int_env(
    name: str,
    default: int,
    *,
    minimum: int = 1,
    maximum: int = 1000,
) -> int:
    try:
        value = int(os.environ.get(name, str(default)))
    except (TypeError, ValueError):
        value = default
    return max(minimum, min(maximum, value))


def _enabled(name: str, default: bool) -> bool:
    fallback = "true" if default else "false"
    return os.environ.get(name, fallback).strip().lower() == "true"


def _normalize_folder_path(value: str) -> str:
    normalized = unquote(str(value or "").strip()).strip("/")
    return f"/{normalized}" if normalized else "/"


def _split_site(value: str) -> tuple[str, str]:
    site = str(value or "").strip().strip("/")
    if "/" not in site:
        raise ValueError(
            "SharePoint site must use '<hostname>/<site-name>', "
            f"received {value!r}"
        )
    hostname, site_name = site.split("/", 1)
    if not hostname or not site_name:
        raise ValueError(f"Invalid SharePoint site {value!r}")
    return hostname, site_name


@dataclass(frozen=True)
class SharePointScope:
    hostname: str
    site_name: str
    folder_path: str
    source: str
    project_number: str | None = None
    project_folder: str | None = None
    year: int | None = None

    @property
    def resource_id(self) -> str:
        return f"sharepoint:{self.site_name}:{self.folder_path}"

    @property
    def resource_name(self) -> str:
        return f"SharePoint: {self.site_name}{self.folder_path}"

    @property
    def entry(self) -> str:
        return f"{self.hostname}/{self.site_name}:{self.folder_path}"


@dataclass(frozen=True)
class SharePointDiscoveryResult:
    scopes: tuple[SharePointScope, ...]
    year_roots: tuple[str, ...]
    excluded_children: tuple[dict[str, Any], ...] = ()
    explicit_scope_count: int = 0
    discovery_enabled: bool = True

    def receipt(self) -> dict[str, Any]:
        return {
            "discovery_enabled": self.discovery_enabled,
            "year_roots": list(self.year_roots),
            "year_root_count": len(self.year_roots),
            "scope_count": len(self.scopes),
            "explicit_scope_count": self.explicit_scope_count,
            "excluded_child_count": len(self.excluded_children),
            "resource_ids": [scope.resource_id for scope in self.scopes],
        }


@dataclass(frozen=True)
class SharePointScopeSelection:
    selected: tuple[SharePointScope, ...]
    established_count: int
    bootstrap_selected_count: int
    bootstrap_pending_count: int
    incremental_pending_count: int = 0

    def receipt(self) -> dict[str, int]:
        return {
            "selected_count": len(self.selected),
            "established_count": self.established_count,
            "bootstrap_selected_count": self.bootstrap_selected_count,
            "bootstrap_pending_count": self.bootstrap_pending_count,
            "incremental_pending_count": self.incremental_pending_count,
        }


def parse_explicit_sharepoint_scopes(raw: str | None = None) -> list[SharePointScope]:
    """Parse additive governed overrides.

    JSON arrays are the canonical form because real SharePoint folder names
    routinely contain commas. The legacy comma-delimited form remains accepted
    for simple paths that do not contain commas.
    """
    value = os.environ.get("SHAREPOINT_SYNC_FOLDERS", "") if raw is None else raw
    normalized_value = str(value or "").strip()
    if normalized_value.startswith(("[", "{")):
        try:
            decoded = json.loads(normalized_value)
        except json.JSONDecodeError as exc:
            raise ValueError(
                "SHAREPOINT_SYNC_FOLDERS must be a valid JSON string array"
            ) from exc
        if not isinstance(decoded, list) or not all(
            isinstance(entry, str) for entry in decoded
        ):
            raise ValueError(
                "SHAREPOINT_SYNC_FOLDERS JSON value must be a string array"
            )
        entries = [entry.strip() for entry in decoded if entry.strip()]
    else:
        entries = [
            part.strip()
            for part in normalized_value.split(",")
            if part.strip()
        ]
    scopes: list[SharePointScope] = []
    for entry in entries:
        site_part, folder_path = (
            entry.split(":", 1) if ":" in entry else (entry, "/")
        )
        hostname, site_name = _split_site(site_part)
        scopes.append(
            SharePointScope(
                hostname=hostname,
                site_name=site_name,
                folder_path=_normalize_folder_path(folder_path),
                source="explicit",
            )
        )
    return scopes


def _graph_children(graph: Any, site_id: str, folder_path: str) -> list[dict[str, Any]]:
    clean_path = folder_path.strip("/")
    path = (
        f"/sites/{site_id}/drive/root:/{clean_path}:/children"
        if clean_path
        else f"/sites/{site_id}/drive/root/children"
    )
    max_pages = _bounded_int_env(
        "SHAREPOINT_DISCOVERY_MAX_PAGES",
        50,
        minimum=1,
        maximum=200,
    )
    max_items = _bounded_int_env(
        "SHAREPOINT_DISCOVERY_MAX_CHILDREN",
        5000,
        minimum=1,
        maximum=10000,
    )
    rows: list[dict[str, Any]] = []
    next_url: str | None = path
    pages = 0
    while next_url:
        if pages >= max_pages:
            raise RuntimeError(
                "SharePoint discovery page cap reached before the child list "
                f"completed for {folder_path}: pages={pages}, items={len(rows)}"
            )
        data = graph.get(next_url)
        page = list(data.get("value") or [])
        if len(rows) + len(page) > max_items:
            raise RuntimeError(
                "SharePoint discovery child cap reached before the child list "
                f"completed for {folder_path}: limit={max_items}"
            )
        rows.extend(page)
        next_url = data.get("@odata.nextLink")
        pages += 1
    return rows


def _job_number(folder_name: str) -> str | None:
    match = JOB_FOLDER_PATTERN.match(folder_name.strip())
    if not match:
        return None
    return re.sub(r"\s+", "", match.group("number"))


def _dedupe_scopes(scopes: Iterable[SharePointScope]) -> list[SharePointScope]:
    deduped: dict[tuple[str, str, str], SharePointScope] = {}
    for scope in scopes:
        key = (
            scope.hostname.lower(),
            scope.site_name.lower(),
            scope.folder_path.rstrip("/").lower(),
        )
        existing = deduped.get(key)
        if existing is None or (
            existing.source == "explicit" and scope.source == "discovered"
        ):
            deduped[key] = scope
    return sorted(
        deduped.values(),
        key=lambda scope: (
            scope.year or 9999,
            scope.project_number or "",
            scope.folder_path.lower(),
        ),
    )


def _remove_redundant_explicit_scopes(
    discovered: Sequence[SharePointScope],
    explicit: Sequence[SharePointScope],
) -> list[SharePointScope]:
    kept: list[SharePointScope] = []
    for candidate in explicit:
        candidate_path = candidate.folder_path.rstrip("/").lower()
        covered = any(
            candidate.hostname.lower() == scope.hostname.lower()
            and candidate.site_name.lower() == scope.site_name.lower()
            and (
                candidate_path == scope.folder_path.rstrip("/").lower()
                or candidate_path.startswith(
                    f"{scope.folder_path.rstrip('/').lower()}/"
                )
            )
            for scope in discovered
        )
        if not covered:
            kept.append(candidate)
    return kept


def discover_sharepoint_project_scopes(
    graph: Any,
    *,
    now: datetime | None = None,
) -> SharePointDiscoveryResult:
    """Enumerate governed job-folder scopes from the canonical SharePoint tree."""
    explicit = parse_explicit_sharepoint_scopes()
    discovery_enabled = _enabled("SHAREPOINT_PROJECT_DISCOVERY_ENABLED", False)
    if not discovery_enabled:
        if not explicit:
            raise RuntimeError(
                "SharePoint sync is enabled but neither project discovery nor "
                "SHAREPOINT_SYNC_FOLDERS supplied a source scope"
            )
        return SharePointDiscoveryResult(
            scopes=tuple(_dedupe_scopes(explicit)),
            year_roots=(),
            explicit_scope_count=len(explicit),
            discovery_enabled=False,
        )

    hostname, site_name = _split_site(
        os.environ.get("SHAREPOINT_PROJECT_SITE", DEFAULT_SITE)
    )
    base_folder = _normalize_folder_path(
        os.environ.get("SHAREPOINT_PROJECTS_BASE", DEFAULT_PROJECTS_BASE)
    )
    site_lookup = graph.get(f"/sites/{hostname}:/sites/{site_name}")
    site_id = str(site_lookup.get("id") or "").strip()
    if not site_id:
        raise RuntimeError(
            f"SharePoint discovery could not resolve {hostname}:/sites/{site_name}"
        )

    current_year = (now or datetime.now(timezone.utc)).year
    lookback = _bounded_int_env(
        "SHAREPOINT_PROJECT_YEAR_LOOKBACK",
        4,
        minimum=1,
        maximum=10,
    )
    minimum_year = current_year - lookback + 1
    maximum_year = current_year + 1
    configured_minimum = os.environ.get("SHAREPOINT_PROJECT_MIN_YEAR", "").strip()
    if configured_minimum:
        try:
            minimum_year = int(configured_minimum)
        except ValueError as exc:
            raise ValueError(
                "SHAREPOINT_PROJECT_MIN_YEAR must be a four-digit year"
            ) from exc

    base_children = _graph_children(graph, site_id, base_folder)
    year_folders: list[tuple[int, str]] = []
    excluded: list[dict[str, Any]] = []
    for child in base_children:
        name = str(child.get("name") or "")
        match = YEAR_FOLDER_PATTERN.match(name)
        if not match or "folder" not in child:
            continue
        year = int(match.group("year"))
        if minimum_year <= year <= maximum_year:
            year_folders.append((year, name))
        else:
            excluded.append(
                {
                    "name": name,
                    "reason": "outside_governed_year_window",
                    "year": year,
                }
            )

    if not year_folders:
        raise RuntimeError(
            "SharePoint discovery found no governed '<YYYY> Jobs' roots under "
            f"{base_folder} for {minimum_year}-{maximum_year}"
        )

    discovered: list[SharePointScope] = []
    year_roots: list[str] = []
    for year, year_name in sorted(year_folders):
        year_root = f"{base_folder.rstrip('/')}/{year_name}"
        year_roots.append(year_root)
        for child in _graph_children(graph, site_id, year_root):
            name = str(child.get("name") or "").strip()
            if "folder" not in child:
                excluded.append(
                    {
                        "name": name,
                        "parent": year_root,
                        "reason": "year_root_non_folder_item",
                    }
                )
                continue
            project_number = _job_number(name)
            if not project_number:
                excluded.append(
                    {
                        "name": name,
                        "parent": year_root,
                        "reason": "not_a_numbered_project_folder",
                    }
                )
                continue
            discovered.append(
                SharePointScope(
                    hostname=hostname,
                    site_name=site_name,
                    folder_path=f"{year_root}/{name}",
                    source="discovered",
                    project_number=project_number,
                    project_folder=name,
                    year=year,
                )
            )

    if not discovered:
        raise RuntimeError(
            "SharePoint discovery found year roots but no numbered project folders"
        )

    explicit_additions = _remove_redundant_explicit_scopes(discovered, explicit)
    scopes = _dedupe_scopes([*discovered, *explicit_additions])
    max_scopes = _bounded_int_env(
        "SHAREPOINT_PROJECT_DISCOVERY_MAX_SCOPES",
        250,
        minimum=1,
        maximum=1000,
    )
    if len(scopes) > max_scopes:
        raise RuntimeError(
            "SharePoint discovery exceeded the governed scope cap: "
            f"{len(scopes)} > {max_scopes}. Increase the cap deliberately after "
            "reviewing the discovered tree."
        )

    return SharePointDiscoveryResult(
        scopes=tuple(scopes),
        year_roots=tuple(year_roots),
        excluded_children=tuple(excluded),
        explicit_scope_count=len(explicit_additions),
        discovery_enabled=True,
    )


def select_sharepoint_scopes(
    scopes: Sequence[SharePointScope],
    state_by_resource_id: Mapping[str, Mapping[str, Any]],
) -> SharePointScopeSelection:
    """Keep all initialized scopes current while bounding historical bootstrap."""
    established: list[SharePointScope] = []
    bootstrap: list[SharePointScope] = []
    for scope in scopes:
        state = state_by_resource_id.get(scope.resource_id) or {}
        if str(state.get("delta_token") or "").strip():
            established.append(scope)
        else:
            bootstrap.append(scope)

    incremental_limit = _bounded_int_env(
        "SHAREPOINT_INCREMENTAL_MAX_FOLDERS",
        200,
        minimum=1,
        maximum=1000,
    )
    established = sorted(
        established,
        key=lambda scope: (
            str(
                (
                    state_by_resource_id.get(scope.resource_id) or {}
                ).get("last_sync_at")
                or ""
            ),
            scope.resource_id,
        ),
    )
    selected_established = established[:incremental_limit]

    bootstrap_limit = _bounded_int_env(
        "SHAREPOINT_BOOTSTRAP_MAX_FOLDERS",
        _bounded_int_env(
            "SHAREPOINT_SYNC_MAX_FOLDERS",
            2,
            minimum=1,
            maximum=1000,
        ),
        minimum=1,
        maximum=1000,
    )
    bootstrap = sorted(
        bootstrap,
        key=lambda scope: (
            -(scope.year or 0),
            str(
                (
                    state_by_resource_id.get(scope.resource_id) or {}
                ).get("last_sync_at")
                or ""
            ),
            scope.resource_id,
        ),
    )
    selected_bootstrap = bootstrap[:bootstrap_limit]
    return SharePointScopeSelection(
        selected=tuple([*selected_established, *selected_bootstrap]),
        established_count=len(established),
        bootstrap_selected_count=len(selected_bootstrap),
        bootstrap_pending_count=max(0, len(bootstrap) - len(selected_bootstrap)),
        incremental_pending_count=max(
            0, len(established) - len(selected_established)
        ),
    )


def sharepoint_resource_ids_from_receipt(
    metadata_rows: Sequence[Mapping[str, Any]],
) -> set[str]:
    """Read the most recent discovery receipt without calling Graph from health."""
    for row in metadata_rows:
        metadata = row.get("metadata")
        if not isinstance(metadata, dict):
            continue
        discovery = metadata.get("sharepoint_discovery")
        if not isinstance(discovery, dict):
            continue
        resource_ids = discovery.get("resource_ids")
        if isinstance(resource_ids, list):
            return {
                str(resource_id)
                for resource_id in resource_ids
                if str(resource_id or "").strip()
            }
    return set()
