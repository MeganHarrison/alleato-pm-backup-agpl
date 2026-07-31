# Editing a training video yourself

**There is no timeline/video editor — the video IS the flow file.** You edit a
small JSON file (plain English-ish), run one command, and a new MP4 comes out.
No re-shooting, no cutting clips.

## The one file you edit

`flows/create-prime-contract.json` (each video has its own flow file in `flows/`).

Everything on screen is a field in here:

```jsonc
{
  "startPath": "/",                         // where the video starts
  "title":  { "title": "Create a Prime Contract",   // ← the INTRO card words
              "subtitle": "Step-by-step in Alleato PM",
              "hold": 1400 },               // ← intro length in ms (lower = shorter)
  "outro":  { "title": "That's how you create a prime contract",
              "subtitle": "Full guide in the docs", "hold": 2000 },
  "steps": [
    { "caption": "Start on your projects home", "hold": 1300 },   // caption = the words on screen
    { "click": "a:has-text(\"Test July 2026\")", "caption": "Open your project", "hold": 1300 },
    { "type": { "selector": "input[name=\"number\"]", "text": "PC-DEMO-001" }, "caption": "Enter a contract number" },
    { "date": { "label": "Start Date", "value": "2026-08-03" }, "caption": "Set the contract start date" },
    { "upload": { "selector": "input[type=\"file\"]", "path": "estimate.xlsx" }, "caption": "Import the approved estimate" },
    ...
  ]
}
```

## What you can change in seconds

| You want to… | Change this |
|---|---|
| **Shorten the intro** | `title.hold` (ms). Try `900`. Or **delete the whole `title` block** for no intro card. |
| **Change the intro words** | `title.title` and `title.subtitle` |
| **Change any on-screen caption** | that step's `"caption": "…"` |
| **Make it faster / tighter** | lower the `hold` / `pause` numbers (they're milliseconds) |
| **Make a step linger longer** | raise that step's `hold` |
| **Reorder / add / remove a step** | move / add / delete a line in `steps` |
| **Use a different project or company** | change the text in the matching `click` (e.g. `"Test July 2026"`, `"440 West Inc."`) |
| **Select a different contract date** | change the date step's ISO `value` (`YYYY-MM-DD`) |
| **Use a different estimate workbook** | change the upload step's `path` (relative to the flow file) |
| **No outro** | delete the `outro` block |
| **Auto-trim dead time** | `"tighten": true` (already on) caps every loading-spinner / long hold to ~1.3s while keeping cursor motion — this is what gets the real app down to ~60s. Set `"tighten": { "maxDwell": 1.6 }` to let each screen linger a touch longer. |

## Regenerate the video (one command)

The app must be running on `localhost:3000` first. Then:

```bash
cd .claude/skills/training-video
npm run record:prime-contract      # → output/create-a-prime-contract.mp4
```

Open `output/create-a-prime-contract.mp4` to watch it. Re-run after any edit.

## What still needs a dev (me)

- **Click targets / routes** — the `selector` and `goto` values are Playwright
  selectors tied to the app's HTML. Changing *which button* a step clicks needs
  someone who can read the DOM. (Changing the *caption* on that step is all you.)
- **Visual style** — the intro card's font, colors, and the gradient frame live in
  `lib/overlay.js` / the framing code, not the flow. Tell me the look you want and
  I'll wire it up (or expose it as a flow option).

## Publishing to the docs site

Recording only makes the MP4. To put it on the live docs page it has to be copied
into `alleato-os/apps/docs/images/help/training-docs/create-a-prime-contract/`
(as `.mp4` + a `.webm`) and merged to `main`. Ask me to "deploy the new video" and
I'll do that step — or say the word and I'll add a `npm run publish:prime-contract`
that does the copy + encode for you.
