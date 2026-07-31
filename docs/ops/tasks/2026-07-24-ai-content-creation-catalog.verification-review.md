# Remote database read-back

Reviewed at: 2026-07-24T22:50:00Z

The Supabase Management API read-back after migration `20260724194500` returned:

- `implemented_count`: 12
- `unavailable_count`: 7
- `documented_implemented_count`: 12
- `screenshot_column_exists`: true
- `workflow_column_exists`: true

The migration ledger verifier also confirmed that version `20260724194500` is applied.

The first apply attempt failed on the live `procore_features_complexity_check` constraint and was rolled back atomically. The corrected migration uses only `easy`, `medium`, and `hard` values, all accepted by the live constraint.

## Static catalog contract

The migration was also checked for 19 catalog records, 12 implemented rows, 7 unavailable rows, only permitted complexity values, both new columns, and idempotent update-or-insert behavior by feature slug. Result: pass.
