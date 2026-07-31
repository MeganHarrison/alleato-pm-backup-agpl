# Alleato Experience System

## 1. Product Experience Vision

Alleato is not a digital filing cabinet and should not resemble a generic project-management template.

Alleato is an AI-native construction operating system that turns fragmented operational activity into shared understanding, coordinated action, and better decisions.

The interface must communicate that distinction immediately.

The experience should feel:

- Intelligent without feeling mysterious
- Powerful without feeling complicated
- Dense without feeling cluttered
- Modern without becoming decorative
- Interactive without becoming distracting
- Premium without sacrificing usability
- Alive without relying on gimmicks

## 2. The Core Shift

The existing enterprise pattern is:

> Sidebar → header → cards → table → form → repeat

Alleato's target pattern is:

> Context → relationships → signal → action → explanation

Pages should not merely display records. They should reveal how information moves, what changed, how objects relate, and what action matters now.

## 3. Product Identity

Alleato should feel like an operating system for a construction company.

The product identity is built from five ideas:

### 3.1 The Company Brain

Alleato continuously absorbs meetings, email, Teams messages, documents, drawings, project activity, financial data, and human feedback.

The system should visually express ingestion, synthesis, reasoning, memory, and output.

### 3.2 The Project Story

Every project has a living narrative:

- What happened
- What changed
- What was decided
- What is blocked
- What is at risk
- What is owed
- What needs attention

Alleato should reconstruct that story, not force users to assemble it manually.

### 3.3 Connected Objects

Core objects include:

- Project
- Person
- Company
- Meeting
- Email
- Document
- Drawing
- Decision
- Risk
- Task
- RFI
- Submittal
- Commitment
- Change Event
- Change Order
- Budget Item
- Schedule Activity
- Agent

Each object should expose status, ownership, relationships, history, and next actions.

### 3.4 Agentic Work

AI agents are not hidden utilities. They are visible participants with defined roles, scope, current activity, status, evidence, and output.

### 3.5 Operational Clarity

The product must reduce uncertainty. Every important screen should answer:

1. What is happening?
2. What changed?
3. Why does it matter?
4. What is connected?
5. What should happen next?

## 4. Experience Principles

### 4.1 Signal Before Structure

Do not begin with containers. Begin with the user's decision.

The most important information should dominate the page regardless of the underlying database structure.

### 4.2 Relationships Are First-Class

Users should see connections between meetings, decisions, tasks, RFIs, changes, cost impacts, documents, and people.

Use timelines, relationship panels, linked-object trails, dependency maps, and graphs where they improve understanding.

### 4.3 Progressive Disclosure

Show the essential signal first. Reveal depth through expansion, hover, drill-down, drawers, command menus, and focused detail views.

Do not place every field on the first screen.

### 4.4 Motion Must Explain

Motion is used to communicate:

- State changes
- Data movement
- Causality
- Relationships
- Progress
- Focus
- Completion

Motion must never exist merely to make the interface look futuristic.

### 4.5 Density With Discipline

Alleato serves power users. High information density is appropriate, but density must be structured through hierarchy, alignment, whitespace, grouping, and typography.

### 4.6 Explain the AI

Every AI-generated output should make its source, confidence, status, and downstream impact visible.

### 4.7 Every Pixel Must Earn Its Place

Avoid ornamental cards, duplicate labels, excessive borders, repeated summaries, and decorative empty space.

## 5. Page Archetypes

Every page must declare one primary archetype before design begins.

### 5.1 Command Center

Purpose: Surface what requires attention now.

Use for:

- Executive dashboard
- Project dashboard
- Daily brief
- AI system health

Characteristics:

- Prioritized actions
- Status and trend
- Exceptions over averages
- Minimal card repetition
- Strong hierarchy
- Contextual drill-down

### 5.2 System Map

Purpose: Explain how information, agents, and objects connect.

Use for:

- Company Brain
- AI agent directory
- RAG pipeline
- Knowledge graph
- Change-event lineage

