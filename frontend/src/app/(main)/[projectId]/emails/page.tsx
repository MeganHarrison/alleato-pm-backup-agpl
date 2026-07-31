/* eslint-disable design-system/require-page-shell -- UnifiedTablePage provides its own page layout */
import type { Metadata } from "next";
import { Suspense } from "react";
import { EmailsClient } from "./emails-client";

export const metadata: Metadata = {
  title: "Emails",
};

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectEmailsPage({ params }: PageProps) {
  const { projectId } = await params;

  // Mirror the outlook-draft-feedback split layout: the mail workspace renders a
  // fill-height two-pane split (SplitPageFrame height="fill" → `h-full flex-1`),
  // which needs a flex parent with `min-h-0` + `overflow-hidden` to bound its
  // height and scroll each pane internally. Without this wrapper the shared
  // [projectId] layout (`flex flex-1 flex-col`, no min-h-0) lets the split grow
  // to its content and the whole page scrolls as one block.
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <Suspense>
        <EmailsClient projectId={parseInt(projectId, 10)} source="all" />
      </Suspense>
    </div>
  );
}
