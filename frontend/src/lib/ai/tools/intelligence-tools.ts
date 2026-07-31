import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { loadCurrentIntelligencePacket } from "@/lib/ai/intelligence/packet-service";
import { PACKET_STALE_AFTER_HOURS } from "@/lib/ai/intelligence/types";
import { defineReadTool, type ToolTracePayload } from "./tool-utils";
import { type ToolContext } from "./tool-context";

export type IntelligenceToolsOptions = {
  onTrace?: (trace: ToolTracePayload) => void;
  // Injected data seam; defaults to building a real context when omitted.
  ctx?: ToolContext;
};

const DOMAIN_INTELLIGENCE_ERROR_GUIDANCE =
  "Domain intelligence lookup failed. Tell the user the domain was unreachable rather than fabricating a synthesis. Continue with raw retrieval tools (searchMeetings, searchEmails, getRecentEmails) instead.";

const LIST_DOMAINS_ERROR_GUIDANCE =
  "Could not list available intelligence domains. Tell the user the catalog was unreachable rather than guessing domain names.";

function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function createIntelligenceTools(options: IntelligenceToolsOptions = {}) {
  const db = options.ctx?.db ?? createServiceClient();
  return {
    listDomainIntelligence: defineReadTool("listDomainIntelligence", options, {
      description:
        "List the cross-project business domains that have pre-built intelligence syntheses available. " +
        "Call this first when the user asks a broad operational question ('what's going on with accounting?', " +
        "'how are operations?', 'what's happening in BD?') so you know which domain slug to pass to " +
        "getDomainIntelligence. Returns slug, name, and description for each active domain.",
      inputSchema: z.object({}),
      errorGuidance: LIST_DOMAINS_ERROR_GUIDANCE,
      execute: async () => {
        const supabase = db;
        const { data, error } = await supabase
          .from("intelligence_targets")
          .select("slug, name, description, priority, last_signal_at")
          .eq("target_type", "company_process")
          .eq("status", "active")
          .order("priority", { ascending: true })
          .order("name", { ascending: true });

        if (error) {
          throw new Error(`Failed to list domain intelligence targets: ${error.message}`);
        }

        return {
          domains: (data ?? []).map((row) => ({
            slug: row.slug,
            name: row.name,
            description: row.description,
            priority: row.priority,
            lastSignalAt: row.last_signal_at,
          })),
        };
      },
    }),

    getDomainIntelligence: defineReadTool("getDomainIntelligence", options, {
      description:
        "Pull the pre-built intelligence synthesis for a business domain (e.g. 'accounting', 'operations', " +
        "'business-development', 'people-talent'). Returns the executive summary, current status, strategic " +
        "read, recommended next moves, and the list of recurring findings (insight cards) with their " +
        "first-seen/last-seen dates and source counts. " +
        "USE THIS FIRST for broad operational questions like 'what's going on with accounting?' before falling " +
        "back to raw retrieval. The synthesis is refreshed multiple times per day; combine it with raw tools " +
        "(searchMeetings, searchEmails, getRecentEmails) for today's live data not yet captured in the packet. " +
        "If the domain doesn't exist or has no packet yet, the response says so — do not invent one.",
      inputSchema: z.object({
        domain: z
          .string()
          .min(2)
          .describe(
            "Domain slug or close name. Examples: 'accounting', 'operations', 'business-development', 'people-talent'. " +
              "Hyphens and case are normalized.",
          ),
      }),
      errorGuidance: DOMAIN_INTELLIGENCE_ERROR_GUIDANCE,
      execute: async ({ domain }) => {
        const supabase = db;
        const normalized = normalizeSlug(domain);

        // Try exact slug match, then fall back to name ILIKE.
        const slugLookup = await supabase
          .from("intelligence_targets")
          .select("id, slug, name, description, target_type, status, last_signal_at, metadata")
          .eq("target_type", "company_process")
          .eq("slug", normalized)
          .maybeSingle();

        if (slugLookup.error) {
          throw new Error(`Failed to look up domain target: ${slugLookup.error.message}`);
        }
        let target = slugLookup.data;

        if (!target) {
          const { data: nameMatch, error: nameError } = await supabase
            .from("intelligence_targets")
            .select("id, slug, name, description, target_type, status, last_signal_at, metadata")
            .eq("target_type", "company_process")
            .eq("status", "active")
            .ilike("name", `%${domain}%`)
            .limit(1)
            .maybeSingle();
          if (nameError) {
            throw new Error(`Failed to look up domain target by name: ${nameError.message}`);
          }
          target = nameMatch;
        }

        if (!target) {
          return {
            found: false,
            requestedDomain: domain,
            normalizedSlug: normalized,
            message:
              "No intelligence target exists for this domain. Call listDomainIntelligence to see what's available, or fall back to raw retrieval tools.",
          };
        }

        const packet = await loadCurrentIntelligencePacket({
          targetId: target.id,
          supabase,
          includeSourcePreview: true,
        });

        if (!packet) {
          return {
            found: true,
            hasPacket: false,
            domain: {
              slug: target.slug,
              name: target.name,
              description: target.description,
            },
            message:
              "The domain target exists but has no synthesized packet yet. The compiler hasn't produced one — fall back to raw retrieval tools (searchMeetings, searchEmails) for this domain.",
          };
        }

        const cards = packet.cards.map((card) => ({
          id: card.id,
          title: card.title,
          cardType: card.cardType,
          summary: card.summary,
          whyItMatters: card.whyItMatters,
          currentStatus: card.currentStatus,
          confidence: card.confidence,
          nextAction: card.nextAction,
          sourceCount: card.sourceCount,
          firstSeenAt: (card as unknown as { firstSeenAt?: string | null }).firstSeenAt ?? null,
          lastSeenAt: (card as unknown as { lastSeenAt?: string | null }).lastSeenAt ?? null,
          topEvidence: card.evidence.slice(0, 3).map((ev) => ({
            sourceType: ev.sourceType,
            sourceTitle: ev.sourceTitle,
            sourceOccurredAt: ev.sourceOccurredAt,
            excerpt: ev.excerpt ?? ev.summary,
            relevanceReason: ev.relevanceReason,
          })),
        }));

        return {
          found: true,
          hasPacket: true,
          domain: {
            slug: target.slug,
            name: target.name,
            description: target.description,
          },
          packet: {
            generatedAt: packet.generatedAt,
            ageHours: packet.ageHours,
            isStale: packet.isStale,
            staleAfterHours: PACKET_STALE_AFTER_HOURS,
            freshnessStatus: packet.freshnessStatus,
            coveredStartAt: packet.coveredStartAt,
            coveredEndAt: packet.coveredEndAt,
            executiveSummary: packet.executiveSummary,
            currentStatus: packet.currentStatus,
            strategicRead: packet.strategicRead,
            whyItMatters: packet.whyItMatters,
            recommendedNextMoves: packet.recommendedNextMoves,
            confidenceSummary: packet.confidenceSummary,
          },
          recurringFindings: cards,
          guidance:
            packet.isStale || packet.freshnessStatus !== "fresh"
              ? "Packet is stale or partial. Use the synthesis as background but verify recent claims with raw retrieval tools (searchMeetings, searchEmails, getRecentEmails) for the last 24-48 hours."
              : "Packet is fresh. Layer in today's raw data (searchMeetings, searchEmails, getRecentEmails) only if the user's question targets activity not yet in the synthesis.",
        };
      },
    }),
  };
}
