# Stitch Redesign Prompts — Alleato PM

These prompts are ordered by impact. Each targets a page that would benefit significantly from a design refresh. Use with Stitch to generate high-fidelity variations.

**Design context for all prompts:**
- Construction project management SaaS (think Procore competitor)
- Dark mode primary, light mode secondary
- Design system: shadcn/ui + Tailwind + Geist font
- Semantic color tokens: `bg-background`, `bg-card`, `bg-muted`, `text-foreground`, `text-muted-foreground`, `border-border`
- Brand accent: orange (`bg-primary`)
- Target audience: construction PMs, executives, superintendents
- Aesthetic: clean, data-dense, premium enterprise feel — not startup-y

---

## 1. Project Dashboard (Portfolio Home)

**Current state:** Basic table listing of projects with search/filter toolbar. No KPIs, no visual hierarchy, no at-a-glance status.

**Stitch prompt:**
> Design a project portfolio dashboard for a construction project management SaaS. Dark mode. The page should have:
>
> **Top section:** A row of 4-5 KPI cards showing aggregate metrics — Total Projects, Active Value ($), Projects At Risk, Avg Completion %, Upcoming Milestones. Use a bento grid layout with the primary metric large and secondary metrics smaller. Subtle orange accent for the primary KPI.
>
> **Middle section:** A filterable, sortable data table of projects. Each row shows: project name (bold), job number (muted mono), client name, start/end dates, phase badge (Pre-Construction, Active, Close-out), health indicator (green/yellow/red dot), and budget utilization as a thin progress bar. Include a search bar, status filter pills, and a "New Project" button.
>
> **Right sidebar or card section:** A "Recent Activity" feed showing the last 5-8 actions across all projects (e.g., "Budget approved on Vermillion Rise", "RFI #42 responded to"). Timestamps in relative format.
>
> Typography: Geist Sans for UI, Geist Mono for numbers/IDs. Minimal borders, use spacing and background tints to create hierarchy. No heavy shadows — only shadow-xs on cards. Rounded-md corners.

---

## 2. Budget Page

**Current state:** Dense tabbed interface (Budget, Cost Codes, Forecasting, Snapshots, Change History, Modifications). Functional but visually heavy. Custom header, many modals.

**Stitch prompt:**
> Design a construction project budget page for a SaaS app. Dark mode. This is the most data-dense page in the app — it needs to feel powerful but not overwhelming.
>
> **Header area:** Project name as breadcrumb context, page title "Budget" with a lock/unlock toggle. A row of 5 KPI blocks: Original Budget, Approved Changes, Revised Budget, Pending Changes, Projected Over/Under. The over/under KPI should be color-coded (green for under, red for over). Use Geist Mono for all currency values.
>
> **Tab navigation:** Horizontal tabs — Budget, Cost Codes, Forecasting, Snapshots, Change History, Modifications. Active tab has an orange underline accent. Tabs should feel like a financial tool, not a generic UI.
>
> **Main table:** A budget line items table with columns: Cost Code (mono), Description, Original Budget Value, Approved COs, Revised Budget, Pending Budget Changes, Projected Over/Under (color-coded), Forecasted Final Cost. Each row should have a subtle hover state. Selected rows show a blue-tinted background. Footer row shows grand totals in bold.
>
> **Toolbar above table:** Search, quick filter pills (All, Over Budget, In Progress, Complete), group-by dropdown (cost code tier), and an "Add Line Item" button.
>
> Keep it clean and scannable. Financial data should feel precise and trustworthy. No unnecessary decoration — let the numbers breathe.

---

## 3. Schedule Page (Multi-View)

**Current state:** Already feature-rich with 5 views (Gantt, Table, Board, Timeline, Calendar). Uses PageShell. Needs visual polish, not restructuring.

