from services.acumatica_sync import (
    AcumaticaFinancialSyncService,
    _purchase_order_project_code,
    _subcontract_project_code,
)


class FakeResponse:
    def __init__(self, data=None):
        self.data = data or []


class FakeQuery:
    def __init__(self, client, table_name):
        self.client = client
        self.table_name = table_name
        self.filters = {}
        self.not_null_field = None
        self.null_fields = []
        self.in_filter = None
        self.payload = None
        self.on_conflict = None
        self._op = "select"
        self._negate_next_is = False
        self.write_response = None

    def select(self, *_args):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def eq(self, field, value):
        self.filters[field] = value
        return self

    @property
    def not_(self):
        self._negate_next_is = True
        return self

    def is_(self, field, value):
        if self._negate_next_is:
            self.not_null_field = field
            self._negate_next_is = False
        else:
            if value == "null":
                self.null_fields.append(field)
            else:
                self.filters[field] = value
        return self

    def in_(self, field, values):
        self.in_filter = (field, values)
        return self

    def limit(self, *_args):
        return self

    def upsert(self, payload, on_conflict=None):
        self.payload = payload
        self.on_conflict = on_conflict
        self._op = "upsert"
        self.client.writes.append(("upsert", self.table_name, payload, on_conflict))
        return self

    def insert(self, payload):
        self.payload = payload
        self._op = "insert"
        self.write_response = payload
        self.client.writes.append(("insert", self.table_name, payload, None))
        return self

    def update(self, payload):
        self.payload = payload
        self._op = "update"
        self.client.writes.append(("update", self.table_name, payload, None))
        return self

    def delete(self):
        self._op = "delete"
        self.client.writes.append(("delete", self.table_name, None, None))
        return self

    def execute(self):
        hook = self.client.raise_hook
        if hook is not None:
            hook(self)
        if self._op == "insert" and self.write_response is not None:
            data = self.write_response if isinstance(self.write_response, list) else [self.write_response]
            return FakeResponse(data)
        if self._op in {"upsert", "update", "delete"}:
            return FakeResponse([])
        return FakeResponse(self.client.resolve(self))


def _subcontract_fixture():
    return {
        "external_key": "SC|001",
        "subcontract_nbr": "SC-001",
        "project_id": 7,
        "vendor_uuid": "vendor-1",
        "description": "Concrete",
        "status": "Open",
        "subcontract_total": 1250,
        "raw_payload": {
            "Details": [
                {
                    "LineNbr": 1,
                    "CostCode": "033000",
                    "Description": "Cast-in-place concrete",
                    "ExtendedCost": 1250,
                }
            ]
        },
    }


class FakeSupabase:
    def __init__(self):
        self.writes = []
        # Optional hook(query) that may raise to simulate a DB rejection
        # (e.g. the commitment-SOV trigger firing on a bad budget code).
        self.raise_hook = None
        self.tables = {
            "acumatica_subcontracts": [_subcontract_fixture()],
            "acumatica_purchase_orders": [
                {
                    "external_key": "PO|001",
                    "order_nbr": "PO-001",
                    "project_id": 7,
                    "vendor_uuid": "vendor-1",
                    "description": "Materials",
                    "status": "Open",
                    "raw_payload": {
                        "Details": [
                            {
                                "LineNbr": 1,
                                "CostCode": "031000",
                                "Description": "Formwork",
                                "ExtendedCost": 500,
                            }
                        ]
                    },
                }
            ],
            "subcontracts": [{"id": "sub-1", "acumatica_external_key": "SC|001"}],
            "purchase_orders": [{"id": "po-1", "acumatica_external_key": "PO|001"}],
            "cost_code_types": [{"id": "cost-type-S", "code": "S", "description": "Subcontract"}],
            "cost_codes": [
                {"id": "03-3000", "title": "Concrete"},
                {"id": "03-1000", "title": "Formwork"},
            ],
            # Both an untyped legacy code AND the Subcontract-typed code exist
            # for each cost code — the resolver must pick the TYPED one.
            "project_budget_codes": [
                {"id": "pbc-033000-untyped", "project_id": 7, "cost_code_id": "03-3000", "cost_type_id": None, "is_active": True},
                {"id": "pbc-033000-S", "project_id": 7, "cost_code_id": "03-3000", "cost_type_id": "cost-type-S", "is_active": True},
                {"id": "pbc-031000-untyped", "project_id": 7, "cost_code_id": "03-1000", "cost_type_id": None, "is_active": True},
                {"id": "pbc-031000-S", "project_id": 7, "cost_code_id": "03-1000", "cost_type_id": "cost-type-S", "is_active": True},
            ],
            # SOV tables exist so the pre-flight guardrail query resolves cleanly.
            "subcontract_sov_items": [],
            "purchase_order_sov_items": [],
        }

    def table(self, table_name):
        return FakeQuery(self, table_name)

    def resolve(self, query):
        rows = list(self.tables.get(query.table_name, []))
        if query.not_null_field:
            rows = [row for row in rows if row.get(query.not_null_field) is not None]
        for field in query.null_fields:
            rows = [row for row in rows if row.get(field) is None]
        if query.in_filter:
            field, values = query.in_filter
            rows = [row for row in rows if row.get(field) in values]
        for field, value in query.filters.items():
            rows = [row for row in rows if row.get(field) == value]
        return rows


