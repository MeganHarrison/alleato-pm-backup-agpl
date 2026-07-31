"use client";

import * as React from "react";

import {
  siteManagementChecklistSections,
  type SiteManagementChecklistEntry,
  type SiteManagementChecklistState,
  type SiteManagementChecklistValue,
} from "@/lib/daily-log/site-management-checklist";
import { SectionRuleHeading } from "@/components/layout";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

function ChecklistChoiceGroup({
  itemId,
  value,
  onValueChange,
}: {
  itemId: string;
  value: SiteManagementChecklistValue | null;
  onValueChange: (value: SiteManagementChecklistValue) => void;
}) {
  return (
    <RadioGroup
      value={value ?? ""}
      onValueChange={(nextValue) => onValueChange(nextValue as SiteManagementChecklistValue)}
      className="flex flex-wrap items-center gap-4"
    >
      {[
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
        { value: "na", label: "N/A" },
      ].map((option) => {
        const optionId = `${itemId}-${option.value}`;

        return (
          <label
            key={option.value}
            htmlFor={optionId}
            className="flex items-center gap-2 text-xs font-medium text-foreground"
          >
            <RadioGroupItem value={option.value} id={optionId} />
            {option.label}
          </label>
        );
      })}
    </RadioGroup>
  );
}

export function SiteLeadChecklistFields({
  checklist,
  onChangeEntry,
}: {
  checklist: SiteManagementChecklistState;
  onChangeEntry: (itemId: string, patch: Partial<SiteManagementChecklistEntry>) => void;
}) {
  return (
    <div className="space-y-6">
      {siteManagementChecklistSections.map((section) => (
        <section key={section.id} className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <SectionRuleHeading label={section.title} className="mb-0 pb-0" />
          </div>
          <div className="divide-y divide-border/70">
            {section.items.map((item) => {
              const entry = checklist[item.id] ?? { value: null, note: "" };
              const needsNote = entry.value === "no";

              return (
                <div key={item.id} className="space-y-3 py-3">
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground">{item.label}</p>
                    </div>
                    <ChecklistChoiceGroup
                      itemId={item.id}
                      value={entry.value}
                      onValueChange={(value) => {
                        onChangeEntry(item.id, {
                          value,
                          note: value === "no" ? entry.note : "",
                        });
                      }}
                    />
                  </div>
                  {needsNote ? (
                    <div className="max-w-2xl space-y-1">
                      <Label
                        htmlFor={`${item.id}-note`}
                        className="text-[11px] font-medium text-destructive"
                      >
                        Required follow-up note
                      </Label>
                      <Textarea
                        id={`${item.id}-note`}
                        value={entry.note}
                        rows={2}
                        placeholder="Explain the issue, corrective action, or what is blocking completion."
                        onChange={(event) =>
                          onChangeEntry(item.id, {
                            note: event.target.value,
                          })
                        }
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
