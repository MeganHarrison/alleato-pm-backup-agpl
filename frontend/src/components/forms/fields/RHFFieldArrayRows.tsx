"use client";

import * as React from "react";
import {
  type Control,
  type FieldArray,
  type FieldArrayPath,
  type FieldValues,
  useFieldArray,
} from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RowColumn<
  TFieldValues extends FieldValues,
  TName extends FieldArrayPath<TFieldValues>,
> = {
  key: string;
  className?: string;
  cell: (args: {
    index: number;
    rowName: `${TName}.${number}`;
  }) => React.ReactNode;
};

interface RHFFieldArrayRowsProps<
  TFieldValues extends FieldValues,
  TName extends FieldArrayPath<TFieldValues>,
> {
  control: Control<TFieldValues>;
  name: TName;
  columns: RowColumn<TFieldValues, TName>[];
  createRow: () => FieldArray<TFieldValues, TName>;
  addLabel?: string;
  minRows?: number;
  className?: string;
  rowClassName?: string;
  removeLabel?: (index: number) => string;
  addButtonClassName?: string;
}

export function RHFFieldArrayRows<
  TFieldValues extends FieldValues,
  TName extends FieldArrayPath<TFieldValues>,
>({
  control,
  name,
  columns,
  createRow,
  addLabel = "Add Row",
  minRows = 1,
  className,
  rowClassName,
  removeLabel = (index) => `Remove row ${index + 1}`,
  addButtonClassName,
}: RHFFieldArrayRowsProps<TFieldValues, TName>) {
  const { fields, append, remove } = useFieldArray({
    control,
    name,
  });

  React.useEffect(() => {
    if (fields.length === 0 && minRows > 0) {
      for (let i = 0; i < minRows; i += 1) {
        append(createRow());
      }
    }
  }, [append, createRow, fields.length, minRows]);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="space-y-2">
        {fields.map((field, index) => {
          const rowName = `${name}.${index}` as `${TName}.${number}`;

          return (
            <div
              key={field.id}
              className={cn(
                "flex flex-col gap-2 sm:flex-row sm:items-start",
                rowClassName,
              )}
            >
              {columns.map((column) => (
                <div
                  key={column.key}
                  className={cn("min-w-0 flex-1", column.className)}
                >
                  {column.cell({ index, rowName })}
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(index)}
                disabled={fields.length <= minRows}
                aria-label={removeLabel(index)}
                className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => append(createRow())}
        className={cn("w-full sm:w-auto", addButtonClassName)}
      >
        <Plus className="h-4 w-4" />
        {addLabel}
      </Button>
    </div>
  );
}
