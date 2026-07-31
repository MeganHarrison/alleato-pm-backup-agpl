import type { Metadata } from "next";
import { Suspense } from "react";
import { EmailsClient } from "@/app/(main)/[projectId]/emails/emails-client";

export const metadata: Metadata = {
  title: "Outlook Draft Feedback",
};

export const dynamic = "force-dynamic";

const BRANDON_MAILBOX = "bclymer@alleatogroup.com";

export default function OutlookDraftFeedbackPage() {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <Suspense>
        <EmailsClient
          scope="global"
          source="outlook"
          mailboxUserId={BRANDON_MAILBOX}
          navigationTabs={[]}
        />
      </Suspense>
    </div>
  );
}
