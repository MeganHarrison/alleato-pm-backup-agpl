import type { ReactNode } from "react";
import { requireOwner } from "@/lib/auth/require-owner";

/**
 * Email surfaces are restricted to the workspace owner. This guard runs before
 * the page renders, so non-owners never load or fetch email data.
 */
export default async function EmailsOwnerLayout({ children }: { children: ReactNode }) {
  await requireOwner();
  return <>{children}</>;
}
