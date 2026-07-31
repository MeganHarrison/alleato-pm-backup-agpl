import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export type TaskOriginPath = "api" | "deep_read" | "brandon_backfill";

export type TaskDeduplicationSource = {
  title: string;
  description?: string | null;
  assignee_name?: string | null;
  assignee_email?: string | null;
  assignee_person_id?: string | null;
  project_id?: number | null;
  priority?: string | null;
  due_date?: string | null;
  metadata_id?: string | null;
  source_system?: string | null;
  extraction_metadata?: Record<string, unknown> | null;
  origin: TaskOriginPath;
};

export type TaskDeduplicationMatch = {
  match_type: "exact" | "high_similarity" | "none";
  confidence: number;
  existing_task_id?: string;
  merged_task_id?: string;
  reason: string;
};

/**
 * Normalize task titles by:
 * - Converting to lowercase
 * - Removing time/date references
 * - Stripping extra whitespace
 * - Removing punctuation at end
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    // Remove common time/date patterns
    .replace(/\b(?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, "")
    .replace(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*\d{1,2}\b/gi, "")
    .replace(/\d{1,2}\/\d{1,2}\/\d{2,4}/g, "")
    .replace(/\d{4}-\d{2}-\d{2}/g, "")
    // Remove times like 10:30 AM
    .replace(/\d{1,2}:\d{2}\s*(?:am|pm)?/gi, "")
    // Remove extra whitespace
    .replace(/\s+/g, " ")
    .trim()
    // Remove trailing punctuation
    .replace(/[.,:;!?-]*$/, "")
    .trim();
}

/**
 * Extract meaningful tokens from text for fuzzy matching
 */
function extractTokens(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
  return new Set(tokens);
}

/**
 * Calculate similarity between two token sets (Jaccard similarity)
 */
function tokenSimilarity(tokens1: Set<string>, tokens2: Set<string>): number {
  if (tokens1.size === 0 && tokens2.size === 0) return 1;
  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  let overlap = 0;
  for (const token of tokens1) {
    if (tokens2.has(token)) overlap += 1;
  }
  return overlap / Math.max(tokens1.size, tokens2.size);
}

/**
 * Normalize assignee to a canonical form for comparison
 */
function normalizeAssignee(name?: string | null, email?: string | null): string {
  if (email) return email.toLowerCase().trim();
  if (name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return "";
}

/**
 * Common stop words for deduplication
 */
const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "you", "your",
  "brandon", "please", "need", "needs", "should", "send", "provide",
  "review", "confirm", "status", "update", "attached", "email", "thread",
  "is", "are", "was", "be", "to", "in", "on", "at", "by", "of",
]);

/**
 * Check if two tasks are likely duplicates based on content similarity
 */
function areTasksSimilar(
  task1: TaskDeduplicationSource,
  task2: TaskDeduplicationSource,
  minSimilarity: number = 0.75,
): { similar: boolean; score: number; reason: string } {
  const norm1 = normalizeTitle(task1.title);
  const norm2 = normalizeTitle(task2.title);

  // Exact match after normalization
  if (norm1 === norm2) {
    return { similar: true, score: 1.0, reason: "Exact title match after normalization" };
  }

  // Token-based similarity
  const tokens1 = extractTokens(norm1);
  const tokens2 = extractTokens(norm2);
  const tokenScore = tokenSimilarity(tokens1, tokens2);

  if (tokenScore < minSimilarity) {
    return { similar: false, score: tokenScore, reason: `Token similarity ${tokenScore.toFixed(2)} below threshold` };
  }

  // Check assignee match
  const assignee1 = normalizeAssignee(task1.assignee_name, task1.assignee_email);
  const assignee2 = normalizeAssignee(task2.assignee_name, task2.assignee_email);

  if (assignee1 && assignee2 && assignee1 !== assignee2) {
    // Different assignees - lower confidence
    return {
      similar: true,
      score: tokenScore * 0.7,
      reason: `Content similar (${tokenScore.toFixed(2)}) but different assignees`,
    };
  }

  return {
    similar: tokenScore >= minSimilarity,
    score: tokenScore,
    reason: `Content similarity ${tokenScore.toFixed(2)}`,
  };
}

/**
 * Main task deduplication class
 */
export class TaskDeduplicator {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Check for and merge duplicate tasks from different sources
   */
  async deduplicateTask(
    source: TaskDeduplicationSource,
  ): Promise<TaskDeduplicationMatch> {
    // First, check for exact duplicates by metadata_id and title
    if (source.metadata_id && source.title) {
      const exactMatch = await this.findExactDuplicate(source);
      if (exactMatch) {
        return {
          match_type: "exact",
          confidence: 1.0,
          existing_task_id: exactMatch.id,
          reason: `Exact duplicate found with same metadata_id and normalized title`,
        };
      }
    }

    // Check for high-similarity duplicates
    const similarities = await this.findSimilarTasks(source);
    if (similarities.length > 0) {
      const bestMatch = similarities[0];
      if (bestMatch.score >= 0.85) {
        // Merge the tasks
        const mergedId = await this.mergeTasks(source, bestMatch.task);
        return {
          match_type: "high_similarity",
          confidence: bestMatch.score,
          existing_task_id: bestMatch.task.id,
          merged_task_id: mergedId,
          reason: `Merged with high-similarity task (${bestMatch.score.toFixed(2)} confidence)`,
        };
      }
    }

    // No duplicates found
    return {
      match_type: "none",
      confidence: 0,
      reason: "No duplicates detected",
    };
  }

