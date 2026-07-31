export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { ChangeEventsGlobalClient } from "./change-events-client";

export default async function GlobalChangeEventsPage() {
  const supabase = await createClient();

  const { data: changeEvents } = await supabase
    .from("change_events")
    .select("*, projects(id, name)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  type Props = Parameters<typeof ChangeEventsGlobalClient>[0];
  return <ChangeEventsGlobalClient changeEvents={(changeEvents ?? []) as unknown as Props["changeEvents"]} />;
}
