# Design System

## Product Context
- Product name: Alleato-Procore / Alleato PM.
- Audience: construction project teams, project managers, administrators, and operations users.
- Primary sampled flows: command-center initiative management, project-home operational dashboard, and the Daily Executive Brief reading/action surface.

## Color
- Semantic tokens observed:
  - `bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`
  - `bg-primary`, `text-primary`, `bg-primary/5`, `bg-primary/10`
  - `bg-destructive`, `text-destructive`
  - `bg-status-success`, `text-status-success`, `bg-status-warning`, `text-status-warning`, `text-status-info`
- Raw/page-local hue usage observed:
  - `/command-center`: `bg-amber-500/5`, `bg-blue-500/5`, `bg-violet-500/5`, `bg-emerald-500/5`
  - `/command-center`: `bg-red-600`, `bg-red-400`, `bg-amber-400`, `bg-blue-400`
  - `/[projectId]/home`: `bg-green-600`, `bg-blue-500`, `bg-amber-500`, `bg-primary/10 blur-xl`
- Evidence:
  - `frontend/src/app/(admin)/command-center/page.tsx:113`
  - `frontend/src/app/(admin)/command-center/page.tsx:144`
  - `frontend/src/app/(main)/[projectId]/home/project-command-center.tsx:323`

## Typography
- Existing semantic heading classes observed in stale route-adjacent code:
  - `heading-section`, `heading-small-caps`, `heading-micro`, `heading-tiny-caps`
- Sampled live pages still recreate heading typography locally:
  - `text-[11px] font-semibold uppercase tracking-wider text-muted-foreground`
  - `text-4xl font-semibold leading-tight sm:text-5xl`
  - `text-[10px] font-semibold uppercase tracking-wider`
- Evidence:
  - `frontend/src/app/(main)/[projectId]/home/project-command-center.tsx:168`
  - `frontend/src/app/(main)/[projectId]/home/project-command-center.tsx:266`
  - `frontend/src/app/(main)/[projectId]/home/project-command-center.tsx:697`

## Spacing & Sizing
- Common spacing scale observed:
  - `px-2`, `px-3`, `px-4`, `px-6`
  - `py-2`, `py-2.5`, `py-3`, `py-6`
  - `gap-1`, `gap-2`, `gap-3`, `gap-4`
  - `space-y-2`, `space-y-3`, `space-y-10`, `space-y-12`
- Page-local layout sizing observed:
  - `/command-center`: `max-w-screen-2xl`, `min-w-72`
  - `/[projectId]/home`: `xl:grid-cols-[minmax(0,1fr)_360px]`, `xl:gap-x-24`, `2xl:gap-x-32`
- Evidence:
  - `frontend/src/app/(admin)/command-center/page.tsx:524`
  - `frontend/src/app/(admin)/command-center/page.tsx:779`
  - `frontend/src/app/(main)/[projectId]/home/project-command-center.tsx:2223`

## Elevation & Borders
- Subtle borders and muted surfaces observed:
  - `border-border`, `border-border/50`, `border-border/60`
  - `bg-muted/20`, `bg-muted/30`, `bg-muted/50`
  - `shadow-sm`, `shadow-xs`
- Raw exceptions:
  - Inline dashed border style on project-home prime-contract empty link.
  - Decorative blurred primary block inside project command surface.
- Evidence:
  - `frontend/src/app/(admin)/command-center/page.tsx:941`
  - `frontend/src/app/(main)/[projectId]/home/project-command-center.tsx:659`

## Layout Conventions
- `PageShell` is used for `/command-center`.
- `/[projectId]/home` is rendered through `project-command-center.tsx`, not `project-home-client.tsx`.
- `ContentSectionStack` is used on `/[projectId]/home`, but section headers and record previews are still local.
- `/daily-brief` uses the canonical `PageShell` plus a scoped editorial reader. Its hierarchy is executive signal -> direct actions -> governed decisions -> complete packet analysis -> follow-through and artifact metadata. The complete report remains available through `/daily-briefs/[briefId]`.
- Daily Brief evidence: `frontend/src/app/daily-brief/page.tsx`, `frontend/src/app/(main)/executive/intelligence-brief/executive-brief-view.tsx`, and `.exec-brief` classes in `brief.css`.

