"use client";

import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface CheckboxFieldProps {
  label: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  error?: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
}

export function CheckboxField({
  label,
  checked = false,
  onCheckedChange,
  error,
  hint,
  disabled = false,
  className,
}: CheckboxFieldProps) {
  const inputId = React.useId();
  const hasDetail = Boolean(hint || error);

  return (
    <div className={cn("flex gap-3", hasDetail ? "items-start" : "items-center", className)}>
      <div className={cn("flex items-center", hasDetail ? "h-5 pt-0.5" : "h-4")}>
        <Checkbox
          id={inputId}
          checked={checked}
          onCheckedChange={(nextChecked) => onCheckedChange?.(nextChecked === true)}
          disabled={disabled}
          className={cn(error && "border-destructive/50")}
          aria-invalid={!!error}
        />
      </div>
      <div className={cn("min-w-0", hasDetail && "space-y-1")}>
        <label
          htmlFor={inputId}
          className={cn(
            "block text-sm font-medium text-foreground",
            hasDetail ? "leading-5" : "leading-4",
          )}
        >
          {label}
        </label>
        {hint && !error && <p className="text-sm text-muted-foreground">{hint}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}
