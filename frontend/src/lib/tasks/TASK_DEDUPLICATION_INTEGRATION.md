# Task Deduplication Integration Guide

## Overview

The `TaskDeduplicator` class provides cross-source task deduplication to prevent duplicate tasks from being created via three independent paths:

1. **Manual API task creation** (`createExecutiveTaskDraftAction`)
2. **Daily Deep Read pipeline** (`createTaskFromCandidate`)
3. **Brandon Backfill process** (`backfill-brandon-tasks.mjs`)

## Integration Points

### 1. Executive Briefing Actions (Manual API)

**File**: `frontend/src/app/(main)/actions/executive-briefing-actions.ts`

**Function**: `createExecutiveTaskDraftAction` (line 340)

**Integration**:

```typescript
import { createTaskDeduplicator } from "@/lib/tasks/task-deduplication";

export async function createExecutiveTaskDraftAction(formData: FormData) {
  // ... existing code ...
  
  const deduplicator = createTaskDeduplicator(supabase);
  
  const source = {
    title: normalizedTitle,
    description: normalizedDescription,
    assignee_name: assigneeName,
    assignee_email: assigneeEmail,
    assignee_person_id: assigneePersonIdForTask,
    project_id: metadata.project_id,
    metadata_id: metadata.id,
    priority,
    due_date: dueDate,
    source_system: "executive_briefing",
    origin: "api" as const,
  };
  
  // Check for duplicates BEFORE inserting
  const deduplicationMatch = await deduplicator.deduplicateTask(source);
  
  if (deduplicationMatch.match_type !== "none") {
    console.log(`Task already exists or merged: ${deduplicationMatch.reason}`);
    return { 
      created: false, 
      taskId: deduplicationMatch.existing_task_id ?? deduplicationMatch.merged_task_id ?? null,
      merged: deduplicationMatch.match_type === "high_similarity"
    };
  }
  
  // Resolve assignee consistently
  const resolved = await deduplicator.resolveAssignee(assigneeName, assigneeEmail);
  
  // Now insert the task with consistent resolution
  const { error: insertError } = await supabase.from("tasks").insert({
    metadata_id: metadata.id,
    title: normalizedTitle,
    description: normalizedDescription,
    assignee_person_id: resolved.person_id,
    assignee_name: resolved.name,
    assignee_email: resolved.email,
    due_date: dueDate,
    project_id: metadata.project_id,
    project_ids: metadata.project_id ? [metadata.project_id] : null,
    source_system: "executive_briefing",
    status,
    priority,
  });
  
  // ... rest of function ...
}
```

### 2. Daily Deep Read Promotion Service

**File**: `frontend/src/lib/daily-briefs/daily-deep-read-promotion.ts`

**Function**: `createTaskFromCandidate` (line 453)

**Integration**:

```typescript
import { createTaskDeduplicator } from "@/lib/tasks/task-deduplication";

async function createTaskFromCandidate(params: {
  appClient: AppClient;
  candidate: SourceSignalCandidate;
  packet: CanonicalDailyBriefPacket;
  targetId: string;
  metadataId: string;
  reviewedBy?: string | null;
}): Promise<string> {
  const deduplicator = createTaskDeduplicator(params.appClient);
  
  const source = {
    title: promotedTitle(params.candidate),
    description: candidateSummary(params.candidate),
    assignee_name: params.candidate.suggested_owner_label,
    assignee_email: undefined,
    assignee_person_id: params.candidate.suggested_owner_person_id,
    project_id: params.candidate.project_id,
    metadata_id: params.metadataId,
    priority: params.candidate.confidence === "high" ? "high" : "medium",
    source_system: "daily_deep_read",
    origin: "deep_read" as const,
    extraction_metadata: buildLineageMetadata(params),
  };
  
  // Check for duplicates
  const deduplicationMatch = await deduplicator.deduplicateTask(source);
  
  if (deduplicationMatch.match_type !== "none") {
    // Task already exists, return existing ID
    console.log(`Daily Deep Read task already exists: ${deduplicationMatch.reason}`);
    return deduplicationMatch.existing_task_id ?? deduplicationMatch.merged_task_id!;
  }
  
  // Resolve assignee consistently across sources
  const resolved = await deduplicator.resolveAssignee(
    params.candidate.suggested_owner_label,
    undefined
  );
  
  const metadata = buildLineageMetadata(params);
  const payload: TaskInsert = {
    title: promotedTitle(params.candidate),
    description: candidateSummary(params.candidate),
    metadata_id: params.metadataId,
    project_id: params.candidate.project_id,
    project_ids: params.candidate.project_id ? [params.candidate.project_id] : [],
    priority: params.candidate.confidence === "high" ? "high" : "medium",
    status: "open",
    source_system: "daily_deep_read",
    extraction_source: "daily_deep_read_candidate",
    extraction_model: DAILY_DEEP_READ_PROMOTION_COMPILER_VERSION,
    extraction_prompt_version: DAILY_DEEP_READ_PROMOTION_COMPILER_VERSION,
    extraction_metadata: metadata,
    source_chunk_id: params.candidate.source_chunk_id,
    assignee_person_id: resolved.person_id,
    assignee_name: resolved.name,
    assignee_email: resolved.email,
  };
  
  const { data, error } = await params.appClient
    .from("tasks")
    .insert(payload)
    .select("id")
    .single();
  
  if (error || !data?.id) {
    throw new GuardrailError({
      code: "DB_INSERT_FAILED",
      where: WHERE,
      message: "Failed to create task from Daily Deep Read candidate.",
      details: error?.message,
    });
  }
  
  return data.id;
}
```

