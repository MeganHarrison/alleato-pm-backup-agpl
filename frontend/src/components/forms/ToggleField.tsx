"use client";

import * as React from "react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface ToggleFieldProps {
  label: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  error?: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
  labelClassName?: string;
  hintClassName?: string;
  controlPosition?: "left" | "right";
}

export function ToggleField({
  label,
  checked = false,
  onCheckedChange,
  error,
  hint,
  disabled = false,
  className,
  labelClassName,
  hintClassName,
  controlPosition = "right",
}: ToggleFieldProps) {
  const switchControl = (
    <Switch
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className={cn("shrink-0", error && "border-destructive/50")}
      aria-invalid={!!error}
    />
  );

  return (
    <div
      className={cn(
        "flex gap-3",
        controlPosition === "left"
          ? "items-start justify-start"
          : "items-center justify-between",
        className,
      )}
    >
      {controlPosition === "left" ? switchControl : null}
      <div className="flex-1">
        <label className={cn("text-sm font-medium text-foreground", labelClassName)}>{label}</label>
        {hint && !error && <p className={cn("text-sm text-muted-foreground", hintClassName)}>{hint}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      {controlPosition === "right" ? switchControl : null}
    </div>
  );
}
