"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import {
  EmbeddedUnifiedTablePage,
  type FilterValue,
  type TableColumn,
} from "@/components/tables/unified";

import {
  flattenAdminMenuSections,
  type AdminMenuSection,
  type AdminTableRow,
} from "./admin-dashboard-data";

const SECTION_FILTER_ID = "section";
const EMPTY_FILTERS: Record<string, FilterValue> = {
  [SECTION_FILTER_ID]: undefined,
};
const DEFAULT_VISIBLE_COLUMNS = [
  "label",
  "section",
  "route",
  "description",
  "availability",
];

const COLUMNS: TableColumn<AdminTableRow>[] = [
  {
    id: "label",
    label: "Page",
    alwaysVisible: true,
    render: (item) => (
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate font-medium text-foreground">{item.label}</span>
        {item.badge ? (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {item.badge}
          </span>
        ) : null}
      </div>
    ),
    csvValue: (item) => item.label,
    sortable: true,
    sortValue: (item) => item.label,
    width: 240,
  },
  {
    id: "group",
    label: "Group",
    defaultVisible: true,
    render: (item) => <span className="text-sm text-foreground">{item.groupTitle}</span>,
    csvValue: (item) => item.groupTitle,
    sortable: true,
    sortValue: (item) => item.groupTitle,
    width: 200,
  },
  {
    id: "section",
    label: "Section",
    defaultVisible: true,
    render: (item) => <span className="text-sm text-foreground">{item.sectionTitle}</span>,
    csvValue: (item) => item.sectionTitle,
    sortable: true,
    sortValue: (item) => item.sectionTitle,
    width: 220,
  },
  {
    id: "route",
    label: "Route",
    defaultVisible: true,
    render: (item) =>
      item.href ? (
        <Link
          href={item.href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex max-w-full items-center gap-1 truncate text-sm text-primary hover:underline"
        >
          <span className="truncate">{item.route}</span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0" />
        </Link>
      ) : (
        <span className="truncate text-sm text-muted-foreground">{item.route}</span>
      ),
    csvValue: (item) => item.route,
    sortable: true,
    sortValue: (item) => item.route,
    width: 220,
  },
  {
    id: "description",
    label: "Description",
    defaultVisible: true,
    render: (item) => (
      <span className="block max-w-3xl text-sm leading-relaxed text-muted-foreground">
        {item.description}
      </span>
    ),
    csvValue: (item) => item.description,
    sortable: true,
    sortValue: (item) => item.description,
    width: 520,
  },
  {
    id: "availability",
    label: "Access",
    defaultVisible: true,
    render: (item) => (
      <span className="text-sm text-muted-foreground">
        {item.availability === "link" ? "Direct route" : "Project scoped"}
      </span>
    ),
    csvValue: (item) =>
      item.availability === "link" ? "Direct route" : "Project scoped",
    sortable: true,
    sortValue: (item) => item.availability,
    width: 140,
  },
];

export function AdminTableView({ sections }: { sections: AdminMenuSection[] }) {
  const [searchValue, setSearchValue] = React.useState("");
  const [activeFilters, setActiveFilters] =
    React.useState<Record<string, FilterValue>>(EMPTY_FILTERS);
  const [visibleColumns, setVisibleColumns] = React.useState(DEFAULT_VISIBLE_COLUMNS);
  const deferredSearch = React.useDeferredValue(searchValue);

  const rows = React.useMemo(() => flattenAdminMenuSections(sections), [sections]);

  const sectionOptions = React.useMemo(
    () =>
      sections.map((section) => ({
        value: section.title,
        label: section.title,
      })),
    [sections],
  );

  const filteredRows = React.useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();
    const sectionFilter = activeFilters[SECTION_FILTER_ID];

    return rows.filter((row) => {
      if (sectionFilter && row.sectionTitle !== sectionFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [
        row.label,
        row.sectionTitle,
        row.groupTitle,
        row.route,
        row.description,
        row.badge ?? "",
      ].some((value) => value.toLowerCase().includes(normalizedSearch));
    });
  }, [activeFilters, deferredSearch, rows]);

  const hasActiveFilters = Boolean(
    deferredSearch.trim() || activeFilters[SECTION_FILTER_ID],
  );

  return (
    <EmbeddedUnifiedTablePage
      title="Admin Dashboard"
      description="Directory table for internal admin routes."
      toolbar={{
        totalItems: rows.length,
        filteredItems: filteredRows.length,
        searchValue,
        onSearchChange: setSearchValue,
        searchPlaceholder: "Search admin pages, routes, or descriptions...",
        currentView: "table",
        onViewChange: () => undefined,
        enabledViews: ["table"],
        filters: [
          {
            id: SECTION_FILTER_ID,
            label: "Section",
            type: "select",
            options: sectionOptions,
          },
        ],
        activeFilters,
        onFilterChange: setActiveFilters,
        onClearFilters: () => setActiveFilters(EMPTY_FILTERS),
        visibleColumns,
        onColumnVisibilityChange: setVisibleColumns,
      }}
      data={{
        items: filteredRows,
        isLoading: false,
      }}
      table={{
        columns: COLUMNS,
        getRowId: (item) => item.id,
        stickyHeader: true,
      }}
      emptyState={{
        title: "No admin pages found",
        description: "Admin routes will appear here when they are added to the dashboard catalog.",
        filteredDescription: "No admin pages match the current search or section filter.",
        isFiltered: hasActiveFilters,
      }}
      layout={{ fullBleedTable: true }}
    />
  );
}
