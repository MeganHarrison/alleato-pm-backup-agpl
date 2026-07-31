"use client";

import {
  CellDate,
  CellNumber,
  CellStatus,
  CellText,
  type ColumnConfig,
  type FilterConfig,
  type TableColumn,
} from "@/components/tables/unified";

import type {
  TrainingAdminColumnDefinition,
  TrainingAdminRecord,
  TrainingAdminReferenceOptions,
  TrainingAdminTableDefinition,
} from "./types";

function referenceLabel(
  referenceKey: string | undefined,
  value: unknown,
  references: TrainingAdminReferenceOptions,
) {
  if (value == null || value === "") return null;
  if (!referenceKey) return String(value);
  return (
    references[referenceKey]?.find((option) => option.value === String(value))
      ?.label ?? String(value)
  );
}

function displayValue(
  column: TrainingAdminColumnDefinition,
  value: unknown,
  references: TrainingAdminReferenceOptions,
) {
  if (column.kind === "reference") {
    return referenceLabel(column.referenceKey, value, references);
  }
  if (Array.isArray(value)) return value.join(", ");
  if (value && typeof value === "object") return JSON.stringify(value);
  if (value == null || value === "") return null;
  return String(value);
}

export function trainingAdminColumnConfigs(
  definition: TrainingAdminTableDefinition,
): ColumnConfig[] {
  return definition.columns.map((column) => ({
    id: column.key,
    label: column.label,
    alwaysVisible: column.alwaysVisible,
    defaultVisible: column.defaultVisible,
  }));
}

export function trainingAdminDefaultVisibleColumns(
  definition: TrainingAdminTableDefinition,
) {
  return trainingAdminColumnConfigs(definition)
    .filter((column) => column.alwaysVisible || column.defaultVisible)
    .map((column) => column.id);
}

export function buildTrainingAdminColumns(
  definition: TrainingAdminTableDefinition,
  references: TrainingAdminReferenceOptions,
): TableColumn<TrainingAdminRecord>[] {
  return definition.columns.map((column) => ({
    id: column.key,
    label: column.label,
    alwaysVisible: column.alwaysVisible,
    defaultVisible: column.defaultVisible,
    sortable: true,
    sortValue: (record) => {
      const value = record[column.key];
      if (column.kind === "reference") {
        return referenceLabel(column.referenceKey, value, references);
      }
      if (typeof value === "boolean") return value ? 1 : 0;
      if (typeof value === "number" || typeof value === "string") return value;
      return value == null ? "" : JSON.stringify(value);
    },
    csvValue: (record) =>
      displayValue(column, record[column.key], references) ?? "",
    render: (record) => {
      const value = record[column.key];
      if (column.kind === "number") {
        return (
          <CellNumber
            value={typeof value === "number" ? value : null}
            emptyLabel="-"
          />
        );
      }
      if (column.kind === "date") {
        return (
          <CellDate
            value={typeof value === "string" ? value : null}
            emptyLabel="-"
          />
        );
      }
      if (column.kind === "status") {
        return (
          <CellStatus
            value={
              value == null
                ? null
                : String(value).replaceAll("_", " ").replaceAll("-", " ")
            }
            emptyLabel="-"
          />
        );
      }
      if (column.kind === "boolean") {
        return <CellText value={value === true ? "Yes" : "No"} />;
      }
      return (
        <CellText
          value={displayValue(column, value, references)}
          emptyLabel="-"
        />
      );
    },
  }));
}

export function buildTrainingAdminFilters(
  definition: TrainingAdminTableDefinition,
  references: TrainingAdminReferenceOptions,
): FilterConfig[] {
  return (definition.filters ?? []).map((filter) => ({
    id: filter.key,
    label: filter.label,
    type: "select",
    options:
      filter.options ??
      (filter.referenceKey ? references[filter.referenceKey] ?? [] : []),
  }));
}

export function recordMatchesTrainingAdminFilters(
  record: TrainingAdminRecord,
  activeFilters: Record<string, unknown>,
) {
  return Object.entries(activeFilters).every(([key, expected]) => {
    if (expected == null || expected === "") return true;
    const actual = record[key];
    if (typeof actual === "boolean") return String(actual) === String(expected);
    if (typeof actual === "number") return String(actual) === String(expected);
    return actual === expected;
  });
}

export function recordMatchesTrainingAdminSearch(
  record: TrainingAdminRecord,
  definition: TrainingAdminTableDefinition,
  references: TrainingAdminReferenceOptions,
  search: string,
) {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  return definition.columns.some((column) => {
    const value = displayValue(column, record[column.key], references);
    return value?.toLowerCase().includes(query);
  });
}
