"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  order: number;
  width?: string;
}

interface ColumnManagerProps {
  columns: ColumnConfig[];
  onColumnsChange: (columns: ColumnConfig[]) => void;
  onClose: () => void;
}

interface SortableColumnItemProps {
  column: ColumnConfig;
  onToggle: (id: string) => void;
  disabled?: boolean;
}

/**
 * Renders a single draggable column row with a visibility checkbox and label.
 *
 * Displays a drag handle, a checkbox bound to the column's `visible` state, and the column label. Interaction is disabled when `disabled` is true; drag interactions are also disabled when the column is hidden.
 *
 * @param column - The column configuration to render (id, label, visible, order, optional width).
 * @param onToggle - Callback invoked with the column `id` when the visibility checkbox is toggled.
 * @param disabled - When true, disables the checkbox and drag handle for this item.
 * @returns A JSX element representing the sortable column item.
 */
function SortableColumnItem({
  column,
  onToggle,
  disabled,
}: SortableColumnItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.id,
    disabled: disabled || !column.visible,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-4 rounded-md p-4",
        isDragging && "opacity-50",
        !column.visible && "opacity-60",
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className={cn(
          "cursor-grab touch-none",
          !column.visible && "cursor-not-allowed opacity-30",
        )}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      <Checkbox
        id={column.id}
        checked={column.visible}
        onCheckedChange={() => onToggle(column.id)}
        disabled={disabled}
      />

      <Label
        htmlFor={column.id}
        className={cn(
          "flex-1 cursor-pointer select-none",
          !column.visible && "text-muted-foreground line-through",
        )}
      >
        {column.label}
      </Label>
    </div>
  );
}

/**
 * Renders a modal UI for previewing, reordering, and toggling visibility of table columns.
 *
 * @param columns - Initial array of column configurations shown in the manager
 * @param onColumnsChange - Called with the updated column configuration when the user saves changes
 * @param onClose - Callback invoked to close the dialog (used for both cancel and after save)
 * @returns The dialog React element that allows users to reset, reorder, toggle, cancel, or save column settings
 */
export function ColumnManager({
  columns,
  onColumnsChange,
  onClose,
}: ColumnManagerProps) {
  const [localColumns, setLocalColumns] = useState([...columns]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setLocalColumns((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        const newItems = arrayMove(items, oldIndex, newIndex);

        // Update order values
        return newItems.map((item, index) => ({
          ...item,
          order: index,
        }));
      });
    }
  };

  const handleToggle = (id: string) => {
    setLocalColumns((items) =>
      items.map((item) =>
        item.id === id ? { ...item, visible: !item.visible } : item,
      ),
    );
  };

  const handleReset = () => {
    const defaultColumns: ColumnConfig[] = [
      { id: "select", label: "", visible: true, order: 0, width: "40px" },
      { id: "name", label: "Name", visible: true, order: 1 },
      { id: "email", label: "Email", visible: true, order: 2 },
      { id: "phone", label: "Phone", visible: true, order: 3 },
      { id: "job_title", label: "Job Title", visible: true, order: 4 },
      { id: "company", label: "Company", visible: true, order: 5 },
      {
        id: "permission_template",
        label: "Permission",
        visible: true,
        order: 6,
      },
      { id: "invite_status", label: "Status", visible: true, order: 7 },
      { id: "actions", label: "", visible: true, order: 8, width: "80px" },
    ];
    setLocalColumns(defaultColumns);
  };

  const handleSave = () => {
    onColumnsChange(localColumns);
    onClose();
  };

  const visibleCount = localColumns.filter((c) => c.visible).length;
  const requiredColumns = ["select", "name", "actions"];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Customize Columns</DialogTitle>
          <DialogDescription>
            Show, hide, and reorder columns. Drag to reorder visible columns.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {visibleCount} of {localColumns.length} columns visible
            </p>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              Reset to default
            </Button>
          </div>

          <Separator className="mb-4" />

          <ScrollArea className="h-[300px] pr-4">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={localColumns.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1">
                  {localColumns.map((column) => (
                    <SortableColumnItem
                      key={column.id}
                      column={column}
                      onToggle={handleToggle}
                      disabled={requiredColumns.includes(column.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </ScrollArea>

          <Separator className="mt-4" />

          <p className="mt-4 text-xs text-muted-foreground">
            * Some columns cannot be hidden
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
