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


class _CustomerSession:
    def __init__(self, customer_code):
        self._customer_code = customer_code

    def fetch_entity(self, *_args, **_kwargs):
        record = {
            "ProjectID": "26200",
            "Description": "Customer Attributed Project",
            "Status": "Active",
        }
        if self._customer_code is not None:
            record["Customer"] = self._customer_code
        return [record]


class _CompaniesQuery:
    def __init__(self, rows):
        self._rows = rows

    def select(self, *_args, **_kwargs):
        return self

    @property
    def not_(self):
        return self

    def is_(self, *_args, **_kwargs):
        return self

    def execute(self):
        return type("_Resp", (), {"data": self._rows})()


class _AttributionSupabase:
    def __init__(self, company_rows):
        self.inserted = []
        self._company_rows = company_rows

    def table(self, table_name):
        if table_name == "companies":
            return _CompaniesQuery(self._company_rows)
        assert table_name == "projects"
        return _InsertQuery(self.inserted)


def _run_creation(session, company_rows):
    service = AcumaticaFinancialSyncService.__new__(AcumaticaFinancialSyncService)
    service.session = session
    service.supabase = _AttributionSupabase(company_rows)
    service.sync_user_id = "7a7e56d4-15f7-4f3e-98b8-dfd39a82f5e1"
    # A stale "first project's company" default must NEVER leak onto new rows.
    service.project_map = {"seed": {"company_id": "aspire-health-group"}}
    service.company_id_by_customer_code = None
    # Instance-level shadowing keeps the fakes local to this call.
    service._find_existing_project_row = lambda *_a, **_k: None
    service._load_project_map = lambda: {}

    service._sync_projects(None)
    return service.supabase.inserted


def test_new_project_is_attributed_to_its_own_acumatica_customer():
    inserted = _run_creation(
        _CustomerSession("RADIAL"),
        company_rows=[{"id": "radial-company-id", "customer_id": "RADIAL"}],
    )
    assert len(inserted) == 1
    # The bug: this would have been "aspire-health-group" (the borrowed default).
    assert inserted[0]["company_id"] == "radial-company-id"


def test_new_project_with_unresolvable_customer_gets_blank_client_not_default():
    inserted = _run_creation(
        _CustomerSession("UNKNOWNCODE"),
        company_rows=[{"id": "radial-company-id", "customer_id": "RADIAL"}],
    )
    assert len(inserted) == 1
    # Blank is correct and fixable; a confidently-wrong borrowed default is not.
    assert inserted[0]["company_id"] is None


def test_new_project_without_customer_gets_blank_client_not_default():
    inserted = _run_creation(_CustomerSession(None), company_rows=[])
    assert len(inserted) == 1
    assert inserted[0]["company_id"] is None
