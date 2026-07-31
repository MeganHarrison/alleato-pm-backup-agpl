# Task: App training create commitment training doc

Status: In Progress
Owner: Codex
Created: 2026-06-30
Linear Issue: Not created - available Linear connector exposes comments only, not issue creation.

## Objective

Build the reusable tutorial capture system behind the "Create a Commitment"
article so App Training docs can be generated from scripted workflows instead
of hand-written screenshot documentation.

## Scope Checklist

- [x] Confirm `/knowledge/app` reads published `training_docs` rows.
- [x] Confirm published app training docs link through `published_doc_path`.
- [x] Confirm/create a Commitments tool category mapping for the document.
- [x] Create a screenshot-backed step-by-step training doc.
- [x] Publish the doc with a non-null `published_doc_path`.
- [x] Verify the doc appears in `/knowledge/app` data read-back.
- [x] Verify the app training-doc URL is available in the `/knowledge/app` route tree.
- [x] Add a reusable Playwright tutorial recorder.
- [x] Add a `commitments/create-commitment` workflow using seeded demo data.
- [x] Generate video, screenshots, Markdown, and `manifest.json` from one workflow.
- [x] Publish generated Playwright artifacts back into `/knowledge/app`.
- [x] Render generated tutorial video as a first-class training-doc asset.
- [x] Render published training docs inside `/knowledge/app` instead of relying on an external docs-site link.

## Implementation Checklist

- [x] Create or upsert `training_docs` row with slug `create-a-commitment`.
- [x] Attach ordered screenshot assets for the commitment creation flow.
- [x] Attach ordered step records linked to screenshots.
- [x] Publish MDX and screenshot assets to the docs-site source tree.
- [x] Update Supabase publish state for the training doc.
- [x] Keep reruns idempotent for the same slug.
- [x] Add npm/script entrypoint for tutorial capture.
- [x] Support video recording, step screenshots, Markdown, manifest output, seeded data, masking, and screenshot modes.

## Verification Checklist