**Stitch prompt:**
> Design a construction project schedule page with multiple view modes. Dark mode. The page should feel like a premium project planning tool.
>
> **View switcher:** A segmented control in the toolbar area with icon+label for each view: Gantt Chart, Table, Board, Timeline, Calendar. The active view should have a filled background, inactive views are ghost/outline.
>
> **Gantt view (primary):** Show a Gantt chart with:
> - Left panel: task tree with indent levels (phases > tasks > subtasks), each row showing task name, assigned person avatar, and a status dot (green/yellow/red/gray)
> - Right panel: horizontal bars on a time axis. Bars colored by status. Dependencies shown as subtle connecting lines. Today marker as a vertical orange dashed line.
> - Row height compact (32px) for density. Alternating row backgrounds (bg-card / bg-background)
>
> **Board view:** Kanban columns by status — Not Started, In Progress, Complete, On Hold. Cards show task name, due date, assignee avatar, and a priority indicator. Drag handles visible on hover.
>
> **Toolbar:** Search, filter by status/assignee/date range, "Add Task" primary button. Bulk action bar appears when tasks are selected — "Update Status", "Reassign", "Delete".
>
> Keep animations minimal but present — smooth transitions between views. The schedule is the heartbeat of a construction project; it should feel alive and responsive.

---

## 4. Reporting / Analytics Dashboard

**Current state:** Stub page with a "Coming soon" card. Blank canvas.

**Stitch prompt:**
> Design a comprehensive project reporting and analytics dashboard for a construction PM SaaS. Dark mode. This is where executives and PMs go to understand project health at a glance.
>
> **Top row:** 4 large KPI cards in a bento grid:
> - Budget Health (donut chart showing % spent vs remaining, with over-budget warning)
> - Schedule Performance (% complete vs planned, with SPI indicator)
> - Open Issues (count of open RFIs + Change Events + Punch Items, stacked bar)
> - Cash Flow Trend (sparkline of monthly spend over last 6 months)
>
> **Middle section — two columns:**
> - Left: "Budget vs Actual" area chart (planned line + actual filled area, orange accent for variance)
> - Right: "Risk Register" — a compact table of top 5 risks with severity badges (Critical/High/Medium/Low) and owner avatars
>
> **Bottom section — three columns:**
> - "Recent Change Orders" — mini table with CO#, amount, status badge
> - "Upcoming Milestones" — vertical timeline with dates and task names
> - "Subcontractor Performance" — horizontal bar chart ranking subs by completion %
>
> Use consistent card styling: bg-card, rounded-md, no borders (or very subtle border-border/50). Charts should use the orange accent for primary data series and muted-foreground for secondary. Typography: Geist Mono for all numbers, Geist Sans for labels.

---

## 5. Drawings Board (Kanban)

**Current state:** Functional drag-and-drop board with 3 columns (Approved, Under Review, Superseded). Wrapped in a Card with dashed border — feels like a demo rather than production.

**Stitch prompt:**
> Design a construction drawings review board with drag-and-drop columns. Dark mode. Think Figma's file browser crossed with a Kanban board.
>
> **Header:** "Drawings" title with a "Upload Revisions" primary button and a search bar. Below it, a filter row with drawing set selector (dropdown), discipline filter pills (Architectural, Structural, MEP, Civil), and a view toggle (Board / List).
>
> **Board view:** 4 vertical columns — "Pending Review", "Under Review", "Approved", "Superseded". Each column has a header with the status name, a count badge, and a subtle colored top border (yellow, blue, green, gray respectively).
>
> **Drawing cards:** Each card shows:
> - Drawing number (bold, mono: "A-101")
> - Drawing title ("First Floor Plan")
> - Current revision badge ("Rev 3")
> - Thumbnail preview (small, 60x40px placeholder)
> - Assigned reviewer avatar
> - Last updated timestamp (relative)
> - Hover: shows drag handle + quick actions (View, Download, Reassign)
>
> Cards should have a clean bg-card background with subtle hover lift (shadow-sm). Drag state: card becomes slightly transparent with a dashed border placeholder. Drop zone highlights with a faint orange glow.
>
> Column backgrounds should be bg-muted/30 to differentiate from the page background. No heavy borders between columns — use spacing.

