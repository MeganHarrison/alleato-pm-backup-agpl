# Photos Table Consolidation

**Date:** 2026-05-01
**Branch:** `claude/add-entity-relationships-dmUl4`

---

## Finding

There are two structurally distinct photo tables that serve different purposes. They are not duplicates — one is the operational, user-facing table and one is a richer structured store that is currently unused by the application.

---

## Table Comparison

| Attribute | `project_photos` (bigint PK) | `photos` (uuid PK) |
|-----------|------------------------------|---------------------|
| PK type | `bigint` (auto-identity) | `uuid` |
| API routes hitting it | 9 routes in `/api/projects/[projectId]/photos/*` | 0 routes |
| React hooks using it | `usePhotos`, `useUploadPhotos`, `useCreatePhoto`, `useUpdatePhoto`, `useDeletePhoto`, `useRestorePhoto`, `useDeletePhotoPermanently` | 0 hooks |
| Upload flow | `photos/upload/route.ts` writes here | Nothing writes here |
| FK children | None | `photo_links` (1 table), `observation_photos` references it indirectly |
| Soft delete | `deleted_at timestamptz` | No `deleted_at` |
| Privacy | `is_private boolean` | No privacy field |
| Album | `album text` (string field) | `album_id uuid` (FK to `photo_albums`) |
| Structured metadata | `title`, `trade`, `starred`, `file_url` | `storage_path`, `markup_data`, `gps_latitude/longitude`, `camera_make/model` |
| `project_id` type | `integer` (matches `projects.id`) | `integer` (also correct) |

### Key Evidence

All 9 API routes (`GET`, `POST`, `PUT`, `DELETE`, `restore`, `upload`) and all 7 hooks in `frontend/src/hooks/use-photos.ts` exclusively call `.from("project_photos")`. The `photos` table is referenced only by:

1. `photo_links.photo_id` (FK pointing to `photos.id`)
2. Four generic admin/dev routes (`/api/table-update`, `/api/table-delete`, `/api/table-insert`, `/api/dev/schema`) that enumerate all tables — these are not application flows
3. `photo_links.linked_id` (the polymorphic pointer side) references it conceptually but not via FK

The `photos` table has richer GPS and markup fields designed for a structured photo store. The `project_photos` table has the operational fields (`starred`, `is_private`, `trade`, `soft-delete`) that the photo upload/gallery UI actually needs.

---

## Recommendation

**Keep `project_photos`.** It is the live, active table connected to all UI workflows.

The `photos` table should be retired in a follow-up migration once the `photo_links` child table is either migrated or deleted. It is not safe to drop `photos` in Phase 2 because `photo_links` has a FK on it and dropping `photos` would cascade-delete all `photo_links` rows.

### Deprecation Plan (Phase 3 — schedule as follow-up)

1. Evaluate `photo_links` data. If there are live rows, migrate the `photo_id` FK to point to `project_photos.id` (requires changing the FK column from UUID to bigint — simplest fix is a new column `project_photo_id bigint REFERENCES project_photos(id)` alongside the existing UUID column, then backfill and drop old column).
2. Once `photo_links.photo_id` is re-pointed, drop the `photos` table and associated `photo_albums` references if those are also unused.
3. The `observation_photos` table (which stores file metadata, not photo IDs) is unrelated and unaffected.

### Impact on Phase 2 Link Tables

The Tier 1 link table pairs that reference photos (`photos_punch_items`, `photos_observations`, `photos_daily_logs`) should **FK to `project_photos`**, not `photos`.

This means:
- The FK column is `project_photo_id bigint NOT NULL REFERENCES public.project_photos(id) ON DELETE CASCADE`
- Table names should be adjusted to `project_photos_punch_items`, `project_photos_observations`, `project_photos_daily_logs` to reflect the source table

---

## What Would Have Caught This Earlier

The FK-TYPES-REFERENCE.md lists `photos` as a table but does not flag it as deprecated or note that `project_photos` is the active table. Adding a "deprecated tables" section to that reference doc would surface this for the next engineer.

**Guardrail added:** This document and the Phase 2 design doc explicitly state `project_photos` is canonical and link table FKs must target it, not `photos`.
