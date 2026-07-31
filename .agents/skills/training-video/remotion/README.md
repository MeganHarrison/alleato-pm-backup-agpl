# Remotion editing layer (POC)

A **visual editor** for the training videos. The Playwright recording is the
footage; captions, the intro card, and the frame are Remotion components you edit
live in **Remotion Studio** — no re-recording to change wording, timing, or style.

## How it fits

```
Playwright  ──►  bare footage (app + cursor, NO captions)  ──►  public/footage.mp4
(record.mjs,      = flows/*-bare.json with "bareFootage": true, "frame": false
 unchanged)

Remotion    ──►  overlays captions + intro + frame on the footage
                 = src/Walkthrough.tsx, edited in Studio  ──►  out/*.mp4
```

## Edit it (the point of this)

```bash
cd .claude/skills/training-video/remotion
npm install          # one-time
npm run dev          # opens Remotion Studio in the browser
```

In Studio: scrub the timeline, and use the **right sidebar** to edit —
- **captions**: text, `fromSec`, `durationSec` (add/remove/re-time rows)
- **title**: intro words + `holdSec` (length)
- **frame**: padding, corner radius, backdrop colors

Everything previews **instantly**. When happy:

```bash
npm run render       # → out/create-a-prime-contract.mp4
```

Defaults live in `src/Root.tsx` (so a good starting point is version-controlled);
Studio edits can be saved back to those defaults.

## Refresh the footage (only when the app UI changes)

```bash
cd ..                                   # skill root
node lib/record.mjs flows/create-prime-contract-bare.json
cp output/create-a-prime-contract-bare.mp4 remotion/public/footage.mp4
```

Then re-open Studio — your captions/intro stay; only the underlying screens update.