Characteristics:

- Nodes and edges
- Live status
- Zoom and pan
- Focus mode
- Relationship inspector
- Animated data flow

### 5.3 Storyline

Purpose: Reconstruct the sequence and meaning of events.

Use for:

- Project Intelligence
- Decision history
- Change history
- Meeting lineage

Characteristics:

- Timeline
- Milestones
- Cause-and-effect links
- Evidence and citations
- Collapsible detail

### 5.4 Workbench

Purpose: Let power users complete complex work efficiently.

Use for:

- Budget
- Estimating
- Commitments
- Change Events
- Prime Contracts
- Schedule

Characteristics:

- Dense table or canvas
- Keyboard navigation
- Inline editing
- Saved views
- Resizable columns
- Context menus
- Bulk actions

### 5.5 Structured Form

Purpose: Collect or edit information clearly.

Characteristics:

- Grouped sections
- Consistent field widths
- Two-column desktop layout when appropriate
- Sticky review or summary area for complex forms
- Minimal borders
- Clear completion path

### 5.6 Object Detail

Purpose: Show a single object's current state, history, relationships, and actions.

Characteristics:

- Strong object header
- Status and ownership
- Relationship trail
- Activity history
- Contextual actions
- Expandable evidence

## 6. Visual Language

### 6.1 Base Aesthetic

Enterprise-grade, cinematic restraint.

The visual system should combine:

- Deep neutral surfaces
- High-contrast typography
- Sparse accent color
- Subtle gradients
- Controlled glow
- Fine grid and node patterns
- Soft elevation
- Precision lines
- Data-first compositions

### 6.2 Color

Color is semantic, not decorative.

Use accent color for:

- Selected state
- Active process
- AI activity
- Primary action
- Relationship emphasis

Use status colors consistently for success, warning, risk, blocked, pending, and inactive.

Avoid rainbow dashboards unless color represents meaningful categories.

### 6.3 Depth

Use no more than four depth levels:

1. Base canvas
2. Working surface
3. Floating inspector or modal
4. Active or system-critical object

Glass effects should be rare and reserved for overlays, system visualization, or transient controls.

### 6.4 Typography

Typography must carry hierarchy.

- Small all-caps labels for sections
- Strong page and object titles
- Compact table typography
- Monospaced type only for logs, IDs, code, or machine output
- Never use low-contrast body text for important content

### 6.5 Borders

Use borders to define data structure, not to create card decoration.

Prefer:

- Section dividers
- Row separators
- Subtle outlines around interactive nodes
- Focus rings

Avoid nested card borders.

### 6.6 Iconography

Use a consistent icon family. Agent and object icons may have distinct symbols, but should share stroke weight, geometry, and container treatment.

## 7. Motion Language

### 7.1 Motion Categories

- Micro: hover, focus, selection, inline edit
- Structural: expand, collapse, reorder, navigate
- Data: ingestion, processing, connection, completion
- Ambient: subtle pulse or background movement indicating a living system

### 7.2 Rules

- Motion must remain fast and interruptible
- Respect reduced-motion preferences
- Avoid animating large areas on routine navigation
- Use spring motion for direct manipulation
- Use short ease-out transitions for appearing content
- Use linear or gently eased motion for data flow

### 7.3 Signature Motions

Alleato may establish a few recurring behaviors:

- Nodes softly pulse when active
- New information travels along a connection path
- Generated output resolves from a processing state into a stable object
- Relationship lines strengthen when an object is selected
- Side inspectors slide from the right without displacing the primary canvas

## 8. Interaction Language

### 8.1 Selection

Selection should visibly change context across the screen. Selecting a node may update a side panel, highlight connections, dim unrelated objects, and surface actions.

### 8.2 Expansion

Cards and objects should expand in place when possible before opening a separate page.

### 8.3 Keyboard

Power-user areas must support:

- Arrow-key navigation
- Enter to open or add
- Escape to close
- Command palette
- Copy link
- Multi-select
- Common shortcuts displayed in menus

