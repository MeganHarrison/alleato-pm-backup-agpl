import type { ReactNode } from "react";
import { requireOwnerOrEmails } from "@/lib/auth/require-owner";

/**
 * Inbox rules manage the assistant for Brandon's mailbox, so his account is
 * allowed alongside the workspace owner — same guard as the parent
 * Outlook Draft Feedback surface. A child segment does not inherit the sibling
 * guard, so it is re-declared here.
 */
const DRAFT_FEEDBACK_ALLOWED_EMAILS = ["bclymer@alleatogroup.com"];

export default async function OutlookInboxRulesOwnerLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireOwnerOrEmails(DRAFT_FEEDBACK_ALLOWED_EMAILS);
  return <>{children}</>;
}
