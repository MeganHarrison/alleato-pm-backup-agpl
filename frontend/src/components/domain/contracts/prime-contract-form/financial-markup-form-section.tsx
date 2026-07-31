"use client";

import * as React from "react";
import { CircleHelp, MoreVertical, Percent } from "lucide-react";
import { toast } from "sonner";

import { InlineAddButton } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  InlineTable,
  InlineTableHeader,
  InlineTableHeaderRow,
  InlineTableHeaderCell,
  InlineTableBody,
  InlineTableRow,
  InlineTableCell,
} from "@/components/ds/inline-table";
import { FormSection } from "@/components/forms/FormSection";
import { formatPercent } from "@/lib/format";
import type { BudgetCode, MarkupFormItem } from "./types";

const ALLOWED_MARKUP_TYPES = [
  "insurance",
  "bond",
  "fee",
  "overhead",
  "custom",
] as const;

const toMarkupLabel = (value: string): string =>
  value
    .split("_")
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");

const getNextAvailableMarkupType = (rows: MarkupFormItem[]): string | null => {
  const used = new Set(rows.map((r) => r.markup_type.trim().toLowerCase()));
  for (const type of ALLOWED_MARKUP_TYPES) {
    if (!used.has(type)) return type;
  }
  return null;
};

interface FinancialMarkupFormSectionProps {
  markups: MarkupFormItem[];
  budgetCodes: BudgetCode[];
  onChange: (markups: MarkupFormItem[]) => void;
}

