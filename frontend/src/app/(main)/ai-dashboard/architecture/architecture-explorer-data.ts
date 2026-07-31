export type ArchitectureLayerId =
  | "routes"
  | "shared-ui"
  | "ai-runtime"
  | "services"
  | "database"
  | "project-map"
  | "table-metadata"
  | "verification"
  | "publishing";

export type ArchitectureLayer = {
  id: ArchitectureLayerId;
  path: string;
  title: string;
  summary: string;
  boundary: string;
  examples: string[];
  sourceLabel: string;
  sourceHref: string;
  check: string;
};

const repositoryUrl =
  "https://github.com/The-Alleato-Group/project-management/blob/main";

export const architectureLayers: ArchitectureLayer[] = [
  {
    id: "routes",
    path: "frontend/src/app/",
    title: "Protected routes and pages",
    summary:
      "The Next.js App Router is the single owner for application pages, route layouts, and browser-facing API endpoints.",
    boundary:
      "Pages compose shared components and feature modules. Long-running ingestion and scheduled processing stay out of the browser request path.",
    examples: [
      "frontend/src/app/(main)/",
      "frontend/src/app/api/",
      "frontend/src/features/",
    ],
    sourceLabel: "Generated project map",
    sourceHref: `${repositoryUrl}/docs/architecture/PROJECT-MAP.md`,
    check: "npm run check:routes",
  },
  {
    id: "shared-ui",
    path: "frontend/src/components/",
    title: "Shared interface system",
    summary:
      "Reusable layout, UI, and domain components keep repeated workflows visually and behaviorally consistent.",
    boundary:
      "A page changes the data adapter or workflow scope. It does not copy a table, header, form, or interaction pattern that already has an owner.",
    examples: [
      "frontend/src/components/ui/",
      "frontend/src/components/layout/",
      "frontend/src/components/domain/",
    ],
    sourceLabel: "Product design contract",
    sourceHref: `${repositoryUrl}/DESIGN.md`,
    check: "npm --prefix frontend run quality:changed",
  },
  {
    id: "ai-runtime",
    path: "frontend/src/lib/ai/",
    title: "Product AI runtime",
    summary:
      "Chat streaming, tools, retrieval, prompt assembly, memory, and traces share one typed product runtime.",
    boundary:
      "AI proposes and explains. Deterministic application code validates writes, enforces permissions, and records the result.",
    examples: [
      "frontend/src/lib/ai/tools/",
      "frontend/src/lib/ai/retrieval/",
      "agents/alleato-assistant/",
    ],
    sourceLabel: "AI and RAG architecture",
    sourceHref: `${repositoryUrl}/docs/architecture/AI-RAG-ARCHITECTURE.md`,
    check: "typed tools + focused evals",
  },
  {
    id: "services",
    path: "backend/src/services/",
    title: "Operational services",
    summary:
      "FastAPI services on Render own ingestion, Microsoft Graph, Fireflies, OCR, embeddings, and scheduled processing.",
    boundary:
      "Work that needs retries, source credentials, or a lifetime longer than one browser request belongs here rather than in page code.",
    examples: [
      "backend/src/services/integrations/",
      "backend/src/services/intelligence/",
      "backend/src/services/health/",
    ],
    sourceLabel: "Runtime ownership map",
    sourceHref: `${repositoryUrl}/docs/architecture/ALLEATO-SYSTEM-MAP.md`,
    check: "focused backend tests + Render health",
  },
  {
    id: "database",
    path: "supabase/migrations/",
    title: "Database contract",
    summary:
      "Supabase migrations, row-level security, generated types, and migration-ledger checks define the durable data contract.",
    boundary:
      "Application code does not invent columns or relationships. Database-dependent work starts by regenerating and inspecting types.",
    examples: [
      "supabase/migrations/",
      "frontend/src/types/database.types.ts",
      "scripts/database/",
    ],
    sourceLabel: "Database ownership metadata",
    sourceHref: `${repositoryUrl}/docs/architecture/tables.yaml`,
    check: "npm run db:types:check",
  },
  {
    id: "project-map",
    path: "docs/architecture/PROJECT-MAP.md",
    title: "Generated repository map",
    summary:
      "The project map inventories pages, API routes, and AI tools directly from the filesystem so new work starts from what actually exists.",
    boundary:
      "Generated maps answer what exists now. They are regenerated from source and are never maintained as a second hand-written inventory.",
    examples: [
      "Route inventory",
      "API route inventory",
      "AI tool inventory",
    ],
    sourceLabel: "Open the generated map",
    sourceHref: `${repositoryUrl}/docs/architecture/PROJECT-MAP.md`,
    check: "npm run map:project -- --check-only",
  },
  {
    id: "table-metadata",
    path: "docs/architecture/tables.yaml",
    title: "Database meaning and ownership",
    summary:
      "Human-authored table metadata records purpose, owner, gotchas, and AI guidance that raw schema inspection cannot explain.",
    boundary:
      "Schema facts are generated. Business meaning is curated. Keeping those roles separate prevents a stale duplicate database catalog.",
    examples: ["purpose", "owner", "gotchas", "notesForAi"],
    sourceLabel: "Open table metadata",
    sourceHref: `${repositoryUrl}/docs/architecture/tables.yaml`,
    check: "npm run db:inventory -- --check-only",
  },
  {
    id: "verification",
    path: "scripts/verification/",
    title: "Evidence before acceptance",
    summary:
      "Observable work is not accepted from a completion narrative alone. It requires declared evidence and independent review.",
    boundary:
      "Screenshots, browser proof, regression coverage, and reviewer approval must support the exact claim on the exact route.",
    examples: [
      "verification-manifest.json",
      "verification-result.json",
      "independent-review.md",
    ],
    sourceLabel: "Verification contract",
    sourceHref: `${repositoryUrl}/scripts/verification/verification-contract.mjs`,
    check: "npm run verify:contract",
  },
  {
    id: "publishing",
    path: "scripts/ops/codex-finish.mjs",
    title: "Controlled publication",
    summary:
      "The finish command stages only task-owned files, runs changed-file gates, publishes to main, and verifies local and remote equality.",
    boundary:
      "Parallel-session work remains untouched. A failed check blocks publication and names the cause, detection gap, and recovery step.",
    examples: ["exact file scope", "quality gates", "origin/main readback"],
    sourceLabel: "Controlled finish command",
    sourceHref: `${repositoryUrl}/scripts/ops/codex-finish.mjs`,
    check: "npm run codex:finish -- --check",
  },
];

