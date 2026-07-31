# RLS Regression Diff Report

Generated: 2026-05-15T18:35:56.898Z
Before: `snapshots/before`
After:  `snapshots/after`

## Overall Verdict: FAIL

| Result | Count |
|--------|-------|
| PASS   | 23 |
| WARN   | 0 |
| FAIL   | 25 |

## Persona: admin — FAIL

| Field | Before | After | Verdict |
|-------|--------|-------|---------|
| `counts.projects` | 111 | 111 | **PASS** |
| `counts.commitments` | 529 | 529 | **PASS** |
| `counts.documents` | 12685 | 12685 | **PASS** |
| `counts.document_metadata` | 36752 | 36768 | **FAIL** |
| `counts.insight_cards` | 6899 | 6899 | **PASS** |
| `counts.rfis` | 20 | 20 | **PASS** |
| `counts.change_orders` | 5 | 5 | **PASS** |
| `counts.prime_contracts` | 18 | 18 | **PASS** |
| `counts.owner_invoices` | 35 | 35 | **PASS** |
| `sample_ids.projects` | [31,34,38,43,47] | [31,34,38,43,47] | **PASS** |
| `sample_ids.commitments_unified` | ["00258ace-4370-4364-9867-640b2bf486d0","019cd1d6-9467-469b-9192-15663069843c","02a201f7-5d53-422d-b973-2e0b27f337fb","02ea9e87-6514-494c-8264-3df4ae2788c4","0349a1c6-5c7b-4662-8d50-34755e4390a3"] | ["00258ace-4370-4364-9867-640b2bf486d0","019cd1d6-9467-469b-9192-15663069843c","02a201f7-5d53-422d-b973-2e0b27f337fb","02ea9e87-6514-494c-8264-3df4ae2788c4","0349a1c6-5c7b-4662-8d50-34755e4390a3"] | **PASS** |
| `sample_ids.insight_cards` | ["0008c903-6abe-495b-937a-5916f23b2632","001b6dd3-a3e3-4ae2-89fd-559b2d561e38","00275f4b-ea0c-4eb3-abbe-e7d58a3df9f4","0042603a-2b3b-48c0-a5bc-020110bcbdd1","0048522a-16bf-492a-998d-b24e685494ff"] | ["0008c903-6abe-495b-937a-5916f23b2632","001b6dd3-a3e3-4ae2-89fd-559b2d561e38","00275f4b-ea0c-4eb3-abbe-e7d58a3df9f4","0042603a-2b3b-48c0-a5bc-020110bcbdd1","0048522a-16bf-492a-998d-b24e685494ff"] | **PASS** |

## Persona: member-67 — FAIL

| Field | Before | After | Verdict |
|-------|--------|-------|---------|
| `counts.projects` | 111 | 1 | **FAIL** |
| `counts.commitments` | 0 | 0 | **PASS** |
| `counts.documents` | 12685 | 0 | **FAIL** |
| `counts.document_metadata` | 7021 | 7037 | **FAIL** |
| `counts.insight_cards` | 197 | 197 | **PASS** |
| `counts.rfis` | 20 | 4 | **FAIL** |
| `counts.change_orders` | 5 | 0 | **FAIL** |
| `counts.prime_contracts` | 18 | 5 | **FAIL** |
| `counts.owner_invoices` | 35 | 3 | **FAIL** |
| `sample_ids.projects` | [31,34,38,43,47] | [67] | **FAIL** |
| `sample_ids.commitments_unified` | [] | [] | **PASS** |
| `sample_ids.insight_cards` | ["00275f4b-ea0c-4eb3-abbe-e7d58a3df9f4","01a4f15a-4066-4358-8425-80f1eb4415e3","02f02b78-e56b-4e44-8a51-d963ee6179e2","036afbf5-6676-4396-8975-0f7641d36e84","03d5f591-feb1-4f2f-af96-29aa4f3468dc"] | ["00275f4b-ea0c-4eb3-abbe-e7d58a3df9f4","01a4f15a-4066-4358-8425-80f1eb4415e3","02f02b78-e56b-4e44-8a51-d963ee6179e2","036afbf5-6676-4396-8975-0f7641d36e84","03d5f591-feb1-4f2f-af96-29aa4f3468dc"] | **PASS** |

