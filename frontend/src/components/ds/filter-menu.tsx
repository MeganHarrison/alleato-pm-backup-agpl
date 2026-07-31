"use client";

import type * as React from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface FilterMenuProps {
  trigger: React.ReactNode;
  title: string;
  children: React.ReactNode;
  align?: "start" | "center" | "end";
  widthClassName?: string;
  hasActiveFilters?: boolean;
  onClear?: () => void;
}

export function FilterMenu({
  trigger,
  title,
  children,
  align = "end",
  widthClassName = "w-64",
  hasActiveFilters = false,
  onClear,
}: FilterMenuProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align={align} className={cn(widthClassName, "p-0")}>
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <span className="text-sm font-medium">{title}</span>
          {hasActiveFilters && onClear ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={onClear}
              className="h-auto px-0 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear all
            </Button>
          ) : null}
        </div>
        <div className="max-h-80 space-y-4 overflow-y-auto p-3">{children}</div>
      </PopoverContent>
    </Popover>
  );
}

interface FilterMenuGroupProps {
  label: string;
  children: React.ReactNode;
}

export function FilterMenuGroup({ label, children }: FilterMenuGroupProps) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

interface FilterCheckboxRowProps {
  checked: boolean;
  onCheckedChange: () => void;
  children: React.ReactNode;
  className?: string;
}

export function FilterCheckboxRow({
  checked,
  onCheckedChange,
  children,
  className,
}: FilterCheckboxRowProps) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted",
        className,
      )}
    >
      <Checkbox checked={checked} onCheckedChange={onCheckedChange} />
      {children}
    </label>
  );
}