export function FinancialMarkupFormSection({
  markups,
  budgetCodes,
  onChange,
}: FinancialMarkupFormSectionProps) {
  const [editingIds, setEditingIds] = React.useState<Record<string, boolean>>(
    () => Object.fromEntries(markups.map((m) => [m.id, true])),
  );

  const sorted = React.useMemo(
    () => [...markups].sort((a, b) => a.calculation_order - b.calculation_order),
    [markups],
  );

  const updateMarkup = <K extends keyof MarkupFormItem>(
    id: string,
    field: K,
    value: MarkupFormItem[K],
  ) => {
    onChange(markups.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
  };

  const addMarkup = () => {
    const nextType = getNextAvailableMarkupType(markups);
    if (!nextType) {
      toast.error("All available markup types are already added.");
      return;
    }
    const newMarkup: MarkupFormItem = {
      id: `markup-new-${Date.now()}`,
      markup_type: nextType,
      percentage: 0,
      compound: true,
      calculation_order: markups.length + 1,
      display_in: "horizontal",
      maps_to: "all",
    };
    onChange([...markups, newMarkup]);
    setEditingIds((prev) => ({ ...prev, [newMarkup.id]: true }));
  };

  const removeMarkup = (id: string) => {
    const next = markups
      .filter((m) => m.id !== id)
      .map((m, i) => ({ ...m, calculation_order: i + 1 }));
    onChange(next);
    setEditingIds((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const startEdit = (id: string) =>
    setEditingIds((prev) => ({ ...prev, [id]: true }));

  const finishEdit = (id: string) =>
    setEditingIds((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });

  const renderTypeField = (m: MarkupFormItem, editing: boolean) =>
    editing ? (
      <Select
        value={m.markup_type}
        onValueChange={(v) => updateMarkup(m.id, "markup_type", v)}
      >
        <SelectTrigger size="sm" className="w-full text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ALLOWED_MARKUP_TYPES.map((t) => (
            <SelectItem key={t} value={t} className="capitalize">
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    ) : (
      <span className="text-sm text-foreground">{toMarkupLabel(m.markup_type)}</span>
    );

  const renderDisplayField = (m: MarkupFormItem, editing: boolean) =>
    editing ? (
      <Select
        value={m.display_in}
        onValueChange={(v) =>
          updateMarkup(m.id, "display_in", v as "horizontal" | "vertical")
        }
      >
        <SelectTrigger size="sm" className="w-full text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="horizontal">Horizontal</SelectItem>
          <SelectItem value="vertical">Vertical</SelectItem>
        </SelectContent>
      </Select>
    ) : (
      <span className="text-sm capitalize text-foreground">{m.display_in}</span>
    );

  const renderMapsToField = (m: MarkupFormItem, editing: boolean) => {
    const label =
      m.maps_to === "all"
        ? "All Budget Codes"
        : (budgetCodes.find((c) => c.id === m.maps_to)?.fullLabel ??
          "All Budget Codes");
    return editing ? (
      <Select
        value={m.maps_to}
        onValueChange={(v) => updateMarkup(m.id, "maps_to", v)}
      >
        <SelectTrigger size="sm" className="w-full text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Budget Codes</SelectItem>
          {budgetCodes.map((code) => (
            <SelectItem key={code.id} value={code.id}>
              {code.fullLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    ) : (
      <span className="text-sm text-foreground">{label}</span>
    );
  };

  const renderPercentField = (m: MarkupFormItem, editing: boolean) =>
    editing ? (
      <Input
        type="number"
        min="0"
        max="100"
        step="0.001"
        value={String(m.percentage)}
        onChange={(e) =>
          updateMarkup(m.id, "percentage", Number(e.target.value || 0))
        }
        className="h-8 text-right"
      />
    ) : (
      <span className="text-sm text-foreground">
        {formatPercent(m.percentage, 2)}
      </span>
    );

  const renderCalcTypeField = (m: MarkupFormItem, editing: boolean) =>
    editing ? (
      <Select
        value={m.compound ? "compound" : "basic"}
        onValueChange={(v) =>
          updateMarkup(m.id, "compound", v === "compound")
        }
      >
        <SelectTrigger size="sm" className="w-full text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="basic">Basic Calculation</SelectItem>
          <SelectItem value="compound">Compounds All Above</SelectItem>
        </SelectContent>
      </Select>
    ) : (
      <span className="text-sm text-foreground">
        {m.compound ? "Compounds All Above" : "Basic Calculation"}
      </span>
    );

  const renderActions = (m: MarkupFormItem, editing: boolean) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Actions for ${m.markup_type}`}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {editing ? (
          <DropdownMenuItem onClick={() => finishEdit(m.id)}>
            Done editing
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => startEdit(m.id)}>
            Edit
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => removeMarkup(m.id)}
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <FormSection
      title="Financial Markup"
      description={
        <span className="inline-flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="inline-flex text-muted-foreground"
                aria-label="Financial Markup help"
              >
                <CircleHelp className="size-3.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-72">
              <p>
                Configure percentage-based markups that will be added as line items
                to the schedule of values.
              </p>
            </TooltipContent>
          </Tooltip>
        </span>
      }
      actions={
        <InlineAddButton
          type="button"
          onClick={addMarkup}
          disabled={markups.length >= ALLOWED_MARKUP_TYPES.length}
        >
          Add Markup
        </InlineAddButton>
      }
    >
      {markups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Percent className="h-8 w-8 text-muted-foreground/40" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">No markups configured</p>
            <p className="text-sm text-muted-foreground">
              Add markups to automatically include fee and insurance line items in the SOV.
            </p>
          </div>
          <InlineAddButton onClick={addMarkup}>
            Add Markup
          </InlineAddButton>
        </div>
      ) : (
        <>
          {/* Mobile card view */}
          <div className="space-y-3 md:hidden">
            {sorted.map((m, index) => {
              const editing = Boolean(editingIds[m.id]);
              return (
                <div
                  key={m.id}
                  className="space-y-3 rounded-md bg-muted/30 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Markup {index + 1}
                      </p>
                      {renderTypeField(m, editing)}
                    </div>
                    {renderActions(m, editing)}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Display In
                      </p>
                      {renderDisplayField(m, editing)}
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Percent
                      </p>
                      {renderPercentField(m, editing)}
                    </div>
                    <div className="col-span-2 space-y-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Maps To
                      </p>
                      {renderMapsToField(m, editing)}
                    </div>
                    <div className="col-span-2 space-y-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Calculation Type
                      </p>
                      {renderCalcTypeField(m, editing)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table view */}
          <div className="hidden md:block">
            <InlineTable variant="edit">
              <InlineTableHeader>
                <InlineTableHeaderRow>
                  <InlineTableHeaderCell align="right">#</InlineTableHeaderCell>
                  <InlineTableHeaderCell>Markup Name</InlineTableHeaderCell>
                  <InlineTableHeaderCell>Display In</InlineTableHeaderCell>
                  <InlineTableHeaderCell>Maps To</InlineTableHeaderCell>
                  <InlineTableHeaderCell align="right">%</InlineTableHeaderCell>
                  <InlineTableHeaderCell>Calculation Type</InlineTableHeaderCell>
                  <InlineTableHeaderCell align="right">Actions</InlineTableHeaderCell>
                </InlineTableHeaderRow>
              </InlineTableHeader>
              <InlineTableBody>
                {sorted.map((m, index) => {
                  const editing = Boolean(editingIds[m.id]);
                  return (
                    <InlineTableRow key={m.id}>
                      <InlineTableCell align="right">{index + 1}</InlineTableCell>
                      <InlineTableCell>{renderTypeField(m, editing)}</InlineTableCell>
                      <InlineTableCell>{renderDisplayField(m, editing)}</InlineTableCell>
                      <InlineTableCell>{renderMapsToField(m, editing)}</InlineTableCell>
                      <InlineTableCell align="right">{renderPercentField(m, editing)}</InlineTableCell>
                      <InlineTableCell>{renderCalcTypeField(m, editing)}</InlineTableCell>
                      <InlineTableCell align="right">{renderActions(m, editing)}</InlineTableCell>
                    </InlineTableRow>
                  );
                })}
              </InlineTableBody>
            </InlineTable>
          </div>
        </>
      )}
    </FormSection>
  );
}
