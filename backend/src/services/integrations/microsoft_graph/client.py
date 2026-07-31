"""
Microsoft Graph API Client
Handles OAuth 2.0 client credentials flow and HTTP requests.
"""
import os
import time
import logging
import httpx
from typing import Any, Optional

# Transient OS/network errors that are safe to retry
_RETRY_ERRNO = {35, 11, 110, 104}  # EAGAIN, EWOULDBLOCK, ETIMEDOUT, ECONNRESET

logger = logging.getLogger(__name__)

GRAPH_BASE = "https://graph.microsoft.com/v1.0"
TOKEN_URL = "https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"


def _bounded_int_env(name: str, default: int, minimum: int, maximum: int) -> int:
    try:
        value = int(os.environ.get(name, str(default)))
    except ValueError:
        logger.warning("[Graph] Invalid integer for %s; using %d", name, default)
        value = default
    return max(minimum, min(value, maximum))


class GraphClient:
    """Microsoft Graph API client with automatic token refresh."""

    GRAPH_BASE = GRAPH_BASE  # expose as instance attribute for callers

    def __init__(self):
        self.client_id = os.environ.get("MICROSOFT_CLIENT_ID", "")
        self.client_secret = os.environ.get("MICROSOFT_CLIENT_SECRET", "")
        self.tenant_id = os.environ.get("MICROSOFT_TENANT_ID", "")
        self._token: Optional[str] = None
        self._token_expiry: float = 0.0

    def is_configured(self) -> bool:
        return bool(self.client_id and self.client_secret and self.tenant_id)

    def _get_token(self) -> str:
        """Return cached token or fetch a new one."""
        if self._token and time.time() < self._token_expiry - 60:
            return self._token

        url = TOKEN_URL.format(tenant_id=self.tenant_id)
        resp = httpx.post(url, data={
            "grant_type": "client_credentials",
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "scope": "https://graph.microsoft.com/.default",
        }, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        self._token = data["access_token"]
        self._token_expiry = time.time() + int(data.get("expires_in", 3600))
        return self._token

    def _get_with_retry(
        self,
        url: str,
        params: Optional[dict] = None,
        max_retries: int = 4,
        base_delay: float = 2.0,
        timeout: float = 90,
    ) -> dict:
        """GET with exponential-backoff retry for transient network errors."""
        last_exc: Optional[Exception] = None
        for attempt in range(max_retries):
            try:
                headers = {"Authorization": f"Bearer {self._get_token()}"}
                resp = httpx.get(url, headers=headers, params=params, timeout=timeout)
                # Retry on 429 (throttle) or 503 (service unavailable)
                if resp.status_code in (429, 503):
                    retry_after = int(resp.headers.get("Retry-After", base_delay * (2 ** attempt)))
                    logger.warning("[Graph] %d response — retrying in %ds (attempt %d/%d)",
                                   resp.status_code, retry_after, attempt + 1, max_retries)
                    time.sleep(min(retry_after, 60))
                    continue
                resp.raise_for_status()
                return resp.json()
            except (httpx.ConnectError, httpx.TimeoutException) as exc:
                last_exc = exc
            except OSError as exc:
                if getattr(exc, "errno", None) in _RETRY_ERRNO:
                    last_exc = exc
                else:
                    raise
            delay = base_delay * (2 ** attempt)
            logger.warning("[Graph] Transient error on attempt %d/%d (%s) — retrying in %.1fs",
                           attempt + 1, max_retries, last_exc, delay)
            time.sleep(delay)
        raise last_exc or RuntimeError(f"Graph GET failed without a captured exception: {url}")

    def get(
        self,
        path: str,
        params: Optional[dict] = None,
        *,
        timeout: float = 90,
        max_retries: int = 4,
    ) -> dict:
        """GET request to Graph API. `path` can be full URL or relative path."""
        url = path if path.startswith("https://") else f"{GRAPH_BASE}{path}"
        return self._get_with_retry(url, params, max_retries=max_retries, timeout=timeout)

    def post(self, path: str, payload: dict) -> dict:
        """POST JSON to Graph API. `path` can be full URL or relative path."""
        url = path if path.startswith("https://") else f"{GRAPH_BASE}{path}"
        headers = {"Authorization": f"Bearer {self._get_token()}"}
        resp = httpx.post(url, headers=headers, json=payload, timeout=90)
        resp.raise_for_status()
        return resp.json() if resp.content else {}

    def patch(self, path: str, payload: dict) -> dict:
        """PATCH JSON to Graph API. `path` can be full URL or relative path."""
        url = path if path.startswith("https://") else f"{GRAPH_BASE}{path}"
        headers = {"Authorization": f"Bearer {self._get_token()}"}
        resp = httpx.patch(url, headers=headers, json=payload, timeout=90)
        resp.raise_for_status()
        return resp.json() if resp.content else {}

    def delete(self, path: str) -> None:
        """DELETE a Graph API resource. `path` can be full URL or relative path."""
        url = path if path.startswith("https://") else f"{GRAPH_BASE}{path}"
        headers = {"Authorization": f"Bearer {self._get_token()}"}
        resp = httpx.delete(url, headers=headers, timeout=90)
        resp.raise_for_status()

    def get_all_pages(
        self,
        path: str,
        params: Optional[dict] = None,
        *,
        max_pages: Optional[int] = None,
        max_items: Optional[int] = None,
        timeout: float = 90,
        max_retries: int = 4,
    ) -> list[dict]:
        """Fetch pages following @odata.nextLink with a production safety cap."""
        results = []
        first_url = path if path.startswith("https://") else f"{GRAPH_BASE}{path}"
        url: Optional[str] = first_url
        is_first = True
        page_limit = max_pages or _bounded_int_env("GRAPH_PAGE_MAX_PAGES", 5, 1, 50)
        item_limit = max_items or _bounded_int_env("GRAPH_PAGE_MAX_ITEMS", 500, 1, 5000)
        pages_fetched = 0
        while url and pages_fetched < page_limit and len(results) < item_limit:
            data = self.get(
                url,
                params if is_first else None,
                timeout=timeout,
                max_retries=max_retries,
            )
            is_first = False
            results.extend(data.get("value", [])[: max(0, item_limit - len(results))])
            url = data.get("@odata.nextLink")
            pages_fetched += 1
        if url:
            logger.warning(
                "[Graph] Page fetch capped at pages=%d items=%d for %s",
                pages_fetched,
                len(results),
                path,
            )
        return results

    def get_delta(
        self,
        path: str,
        delta_token: Optional[str] = None,
        *,
        max_pages: Optional[int] = None,
        max_items: Optional[int] = None,
    ) -> tuple[list[dict], str]:
        """
        Fetch delta results. Returns (items, new_delta_token).
        On first call, pass delta_token=None to get all items + initial delta token.
        On subsequent calls, pass the saved delta token to get only changes.
        The fetch is capped by default so a reset token cannot drain an entire
        mailbox/folder/channel in one cron run.
        """
        if delta_token:
            # delta_token is a full URL from the previous @odata.deltaLink
            url: Optional[str] = delta_token
        else:
            url = path if path.startswith("https://") else f"{GRAPH_BASE}{path}"

        items = []
        new_delta_token = ""
        current_url = url
        page_limit = max_pages or _bounded_int_env("GRAPH_DELTA_MAX_PAGES", 20, 1, 100)
        item_limit = max_items or _bounded_int_env("GRAPH_DELTA_MAX_ITEMS", 3000, 1, 10000)
        pages_fetched = 0

        while current_url and pages_fetched < page_limit and len(items) < item_limit:
            data = self.get(current_url)
            items.extend(data.get("value", [])[: max(0, item_limit - len(items))])
            pages_fetched += 1
            if "@odata.nextLink" in data:
                current_url = data["@odata.nextLink"]
            elif "@odata.deltaLink" in data:
                new_delta_token = data["@odata.deltaLink"]
                current_url = None
            else:
                current_url = None

        if current_url:
            new_delta_token = delta_token or ""
            logger.warning(
                "[Graph] Delta fetch capped at pages=%d items=%d for %s; preserving prior delta token=%s",
                pages_fetched,
                len(items),
                path,
                bool(delta_token),
            )

        return items, new_delta_token

    def download_bytes(self, url: str) -> bytes:
        """Download a file's raw bytes (for OneDrive content)."""
        last_exc: Optional[Exception] = None
        max_retries = 4
        base_delay = 2.0
        for attempt in range(max_retries):
            try:
                headers = {"Authorization": f"Bearer {self._get_token()}"}
                resp = httpx.get(url, headers=headers, timeout=120, follow_redirects=True)
                if resp.status_code in (429, 503):
                    retry_after = int(resp.headers.get("Retry-After", base_delay * (2 ** attempt)))
                    logger.warning(
                        "[Graph] Download %d response — retrying in %ds (attempt %d/%d)",
                        resp.status_code,
                        retry_after,
                        attempt + 1,
                        max_retries,
                    )
                    time.sleep(min(retry_after, 60))
                    continue
                resp.raise_for_status()
                return resp.content
            except (httpx.ConnectError, httpx.TimeoutException) as exc:
                last_exc = exc
            except OSError as exc:
                if getattr(exc, "errno", None) in _RETRY_ERRNO:
                    last_exc = exc
                else:
                    raise

            delay = base_delay * (2 ** attempt)
            logger.warning(
                "[Graph] Transient download error on attempt %d/%d (%s) — retrying in %.1fs",
                attempt + 1,
                max_retries,
                last_exc,
                delay,
            )
            time.sleep(delay)
        raise last_exc or RuntimeError(f"Graph download failed without a captured exception: {url}")


# Singleton
_client: Optional[GraphClient] = None


def get_graph_client() -> GraphClient:
    global _client
    if _client is None:
        _client = GraphClient()
    return _client