- [x] Supabase `training_docs` read-back shows status `published`, category metadata `Commitments`, and `published_doc_path`.
- [x] Supabase `training_doc_steps` read-back shows ordered screenshot-linked steps.
- [x] Docs-site file and assets exist at the expected path.
- [x] App route registration returns through auth middleware for `/knowledge/app/commitments/create-a-commitment`.
- [x] `/knowledge/app` data path includes the doc under Commitments.
- [x] Tutorial CLI loads and validates arguments.
- [x] Recorder can run against an authenticated production browser state or records the auth/project-access blocker clearly.
- [x] Supabase migration ledger verifies the `video` training-doc asset type is applied.
- [x] Generated doc read-back shows one video asset and seven screenshot assets.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Destination trace | `listPublishedTrainingDocs`, `/knowledge/app` source read | Pass | Published app docs are read from `training_docs.published_doc_path`. |
| Tutorial CLI | `npm run tutorial:capture -- --help` | Pass | Shows workflow path/options without loading app routes. |
| Workflow import | `npx tsx -e "(async () => { const m = await import('./docs/tutorials/commitments/create-commitment.workflow.ts'); const d = m.default.default ?? m.default; console.log(d.id, d.slug, typeof d.workflow); })()"` | Pass | `commitments.create-commitment create-commitment function`. |
| Auth state | Production `agent-browser` login with configured `PROCORE_USER` / `PROCORE_PASSWORD`; local Playwright storage state | Blocked | Production password rejected; local storage state redirected to login. Capture runner is implemented but needs valid auth state to generate final artifacts. |
| Supabase doc read-back | Service-role query for `training_docs.slug = create-a-commitment` | Pass | Row `3d31860c-e917-49ea-9487-31d964586428` is `published`, has `metadata.appToolCategory = Commitments`, and `published_doc_path = project-management-tools/training-docs/create-a-commitment.mdx`. |
| Step/asset read-back | Service-role query for `training_doc_steps` and `training_doc_assets` by doc id | Pass | Seven ordered steps and seven linked screenshot assets exist. |
| Docs-site source files | `find /Users/meganharrison/Documents/github/alleato-os/apps/docs/project-management-tools/training-docs /Users/meganharrison/Documents/github/alleato-os/apps/docs/images/training-docs/create-a-commitment -maxdepth 1 -type f` | Pass | MDX page, index page, `.asset-manifest`, and `step-1.png` through `step-7.png` exist in the docs-site source checkout. |
| `/knowledge/app` data grouping | Service-role query plus `getTrainingDocToolCategory` | Pass | Published training docs count is 3; Commitments includes `Create a Commitment`. |
| Published docs URL | `curl -I -L --max-time 20 https://alleato-os-docs.vercel.app/project-management-tools/training-docs/create-a-commitment` | Blocked | Vercel returns `HTTP/2 404`; source files exist locally but the docs-site repo has not been deployed with this new page. |
| App route registration | `curl -I -L --max-time 20 http://localhost:3001/knowledge/app/commitments/create-a-commitment` | Pass | Local route redirects through auth middleware to `/auth/login?callbackUrl=%2Fknowledge%2Fapp%2Fcommitments%2Fcreate-a-commitment`, proving the app route is registered. Authenticated content proof still requires valid browser session. |
| Targeted lint | `./node_modules/.bin/eslint src/features/knowledge/app-training-docs-page.tsx src/features/knowledge/app-training-doc-page.tsx src/app/(main)/knowledge/app/[toolCategory]/[docSlug]/page.tsx src/lib/training-docs/server.ts` | Pass | In-app training doc renderer and route pass focused lint. |
| Changed type debt | `npm run typecheck:changed` | Pass | No new `any` type debt detected. |
| Recorder bad-auth guard | `npm run tutorial:capture -- docs/tutorials/commitments/create-commitment.workflow.ts --base-url https://projects.alleatogroup.com --storage-state frontend/tests/.auth/user.json --output-dir docs/tutorials/commitments/generated/create-commitment-prod` before project access fix | Pass | Capture failed loudly on `/access-denied?reason=no-project-access` instead of publishing bad screenshots. |
| Project access seed | Service-role read-back for `test1@mail.com`, `users_auth`, and `project_directory_memberships` on project `1034` | Pass | User `test1@mail.com` maps to person `34b16b53-b28c-4ff7-ae31-1bd331eba1f0` and active membership `1e8020fb-c20b-4324-a76b-840f15e41c32`. |
| Video asset migration | `npm run db:migrations:verify-applied -- supabase/migrations/20260630193000_allow_training_doc_video_assets.sql` | Pass | Remote ledger includes `20260630193000`; constraint allows `screenshot`, `image`, and `video`. |
| Generated artifact publish | `npx tsx scripts/tutorials/publish-tutorial.ts docs/tutorials/commitments/generated/create-commitment-prod/manifest.json --app-tool-category Commitments --source-route /1034/commitments/new --title "Create a Commitment"` | Pass | Existing doc row `3d31860c-e917-49ea-9487-31d964586428` is `published` with app path `/knowledge/app/commitments/create-a-commitment`, 7 screenshot assets, 1 video asset, and 7 steps. |

## Failure / Prevention

- Cause: Prior recreation placed the document in company knowledge as a PDF,
  which does not satisfy the requested `/knowledge/app` training-doc surface.
  The current app fix removes the docs-site dependency by rendering the training
  doc inside `/knowledge/app`. The remaining live-proof blocker is authenticated
  browser access from automation.
- Detection gap: The exact destination surface and public docs URL were not both
  verified before reporting completion.
- Prevention: Close only after the `training_docs` published row, `/knowledge/app`
  category grouping, docs-site source files, and production URL are all verified.
- Owner / next action: publish the app code, then verify the authenticated
  production URL `/knowledge/app/commitments/create-a-commitment` in the app.
