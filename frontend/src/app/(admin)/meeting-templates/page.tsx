export const dynamic = "force-dynamic";

import { requireAppAdminPageAccess } from "@/lib/auth/require-app-admin";

import { MeetingTemplatesClient } from "./meeting-templates-client";

export default async function MeetingTemplatesPage() {
  await requireAppAdminPageAccess();

  return <MeetingTemplatesClient />;
}
