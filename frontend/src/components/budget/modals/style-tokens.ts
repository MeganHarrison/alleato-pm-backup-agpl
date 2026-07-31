import { cn } from "@/lib/utils";

export const BUDGET_PRIMARY_TABS_LIST_CLASS =
  "w-full justify-start border-b border-border";

export const BUDGET_PRIMARY_TABS_TRIGGER_CLASS =
  "px-1.5 py-3 text-sm font-medium";

export const BUDGET_SECONDARY_TABS_LIST_CLASS =
  "h-auto gap-1 rounded-md bg-muted p-1";

export const BUDGET_SECONDARY_TABS_TRIGGER_CLASS =
  "rounded-sm px-3 py-1.5 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm";

export function budgetRadioCardClass(isActive: boolean) {
  return cn(
    "flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background px-4 py-4 transition-colors",
    isActive && "border-primary bg-primary/5",
  );
}

