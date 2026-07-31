"use client";

import * as React from "react";
import { X, Plus, Trash2, GripVertical, Eye, EyeOff, Lock } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, ApiError } from "@/lib/api-client";

import {
  BudgetOverlay,
  BudgetOverlayBody,
  BudgetOverlayFooter,
  BudgetOverlayHeader,
} from "@/components/ui/budget-overlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

import type {
  BudgetViewDefinition,
  CreateBudgetViewRequest,
  UpdateBudgetViewRequest,
} from "@/types/budget-views";
import { AVAILABLE_BUDGET_COLUMNS } from "@/types/budget-views";

interface BudgetViewsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  view?: BudgetViewDefinition | null;
  mode: "create" | "edit";
  onSuccess: () => void;
}

interface ColumnConfig {
  column_key: string;
  display_name?: string;
  display_order: number;
  width?: number;
  is_visible: boolean;
  is_locked: boolean;
}

export function BudgetViewsModal({
  open,
  onOpenChange,
  projectId,
  view,
  mode,
  onSuccess,
}: BudgetViewsModalProps) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [isDefault, setIsDefault] = React.useState(false);
  const [columns, setColumns] = React.useState<ColumnConfig[]>([]);
  const [availableColumns, setAvailableColumns] = React.useState<
    Array<(typeof AVAILABLE_BUDGET_COLUMNS)[number]>
  >([]);
  const [loading, setLoading] = React.useState(false);

  // Initialize form when view changes or modal opens
  React.useEffect(() => {
    if (open) {
      if (view && mode === "edit") {
        setName(view.name);
        setDescription(view.description || "");
        setIsDefault(view.is_default);

        // Convert view columns to column configs
        const configs: ColumnConfig[] =
          view.columns?.map((col) => ({
            column_key: col.column_key,
            display_name: col.display_name || undefined,
            display_order: col.display_order,
            width: col.width || undefined,
            is_visible: col.is_visible,
            is_locked: col.is_locked,
          })) || [];
        setColumns(configs);

        // Get columns not in the view
        const usedKeys = new Set(configs.map((c) => c.column_key));
        setAvailableColumns(
          AVAILABLE_BUDGET_COLUMNS.filter((col) => !usedKeys.has(col.key)),
        );
      } else {
        // Create mode - start with default columns
        const defaultColumns: ColumnConfig[] = AVAILABLE_BUDGET_COLUMNS.filter(
          (col) => col.defaultVisible,
        ).map((col, index) => ({
          column_key: col.key,
          display_order: index + 1,
          is_visible: true,
          is_locked: col.locked,
        }));
        setColumns(defaultColumns);

        const usedKeys = new Set(defaultColumns.map((c) => c.column_key));
        setAvailableColumns(
          AVAILABLE_BUDGET_COLUMNS.filter((col) => !usedKeys.has(col.key)),
        );
        setName("");
        setDescription("");
        setIsDefault(false);
      }
    }
  }, [open, view, mode]);

  const handleAddColumn = (columnKey: string) => {
    const column = AVAILABLE_BUDGET_COLUMNS.find((c) => c.key === columnKey);
    if (!column) return;

    const newColumn: ColumnConfig = {
      column_key: columnKey,
      display_order: columns.length + 1,
      is_visible: true,
      is_locked: column.locked,
    };

    setColumns([...columns, newColumn]);
    setAvailableColumns(availableColumns.filter((c) => c.key !== columnKey));
  };

  const handleRemoveColumn = (columnKey: string) => {
    const column = columns.find((c) => c.column_key === columnKey);
    if (!column || column.is_locked) return;

    setColumns(columns.filter((c) => c.column_key !== columnKey));

    const availableCol = AVAILABLE_BUDGET_COLUMNS.find(
      (c) => c.key === columnKey,
    );
    if (availableCol) {
      setAvailableColumns([...availableColumns, availableCol]);
    }
  };

  const handleToggleVisibility = (columnKey: string) => {
    setColumns(
      columns.map((col) =>
        col.column_key === columnKey
          ? { ...col, is_visible: !col.is_visible }
          : col,
      ),
    );
  };

  const handleMoveColumn = (columnKey: string, direction: "up" | "down") => {
    const index = columns.findIndex((c) => c.column_key === columnKey);
    if (index === -1) return;
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === columns.length - 1) return;

    const newColumns = [...columns];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    [newColumns[index], newColumns[targetIndex]] = [
      newColumns[targetIndex],
      newColumns[index],
    ];

    // Reorder display_order
    newColumns.forEach((col, idx) => {
      col.display_order = idx + 1;
    });

    setColumns(newColumns);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("View name is required");
      return;
    }

    if (columns.length === 0) {
      toast.error("At least one column is required");
      return;
    }

    setLoading(true);

    try {
      const url =
        mode === "create"
          ? `/api/projects/${projectId}/budget/views`
          : `/api/projects/${projectId}/budget/views/${view?.id}`;

      const method = mode === "create" ? "POST" : "PATCH";

      const payload: CreateBudgetViewRequest | UpdateBudgetViewRequest = {
        name: name.trim(),
        description: description.trim() || undefined,
        is_default: isDefault,
        columns: columns.map((col) => ({
          column_key: col.column_key,
          display_name: col.display_name,
          display_order: col.display_order,
          width: col.width,
          is_visible: col.is_visible,
          is_locked: col.is_locked,
        })),
      };

      await apiFetch(url, {
        method,
        body: JSON.stringify(payload),
      });

      toast.success(
        mode === "create"
          ? "View created successfully"
          : "View updated successfully",
      );
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? `Failed to save view: ${error.message}`
          : error instanceof Error
            ? `Failed to save view: ${error.message}`
            : "Failed to save view",
      );
    } finally {
      setLoading(false);
    }
  };

  const getColumnLabel = (columnKey: string): string => {
    const col = AVAILABLE_BUDGET_COLUMNS.find((c) => c.key === columnKey);
    return col?.label || columnKey;
  };

  return (
    <BudgetOverlay
      open={open}
      onOpenChange={onOpenChange}
      variant="sheet"
      size="lg"
      className="flex h-full flex-col"
    >
      <BudgetOverlayHeader
        title={
          mode === "create"
            ? "Create Budget View"
            : `Edit ${view?.name || "View"}`
        }
        description={
          mode === "create"
            ? "Configure which columns to display in your custom budget view."
            : "Update your budget view configuration."
        }
      />

      <BudgetOverlayBody className="px-4 py-4 sm:px-6">
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            {/* View Details */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">View Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Executive Summary"
                  disabled={view?.is_system}
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description of this view"
                  rows={2}
                  disabled={view?.is_system}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isDefault"
                  checked={isDefault}
                  onCheckedChange={(checked) =>
                    setIsDefault(checked as boolean)
                  }
                  disabled={view?.is_system}
                />
                <Label
                  htmlFor="isDefault"
                  className="font-normal cursor-pointer"
                >
                  Set as default view
                </Label>
              </div>
            </div>

            {/* Column Configuration */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Columns</Label>
                {availableColumns.length > 0 && (
                  <Select onValueChange={handleAddColumn}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Add column..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableColumns.map((col) => (
                        <SelectItem key={col.key} value={col.key}>
                          {col.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="border rounded-lg divide-y">
                {columns.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No columns added yet. Add columns from the dropdown above.
                  </div>
                ) : (
                  columns.map((col, index) => (
                    <div
                      key={col.column_key}
                      className="flex items-center gap-2 p-4 hover:bg-muted/50"
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 cursor-grab"
                        disabled={view?.is_system}
                      >
                        <GripVertical />
                      </Button>

                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {getColumnLabel(col.column_key)}
                        </div>
                        {col.is_locked && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Lock className="h-3 w-3" />
                            Required column
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMoveColumn(col.column_key, "up")}
                          disabled={index === 0 || view?.is_system}
                          className="h-8 w-8 p-0"
                        >
                          ↑
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleMoveColumn(col.column_key, "down")
                          }
                          disabled={
                            index === columns.length - 1 || view?.is_system
                          }
                          className="h-8 w-8 p-0"
                        >
                          ↓
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleVisibility(col.column_key)}
                          disabled={col.is_locked || view?.is_system}
                          className="h-8 w-8 p-0"
                        >
                          {col.is_visible ? <Eye /> : <EyeOff />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveColumn(col.column_key)}
                          disabled={col.is_locked || view?.is_system}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </BudgetOverlayBody>

      <BudgetOverlayFooter>
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={loading || view?.is_system}>
          {loading
            ? "Saving..."
            : mode === "create"
              ? "Create View"
              : "Save Changes"}
        </Button>
      </BudgetOverlayFooter>
    </BudgetOverlay>
  );
}
