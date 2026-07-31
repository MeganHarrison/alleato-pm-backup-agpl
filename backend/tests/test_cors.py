"""Tests for CORS configuration."""
import pytest


class TestCORS:
    """Verify CORS headers are set correctly."""

    ALLOWED_ORIGINS = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ]

    @pytest.mark.parametrize("origin", ALLOWED_ORIGINS)
    def test_allowed_origin(self, client, origin):
        r = client.options(
            "/health",
            headers={"Origin": origin, "Access-Control-Request-Method": "GET"},
        )
        assert r.headers.get("access-control-allow-origin") == origin

    def test_disallowed_origin(self, client):
        r = client.options(
            "/health",
            headers={
                "Origin": "https://evil.example.com",
                "Access-Control-Request-Method": "GET",
            },
        )
        # Should NOT echo back the disallowed origin
        assert r.headers.get("access-control-allow-origin") != "https://evil.example.com"

    def test_cors_allows_credentials(self, client):
        r = client.options(
            "/health",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert r.headers.get("access-control-allow-credentials") == "true"

    def test_cors_allows_all_methods(self, client):
        r = client.options(
            "/health",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
            },
        )
        allow_methods = r.headers.get("access-control-allow-methods", "")
        # FastAPI CORS with allow_methods=["*"] returns "*"
        assert "*" in allow_methods or "POST" in allow_methods
