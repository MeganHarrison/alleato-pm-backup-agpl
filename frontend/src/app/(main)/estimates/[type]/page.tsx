import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EstimateService } from "@/lib/services/estimate-service";
import { EstimateTypeSlugMap } from "@/lib/schemas/estimates";
import { EstimatesTypeClient } from "./estimates-type-client";

interface Props {
  params: Promise<{ type: string }>;
}

export default async function EstimatesTypePage({ params }: Props) {
  const { type: slug } = await params;

  const dbType = EstimateTypeSlugMap[slug];
  if (!dbType) notFound();

  const supabase = await createClient();
  const service = new EstimateService(supabase);
  const estimates = await service.listAll(dbType);

  return (
    <EstimatesTypeClient
      estimateType={dbType}
      typeSlug={slug}
      estimates={estimates}
    />
  );
}
