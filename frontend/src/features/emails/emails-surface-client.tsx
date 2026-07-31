"use client";

import { useSearchParams } from "next/navigation";
import { EmailsClient } from "@/app/(main)/[projectId]/emails/emails-client";
import { EmailInboxClient } from "@/features/emails/inbox/email-inbox-client";
import type { InboxTab } from "@/features/emails/inbox/email-inbox-client";

const INBOX_TABS = new Set<string>([
  "brandon-queue",
  "needs-assignment",
  "all",
  "has-attachments",
  "reviewed",
]);

/**
 * Global Emails surface — switches between the company inbox (brandon-queue
 * and related tabs) and the general email table view.
 */
export function EmailsSurfaceClient() {
  const searchParams = useSearchParams();
  const tab = searchParams?.get("tab") ?? "";

  if (INBOX_TABS.has(tab)) {
    return <EmailInboxClient initialTab={tab as InboxTab} />;
  }

  return <EmailsClient scope="global" source="all" navigationTabs={[]} />;
}
