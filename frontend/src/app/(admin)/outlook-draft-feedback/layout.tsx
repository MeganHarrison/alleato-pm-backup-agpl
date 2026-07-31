import type { ReactNode } from "react";
import { requireOwnerOrEmails } from "@/lib/auth/require-owner";

/**
 * This surface tunes the AI that drafts emails in Brandon's voice, so Brandon
 * is allowed in alongside the workspace owner to review his own draft feedback.
 * Every other email surface stays owner-only (plain `requireOwner`).
 */
const DRAFT_FEEDBACK_ALLOWED_EMAILS = ["bclymer@alleatogroup.com"];

export default async function OutlookDraftFeedbackOwnerLayout({ children }: { children: ReactNode }) {
  await requireOwnerOrEmails(DRAFT_FEEDBACK_ALLOWED_EMAILS);
  return <>{children}</>;
}
