"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, LockKeyhole } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  COMPANY_SETTINGS_SECTIONS,
  DEFAULT_COMPANY_SETTINGS_SECTION_ID,
  type CompanySettingsSection,
} from "@/lib/company-settings/registry";
import { cn } from "@/lib/utils";

function SettingsSectionNav({
  activeSectionId,
  onSelect,
}: {
  activeSectionId: string;
  onSelect: (sectionId: string) => void;
}) {
  return (
    <nav aria-label="Company settings categories" className="space-y-1">
      {COMPANY_SETTINGS_SECTIONS.map((section) => {
        const isActive = section.id === activeSectionId;

        return (
          <Button
            key={section.id}
            type="button"
            variant="ghost"
            onClick={() => onSelect(section.id)}
            className={cn(
              "min-h-11 w-full justify-start px-3 text-left text-sm",
              isActive
                ? "bg-accent font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {section.label}
          </Button>
        );
      })}
    </nav>
  );
}

function SettingsSectionContent({ section }: { section: CompanySettingsSection }) {
  return (
    <section aria-labelledby={`${section.id}-heading`} className="min-w-0">
      <div className="mb-4">
        <h2 id={`${section.id}-heading`} className="text-lg font-semibold tracking-tight text-foreground">
          {section.label}
        </h2>
      </div>

      <div className="divide-y divide-border/60">
        {section.items.map((item) => (
          <article key={item.id} className="flex flex-col gap-3 py-5 first:pt-0 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <h3 className="text-sm font-medium text-foreground">{item.title}</h3>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{item.description}</p>
              {item.availability === "protected" && item.protectionReason ? (
                <p className="flex max-w-2xl items-start gap-2 pt-1 text-xs leading-relaxed text-muted-foreground">
                  <LockKeyhole aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                  <span>{item.protectionReason}</span>
                </p>
              ) : null}
            </div>

            {item.availability === "available" && item.href && item.actionLabel ? (
              <Button asChild variant="outline" size="sm" className="shrink-0 self-start">
                <Link href={item.href}>
                  {item.actionLabel}
                  <ArrowUpRight aria-hidden="true" className="ml-2 size-3.5" />
                </Link>
              </Button>
            ) : (
              <span className="shrink-0 pt-1 text-xs font-medium text-muted-foreground">Protected</span>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

export function CompanySettingsClient() {
  const [activeSectionId, setActiveSectionId] = useState(
    DEFAULT_COMPANY_SETTINGS_SECTION_ID,
  );

  const activeSection = useMemo(
    () =>
      COMPANY_SETTINGS_SECTIONS.find((section) => section.id === activeSectionId) ??
      COMPANY_SETTINGS_SECTIONS[0],
    [activeSectionId],
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-12">
      <SettingsSectionNav
        activeSectionId={activeSection.id}
        onSelect={setActiveSectionId}
      />
      <SettingsSectionContent section={activeSection} />
    </div>
  );
}