---

## 6. Daily Log

**Current state:** Minimal table page — date, weather, created by. No visual richness, no entry preview, no inline editing.

**Stitch prompt:**
> Design a construction daily log page that feels like a premium field reporting tool. Dark mode. Daily logs are entered by superintendents on-site, so the interface should be clean and fast.
>
> **Header:** "Daily Log" title with "New Log Entry" button. A date range picker for filtering.
>
> **Main content — card-per-day layout (not just a table):**
> Each day is a card showing:
> - Date header (large, e.g., "Monday, March 24, 2026")
> - Weather row: icon + temperature + conditions (e.g., "72F, Partly Cloudy")
> - Summary sections as collapsible blocks:
>   - Work Performed (text summary)
>   - Manpower (count by trade, shown as small pills: "Electricians: 4", "Plumbers: 2")
>   - Equipment on Site (list)
>   - Visitors (list)
>   - Safety Incidents (count, red if > 0)
>   - Delays/Issues (text, highlighted if present)
> - Footer: "Created by [Name] at [time]" in muted text, with Edit/Delete actions
>
> Cards should stack vertically with generous spacing. The most recent day is at the top and expanded by default; older days are collapsed showing just the date header + weather + a one-line summary.
>
> Include an "Export PDF" icon button in the header for generating daily reports.

---

## 7. RFIs Page

**Current state:** Uses UnifiedTablePage with status filters and table/card/list views. Functional but generic — looks like every other table in the app.

**Stitch prompt:**
> Design an RFI (Request for Information) management page for construction PM software. Dark mode. RFIs are critical communication — the page should convey urgency for overdue items.
>
> **Header:** "RFIs" title with "Create RFI" button and a count indicator (e.g., "47 RFIs, 12 Open").
>
> **Status bar:** Horizontal row of status cards — Draft, Open, Answered, Closed, Void. Each shows a count and is clickable to filter. Open/Overdue should pulse with a subtle red indicator.
>
> **Table view:**
> - Columns: RFI # (mono, linked), Subject, Status (badge: color-coded), Ball in Court (avatar + name), Due Date (red text if overdue, orange if due this week), Cost Impact ($, mono), Days Open
> - Overdue rows should have a faint red left-border accent
> - Answered rows should have a green left-border accent
>
> **Card view:** Cards arranged in a responsive grid. Each card shows:
> - RFI number and subject as title
> - Status badge (top-right corner)
> - "Ball in Court" with avatar
> - Due date with urgency indicator
> - Last response preview (truncated, 2 lines)
> - Quick actions on hover: Respond, Reassign, Close
>
> Toolbar: search, status filter pills, "Ball in Court" filter (dropdown of people), date range filter, export.

---

## 8. Team Chat

**Current state:** Full-height chat layout. Functional but could feel more premium and integrated with the PM context.

**Stitch prompt:**
> Design a team chat interface for a construction project management SaaS. Dark mode. This is NOT a generic Slack clone — it should feel integrated with the PM tools (budgets, schedules, RFIs).
>
> **Left sidebar (240px):** Channel list organized by:
> - "Starred" section (pinned channels)
> - "Projects" section (auto-channels per project: "#vermillion-rise", "#cedar-heights")
> - "Direct Messages" section with online status dots
> - Each channel shows unread count badge (orange) and last message preview
>
> **Main chat area:**
> - Message thread with avatar (initials circle, bg-primary/10), name (bold), timestamp (muted, mono), and message body
> - AI assistant messages styled differently: "A" avatar with primary accent, messages can include structured cards (budget summaries, schedule updates, RFI notifications) rendered inline
> - Support for @mentions (highlighted), linked items (clickable: "RFI #42", "CO #7"), and file attachments (thumbnail preview)
>
> **Composer (bottom):**
> - Clean input field with rounded-full corners
> - Attachment button, emoji picker, and send button
> - AI command indicator: typing "/" shows a command palette overlay with options like "/budget-summary", "/schedule-status", "/find-rfi"
>
> **Right panel (collapsible, 280px):** Context panel showing details of any linked item clicked in chat. E.g., clicking "RFI #42" opens a mini RFI detail view in the right panel without leaving the chat.
>
> The chat should feel spacious, not cramped. Message density should be comfortable — not Slack-tight, not Discord-loose.

