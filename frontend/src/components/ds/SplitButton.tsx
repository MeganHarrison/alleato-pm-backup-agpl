"use client";

import * as React from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface SplitButtonAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  separator?: boolean;
}

interface SplitButtonProps {
  /** Label for the primary action button */
  label: string;
  onClick: () => void;
  /** Actions shown in the dropdown */
  actions: SplitButtonAction[];
  variant?: "default" | "outline" | "soft";
  size?: "sm" | "default";
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
}

/**
 * SplitButton — primary action button with a secondary actions dropdown.
 *
 * Usage:
 *   <SplitButton
 *     label="Save"
 *     onClick={handleSave}
 *     actions={[
 *       { label: "Save & Close", onClick: handleSaveClose },
 *       { label: "Save as Draft", onClick: handleDraft },
 *     ]}
 *   />
 */
export function SplitButton({
  label,
  onClick,
  actions,
  variant = "default",
  size = "default",
  disabled = false,
  isLoading = false,
  className,
}: SplitButtonProps) {
  const buttonVariant = variant === "soft" ? "outline" : variant;
  const softToneClass =
    variant === "soft"
      ? "border-primary/25 bg-primary/15 text-primary hover:bg-primary/25 hover:text-primary"
      : "";

  return (
    <div className={cn("flex items-center", className)}>
      {/* Primary button */}
      <Button
        type="button"
        variant={buttonVariant}
        size={size}
        onClick={onClick}
        disabled={disabled || isLoading}
        className={cn("rounded-r-none border-r-0 focus-visible:z-10", softToneClass)}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        {label}
      </Button>

      {/* Dropdown trigger */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant={buttonVariant}
            size={size}
            disabled={disabled || isLoading}
            aria-label="More options"
            className={cn(
              "rounded-l-none px-2 focus-visible:z-10",
              size === "sm" ? "px-1.5" : "px-2",
              softToneClass,
            )}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          {actions.map((action, i) => (
            <React.Fragment key={action.label}>
              {action.separator && i > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem
                onClick={action.onClick}
                disabled={action.disabled}
                className={action.destructive ? "text-destructive focus:text-destructive" : undefined}
              >
                {action.label}
              </DropdownMenuItem>
            </React.Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
