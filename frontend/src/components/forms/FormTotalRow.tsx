import * as React from "react";
import { cn } from "@/lib/utils";

interface FormTotalRowProps {
  label: string;
  value: React.ReactNode;
  className?: string;
}

export function FormTotalRow({ label, value, className }: FormTotalRowProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-t border-border/60 pt-3",
        className,
      )}
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-base font-semibold tabular-nums">{value}</p>
    </div>
  );
}
