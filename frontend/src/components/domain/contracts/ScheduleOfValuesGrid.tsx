"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScheduleOfValuesRow } from "./ScheduleOfValuesRow";
import { cn } from "@/lib/utils";
import { SectionRuleHeading } from "@/components/layout/spacing";
import {
  InlineTable,
  InlineTableHeader,
  InlineTableHeaderRow,
  InlineTableHeaderCell,
  InlineTableBody,
  InlineTableRow,
  InlineTableCell,
  InlineTableFooter,
  InlineTableFooterRow,
  InlineTableFooterCell,
} from "@/components/ds/inline-table";

export interface SOVItem {
  id: string;
  description: string;
  costCode?: string;
  scheduledValue: number;
  workCompleted: number;
  materialsStored: number;
  percentComplete: number;
}

interface ScheduleOfValuesGridProps {
  values: SOVItem[];
  onChange: (values: SOVItem[]) => void;
  className?: string;
}

export function ScheduleOfValuesGrid({
  values,
  onChange,
  className,
}: ScheduleOfValuesGridProps) {
  const addRow = () => {
    const newRow: SOVItem = {
      id: `sov-${Date.now()}`,
      description: "",
      costCode: "",
      scheduledValue: 0,
      workCompleted: 0,
      materialsStored: 0,
      percentComplete: 0,
    };
    onChange([...values, newRow]);
  };

  const updateRow = (id: string, updates: Partial<SOVItem>) => {
    onChange(
      values.map((row) => (row.id === id ? { ...row, ...updates } : row)),
    );
  };

  const removeRow = (id: string) => {
    onChange(values.filter((row) => row.id !== id));
  };

  const totalScheduled = values.reduce(
    (sum, row) => sum + row.scheduledValue,
    0,
  );
  const totalCompleted = values.reduce(
    (sum, row) => sum + row.workCompleted,
    0,
  );
  const totalMaterials = values.reduce(
    (sum, row) => sum + row.materialsStored,
    0,
  );
  const totalCurrent = totalCompleted + totalMaterials;
  const overallPercent =
    totalScheduled > 0 ? (totalCurrent / totalScheduled) * 100 : 0;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <SectionRuleHeading label="Schedule of Values" />
        <Button onClick={addRow} size="sm">
          <Plus />
          Add Line Item
        </Button>
      </div>

      <InlineTable variant="edit">
        <InlineTableHeader>
          <InlineTableHeaderRow>
            <InlineTableHeaderCell>Description</InlineTableHeaderCell>
            <InlineTableHeaderCell>Cost Code</InlineTableHeaderCell>
            <InlineTableHeaderCell align="right">Scheduled Value</InlineTableHeaderCell>
            <InlineTableHeaderCell align="right">Work Completed</InlineTableHeaderCell>
            <InlineTableHeaderCell align="right">Materials Stored</InlineTableHeaderCell>
            <InlineTableHeaderCell align="right">% Complete</InlineTableHeaderCell>
            <InlineTableHeaderCell align="center">Actions</InlineTableHeaderCell>
          </InlineTableHeaderRow>
        </InlineTableHeader>
        <InlineTableBody>
          {values.length === 0 ? (
            <InlineTableRow>
              <InlineTableCell
                colSpan={7}
                className="py-8 text-center text-muted-foreground"
              >
                No line items added yet. Click &quot;Add Line Item&quot; to
                get started.
              </InlineTableCell>
            </InlineTableRow>
          ) : (
            values.map((row) => (
              <ScheduleOfValuesRow
                key={row.id}
                item={row}
                onChange={(updates) => updateRow(row.id, updates)}
                onRemove={() => removeRow(row.id)}
              />
            ))
          )}
        </InlineTableBody>
        {values.length > 0 && (
          <InlineTableFooter>
            <InlineTableFooterRow type="totals">
              <InlineTableFooterCell colSpan={2} align="right">Totals:</InlineTableFooterCell>
              <InlineTableFooterCell align="right" numeric>${totalScheduled.toLocaleString()}</InlineTableFooterCell>
              <InlineTableFooterCell align="right" numeric>${totalCompleted.toLocaleString()}</InlineTableFooterCell>
              <InlineTableFooterCell align="right" numeric>${totalMaterials.toLocaleString()}</InlineTableFooterCell>
              <InlineTableFooterCell align="right" numeric>{overallPercent.toFixed(1)}%</InlineTableFooterCell>
              <InlineTableFooterCell />
            </InlineTableFooterRow>
          </InlineTableFooter>
        )}
      </InlineTable>
    </div>
  );
}
