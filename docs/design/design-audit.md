# Design Audit — Running List

**This is the single running list of design issues Megan flags.** Anything she gives
me to "add to the design audit" gets a row here in the same turn, then gets fixed.

- Newest entries at the top.
- Each row: dated ID, the concrete complaint, the **general rule** it implies, scope
  (one page vs. global/`UnifiedTablePage`), status, and the PR/commit that resolved it.
- When a fix lands, tick the box and add the commit/PR.
- Global rules (things that should be enforced in a shared component, not per page)
  are the priority — fixing them once fixes every page.

Related: [`noise-gate-log.md`](./noise-gate-log.md) (removal/clutter case law),
[`table-system.md`](./table-system.md) (UnifiedTablePage API),
[`DESIGN-PRINCIPLES.md`](./DESIGN-PRINCIPLES.md).

---

## Open / in progress

| ID | Date | Complaint (verbatim intent) | General rule | Scope | Status |
|----|------|------------------------------|--------------|-------|--------|
| DA-003 | 2026-07-10 | Tasks split view needs a **third column** styled exactly like the emails page AI Review — collapsible — and it must let you submit AI training feedback: assign / set due date / set project / delete task, pick a **reason**, and enter **free text**, all feeding the AI feedback loop. | Task inbox parity with email feedback flow: the split/side panel is where you correct the AI and that correction is captured for training. Reuse the existing task-feedback loop (`/api/ai-assistant/task-feedback`, reason category + free text + snapshot) — do not invent a new one. | `tasks` page (via `UnifiedTablePage` `sidePanel`) | ⏳ In progress |
| DA-004 | 2026-07-10 | In the split view, the **left column (task list) should be expandable too** — not only the right AI-review column. | A resizable/collapsible split view makes **both** panes adjustable: the user can expand the list to full width (collapse the detail/AI panel) and expand the detail/AI panel (collapse the list), not just one side. Both edges get an expand/collapse affordance, not only a drag handle. | `tasks` split view (folds into DA-003) | ⏳ In progress |
| DA-005 | 2026-07-10 | Emails should **link to the email inside the app**, not open the message in Outlook. | Source/record links stay **in-app**: an email opens the app's own email/reading view (or its `/emails` deep link), never an external Outlook `owa`/`outlook.office.com` URL. Keeps the user in the product and works for users without Outlook access. | Emails + any "source record" link that points at an email | ⏳ Open |
| DA-007 | 2026-07-10 | Tasks **used to include the context** for the task from wherever it was generated — that's gone. | A task's detail must show the **source evidence** it was extracted from. Root cause: `buildTaskSourceContext` only reads the joined `document_metadata` (meeting/fireflies tasks); the current **Daily Deep Read** tasks store `source_ids` pointers + `daily_packet_id` in `extraction_metadata` and carry **no source text**, so the Context block renders nothing. Fix needs source-resolution (resolve `source_ids`/packet → excerpt) on the detail fetch — a data/pipeline change, not a UI tweak. | `tasks` detail + `/api/tasks/[taskId]` + deep-read consumer | ⏳ Open |

## Resolved

| ID | Date | Complaint (verbatim intent) | General rule | Scope | Status |
|----|------|------------------------------|--------------|-------|--------|
| DA-008 | 2026-07-22 | The Daily Brief has valuable executive information in the canonical artifact, but the client-facing page presents a repetitive decision-only queue with "absolutely no value." | Decision-first cannot mean decision-only. The designed landing page must preserve the packet's executive assessment, named actions, project trajectories, cross-portfolio patterns, opportunities, and evidence gaps; internal governance metadata belongs after the actual briefing. Reuse the citation-aware `BriefMarkdown` owner rather than re-summarizing the report into lossy cards. | `/daily-brief` landing composition + Daily Brief view model | ✅ [`74133d6`](https://github.com/The-Alleato-Group/project-management/commit/74133d6dc3b99701d45b2cf9a87edcf88263a840) |
| DA-006 | 2026-07-10 | Task detail property row "looks like complete shit" — a `Flag` icon *and* a colored dot on Priority, and a `CheckSquare2` icon in front of the thumbs feedback. | noise-gate-log #25/#26: one indicator per attribute (no icon+dot); no decorative icon before a self-affordant control; actions leave the metadata property row. Priority now = flag + label only; feedback lifted to its own "Good task?" line. | `tasks` detail property bar | ✅ |
| DA-002 | 2026-07-10 | The split view on the tasks page is "screwed up" — it's supposed to look just like the emails page and go **full width**. There's dead margin / whitespace on the left; no edge-to-edge. | A table page's split / side-panel view is **full-bleed** — the list + panel occupy the full content width with no leftover left margin or max-width gutter. Match the emails page exactly. | `tasks` page | ☐ |
| DA-001 | 2026-07-10 | When a table scrolls horizontally past the screen, the last column is **cut off halfway** — "it just looks like it's randomly cut off." | A horizontally-scrolling table must **signal** that it scrolls (right-edge scroll shadow/fade) so a partially-visible trailing column reads as "scroll for more," never as an arbitrary/broken clip. Fix it **once in `UnifiedTablePage`**, not per page. | **Global** — `UnifiedTablePage` | ☐ |

---

## How to add an item (for future me)

1. Add a row to **Open / in progress** with the next `DA-###`, today's date, the
   complaint, the general rule it implies, and scope.
2. If Megan used the word "noise"/"clutter", ALSO add a row to
   [`noise-gate-log.md`](./noise-gate-log.md) per the CLAUDE.md noise-gate rule.
3. Fix it. On landing, move the row to **Resolved**, tick the box, link the PR/commit.
4. Prefer global fixes (shared component) over per-page patches.
