export const dynamic = "force-dynamic";

import { requireAdmin } from "@/app/api/admin/_shared";

import { TrainingMapClient } from "./training-map-client";

export default async function TrainingMapPage() {
  await requireAdmin("training-map-page");

  return <TrainingMapClient />;
}
