"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export interface SectionNavItem {
  href: string;
  label: string;
}

export const SECTION_NAV_ITEMS: SectionNavItem[] = [
  { href: "/docs/ai-overview", label: "Overview" },
  { href: "/docs/ai-overview/team", label: "The team" },
  { href: "/docs/ai-overview/tools", label: "Tools" },
  { href: "/docs/ai-overview/models-and-cost", label: "Models & cost" },
  { href: "/docs/ai-overview/memory", label: "Memory" },
  { href: "/docs/ai-overview/learning", label: "Learning loops" },
];

export function SectionNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="AI overview sections"
      className="mb-10 flex flex-wrap items-center gap-x-1 gap-y-2 border-b border-border/60 pb-1"
    >
      {SECTION_NAV_ITEMS.map((item) => {
        const active =
          item.href === "/docs/ai-overview"
            ? pathname === item.href
            : pathname?.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative px-3 py-2 text-sm font-medium transition-colors",
              "after:absolute after:inset-x-3 after:-bottom-px after:h-px after:transition-colors",
              active
                ? "text-foreground after:bg-primary"
                : "text-muted-foreground after:bg-transparent hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
