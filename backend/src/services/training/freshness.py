"""SSRF-safe, human-gated freshness checks for published training resources."""

from __future__ import annotations

import hashlib
import http.client
import ipaddress
import re
import socket
import ssl
from collections.abc import Callable
from difflib import SequenceMatcher
from typing import Any, Protocol
from urllib.parse import urljoin, urlsplit, urlunsplit

from src.services.supabase_helpers import get_supabase_client
from src.services.training.contracts import (
    TrainingFreshnessEvidence,
    TrainingFreshnessOutcomeRecord,
    TrainingFreshnessRunResponse,
)

MAX_REDIRECTS = 5
MAX_RESPONSE_BYTES = 64 * 1024
MAX_ROTATION_RESOURCES = 5_000
REQUEST_TIMEOUT_SECONDS = 12
USER_AGENT = "AlleatoTrainingFreshness/1.0 (+https://alleatogroup.com)"
TITLE_PATTERN = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)
WHITESPACE_PATTERN = re.compile(r"\s+")


class TrainingResourceFreshnessError(RuntimeError):
    """Named fatal freshness error with operation context."""


class TrainingFreshnessRepository(Protocol):
    def list_rotation_resources(self, limit: int) -> list[dict[str, Any]]: ...

    def record_check(
        self,
        resource_id: str,
        evidence: TrainingFreshnessEvidence,
    ) -> tuple[str, str]: ...


class _PinnedHTTPSConnection(http.client.HTTPSConnection):
    """HTTPS connection whose socket is pinned to a validated DNS result."""

    def __init__(
        self,
        hostname: str,
        port: int,
        pinned_ip: str,
        *,
        timeout: float,
    ):
        super().__init__(
            hostname,
            port,
            timeout=timeout,
            context=ssl.create_default_context(),
        )
        self._pinned_ip = pinned_ip

    def connect(self) -> None:
        raw_socket = socket.create_connection(
            (self._pinned_ip, self.port),
            self.timeout,
            self.source_address,
        )
        self.sock = self._context.wrap_socket(
            raw_socket,
            server_hostname=self.host,
        )


def _is_public_address(value: str) -> bool:
    address = ipaddress.ip_address(value)
    return not (
        address.is_private
        or address.is_loopback
        or address.is_link_local
        or address.is_multicast
        or address.is_reserved
        or address.is_unspecified
    )