  /**
   * Find an exact duplicate by metadata_id and normalized title
   */
  private async findExactDuplicate(
    source: TaskDeduplicationSource,
  ): Promise<{ id: string } | null> {
    if (!source.metadata_id) return null;

    const normalizedTitle = normalizeTitle(source.title);

    const { data } = await this.supabase
      .from("tasks")
      .select("id, title")
      .eq("metadata_id", source.metadata_id)
      .limit(10);

    if (!data) return null;

    for (const task of data) {
      if (task.title && normalizeTitle(task.title) === normalizedTitle) {
        return { id: task.id };
      }
    }

    return null;
  }

  /**
   * Find similar tasks across the project by content and assignee
   */
  private async findSimilarTasks(
    source: TaskDeduplicationSource,
  ): Promise<Array<{ task: Record<string, unknown>; score: number }>> {
    const { data: tasks } = await this.supabase
      .from("tasks")
      .select("id, title, description, assignee_name, assignee_email, assignee_person_id, project_id, priority, source_system")
      .eq("status", "open")
      .limit(100);

    if (!tasks || tasks.length === 0) return [];

    const scored = tasks
      .map((task: Record<string, unknown>) => {
        const similarity = areTasksSimilar(source, {
          title: (task.title as string) || "",
          description: task.description as string | null | undefined,
          assignee_name: task.assignee_name as string | null | undefined,
          assignee_email: task.assignee_email as string | null | undefined,
          assignee_person_id: task.assignee_person_id as string | null | undefined,
          project_id: task.project_id as number | null | undefined,
          priority: task.priority as string | null | undefined,
          source_system: task.source_system as string | null | undefined,
          origin: "api",
        });

        return { task: task as Record<string, unknown>, score: similarity.score };
      })
      .filter(({ score }) => score >= 0.75)
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, 5);
  }

  /**
   * Merge duplicate tasks, consolidating metadata and references
   */
  private async mergeTasks(
    source: TaskDeduplicationSource,
    existing: Record<string, unknown>,
  ): Promise<string> {
    const mergedMetadata = {
      ...(existing.extraction_metadata as Record<string, unknown> | undefined),
      deduplication: {
        merged_from_source: source.origin,
        merged_at: new Date().toISOString(),
        merge_reason: "duplicate_task_consolidation",
      },
    };

    // Update the existing task with merged metadata and best title
    const existingTitle = existing.title as string | null | undefined;
    const bestTitle = normalizeTitle(source.title).length > normalizeTitle(existingTitle || "").length
      ? source.title
      : existingTitle;

    await this.supabase
      .from("tasks")
      .update({
        extraction_metadata: mergedMetadata,
        title: bestTitle,
      })
      .eq("id", existing.id as string);

    return existing.id as string;
  }

  /**
   * Resolve assignee consistently across all sources
   */
  async resolveAssignee(
    assignee_name?: string | null,
    assignee_email?: string | null,
  ): Promise<{
    person_id: string | null;
    name: string | null;
    email: string | null;
    confidence: number;
  }> {
    // Try email first
    if (assignee_email) {
      const { data: byEmail } = await this.supabase
        .from("people")
        .select("id, first_name, last_name, email")
        .ilike("email", assignee_email)
        .limit(1)
        .maybeSingle();

      if (byEmail) {
        const name = [byEmail.first_name, byEmail.last_name]
          .filter(Boolean)
          .join(" ")
          .trim() || null;
        return {
          person_id: byEmail.id,
          name,
          email: byEmail.email,
          confidence: 1.0,
        };
      }
    }

    // Try name
    if (assignee_name) {
      const normalized = assignee_name.toLowerCase().trim();
      const { data: byName } = await this.supabase
        .from("people")
        .select("id, first_name, last_name, email")
        .ilike("first_name", `%${normalized}%`)
        .or(`last_name.ilike.%${normalized}%`)
        .limit(5);

      if (byName && byName.length > 0) {
        // Find the best match
        const best = byName[0];
        const name = [best.first_name, best.last_name]
          .filter(Boolean)
          .join(" ")
          .trim() || null;
        return {
          person_id: best.id,
          name,
          email: best.email,
          confidence: byName.length === 1 ? 0.95 : 0.7,
        };
      }
    }

    // Unresolved
    return {
      person_id: null,
      name: assignee_name || null,
      email: assignee_email || null,
      confidence: 0,
    };
  }

  /**
   * Resolve project consistently across all sources
   */
  async resolveProject(
    project_id?: number | null,
    projectName?: string | null,
  ): Promise<{
    project_id: number | null;
    name: string | null;
    confidence: number;
  }> {
    // If we have a project_id, use it
    if (project_id) {
      const { data } = await this.supabase
        .from("projects")
        .select("id, name")
        .eq("id", project_id)
        .limit(1)
        .maybeSingle();

      if (data) {
        return {
          project_id: data.id,
          name: data.name,
          confidence: 1.0,
        };
      }
    }

    // Try to find by name
    if (projectName) {
      const { data } = await this.supabase
        .from("projects")
        .select("id, name")
        .ilike("name", `%${projectName}%`)
        .eq("archived", false)
        .limit(1)
        .maybeSingle();

      if (data) {
        return {
          project_id: data.id,
          name: data.name,
          confidence: 0.85,
        };
      }
    }

    return {
      project_id: null,
      name: projectName || null,
      confidence: 0,
    };
  }

  /**
   * Calculate a quality score for a deduplication match
   */
  calculateQualityScore(match: TaskDeduplicationMatch): number {
    if (match.match_type === "exact") return 1.0;
    if (match.match_type === "high_similarity") return match.confidence;
    return 0;
  }
}

/**
 * Factory function to create a task deduplicator instance
 */
export function createTaskDeduplicator(supabase: SupabaseClient<Database>): TaskDeduplicator {
  return new TaskDeduplicator(supabase);
}
