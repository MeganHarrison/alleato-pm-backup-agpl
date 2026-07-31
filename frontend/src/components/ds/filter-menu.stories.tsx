import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterCheckboxRow, FilterMenu, FilterMenuGroup } from "./filter-menu";

const meta: Meta = {
  title: "Actions/FilterMenu",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;

function DefaultDemo() {
  const [statuses, setStatuses] = React.useState<string[]>([]);
  const toggle = (val: string) =>
    setStatuses((s) => s.includes(val) ? s.filter((x) => x !== val) : [...s, val]);

  return (
    <FilterMenu
      trigger={
        <Button variant="outline" size="sm">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filter
        </Button>
      }
      title="Filter by Status"
      hasActiveFilters={statuses.length > 0}
      onClear={() => setStatuses([])}
    >
      <FilterMenuGroup label="Status">
        {["Active", "Pending", "Draft", "Completed", "Void"].map((s) => (
          <FilterCheckboxRow
            key={s}
            checked={statuses.includes(s)}
            onCheckedChange={() => toggle(s)}
          >
            {s}
          </FilterCheckboxRow>
        ))}
      </FilterMenuGroup>
    </FilterMenu>
  );
}

function MultiGroupDemo() {
  const [statuses, setStatuses] = React.useState<string[]>(["Active"]);
  const [types, setTypes] = React.useState<string[]>([]);
  const toggleStatus = (v: string) =>
    setStatuses((s) => s.includes(v) ? s.filter((x) => x !== v) : [...s, v]);
  const toggleType = (v: string) =>
    setTypes((s) => s.includes(v) ? s.filter((x) => x !== v) : [...s, v]);
  const hasFilters = statuses.length > 0 || types.length > 0;

  return (
    <FilterMenu
      trigger={
        <Button variant="outline" size="sm">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters {hasFilters ? `(${statuses.length + types.length})` : ""}
        </Button>
      }
      title="Filters"
      hasActiveFilters={hasFilters}
      onClear={() => { setStatuses([]); setTypes([]); }}
      widthClassName="w-72"
    >
      <FilterMenuGroup label="Status">
        {["Active", "Pending", "Draft", "Void"].map((s) => (
          <FilterCheckboxRow key={s} checked={statuses.includes(s)} onCheckedChange={() => toggleStatus(s)}>
            {s}
          </FilterCheckboxRow>
        ))}
      </FilterMenuGroup>
      <FilterMenuGroup label="Contract Type">
        {["Lump Sum", "Cost Plus", "GMP", "Unit Price"].map((t) => (
          <FilterCheckboxRow key={t} checked={types.includes(t)} onCheckedChange={() => toggleType(t)}>
            {t}
          </FilterCheckboxRow>
        ))}
      </FilterMenuGroup>
    </FilterMenu>
  );
}

export const Default = { render: () => <DefaultDemo /> };
export const MultiGroup = { name: "Multiple filter groups", render: () => <MultiGroupDemo /> };
