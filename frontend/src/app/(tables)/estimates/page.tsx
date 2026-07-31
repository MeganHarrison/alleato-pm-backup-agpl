export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { EstimatesGlobalClient } from "./estimates-client";

export default async function GlobalEstimatesPage() {
  const supabase = await createClient();

  const { data: estimates } = await supabase
    .from("estimates")
    .select("*, projects(id, name)")
    .eq("is_deleted", false)
    .order("updated_at", { ascending: false });

  return <EstimatesGlobalClient estimates={estimates ?? []} />;
}