### 8.4 Context Menus

Use right-click or overflow menus for object-specific actions without overcrowding the primary interface.

### 8.5 Search

Search should expand on intent and support objects, commands, people, projects, and semantic queries.

### 8.6 Inspectors

Use right-side inspectors for contextual detail. Do not overuse full-page navigation when users need to maintain visual context.

## 9. Data Visualization Doctrine

A chart is justified only when it reveals a pattern, comparison, relationship, sequence, distribution, or risk faster than text or a table.

Choose the visualization based on the question:

- Trend over time → line or area chart
- Planned versus actual → variance chart
- Dependency → network or directed graph
- Flow → Sankey or pipeline
- Sequence → timeline
- Distribution → histogram or stacked bar
- Concentration → heat map
- Hierarchy → tree
- Relationship strength → network graph
- Schedule → Gantt

Every visualization must include:

- Clear labels
- Hover or focus details
- Empty state
- Loading state
- Error state
- Accessible text alternative
- Drill-down path

## 10. AI Experience Rules

### 10.1 Visible State

Agents should have explicit states:

- Idle
- Listening
- Reading
- Reasoning
- Waiting for input
- Running a tool
- Drafting
- Needs review
- Completed
- Failed

### 10.2 Evidence

AI outputs should link to supporting sources and relevant objects.

### 10.3 Human Control

Users must be able to:

- Review before committing
- Correct the AI
- See what changed
- Undo actions
- Provide feedback
- Understand ownership

### 10.4 Agent Identity

Each agent should have:

- Name
- Role
- Scope
- Tools
- Knowledge access
- Current work
- Recent output
- Performance indicators
- Escalation rules

## 11. Signature Alleato Experiences

### 11.1 Company Brain

A spatial map of data sources, knowledge domains, projects, people, and agents.

Core behaviors:

- Nodes appear as knowledge grows
- Data-source activity animates toward the brain
- Selecting a node reveals linked meetings, emails, drawings, tasks, risks, and decisions
- Time controls allow users to see how knowledge evolved
- Filters isolate projects, people, source types, or object types

### 11.2 Agent Directory

A visual organization of digital workers.

Core behaviors:

- Network and list views
- Agent status
- Current assignments
- Inputs, tools, memory, and outputs
- Agent-to-agent handoffs
- Activity stream

### 11.3 Project Intelligence

A living project narrative rather than a dashboard.

Core sections:

- Current focus
- Material changes
- Decisions needed
- Risks and blockers
- Timeline
- Linked evidence
- Generated actions
- Financial and schedule impact

### 11.4 AI Pipeline

A live view of ingestion and reasoning.

Core behaviors:

- Source volume by day
- Stage status
- Failure visibility
- Processing latency
- Generated outputs
- Expandable logs
- Re-run controls

### 11.5 Change Intelligence

A visual lineage from source signal to financial and contractual consequence.

Example:

> Meeting → decision → RFI → change event → pricing → PCO → PCCO → budget impact

## 12. Anti-Patterns

Do not ship:

- Dashboard pages made entirely of equal-weight cards
- Decorative gradients with no functional purpose
- Glowing effects on every interactive element
- Charts that duplicate a nearby table
- AI output without sources or review state
- Full-page navigation for every detail interaction
- Multiple nested panels with separate borders
- Dark mode with insufficient contrast
- Two-line table headers
- Empty visualizations added only to look advanced
- Animation that delays work

## 13. Review Standard

A design is not approved until it passes these tests:

### Clarity

Can the user identify the purpose of the page in five seconds?

### Priority

Is the most important information visually dominant?

### Action

Is the next action obvious?

### Relationship

Can users understand how the primary objects connect?

### Efficiency

Can a power user complete common actions quickly?

### Intelligence

Does the page demonstrate why Alleato is more valuable than a traditional construction platform?

### Restraint

Has unnecessary decoration, repetition, and container chrome been removed?
