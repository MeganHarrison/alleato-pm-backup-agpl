# Scheduling Completion Ledger

This ledger is the continuous execution source of truth for finishing the PM
scheduling module. Stale status labels in older task records do not override the
code, tests, database evidence, and later accepted handoffs summarized here.

## Complete Foundations

- Dependency and deadline lifecycle.
- Atomic replacement import.
- Calendar-aware CPM, critical path, lead/lag, and constraints.
- Audited field updates and schedule-submittal risk runtime.
- Immutable revisions, named baselines, and date variance.
- Phase 4A assignments and allocation.
- Phase 4B capacity calendars and leveling preview.
- Phase 4C enterprise capacity, hourly splits, apply/history/undo.
- Auto-scheduling engine and grid predecessor/successor shorthand.

## Remaining Execution Order

1. Relationship integrity
   - Filtered hidden successors: audited safe by existing visible-owner mapping.
   - Fail loudly on unavailable/corrupt graph analysis.
2. Transactional recalculation
   - Make trigger plus cascade writes atomic.
   - Recalculate earlier dates after dependency deletion.
   - Reconcile old and new predecessor influence on reassignment.
3. Canonical schedule I/O
   - Retire the partial legacy modal import path.
   - Route imports through the atomic replacement workflow.
   - Define faithful versus intentionally lossy export contracts.
4. Product acceptance gaps
   - Reconcile the Schedule/Planning workspace split.
   - Finish lookahead PDF/XLSX traceability.
   - Close evidence-linked risk and trade/vendor alert proofs.
5. Resource and Microsoft Project parity
   - Project-keyed writer locking.
   - Equipment/material resources, work/rates/cost, earned value.
   - Microsoft Project-compatible export/interchange.
   - Mid-list row insertion with guarded sort-order renumbering.
6. Release proof
   - Expand the scheduling release suite.
   - Repair reproducible authenticated browser environment injection.
   - Run desktop/mobile production journeys for every major scheduling workflow.

## Completion Rule

The program is complete only when every remaining item is implemented or removed
from product scope by an explicit approved decision, focused and release tests pass,
independent review is clear, required database migrations/readbacks are verified,
and authenticated production evidence covers the user-visible workflows.
