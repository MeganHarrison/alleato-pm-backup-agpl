"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: 1, label: "1 day" },
  { value: 3, label: "3 days" },
] as const;

export function ExecutiveBriefingWindowToggle({
  windowDays,
}: {
  windowDays: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const handleSelect = (next: number) => {
    if (next === windowDays) return;
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("windowDays", String(next));
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <div className="inline-flex items-center rounded-md bg-muted p-0.5">
      {OPTIONS.map((option) => {
        const active = option.value === windowDays;
        return (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant="ghost"
            disabled={isPending}
            onClick={() => handleSelect(option.value)}
            className={cn(
              "h-7 px-3 text-xs font-medium",
              active
                ? "bg-background text-foreground shadow-xs hover:bg-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}
