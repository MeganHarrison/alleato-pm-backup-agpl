export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { serviceDb } from "@/lib/supabase/service-db";
import { AppErrorsClient } from "./app-errors-client";

export default async function AppErrorsPage() {
    const { data, error } = await serviceDb.from("app_error_groups")
    .select(
      "id, created_at, first_seen_at, last_seen_at, signature, source, severity, status, event_count, affected_user_count, affected_project_count, latest_message, latest_route, latest_action, latest_error_code, latest_request_id, latest_user_id, latest_project_id, linear_issue_id, linear_issue_url",
    )
    .order("last_seen_at", { ascending: false })
    .limit(200);

  return (
    <Suspense>
      <AppErrorsClient rows={data ?? []} loadError={error?.message ?? null} />
    </Suspense>
  );
}
