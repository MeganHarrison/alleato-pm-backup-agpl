"""Canonical Acumatica cost-line gross-value resolution.

Single owner of the "gross extended line value" ladder that was previously
forked across three writers in ``acumatica_sync.py`` (the AP-bill direct-cost
projection and the subcontract / purchase-order SOV projections) plus a JS
backfill port. In Acumatica, ``ExtendedCost`` (alias ``ExtCost``) is the GROSS
extended line value; ``Amount`` is net of retainage. Retainage is applied at
invoicing, never baked into cost values — using ``Amount`` understates every
retained line (the 2026-07 direct-cost bug, PR #878).

The three copies had drifted on four independent axes: whether they unwrap
Acumatica ``{"value": x}`` envelopes, whether they honor the ``ExtCost`` alias,
and two different zero/None selection styles. This module reproduces each
caller's exact current behavior through explicit flags, so the previously
remaining SOV-specific semantics are explicit at each call site:

    purchase-order SOV : resolve_gross_extended(detail, treat_zero_as_missing=True)
    subcontract SOV    : resolve_gross_extended(detail, use_first_present_raw=True)
    AP direct cost     : resolve_gross_extended(detail)
"""

from typing import Any, Optional, Tuple


def _unwrap_value(raw: Any) -> Any:
    """Unwrap a single Acumatica ``{"value": x}`` envelope; pass scalars through.

    Matches ``acumatica_sync._unwrap`` for the scalar/single-value-envelope
    shapes that a money field can take. Non-numeric shapes fall out as ``None``
    at ``_to_float``.
    """
    if isinstance(raw, dict) and "value" in raw and len(raw) == 1:
        return raw["value"]
    return raw


def _to_float(value: Any) -> Optional[float]:
    """Mirror of ``acumatica_sync._num``: float or ``None``, never raises."""
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _gross_keys() -> Tuple[str, ...]:
    return ("ExtendedCost", "ExtCost", "Amount")


def resolve_gross_extended(
    detail: dict,
    *,
    treat_zero_as_missing: bool = False,
    use_first_present_raw: bool = False,
) -> Optional[float]:
    """Resolve the gross extended line value from an Acumatica detail line.

    Walks ``ExtendedCost`` → (``ExtCost``) → ``Amount``. Returns ``None`` when no
    candidate resolves — callers apply their own ``or 0`` / fallback.

    The resolver always unwraps Acumatica field envelopes and honors the
    ``ExtCost`` alias between ``ExtendedCost`` and ``Amount``.

    Remaining flags encode current SOV-specific semantics:
    - ``treat_zero_as_missing`` — skip a ``0`` candidate and keep walking (the
      purchase-order writer's ``_num(...) or _num(...)`` truthiness chain).
    - ``use_first_present_raw`` — take the first field that is present (non-None)
      after unwrapping, then coerce to float once (the subcontract writer's
      ``raw = a if a is not None else b`` style), instead of the first field that
      coerces to a number.
    """
    keys = _gross_keys()

    if use_first_present_raw:
        raw: Any = None
        for key in keys:
            raw = _unwrap_value(detail.get(key))
            if raw is not None:
                break
        return _to_float(raw)

    for key in keys:
        value = _to_float(_unwrap_value(detail.get(key)))
        if value is None:
            continue
        if treat_zero_as_missing and value == 0:
            continue
        return value
    return None
