import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueDocumentPipeline } from "@/lib/rag-pipeline/enqueue";
import { createRagServiceClient } from "@/lib/supabase/service";

import type { Database } from "@/types/rag-database.types";

type RagClient = SupabaseClient<Database>;

export type DocumentPipelineTriggerResult = {
  queued: boolean;
  message: string | null;
};

async function recordPipelineTriggerFailure(
  supabase: RagClient,
  metadataId: string,
  message: string,
): Promise<void> {
  const truncated = message.slice(0, 500);
  const { data: existing } = await supabase
    .from("fireflies_ingestion_jobs")
    .select("fireflies_id")
    .eq("metadata_id", metadataId)
    .limit(1)
    .maybeSingle();

  if (existing?.fireflies_id) {
    await supabase
      .from("fireflies_ingestion_jobs")
      .update({ error_message: truncated })
      .eq("fireflies_id", existing.fireflies_id);
    return;
  }

  await supabase
    .from("fireflies_ingestion_jobs")
    .upsert(
      {
        fireflies_id: metadataId,
        metadata_id: metadataId,
        stage: "raw_ingested",
        error_message: truncated,
      },
      { onConflict: "fireflies_id" },
    );
}

async function clearPipelineTriggerFailure(
  supabase: RagClient,
  metadataId: string,
): Promise<void> {
  const { data: existing } = await supabase
    .from("fireflies_ingestion_jobs")
    .select("fireflies_id")
    .eq("metadata_id", metadataId)
    .limit(1)
    .maybeSingle();

  if (existing?.fireflies_id) {
    await supabase
      .from("fireflies_ingestion_jobs")
      .update({ error_message: null })
      .eq("fireflies_id", existing.fireflies_id);
    return;
  }

  await supabase
    .from("fireflies_ingestion_jobs")
    .upsert(
      {
        fireflies_id: metadataId,
        metadata_id: metadataId,
        stage: "raw_ingested",
        error_message: null,
      },
      { onConflict: "fireflies_id" },
    );
}

export async function triggerDocumentPipeline(
  metadataId: string,
): Promise<DocumentPipelineTriggerResult> {
  const supabase = createRagServiceClient();

  try {
    await enqueueDocumentPipeline({ documentId: metadataId });

    await clearPipelineTriggerFailure(supabase, metadataId);
    return {
      queued: true,
      message: null,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? `Pipeline enqueue failed: ${error.message}`
        : "Pipeline enqueue failed.";
    await recordPipelineTriggerFailure(supabase, metadataId, message);
    return {
      queued: false,
      message,
    };
  }
}
