"""Guardrail for the Acumatica customer -> companies projection.

Acumatica holds vendors AND customers. The vendor sync has always projected into
`companies`; the customer sync did not, so every Acumatica customer looked like
manual entry to the app — wrong Source badge in the directory, and classified as
a cleanup candidate. That misclassification archived 16 real Acumatica customers
(Core-Mark, Foundation Building Materials, Spector and Co, Bella + Canvas, ...)
before it was caught.

The subtle requirement is match order. A business that is BOTH an Acumatica
vendor and an Acumatica customer must end up as ONE company row carrying both
ids — not a second row for the customer side. Four such pairs already exist in
production (FBM, BELLA, SPECTOR, LXPIND).
"""
from services.acumatica_sync import AcumaticaFinancialSyncService


class _Result:
    def __init__(self, data):
        self.data = data


class _CompaniesQuery:
    """Minimal `companies` table stub covering select/update/insert."""

    def __init__(self, table):
        self.table = table
        self.action = "select"
        self.payload = None
        self.filters = {}

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

    def eq(self, key, value):
        self.filters[key] = value
        return self

    def order(self, *_args, **_kwargs):
        return self

    def range(self, start, end):
        self._range = (start, end)
        return self

    def execute(self):
        if self.action == "insert":
            row = dict(self.payload)
            row.setdefault("id", f"new-{len(self.table) + 1}")
            self.table.append(row)
            return _Result([row])
        if self.action == "update":
            for row in self.table:
                if all(row.get(k) == v for k, v in self.filters.items()):
                    row.update(self.payload)
            return _Result([])
        start, end = getattr(self, "_range", (0, len(self.table)))
        return _Result([dict(r) for r in self.table[start : end + 1]])


class _Supabase:
    def __init__(self, companies):
        self.companies = companies

    def table(self, name):
        assert name == "companies", f"unexpected table {name}"
        return _CompaniesQuery(self.companies)


def _service(companies):
    service = AcumaticaFinancialSyncService.__new__(AcumaticaFinancialSyncService)
    service.supabase = _Supabase(companies)
    return service


def _customer(customer_id, name, status="Active", **extra):
    return {"CustomerID": customer_id, "CustomerName": name, "Status": status, **extra}


def test_links_onto_the_existing_vendor_row_instead_of_creating_a_duplicate():
    """The BELLA case: same business is an Acumatica vendor and customer."""
    companies = [
        {
            "id": "v1",
            "name": "Bella + Canvas, LLC",
            "acumatica_vendor_id": "BELLA",
            "customer_id": None,
            "created_at": "2026-01-01",
        }
    ]
    touched = _service(companies)._project_customers_to_companies(
        [_customer("BELLA", "Bella + Canvas, LLC")]
    )

    assert touched == 1
    assert len(companies) == 1, "must not create a second row for the customer side"
    assert companies[0]["customer_id"] == "BELLA"
    assert companies[0]["acumatica_vendor_id"] == "BELLA", "vendor link preserved"


def test_inserts_a_company_when_the_customer_has_none():
    companies = []
    touched = _service(companies)._project_customers_to_companies(
        [_customer("OUT", "Outreach, Inc")]
    )

    assert touched == 1
    assert len(companies) == 1
    assert companies[0]["name"] == "Outreach, Inc"
    assert companies[0]["customer_id"] == "OUT"
    assert companies[0]["type"] == "client"
    assert companies[0]["status"] == "active"


def test_is_idempotent_across_runs():
    companies = []
    service = _service(companies)
    records = [_customer("OUT", "Outreach, Inc")]

    service._project_customers_to_companies(records)
    service._project_customers_to_companies(records)

    assert len(companies) == 1, "second run must update, not insert again"


def test_matches_existing_link_by_customer_id_regardless_of_name_drift():
    companies = [
        {
            "id": "c1",
            "name": "Ulta",  # stale local name
            "customer_id": "ULTA",
            "acumatica_vendor_id": None,
            "created_at": "2026-01-01",
        }
    ]
    _service(companies)._project_customers_to_companies(
        [_customer("ULTA", "Ulta Inc.")]
    )

    assert len(companies) == 1
    assert companies[0]["name"] == "Ulta Inc.", "Acumatica owns the name once linked by id"


def test_does_not_erase_local_contact_fields_when_acumatica_omits_them():
    """The Customer select drops fields on timeout — writing None would destroy data."""
    companies = [
        {
            "id": "c1",
            "name": "Ulta Inc.",
            "customer_id": "ULTA",
            "contact_email": "ap@ulta.example",
            "acumatica_vendor_id": None,
            "created_at": "2026-01-01",
        }
    ]
    _service(companies)._project_customers_to_companies(
        [_customer("ULTA", "Ulta Inc.")]  # no Email key at all
    )

    assert companies[0]["contact_email"] == "ap@ulta.example"


def test_skips_inactive_customers():
    companies = []
    touched = _service(companies)._project_customers_to_companies(
        [_customer("OLD", "Defunct LLC", status="Inactive")]
    )

    assert touched == 0
    assert companies == []


def test_skips_records_missing_an_id_or_name():
    companies = []
    touched = _service(companies)._project_customers_to_companies(
        [_customer("", "No Id"), _customer("NONAME", "")]
    )

    assert touched == 0
    assert companies == []


def test_picks_the_oldest_row_when_customer_id_is_duplicated():
    """`customer_id` has no unique constraint and production already has dupes."""
    companies = [
        {"id": "old", "name": "FBM A", "customer_id": "FBM", "created_at": "2026-01-01"},
        {"id": "new", "name": "FBM B", "customer_id": "FBM", "created_at": "2026-06-01"},
    ]
    _service(companies)._project_customers_to_companies(
        [_customer("FBM", "Foundation Building Materials, Inc")]
    )

    assert companies[0]["name"] == "Foundation Building Materials, Inc"
    assert companies[1]["name"] == "FBM B", "only the oldest match is written"


def test_prefers_a_live_company_over_an_archived_duplicate():
    """A merged-away duplicate must not recapture the customer link.

    Merging archives the loser but leaves its name intact. An oldest-first scan
    would keep re-targeting that dead row, so every sync would quietly undo the
    merge.
    """
    companies = [
        {
            "id": "dead",
            "name": "Core-Mark US, LLC",
            "customer_id": "CORE-MARK",
            "status": "archived",
            "created_at": "2026-01-01",
        },
        {
            "id": "live",
            "name": "Core-Mark US, LLC",
            "customer_id": None,
            "acumatica_vendor_id": "CORE-MARK",
            "status": "active",
            "created_at": "2026-06-01",
        },
    ]
    _service(companies)._project_customers_to_companies(
        [_customer("CORE-MARK", "Core-Mark US, LLC")]
    )

    live = next(r for r in companies if r["id"] == "live")
    dead = next(r for r in companies if r["id"] == "dead")
    assert live["customer_id"] == "CORE-MARK", "the surviving row must win"
    assert dead.get("acumatica_sync_at") is None, "the archived row must be left alone"
    assert len(companies) == 2, "must not insert a third row"
