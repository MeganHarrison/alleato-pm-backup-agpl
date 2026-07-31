"use client";

import * as React from "react";
import Link from "next/link";
import {
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardList,
  FileText,
  FolderOpen,
  Handshake,
  HardHat,
  Receipt,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { APP_KNOWLEDGE_TOOL_CATEGORIES } from "./app-knowledge";

export const APP_TOOL_ICON_BY_SLUG: Record<string, React.ReactNode> = {
  projects: <Building2 className="h-4 w-4" />,
  budget: <Receipt className="h-4 w-4" />,
  "prime-contracts": <FileText className="h-4 w-4" />,
  commitments: <Handshake className="h-4 w-4" />,
  "change-events": <ClipboardList className="h-4 w-4" />,
  "change-orders": <FileText className="h-4 w-4" />,
  schedule: <CalendarDays className="h-4 w-4" />,
  meetings: <CalendarDays className="h-4 w-4" />,
  "rfis-and-submittals": <HardHat className="h-4 w-4" />,
  "documents-and-drawings": <FolderOpen className="h-4 w-4" />,
  "training-docs": <BookOpen className="h-4 w-4" />,
};

export function getAppToolIcon(slug: string): React.ReactNode {
  return APP_TOOL_ICON_BY_SLUG[slug] ?? <BookOpen className="h-4 w-4" />;
}

/**
 * Persistent App-knowledge tool nav. Rendered on every page under
 * `/knowledge/app` (the category browse pages and the individual training-doc
 * pages) so the tool list never disappears as the user drills in.
 */
export function AppKnowledgeToolNav({ activeSlug }: { activeSlug?: string | null }) {
  return (
    <aside className="hidden lg:block">
      <nav aria-label="App training topics" className="sticky top-6 space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">App</p>
          <ToolNavLink href="/knowledge/app" label="All tools" isActive={!activeSlug} />
          {APP_KNOWLEDGE_TOOL_CATEGORIES.map((category) => (
            <ToolNavLink
              key={category.slug}
              href={`/knowledge/app/${category.slug}`}
              label={category.title}
              icon={getAppToolIcon(category.slug)}
              isActive={activeSlug === category.slug}
            />
          ))}
        </div>
      </nav>
    </aside>
  );
}

function ToolNavLink({
  href,
  label,
  isActive,
  icon,
}: {
  href: string;
  label: string;
  isActive: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex h-auto min-h-10 w-full items-center gap-2 whitespace-normal rounded-md px-3 py-2 text-left text-sm transition-colors",
        isActive
          ? "bg-primary/10 font-medium text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {icon ? <span className="shrink-0">{icon}</span> : null}
      <span className="truncate">{label}</span>
    </Link>
  );
}