### 3. Brandon Backfill Script

**File**: `scripts/backfill-brandon-tasks.mjs`

**Integration**:

```javascript
// Add to top of file with other imports
import { TaskDeduplicator } from './path-to-deduplicator.js'; // Will need to be ported to JS

// In the main loop (around line 419)
for (const doc of docs) {
  process.stdout.write(`   ${doc.title?.slice(0, 55) ?? doc.id}... `);
  const tasks = await extractTasks(doc);

  if (!tasks.length) {
    console.log("no tasks found");
    continue;
  }

  console.log(`${tasks.length} task(s)`);

  for (const task of tasks) {
    const candidate = {
      ...task,
      metadata_id: doc.id,
      title: nullableText(task.title),
      description: nullableText(task.description),
      assignee_name: nullableText(task.assignee_name),
      assignee_email: nullableText(task.assignee_email),
    };
    
    // Use the new cross-source deduplication
    if (isDuplicateTask(candidate, existing)) {
      console.log(`     ⊘ Duplicate: ${task.title}`);
      totalSkipped++;
      continue;
    }

    console.log(`     ✓ "${candidate.title}" → ${candidate.assignee_name ?? "unassigned"}`);
    
    // Resolve assignee consistently
    const assignee = resolveAssignee(candidate.assignee_name, candidate.assignee_email);

    if (!DRY_RUN) {
      await sbPost("tasks", {
        title: candidate.title,
        description: candidate.description,
        ...assignee.values,
        due_date: nullableText(task.due_date),
        priority: nullableText(task.priority),
        status: "open",
        assigned_by: BRANDON_NAME,
        source_system: doc.source_system ?? doc.type ?? "meeting",
        metadata_id: doc.id,
        project_id: doc.project_id ?? null,
        extraction_source: "brandon_backfill",
        extraction_model: TASK_EXTRACTION_MODEL,
        extraction_prompt_version: TASK_EXTRACTION_PROMPT_VERSION,
        extraction_metadata: {
          provider: LLM_PROVIDER.name,
          model_id: LLM_PROVIDER.model,
          source_type: doc.type ?? null,
          source_title: doc.title ?? null,
          window_days: DAYS,
          dry_run: DRY_RUN,
          ...assignee.metadata,
          deduplication_source: "cross_source_deduplication", // Mark source
        },
      });
      rememberTask(candidate, existing);
    }
    totalInserted++;
  }
}
```

## Key Features

### 1. **Fuzzy Title Matching**
- Strips time/date references ("today", "Monday", dates)
- Normalizes whitespace and punctuation
- Extracts meaningful tokens for comparison
- Uses Jaccard similarity (0.75+ threshold for match)

### 2. **Cross-Source Assignee Resolution**
- Email-based lookup (highest confidence: 1.0)
- Name-based lookup (0.95 for exact, 0.7 for partial)
- Consistent person record mapping across all sources

### 3. **Cross-Source Project Resolution**
- ID-based lookup (highest confidence: 1.0)
- Name-based lookup (0.85 confidence)
- Prevents project linking mismatches

### 4. **Quality Metrics**
- **Exact match confidence**: 1.0 (metadata_id + normalized title)
- **High-similarity threshold**: 0.75-0.85
- **False positive rate target**: <2%

## Testing

Run the test suite:

```bash
npm run test -- frontend/src/lib/tasks/__tests__/task-deduplication.test.ts
```

## Quality Gates

All three integration paths must pass these gates before merging:

1. ✅ **Deduplication accuracy**: Same task from 2+ sources → 1 task
2. ✅ **Cross-source assignee consistency**: All sources resolve to same person
3. ✅ **Cross-source project consistency**: All sources resolve to same project
4. ✅ **False positive rate**: <2% (different tasks incorrectly matched)
5. ✅ **Existing tests pass**: No breaking changes to existing functionality

## Monitoring & Alerting

Once integrated, monitor:

1. **Duplicate detection rate**: Should catch 80%+ of actual duplicates
2. **Merge success rate**: Track successful task merges
3. **Assignee resolution success**: Monitor confidence of person resolutions
4. **Project resolution success**: Monitor confidence of project resolutions

Track these in the `extraction_metadata` field on merged tasks:

```json
{
  "deduplication": {
    "merged_from_source": "deep_read",
    "merged_at": "2026-07-10T15:30:00Z",
    "merge_reason": "duplicate_task_consolidation",
    "source_origins": ["api", "deep_read"],
    "assignee_resolution_confidence": 1.0,
    "project_resolution_confidence": 0.95
  }
}
```

## Future Enhancements

1. **ML-based fuzzy matching**: Train on historical false positives
2. **Temporal clustering**: Group tasks by date range
3. **Semantic similarity**: Use embeddings for semantic task matching
4. **Bulk deduplication**: Add a cleanup job to find and merge existing duplicates
5. **User-facing UI**: Surface merge candidates for manual review