def _validated_target(url: str) -> tuple[str, str, int, str]:
    parsed = urlsplit(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise TrainingResourceFreshnessError(
            "TRAINING_RESOURCE_FRESHNESS_UNSAFE_URL: only public http(s) URLs are allowed."
        )
    if parsed.username or parsed.password:
        raise TrainingResourceFreshnessError(
            "TRAINING_RESOURCE_FRESHNESS_UNSAFE_URL: URL credentials are not allowed."
        )

    default_port = 443 if parsed.scheme == "https" else 80
    port = parsed.port or default_port
    if port != default_port:
        raise TrainingResourceFreshnessError(
            "TRAINING_RESOURCE_FRESHNESS_UNSAFE_URL: non-standard ports are not allowed."
        )

    try:
        resolved = {
            item[4][0]
            for item in socket.getaddrinfo(
                parsed.hostname,
                port,
                type=socket.SOCK_STREAM,
            )
        }
    except OSError as exc:
        raise TrainingResourceFreshnessError(
            f"TRAINING_RESOURCE_FRESHNESS_DNS_FAILED: {type(exc).__name__}"
        ) from exc

    if not resolved or any(not _is_public_address(address) for address in resolved):
        raise TrainingResourceFreshnessError(
            "TRAINING_RESOURCE_FRESHNESS_UNSAFE_URL: DNS resolved to a non-public address."
        )

    path = parsed.path or "/"
    if parsed.query:
        path = f"{path}?{parsed.query}"
    normalized_url = urlunsplit(
        (parsed.scheme, parsed.netloc, parsed.path or "/", parsed.query, "")
    )
    return normalized_url, parsed.hostname, port, sorted(resolved)[0]


def _request_once(url: str) -> tuple[int, dict[str, str], bytes]:
    normalized_url, hostname, port, pinned_ip = _validated_target(url)
    parsed = urlsplit(normalized_url)
    path = parsed.path or "/"
    if parsed.query:
        path = f"{path}?{parsed.query}"

    if parsed.scheme == "https":
        connection: http.client.HTTPConnection = _PinnedHTTPSConnection(
            hostname,
            port,
            pinned_ip,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    else:
        connection = http.client.HTTPConnection(
            pinned_ip,
            port,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )

    host_header = hostname if port in {80, 443} else f"{hostname}:{port}"
    try:
        connection.request(
            "GET",
            path,
            headers={
                "Accept": "text/html,application/xhtml+xml,text/plain,application/pdf;q=0.8,*/*;q=0.1",
                "Accept-Encoding": "identity",
                "Host": host_header,
                "Range": f"bytes=0-{MAX_RESPONSE_BYTES - 1}",
                "User-Agent": USER_AGENT,
            },
        )
        response = connection.getresponse()
        headers = {key.lower(): value for key, value in response.getheaders()}
        body = response.read(MAX_RESPONSE_BYTES + 1)
        return response.status, headers, body[:MAX_RESPONSE_BYTES]
    finally:
        connection.close()


def _extract_title(body: bytes, content_type: str | None) -> str | None:
    if content_type and not any(
        allowed in content_type.lower()
        for allowed in ("text/html", "application/xhtml+xml")
    ):
        return None
    text = body.decode("utf-8", errors="replace")
    match = TITLE_PATTERN.search(text)
    if not match:
        return None
    title = WHITESPACE_PATTERN.sub(" ", match.group(1)).strip()
    return title[:300] or None


def _normalized_title(value: str) -> str:
    return WHITESPACE_PATTERN.sub(
        " ",
        re.sub(r"[^a-z0-9 ]+", " ", value.lower()),
    ).strip()


def _title_changed(expected: str, observed: str | None) -> bool:
    if not observed:
        return False
    left = _normalized_title(expected)
    right = _normalized_title(observed)
    if not left or not right or left in right or right in left:
        return False
    return SequenceMatcher(None, left, right).ratio() < 0.65


def _fingerprint(
    outcome: str,
    final_url: str,
    http_status: int | None,
    observed_title: str | None,
) -> str:
    material = "|".join(
        (
            outcome,
            final_url,
            str(http_status or ""),
            _normalized_title(observed_title or ""),
        )
    )
    return hashlib.sha256(material.encode("utf-8")).hexdigest()


def inspect_training_resource(resource: dict[str, Any]) -> TrainingFreshnessEvidence:
    """Fetch one resource through a DNS-pinned connection and classify it."""

    original_url = str(resource["url"])
    current_url = original_url
    status: int | None = None
    headers: dict[str, str] = {}
    body = b""
    redirect_count = 0

    try:
        for redirect_count in range(MAX_REDIRECTS + 1):
            status, headers, body = _request_once(current_url)
            if status not in {301, 302, 303, 307, 308}:
                break
            location = headers.get("location")
            if not location:
                break
            if redirect_count == MAX_REDIRECTS:
                raise TrainingResourceFreshnessError(
                    "TRAINING_RESOURCE_FRESHNESS_REDIRECT_LIMIT: too many redirects."
                )
            current_url = urljoin(current_url, location)
            _validated_target(current_url)
    except (
        OSError,
        TimeoutError,
        ssl.SSLError,
        http.client.HTTPException,
        TrainingResourceFreshnessError,
    ) as exc:
        outcome = "blocked"
        safe_reason = (
            str(exc)
            if isinstance(exc, TrainingResourceFreshnessError)
            else type(exc).__name__
        )
        return TrainingFreshnessEvidence(
            outcome=outcome,
            fingerprint=_fingerprint(outcome, current_url, None, None),
            recommendedAction="keep",
            finalUrl=current_url,
            evidence={
                "reason": safe_reason[:300],
                "policy": "dns-pinned-public-http-v1",
            },
        )

    observed_title = _extract_title(body, headers.get("content-type"))
    if status in {404, 410}:
        outcome = "unavailable"
        recommended_action = "archive"
    elif status is not None and 200 <= status < 300:
        if current_url != original_url:
            outcome = "redirected"
        elif _title_changed(str(resource["title"]), observed_title):
            outcome = "title_changed"
        else:
            outcome = "healthy"
        recommended_action = "keep"
    else:
        outcome = "blocked"
        recommended_action = "keep"

    return TrainingFreshnessEvidence(
        outcome=outcome,
        fingerprint=_fingerprint(
            outcome,
            current_url,
            status,
            observed_title,
        ),
        recommendedAction=recommended_action,
        httpStatus=status,
        finalUrl=current_url,
        observedTitle=observed_title,
        evidence={
            "contentType": headers.get("content-type"),
            "redirectCount": redirect_count,
            "policy": "dns-pinned-public-http-v1",
        },
    )


class SupabaseTrainingFreshnessRepository:
    """Service-role adapter constrained to reads plus the freshness RPC."""

    def __init__(self, client: Any | None = None):
        self._client = client or get_supabase_client()

    def list_rotation_resources(self, limit: int) -> list[dict[str, Any]]:
        if limit < 1 or limit > 100:
            raise ValueError("max_resources must be between 1 and 100")
        try:
            resources = (
                self._client.table("training_resource")
                .select("id,title,url")
                .eq("status", "published")
                .limit(MAX_ROTATION_RESOURCES + 1)
                .execute()
                .data
                or []
            )
            if len(resources) > MAX_ROTATION_RESOURCES:
                raise TrainingResourceFreshnessError(
                    "TRAINING_RESOURCE_FRESHNESS_ROTATION_FAILED: published resource count exceeded the bounded rotation query."
                )
            checks = (
                self._client.table("training_resource_freshness_checks")
                .select("resource_id,last_seen_at")
                .order("last_seen_at", desc=True)
                .limit(MAX_ROTATION_RESOURCES * 4)
                .execute()
                .data
                or []
            )
        except TrainingResourceFreshnessError:
            raise
        except Exception as exc:
            raise TrainingResourceFreshnessError(
                f"TRAINING_RESOURCE_FRESHNESS_ROTATION_FAILED: {exc}"
            ) from exc

        latest_by_resource: dict[str, str] = {}
        for check in checks:
            resource_id = str(check.get("resource_id") or "")
            last_seen_at = str(check.get("last_seen_at") or "")
            if resource_id and (
                resource_id not in latest_by_resource
                or last_seen_at > latest_by_resource[resource_id]
            ):
                latest_by_resource[resource_id] = last_seen_at

        return sorted(
            (dict(resource) for resource in resources),
            key=lambda resource: (
                latest_by_resource.get(str(resource["id"]), ""),
                str(resource["id"]),
            ),
        )[:limit]

    def record_check(
        self,
        resource_id: str,
        evidence: TrainingFreshnessEvidence,
    ) -> tuple[str, str]:
        payload = {
            "p_resource_id": resource_id,
            "p_outcome": evidence.outcome,
            "p_evidence_fingerprint": evidence.fingerprint,
            "p_recommended_action": evidence.recommended_action,
            "p_http_status": evidence.http_status,
            "p_final_url": evidence.final_url,
            "p_observed_title": evidence.observed_title,
            "p_evidence": evidence.evidence,
        }
        try:
            check_id = (
                self._client.rpc(
                    "record_training_resource_freshness_check",
                    payload,
                )
                .execute()
                .data
            )
            if not check_id:
                raise TrainingResourceFreshnessError(
                    "TRAINING_RESOURCE_FRESHNESS_RECORD_FAILED: RPC returned no check id."
                )
            rows = (
                self._client.table("training_resource_freshness_checks")
                .select("review_status")
                .eq("id", str(check_id))
                .limit(1)
                .execute()
                .data
                or []
            )
        except TrainingResourceFreshnessError:
            raise
        except Exception as exc:
            raise TrainingResourceFreshnessError(
                f"TRAINING_RESOURCE_FRESHNESS_RECORD_FAILED: {exc}"
            ) from exc
        if len(rows) != 1:
            raise TrainingResourceFreshnessError(
                "TRAINING_RESOURCE_FRESHNESS_RECORD_FAILED: check read-back was missing."
            )
        return str(check_id), str(rows[0]["review_status"])


def run_training_resource_freshness(
    *,
    max_resources: int = 20,
    repository: TrainingFreshnessRepository | None = None,
    inspector: Callable[[dict[str, Any]], TrainingFreshnessEvidence] = (
        inspect_training_resource
    ),
) -> TrainingFreshnessRunResponse:
    """Inspect the oldest unchecked resources and record every outcome."""

    repo = repository or SupabaseTrainingFreshnessRepository()
    resources = repo.list_rotation_resources(max_resources)
    outcomes: list[TrainingFreshnessOutcomeRecord] = []
    recorded_count = 0
    pending_count = 0
    failed_count = 0

    for resource in resources:
        resource_id = str(resource["id"])
        title = str(resource["title"])
        try:
            evidence = inspector(resource)
            check_id, review_status = repo.record_check(resource_id, evidence)
            recorded_count += 1
            if review_status == "pending":
                pending_count += 1
            outcomes.append(
                TrainingFreshnessOutcomeRecord(
                    resourceId=resource_id,
                    title=title,
                    checkId=check_id,
                    outcome=evidence.outcome,
                    reviewStatus=review_status,
                )
            )
        except Exception as exc:
            failed_count += 1
            error = (
                str(exc)
                if isinstance(exc, TrainingResourceFreshnessError)
                else f"TRAINING_RESOURCE_FRESHNESS_UNEXPECTED: {type(exc).__name__}"
            )
            outcomes.append(
                TrainingFreshnessOutcomeRecord(
                    resourceId=resource_id,
                    title=title,
                    error=error[:500],
                )
            )

    return TrainingFreshnessRunResponse(
        status="completed" if failed_count == 0 else "failed",
        checkedCount=len(resources),
        recordedCount=recorded_count,
        pendingCount=pending_count,
        failedCount=failed_count,
        outcomes=outcomes,
    )