## Persona: member-none — FAIL

| Field | Before | After | Verdict |
|-------|--------|-------|---------|
| `counts.projects` | 111 | 0 | **FAIL** |
| `counts.commitments` | 0 | 0 | **PASS** |
| `counts.documents` | 12685 | 0 | **FAIL** |
| `counts.document_metadata` | 7021 | 7037 | **FAIL** |
| `counts.insight_cards` | 0 | 0 | **PASS** |
| `counts.rfis` | 20 | 0 | **FAIL** |
| `counts.change_orders` | 5 | 0 | **FAIL** |
| `counts.prime_contracts` | 18 | 0 | **FAIL** |
| `counts.owner_invoices` | 35 | 0 | **FAIL** |
| `sample_ids.projects` | [31,34,38,43,47] | [] | **FAIL** |
| `sample_ids.commitments_unified` | [] | [] | **PASS** |
| `sample_ids.insight_cards` | [] | [] | **PASS** |

## Persona: external — FAIL

| Field | Before | After | Verdict |
|-------|--------|-------|---------|
| `counts.projects` | 111 | 1 | **FAIL** |
| `counts.commitments` | 0 | 0 | **PASS** |
| `counts.documents` | 12685 | 0 | **FAIL** |
| `counts.document_metadata` | 7021 | 7037 | **FAIL** |
| `counts.insight_cards` | 197 | 197 | **PASS** |
| `counts.rfis` | 20 | 4 | **FAIL** |
| `counts.change_orders` | 5 | 0 | **FAIL** |
| `counts.prime_contracts` | 18 | 5 | **FAIL** |
| `counts.owner_invoices` | 35 | 3 | **FAIL** |
| `sample_ids.projects` | [31,34,38,43,47] | [67] | **FAIL** |
| `sample_ids.commitments_unified` | [] | [] | **PASS** |
| `sample_ids.insight_cards` | ["00275f4b-ea0c-4eb3-abbe-e7d58a3df9f4","01a4f15a-4066-4358-8425-80f1eb4415e3","02f02b78-e56b-4e44-8a51-d963ee6179e2","036afbf5-6676-4396-8975-0f7641d36e84","03d5f591-feb1-4f2f-af96-29aa4f3468dc"] | ["00275f4b-ea0c-4eb3-abbe-e7d58a3df9f4","01a4f15a-4066-4358-8425-80f1eb4415e3","02f02b78-e56b-4e44-8a51-d963ee6179e2","036afbf5-6676-4396-8975-0f7641d36e84","03d5f591-feb1-4f2f-af96-29aa4f3468dc"] | **PASS** |

## Failures (Investigate These)

### admin / counts.document_metadata

- **Before:** `36752`
- **After:**  `36768`
- **Interpretation:** The RLS policy change altered the visible row set for this persona on this table. This must be explained and approved before the migration can be considered safe.

### member-67 / counts.projects

- **Before:** `111`
- **After:**  `1`
- **Interpretation:** The RLS policy change altered the visible row set for this persona on this table. This must be explained and approved before the migration can be considered safe.

### member-67 / counts.documents

- **Before:** `12685`
- **After:**  `0`
- **Interpretation:** The RLS policy change altered the visible row set for this persona on this table. This must be explained and approved before the migration can be considered safe.

### member-67 / counts.document_metadata

- **Before:** `7021`
- **After:**  `7037`
- **Interpretation:** The RLS policy change altered the visible row set for this persona on this table. This must be explained and approved before the migration can be considered safe.

### member-67 / counts.rfis

- **Before:** `20`
- **After:**  `4`
- **Interpretation:** The RLS policy change altered the visible row set for this persona on this table. This must be explained and approved before the migration can be considered safe.

### member-67 / counts.change_orders

- **Before:** `5`
- **After:**  `0`
- **Interpretation:** The RLS policy change altered the visible row set for this persona on this table. This must be explained and approved before the migration can be considered safe.

