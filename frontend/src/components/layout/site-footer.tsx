"use client";

import Link from "next/link";
import { ChevronUp } from "lucide-react";

import { useCurrentUserProfile } from "@/hooks/use-current-user-profile";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const currentYear = new Date().getFullYear();

const adminDropdownAllowedUserIds = new Set([
  "6ae4299f-6c21-4e99-b6a1-ccb1fe5aa7f6",
]);

const adminSections = [
  {
    label: "Admin",
    links: [
      { label: "Command Center", href: "/command-center" },
      { label: "Admin Dashboard", href: "/admin" },
      { label: "Feedback Inbox", href: "/feedback-inbox" },
      { label: "Annotation Inbox", href: "/annotation-inbox" },
      { label: "AI Learning", href: "/ai/learning-promotions" },
      { label: "Updates", href: "/updates" },
    ],
  },
  {
    label: "Design",
    links: [
      { label: "Design", href: "/design" },
      { label: "Style Guide", href: "/style-guide" },
      { label: "Design Violations", href: "/design-violations" },
    ],
  },
  {
    label: "Developer",
    links: [
      { label: "API Docs", href: "/api-docs" },
      { label: "Redoc", href: "/redoc" },
      { label: "Database", href: "/database-inventory" },
      { label: "RAG Eval", href: "/rag-eval" },
      { label: "Docs", href: "/docs" },
    ],
  },
  {
    label: "Procore",
    links: [
      { label: "Procore Tools", href: "/procore-tools" },
      { label: "Procore Docs", href: "/procore-docs" },
    ],
  },
];

function AdminDropdown() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1 px-0 text-sm font-normal text-muted-foreground hover:bg-transparent hover:text-foreground"
        >
          Admin
          <ChevronUp className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="min-w-56">
        {adminSections.map((section, sectionIndex) => (
          <div key={section.label}>
            {sectionIndex > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {section.label}
            </DropdownMenuLabel>
            {section.links.map((link) => (
              <DropdownMenuItem key={link.href} asChild>
                <Link href={link.href}>{link.label}</Link>
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SiteFooter() {
  const { profile } = useCurrentUserProfile();
  const canViewAdminDropdown =
    profile?.isAdmin === true && adminDropdownAllowedUserIds.has(profile.id);

  return (
    <footer className="w-full shrink-0 bg-background" data-shell-footer>
      <div className="flex min-h-10 items-center justify-between gap-4 px-4 py-1 sm:px-6 lg:px-8">
        <nav className="flex min-w-0 items-center" aria-label="Footer admin links">
          {canViewAdminDropdown ? <AdminDropdown /> : null}
        </nav>
        <p className="shrink-0 text-right text-xs text-muted-foreground">
          &copy; {currentYear} Alleato Group. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