---

## 9. Meetings Page

**Current state:** Basic server-rendered table with minimal columns. Uses legacy `MeetingsTablePage` wrapper.

**Stitch prompt:**
> Design a meetings/minutes management page for construction PM software. Dark mode. Meeting minutes are a legal record in construction — the page should feel organized and authoritative.
>
> **Header:** "Meetings" title with "New Meeting" button and a view toggle (List / Calendar).
>
> **Calendar view:** Monthly calendar grid showing meetings as colored dots/pills on dates. Clicking a date expands to show the meeting list for that day.
>
> **List view (primary):**
> - Group meetings by month with a sticky month header
> - Each meeting row shows: Date (bold), Title, Category badge (OAC, Safety, Progress, Coordination), Attendee avatars (stacked, max 4 + overflow count), Location, Status badge (Draft, Published, Signed)
> - Expandable row: clicking reveals the agenda topics as a numbered list with action items count per topic
>
> **Meeting detail (when clicked):**
> - Side sheet (not a new page) showing:
>   - Meeting metadata (date, time, location, attendees)
>   - Agenda with numbered topics
>   - Each topic has: discussion notes, action items (checkbox list with assignee + due date)
>   - Attachments section
>   - "Export PDF" and "Distribute" action buttons
>
> The meeting list should feel like a well-organized legal filing system. Clean typography, clear dates, no visual clutter.

---

## 10. Documents / File Manager

**Current state:** Stub page with an EmptyState component. Complete blank slate.

**Stitch prompt:**
> Design a document management / file manager page for construction PM software. Dark mode. Think Dropbox Business meets construction document control.
>
> **Header:** "Documents" title with "Upload" primary button, "New Folder" secondary button, and a breadcrumb trail (Root > Drawings > Architectural).
>
> **Toolbar:** Search, filter by type (Drawings, Specs, Submittals, Photos, Reports), sort (Name, Date, Size), and a view toggle (Grid / List).
>
> **Grid view:** File/folder cards in a responsive grid.
> - Folders: icon + name + item count + last modified
> - Files: thumbnail preview (for images/PDFs) or file type icon + name + size + uploaded by + date
> - Selection mode: checkbox appears on hover, selected cards get an orange border
>
> **List view:** Compact table with columns: Name (with icon), Type, Size, Uploaded By (avatar), Modified Date, Version, Status (Approved/Pending/Superseded badge).
>
> **Right sidebar (on file select):** File detail panel — large preview, metadata, version history timeline (v1 > v2 > v3 with dates and uploaders), comments thread, and download/share actions.
>
> **Drag and drop:** The entire content area should be a drop zone. When dragging files over, show a full-area overlay with a dashed border and "Drop files to upload" message.
>
> Folder navigation should feel instant — no page loads, just content swaps with a subtle fade transition.

---

## Notes for Stitch Usage

- Generate 2-3 variations per prompt (minimal, balanced, data-dense)
- Always generate in both dark mode and light mode
- Use these exact color tokens in the designs: background (#09090b), card (#111113), muted (#1c1c1e), primary (#f97316 orange), foreground (#fafafa)
- Font: Geist Sans for UI text, Geist Mono for numbers/IDs/timestamps
- Border radius: rounded-md (6px) for cards, rounded-full for avatars/pills
- Shadows: only shadow-xs (subtle) and shadow-sm (dropdowns). No heavy shadows.
