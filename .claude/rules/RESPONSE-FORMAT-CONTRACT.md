# Response Format Contract

**Trigger:** EVERY time you report progress, finish a task, or hand back to Megan —
in chat, in a PR comment, or in a session summary. This is not optional formatting;
it is how Megan reviews work from her phone or a quick glance at the computer.

## Why this exists

Megan works in bursts: 48-hour sprints, then lulls (client work, travel). The
bottleneck in the lull is not the work — it is (a) figuring out what needs her, and
(b) reviewing from anywhere without opening five pages. This contract removes both.

## The four sections — always, in this order

Use these exact headers (emoji included). Omit a section only if it is genuinely
empty — never omit **🙋 Needs you** if there is anything at all waiting on her.

```text
## ✅ Done
- <one line per item> — <direct link to the LIVE page> · <screenshot>

## 🔀 In review / deploying
- <what> — PR <link> · preview <url>

## ⏭ Recommended next
1. <ranked next step> — <why, one clause>

## 🙋 Needs you
- <the decision/approval, stated so she can answer in one tap>
  - Options: <A> / <B> / <C>   (when it's a choice)
```

## Hard rules

1. **Screenshots by default.** Any UI change ships with a screenshot of the *result*
   (not "the page rendered"). This satisfies `VISUAL-PROOF-GATE.md` — attach the proof,
   do not re-derive it in prose. Attach the screenshot image inline in the report (via
   `SendUserFile` in harnesses that provide it, otherwise however the current harness
   surfaces images). If the running harness genuinely cannot attach an image, fall back
   to a direct link to the live page showing the result, and say that's why.
2. **Direct deep links, always.** Link the exact live page/record where the change is
   (`https://projects.alleatogroup.com/<path>`), not the app root. If pre-merge, link
   the Vercel preview URL and say which environment it is.
3. **🙋 Needs you is the section she scans first.** Put decisions, approvals, and
   anything blocked-on-Megan here — never buried inside "Done" or "Next." Each item
   must carry enough context to answer without scrolling back. When it is a choice,
   offer tappable options (use `AskUserQuestion`, or list `Options:` inline).
4. **Nothing waiting on her → say so.** End with `🙋 Needs you: nothing — running
   autonomously on the queue.` so she knows a lull costs nothing.
5. **Mirror to the backlog.** Anything in "Recommended next" or "Needs you" that is
   real work becomes (or updates) a GitHub issue per `docs/ops/BACKLOG-SYSTEM.md`, and
   items requiring her decision get the `needs-megan` label. Chat is the notification;
   the backlog is the record.
6. **No per-step narration.** Report at slice boundaries and true blockers only
   (see `BATCHING-GATE.md`). One clean four-section report beats ten progress pings.

## Phone reachability

- For an approval Megan should act on from her phone, prefer `AskUserQuestion` (tappable)
  and, when the harness supports it, a push notification — do not make her open the app
  to answer a yes/no.
- Keep each 🙋 item to one screen: the ask, the context, the options.

## Example

```text
## ✅ Done
- Budget "Approved COs" sidebar now matches the column ($700 / PPCO-001) —
  https://projects.alleatogroup.com/876/budget · [screenshot]

## 🔀 In review / deploying
- PR #621 (budget feedback batch) — preview https://alleato-pm-git-fix-budget.vercel.app

## ⏭ Recommended next
1. Triage the top 10 error-tracker groups — highest bug density, no decision needed.

## 🙋 Needs you
- Azure OCR backfill needs the AZURE_DOCUMENT_INTELLIGENCE_KEY value, or your OK to
  pull it from the existing Render secret. Options: paste it / use Render secret / skip.
```
