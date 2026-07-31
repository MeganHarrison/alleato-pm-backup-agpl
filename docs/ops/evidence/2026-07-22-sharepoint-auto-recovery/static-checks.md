# SharePoint automatic recovery verification

Executed 2026-07-22.

| Check | Result |
| --- | --- |
| `cd backend && pytest -q tests/test_sharepoint_sync_recovery.py` | PASS — 3 passed |
| `cd backend && python -m py_compile src/services/integrations/microsoft_graph/onedrive.py src/services/integrations/microsoft_graph/sync.py` | PASS |
| `git diff --check` | PASS |
| `supabase db query --linked` against `source_sync_runs` | PASS — attached database has zero SharePoint `items_failed`; no current 12-file incident exists there |

The focused test covers the actual formerly silent boundary: Graph supplied a delta item, the file download failed, and the worker preserved the prior cursor with `retry_required=true` instead of saving the new cursor.
