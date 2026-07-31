import type { ReactNode } from "react";

import { SectionRuleHeading } from "@/components/layout/spacing";

export function Panel({
  title,
  subtitle,
  count,
  empty,
  children,
}: {
  title: string;
  subtitle?: string;
  count: number;
  empty: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/50">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-800 px-4 py-3">
        <div>
          <SectionRuleHeading
            as="h2"
            className="mb-0 gap-0 pb-0"
            label={
              <span className="normal-case tracking-normal text-sm font-semibold text-neutral-100">
                {title}
              </span>
            }
          />
          {subtitle ? (
            <p className="text-xs text-neutral-500">{subtitle}</p>
          ) : null}
        </div>
        <span className="shrink-0 rounded-full bg-neutral-800 px-2 py-0.5 text-xs tabular-nums text-neutral-400">
          {count}
        </span>
      </div>

      {count === 0 ? (
        <p className="px-4 py-8 text-center text-sm leading-relaxed text-neutral-500">
          {empty}
        </p>
      ) : (
        <div className="divide-y divide-neutral-800/70">{children}</div>
      )}
    </section>
  );
}
