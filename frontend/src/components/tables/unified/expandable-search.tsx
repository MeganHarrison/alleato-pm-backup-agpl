"use client";

import * as React from "react";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ExpandableSearch({
  value,
  onChange,
  placeholder = "Search...",
  ariaLabel = "Search table",
  defaultExpanded = false,
  collapsible = true,
  className,
  inputClassName,
  triggerClassName,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  defaultExpanded?: boolean;
  collapsible?: boolean;
  className?: string;
  inputClassName?: string;
  triggerClassName?: string;
}): React.ReactElement {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded || !collapsible);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  React.useEffect(() => {
    if (value) setIsExpanded(true);
  }, [value]);

  React.useEffect(() => {
    if (!collapsible) {
      setIsExpanded(true);
    }
  }, [collapsible]);

  return (
    <div className={cn("relative flex items-center", className)}>
      {collapsible && !isExpanded ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8", triggerClassName)}
                onClick={() => setIsExpanded(true)}
                aria-label={ariaLabel}
              >
                <Search />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Search</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <div className="relative flex w-full items-center animate-in slide-in-from-left-2 duration-200">
          <Search className="absolute left-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onBlur={() => {
              if (collapsible && !value) setIsExpanded(false);
            }}
            placeholder={placeholder}
            className={cn(
              collapsible
                ? "h-8 w-50 pl-8 pr-8 text-sm"
                : "h-8 w-full pl-8 pr-8 text-sm",
              inputClassName,
            )}
            aria-label={ariaLabel}
          />
          {value && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0 h-8 w-8"
              onClick={() => {
                onChange("");
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
