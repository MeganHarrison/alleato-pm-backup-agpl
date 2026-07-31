"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Check, X, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EditableCellProps {
  value: string | number | null | undefined;
  onSave: (value: string) => Promise<void>;
  className?: string;
  type?: "text" | "number" | "date" | "select";
  placeholder?: string;
  /** Options for `type="select"` — value is what gets saved, label is shown. */
  options?: Array<{ value: string; label: string }>;
  /** Optional formatter for the read-only display (e.g. currency). */
  formatDisplay?: (value: string | number | null | undefined) => string;
}

export function EditableCell({
  value,
  onSave,
  className,
  type = "text",
  placeholder = "Click to edit",
  options,
  formatDisplay,
}: EditableCellProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(value?.toString() || "");
  const [isSaving, setIsSaving] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const selectRef = React.useRef<HTMLSelectElement>(null);

  const displayValue = formatDisplay
    ? formatDisplay(value)
    : value?.toString() || "-";

  React.useEffect(() => {
    setEditValue(value?.toString() || "");
  }, [value]);

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
    if (isEditing && selectRef.current) {
      selectRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (editValue === value?.toString()) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(editValue);
      setIsEditing(false);
    } catch (error) {
      setEditValue(value?.toString() || "");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value?.toString() || "");
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div
        className="flex items-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        {type === "select" ? (
          <select
            ref={selectRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            disabled={isSaving}
            className={cn(
              "flex-1 px-2 py-1 text-sm border border-border rounded bg-background",
              "focus:outline-none focus:ring-1 focus:ring-ring",
              "disabled:opacity-50",
              className,
            )}
          >
            <option value="">{placeholder}</option>
            {(options ?? []).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            ref={inputRef}
            type={type}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            disabled={isSaving}
            className={cn(
              "flex-1 px-2 py-1 text-sm border border-border rounded",
              "focus:outline-none focus:ring-1 focus:ring-ring",
              "disabled:opacity-50",
              className,
            )}
            placeholder={placeholder}
          />
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            handleSave();
          }}
          disabled={isSaving}
          className="h-7 w-7 text-green-600 hover:bg-green-50"
        >
          <Check className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            handleCancel();
          }}
          disabled={isSaving}
          className="h-7 w-7 text-red-600 hover:bg-red-50"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      className={cn(
        "group cursor-pointer px-2 py-1 rounded hover:bg-muted transition-colors flex items-center justify-between gap-2",
        value == null && "text-muted-foreground italic",
        className,
      )}
    >
      <span className="flex-1">{displayValue}</span>
      <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
    </div>
  );
}
