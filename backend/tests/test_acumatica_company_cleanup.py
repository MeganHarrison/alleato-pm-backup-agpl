"""Regression contracts for the Acumatica-owned company cleanup seam."""

from types import SimpleNamespace

from services.acumatica_sync import AcumaticaFinancialSyncService, EntitySyncResult


def _service_with_handlers(failing_entity=None):
    service = AcumaticaFinancialSyncService.__new__(AcumaticaFinancialSyncService)
    service.session = SimpleNamespace(login=lambda: None)
    service._resolve_sync_user_id = lambda: "sync-user"
    service._load_project_map = lambda: {}
    service._load_vendor_map = lambda: {}
    service._load_cost_codes = lambda: {}
    service._update_sync_state = lambda *_args, **_kwargs: None
    service._record_sync_run = lambda *_args, **_kwargs: None
    calls = []

    def handler(entity):
        def run(_cursor):
            calls.append(entity)
            if entity == failing_entity:
                raise RuntimeError(f"{entity} unavailable")
            return EntitySyncResult(entity=entity)

        return run

    for entity, method in (
        ("projects", "_sync_projects"),
        ("vendors", "_sync_vendors"),
        ("accounts", "_sync_accounts"),
        ("customers", "_sync_customers"),
        ("project_tasks", "_sync_project_tasks"),
        ("change_orders", "_sync_change_orders"),
        ("change_orders_projection", "_sync_change_orders_projection"),
        ("subcontracts", "_sync_subcontracts"),
        ("purchase_orders", "_sync_purchase_orders"),
        ("ap_bills", "_sync_ap_bills"),
        ("commitments_projection", "_sync_commitments_projection"),
        ("ar_invoices", "_sync_ar_invoices"),
        ("ar_payments", "_sync_payments"),
        ("ap_payment_applications", "_sync_ap_payment_applications"),
        ("payment_applications", "_sync_payment_applications"),
        ("ap_checks", "_sync_checks"),
        ("project_budgets", "_sync_project_budgets"),
    ):
        setattr(service, method, handler(entity))

    def run_entity(entity, target):
        calls.append(f"run:{entity}")
        return target(None)

    service._run_entity_sync = run_entity
    return service, calls


def test_company_cleanup_runs_only_after_vendor_and_customer_projections():
    service, calls = _service_with_handlers()
    service._purge_unlinked_non_acumatica_companies = lambda _cursor: EntitySyncResult(
        entity="company_cleanup", deleted=52
    )

    result = service.sync_all()

    assert calls.index("vendors") < calls.index("customers") < calls.index("run:company_cleanup")
    cleanup = next(item for item in result["results"] if item["entity"] == "company_cleanup")
    assert cleanup["deleted"] == 52
    assert result["status"] == "success"


def test_company_cleanup_skips_loudly_when_a_required_projection_fails():
    service, calls = _service_with_handlers(failing_entity="vendors")
    service._purge_unlinked_non_acumatica_companies = lambda _cursor: (_ for _ in ()).throw(
        AssertionError("cleanup must not run")
    )

    result = service.sync_all()

    assert "run:company_cleanup" not in calls
    cleanup = next(item for item in result["results"] if item["entity"] == "company_cleanup")
    assert cleanup["skipped"] == 1
    assert "vendors" in cleanup["warnings"][0]
    assert result["status"] == "partial_failure"
