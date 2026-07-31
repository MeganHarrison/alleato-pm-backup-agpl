# RLS Access Level Decision: `document_metadata.access_level = 'team'`

**Analysis date:** 2026-05-15  
**Status:** Decision pending — no policy changes made  
**Author:** Phase 1.6 follow-up (Agent M)

---

## Background

During Phase 1.6 follow-up, we were asked to investigate whether `access_level = 'team'` on `document_metadata` should continue to allow cross-project visibility, or whether it should require project membership.

---

## Current Policy Logic

The relevant clause in `document_metadata_select`:

```sql
(current_is_app_admin()
  OR (
    COALESCE(category, '') <> ALL (ARRAY['email', 'teams_message'])
    AND (
      (project_id IS NOT NULL AND current_is_project_member(project_id))
      OR (access_level = 'team')
      OR (EXISTS (SELECT 1 FROM document_user_access dua WHERE dua.document_id = document_metadata.id AND dua.user_id = (SELECT auth.uid())))
    )
  )
)
```

Key points:
- Emails and Teams messages are **excluded from the `access_level = 'team'` escape hatch** — they require project membership or explicit `document_user_access` grants.
- All other categories (documents, drawings, contracts, invoices, etc.) with `access_level = 'team'` are visible to **any authenticated user** regardless of project membership.
- There are also separate role-based policies (`team_access`, `leadership_access`) that grant visibility to all `access_level = 'team'` rows for `role = 'team'` and `role = 'leadership'` JWT claims respectively.

---

## Row Distribution

Total rows with `access_level = 'team'`: **36,855** (100% of all `document_metadata` rows — no other access level values exist in production)

**By category:**

| Category | Count | Sensitivity |
|----------|-------|-------------|
| teams_message | 27,295 | Medium — already excluded from team-access escape hatch |
| document | 5,059 | Variable (general docs to contracts) |
| email | 2,481 | Medium — already excluded from team-access escape hatch |
| (null) | 1,407 | Unknown |
| Internal | 180 | Low (meeting notes, exec updates) |
| financial_document | 122 | High |
| specification | 92 | Medium |
| knowledge | 48 | Low |
| Weekly Exec / Weekly Ops | 41 | Low-Medium (internal updates) |
| Contract | 39 | High |
| Drawing | 42 | Medium |
| Invoice | 7 | High |
| change-order | 1 | High |
| commitment | 1 | High |
| lein-waiver | 1 | High |

**Project scoping within `access_level = 'team'`:**

- ~55% of rows have a `project_id` (project-scoped)
- ~45% have no `project_id` (company-wide content — meeting recaps, emails not matched to a project, general docs)

**High-sensitivity categories with `access_level = 'team'`:**
- Contracts: 39 rows (23 project-scoped)
- financial_document: 122 rows (46 project-scoped, 76 unscoped)
- Invoice: 7 rows (all project-scoped)
- change-order: 1 row (project-scoped)
- commitment: 1 row (project-scoped)
- lein-waiver: 1 row (unscoped)

---

## The Two Options

### Option A: Status Quo — `access_level = 'team'` bypasses project membership check

**Behavior:** Any authenticated user can read any non-email, non-teams-message row regardless of project membership, as long as `access_level = 'team'`.

**Arguments for:**
- The `access_level` field was explicitly set at ingestion time to `'team'` — meaning the sync pipeline decided this content is company-wide. This is an intentional classification.
- Unscoped rows (no `project_id`) have nowhere else to go — requiring project membership on an unscoped row would make it invisible to everyone (except admins).
- Financial documents and contracts in document_metadata are metadata/summaries from synced files, not the authoritative records (which live in `budget_lines`, `contracts`, `owner_invoices`, etc. with proper RLS). Leaking a file summary is a lower-severity risk than leaking an actual contract row.
- The `team_access` and `leadership_access` role-based policies already reflect a design intent that certain roles see all team-level content.

