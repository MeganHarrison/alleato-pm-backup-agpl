# SharePoint Vector Freshness Verification

Date: 2026-07-22
Task: `LOCAL-2026-07-22-SHAREPOINT-VECTOR-FRESHNESS`

## Localized boundary

The first incorrect boundary was PM APP source persistence to AI Database vectorization:

- PM APP contained 18 eligible SharePoint proposal/estimate documents with complete extracted text.
- AI Database contained zero `document_chunks` rows for those 18 document IDs.
- The 2026-07-22 18:22 UTC `graph_embed` receipt recorded 25 attempted documents, 25 failures, and zero chunks.
- Affected RAG metadata persisted an AI Gateway HTTP 402 credit error.

The scheduler then crossed a second incorrect boundary: `embed_pending_graph_documents()` returned a nonzero `errors` count, but `_run_graph_downstream_processing()` did not add that result to its error ledger. `run_graph_sync.py` also returned zero whenever any source rows had synced, allowing Render to label the run successful.

## Provider repair

- Rotated `AI_GATEWAY_API_KEY` through Render's individual environment-variable endpoint for the six active canonical `The-Alleato-Group/project-management` services that owned a direct copy.
- Changed AI workloads to gateway-first routing while leaving provider failover enabled.
- Updated the shared Render environment group with the verified credential.
- Resumed `alleato-source-rag-health`, repointed it from the retired `MeganHarrison/alleato-pm` repository to canonical `The-Alleato-Group/project-management`, and enabled commit auto-deploy.
- Verified the corrected monitor deployment `dep-d9ghesrbc2fs7386u3ig` reached `live` from canonical `main`.
- Restored the monitor schedule from the drifted every-four-hours value to the canonical `*/5 * * * *` cadence.
- Replaced two invalid SharePoint sync paths with the three connector-verified Port and Union proposal/estimate folders and raised `SHAREPOINT_SYNC_MAX_FOLDERS` from `2` to `3`; Render readback confirms all three durable entries.
- Verified the configured key by making a 3,072-dimensional embedding request before applying it; no secret value was logged.

## Production replay

The controlled repair enumerated eligible SharePoint rows, anti-joined them against non-null embeddings, and replayed only missing documents:

```json
{
  "eligible": 423,
  "missing_before": 18,
  "embedded_now": 18,
  "chunks_written": 32,
  "errors": []
}
```

## Independent database readback

Post-replay reconciliation through independent PM APP and AI Database queries was rerun at `2026-07-22T19:30:55.700645Z`. The exact SQL, project IDs, sorted ID-set hashes, and results are preserved in `database-readback.json`. Matching hashes prove equality of the eligible source and vectorized ID sets rather than only matching aggregate counts:

```json
{
  "eligibleSharePoint": 423,
  "vectorizedEligible": 423,
  "missingEligible": 0,
  "proposalEstimateEligible": 18,
  "proposalEstimateVectorized": 18,
  "proposalEstimateMissing": 0,
  "proposalEstimateChunkDimensions": {
    "chunks": 32,
    "min_dims": 3072,
    "max_dims": 3072
  }
}
```

The PM APP eligible ID-set hash and AI Database vectorized ID-set hash both equal `4c03240e92a75f3788462bb624afa294`. The proposal/estimate hashes both equal `ec17dc15860bd339488eaa752aca77e2`.

## Regression checks

Focused contract:

```text
pytest -q tests/test_graph_sync_options.py tests/test_run_graph_sync_script.py \
  -k 'graph_embedding_error_count or unfetchable_embedding_candidates or cron_exits'
4 passed, 14 deselected
```

Broader focused file result after removing two stale monkeypatches for the already-removed attachment embed symbol:

```text
pytest -q tests/test_graph_sync_options.py tests/test_run_graph_sync_script.py
19 passed
```

## Failure-loudly proof

- Returned Graph embedding errors now set downstream status to `complete_with_errors`.
- Unfetchable pending candidates are explicit downstream failures.
- Post-OCR unfetchable candidates use the same fail-closed reconciliation contract.
- Post-OCR and Fireflies embedding failures join the same error ledger.
- The cron exits nonzero on any source or downstream error, even when source rows were successfully written.
- The source RAG health cron is active again to detect source-to-vector coverage drift independently of the ingestion cron.

## Release and scheduled-run proof

- Exact task files were published to `origin/main` at `c8a8a805bf62fa12826a717257ec0ba3119ceb72`.
- `alleato-graph-sync` deployment `dep-d9ghm6m1a83c73a0utb0` and `alleato-source-rag-health` deployment `dep-d9ghm6m1a83c73a0ut70` reached `live` on that commit. The subsequent live service commit `6ce38e7bb5fdedaab66ac065266af308317b606b` contains `c8a8a805` in its Git ancestry.
- Triggered scheduled run `crn-d827dut7vvec73b33fa0-1784749184` read the durable three-folder configuration. AI Database `source_sync_runs` records all three resources as `succeeded` with `items_failed=0` at 19:40:58-19:41:01 UTC. Each had zero new deltas, which is the expected current state after the controlled 18-file ingestion.
- The full run then exited nonzero because of an unrelated legacy Outlook cursor for `awehner@alleatogroup.com`. This is affirmative proof that the new cron contract no longer reports success when any source lane fails. The scoped Outlook state was reset for canonical cursor reseeding on the next pass; SharePoint source receipts remained successful.
