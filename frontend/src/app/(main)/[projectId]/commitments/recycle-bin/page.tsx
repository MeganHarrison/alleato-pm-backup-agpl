import { redirect } from "next/navigation";

interface CommitmentsRecycleBinRedirectPageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default async function CommitmentsRecycleBinRedirectPage({
  params,
}: CommitmentsRecycleBinRedirectPageProps) {
  const { projectId } = await params;
  redirect(`/${projectId}/commitments?tab=recycle-bin`);
}
