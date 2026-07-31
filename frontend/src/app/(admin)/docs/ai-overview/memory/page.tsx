import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Database, MessageCircle, Network, X } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { createRagServiceClient } from "@/lib/supabase/service";
import { PageShell } from "@/components/layout";
import { SectionNav } from "../_components/section-nav";
import { Section, SectionTitleContent } from "../_components/section-shell";

export const metadata: Metadata = {
  title: "Memory: How the AI works",
  description:
    "Three layers, three purposes. The system forgets what you'd want it to forget: but it remembers what matters.",
};

export const dynamic = "force-dynamic";

async function loadMemoryCounts(): Promise<{
  chunks: string;
  messages: string;
  typedEntries: string;
}> {
  // Layer 3: document_chunks from the RAG (AI Database) project
  let chunks = "109K+";
  try {
    const ragClient = createRagServiceClient();
    const { count, error } = await ragClient
      .from("document_chunks")
      .select("id", { count: "exact", head: true });
    if (!error && typeof count === "number") {
      chunks = count.toLocaleString();
    }
  } catch {
    // RAG DB unavailable — fall back to static label
  }

  // Layer 1: chat_history from the main PM database
  let messages = "—";
  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("chat_history")
      .select("id", { count: "exact", head: true });
    if (!error && typeof count === "number") {
      messages = count.toLocaleString();
    }
  } catch {
    // Table unavailable — fall back to dash
  }

  // Layer 2: conversation_memories is exposed as a search RPC in the main DB,
  // not as a direct table — fall back to dash.
  // TODO: query conversation_memories directly once it is a queryable table.
  const typedEntries = "—";

  return { chunks, messages, typedEntries };
}

export default async function MemoryPage() {
  const { chunks, messages, typedEntries } = await loadMemoryCounts();

  return (
    <PageShell
      variant="content"
      title="What the AI remembers"
      titleContent={<SectionTitleContent title="What the AI remembers" subtitle="Three layers, three purposes. The system forgets what you'd want it to forget: but it remembers what matters." />}
    >
      <SectionNav />
      <div className="space-y-14">
      {/* Section 1 — Live counts */}
      <Section eyebrow="Live counts" title="Right now, the memory contains">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <StatBlock
            label="Vector chunks"
            value={chunks}
            suffix="emails, meetings, docs"
          />
          <StatBlock
            label="Conversation messages"
            value={messages}
            suffix="across all sessions"
          />
          <StatBlock
            label="Typed memory entries"
            value={typedEntries}
            suffix="preferences &amp; decisions"
          />
        </div>
      </Section>

      {/* Section 2 — The three layers */}
      <Section eyebrow="The three layers" title="How memory is organized">
        <div className="space-y-4">
          {/* Layer 1 */}
          <div className="rounded-lg bg-muted/40 p-6">
            <div className="flex items-start gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <MessageCircle className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Layer 1
                </p>
                <h3 className="text-lg font-semibold text-foreground">
                  Conversation memory
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  The last N messages of the active chat, plus an auto-generated
                  summary once the conversation gets long. Stored in{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">
                    chat_history
                  </code>{" "}
                  and{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">
                    conversation_summaries
                  </code>
                  . The AI uses this to keep track of what you&apos;ve already
                  discussed in the current session.
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Scope:</span>{" "}
                  per-user, per-conversation. Cleared when you start a new chat.
                </p>
              </div>
            </div>
          </div>

          {/* Layer 2 */}
          <div className="rounded-lg bg-muted/40 p-6">
            <div className="flex items-start gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Network className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Layer 2
                </p>
                <h3 className="text-lg font-semibold text-foreground">
                  Typed user memory
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  When the AI learns something durable: a preference, a project
                  decision, a recurring person: it writes a typed note (
                  <em>user / feedback / project / reference</em>) to{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">
                    conversation_memories
                  </code>
                  . These persist across sessions and inform future answers.
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Scope:</span>{" "}
                  per-user, persistent. Surfaced as context on every chat turn.
                </p>
              </div>
            </div>
          </div>

          {/* Layer 3 */}
          <div className="rounded-lg bg-muted/40 p-6">
            <div className="flex items-start gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Database className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Layer 3
                </p>
                <h3 className="text-lg font-semibold text-foreground">
                  Knowledge base (RAG)
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Every email, meeting transcript, document, contract, and
                  Acumatica record gets chunked and embedded into the{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">
                    document_chunks
                  </code>{" "}
                  vector store (text-embedding-3-large, halfvec 3072). When you
                  ask a question, semantic search returns the most relevant
                  chunks as evidence.
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Scope:</span>{" "}
                  org-wide. Sourced from Outlook, Teams, Fireflies, Acumatica,
                  and uploaded files.
                </p>
              </div>
            </div>
          </div>

          <Link
            href="/docs/ai-overview/data-sources"
            className="inline-flex items-center gap-1 text-sm text-primary"
          >
            Read more about data sources
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </Section>

      {/* Section 3 — Policy */}
      <Section eyebrow="Policy" title="What gets remembered, what doesn't">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Remembered */}
          <div className="rounded-lg bg-muted/40 p-5">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">
                Remembered
              </h3>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-foreground">·</span>
                <span>Decisions made in conversation (&ldquo;we agreed to bill monthly&rdquo;)</span>
              </li>
              <li className="flex gap-2">
                <span className="text-foreground">·</span>
                <span>Recurring project context (active project IDs, key dates)</span>
              </li>
              <li className="flex gap-2">
                <span className="text-foreground">·</span>
                <span>User preferences (terse vs. verbose, formats, time zones)</span>
              </li>
              <li className="flex gap-2">
                <span className="text-foreground">·</span>
                <span>Reference pointers (which Linear project, which Slack channel)</span>
              </li>
            </ul>
          </div>

          {/* Discarded */}
          <div className="rounded-lg bg-muted/40 p-5">
            <div className="flex items-center gap-2">
              <X className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">
                Discarded
              </h3>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-foreground">·</span>
                <span>Personal information not relevant to the work</span>
              </li>
              <li className="flex gap-2">
                <span className="text-foreground">·</span>
                <span>Transient tool errors and retry chatter</span>
              </li>
              <li className="flex gap-2">
                <span className="text-foreground">·</span>
                <span>Casual conversation that doesn&apos;t change the system state</span>
              </li>
              <li className="flex gap-2">
                <span className="text-foreground">·</span>
                <span>Anything contradicted by a later message in the same turn</span>
              </li>
            </ul>
          </div>
        </div>
      </Section>
    </div>
    </PageShell>
  );
}

function StatBlock({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div className="rounded-lg bg-muted/40 p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-foreground">
        {value}
      </p>
      {suffix ? (
        <p
          className="mt-1 text-xs text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: suffix }}
        />
      ) : null}
    </div>
  );
}
