# FM Global / ASRS: Current Functionality and Plan

Last reviewed: 2026-07-18

## Canonical pages

| Surface | URL | Access | Purpose |
| --- | --- | --- | --- |
| ASRS sprinkler intake | https://projects.alleatogroup.com/fm-global/form | Public | Captures ASRS storage, rack, sprinkler, and contact/project details. |
| Submission confirmation | `https://projects.alleatogroup.com/fm-global/form/submitted/{submissionId}` | Public link with a submission ID | Confirms and displays the submitted request details. |
| FM Global dashboard | https://projects.alleatogroup.com/fm-global | Authenticated | Browse FM Global table and figure reference data and open the intake form. |
| FM Global tables | https://projects.alleatogroup.com/fm-global/fm_global_tables | Authenticated | Search, filter, sort, and export the imported sprinkler-protection tables. |
| Form submissions | https://projects.alleatogroup.com/fm-global/submissions | Authenticated | Search and manage submitted ASRS sprinkler-design requests. |
| Submission detail | `https://projects.alleatogroup.com/fm-global/submissions/{submissionId}` | Authenticated | Review input, contact/project data, matched table IDs, and lead metadata. |

`{submissionId}` is a required runtime identifier, so the two parameterized links are route templates rather than standalone pages.

## Functionality already created

### Public request flow

- A client-facing, unauthenticated ASRS sprinkler-details form collects contact and project data plus system classification, storage/rack dimensions, commodity class, and existing ceiling-sprinkler K-factor.
- Client and server validation reject incomplete or malformed submissions before persistence.
- Submission processing calls the `find_sprinkler_requirements` database RPC, gathers matching FM Global tables, related figures, sprinkler configurations, and optimization recommendations, then saves the request in `fm_form_submissions`.
- After a successful save, the user is redirected to a public confirmation page. The confirmation currently shows the submitted details; it does not present the calculated recommendation/match output.

### Internal reference and operations flow

- The dashboard exposes imported FM Global tables and figures with filtering and CSV export via the shared table pattern.
- The submissions workspace supports searching by contact, project, ASRS type, system type, and commodity class; rows lead to a detailed review page, and authenticated users can delete a submission.
- Submission detail records include input, contact/project data, matched-table IDs, and lead status/score.

### Data foundation

- The implementation reads/writes the FM/ASRS domain tables, including `fm_global_tables`, `fm_global_figures`, `fm_sprinkler_configs`, `fm_form_submissions`, and supporting ASRS/FM rule and content tables.
- The active database owner remains the PM APP Supabase project while the dedicated ASRS Supabase migration is in progress.

## Known limitation and guardrail

The K-factor overload of `find_sprinkler_requirements` still references removed columns. The application deliberately treats that lookup as best-effort: it logs a warning and continues with the height-based lookup so a valid request is not silently lost. This protects intake continuity, but it means K-factor filtering is not currently reliable enough to be shown as a definitive design result.

## Overall plan

1. **Complete the dedicated ASRS Supabase migration.** Copy the scoped schema, data, sequences, indexes, constraints, RLS policies, triggers, and table-local database objects; validate row counts, foreign keys, and representative lookup queries. Do not cut over the application or delete the PM APP source during this phase.
2. **Repair and verify the matching contract.** Update the K-factor RPC overload to match the live `fm_global_tables` schema, add a regression test for both height- and K-factor-based matching, and fail the request visibly when the required primary lookup cannot run.
3. **Make results reviewable.** Decide whether calculated matches and recommendations should appear on the public confirmation page, internal submission detail only, or both. Store the exact matching inputs, matched source references, and result version so each recommendation is traceable.
4. **Perform a controlled application cutover.** Point only the FM/ASRS data client at the dedicated project, regenerate types, replay public intake and authenticated operations flows, and retain readback/rollback evidence before decommissioning any source data.
5. **Harden ongoing operations.** Add monitoring for failed matches and submission persistence, import/version provenance for FM source material, and an auditable review workflow for design recommendations.

## Verification status

- The public intake route returned HTTP 200 from the production hostname on 2026-07-18.
- Authenticated pages require a signed-in session and were identified from the canonical route tree; they were not exercised in this review.
- Production deployment inspection through the configured Vercel connector was unavailable because its token lacks access to the `the-alleato-group` scope. The public-route response and checked-in runtime URL establish the links above.
