# ADR-0002: Architecture Change Log Source

Date: 2026-07-16
Status: Accepted
Owner: Engineering

## Context

Leadership needs a read-only record of architecture work that was accepted and actually published. The general product changelog is curated release copy and does not carry task verification or immutable revision evidence. Reading Linear or GitHub from the browser would introduce credentials, network dependencies, and a new runtime data owner for a page whose content changes only when architecture work is accepted.

## Decision

Maintain one small architecture-change source registry under `docs/architecture/`. A deterministic repository script will:

1. Read each referenced task and verification result.
2. Require task status `Complete`.
3. Require verification status `PASS`.
4. Require independent review decision `APPROVED`.
5. Require a Linear issue URL and immutable published revision.
6. Generate the typed static data consumed by the executive Architecture Change Log.

The product page will not call Linear, GitHub, or the filesystem at runtime. A check mode will fail when generated output drifts from accepted source evidence.

## Alternatives Considered

- Live Linear and GitHub API reads: rejected because they require browser/server credentials, network availability, caching, and another failure path for a read-only page.
- Reuse the general product changelog: rejected because it is release-oriented, manually curated, and does not prove independent acceptance or a published revision.
- Hardcode entries in page JSX: rejected because claims would drift and acceptance rules could be bypassed silently.

## Consequences

- Positive: every visible entry is tied to Complete task evidence, PASS verification, approved review, and an immutable revision.
- Negative: accepted architecture work must be deliberately added to the source registry and regenerated.
- Operational impact: architecture closeout runs `npm run architecture:changes` and `npm run architecture:changes:check`; the app has no new runtime dependency.

## Rollback Plan

Remove the nested change-log route and its discovery link, delete the generated data and source registry, and remove the generator scripts. No database, provider, auth, or external-service state needs rollback.
