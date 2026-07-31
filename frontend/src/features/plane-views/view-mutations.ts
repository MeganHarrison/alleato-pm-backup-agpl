/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 *
 * Mutation helpers for the Plane-derived saved Views surface.
 */

import type {
  CreateSavedViewInput,
  SavedTableView,
  SavedViewFilterValue,
} from "@/hooks/use-saved-table-views";

export type ProjectTaskViewEditorValues = {
  name: string;
  description: string;
  layout: "list" | "board";
  status: "open" | "done";
  priority: "" | "low" | "medium" | "high" | "urgent";
  dueDateFrom: string;
  dueDateTo: string;
  isDefault: boolean;
};

function optionalText(value: string): string | null {
  const normalized = value.trim();
  return normalized ? normalized : null;
}

export function buildProjectTaskViewFilters(
  values: ProjectTaskViewEditorValues,
): Record<string, SavedViewFilterValue> {
  return {
    view: values.layout,
    status: values.status,
    priority: optionalText(values.priority),
    due_date_from: optionalText(values.dueDateFrom),
    due_date_to: optionalText(values.dueDateTo),
    description: optionalText(values.description),
  };
}

export function buildDuplicateViewName(
  sourceName: string,
  existingNames: string[],
): string {
  const occupied = new Set(
    existingNames.map((name) => name.trim().toLocaleLowerCase()),
  );
  const baseName = `${sourceName.trim()} (copy)`;
  if (!occupied.has(baseName.toLocaleLowerCase())) return baseName;

  let copyNumber = 2;
  while (
    occupied.has(
      `${sourceName.trim()} (copy ${copyNumber})`.toLocaleLowerCase(),
    )
  ) {
    copyNumber += 1;
  }
  return `${sourceName.trim()} (copy ${copyNumber})`;
}

export function buildDuplicateSavedViewInput(
  source: SavedTableView,
  existingNames: string[],
): Omit<CreateSavedViewInput, "scope_key"> {
  return {
    name: buildDuplicateViewName(source.name, existingNames),
    is_default: false,
    visible_columns: source.visible_columns,
    column_order: source.column_order,
    column_widths: source.column_widths,
    sort_by: source.sort_by,
    sort_direction: source.sort_direction,
    filters: source.filters,
  };
}
