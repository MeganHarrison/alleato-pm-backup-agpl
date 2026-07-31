import "server-only";

import { serviceDb } from "@/lib/supabase/service-db";

import {
  listDailyExecutiveBriefPackets,
  type CanonicalDailyBriefPacket,
} from "./canonical-packets";

const RAG_BATCH_SIZE = 100;
const TERMINAL_RAG_STATUSES = new Set([
  "intentionally_excluded",
  "deleted_no_transcript",
  "metadata_only",
  "not_vectorizable",
  "skipped",
  "skipped_low_content",
  "graph_content_missing",
  "graph_content_empty",
  "no_chunks",
  "ocr_failed",
]);

export type AdminDailyBriefHistoryItem = {
  id: string;
  businessDate: string;
  packetType: string;
  generatedAt: string | null;
  compilerVersion: string | null;
  briefFormat: "structured" | "legacy";
  sourceCount: number;
  embeddedSourceCount: number;
  terminalSourceCount: number;
  missingSourceCount: number;
};

type RagSourceStatus = {
  id: string;
  embedding_status: string | null;
  parsing_status: string | null;
};

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

function isTerminal(row: RagSourceStatus): boolean {
  return (
    TERMINAL_RAG_STATUSES.has(row.embedding_status ?? "") ||
    TERMINAL_RAG_STATUSES.has(row.parsing_status ?? "")
  );
}

function packetSourceIds(packet: CanonicalDailyBriefPacket): string[] {
  return packet.sourceIds.length > 0
    ? packet.sourceIds
    : packet.sources.map((source) => source.id);
}

function toAdminHistoryItem(
  packet: CanonicalDailyBriefPacket,
  ragRows: Map<string, RagSourceStatus>,
): AdminDailyBriefHistoryItem {
  let embeddedSourceCount = 0;
  let terminalSourceCount = 0;
  const sourceIds = packetSourceIds(packet);

  for (const sourceId of sourceIds) {
    const row = ragRows.get(sourceId);
    if (!row) continue;
    if (isTerminal(row)) {
      terminalSourceCount += 1;
    } else if (row.embedding_status === "embedded") {
      embeddedSourceCount += 1;
    }
  }

  return {
    id: packet.id,
    businessDate: packet.businessDate,
    packetType: packet.packetType,
    generatedAt: packet.generatedAt,
    compilerVersion: packet.compilerVersion,
    briefFormat: packet.brief ? "structured" : "legacy",
    sourceCount: sourceIds.length,
    embeddedSourceCount,
    terminalSourceCount,
    missingSourceCount:
      sourceIds.length - embeddedSourceCount - terminalSourceCount,
  };
}

/**
 * Admin-only packet history. Unlike executive history, this preserves every
 * packet revision so operators can audit current and snapshot technical state.
 */
export async function listAdminDailyBriefHistory(): Promise<AdminDailyBriefHistoryItem[]> {
  const packets = await listDailyExecutiveBriefPackets();
  const sourceIds = [...new Set(packets.flatMap(packetSourceIds))];
  const ragRows = new Map<string, RagSourceStatus>();

  for (const batch of chunk(sourceIds, RAG_BATCH_SIZE)) {
    const { data, error } = await serviceDb
      .from("rag_document_metadata")
      .select("id,embedding_status,parsing_status")
      .in("id", batch);
    if (error) {
      throw new Error(`Daily Brief admin RAG readback failed: ${error.message}`);
    }
    for (const row of data ?? []) {
      ragRows.set(row.id, row);
    }
  }

  return packets.map((packet) => toAdminHistoryItem(packet, ragRows));
}
