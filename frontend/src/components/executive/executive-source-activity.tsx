import { CalendarDays, FileText, Mail, MessageSquare } from "lucide-react";
import { SectionRuleHeading } from "@/components/layout";
import type { BrandonBriefSourceCoverage } from "@/lib/executive/brandon-daily-update";

const sourceIcons = {
  Email: Mail,
  Teams: MessageSquare,
  Meeting: CalendarDays,
  Document: FileText,
} satisfies Record<
  BrandonBriefSourceCoverage["label"],
  React.ComponentType<{ className?: string }>
>;

export function ExecutiveSourceActivity({
  sources,
}: {
  sources: BrandonBriefSourceCoverage[];
}) {
  return (
    <section className="space-y-4">
      <SectionRuleHeading label="Source Health" />

      <div className="divide-y divide-border">
        {sources.map((source) => {
          const Icon = sourceIcons[source.label];

          return (
            <div key={source.label} className="flex items-center gap-3 py-3">
              <div className="mt-0.5 shrink-0 text-primary">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-xs font-medium leading-5 text-foreground">
                    {source.label}
                  </span>
                  <span className="text-xs leading-5 text-muted-foreground">
                    Latest {source.latest}
                  </span>
                </div>
              </div>
              <div className="text-sm font-semibold tabular-nums text-foreground">
                {source.count}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
