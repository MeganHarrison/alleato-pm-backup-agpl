from services.acumatica_sync import (
    AcumaticaFinancialSyncService,
    _unique_contract_by_invoice_reference,
)


class _Result:
    def __init__(self, data):
        self.data = data


class _TableQuery:
    def __init__(self, db, table_name):
        self.db = db
        self.table_name = table_name
        self.rows = list(db.tables.setdefault(table_name, []))
        self.action = "select"
        self.payload = None

    def select(self, *_args):
        self.action = "select"
        return self

    def update(self, payload):
        self.action = "update"
        self.payload = payload
        return self

    def insert(self, payload):
        self.action = "insert"
        self.payload = payload
        return self

    def upsert(self, payload, **_kwargs):
        self.action = "upsert"
        self.payload = payload
        return self

    def eq(self, key, value):
        self.rows = [row for row in self.rows if row.get(key) == value]
        return self

    def __getattr__(self, name):
        if name == "not_":
            return self
        raise AttributeError(name)

    def is_(self, *_args):
        return self

    def execute(self):
        table = self.db.tables.setdefault(self.table_name, [])
        if self.action == "insert":
            row = dict(self.payload)
            table.append(row)
            return _Result([row])
        if self.action == "upsert":
            rows = self.payload if isinstance(self.payload, list) else [self.payload]
            for row in rows:
                table.append(dict(row))
            return _Result(rows)
        if self.action == "update":
            updated = []
            for row in table:
                if row in self.rows:
                    row.update(self.payload)
                    updated.append(dict(row))
            return _Result(updated)
        return _Result([dict(row) for row in self.rows])


class _FakeSupabase:
    def __init__(self, tables=None):
        self.tables = tables or {}

    def table(self, table_name):
        return _TableQuery(self, table_name)


class _Session:
    def __init__(self, entity_sets, entity_responses=None):
        self.entity_sets = entity_sets
        self.entity_responses = entity_responses or {}
        self.calls = []

    def fetch_odata_entity_sets(self):
        return self.entity_sets

    def fetch_entity(self, entity_name, *, top, expand=None, select=None, modified_after=None, timeout=None):
        self.calls.append(
            {
                "entity_name": entity_name,
                "top": top,
                "expand": expand,
                "select": select,
                "modified_after": modified_after,
                "timeout": timeout,
            }
        )
        response = self.entity_responses.get(select)
        if isinstance(response, Exception):
            raise response
        if callable(response):
            return response(top=top, expand=expand, select=select, modified_after=modified_after)
        return response or []


def _service_with_entity_sets(entity_sets, entity_responses=None, tables=None):
    service = object.__new__(AcumaticaFinancialSyncService)
    service.session = _Session(entity_sets, entity_responses)
    service.supabase = _FakeSupabase(tables)
    return service


def test_find_ar_payment_applications_odata_entity_uses_metadata_name():
    service = _service_with_entity_sets(["BI-ARInvoices", "ProcoreARPaymentApplications"])

    assert service._find_ar_payment_applications_odata_entity() == "ProcoreARPaymentApplications"


def test_ar_payment_application_row_from_odata_maps_common_aradjust_fields():
    service = _service_with_entity_sets([])
    row = service._ar_payment_application_row_from_odata(
        {
            "AdjgRefNbr": "000235",
            "AdjgDocType": "Payment",
            "AdjdRefNbr": "000557",
            "AdjdDocType": "Invoice",
            "CustomerID": "OWNER",
            "CuryAdjdAmt": "1234.56",
            "ProjectID": "25-125",
        }
    )

    assert row == {
        "payment_external_key": "Payment|000235",
        "payment_reference_nbr": "000235",
        "payment_type": "Payment",
        "invoice_reference_nbr": "000557",
        "invoice_type": "Invoice",
        "customer_id": "OWNER",
        "amount_applied": 1234.56,
        "balance": None,
        "resolved_project_code": "25-125",
        "resolution_method": "ar_payment_applications_odata",
    }


def test_ar_payment_application_row_from_odata_requires_payment_and_invoice_refs():
    service = _service_with_entity_sets([])

    assert service._ar_payment_application_row_from_odata({"AdjgRefNbr": "000235"}) is None


