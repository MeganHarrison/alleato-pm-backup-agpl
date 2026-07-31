export const dynamic = "force-dynamic";

import { requireAdmin } from "@/app/api/admin/_shared";

import { TrainingDocsClient } from "./training-docs-client";

export default async function TrainingDocsPage() {
  await requireAdmin("training-docs-page");

  return <TrainingDocsClient />;
}
