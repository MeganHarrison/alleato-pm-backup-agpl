"use client";

import { ArrowRightIcon, CheckCircle2Icon, LockKeyholeIcon } from "lucide-react";
import Link from "next/link";

import { SectionRuleHeading } from "@/components/layout/spacing";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ASSISTANT_ACTION_CATALOG,
  type AssistantActionCatalogItem,
  type AssistantActionCatalogStatus,
} from "@/lib/ai/assistant-action-catalog";

type AssistantActionCatalogProps = {
  disabled?: boolean;
  onSelectPrompt: (prompt: string) => void;
};

const statusClassName: Record<AssistantActionCatalogStatus, string> = {
  ready: "text-emerald-700 bg-emerald-50",
  preview_required: "text-amber-700 bg-amber-50",
  needs_setup: "text-slate-700 bg-slate-100",
  admin_only: "text-slate-700 bg-slate-100",
  not_ready: "text-muted-foreground bg-muted",
};

function statusIcon(item: AssistantActionCatalogItem) {
  if (item.status === "ready") return CheckCircle2Icon;
  return LockKeyholeIcon;
}

export function AssistantActionCatalog({
  disabled = false,
  onSelectPrompt,
}: AssistantActionCatalogProps) {
  return (
    <section
      aria-label="AI action catalog"
      className="mt-8 border-t border-border/70 pt-5 text-left"
    >
      <div className="mb-4 flex flex-col gap-1">
        <SectionRuleHeading label="AI command center" className="mb-0 pb-0" />
        <p className="text-xs leading-5 text-muted-foreground">
          Pick an action or ask normally. Anything that writes, sends, or saves
          stays preview-first.
        </p>
      </div>

      <div className="grid gap-x-7 gap-y-5 lg:grid-cols-2">
        {ASSISTANT_ACTION_CATALOG.map((group) => (
          <div key={group.title} className="min-w-0 space-y-2">
            <div>
              <SectionRuleHeading
                label={group.title}
                className="mb-0 pb-0"
              />
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {group.description}
              </p>
            </div>
            <div className="divide-y divide-border/60">
              {group.items.map((item) => {
                const StatusIcon = statusIcon(item);
                const buttonContent = (
                  <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">
                        {item.label}
                      </div>
                      {item.unavailableReason ? (
                        <div className="mt-1 line-clamp-2 text-xs font-normal leading-5 text-muted-foreground">
                          {item.unavailableReason}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium",
                          statusClassName[item.status],
                        )}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {item.statusLabel}
                      </span>
                      <ArrowRightIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </div>
                );

                if (item.href && item.status !== "not_ready" && !disabled) {
                  return (
                    <Button
                      key={item.id}
                      asChild
                      type="button"
                      variant="ghost"
                      className="h-auto w-full justify-start rounded-none px-0 py-2.5 text-left hover:bg-transparent"
                    >
                      <Link href={item.href}>{buttonContent}</Link>
                    </Button>
                  );
                }

                return (
                  <Button
                    key={item.id}
                    type="button"
                    variant="ghost"
                    disabled={disabled || item.status === "not_ready"}
                    className="h-auto w-full justify-start rounded-none px-0 py-2.5 text-left hover:bg-transparent"
                    onClick={() => onSelectPrompt(item.prompt)}
                  >
                    {buttonContent}
                  </Button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
