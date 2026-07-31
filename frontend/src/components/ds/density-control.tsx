"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface DensityOption<T extends string> {
  value: T;
  label: string;
}

interface DensityControlProps<T extends string> {
  value: T;
  options: DensityOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}

export function DensityControl<T extends string>({
  value,
  options,
  onChange,
  className,
}: DensityControlProps<T>) {
  return (
    <div className={cn("flex gap-1", className)}>
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant={value === option.value ? "secondary" : "ghost"}
          size="xs"
          onClick={() => onChange(option.value)}
          data-state={value === option.value ? "active" : "inactive"}
          className="flex-1 data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=inactive]:bg-muted/50 data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-muted"
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
