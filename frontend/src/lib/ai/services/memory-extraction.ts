/**
 * Memory Extraction Service
 *
 * Post-conversation: uses gpt-4.1-nano to analyze the conversation and
 * extract durable memories worth storing across sessions. Runs in the
 * chat route's after() hook alongside generateConversationMemory().
 *
 * Extracts typed memories (fact, preference, lesson, commitment, context)
 * and stores them via writeMemory() with embeddings.
 */

import { generateText, Output } from "ai";
import { z } from "zod";
import { serviceDb } from "@/lib/supabase/service-db";
import { writeMemory, type MemoryType } from "./ai-memory-service";
import { getLanguageModel } from "../providers";
import { toSessionUuid } from "@/lib/ai/session-id";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_MESSAGES = 40;
const MAX_CHARS_PER_MESSAGE = 1500;
const MIN_MESSAGES_TO_EXTRACT = 4;
const MIN_IMPORTANCE_TO_STORE = 0.3;

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

const extractedMemorySchema = z.object({
  memories: z
    .array(
      z.object({
        type: z.enum(["fact", "preference", "lesson", "commitment", "context"]),
        content: z
          .string()
          .min(10)
          .describe("One or two specific sentences worth remembering."),
        importance: z
          .number()
          .min(0.1)
          .max(1)
          .describe("How valuable this memory is across future sessions."),
        confidence: z
          .number()
          .min(0.1)
          .max(1)
          .describe("How certain the model is that the memory is accurate."),
      }),
    )
    .max(5)
    .describe("Durable memories extracted from the conversation. Empty when nothing is worth storing."),
});

type ExtractedMemory = z.infer<typeof extractedMemorySchema>["memories"][number];

async function extractMemoriesFromTranscript(
  transcript: string,
): Promise<ExtractedMemory[]> {
  const result = await generateText({
    model: getLanguageModel("openai/gpt-4.1-nano"),
    output: Output.object({
      schema: extractedMemorySchema,
      name: "durable_memories",
      description:
        "Durable memories extracted from an AI assistant conversation.",
    }),
    instructions: `You extract durable memories from AI assistant conversations in a construction project management platform.

Return structured output with a memories array. Each memory has:
- type: "fact" | "preference" | "lesson" | "commitment" | "context"
- content: 1-2 sentence memory (specific, include names/numbers/dates when available)
- importance: 0.1-1.0 (how valuable is this across future sessions?)
- confidence: 0.1-1.0 (how certain you are this is accurate)

Type definitions:
- fact: Objective facts about projects, people, or the company
  Examples: "Brandon Clymer is the PM on Vermillion Rise Warehouse"
            "The Westfield Collection project is at 85% complete with a $8.2M GMP"
- preference: How this user likes information presented or how they work
  Examples: "User prefers bullet-point financial summaries over prose paragraphs"
            "User wants to see action items grouped by project, not by date"
- lesson: A pattern or institutional knowledge worth remembering
  Examples: "Westfield change events consistently get priced late — check proactively before OAC meetings"
            "This team has recurring subcontractor procurement delays on drywall trades"
- commitment: A specific commitment that needs future tracking
  Examples: "Brandon committed to sending ROM estimates for Vermillion Rise by March 15, 2026"
            "Owner decision on Westfield Phase 2 scope pending — due end of Q1 2026"
- context: Situational context worth carrying into next session
  Examples: "User is under pressure on the Westfield GMP negotiation — prioritize financial data"
            "User preparing for investor presentation next week — portfolio health is top priority"

Rules:
- Only extract things worth remembering ACROSS future sessions
- Skip transient operational queries ("show me the budget" is not a memory)
- Preferences are gold — always capture them with high importance
- Be specific: include project names, dollar amounts, dates, people's names
- Commitments need a clear owner and deadline to be worth storing
- Return an empty memories array if nothing meaningful should be stored
- Max 5 memories per conversation
`,
    prompt: `Extract durable memories from this construction PM conversation:\n\n${transcript}`,
  });

  return result.output.memories;
}

// ---------------------------------------------------------------------------
// Orchestrator (called from chat route's after() hook)
// ---------------------------------------------------------------------------

/**
 * Extract and store durable memories from a completed conversation.
 * Runs post-response — zero user-facing latency.
 *
 * @param sessionId - The conversation session ID
 * @param userId - The authenticated user's ID
 */
export async function extractAndStoreMemories(
  sessionId: string,
  userId: string,
): Promise<void> {

  const sessionUuid = toSessionUuid(sessionId);

  // Fetch conversation messages
  const { data: messages, error } = await serviceDb.from("chat_history")
    .select("role, content")
    .eq("session_id", sessionUuid)
    .order("created_at", { ascending: false })
    .limit(MAX_MESSAGES);

  if (error) {
    throw new Error(`Failed to fetch chat history for memory extraction: ${error.message}`);
  }
  if (!messages) return;

  const valid = [...messages].reverse().filter((m) => m.content?.trim());
  if (valid.length < MIN_MESSAGES_TO_EXTRACT) return;

  const transcript = valid
    .map(
      (m) =>
        `${m.role === "user" ? "User" : "AI"}: ${m.content!.substring(0, MAX_CHARS_PER_MESSAGE)}`,
    )
    .join("\n\n");

  const extracted = await extractMemoriesFromTranscript(transcript);
  if (extracted.length === 0) return;

  const memoryWrites = extracted
    .filter((m) => m.importance >= MIN_IMPORTANCE_TO_STORE)
    .map(async (memory) => {
      const result = await writeMemory({
        userId,
        type: memory.type as MemoryType,
        content: memory.content.trim(),
        confidence: Math.min(1, Math.max(0, memory.confidence ?? 0.8)),
        importance: Math.min(1, Math.max(0, memory.importance ?? 0.5)),
        source: "extraction",
        // Facts and lessons about projects benefit the whole team
        visibility:
          memory.type === "fact" || memory.type === "lesson" ? "team" : "private",
      });

      if ("error" in result) {
        throw new Error(`Failed to store extracted ${memory.type} memory: ${result.error}`);
      }

      return result;
    });

  if (memoryWrites.length === 0) return;

  const results = await Promise.allSettled(memoryWrites);
  const failures = results
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map((result) => result.reason instanceof Error ? result.reason.message : String(result.reason));

  if (failures.length > 0) {
    throw new Error(`Extracted memory write failures: ${failures.join("; ")}`);
  }
}
