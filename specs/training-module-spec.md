# Training Module Integration Specification

Status: Approved for foundation implementation
Date: 2026-07-26
Linear project: [Training Module — Alleato-PM](https://linear.app/alleato-group/project/training-module-alleato-pm-440c4dd32bec)

## Product Outcome

Alleato-PM provides one authenticated, company-wide `/training` module where
employees can select their role, find free vetted construction and software
training, read the three Alleato guides, and view supported videos inline.
Autonomous discovery adds review candidates; it never publishes directly.

The existing `training_docs` system remains the internal workflow-manual
authoring and QA control plane. This module adds the external resource library
and guide experience without replacing that owner.

## Locked ALL-15 Decisions

### 1. Route group and navigation

- Canonical route: `frontend/src/app/(main)/training/**`.
- Public path behind existing authentication: `/training`.
- The module uses the normal app shell. It is not a project-scoped route and is
  not placed under the table-only or full-bleed chat layouts.
- Add one company-wide `Training` navigation item under the existing `Work`
  section in `frontend/src/lib/navigation-config.ts`.
- There is one primary navigation entry and no duplicate CTA in page content.

### 2. Viewer role suggestion

- Reuse the existing `people.job_title` value already exposed as
  `CurrentUserProfile.title` by `/api/users/me/profile`.
- Normalize that title against training-role slugs, names, and aliases.
- An exact unambiguous match preselects the role.
- Missing or ambiguous matches leave the selector unset and preserve manual
  choice.
- Do not create a new per-user training-role column in version one.

### 3. Written guides

- Keep the PM Handbook, Superintendent Handbook, and Alleato-PM Software guide
  as versioned MDX files under `frontend/src/content/training-guides/`.
- Do not add a `training_guide` table.
- Guide routes render inside the authenticated Training module using shared
  typography and content primitives.

### 4. Review and publish

- Autonomous results are inserted with `status='review'`.
- `public.current_is_app_admin()` is the version-one reviewer gate for Brandon
  and designated app admins.
- App admins can read all statuses and publish or archive in-app.
- Ordinary authenticated users can read only `status='published'`.
- Resource Finder and service-role jobs can create review candidates but cannot
  bypass free-only, URL uniqueness, or data-shape constraints.
- Automation has no direct training-table write grant. It calls
  `create_training_review_candidate(...)`, whose signature exposes neither
  status/cost nor an existing resource id and atomically tags only the newly
  created review row.

### 5. Finder triggers

- Support both a weekly Render cron with rotating roles and an admin-only
  in-app “Find resources for role” action.
- Both triggers call the same backend service contract.
- T8/T9 own the backend service, endpoint, cron registration, and operational
  evidence; they are outside S220.

### 6. Video behavior

- Embed supported video providers inline.
- Always retain the canonical external URL as an explicit fallback.
- Unsupported or invalid embed providers render the external link only.
- Embed URLs must be derived or validated against an allowlist; arbitrary HTML
  and arbitrary iframe sources are forbidden.

## Data Contract

### Taxonomy tables

`training_role`

- Stable UUID primary key
- Unique normalized slug and display name
- Optional description and aliases
- Sort order and active flag

`training_topic`

- Stable UUID primary key
- Unique normalized slug and display name
- Optional description
- Sort order and active flag

### Resource table

`training_resource`

- Stable UUID primary key
- Required topic FK, title, canonical URL, resource type, level, track, status,
  and `cost='free'`
- Optional description, provider, embed URL, duration, thumbnail, source
  attribution, review/publish audit fields, and JSON metadata
- Canonical URL is unique and is the deduplication boundary
- Allowed statuses: `review`, `published`, `archived`
- Review candidates default to `review`
- Published rows record `published_at`

`training_resource_role`

- Composite unique resource/role association
- Cascades with deleted resources or roles

### Stable frontend domain types

```ts
type TrainingResourceStatus = "review" | "published" | "archived";
type TrainingResourceType = "video" | "course" | "doc";
type TrainingResourceLevel = "intro" | "deep-dive";

type TrainingRole = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  aliases: string[];
  sortOrder: number;
};

type TrainingTopic = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
};

type TrainingResource = {
  id: string;
  topicId: string;
  topicSlug: string;
  topicName: string;
  title: string;
  description: string | null;
  url: string;
  embedUrl: string | null;
  thumbnailUrl: string | null;
  provider: string | null;
  type: TrainingResourceType;
  level: TrainingResourceLevel;
  track: string;
  status: TrainingResourceStatus;
  durationMinutes: number | null;
  roles: TrainingRole[];
};
```

Track values remain normalized source vocabulary rather than a closed
application union until S221 returns the missing source inventory. ALL-16 asks
for a track enum, but inventing enum members before the source is recovered
would silently reject real records or encode fictional data. The foundation
therefore uses a named PostgreSQL domain with enum-like normalized validation;
the seed migration must replace it with a closed enum only after recording the
source vocabulary. Type and level values are already locked to the standalone
contract: `video | course | doc` and `intro | deep-dive`.

## Server Data-Access Contract

Canonical owner: `frontend/src/lib/training/server.ts`.

```ts
getResources({
  role?: string;
  track?: string;
  type?: TrainingResourceType;
  level?: TrainingResourceLevel;
  status?: TrainingResourceStatus;
  query?: string;
}): Promise<TrainingResource[]>

getTopics(): Promise<TrainingTopic[]>
getRoles(): Promise<TrainingRole[]>
resolveViewerRole(title: string | null, roles: TrainingRole[]): string | null
```

- Ordinary learner reads use the authenticated server Supabase client and RLS.
- Reviewer reads explicitly require app-admin authorization before requesting
  non-published statuses.
- The UI never receives a service-role credential.
- Resource Finder writes use only `create_training_review_candidate(...)`;
  direct service-role resource writes or published-resource retagging are
  forbidden.
- Query failures name the failed helper and filters; they do not silently return
  an empty library.

## Concurrent Ownership

### Codex S220

- This spec
- Supabase schema/RLS and seed migrations
- Generated database types
- `frontend/src/lib/training/**`
- Live database and ledger evidence

### Claude S221

- Recovery and normalization of the standalone source assets
- `scripts/training/source/**`
- `frontend/src/content/training-guides/**`
- Pure learner-facing presentation components in
  `frontend/src/features/training/**`

Route wiring and navigation begin after the S220 typed contract is published.

## Failure-Loudly Rules

- Missing source assets block the seed and show exact missing paths/counts.
- Unsupported enum/track/status values fail validation before insertion.
- Duplicate URLs fail or are reported as explicitly skipped by the seed/finder.
- Unauthorized review reads and all unauthorized writes fail through RLS and
  server authorization.
- Data-access query failures throw named, actionable errors instead of returning
  empty arrays.
- A migration is incomplete until the remote ledger and live schema readback
  both pass.