## Components
- Button:
  - Shared `Button` is used, but several call sites override variants with raw classes.
  - Evidence: `frontend/src/app/(admin)/command-center/page.tsx:633`
- Checkbox:
  - Shared `Checkbox` is used, but filter row layout is local.
  - Evidence: `frontend/src/app/(admin)/command-center/page.tsx:573`
- Badge/Status:
  - `StatusBadge` is used on project home.
  - `/command-center` source chips and priority dots are page-local.
  - Evidence: `frontend/src/app/(admin)/command-center/page.tsx:967`
- Card/Record Preview:
  - No shared card primitive is used for Kanban cards or project-home record previews.
  - Evidence: `frontend/src/app/(admin)/command-center/page.tsx:941`
  - Evidence: `frontend/src/app/(main)/[projectId]/home/project-command-center.tsx:676`
- Modal/Drawer:
  - `Dialog` and `Sheet` are used.
  - There is still page-local form layout inside the dialog.
- Tooltip:
  - `Tooltip` is used in `/command-center`, but native `title` remains in card metadata.
  - Evidence: `frontend/src/app/(admin)/command-center/page.tsx:977`
- Empty state:
  - `EmptyState` is used on `/[projectId]/home`, but some empty states remain raw text.
- Daily Brief narrative:
  - `BriefMarkdown` is the shared citation-aware report renderer on both the landing summary and durable artifact route.
  - `ExecutiveAttentionWorkflow` remains the shared governed follow-through owner; the brief only prepares its draft.
  - Evidence: `frontend/src/features/daily-briefs/brief-markdown.tsx`, `frontend/src/components/executive/executive-attention-workflow.tsx`.

## Audit Notes
- The scoped audit found real design-system drift on both sampled pages.
- The largest issue is not missing Tailwind tokens; it is missing reusable product primitives.
- The most urgent missing primitives are `KanbanBoard`, `KanbanColumn`, `KanbanCard`, `DensityControl`, `FilterPopover`, `SectionHeading`, `SummaryPanel`, `RecordPreview`, and `DashedActionLink`.
- The audit must map live route imports first. The sample caught a stale `project-home-client.tsx` file that appears route-adjacent but is not imported by the live home route.
- A decision-first layout must not become a decision-only information product. On the Daily Brief, canonical executive assessment, project analysis, portfolio patterns, opportunities, and evidence gaps are primary content; governance metadata is secondary.
- A persisted narrative must remain intact through the presentation boundary. Derived counts and cards may orient the reader, but they are not substitutes for source-backed conclusions and uncertainty.

## Token Map (YAML)
```yaml
color:
  semantic:
    bg:
      default: "bg-background"
      muted: "bg-muted"
      muted_subtle: "bg-muted/30"
      primary_subtle: "bg-primary/10"
    text:
      default: "text-foreground"
      muted: "text-muted-foreground"
      primary: "text-primary"
      destructive: "text-destructive"
    border:
      default: "border-border"
      subtle: "border-border/50"
    status:
      success: "text-status-success bg-status-success/10"
      warning: "text-status-warning bg-status-warning/10"
      danger: "text-destructive bg-destructive/10"
typography:
  observed_semantic:
    section: "heading-section"
    small_caps: "heading-small-caps"
  drift:
    micro_label: "text-[11px] font-semibold uppercase tracking-wider"
    tiny_label: "text-[10px] font-semibold uppercase tracking-wider"
    oversized_page_title: "text-4xl sm:text-5xl"
radius:
  sm: "rounded"
  md: "rounded-md"
  lg: "rounded-lg"
  xl: "rounded-xl"
shadow:
  xs: "shadow-xs"
  sm: "shadow-sm"
spacing:
  row_compact: "px-2 py-2"
  panel: "p-4"
  page: "px-4 py-6"
```
