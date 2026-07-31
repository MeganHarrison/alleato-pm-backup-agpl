import { FmGlobalSubmittedPage } from "@/app/(public)/fm-global/form/submitted/[submissionId]/page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AsrsSubmittedPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const { submissionId } = await params;

  return (
    <FmGlobalSubmittedPage
      submissionId={submissionId}
      returnHref="/asrs/intake"
      returnLabel="Start another assessment"
    />
  );
}
