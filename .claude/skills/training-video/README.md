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
- `lib/record.mjs` — the engine: auth, warmup, drive the flow, record, frame.

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
| `page.goto: Timeout` | App not running, or a very cold route — warmup uses 90s; ensure the dev server is up |
| `step skipped` | Selector not visible on that page — verify it (try `--headed`) |
| `framing ffmpeg failed` | Non-even video dimensions — keep `viewport` width/height even |
| White flash at start | Only if `title` is omitted; add a `title` card to cover the load |

## Roadmap

- **TTS narration** — per-step `narration` text → generated voiceover track
  (needs a TTS API key). Captions cover this until then.
- **Per-click auto-zoom** — optional automatic gentle zoom toward each click target.
- **Chaptered long-form** — concatenate multiple flows with section dividers.
