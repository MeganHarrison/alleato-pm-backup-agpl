"use client";

import * as React from "react";
import type { ReactElement } from "react";
import { X, ChevronUp, ChevronDown, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

// Types
export interface DetailFieldConfig {
  id: string;
  label: string;
  type: "text" | "textarea" | "select" | "date" | "number" | "readonly";
  options?: { value: string; label: string }[];
  editable?: boolean;
  fullWidth?: boolean;
  placeholder?: string;
}

export interface RelatedSectionConfig {
  id: string;
  label: string;
  count: number;
  onClick?: () => void;
}

export interface DetailPanelProps<T> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: T | null;
  title: string;
  fields: DetailFieldConfig[];
  relatedSections?: RelatedSectionConfig[];
  onSave: (data: Partial<T>) => Promise<void>;
  onDelete?: (item: T) => Promise<void>;
  onNavigate?: (direction: "prev" | "next") => void;
  canNavigatePrev?: boolean;
  canNavigateNext?: boolean;
  width?: number;
}

// Field renderer
function FieldRenderer<T extends Record<string, unknown>>({
  field,
  value,
  onChange,
}: {
  field: DetailFieldConfig;
  value: unknown;
  onChange: (value: unknown) => void;
}): ReactElement {
  const isEditable = field.editable !== false;
  const stringValue =
    typeof value === "string" ? value : value == null ? "" : String(value);

  switch (field.type) {
    case "readonly":
      return (
        <div className="text-sm py-2 px-4 bg-muted/50 rounded-md">
          {value == null || value === "" ? "-" : String(value)}
        </div>
      );

    case "textarea":
      return (
        <Textarea
          value={stringValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={!isEditable}
          className="min-h-20 resize-none"
        />
      );

    case "select":
      return (
        <Select
          value={stringValue}
          onValueChange={(nextValue) => onChange(nextValue)}
          disabled={!isEditable}
        >
          <SelectTrigger>
            <SelectValue placeholder={field.placeholder || `Select ${field.label}`} />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "date":
      return (
        <Input
          type="date"
          value={stringValue}
          onChange={(e) => onChange(e.target.value)}
          disabled={!isEditable}
        />
      );

    case "number":
      return (
        <Input
          type="number"
          value={stringValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={!isEditable}
        />
      );

    default:
      return (
        <Input
          type="text"
          value={stringValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={!isEditable}
        />
      );
  }
}

// Get nested value from object (supports "company.name" syntax)
function getNestedValue(
  obj: Record<string, unknown> | null,
  path: string,
): unknown {
  return path.split(".").reduce((acc: unknown, part: string) => {
    if (acc && typeof acc === "object" && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj ?? null);
}

// Set nested value in object
function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const parts = path.split(".");
  const result: Record<string, unknown> = { ...obj };
  let current: Record<string, unknown> = result;

  for (let i = 0; i < parts.length - 1; i++) {
    const next = current[parts[i]];
    const nextObject =
      typeof next === "object" && next !== null
        ? (next as Record<string, unknown>)
        : {};
    current[parts[i]] = { ...nextObject };
    current = current[parts[i]] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
  return result;
}

export function DetailPanel<T extends Record<string, unknown>>({
  open,
  onOpenChange,
  item,
  title,
  fields,
  relatedSections = [],
  onSave,
  onDelete,
  onNavigate,
  canNavigatePrev = false,
  canNavigateNext = false,
  width = 480,
}: DetailPanelProps<T>): ReactElement {
  const [formData, setFormData] = React.useState<Partial<T>>({});
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [hasChanges, setHasChanges] = React.useState(false);

  // Reset form when item changes
  React.useEffect(() => {
    if (item) {
      setFormData(item as Partial<T>);
      setHasChanges(false);
      return;
    }

    if (open) {
      setFormData({});
      setHasChanges(false);
    }
  }, [item, open]);

  // Keyboard navigation
  React.useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
      } else if (e.key === "ArrowUp" && onNavigate && canNavigatePrev) {
        e.preventDefault();
        onNavigate("prev");
      } else if (e.key === "ArrowDown" && onNavigate && canNavigateNext) {
        e.preventDefault();
        onNavigate("next");
      } else if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange, onNavigate, canNavigatePrev, canNavigateNext]);

  const handleFieldChange = (fieldId: string, value: unknown) => {
    setFormData((prev) =>
      setNestedValue(prev as Record<string, unknown>, fieldId, value) as Partial<T>,
    );
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!hasChanges || isSaving) return;
    setIsSaving(true);
    try {
      await onSave(formData);
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!item || !onDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      await onDelete(item);
      onOpenChange(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="p-0 flex flex-col bg-card"
        style={{ width: `${width}px`, maxWidth: "100vw" }}
      >
        {/* Header */}
        <SheetHeader className="px-4 py-4 shrink-0 bg-card">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base font-semibold truncate pr-2">
              {title}
            </SheetTitle>
            <div className="flex items-center gap-1">
              {onNavigate && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={!canNavigatePrev}
                    onClick={() => onNavigate("prev")}
                  >
                    <ChevronUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={!canNavigateNext}
                    onClick={() => onNavigate("next")}
                  >
                    <ChevronDown />
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetHeader>

        {/* Form content */}
        <ScrollArea className="flex-1 bg-muted/20">
          <div className="space-y-4 bg-muted/20 p-4">
            {fields.map((field) => (
              <div
                key={field.id}
                className={cn(field.fullWidth ? "col-span-2" : "")}
              >
                <Label
                  htmlFor={field.id}
                  className="text-xs font-medium text-muted-foreground mb-1.5 block"
                >
                  {field.label}
                </Label>
                <FieldRenderer
                  field={field}
                  value={getNestedValue(formData, field.id)}
                  onChange={(value) => handleFieldChange(field.id, value)}
                />
              </div>
            ))}

            {/* Related sections */}
            {relatedSections.length > 0 && (
              <>
                <Separator className="my-4" />
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Related
                  </Label>
                  {relatedSections.map((section) => (
                    <Button
                      key={section.id}
                      type="button"
                      variant="ghost"
                      onClick={section.onClick}
                      className="h-auto w-full justify-between rounded-md px-4 py-2 text-sm hover:bg-muted/50"
                    >
                      <span>{section.label}</span>
                      <span className="text-muted-foreground">
                        {section.count}
                      </span>
                    </Button>
                  ))}
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex flex-shrink-0 items-center justify-between border-t bg-muted/20 px-4 py-4">
          {onDelete ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {title}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete
                    this item and remove it from our servers.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <div />
          )}

          <Button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            size="sm"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
