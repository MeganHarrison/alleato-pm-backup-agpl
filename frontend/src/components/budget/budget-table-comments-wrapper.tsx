"use client";

import { type ReactNode } from "react";

interface BudgetTableCommentsWrapperProps {
  projectId: string;
  children: ReactNode;
}

/**
 * Compatibility wrapper for the budget page while cell comments migrate from
 * the old page-local comments entry point to the global Velt commenting layer.
 */
export function BudgetTableCommentsWrapper({
  children,
}: BudgetTableCommentsWrapperProps) {
  return <>{children}</>;
}
