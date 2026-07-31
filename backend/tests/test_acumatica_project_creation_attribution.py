from services.acumatica_sync import AcumaticaFinancialSyncService


class _Session:
    def fetch_entity(self, *_args, **_kwargs):
        return [
            {
                "ProjectID": "26123",
                "Description": "Attributed Acumatica Project",
                "Status": "Active",
            }
        ]


class _InsertQuery:
    def __init__(self, inserted):
        self._inserted = inserted

    def insert(self, payload):
        self._inserted.append(payload)
        return self

    def execute(self):
        return object()


class _Supabase:
    def __init__(self):
        self.inserted = []

    def table(self, table_name):
        assert table_name == "projects"
        return _InsertQuery(self.inserted)


def test_acumatica_project_creation_records_integration_source_and_run_without_guessed_actor(monkeypatch):
    service = AcumaticaFinancialSyncService.__new__(AcumaticaFinancialSyncService)
    service.session = _Session()
    service.supabase = _Supabase()
    service.sync_user_id = "7a7e56d4-15f7-4f3e-98b8-dfd39a82f5e1"
    service.project_map = {"seed": {"company_id": "company-123"}}

    monkeypatch.setattr(service, "_find_existing_project_row", lambda *_args: None)
    monkeypatch.setattr(service, "_load_project_map", lambda: {})

    result = service._sync_projects(None)

    assert result.upserted == 1
    assert len(service.supabase.inserted) == 1
    payload = service.supabase.inserted[0]
    assert payload["created_by"] is None
    assert payload["created_via"] == "acumatica_sync"
    assert payload["creation_request_id"] is None
    assert payload["creation_run_id"].startswith("acumatica-projects:")
