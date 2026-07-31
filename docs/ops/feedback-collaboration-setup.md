# Feedback Collaboration Setup

The in-app feedback widget now supports four new collaboration channels. Each
one is **opt-in via env vars** — leave the var unset and the integration is a
no-op (no provider calls, no UI, no errors).

## 1. PostHog (session replay + analytics)

```env
NEXT_PUBLIC_POSTHOG_KEY=phc_xxx
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com   # or https://eu.i.posthog.com

# Backend logs, optional but recommended. Use the same phc_ project token.
POSTHOG_API_KEY=phc_xxx
POSTHOG_HOST=https://us.i.posthog.com
```

- Set the key in Vercel → Project → Settings → Environment Variables
  (Production + Preview).
- Session recordings start automatically on page load. They mask all `<input>`s,
  password fields, and any element with `data-ph-mask` / `data-sensitive`.
- The logged-in user is identified by Supabase user ID, email, and name, so you
  can search recordings by person in PostHog.
- Pageviews are captured manually on Next.js client navigation (the default
  `capture_pageview: true` only fires on hard loads in app router).
- Backend logs are exported through OpenTelemetry when `POSTHOG_API_KEY` is
  present on the Render backend service. The exporter is a no-op when unset.

## 2. Sentry (error tracking + replay on error)

```env
NEXT_PUBLIC_SENTRY_DSN=https://xxx@oXXXX.ingest.us.sentry.io/XXXX
# SENTRY_DSN=...   # optional server-side fallback if you don't want to expose the DSN
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=your-project-slug
SENTRY_AUTH_TOKEN=sntrys_xxx
```

- The DSN must be `NEXT_PUBLIC_*` to enable the browser SDK. If you want to
  keep server-side Sentry separate, set `SENTRY_DSN` instead.
- Source-map upload is wired through `withSentryConfig`. Production/CI builds
  fail loudly when a DSN is configured without `SENTRY_AUTH_TOKEN`,
  `SENTRY_ORG`, and `SENTRY_PROJECT`, because events without source maps are
  hard to debug.
- Session Replay only fires on errors (`replaysOnErrorSampleRate: 1.0`,
  `replaysSessionSampleRate: 0`) so you don't double-pay with PostHog for
  steady-state recordings.

## 3. Microsoft Teams webhook

```env
TEAMS_FEEDBACK_WEBHOOK_URL=https://prod-XX.westus.logic.azure.com:443/workflows/.../triggers/...
```

**Important:** Office 365 connector "Incoming Webhook" is deprecated. Use the
Power Automate Workflow URL flow instead:

1. In Teams, open the channel where you want feedback to land.
2. Channel `…` menu → **Workflows** → search for **"Post to a channel when a
   webhook request is received"**.
3. Pick the team + channel, click Add → Create.
4. Teams shows the workflow URL. Copy it.
5. Set `TEAMS_FEEDBACK_WEBHOOK_URL` in Vercel.

The payload is an Adaptive Card v1.4 with title, comment excerpt, screenshot
preview, and direct links to the feedback inbox, the page where the feedback
was filed, the GitHub issue (if created), and the screen recording (if
attached).

Failures are non-blocking — the feedback inbox is still the source of truth.
A `teamsWarning` field is returned on the POST response for debugging.

## 4. Loom-style screen recording

No env var required — uses the browser's `navigator.mediaDevices.getDisplayMedia`
+ `MediaRecorder`. Hard caps:

- **Duration:** 2 minutes (configurable in `screen-recorder.ts`)
- **File size:** 100 MB
- **MIME types:** `video/webm` (preferred, vp9/vp8/opus) or `video/mp4`
- **Storage:** Supabase Storage `admin-feedback` bucket under
  `recordings/{userId}/{date}/{uuid}.webm`. Direct browser upload via signed
  upload URL — bypasses Vercel's 4.5 MB serverless body limit.

Compatibility:

- Works on Chrome, Edge, Firefox (desktop). Safari supports `getDisplayMedia`
  as of 13+. The widget calls `isScreenRecordingSupported()` and hides the
  button on unsupported browsers (mobile included).
- Microphone audio is opt-in via the `withMicrophone` arg in
  `startScreenRecording`; today the widget doesn't expose the toggle so
  recordings include system audio only.

## Optional: explicit app URL

```env
NEXT_PUBLIC_APP_URL=https://app.alleato.ai
```

Used in the Teams card's "Open in feedback inbox" link. Falls back to the
originating request URL.

## Verification checklist

After deploying with the env vars set:

1. **PostHog**: open the app, do a few clicks, then check
   `https://app.posthog.com/replay/recent` — your session should appear within
   ~30s. Hover the timeline; password fields should render as `********`.
2. **Sentry**: throw a deliberate error
   (`throw new Error('sentry-test')` in a component) and confirm it appears in
   `https://sentry.io/issues/`. You should see a "Replay" tab with the 30s
   leading up to the error.
3. **Teams webhook**: file a piece of feedback via the in-app widget. Within a
   few seconds the configured Teams channel should receive an Adaptive Card.
4. **Screen recording**: in the widget, click the video icon next to
   "Screen recording". Pick a tab/window in the browser permission dialog,
   record for 5 seconds, click stop. The video should preview inline and the
   submitted feedback should include `metadata.videoRecordingUrl`.
