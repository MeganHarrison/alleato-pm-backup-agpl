# Fireflies metadata repair

Delivery lane: High-risk

## Acceptance contract

- The Fireflies writer persists the canonical `source`, `source_system`, `type`, and `category` fields.
- A dry run proves exactly 23 missing Fireflies meeting dates and exactly 20 deterministically repairable RAG classifications before any write.
- The apply path updates only rows still matching the preflight predicates, in separate transactions for the application and RAG databases.
- The remaining 14 RAG rows are reported as unresolved rather than guessed; they require source evidence or an explicit current-domain policy.

## Evidence

- Focused contract tests: `python3 -m pytest tests/test_fireflies_metadata_contract.py tests/test_fireflies_action_items.py -q` — 59 passed.
- Dry run: 23 Fireflies meeting dates (22 local authoritative fields/headers and 1 provider API date), 20 deterministic RAG repairs, 14 unresolved rows.
- Apply: 23 meeting dates and 20 RAG classifications updated in separate guarded transactions.
- Readback: `missing_meeting_dates=0`, `unresolved_rag_rows=14`.
- The 14 unresolved rows remain intentionally untouched: 12 lack an authoritative classification, one is an orphan RAG row, and two are drawing revisions whose canonical domain meaning does not require a generic source/category.
