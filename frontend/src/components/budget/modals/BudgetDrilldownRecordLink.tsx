"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface BudgetDrilldownRecordLinkProps {
  href?: string | null;
  children: ReactNode;
  className?: string;
}

export function BudgetDrilldownRecordLink({
  href,
  children,
  className,
}: BudgetDrilldownRecordLinkProps) {
  if (!href) {
    return <span className={className}>{children}</span>;
  }

  return (
    <Link
      href={href}
      className={cn(
        "font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
    >
      {children}
    </Link>
  );
}