**Arguments against:**
- Project-scoped contracts, invoices, and financial documents (7+122+39 rows with `project_id`) are currently visible to any authenticated user even if they are not a member of that project. This violates the principle of least privilege.
- `access_level = 'team'` is set by the sync pipeline as a default — it may not accurately reflect sensitivity. The field was never reviewed row-by-row for appropriateness.
- A future external user onboarded to one project could view financial summaries from all other projects.

### Option B: Require project membership for project-scoped `access_level = 'team'` rows

**Behavior:** If `project_id IS NOT NULL`, require `current_is_project_member(project_id)` even when `access_level = 'team'`. Unscoped rows remain visible to all authenticated users.

**Policy change:**
```sql
-- Replace the `access_level = 'team'` clause with:
(
  (access_level = 'team' AND project_id IS NULL)  -- unscoped team content remains visible
  OR (project_id IS NOT NULL AND current_is_project_member(project_id))  -- project content requires membership
  OR (EXISTS (...document_user_access...))  -- explicit grants still work
)
```

**Arguments for:**
- Eliminates cross-project leakage for sensitive project-scoped content.
- Correctly enforces the project boundary for invoices, contracts, and financial docs that have a `project_id`.
- The `access_level` field becomes less of a security control and more of a UI/display hint.

**Arguments against:**
- Unscoped rows with `access_level = 'team'` (45% of all rows) remain fully open — the gain is limited to ~55% of rows.
- For the `team_access` and `leadership_access` role-based policies that independently grant visibility, the change would need to be applied there too for full effect.
- Performance: the `current_is_project_member()` function call on every non-admin row scan already caused the timeout described in F1. Adding the `project_id IS NULL` branch helps but the query shape becomes more complex.

---

## Recommendation

**Implement Option B**, but only for the `document_metadata_select` policy. Leave the `team_access` and `leadership_access` role-based policies unchanged for now (those are role-gated at the JWT level, which is a separate control layer).

**Rationale:**
- The 39 contract rows, 122 financial_document rows, and 7 invoice rows with `project_id` are the most sensitive exposure. These are summaries of authoritative financial records and should not cross project boundaries.
- The 45% of unscoped rows are legitimately company-wide (unmatched emails, internal memos, exec updates) — keeping them accessible to all authenticated users is correct.
- The sync pipeline sets `access_level = 'team'` as a default, not as a deliberate security classification. Treating it as a security bypass is the wrong frame.
- The `idx_document_metadata_project_id` index (confirmed present) means the `project_id IS NULL` filter is index-assisted.

**Implementation (when ready to act):**

```sql
drop policy if exists "document_metadata_select" on public.document_metadata;

create policy "document_metadata_select" on public.document_metadata
  as permissive
  for select
  to authenticated
  using (
    current_is_app_admin()
    or (
      coalesce(category, '') <> all (array['email', 'teams_message'])
      and (
        -- Unscoped team content: visible to all authenticated users
        (access_level = 'team' and project_id is null)
        -- Project-scoped content: always requires membership
        or (project_id is not null and current_is_project_member(project_id))
        -- Explicit individual grants
        or (exists (
          select 1 from document_user_access dua
          where dua.document_id = document_metadata.id
            and dua.user_id = (select auth.uid())
        ))
      )
    )
  );
```

**Note:** Do not implement without also reviewing the `leadership_access` and `team_access` policies, which independently grant visibility based on JWT role claims. Those bypass project membership entirely and may need similar tightening if external/multi-project users are onboarded with those roles.

---

## Action Required

This document is an analysis. No policy has been changed. The decision belongs to the product owner. Key question to answer:

> Are there any authenticated users in production who should see project-scoped financial documents, contracts, or invoices from projects they are NOT a member of?

If no: implement Option B.  
If yes (e.g., a CFO role that spans all projects): implement Option B but add a `current_is_app_admin()` or role-based bypass for that use case.
