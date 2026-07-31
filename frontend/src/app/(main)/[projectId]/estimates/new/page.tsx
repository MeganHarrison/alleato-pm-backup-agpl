import { redirect } from "next/navigation";

export default async function NewEstimatePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  redirect(`/${projectId}/estimates`);
}
