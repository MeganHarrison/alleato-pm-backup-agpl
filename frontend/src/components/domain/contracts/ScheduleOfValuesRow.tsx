"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CostCodeSelector } from "./CostCodeSelector";
import type { SOVItem } from "./ScheduleOfValuesGrid";

interface ScheduleOfValuesRowProps {
  item: SOVItem;
  onChange: (updates: Partial<SOVItem>) => void;
  onRemove: () => void;
}

export function ScheduleOfValuesRow({
  item,
  onChange,
  onRemove,
}: ScheduleOfValuesRowProps) {
  const handleNumberChange = (field: keyof SOVItem, value: string) => {
    const numValue = parseFloat(value) || 0;
    onChange({ [field]: numValue });

    // Auto-calculate percentage when work or materials change
    if (field === "workCompleted" || field === "materialsStored") {
      const work = field === "workCompleted" ? numValue : item.workCompleted;
      const materials =
        field === "materialsStored" ? numValue : item.materialsStored;
      const total = work + materials;
      const percent =
        item.scheduledValue > 0 ? (total / item.scheduledValue) * 100 : 0;
      onChange({ percentComplete: Math.min(100, percent) });
    }
  };

  return (
    <tr className="border-b hover:bg-muted">
      <td className="px-4 py-2">
        <Input
          value={item.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Line item description"
          className="min-w-[200px]"
        />
      </td>
      <td className="px-4 py-2">
        <CostCodeSelector
          value={item.costCode || ""}
          onChange={(value) => onChange({ costCode: value })}
        />
      </td>
      <td className="px-4 py-2">
        <Input
          type="number"
          value={item.scheduledValue || ""}
          onChange={(e) => handleNumberChange("scheduledValue", e.target.value)}
          placeholder=""
          className="w-32 text-right"
        />
      </td>
      <td className="px-4 py-2">
        <Input
          type="number"
          value={item.workCompleted || ""}
          onChange={(e) => handleNumberChange("workCompleted", e.target.value)}
          placeholder=""
          className="w-32 text-right"
        />
      </td>
      <td className="px-4 py-2">
        <Input
          type="number"
          value={item.materialsStored || ""}
          onChange={(e) =>
            handleNumberChange("materialsStored", e.target.value)
          }
          placeholder=""
          className="w-32 text-right"
        />
      </td>
      <td className="px-4 py-2 text-right">
        <span className="font-medium">{item.percentComplete.toFixed(1)}%</span>
      </td>
      <td className="px-4 py-2 text-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="text-red-600 hover:text-red-700"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
}
