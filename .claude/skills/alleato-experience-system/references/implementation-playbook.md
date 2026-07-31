# Alleato Experience Implementation Playbook

## Required Pre-Code UI Plan

Before implementation, create a UI plan containing:

1. Page archetype
2. User objective
3. Primary decision or action
4. Information hierarchy
5. Main objects and relationships
6. Layout zones
7. Interaction model
8. Visualization choice
9. Loading, empty, error, and success states
10. Motion plan
11. Mobile behavior
12. Accessibility considerations

No page should be implemented from a loose screenshot or feature list alone.

## Recommended Front-End Stack

Use the existing Alleato stack where possible:

- Next.js App Router
- Tailwind tokens
- Shadcn primitives
- Framer Motion for interaction and layout transitions
- React Flow for workflow and node-based experiences
- D3 for custom data visualizations
- Recharts for conventional charts
- TanStack Table for dense workbenches
- cmdk for command menus
- Radix primitives for accessible interactions

Use GSAP only when Framer Motion cannot achieve the required data-flow or timeline behavior cleanly.

## Component Families

Build reusable product-level components rather than page-specific styling.

### Spatial

- `SystemCanvas`
- `GraphNode`
- `ConnectionEdge`
- `CanvasToolbar`
- `RelationshipInspector`
- `MiniMap`
- `TimeScrubber`

### Intelligence

- `AgentStatus`
- `EvidenceTrail`
- `ConfidenceIndicator`
- `ReasoningSummary`
- `SourceCitation`
- `HumanReviewState`
- `AIActivityStream`

### Story

- `ProjectTimeline`
- `StoryEvent`
- `ImpactChain`
- `DecisionNode`
- `RiskMarker`
- `MilestoneMarker`

### Workbench

- `DataWorkbench`
- `ColumnManager`
- `SavedViewMenu`
- `InlineEditor`
- `BulkActionBar`
- `ContextActionMenu`

### Layout

- `PageShell`
- `CommandHeader`
- `SplitCanvas`
- `RightInspector`
- `SectionHeader`
- `FocusPanel`

## Delivery Sequence

### Phase 1: Identity Foundation

- Finalize color, typography, depth, motion, and icon tokens
- Build shared spatial and AI-state components
- Build page archetype templates

### Phase 2: Flagship Experiences

Build three screens that define the new identity:

1. Company Brain
2. Project Intelligence
3. Agent Directory

Do not redesign every module simultaneously.

### Phase 3: Power-User Workbenches

Apply the interaction system to:

- Budget
- Change Events
- Commitments
- Schedule

### Phase 4: Product-Wide Standardization

Migrate remaining pages to the correct archetype and shared component families.

## Definition of Done

A feature is not complete until:

- The page archetype is declared
- The UI plan exists
- All states are implemented
- Keyboard behavior is tested
- Reduced motion is supported
- Mobile behavior is defined
- Visual regression screenshots are captured
- The Experience Architect review passes