export const architectureLayerById = Object.fromEntries(
  architectureLayers.map((layer) => [layer.id, layer]),
) as Record<ArchitectureLayerId, ArchitectureLayer>;

export const architectureScreenshots = [
  {
    src: "/images/architecture/executive-workspace.png",
    alt: "Alleato executive workspace with shared navigation and portfolio signal",
    title: "One shell, separate route owners",
    description:
      "The executive workspace keeps navigation and page rhythm consistent while each route owns one decision surface.",
  },
  {
    src: "/images/architecture/project-activity.png",
    alt: "Alleato active projects page showing recent project activity",
    title: "Feature modules own workflow behavior",
    description:
      "Project activity reuses the workspace shell while its feature module owns project-specific data and interaction.",
  },
] as const;

export const architectureGuardrails = [
  {
    step: "01",
    title: "Rules before code",
    description:
      "AGENTS.md and CONTEXT.md establish ownership, invariants, and failure rules before an implementation starts.",
    evidence: "Loaded at task intake",
  },
  {
    step: "02",
    title: "Generated maps detect structural drift",
    description:
      "Routes, APIs, AI tools, and cross-layer ownership are regenerated from the repository rather than maintained twice.",
    evidence: "map:project + map:system",
  },
  {
    step: "03",
    title: "Database shape is checked first",
    description:
      "Migrations, generated types, table metadata, and the remote migration ledger keep data assumptions explicit.",
    evidence: "db:types + migration ledger",
  },
  {
    step: "04",
    title: "Visible work requires visible proof",
    description:
      "Focused tests, exact-route screenshots, browser actions, and independent review support acceptance.",
    evidence: "verify:contract",
  },
  {
    step: "05",
    title: "Only task-owned files are published",
    description:
      "The finish gate runs changed-file checks, commits the explicit scope, pushes main, and confirms the published revision.",
    evidence: "codex:finish",
  },
] as const;
