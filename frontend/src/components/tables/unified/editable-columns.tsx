"use client";

import type { HTMLInputTypeAttribute } from "react";

import {
  InlineSelectEditor,
  type InlineSelectOption,
} from "./inline-select-editor";
import type { TableColumn } from "./unified-table-page";

type EditCommit<T> = (item: T, value: string) => void | Promise<void>;

interface EditableColumnOptions<T> {
  getValue: (item: T) => string | number | null | undefined;
  onEdit: EditCommit<T>;
  emptyLabel?: string;
}

interface EditableTextColumnOptions<T> extends EditableColumnOptions<T> {
  inputType?: HTMLInputTypeAttribute;
}

interface EditableSelectColumnOptions<T> extends EditableColumnOptions<T> {
  options: InlineSelectOption[] | ((item: T) => InlineSelectOption[]);
  placeholder?: string;
  searchable?: boolean;
}

function stringifyEditValue(value: string | number | null | undefined) {
  return value == null ? "" : String(value);
}

export function editableTextColumn<T>(
  column: TableColumn<T>,
  options: EditableTextColumnOptions<T>,
): TableColumn<T> {
  return {
    ...column,
    editable: true,
    editType: "text",
    editInputType: options.inputType,
    editEmptyLabel: options.emptyLabel,
    editValue: (item) => stringifyEditValue(options.getValue(item)),
    onEdit: options.onEdit,
  };
}

export function editableSelectColumn<T>(
  column: TableColumn<T>,
  options: EditableSelectColumnOptions<T>,
): TableColumn<T> {
  const common = {
    ...column,
    editable: true,
    editEmptyLabel: options.emptyLabel,
    editValue: (item: T) => stringifyEditValue(options.getValue(item)),
    onEdit: options.onEdit,
  };

  const optionsList = options.options;

  if (Array.isArray(optionsList)) {
    return {
      ...common,
      editType: "select",
      editOptions: optionsList,
    };
  }

  // Captured in a local so the narrowing above survives inside the
  // renderEditor closure (TS drops property narrowing across closures).
  const resolveOptions = optionsList;

  return {
    ...common,
    renderEditor: ({ item, value, onChange, onCommit }) => (
      <InlineSelectEditor
        value={value}
        options={resolveOptions(item)}
        placeholder={options.placeholder ?? options.emptyLabel}
        searchable={options.searchable}
        onChange={onChange}
        onCommit={onCommit}
      />
    ),
  };
}

export function createInlinePatchHandler<T, TField extends string>({
  update,
  normalizeValue = (_field, value) => (value === "" ? null : value),
}: {
  update: (
    item: T,
    patch: Partial<Record<TField, string | null>>,
  ) => void | Promise<void>;
  normalizeValue?: (field: TField, value: string) => string | null;
}) {
  return (item: T, field: TField, value: string) =>
    update(item, { [field]: normalizeValue(field, value) } as Partial<
      Record<TField, string | null>
    >);
}

export type { InlineSelectOption };
