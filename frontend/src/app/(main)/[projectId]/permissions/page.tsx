import { redirect } from "next/navigation";

export default async function LegacyProjectPermissionsRedirectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  redirect(`/${projectId}/user-management`);
}
