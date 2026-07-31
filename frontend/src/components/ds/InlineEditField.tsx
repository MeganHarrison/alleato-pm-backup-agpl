"use client";

import * as React from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import { format, parse, isValid } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface InlineEditFieldOption {
  value: string;
  label: string;
}

export interface InlineEditFieldProps {
  /** Current value as a string (date → YYYY-MM-DD, boolean → "true"/"false"). */
  value: string;
  /** Optional rich read-mode display (e.g. a StatusBadge or formatted date). */
  display?: React.ReactNode;
  type?: "text" | "number" | "date" | "select" | "boolean" | "textarea";
  /** Options for type="select". For "boolean" these override the Yes/No default. */
  options?: InlineEditFieldOption[];
  placeholder?: string;
  emptyLabel?: string;
  /** Used in the success/error toast, e.g. "Start Date". */
  label?: string;
  /** Persist the new value. Throw to signal failure (the field reverts). */
  onSave: (value: string) => Promise<void>;
  disabled?: boolean;
  className?: string;
}

const BOOLEAN_OPTIONS: InlineEditFieldOption[] = [
  { value: "true", label: "Yes" },
  { value: "false", label: "No" },
];

/**
 * Click-to-edit field for detail pages. Renders as a read-only value with a
 * hover/focus edit affordance; clicking turns it into the matching editor
 * (text/number/date/select/boolean/textarea) that commits on blur/Enter/change
 * where appropriate and reverts (with a toast) if the save throws.
 */
export function InlineEditField({
  value,
  display,
  type = "text",
  options,
  placeholder,
  emptyLabel = "—",
  label,
  onSave,
  disabled,
  className,
}: InlineEditFieldProps): React.ReactElement {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const [saving, setSaving] = React.useState(false);

  // Keep the draft in sync with the source value when not actively editing.
  React.useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const isSelect = type === "select" || type === "boolean";
  const isTextarea = type === "textarea";
  const selectOptions = type === "boolean" ? (options ?? BOOLEAN_OPTIONS) : (options ?? []);

  const commit = React.useCallback(
    async (next: string) => {
      if (next === value) {
        setEditing(false);
        return;
      }
      setSaving(true);
      try {
        await onSave(next);
        toast.success(`${label ? `${label} ` : ""}updated`);
        setEditing(false);
      } catch (err) {
        toast.error(`Could not update${label ? ` ${label}` : ""}`, {
          description: err instanceof Error ? err.message : undefined,
        });
        setDraft(value);
        setEditing(false);
      } finally {
        setSaving(false);
      }
    },
    [value, onSave, label],
  );

  if (disabled) {
    return <>{display ?? (value || emptyLabel)}</>;
  }

  if (!editing) {
    return (
      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        title="Click to edit"
        className={cn(
          "group/inline-edit -mx-1.5 -my-0.5 flex h-auto w-full items-center justify-start rounded px-1.5 py-0.5 text-left text-sm !font-normal hover:bg-muted/60 focus-visible:bg-muted/60",
          className,
        )}
      >
        <span
          className={cn(
            "min-w-0 flex-1",
            isTextarea ? "whitespace-pre-wrap text-left leading-relaxed" : "truncate",
          )}
        >
          {display ?? (value || <span className="text-muted-foreground/60">{emptyLabel}</span>)}
        </span>
        <Pencil
          aria-hidden="true"
          className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground/60 opacity-0 transition-opacity group-hover/inline-edit:opacity-100 group-focus-visible/inline-edit:opacity-100"
        />
      </Button>
    );
  }

  if (isSelect) {
    return (
      <Select
        value={draft}
        open
        onOpenChange={(isOpen) => {
          if (!isOpen) setEditing(false);
        }}
        onValueChange={(next) => {
          setDraft(next);
          void commit(next);
        }}
        disabled={saving}
      >
        <SelectTrigger className={cn("h-7 w-full", className)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {selectOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (type === "textarea") {
    return (
      <Textarea
        autoFocus
        value={draft}
        disabled={saving}
        placeholder={placeholder}
        className={cn("min-h-24 w-full", className)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit(draft)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            void commit(draft);
          }
          if (event.key === "Escape") {
            event.preventDefault();
            setDraft(value);
            setEditing(false);
          }
        }}
      />
    );
  }

  if (type === "date") {
    const parseDateDraft = (v: string): Date | undefined => {
      if (!v) return undefined;
      const parts = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (parts) return new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
      const parsed = parse(v, "MM/dd/yyyy", new Date());
      return isValid(parsed) ? parsed : undefined;
    };
    const dateValue = parseDateDraft(draft);

    return (
      <div className={cn("flex gap-1", className)}>
        <Input
          autoFocus
          value={draft}
          disabled={saving}
          placeholder={placeholder ?? "YYYY-MM-DD"}
          className="h-7 w-full"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => void commit(draft)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void commit(draft);
            }
            if (event.key === "Escape") {
              event.preventDefault();
              setDraft(value);
              setEditing(false);
            }
          }}
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={saving}
              className="h-7 w-7 shrink-0"
              aria-label="Open calendar"
            >
              <CalendarIcon className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={dateValue}
              onSelect={(date) => {
                const next = date ? format(date, "yyyy-MM-dd") : "";
                setDraft(next);
                void commit(next);
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <Input
      type={type === "number" ? "number" : "text"}
      autoFocus
      value={draft}
      disabled={saving}
      placeholder={placeholder}
      className={cn("h-7 w-full", className)}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => void commit(draft)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          void commit(draft);
        }
        if (event.key === "Escape") {
          event.preventDefault();
          setDraft(value);
          setEditing(false);
        }
      }}
    />
  );
}
