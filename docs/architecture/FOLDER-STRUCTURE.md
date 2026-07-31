# Folder Structure — Target Reference

**Status:** Target/aspirational. The codebase has drifted from this; new work should move toward it, not away.
**Model:** `components/domain/` (feature UI grouped by domain). Matches the conventions already declared in `CLAUDE.md`.
**Last updated:** 2026-06-22

This is the answer to the question *"where does this file go?"* Read the [Decision Rules](#decision-rules) first — they resolve 95% of cases. The tree is just the rules made concrete.

---

## Decision Rules

The five rules that keep the tree from sprawling again. When in doubt, these win over the tree below.

1. **`app/` holds routes, nothing else.** A `page.tsx` / `layout.tsx` / `route.ts` imports from `components/`, `hooks/`, `lib/`. If a file is not a route, layout, or route handler, it does **not** live in `app/`. No demo files, no `.html`, no one-off components at the `app/` root.

2. **Three component tiers, in import order:** `ui/` (shadcn primitives, generated — never hand-add) → `ds/` (design system — *the* surface pages import from) → `components/domain/<feature>/` (feature-specific UI). There is no fourth tier. `primitives/`, `elements/` are not tiers — they fold into `ui`/`ds`.

3. **One folder per domain.** A domain like `ai` is a single folder with **subfolders** (`ai/chat/`, `ai/assistant/`), never N sibling top-level folders (`ai-chat/`, `ai-assistant/`, …). This rule is what prevents the next sprawl.

4. **Logic has exactly three homes:** `lib/` = framework glue (Supabase client, api-client, schemas, pure utils) · `hooks/` = data access (React Query `use-*.ts`) · `stores/` = client state (Zustand). There is no `data/`, `utils/`, `services/`, `contexts/`, or `providers/` as a separate top-level sibling — every one of those is one of the three jobs under a different name.

5. **Roots stay bare.** The repo root, `docs/`, `scripts/`, and `components/` roots hold only entry points and grouping folders — not loose working files. The repo root is already enforced by a pre-commit gate (`FILE-ORGANIZATION-GATE.md`); extend the same discipline one level down.

---

## Target Tree

```
alleato-pm/
├── frontend/
│   └── src/
│       ├── app/                      # ROUTES ONLY — no business logic, no demos
│       │   ├── (auth)/  (public)/  (admin)/  (main)/   # route groups
│       │   ├── api/                  # route handlers; mirror the UI route grouping
│       │   ├── layout.tsx  globals.css  error.tsx  not-found.tsx
│       │
│       ├── components/
│       │   ├── ui/                   # shadcn primitives (generated) — never hand-add here
│       │   ├── ds/                   # design system — THE import surface for pages
│       │   ├── layout/               # PageShell, PageContainer, nav, header
│       │   └── domain/               # feature UI — ONE folder per domain
│       │       ├── ai/               #   ai is a DOMAIN with subfolders, not 9 siblings
│       │       │   ├── chat/  assistant/  intelligence/  learning/  skills/
│       │       ├── budget/  commitments/  rfis/  submittals/  drawings/
│       │       ├── invoicing/  directory/  meetings/  scheduling/  ...
│       │
│       ├── hooks/                    # cross-domain React Query hooks (use-*.ts)
│       ├── lib/                      # framework glue ONLY
│       │   ├── supabase/             #   client.ts, server.ts
│       │   ├── api-client.ts  fetch-with-guardrails.ts
│       │   ├── schemas/              #   Zod schemas
│       │   └── utils/                #   pure helpers (fold old utils/ + constants/ + config/ here)
│       ├── stores/                   # Zustand + context providers (fold store/ + contexts/ + providers/)
│       ├── types/                    # database.types.ts (generated) + shared types
│       └── styles/
│
├── backend/                          # FastAPI — keep src/{api,services,scripts}/
│
├── scripts/                          # group the loose files — no bare scripts at root
│   ├── db/          # migrations apply/check, type-gen
│   ├── backfills/   # backfill-*.mjs
│   ├── crawl/       # procore / fireflies crawlers
│   ├── checks/      # check-*.mjs (pre-commit guardrails)
│   ├── audits/      # audit-*.mjs
│   └── ci/          # smoke tests, dashboards
│
├── docs/                             # root holds README.md + index.md ONLY
│   ├── architecture/  design/  patterns/  ops/  integrations/  PRPs/  ...
│
├── supabase/migrations/              # already correct
├── tests/                            # consolidate tests/ + e2e-screenshots/ here
│
└── (repo root)                       # config + allowed .md ONLY (FILE-ORGANIZATION-GATE)
    └── package.json  render.yaml  README.md  CLAUDE.md  AGENTS.md  CONTRIBUTING.md
```

---

## Known drift (gap between current and target)

Measured 2026-06-22. These are the specific things the current tree does that the target forbids.

| Smell | Current state | Target |
|---|---|---|
| **Dual UI vocabularies** | `ui/` + `ds/` + `primitives/` + `elements/` + `ai-elements/` all hold base components | Only `ui/` + `ds/`. Fold the rest in. |
| **AI sprawl** | 9 sibling folders: `ai/ ai-assistant/ ai-chat/ ai-elements/ ai-intelligence/ ai-learning/ ai-skills/ ask-alleato/ chat/` | One `components/domain/ai/` with subfolders |
| **Scattered state** | `providers/` + `components/providers/` + `contexts/` + `store/` | One `stores/` |
| **Scattered logic** | `lib/` (65 subdirs) + `services/` + `utils/` + `data/` + `constants/` + `config/` as siblings | `lib/` + `hooks/` + `stores/` (three homes) |
| **Layout split** | `layout/` + `layouts/` + `nav/` + `header/` | One `components/layout/` |
| **Dead Pages Router** | `pages/_app.tsx`, `pages/_document.tsx` exist alongside App Router | Delete `pages/` |
| **`app/` pollution** | `new.html`, `projects-table-demo.tsx`, loose `admin/` next to `(admin)/` | Routes/layouts/handlers only |
| **`scripts/` loose** | 91 of 123 entries are bare files at `scripts/` root | Grouped subfolders |
| **`docs/` root loose** | 27 loose `.md` at `docs/` root | Only `README.md` + `index.md` |
| **Root strays** | `output/ logs/ tmp/ e2e-screenshots/ ai-icon.png debug-storybook.log new.html TOOLS.md claude-memory-compiler-main/` | Config + allowed `.md` only |

---

## Migration guidance (when cleanup actually starts)

Do **not** do this as one big-bang move — it will produce an unreviewable diff and break imports everywhere. Order of least-risk-to-most:

1. **Delete dead weight first** (`pages/`, root strays, `app/` demo files). Zero-risk, shrinks the surface.
2. **Consolidate state** (`providers/`+`contexts/`+`store/` → `stores/`). Mechanical, bounded.
3. **Collapse UI tiers** (`primitives/`+`elements/` → `ui`/`ds`). Update imports via codemod.
4. **Group AI domain** (9 folders → `domain/ai/*`). Highest churn — do it on a quiet branch, one source folder at a time, typecheck between each.
5. **Group `scripts/` and `docs/`** last — low risk, high tidiness payoff.

Each step is independently shippable and independently revertable. Add an ESLint `no-restricted-imports` rule after each consolidation so the old path can't come back.