def test_unique_contract_by_invoice_reference_rejects_ambiguous_invoice_ownership():
    mapping = _unique_contract_by_invoice_reference(
        [
            {"acumatica_ref_nbr": "INV-1", "prime_contract_id": "prime-a"},
            {"acumatica_ref_nbr": "INV-2", "prime_contract_id": "prime-a"},
            {"acumatica_ref_nbr": "INV-2", "prime_contract_id": "prime-b"},
        ],
    )

    assert mapping == {"INV-1": "prime-a"}


def test_fetch_entity_with_optional_fields_drops_only_the_failing_optional_field():
    failing_select = "CustomerID,CustomerName,LastModifiedDateTime,Status,CurrencyID,Terms,TaxZone,Email,Phone1"
    service = _service_with_entity_sets(
        [],
        entity_responses={
            failing_select: RuntimeError("CurrencyID broke the Acumatica select"),
            "CustomerID,CustomerName,LastModifiedDateTime": [{}],
            "CustomerID,CustomerName,Status": [{}],
            "CustomerID,CustomerName,CurrencyID": RuntimeError("CurrencyID broke the Acumatica select"),
            "CustomerID,CustomerName,Terms": [{}],
            "CustomerID,CustomerName,TaxZone": [{}],
            "CustomerID,CustomerName,Email": [{}],
            "CustomerID,CustomerName,Phone1": [{}],
            "CustomerID,CustomerName,LastModifiedDateTime,Status,Terms,TaxZone,Email,Phone1": [
                {"CustomerID": "OWNER", "CustomerName": "Owner", "LastModifiedDateTime": "2026-06-24T00:00:00Z"}
            ],
        },
    )

    records, selected_fields, dropped_fields = service._fetch_entity_with_optional_fields(
        "Customer",
        required_fields=("CustomerID", "CustomerName"),
        optional_fields=("LastModifiedDateTime", "Status", "CurrencyID", "Terms", "TaxZone", "Email", "Phone1"),
        top=200,
    )

    assert len(records) == 1
    assert selected_fields == ["CustomerID", "CustomerName", "LastModifiedDateTime", "Status", "Terms", "TaxZone", "Email", "Phone1"]
    assert dropped_fields == ["CurrencyID"]


def test_sync_payment_applications_warns_and_projects_from_payments_when_source_unavailable():
    service = _service_with_entity_sets(
        [],
        tables={
            "acumatica_payments": [
                {
                    "reference_nbr": "PAY-001",
                    "document_type": "Payment",
                    "customer_id": "OWNER",
                    "payment_method": "Check",
                    "payment_ref": "CHK-1",
                    "application_date": "2026-06-24",
                    "description": "Owner payment",
                    "payment_amount": 1500,
                }
            ],
            "acumatica_ar_invoices": [{"customer": "OWNER", "project": "25-125"}],
            "projects": [{"id": 43, "acumatica_project_id": "25-125"}],
            "prime_contracts": [{"id": "pc-1", "project_id": 43}],
            "prime_contract_payments": [],
        },
    )

    service._fetch_payment_application_records = lambda _cursor: (_ for _ in ()).throw(RuntimeError("no historical lines"))

    result = service._sync_payment_applications(None)

    assert result.projected == 1
    assert result.upserted == 0
    assert result.warnings
    assert "no historical lines" in result.warnings[0]
    assert len(service.supabase.tables["prime_contract_payments"]) == 1


def test_payment_projection_skips_ambiguous_multi_contract_project():
    service = _service_with_entity_sets(
        [],
        tables={
            "acumatica_payments": [
                {
                    "reference_nbr": "PAY-001",
                    "document_type": "Payment",
                    "customer_id": "OWNER",
                    "payment_method": "Check",
                    "application_date": "2026-06-24",
                    "payment_amount": 1500,
                }
            ],
            "acumatica_ar_invoices": [{"customer": "OWNER", "project": "25-125"}],
            "projects": [{"id": 43, "acumatica_project_id": "25-125"}],
            "prime_contracts": [
                {"id": "prime-a", "project_id": 43},
                {"id": "prime-b", "project_id": 43},
            ],
            "prime_contract_payments": [],
        },
    )

    assert service._project_prime_contract_payments_from_payments() == 0
    assert service.supabase.tables["prime_contract_payments"] == []
