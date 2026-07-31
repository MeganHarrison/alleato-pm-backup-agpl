export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Calendar,
  FileText,
  Hash,
  User,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  insightCardBaseQuery,
  deriveSeverity,
  type InsightCardWithTarget,
} from "@/lib/ai/insight-cards";
import {
  SourceReferenceButton,
  type SourceReferenceRecord,
} from "@/components/ai-intelligence/source-reference-button";

const SEVERITY_VARIANT: Record<string, "destructive" | "default" | "outline" | "secondary"> = {
  critical: "destructive",
  high: "destructive",
  medium: "default",
  low: "outline",
};

const STATUS_VARIANT: Record<string, "destructive" | "default" | "outline" | "secondary"> = {
  open: "destructive",
  blocked: "destructive",
  needs_review: "default",
  stale: "outline",
  resolved: "outline",
};

function formatDate(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

function MetaItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2 w-32 shrink-0">
      <span className="text-muted-foreground">{icon}</span>
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wide">
          {label}
        </p>
        <p className="text-sm text-foreground">{value}</p>
      </div>
    </div>
  );
}

interface PageProps {
  params: Promise<{ insightId: string }>;
}

export default async function InsightDetailPage({ params }: PageProps) {
  const { insightId } = await params;
  const supabase = await createClient();

  const [cardResult, evidenceResult] = await Promise.all([
    insightCardBaseQuery(supabase, { includeAnyStatus: true })
      .eq("id", insightId)
      .single(),
    supabase
      .from("insight_card_evidence")
      .select("source_document_id")
      .eq("insight_card_id", insightId),
  ]);

  if (cardResult.error || !cardResult.data) {
    notFound();
  }

  const card = cardResult.data as unknown as InsightCardWithTarget;
  const severity = deriveSeverity(card);

  const sourceIds = (evidenceResult.data ?? [])
    .map((r) => r.source_document_id)
    .filter(Boolean) as string[];

  const sources: SourceReferenceRecord[] = [];
  if (sourceIds.length > 0) {
    const { data: docRows } = await supabase
      .from("document_metadata")
      .select(
        "id, title, type, category, source, source_system, date, created_at, summary, overview, description, notes, content, raw_text, source_web_url, fireflies_link, meeting_link, url, participants, participants_array",
      )
      .in("id", sourceIds);

    for (const doc of docRows ?? []) {
      const participantsArray: string[] =
        Array.isArray(doc.participants_array)
          ? (doc.participants_array as string[])
          : typeof doc.participants === "string" && doc.participants
            ? (doc.participants as string).split(",").map((s: string) => s.trim()).filter(Boolean)
            : [];

      sources.push({
        id: doc.id,
        title: doc.title ?? null,
        type: doc.type ?? null,
        category: doc.category ?? null,
        source: doc.source ?? null,
        sourceSystem: doc.source_system ?? null,
        date: doc.date ?? null,
        createdAt: doc.created_at ?? null,
        summary: doc.summary ?? null,
        overview: doc.overview ?? null,
        description: doc.description ?? null,
        notes: doc.notes ?? null,
        content: doc.content ?? null,
        rawText: doc.raw_text ?? null,
        sourceWebUrl: doc.source_web_url ?? null,
        firefliesLink: doc.fireflies_link ?? null,
        meetingLink: doc.meeting_link ?? null,
        url: doc.url ?? null,
        participants: participantsArray,
      });
    }
  }

  const projectId = card.intelligence_targets?.project_id ?? 0;

  return (
    <div className="mx-auto max-w-3xl px-6 py-6 space-y-6">
      {/* Back nav */}
      <Link
        href="/insights"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to insights
      </Link>

      {/* Header */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant={STATUS_VARIANT[card.current_status] ?? "outline"} className="capitalize">
            {card.current_status.replace(/_/g, " ")}
          </Badge>
          <Badge variant={SEVERITY_VARIANT[severity] ?? "outline"} className="capitalize">
            {severity}
          </Badge>
          <Badge variant="secondary" className="capitalize">
            {card.card_type.replace(/_/g, " ")}
          </Badge>
          <Badge variant="outline" className="capitalize">
            {card.confidence} confidence
          </Badge>
        </div>

        <p className="text-xl font-semibold text-foreground leading-snug">
          {card.title}
        </p>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap gap-6 border-y border-border/40 py-4">
        {card.intelligence_targets?.name && (
          <MetaItem
            icon={<Building2 className="h-3.5 w-3.5" />}
            label="Project"
            value={card.intelligence_targets.name}
          />
        )}
        {card.suggested_owner_label && (
          <MetaItem
            icon={<User className="h-3.5 w-3.5" />}
            label="Owner"
            value={card.suggested_owner_label}
          />
        )}
        {card.created_at && (
          <MetaItem
            icon={<Calendar className="h-3.5 w-3.5" />}
            label="Created"
            value={formatDate(card.created_at)}
          />
        )}
        {card.last_seen_at && (
          <MetaItem
            icon={<Hash className="h-3.5 w-3.5" />}
            label="Last seen"
            value={formatDate(card.last_seen_at)}
          />
        )}
      </div>

      {/* Summary */}
      {card.summary && (
        <section className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Summary
          </p>
          <p className="text-sm text-foreground leading-relaxed">{card.summary}</p>
        </section>
      )}

      {/* Why it matters */}
      {card.why_it_matters && (
        <section className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Why it matters
          </p>
          <p className="text-sm text-foreground leading-relaxed">
            {card.why_it_matters}
          </p>
        </section>
      )}

      {/* Next action */}
      {card.next_action && (
        <section className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Next action
          </p>
          <div className="rounded-md bg-muted/50 px-4 py-3">
            <p className="text-sm text-foreground leading-relaxed">
              {card.next_action}
            </p>
          </div>
        </section>
      )}

      {/* Sources */}
      {sources.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Sources ({sources.length})
          </p>
          <div className="space-y-1">
            {sources.map((source) => (
              <div
                key={source.id}
                className="flex items-center gap-3 py-1.5"
              >
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <SourceReferenceButton
                  buttonLabel={source.title ?? source.type ?? "Source"}
                  projectId={projectId}
                  source={source}
                />
                {source.type && (
                  <span className="text-xs text-muted-foreground capitalize">
                    {source.type.replace(/_/g, " ")}
                  </span>
                )}
                {(source.date ?? source.createdAt) && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    {formatDate(source.date ?? source.createdAt)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
