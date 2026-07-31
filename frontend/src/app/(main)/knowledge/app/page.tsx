import { AppTrainingDocsPage } from "@/features/knowledge/app-training-docs-page";
import { createServiceClient } from "@/lib/supabase/service";
import { listPublishedTrainingDocs } from "@/lib/training-docs/server";

export const dynamic = "force-dynamic";

export default async function KnowledgeAppPage() {
  const trainingDocs = await listPublishedTrainingDocs(createServiceClient());
  return <AppTrainingDocsPage trainingDocs={trainingDocs} />;
}
