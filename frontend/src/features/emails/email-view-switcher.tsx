"use client";

import * as React from "react";
import { LayoutList } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type EmailViewMode = "mail" | "table" | "list";

const VIEWS: { id: EmailViewMode; label: string }[] = [
  { id: "mail", label: "Mail" },
  { id: "table", label: "Table" },
  { id: "list", label: "List" },
];

export function EmailViewSwitcher({
  value,
  onChange,
  className,
}: {
  value: EmailViewMode;
  onChange: (value: EmailViewMode) => void;
  className?: string;
}) {
  const activeLabel = VIEWS.find((view) => view.id === value)?.label ?? "Mail";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Email view: ${activeLabel}`}
          title={`Email view: ${activeLabel}`}
          className={cn("h-8 w-8 rounded-full text-muted-foreground shadow-none", className)}
        >
          <LayoutList className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        {VIEWS.map((view) => (
          <DropdownMenuItem
            key={view.id}
            onClick={() => onChange(view.id)}
            className={cn(value === view.id && "font-medium text-foreground")}
          >
            {view.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