def make_service(fake_supabase):
    service = AcumaticaFinancialSyncService.__new__(AcumaticaFinancialSyncService)
    service.supabase = fake_supabase
    service.project_cost_code_map = {}
    service.commitment_sov_budget_code_map = {}
    service._subcontract_cost_type_id_cache = None
    service.cost_codes = {"03-3000": "03-3000", "03-1000": "03-1000"}
    return service


def test_purchase_order_project_code_reads_detail_lines():
    record = {
        "OrderNbr": "PO-001",
        "Details": [
            {"LineNbr": 1, "ProjectID": "25-127"},
            {"LineNbr": 2, "ProjectID": "OTHER"},
        ],
    }

    assert _purchase_order_project_code(record) == "25-127"


def test_purchase_order_project_code_prefers_header_project():
    record = {
        "OrderNbr": "PO-001",
        "Project": "25-128",
        "Details": [{"LineNbr": 1, "ProjectID": "25-127"}],
    }

    assert _purchase_order_project_code(record) == "25-128"


def test_subcontract_project_code_reads_detail_lines():
    record = {
        "SubcontractNbr": "SC-001",
        "Details": [{"LineNbr": 1, "ProjectCD": "25-127"}],
    }

    assert _subcontract_project_code(record) == "25-127"


def test_subcontract_sov_resolves_to_typed_subcontract_budget_code():
    """Regression: commitment SOV rows must be backed by the Subcontract-TYPED
    budget code, never an untyped (cost_type_id IS NULL) one — the untyped case
    is rejected by validate_commitment_sov_project_budget_code (23514) and
    aborted the whole entity."""
    fake_supabase = FakeSupabase()
    service = make_service(fake_supabase)

    result = service._project_subcontracts()

    assert result.skipped == 0
    sov_write = next(
        write for write in fake_supabase.writes if write[0] == "upsert" and write[1] == "subcontract_sov_items"
    )
    [line] = sov_write[2]
    assert line["budget_code"] == "03-3000"
    assert line["project_budget_code_id"] == "pbc-033000-S"


def test_purchase_order_sov_resolves_to_typed_subcontract_budget_code():
    fake_supabase = FakeSupabase()
    service = make_service(fake_supabase)

    result = service._project_purchase_orders()

    assert result.skipped == 0
    sov_write = next(
        write for write in fake_supabase.writes if write[0] == "insert" and write[1] == "purchase_order_sov_items"
    )
    [line] = sov_write[2]
    assert line["budget_code"] == "03-1000"
    assert line["project_budget_code_id"] == "pbc-031000-S"


