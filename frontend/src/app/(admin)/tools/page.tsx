import type { ComponentType } from "react";
import Link from "next/link";
import {
  BarChart3,
  BookOpen,
  Briefcase,
  Building2,
  Calculator,
  ChevronRight,
  ClipboardList,
  DollarSign,
  FileText,
  FolderKanban,
  HardHat,
  Layers,
  LineChart,
  Package,
  PenTool,
  Receipt,
  Settings,
  Shield,
  Users,
  Workflow,
  Wrench,
} from "lucide-react";

import { PageBadge } from "@/components/ds/page-badge";
import { PageShell } from "@/components/layout";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProcoreTool {
  id: number;
  name: string;
  slug: string;
  category: string;
  status: string;
  description: string | null;
  procore_link: string | null;
}

// ---------------------------------------------------------------------------
// Category configuration
// ---------------------------------------------------------------------------

const CATEGORY_ORDER = ["Financial", "Core Tools", "Project Mgmt", "Admin"];

const CATEGORY_META: Record<
  string,
  { icon: ComponentType<{ className?: string }>; description: string }
> = {
  Financial: {
    icon: DollarSign,
    description:
      "Budget management, contracts, change orders, commitments, and billing.",
  },
  "Core Tools": {
    icon: Wrench,
    description:
      "Essential platform tools for day-to-day project operations.",
  },
  "Project Mgmt": {
    icon: FolderKanban,
    description:
      "Project management, scheduling, RFIs, submittals, and coordination.",
  },
  Admin: {
    icon: Settings,
    description:
      "Company and project administration, permissions, and configuration.",
  },
};

// ---------------------------------------------------------------------------
// Tool icon mapping
// ---------------------------------------------------------------------------

const TOOL_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  Budget: DollarSign,
  Budgeting: DollarSign,
  "Prime Contracts": FileText,
  Commitments: ClipboardList,
  "Change Events": Layers,
  "Change Orders": FolderKanban,
  Invoicing: BarChart3,
  "Direct Costs": Receipt,
  Forecasting: LineChart,
  Estimating: Calculator,
  Bidding: Briefcase,
  Drawings: PenTool,
  "Company Directory": Users,
  "ERP Integration": Workflow,
  Equipment: Package,
  General: BookOpen,
  Safety: HardHat,
  "Admin Company": Settings,
  "Admin Project": Shield,
};

function getToolIcon(
  name: string | null
): ComponentType<{ className?: string }> {
  if (!name) return BookOpen;
  return TOOL_ICONS[name] ?? BookOpen;
}

// ---------------------------------------------------------------------------
// CardBody — shared inner content for tool cards
// ---------------------------------------------------------------------------

function CardBody({
  tool,
  ToolIcon,
  showExternalIcon,
}: {
  tool: ProcoreTool;
  ToolIcon: ComponentType<{ className?: string }>;
  showExternalIcon: boolean;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Icon + name */}
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
          <ToolIcon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground leading-tight">
            {tool.name ?? "Unnamed"}
          </h3>
        </div>
        {showExternalIcon && (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30 transition-colors group-hover:text-muted-foreground" />
        )}
      </div>

      {/* Description */}
      {tool.description && (
        <p className="mb-3 text-xs text-muted-foreground leading-relaxed line-clamp-2 flex-1">
          {tool.description}
        </p>
      )}

      {/* Status pill */}
      {tool.status && (
        <div className="mt-auto">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
              tool.status === "Review"
                ? "bg-green-50 text-green-700"
                : tool.status === "Implementation"
                  ? "bg-blue-50 text-blue-700"
                  : tool.status.includes("Test")
                    ? "bg-amber-50 text-amber-700"
                    : "bg-muted text-muted-foreground"
            }`}
          >
            {tool.status}
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ToolsPage() {
  const supabase = await createClient();

  const { data: tools, error } = await supabase
    .from("procore_tools")
    .select("id, name, slug, category, status, description, procore_link")
    .order("name", { ascending: true });

  if (error) {
    return (
      <PageShell variant="content" title="Tools">
        <p className="text-sm text-destructive">
          Failed to load tools. Please try again.
        </p>
      </PageShell>
    );
  }

  // Group tools by category
  const grouped: Record<string, ProcoreTool[]> = {};
  for (const tool of tools ?? []) {
    const cat = tool.category ?? "Other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(tool);
  }

  // Ordered categories (known ones first, then any extras)
  const orderedCategories = [
    ...CATEGORY_ORDER.filter((c) => grouped[c]?.length),
    ...Object.keys(grouped).filter((c) => !CATEGORY_ORDER.includes(c)),
  ];

  const totalTools = (tools ?? []).length;

  return (
    <PageShell
      variant="content"
      title="Tools"
      titleContent={
        <div className="space-y-2">
          <PageBadge icon={<Wrench className="h-3.5 w-3.5" />}>
            Alleato platform
          </PageBadge>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold">
            Tools
          </h1>
        </div>
      }
      description={`Browse all ${totalTools} Alleato tools organized by category.`}
    >
      <div className="space-y-14">
        {orderedCategories.map((category) => {
          const categoryTools = grouped[category] ?? [];
          const meta = CATEGORY_META[category];
          const CategoryIcon = meta?.icon ?? BookOpen;

          return (
            <section key={category}>
              {/* ─── Category header ─── */}
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <CategoryIcon className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    {category}
                  </h2>
                  {meta?.description && (
                    <p className="text-xs text-muted-foreground">
                      {meta.description}
                    </p>
                  )}
                </div>
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                  {categoryTools.length}{" "}
                  {categoryTools.length === 1 ? "tool" : "tools"}
                </span>
              </div>

              {/* ─── Tool cards ─── */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {categoryTools.map((tool) => {
                  const ToolIcon = getToolIcon(tool.name);
                  const slug = tool.slug?.trim();
                  const href = slug ? `/procore-tools${slug}` : null;
                  const procoreHref = tool.procore_link?.trim() || null;
                  const key = tool.id ?? tool.slug ?? tool.name;

                  return (
                    <div key={key} className="group relative">
                      {/* Card — full-area link */}
                      {href ? (
                        <Link
                          href={href}
                          className="block h-full rounded-lg border border-border/50 bg-background p-5 transition-all hover:border-border hover:bg-muted"
                        >
                          <CardBody tool={tool} ToolIcon={ToolIcon} showExternalIcon />
                        </Link>
                      ) : (
                        <div className="h-full rounded-lg border border-border/50 bg-background p-5">
                          <CardBody tool={tool} ToolIcon={ToolIcon} showExternalIcon={false} />
                        </div>
                      )}

                      {/* Procore link — absolutely positioned so it never nests inside <a> */}
                      {procoreHref && (
                        <a
                          href={procoreHref}
                          target="_blank"
                          rel="noreferrer"
                          title="View in Procore"
                          className="absolute bottom-4 right-4 inline-flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors z-10"
                        >
                          <Building2 className="h-3 w-3" />
                          Procore
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </PageShell>
  );
}
