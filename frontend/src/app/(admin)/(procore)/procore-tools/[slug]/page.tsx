import { AppWindow, ArrowLeft, Building2, GraduationCap } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageShell } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { ToolDetailTabs } from "./ToolDetailTabs";

interface Props {
  params: Promise<{ slug: string }>;
}

function statusVariant(status: string | null): "default" | "secondary" | "outline" {
  if (!status) return "outline";
  const s = status.toLowerCase();
  if (s === "implementation") return "default";
  if (s === "review" || s === "testing") return "secondary";
  return "outline";
}

export default async function ProcoreToolDetailPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: tool } = await supabase
    .from("procore_tools")
    .select("*")
    .eq("slug", `/${slug}`)
    .maybeSingle();

  if (!tool) {
    notFound();
  }

  const appLink = tool.new_link?.trim() || null;
  const procoreLink = tool.procore_link?.trim() || null;
  const testScenariosLink = `/procore-tools/${slug}?tab=scenarios`;

  const actions = (
    <div className="flex items-center gap-2 flex-wrap">
      <Link
        href="/procore-tools"
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        All Tools
      </Link>
      {tool.new_link && (
        <a
          href={tool.new_link}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <AppWindow className="h-3.5 w-3.5" />
          Alleato
        </a>
      )}
      {tool.procore_link && (
        <a
          href={tool.procore_link}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Building2 className="h-3.5 w-3.5" />
          Procore
        </a>
      )}
      {tool.tutorials && (
        <a
          href={tool.tutorials}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <GraduationCap className="h-3.5 w-3.5" />
          Tutorial
        </a>
      )}
    </div>
  );

  return (
    <PageShell
      variant="dashboard"
      title={tool.name ?? slug}
      statusBadge={
        tool.status ? (
          <Badge variant={statusVariant(tool.status)} className="ml-2">
            {tool.status}
          </Badge>
        ) : undefined
      }
      description={tool.category ?? undefined}
      actions={actions}
    >
      <div className="mb-4 border-b border-border/60 pb-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Quick Links
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          <a
            href={appLink ?? "#"}
            target={appLink ? "_blank" : undefined}
            rel={appLink ? "noreferrer" : undefined}
            className={appLink ? "text-primary hover:underline" : "text-muted-foreground"}
          >
            1. App Page
          </a>
          <Link href={testScenariosLink} className="text-primary hover:underline">
            2. Testing Scenarios
          </Link>
          <a
            href={procoreLink ?? "#"}
            target={procoreLink ? "_blank" : undefined}
            rel={procoreLink ? "noreferrer" : undefined}
            className={procoreLink ? "text-primary hover:underline" : "text-muted-foreground"}
          >
            3. Procore Tool
          </a>
        </div>
      </div>

      <ToolDetailTabs slug={slug} description={tool.description ?? null} />
    </PageShell>
  );
}
