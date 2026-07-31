"""Tests for project-related API endpoints."""
import pytest
from unittest.mock import MagicMock


class TestProjectsAPI:
    """Test cases for project endpoints."""
    
    @pytest.mark.unit
    def test_list_projects_success(self, client, mock_supabase_store, sample_project_data):
        """Test successful project listing."""
        mock_supabase_store.list_projects.return_value = [sample_project_data]
        
        response = client.get("/api/projects")
        
        assert response.status_code == 200
        data = response.json()
        assert "projects" in data
        assert len(data["projects"]) == 1
        assert data["projects"][0]["name"] == "Test Project"
        
        mock_supabase_store.list_projects.assert_called_once()
    
    @pytest.mark.unit
    def test_list_projects_empty(self, client, mock_supabase_store):
        """Test project listing when no projects exist."""
        mock_supabase_store.list_projects.return_value = []
        
        response = client.get("/api/projects")
        
        assert response.status_code == 200
        data = response.json()
        assert data["projects"] == []
    
    @pytest.mark.unit
    def test_get_project_detail_success(self, client, mock_supabase_store, sample_project_data):
        """Test successful project detail retrieval."""
        mock_supabase_store.get_project.return_value = sample_project_data
        mock_supabase_store.list_tasks.return_value = [
            {"id": "task-1", "title": "Test Task", "status": "open"}
        ]

        response = client.get("/api/projects/1")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["project"]["name"] == "Test Project"
        assert len(data["tasks"]) == 1
        assert "insights" not in data

        mock_supabase_store.get_project.assert_called_once_with(1)
        mock_supabase_store.list_tasks.assert_called_once_with(
            project_id=1, status="open", limit=50
        )
    
    @pytest.mark.unit
    def test_get_project_detail_not_found(self, client, mock_supabase_store):
        """Test project detail when project doesn't exist."""
        mock_supabase_store.get_project.return_value = None
        
        response = client.get("/api/projects/999")
        
        assert response.status_code == 404
        data = response.json()
        assert data["detail"] == "Project not found"
    
    @pytest.mark.unit
    def test_get_project_detail_with_no_tasks(
        self, client, mock_supabase_store, sample_project_data
    ):
        """Test project detail with no associated tasks."""
        mock_supabase_store.get_project.return_value = sample_project_data
        mock_supabase_store.list_tasks.return_value = []

        response = client.get("/api/projects/1")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["project"]["name"] == "Test Project"
        assert data["tasks"] == []
        assert "insights" not in data