def test_resolver_reactivates_inactive_typed_budget_code_instead_of_duplicating():
    """The unique key excludes is_active, so an INACTIVE typed code collides with
    an insert. The resolver must reactivate it in place, not duplicate it."""
    fake_supabase = FakeSupabase()
    # Only an INACTIVE Subcontract-typed code exists for 03-3000.
    fake_supabase.tables["project_budget_codes"] = [
        {"id": "pbc-033000-S", "project_id": 7, "cost_code_id": "03-3000", "cost_type_id": "cost-type-S", "is_active": False},
    ]
    service = make_service(fake_supabase)

    result = service._project_subcontracts()

    assert result.skipped == 0
    # It reactivated rather than inserting a new budget code.
    reactivation = next(
        w for w in fake_supabase.writes if w[0] == "update" and w[1] == "project_budget_codes"
    )
    assert reactivation[2] == {"is_active": True}
    assert not any(
        w[0] == "insert" and w[1] == "project_budget_codes" for w in fake_supabase.writes
    )
    sov_write = next(w for w in fake_supabase.writes if w[1] == "subcontract_sov_items")
    [line] = sov_write[2]
    assert line["project_budget_code_id"] == "pbc-033000-S"


def test_subcontract_projection_skips_bad_row_without_aborting_entity():
    """Resilience: a row rejected by the DB trigger must be skipped + logged, not
    abort the whole commitments_projection entity (the original failure mode)."""
    fake_supabase = FakeSupabase()
    # Two subcontracts; the second's SOV upsert will be rejected by the DB.
    second = _subcontract_fixture()
    second["external_key"] = "SC|BAD"
    second["subcontract_nbr"] = "SC-BAD"
    fake_supabase.tables["acumatica_subcontracts"] = [_subcontract_fixture(), second]
    fake_supabase.tables["subcontracts"] = [
        {"id": "sub-1", "acumatica_external_key": "SC|001"},
        {"id": "sub-bad", "acumatica_external_key": "SC|BAD"},
    ]

    def reject_bad_sov(query):
        if (
            query.table_name == "subcontract_sov_items"
            and query._op == "upsert"
            and any(item.get("subcontract_id") == "sub-bad" for item in (query.payload or []))
        ):
            raise RuntimeError("23514: cannot back a commitment SOV row")

    fake_supabase.raise_hook = reject_bad_sov
    service = make_service(fake_supabase)

    # Must NOT raise.
    result = service._project_subcontracts()

    # The good subcontract still projected; the bad one was counted, not fatal.
    assert result.skipped >= 1
    assert result.errors >= 1
    good_writes = [
        w for w in fake_supabase.writes
        if w[1] == "subcontract_sov_items" and w[0] == "upsert"
        and any(item.get("subcontract_id") == "sub-1" for item in (w[2] or []))
    ]
    assert good_writes, "the healthy subcontract's SOV must still be written"


def test_preflight_guardrail_surfaces_untyped_backed_sov_codes():
    """The guardrail must loudly surface untyped budget codes still backing SOV
    lines so a silent trigger-rejection can't recur invisibly."""
    fake_supabase = FakeSupabase()
    fake_supabase.tables["subcontract_sov_items"] = [
        {
            "project_budget_code_id": "pbc-033000-untyped",
            "project_budget_codes": {
                "id": "pbc-033000-untyped",
                "project_id": 7,
                "cost_code_id": "03-3000",
                "cost_type_id": None,
            },
        }
    ]
    service = make_service(fake_supabase)

    warnings = service._preflight_untyped_commitment_sov_budget_codes()

    assert warnings
    assert "pbc-033000-untyped" in warnings[0]


def test_acumatica_commitment_sov_projection_skips_unresolved_cost_code():
    fake_supabase = FakeSupabase()
    fake_supabase.tables["project_budget_codes"] = []
    # Cost code not in the master list either → cannot mint a typed code.
    service = make_service(fake_supabase)
    service.cost_codes = {}

    result = service._project_subcontracts()

    assert result.skipped == 1
    assert not any(
        write[1] == "subcontract_sov_items" and write[0] in {"upsert", "insert"}
        for write in fake_supabase.writes
    )
