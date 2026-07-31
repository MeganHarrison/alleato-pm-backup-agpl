"""Tests for health check endpoint."""
import pytest
from datetime import datetime


class TestHealthEndpoint:
    """Test cases for /health endpoint."""
    
    @pytest.mark.unit
    def test_health_check_success(self, client):
        """Test successful health check."""
        response = client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["status"] == "healthy"
        assert "openai_configured" in data
        assert "timestamp" in data
        
        # Verify timestamp is valid ISO format
        timestamp = datetime.fromisoformat(data["timestamp"].replace("Z", "+00:00"))
        assert isinstance(timestamp, datetime)
    
    @pytest.mark.unit
    def test_health_check_with_openai_configured(self, client, monkeypatch):
        """Test health check when OpenAI is configured."""
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test-key-123")
        
        response = client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data["openai_configured"] is True
    
    @pytest.mark.unit
    def test_health_check_without_openai(self, client, monkeypatch):
        """Test health check when OpenAI is not configured."""
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        
        response = client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data["openai_configured"] is False
