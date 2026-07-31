# SharePoint automatic recovery handoff

Session: SROOT-SHAREPOINT-AUTO-RECOVERY-0722
Task: SHAREPOINT-AUTO-RECOVERY-0722
Status: Ready for release

## Runtime evidence

- The `/rag` screenshot displays 12 failed SharePoint entries, but the linked production database has zero `items_failed` for `source='sharepoint_file'` and its latest SharePoint run is 2026-05-14.
- The screenshot is therefore stale or from a different deployment/data environment; it is not evidence of 12 currently failed files.

## Root cause

- `sync_sharepoint_folder` logged individual download, storage, and metadata failures then continued, allowing the newly returned Graph delta cursor to be saved. Those entries would never be revisited.
- The folder-level exception handler cleared the cursor, turning a transient failure into an unbounded full rescan.

## Change

- Preserve the prior cursor on failed SharePoint file processing and mark the run warning with exact failure totals and automatic-retry metadata.
- Preserve the prior cursor on folder-level exceptions.

## Verification

- `cd backend && pytest -q tests/test_sharepoint_sync_recovery.py tests/test_source_sync_health.py`: 26 passed.
- `cd backend && python -m py_compile src/services/integrations/microsoft_graph/onedrive.py src/services/integrations/microsoft_graph/sync.py src/services/health/source_sync_health.py`: passed.
- `git diff --check`: passed.
- Neighboring `test_graph_sync_options.py` has two unrelated pre-existing failures because it patches an absent `embed_pending_attachment_documents` symbol; 12 selected tests passed.
- Independent review approved after the source-health reader was corrected to expose partial recovery warnings as degraded.

## Release evidence pending

- The recovery implementation is published. The Render API source repair now points `alleato-graph-sync` to the canonical repository; this release-evidence commit triggers its first auto-deploy. Confirm the resulting deploy before treating the worker as live.
