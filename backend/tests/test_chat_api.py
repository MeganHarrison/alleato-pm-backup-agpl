"""Tests for chat API endpoints."""
import pytest


class TestChatAPI:
    """Test cases for chat endpoints."""
    
    @pytest.mark.unit
    def test_chat_endpoint_success(self, client, mock_supabase_store, sample_chat_request):
        """Test successful chat API call."""
        # Mock search results
        mock_supabase_store.search_chunks_by_keyword.return_value = [
            {
                "document_id": "doc-1",
                "chunk_index": 0,
                "text": "This is a test chunk about project risks.",
                "metadata": {"source": "meeting"}
            }
        ]
        mock_supabase_store.list_tasks.return_value = [
            {"id": "task-1", "title": "Mitigate risk A", "status": "open"}
        ]
        mock_supabase_store.get_project.return_value = {
            "id": 1,
            "name": "Test Project",
            "meeting_count": 10,
            "open_tasks": 5
        }
        
        response = client.post("/api/chat", json=sample_chat_request)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "reply" in data
        assert "sources" in data
        assert "tasks" in data
        assert "insights" not in data

        # Check that appropriate methods were called
        mock_supabase_store.search_chunks_by_keyword.assert_called()
        mock_supabase_store.list_tasks.assert_called_with(project_id=1, status="open", limit=5)
    
    @pytest.mark.unit
    def test_chat_endpoint_empty_message(self, client):
        """Test chat API with empty message."""
        response = client.post("/api/chat", json={"message": ""})
        
        assert response.status_code == 422
        data = response.json()
        assert data["detail"] == "Message cannot be empty"
    
    @pytest.mark.unit
    def test_chat_endpoint_no_results(self, client, mock_supabase_store):
        """Test chat API when no results are found."""
        # All searches return empty
        mock_supabase_store.search_chunks_by_keyword.return_value = []
        mock_supabase_store.fetch_recent_chunks.return_value = []
        mock_supabase_store.list_tasks.return_value = []
        mock_supabase_store.get_project.return_value = None
        
        response = client.post("/api/chat", json={"message": "Find something"})
        
        assert response.status_code == 200
        data = response.json()
        
        assert "No relevant transcripts or tasks were found" in data["reply"]
        assert data["sources"] == []
        assert data["tasks"] == []

    @pytest.mark.unit
    def test_chat_financial_query_prefers_structured_rows(self, client, mock_supabase_store):
        """Financial query should use structured row retrieval first."""
        mock_supabase_store.search_financial_rows.return_value = [
            {
                "dataset_id": "doc-fin-1",
                "document": {
                    "title": "Q3 Budget",
                    "project_id": 43,
                    "category": "financial_document",
                },
                "row_data": {
                    "sheet": "Budget",
                    "row_index": 12,
                    "columns": {"Cost Code": "03-3000", "Amount": "125000", "Description": "Concrete"},
                },
                "match_score": 3,
            }
        ]
        mock_supabase_store.list_tasks.return_value = []
        mock_supabase_store.get_project.return_value = None

        response = client.post(
            "/api/chat",
            json={"message": "What is the concrete amount in Q3 budget?", "project_id": 43, "limit": 5},
        )

        assert response.status_code == 200
        data = response.json()
        assert "structured financial rows" in data["reply"]
        assert len(data["sources"]) == 1
        assert data["sources"][0]["metadata"]["retrieval_mode"] == "financial_structured"
        assert "Amount=125000" in data["sources"][0]["snippet"]
        mock_supabase_store.search_financial_rows.assert_called_once()
        mock_supabase_store.search_chunks_by_keyword.assert_not_called()

    @pytest.mark.unit
    def test_chat_financial_query_falls_back_when_no_rows(self, client, mock_supabase_store):
        """Financial query should fallback to transcript retrieval when no row matches exist."""
        mock_supabase_store.search_financial_rows.return_value = []
        mock_supabase_store.search_chunks_by_keyword.return_value = [
            {
                "document_id": "doc-1",
                "chunk_index": 1,
                "text": "Budget discussion mentioned a $125000 concrete line item.",
                "metadata": {"title": "Budget Meeting"},
            }
        ]
        mock_supabase_store.list_tasks.return_value = []
        mock_supabase_store.get_project.return_value = None

        response = client.post(
            "/api/chat",
            json={"message": "Show budget amount for concrete", "project_id": 43, "limit": 5},
        )

        assert response.status_code == 200
        data = response.json()
        assert "transcript snippets" in data["reply"]
        mock_supabase_store.search_financial_rows.assert_called_once()
        mock_supabase_store.search_chunks_by_keyword.assert_called_once()
