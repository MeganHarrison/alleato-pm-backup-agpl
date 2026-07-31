"use client";

import * as React from "react";

import { appToast as toast } from "@/lib/toast/app-toast";
import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/forms/SearchableSelect";

export interface BulkEditFieldOption {
  value: string;
  label: string;
}

/**
 * A single field a table exposes for bulk editing. Mirrors the inline-edit
 * column contract: "text" renders an `<Input>` (honouring `inputType`), and
 * "select" renders a dropdown (a searchable one when `searchable` is set, for
 * long option lists such as projects).
 */
export interface BulkEditField {
  id: string;
  label: string;
  type?: "text" | "select";
  /** Options for `type: "select"`. */
  options?: BulkEditFieldOption[];
  /** Use the searchable combobox instead of a plain select (long lists). */
  searchable?: boolean;
  /** Input type for `type: "text"` (e.g. "date", "number"). */
  inputType?: React.HTMLInputTypeAttribute;
  placeholder?: string;
}

export interface BulkEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Number of rows the change will be applied to. */
  selectedCount: number;
  /** Singular noun for the selected rows (e.g. "meeting"). Defaults to "row". */
  itemNoun?: string;
  fields: BulkEditField[];
  /**
   * Applies the chosen value to every selected row. Resolves when the write
   * succeeds; throws to surface an error and keep the dialog open.
   */
  onApply: (fieldId: string, value: string) => void | Promise<void>;
}

function resolveFieldType(field: BulkEditField): "text" | "select" {
  if (field.type) return field.type;
  return field.options && field.options.length > 0 ? "select" : "text";
}

/**
 * Generic "edit N selected rows" dialog shared by every unified table page.
 * The table supplies the editable fields and a write handler; this component
 * owns the field picker, the value editor, and the apply/cancel flow.
 */
export function BulkEditDialog({
  open,
  onOpenChange,
  selectedCount,
  itemNoun = "row",
  fields,
  onApply,
}: BulkEditDialogProps): React.ReactElement | null {
  const [fieldId, setFieldId] = React.useState<string>(fields[0]?.id ?? "");
  const [value, setValue] = React.useState<string>("");
  const [isSaving, setIsSaving] = React.useState(false);

  // Reset the form each time the dialog opens so a prior edit never leaks in.
  React.useEffect(() => {
    if (open) {
      setFieldId((prev) =>
        fields.some((field) => field.id === prev) ? prev : fields[0]?.id ?? "",
      );
      setValue("");
      setIsSaving(false);
    }
  }, [open, fields]);

  const activeField =
    fields.find((field) => field.id === fieldId) ?? fields[0] ?? null;

  if (fields.length === 0 || !activeField) return null;

  const fieldType = resolveFieldType(activeField);
  const noun = selectedCount === 1 ? itemNoun : `${itemNoun}s`;
  // Text fields may clear a value (empty is meaningful); selects must pick one.
  const canApply =
    !isSaving && (fieldType === "text" || value.trim().length > 0);

  const handleApply = async () => {
    if (!canApply) return;
    setIsSaving(true);
    try {
      await onApply(activeField.id, value);
      onOpenChange(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to apply changes";
      toast.error(message);
      reportNonCriticalFailure({
        area: "unified-table-page",
        operation: "bulk-edit-apply",
        error,
        userVisibleFallback: message,
        metadata: { fieldId: activeField.id, selectedCount },
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (isSaving ? null : onOpenChange(next))}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Edit {selectedCount} selected {noun}
          </DialogTitle>
          <DialogDescription>
            Choose a field and set a new value. The change applies to all{" "}
            {selectedCount} selected {noun}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {fields.length > 1 ? (
            <div className="space-y-2">
              <Label htmlFor="bulk-edit-field">Field</Label>
              <Select
                value={fieldId}
                onValueChange={(next) => {
                  setFieldId(next);
                  setValue("");
                }}
              >
                <SelectTrigger id="bulk-edit-field">
                  <SelectValue placeholder="Select a field" />
                </SelectTrigger>
                <SelectContent>
                  {fields.map((field) => (
                    <SelectItem key={field.id} value={field.id}>
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="bulk-edit-value">{activeField.label}</Label>
            {fieldType === "select" ? (
              activeField.searchable ? (
                <SearchableSelect
                  options={activeField.options ?? []}
                  value={value}
                  onValueChange={setValue}
                  placeholder={activeField.placeholder ?? "Select…"}
                  searchPlaceholder="Search…"
                  className="w-full"
                  triggerClassName="w-full"
                />
              ) : (
                <Select value={value} onValueChange={setValue}>
                  <SelectTrigger id="bulk-edit-value">
                    <SelectValue
                      placeholder={activeField.placeholder ?? "Select…"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(activeField.options ?? []).map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )
            ) : (
              <Input
                id="bulk-edit-value"
                type={activeField.inputType ?? "text"}
                value={value}
                placeholder={activeField.placeholder}
                onChange={(event) => setValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleApply();
                  }
                }}
                autoFocus
              />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={() => void handleApply()} disabled={!canApply}>
            {isSaving
              ? "Applying…"
              : `Apply to ${selectedCount} ${noun}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
