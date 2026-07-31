"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ---------------------------------------------------------------------------
// ExpandingSearch — THE search pattern for this codebase.
//
// Renders as a Search icon. Click → expands to an input. ESC or blur-while-
// empty → collapses back. This is the ONLY permitted search input in pages
// and detail views. Raw <Input placeholder="Search..."> is banned by ESLint.
// ---------------------------------------------------------------------------

interface ExpandingSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Force the input open (e.g. when value is non-empty on mount) */
  defaultExpanded?: boolean;
}

export function ExpandingSearch({
  value,
  onChange,
  placeholder = "Search...",
  className,
  defaultExpanded = false,
}: ExpandingSearchProps) {
  const [expanded, setExpanded] = React.useState(defaultExpanded || value.length > 0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  function expand() {
    setExpanded(true);
    // Let the DOM update before focusing
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function collapse() {
    if (value.length > 0) return; // Keep open while there's a query
    setExpanded(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      onChange("");
      setExpanded(false);
    }
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
    setExpanded(false);
  }

  if (!expanded) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={expand}
        aria-label="Open search"
        className={cn("h-8 w-8 text-muted-foreground", className)}
      >
        <Search className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div className={cn("relative flex items-center", className)}>
      <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={collapse}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="h-8 w-52 pl-8 pr-7 text-sm"
      />
      {value.length > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onMouseDown={clear}
          aria-label="Clear search"
          className="absolute right-1 h-6 w-6 text-muted-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
