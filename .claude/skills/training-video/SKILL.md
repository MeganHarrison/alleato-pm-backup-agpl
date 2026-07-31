---
name: training-video
description: >-
  Produce polished, repeatable training/onboarding/demo VIDEOS of the Alleato PM
  app automatically — no screen recording, no Mac app, no manual editing. Use
  whenever the user asks for a training video, product tour, walkthrough video,
  onboarding video, feature demo clip, or "record the app doing X", or complains
  that stitched-screenshot videos look bad. Drives the REAL running app with a
  synthetic cursor, click ripples, captions, zoom-on-focus, and title/outro
  cards, framed in a premium gradient backdrop, and outputs an MP4. Flows are
  declarative JSON, so a new video is a new flow file — not new code.
---

# Training Video Skill

Automated recorder that turns a **declarative JSON flow** into a produced MP4 by
driving the real app in headless Chromium (Playwright) and compositing with
ffmpeg. This replaces stitched-screenshot videos.

## What it produces

Full-screen **title card** → real app pages navigated with a smooth **synthetic
cursor**, **click ripples**, animated **caption** callouts, and **zoom-on-focus**
→ **outro card**. The whole recording is framed in a rounded card with a soft
shadow on a dark gradient backdrop (Screen-Studio / Linear house style). Dev-only
chrome (build indicators, toolbars) is hidden. ~1440×900, small MP4.

## Prerequisites (check, don't assume)

1. **The app must be running** and reachable (default `http://localhost:3000`).
   If it isn't, start it (`preview_start` / the dev server) first.
2. **Video tools are local dependencies.** `ffmpeg-static` and `ffprobe-static`
   are installed with this skill, so a machine-wide ffmpeg install is not required.
3. **Playwright + Chromium.** From this skill dir: `npm install` once
   (browsers are cached globally, so this is fast). Verify: `node -e "require('playwright')"`.
4. **Auth reuses a saved session or configured test credentials** — the recorder
   first validates `.auth/state.json`; if needed it logs in with
   `TEST_USER_1`/`TEST_PASSWORD_1` read from the repo `.env` /
   `frontend/.env.local`. There are no source-code credential defaults.

## Run it

```bash
cd .claude/skills/training-video
npm install                                     # first time only
node lib/preflight.mjs flows/example-tour.json   # ALWAYS first — seconds, no video
node lib/record.mjs   flows/example-tour.json    # → output/example-tour.mp4
```

**Always preflight before recording.** It drives the same step-execution seam as
the recorder (`lib/flow-runner.mjs`), so a green preflight means the recorder can
drive the flow — and a broken selector or an unreachable project is reported in
seconds instead of after a multi-minute render.

Options: `--headed` (watch it run), `--base http://localhost:3001` (override URL),
`--allow-skips` (record even if a step can't resolve — the default is to fail).
Output lands in `output/<flow.name>.mp4`. Both `output/` and `.auth/` are gitignored.

Run the unit tests with `npm test` (no browser or dev server needed).

## Authoring a flow

A flow is one JSON file (see `flows/example-tour.json` and `README.md` for the
full field reference). Skeleton:

```json
{
  "name": "commitments-create",
  "startPath": "/commitments",
  "viewport": { "width": 1440, "height": 900 },
  "title":  { "title": "Creating a Commitment", "subtitle": "3-minute guide" },
  "outro":  { "title": "You're done", "subtitle": "Questions? Ask Alleato." },
  "steps": [
    { "caption": "Open the Commitments tool", "hold": 1600 },
    { "click": "text=New Commitment", "caption": "Start a new commitment" },
    { "type": { "selector": "#title", "text": "Sitework Subcontract" }, "caption": "Name it" },
    { "zoom": "h1, h2", "caption": "Review before saving", "scale": 1.4, "hold": 1500 }
  ]
}
```

### Step types

| Step | Effect |
|------|--------|
| `{ "caption": "...", "hold": ms }` | Show a caption pill on the current page |
| `{ "goto": "/path", "caption": "..." }` | Navigate (reliable for section changes) |
| `{ "click": "<selector>", "caption": "..." }` | Move cursor + ripple + real click (in-page elements) |
| `{ "type": { "selector": "...", "text": "..." } }` | Click a field and type it out |
| `{ "date": { "label": "Start Date", "value": "YYYY-MM-DD" } }` | Select and verify a date-picker value |
| `{ "upload": { "selector": "...", "path": "..." } }` | Upload a fixture resolved from the flow file |
| `{ "zoom": "<selector>", "scale": 1.4 }` | Zoom-on-focus toward an element |
| `{ "expectText": "..." }` | Wait for visible text and fail if it never appears |
| `{ "expectTexts": ["...", "..."] }` | Require every listed text value to be visible |
| `{ "expectVisible": "<selector>" }` | Wait for a visible element and fail if unavailable |
| `{ "pause": ms }` | Wait |

Selectors are Playwright locators — CSS (`#title`, `a[href="/x"]`), or engine
prefixes like `text=New Commitment`.

### Authoring rules (learned the hard way)

- **Preflight after every flow edit.** `node lib/preflight.mjs flows/<flow>.json`
  resolves every step in seconds and lists each one that doesn't.
- **A flow's project must be reachable by the recording user.** Flows pinned to a
  demo/dev project break when that project is deleted — the recorder now fails
  immediately with the reason rather than recording a doomed run, but the flow
  still needs a durable target.
- **Upload fixtures belong in `assets/`**, never in a `docs/` evidence folder — a
  cleanup commit there will silently break the recorder. Enforced by `npm test`.
- **Use `goto` for navigation between sections** — the collapsed icon sidebar's
  links are not reliably clickable. Reserve `click` for in-page elements (tabs,
  buttons, rows) that visibly react.
- **Every clicked/typed/zoomed selector must be visible** on the current page. A
  step that can't resolve fails the run (with the offending selector) rather than
  being skipped silently.
- **`zoom` needs a real heading/element**; some pages have no `h1` — use `h1, h2`.
- Discover selectors first (a quick `--headed` dry run or the browser tools),
  don't guess.
- Keep captions to one short line. Pacing: `hold` 1600–2000ms per beat.

## Toggles

- `"frame": false` — output the raw full-bleed recording (no gradient card).
- `"hideSelectors": ["#custom-dev-widget"]` — hide extra dev-only chrome.
- `"scale"` on a zoom step — 1.3 (gentle) to 1.6 (strong).

## Narration

Captions now; **voiceover (TTS) is a planned add-on** — a per-step `narration`
field will render an audio track. Until then, captions carry the narration.

## After producing a video

Follow the repo's Visual Proof gate: show the user the MP4 (`SendUserFile`) as
proof, not just a "done." Store finished training videos with their docs; do not
commit `output/`.
