"use client";

import Link from "next/link";
import type * as React from "react";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

interface DashedActionLinkProps {
  href: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function DashedActionLink({
  href,
  icon,
  children,
  className,
}: DashedActionLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-md border border-dashed border-border/70 px-3 py-3 text-sm text-muted-foreground transition-colors hover:border-border hover:bg-muted/40 hover:text-primary",
        className,
      )}
    >
      {icon ? <span className="shrink-0 text-muted-foreground">{icon}</span> : null}
      <span className="min-w-0 flex-1">{children}</span>
      <ChevronRight className="h-3.5 w-3.5 shrink-0" />
    </Link>
  );
}