### member-67 / counts.prime_contracts

- **Before:** `18`
- **After:**  `5`
- **Interpretation:** The RLS policy change altered the visible row set for this persona on this table. This must be explained and approved before the migration can be considered safe.

### member-67 / counts.owner_invoices

- **Before:** `35`
- **After:**  `3`
- **Interpretation:** The RLS policy change altered the visible row set for this persona on this table. This must be explained and approved before the migration can be considered safe.

### member-67 / sample_ids.projects

- **Before:** `[31,34,38,43,47]`
- **After:**  `[67]`
- **Interpretation:** The RLS policy change altered the visible row set for this persona on this table. This must be explained and approved before the migration can be considered safe.

### member-none / counts.projects

- **Before:** `111`
- **After:**  `0`
- **Interpretation:** The RLS policy change altered the visible row set for this persona on this table. This must be explained and approved before the migration can be considered safe.

### member-none / counts.documents

- **Before:** `12685`
- **After:**  `0`
- **Interpretation:** The RLS policy change altered the visible row set for this persona on this table. This must be explained and approved before the migration can be considered safe.

### member-none / counts.document_metadata

- **Before:** `7021`
- **After:**  `7037`
- **Interpretation:** The RLS policy change altered the visible row set for this persona on this table. This must be explained and approved before the migration can be considered safe.

### member-none / counts.rfis

- **Before:** `20`
- **After:**  `0`
- **Interpretation:** The RLS policy change altered the visible row set for this persona on this table. This must be explained and approved before the migration can be considered safe.

### member-none / counts.change_orders

- **Before:** `5`
- **After:**  `0`
- **Interpretation:** The RLS policy change altered the visible row set for this persona on this table. This must be explained and approved before the migration can be considered safe.

### member-none / counts.prime_contracts

- **Before:** `18`
- **After:**  `0`
- **Interpretation:** The RLS policy change altered the visible row set for this persona on this table. This must be explained and approved before the migration can be considered safe.

### member-none / counts.owner_invoices

- **Before:** `35`
- **After:**  `0`
- **Interpretation:** The RLS policy change altered the visible row set for this persona on this table. This must be explained and approved before the migration can be considered safe.

### member-none / sample_ids.projects

- **Before:** `[31,34,38,43,47]`
- **After:**  `[]`
- **Interpretation:** The RLS policy change altered the visible row set for this persona on this table. This must be explained and approved before the migration can be considered safe.

### external / counts.projects

- **Before:** `111`
- **After:**  `1`
- **Interpretation:** The RLS policy change altered the visible row set for this persona on this table. This must be explained and approved before the migration can be considered safe.

### external / counts.documents

- **Before:** `12685`
- **After:**  `0`
- **Interpretation:** The RLS policy change altered the visible row set for this persona on this table. This must be explained and approved before the migration can be considered safe.

### external / counts.document_metadata

- **Before:** `7021`
- **After:**  `7037`
- **Interpretation:** The RLS policy change altered the visible row set for this persona on this table. This must be explained and approved before the migration can be considered safe.

### external / counts.rfis

- **Before:** `20`
- **After:**  `4`
- **Interpretation:** The RLS policy change altered the visible row set for this persona on this table. This must be explained and approved before the migration can be considered safe.

### external / counts.change_orders

- **Before:** `5`
- **After:**  `0`
- **Interpretation:** The RLS policy change altered the visible row set for this persona on this table. This must be explained and approved before the migration can be considered safe.

### external / counts.prime_contracts

- **Before:** `18`
- **After:**  `5`
- **Interpretation:** The RLS policy change altered the visible row set for this persona on this table. This must be explained and approved before the migration can be considered safe.

### external / counts.owner_invoices

- **Before:** `35`
- **After:**  `3`
- **Interpretation:** The RLS policy change altered the visible row set for this persona on this table. This must be explained and approved before the migration can be considered safe.

### external / sample_ids.projects

- **Before:** `[31,34,38,43,47]`
- **After:**  `[67]`
- **Interpretation:** The RLS policy change altered the visible row set for this persona on this table. This must be explained and approved before the migration can be considered safe.

