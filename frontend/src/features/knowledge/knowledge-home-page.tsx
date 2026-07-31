"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, GraduationCap } from "lucide-react";

import { PageShell, SectionRuleHeading } from "@/components/layout";

const KNOWLEDGE_GROUPS = [
  {
    title: "How to Use the App",
    description:
      "Guides for tools, workflows, permissions, and day-to-day app usage.",
    href: "/knowledge/app",
    icon: GraduationCap,
  },
  {
    title: "Company Knowledge Base",
    description:
      "Approved internal sources, policies, templates, and company reference material.",
    href: "/knowledge/company",
    icon: BookOpen,
  },
] as const;

export function KnowledgeHomePage() {
  return (
    <PageShell
      variant="content"
      title="Knowledge"
      description="Choose the source that matches what you need."
      contentClassName="max-w-5xl"
    >
      <section className="space-y-4" aria-label="Knowledge groups">
        <SectionRuleHeading label="Knowledge groups" />
        <div className="grid gap-3 md:grid-cols-2">
          {KNOWLEDGE_GROUPS.map((group) => {
            const Icon = group.icon;

            return (
              <Link
                key={group.href}
                href={group.href}
                className="group flex min-h-36 items-start justify-between gap-4 rounded-md bg-muted/45 px-5 py-5 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <span className="flex min-w-0 gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-background/80 text-muted-foreground group-hover:text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="space-y-1">
                    <span className="block text-base font-semibold text-foreground group-hover:text-primary">
                      {group.title}
                    </span>
                    <span className="block text-sm leading-6 text-muted-foreground">
                      {group.description}
                    </span>
                  </span>
                </span>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
              </Link>
            );
          })}
        </div>
      </section>
    </PageShell>
  );
}
