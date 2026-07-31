export const dynamic = "force-dynamic";

import { requireAppAdminPageAccess } from "@/lib/auth/require-app-admin";

import { MeetingTemplateEditorClient } from "./meeting-template-editor-client";

export default async function MeetingTemplateEditorPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  await requireAppAdminPageAccess();
  const { templateId } = await params;

  return <MeetingTemplateEditorClient templateId={templateId} />;
}
