"""Contract tests for the AP-bill direct-cost projection gross/net semantics.

Regression guard for the retainage bug (2026-07-10): the projection stored a
GROSS header (``direct_costs.total_amount`` = sum of ExtendedCost) while each
``direct_cost_line_items`` row carried ``unit_cost = detail.UnitCost`` (NET of
retainage). Because ``line_total`` is a generated column (quantity * unit_cost),
the line totals were net and did NOT reconcile to the gross header — and, worse,
budget JTD (which sums ``line_total`` per budget code) was understated by the
retainage on every retained line.

The fix: derive ``unit_cost`` from the GROSS ExtendedCost so the generated
``line_total`` reconciles to the header AND feeds gross JTD to the budget.
"""

from services.acumatica_sync import (
    _ap_bill_detail_amounts,
    _DIRECT_COST_RECON_TOLERANCE_PER_LINE,
)


def _generated_line_total(quantity: float, unit_cost: float) -> float:
    """Replay the Postgres generated column: numeric(10,2) * numeric(15,2)."""
    return round(round(quantity, 2) * round(unit_cost, 2), 2)


def test_retained_line_003263_reconciles_to_gross_header():
    # Bill|003263 (prod evidence): ExtendedCost gross $9,947.78; UnitCost net
    # $8,953.00; Qty 1. The stored line total MUST be gross, not net.
    detail = {"ExtendedCost": "9947.78", "UnitCost": "8953.00", "Qty": "1"}
    quantity, unit_cost, line_total = _ap_bill_detail_amounts(detail)

    assert quantity == 1.0
    assert line_total == 9947.78
    # unit_cost is grossed up — it must NOT be the net detail.UnitCost.
    assert unit_cost != 8953.00
    assert _generated_line_total(quantity, unit_cost) == 9947.78


def test_retained_line_003213_reconciles_to_gross_header():
    # Bill|003213 (prod evidence): 5% retainage, gross $55,663.55 vs net $52,880.37.
    detail = {"ExtendedCost": "55663.55", "UnitCost": "52880.37", "Qty": "1"}
    quantity, unit_cost, line_total = _ap_bill_detail_amounts(detail)

    assert line_total == 55663.55
    assert _generated_line_total(quantity, unit_cost) == 55663.55


def test_multi_quantity_gross_line_reconciles_within_penny_tolerance():
    # Qty > 1 with a value that does not divide evenly still reconciles within
    # the per-line rounding tolerance (unit_cost stored at 2 decimals).
    detail = {"ExtendedCost": "100.00", "UnitCost": "30.00", "Qty": "3"}
    quantity, unit_cost, line_total = _ap_bill_detail_amounts(detail)

    assert line_total == 100.00
    generated = _generated_line_total(quantity, unit_cost)
    # Compare in integer cents (matches the projection guardrail) so the
    # boundary case does not flap on float representation.
    diff_cents = round(abs(generated - line_total) * 100)
    assert diff_cents <= round(_DIRECT_COST_RECON_TOLERANCE_PER_LINE * 100)


def test_falls_back_to_amount_when_extended_cost_absent():
    detail = {"Amount": "1200.00", "UnitCost": "1200.00", "Qty": "1"}
    quantity, unit_cost, line_total = _ap_bill_detail_amounts(detail)

    assert line_total == 1200.00
    assert _generated_line_total(quantity, unit_cost) == 1200.00


def test_falls_back_to_net_unit_cost_only_when_no_extended_value():
    # Neither ExtendedCost nor Amount present — use UnitCost * Qty so the row is
    # not silently zeroed. (Not a retained-line scenario.)
    detail = {"UnitCost": "500.00", "Qty": "2"}
    quantity, unit_cost, line_total = _ap_bill_detail_amounts(detail)

    assert line_total == 1000.00
    assert _generated_line_total(quantity, unit_cost) == 1000.00


def test_missing_all_amounts_yields_zero_not_crash():
    quantity, unit_cost, line_total = _ap_bill_detail_amounts({})

    assert quantity == 1.0
    assert unit_cost == 0.0
    assert line_total == 0.0


def test_ap_honors_ext_cost_alias_as_gross():
    # Guardrail for the 2026-07-10 preventive fix: a detail carrying only the
    # `ExtCost` alias (not `ExtendedCost`) plus a net `Amount` must resolve to the
    # GROSS ExtCost, not silently fall through to the net Amount. Before the fix
    # the AP path omitted the alias and would have stored 950 (net).
    detail = {"ExtCost": "1000.00", "Amount": "950.00", "UnitCost": "950.00", "Qty": "1"}
    quantity, unit_cost, line_total = _ap_bill_detail_amounts(detail)

    assert line_total == 1000.00
    assert unit_cost != 950.00  # not the net value
    assert _generated_line_total(quantity, unit_cost) == 1000.00


def test_ap_unwraps_wrapped_extended_cost():
    # Guardrail: a wrapped `{"value": ...}` envelope on ExtendedCost must be
    # unwrapped to the gross number, not mis-read as non-numeric (which the old
    # AP path did, falling through to the net Amount).
    detail = {"ExtendedCost": {"value": "777.70"}, "Amount": "700.00", "Qty": "1"}
    quantity, unit_cost, line_total = _ap_bill_detail_amounts(detail)

    assert line_total == 777.70
    assert _generated_line_total(quantity, unit_cost) == 777.70


def test_header_total_equals_sum_of_generated_line_totals_multiline():
    # A bill with mixed retained lines: the header (sum of gross line_total)
    # must equal the sum of the generated line totals within tolerance.
    details = [
        {"ExtendedCost": "9947.78", "UnitCost": "8953.00", "Qty": "1"},
        {"ExtendedCost": "55663.55", "UnitCost": "52880.37", "Qty": "1"},
        {"ExtendedCost": "100.00", "UnitCost": "30.00", "Qty": "3"},
    ]
    header_total = 0.0
    generated_sum = 0.0
    for detail in details:
        quantity, unit_cost, line_total = _ap_bill_detail_amounts(detail)
        header_total += line_total
        generated_sum += _generated_line_total(quantity, unit_cost)

    diff_cents = round(abs(round(header_total, 2) - round(generated_sum, 2)) * 100)
    tolerance_cents = round(_DIRECT_COST_RECON_TOLERANCE_PER_LINE * 100) * len(details)
    assert diff_cents <= tolerance_cents
