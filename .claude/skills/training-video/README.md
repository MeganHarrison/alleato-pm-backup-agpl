# training-video — flow reference

Automated, repeatable training/demo video recorder for the Alleato PM app.
See `SKILL.md` for the quickstart. This file is the full flow-field reference.

## How it works

```
flow.json ─▶ Playwright (headless Chromium)              ffmpeg
            ├─ self-auth (TEST_USER_1 / .env)            ├─ rounded-corner mask
            ├─ pre-warm routes (avoid cold compiles)     ├─ gradient backdrop
            ├─ inject overlay.js (cursor/caption/zoom)   ├─ soft shadow + overlay
            ├─ inject dev-chrome hider                   └─▶ output/<name>.mp4
            └─ record viewport → raw/*.webm
```

- `lib/overlay.js` — injected into every page; renders the synthetic cursor,
  click ripples, caption pill, title/outro cards, and element-targeted zoom in a
  layer parented to `<html>` (so page-zoom transforms never scale the cursor).
- `lib/flow-runner.mjs` — **the seam.** The one place a step is executed against a
  page, shared by the recorder and the preflight. Owns guard-page detection,
  ready assertions with bounded retry, and skip reporting.
- `lib/session.mjs` — auth: reuse `.auth/state.json`, re-login when the access
  token is close to expiry, and assert the flow's entry point is reachable.
- `lib/record.mjs` — the recorder: warmup, overlay, drive the flow, record, frame.
- `lib/preflight.mjs` — the fast check: resolve every step, no video.

## Preflight before you record

```bash
node lib/preflight.mjs flows/create-prime-contract.json     # seconds, no video
```

Preflight drives the **same seam** the recorder uses, so a green preflight means
the recorder can drive the flow. It reports every step that does not resolve (not
just the first) with the offending selector, and exits non-zero. Run it after any
flow edit and before any record.

## Reliability guarantees (why runs don't silently produce broken videos)

Three guardrails, added 2026-07-29 after the recorder appeared to "fail on the
form step about half the time":

1. **Guard-page abort.** If the app redirects to `/access-denied`, `/auth/login`,
   or a not-found route, the run stops immediately naming the reason and the URL.
   Previously the project shell rendered optimistically for ~4.5s before the
   access check redirected, so early steps passed and a later step reported a
   misleading selector timeout.
2. **Entry-point precondition.** Before warming routes, the recorder confirms the
   flow's `startPath` is actually reachable for the recording user. A deleted or
   unshared project fails in seconds with a plain-English reason.
3. **Token freshness.** The Supabase access token has a **1-hour TTL** while its
   cookie lasts a year. A saved session with under 10 minutes left is discarded
   and re-authenticated, so a token can never expire mid-recording.

Plus: **skips are never silent.** A skipped step fails the run by default; pass
`--allow-skips` to deliberately tolerate them (the video will have missing beats
and they are listed at the end).

## Fixtures live in `assets/`

Any `upload` step's `path` must resolve inside this skill's `assets/` directory —
enforced by `lib/__tests__/flow-runner.test.mjs`. The prime-contract flow
originally borrowed its workbook from `docs/ops/evidence/<dated-folder>/`, and an
unrelated "eradicate obsolete artifacts" commit deleted it, silently breaking the
recorder. Fixtures the recorder depends on are owned by the skill.

## Flow fields

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `name` | string | `training-video` | Output filename (`output/<name>.mp4`) |
| `base` | string | `http://localhost:3000` | App URL (overridable with `--base`) |
| `startPath` | string | `/` | First route to land on |
| `viewport` | `{width,height}` | `1440×900` | Recording resolution |
| `frame` | boolean | `true` | Premium gradient framing; `false` = raw full-bleed |
| `title` | `{title,subtitle,hold}` | — | Opening full-screen card |
| `outro` | `{title,subtitle,hold}` | — | Closing full-screen card |
| `hideSelectors` | string[] | `[]` | Extra dev-only elements to hide |
| `steps` | Step[] | — | See below |

## Step reference

```jsonc
{ "caption": "text", "hold": 1800 }                       // caption on current page
{ "goto": "/prime-contracts", "caption": "...", "hold": 1900 }  // navigate
{ "click": "text=Estimating", "caption": "..." }          // cursor + ripple + click
{ "type": { "selector": "#title", "text": "Sitework" } }  // click field + type
{ "date": { "label": "Start Date", "value": "2026-08-03" } } // date picker
{ "upload": { "selector": "input[type=file]", "path": "estimate.xlsx" } } // attach file
{ "zoom": "h1, h2", "scale": 1.45, "caption": "...", "hold": 1800 }  // zoom-on-focus
{ "expectText": "Import Excel SOV" }                       // assert visible text
{ "expectTexts": ["Mapped", "$4,000.25"] }              // assert every listed text
{ "expectVisible": "[data-testid=sov-line-0]" }           // assert selector
{ "pause": 800 }                                          // wait
```

`caption` may be added to any `goto` / `click` step. `hold`/`pause` are ms.
Set `"required": true` on each business-critical step. A required action or
assertion stops the render with its step number instead of producing a partial
video. Upload paths are resolved relative to the flow JSON file.

## Selector tips

- Navigation between sections → **`goto`** (reliable). The collapsed icon sidebar
  isn't a dependable click target.
- In-page interaction → **`click`** on a visible element that reacts (tab, button,
  table row link, checkbox).
- Playwright locators: CSS (`#id`, `.class`, `a[href="/x"]`) or engine prefixes
  (`text=Label`, `role=button[name="Save"]`). Comma CSS (`h1, h2`) picks the first.
- If the log prints `step skipped (...)`, the selector wasn't visible — fix it.

## Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| `login failed` | `TEST_USER_1`/`TEST_PASSWORD_1` missing/wrong in repo `.env` |
| `No valid saved session` | Provide a valid `.auth/state.json` or configure `TEST_USER_1`/`TEST_PASSWORD_1`; credentials never fall back to source-code defaults |
| `flow entry point ... is not reachable` | The flow's project was deleted, or the recording user is not a member of it. Fix the flow's project/route — do not retry; it will fail identically. |
| `aborted at ...: redirected to /access-denied` | Same cause, detected mid-flow: the route belongs to a project this user can't see. |
| `aborted at ...: redirected to /auth/login` | The session died mid-run. Delete `.auth/state.json` and re-run; token freshness is normally handled automatically. |
| `page.goto: Timeout` | App not running, or a very cold route — warmup uses 90s; ensure the dev server is up |
| `step N failed: no visible match for ...` | Selector not visible on that page — verify it (`node lib/preflight.mjs <flow>` locates it in seconds, or use `--headed`) |
| `upload fixture is missing` | The `upload.path` must point into this skill's `assets/` directory |
| `framing ffmpeg failed` | Non-even video dimensions — keep `viewport` width/height even |
| White flash at start | Only if `title` is omitted; add a `title` card to cover the load |

## Roadmap

- **TTS narration** — per-step `narration` text → generated voiceover track
  (needs a TTS API key). Captions cover this until then.
- **Per-click auto-zoom** — optional automatic gentle zoom toward each click target.
- **Chaptered long-form** — concatenate multiple flows with section dividers.
