import { PermissionTemplateDetailPageClient } from "../../template-detail-page-client";

export default async function PermissionTemplateDetailPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;

  return <PermissionTemplateDetailPageClient templateId={templateId} />;
}
