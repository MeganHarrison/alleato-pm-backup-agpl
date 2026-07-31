"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";
import { useProjects } from "@/hooks/use-projects";
import {
  useUnifiedTableState,
  type BulkEditField,
  type FilterValue,
  type DetailFieldConfig,
  type FilterConfig,
  type TableColumn,
} from "@/components/tables/unified";
import type { Meeting } from "@/lib/validation/meetings";
import {
  buildMeetingDetailFields,
  buildMeetingFilters,
  buildMeetingMarkdownFile,
  buildMeetingTableColumns,
  meetingDefaultVisibleColumns,
  type EditableField,
  type EditContext,
} from "@/features/meetings/meetings-table-config";
import { getMeetingDetailHref } from "@/features/meetings/meeting-routes";
import { MEETING_CATEGORY_OPTIONS } from "@/lib/meetings/domain";

// ─── Constants ───────────────────────────────────────────────────────────────

const EMPTY_FILTERS: Record<string, FilterValue> = {
  datePreset: undefined,
  dateFrom: undefined,
  dateTo: undefined,
  type: undefined,
  category: undefined,
};

const EDITABLE_FIELD_ORDER: EditableField[] = [
  "title",
  "date",
  "project",
  "type",
  "category",
];

const REQUESTED_VISIBLE_COLUMNS = [
  "keywords",
  "sentiment",
  "overview",
  "action_items",
  "bullet_points",
  "duration_minutes",
  "summary",
];

type FilterState = Record<string, FilterValue>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uniqueSorted(values: string[]): string[] {
  const unique = Array.from(new Set(values.filter((value) => value.trim() !== "")));
  return unique.sort((a, b) => a.localeCompare(b));
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseMeetingDateKey(dateValue: string | null | undefined): string | null {
  if (!dateValue) return null;
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return null;
  return toDateKey(parsed);
}

function getPresetDateRange(preset: string | null | undefined): {
  from: string;
  to: string;
} | null {
  if (!preset || preset === "custom") return null;

  const today = new Date();
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);

  if (preset === "today") {
    return { from: toDateKey(start), to: toDateKey(end) };
  }

  if (preset === "yesterday") {
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() - 1);
    return { from: toDateKey(start), to: toDateKey(end) };
  }

  if (preset === "this_week") {
    start.setDate(start.getDate() - start.getDay());
    return { from: toDateKey(start), to: toDateKey(end) };
  }

  if (preset === "this_month") {
    start.setDate(1);
    return { from: toDateKey(start), to: toDateKey(end) };
  }

  if (preset === "this_year") {
    start.setMonth(0, 1);
    return { from: toDateKey(start), to: toDateKey(end) };
  }

  return null;
}

function matchesDateFilters(meeting: Meeting, filters: FilterState): boolean {
  const meetingDateKey = parseMeetingDateKey(meeting.date);
  if (!meetingDateKey) {
    return !filters.datePreset && !filters.dateFrom && !filters.dateTo;
  }

  const presetRange =
    typeof filters.datePreset === "string"
      ? getPresetDateRange(filters.datePreset)
      : null;
  const from =
    presetRange?.from ??
    (typeof filters.dateFrom === "string" ? filters.dateFrom : null);
  const to =
    presetRange?.to ??
    (typeof filters.dateTo === "string" ? filters.dateTo : null);

  if (from && meetingDateKey < from) return false;
  if (to && meetingDateKey > to) return false;

  return true;
}

function sanitizeMeetingPayload(data: Partial<Meeting>): Partial<Meeting> {
  const allowedKeys: Array<keyof Meeting> = [
    "title",
    "date",
    "project",
    "project_id",
    "type",
    "category",
    "description",
    "participants",
    "source",
    "url",
    "summary",
    "fireflies_link",
  ];

  return allowedKeys.reduce<Partial<Meeting>>((acc, key) => {
    if (data[key] !== undefined) {
      acc[key] = data[key];
    }
    return acc;
  }, {});
}

function sortMeetings(
  meetings: Meeting[],
  sortBy: string | null,
  sortDirection: "asc" | "desc",
  getSortValue: (meeting: Meeting, columnId: string) => string | number | null,
): Meeting[] {
  if (!sortBy) return meetings;
  return [...meetings].sort((a, b) => {
    const valueA = getSortValue(a, sortBy);
    const valueB = getSortValue(b, sortBy);

    if (valueA == null && valueB == null) return 0;
    if (valueA == null) return sortDirection === "asc" ? -1 : 1;
    if (valueB == null) return sortDirection === "asc" ? 1 : -1;

    if (typeof valueA === "number" && typeof valueB === "number") {
      return sortDirection === "asc" ? valueA - valueB : valueB - valueA;
    }

    const comparison = String(valueA).localeCompare(String(valueB));
    return sortDirection === "asc" ? comparison : -comparison;
  });
}

// ─── Result type ──────────────────────────────────────────────────────────────

export interface UseMeetingsTableResult {
  tableState: ReturnType<typeof useUnifiedTableState>;
  meetings: Meeting[];
  setMeetings: React.Dispatch<React.SetStateAction<Meeting[]>>;
  pagedMeetings: Meeting[];
  totalItems: number;
  unfilteredTotal: number;
  totalPages: number;
  filters: FilterConfig[];
  activeFilters: FilterState;
  detailFields: DetailFieldConfig[];
  editingMeeting: Meeting | null;
  detailPanelOpen: boolean;
  tableColumns: TableColumn<Meeting>[];
  isFiltered: boolean;
  deleteDialogOpen: boolean;
  setDeleteDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  meetingToDelete: Meeting | null;
  setMeetingToDelete: React.Dispatch<React.SetStateAction<Meeting | null>>;
  bulkDeleteDialogOpen: boolean;
  setBulkDeleteDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleFilterChange: (nextFilters: FilterState) => void;
  handleRowClick: (meeting: Meeting) => void;
  handleOpenMeetingPage: (meeting: Meeting) => void;
  handleEdit: (meeting: Meeting) => void;
  handlePanelOpenChange: (open: boolean) => void;
  handleSave: (data: Partial<Meeting>) => Promise<void>;
  handleDeleteConfirm: () => Promise<void>;
  handleBulkDeleteConfirm: () => Promise<void>;
  bulkEditFields: BulkEditField[];
  handleBulkEdit: (
    fieldId: string,
    value: string,
    selectedIds: string[],
  ) => Promise<void>;
  handleSelectAll: (checked: boolean) => void;
  handleSelectRow: (id: string, checked: boolean) => void;
  handleOpenSource: (meeting: Meeting) => void;
  handleOpenRecording: (meeting: Meeting) => void;
  handleDownloadTranscriptPdf: (meeting: Meeting) => void;
  handleDownloadMarkdown: (meeting: Meeting) => void;
  handleBulkDownloadMarkdown: () => Promise<void>;
  handleExport: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMeetingsTable(initialMeetings: Meeting[], projectId?: string): UseMeetingsTableResult {
  const router = useRouter();
  const pathname = usePathname()! ?? "";
  const rawSearchParams = useSearchParams()!;
  const searchParams = rawSearchParams ?? new URLSearchParams();

  const [meetings, setMeetings] = React.useState<Meeting[]>(initialMeetings);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [meetingToDelete, setMeetingToDelete] = React.useState<Meeting | null>(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = React.useState(false);
  const [editingMeetingId, setEditingMeetingId] = React.useState<string | null>(null);

  // ── Inline editing state ────────────────────────────────────────────────────
  const [editingCell, setEditingCell] = React.useState<{
    meetingId: string;
    field: EditableField;
  } | null>(null);
  const [editingValue, setEditingValue] = React.useState("");

  // ── Table state ─────────────────────────────────────────────────────────────
  const initialDatePreset = searchParams.get("date") ?? "";
  const initialDateFrom = searchParams.get("date_from") ?? "";
  const initialDateTo = searchParams.get("date_to") ?? "";
  const initialType = searchParams.get("type") ?? "";
  const initialCategory = searchParams.get("category") ?? "";
  const initialFilters: FilterState = {
    datePreset: initialDatePreset || undefined,
    dateFrom: initialDateFrom || undefined,
    dateTo: initialDateTo || undefined,
    type: initialType || undefined,
    category: initialCategory || undefined,
  };

  // When on a project-specific page, hide the "project" column by default
  const defaultVisibleColumns = React.useMemo(
    () =>
      projectId
        ? meetingDefaultVisibleColumns.filter((col) => col !== "project")
        : meetingDefaultVisibleColumns,
    [projectId],
  );

  const tableState = useUnifiedTableState({
    entityKey: projectId ? `meetings-${projectId}` : "meetings",
    searchParams: rawSearchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      page: 1,
      perPage: 25,
      search: "",
      sortBy: "date",
      sortDirection: "desc",
      visibleColumns: defaultVisibleColumns,
      filters: initialFilters,
    },
  });

  // Sync filter state from URL (handles browser back/forward navigation)
  React.useEffect(() => {
    const nextDatePreset = searchParams.get("date") ?? "";
    const nextDateFrom = searchParams.get("date_from") ?? "";
    const nextDateTo = searchParams.get("date_to") ?? "";
    const nextType = searchParams.get("type") ?? "";
    const nextCategory = searchParams.get("category") ?? "";

    tableState.setActiveFilters((prev) => {
      const normalizedDatePreset = nextDatePreset || undefined;
      const normalizedDateFrom = nextDateFrom || undefined;
      const normalizedDateTo = nextDateTo || undefined;
      const normalizedType = nextType || undefined;
      const normalizedCategory = nextCategory || undefined;

      if (
        prev.datePreset === normalizedDatePreset &&
        prev.dateFrom === normalizedDateFrom &&
        prev.dateTo === normalizedDateTo &&
        prev.type === normalizedType &&
        prev.category === normalizedCategory
      ) {
        return prev;
      }

      return {
        datePreset: normalizedDatePreset,
        dateFrom: normalizedDateFrom,
        dateTo: normalizedDateTo,
        type: normalizedType,
        category: normalizedCategory,
      };
    });
  }, [searchParams, tableState.setActiveFilters]);

  // One-time migration: hide Type/Category by default and remove deprecated Source.
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const migrationKey = "meetings:visibleColumns:migrate-2026-03-06";
    if (window.localStorage.getItem(migrationKey) === "1") return;

    tableState.setVisibleColumns((prev) => {
      const sanitized = prev.filter(
        (columnId) => columnId !== "source" && columnId !== "type" && columnId !== "category",
      );
      if (sanitized.length > 0) {
        return sanitized;
      }
      return meetingDefaultVisibleColumns;
    });

    window.localStorage.setItem(migrationKey, "1");
  }, [tableState.visibleColumns, tableState.setVisibleColumns]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const migrationKey = "meetings:visibleColumns:hide-embedding-2026-05-08";
    if (window.localStorage.getItem(migrationKey) === "1") return;

    tableState.setVisibleColumns((prev) =>
      prev.filter((columnId) => columnId !== "embedding"),
    );

    window.localStorage.setItem(migrationKey, "1");
  }, [tableState.setVisibleColumns]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const migrationKey = "meetings:visibleColumns:add-media-summary-2026-05-11";
    if (window.localStorage.getItem(migrationKey) === "1") return;

    tableState.setVisibleColumns((prev) => {
      const next = prev.filter((columnId) => columnId !== "content");
      for (const columnId of REQUESTED_VISIBLE_COLUMNS) {
        if (!next.includes(columnId)) {
          next.push(columnId);
        }
      }
      return next;
    });

    window.localStorage.setItem(migrationKey, "1");
  }, [tableState.setVisibleColumns]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const migrationKey = "meetings:visibleColumns:move-media-to-links-2026-05-11";
    if (window.localStorage.getItem(migrationKey) === "1") return;

    tableState.setVisibleColumns((prev) =>
      prev.filter((columnId) => columnId !== "video" && columnId !== "audio"),
    );

    window.localStorage.setItem(migrationKey, "1");
  }, [tableState.setVisibleColumns]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const migrationKey = "meetings:visibleColumns:remove-media-columns-2026-05-11";
    if (window.localStorage.getItem(migrationKey) === "1") return;

    tableState.setVisibleColumns((prev) =>
      prev.filter((columnId) => columnId !== "video" && columnId !== "audio"),
    );

    window.localStorage.setItem(migrationKey, "1");
  }, [tableState.setVisibleColumns]);

  // One-time migration: make Category visible (editable from the table view) and
  // hide the Content column by default for users with persisted column state.
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const migrationKey = "meetings:visibleColumns:category-editable-content-hidden-2026-07-08";
    if (window.localStorage.getItem(migrationKey) === "1") return;

    tableState.setVisibleColumns((prev) => {
      const next = prev.filter((columnId) => columnId !== "content");
      if (!next.includes("category")) {
        next.push("category");
      }
      return next;
    });

    window.localStorage.setItem(migrationKey, "1");
  }, [tableState.setVisibleColumns]);

  // ── Derived data ─────────────────────────────────────────────────────────────
  const activeFilters = tableState.activeFilters as FilterState;
  const searchTerm = tableState.debouncedSearch.toLowerCase();

  const filteredMeetings = meetings.filter((meeting) => {
    const matchesDate = matchesDateFilters(meeting, activeFilters);
    const matchesType = !activeFilters.type || meeting.type === activeFilters.type;
    const matchesCategory =
      !activeFilters.category || meeting.category === activeFilters.category;

    const searchFields = [
      meeting.title ?? "",
      meeting.project ?? "",
      meeting.participants ?? "",
      meeting.type ?? "",
      meeting.category ?? "",
      meeting.overview ?? "",
      meeting.action_items ?? "",
      meeting.bullet_points ?? "",
      meeting.summary ?? "",
      meeting.content ?? "",
      Array.isArray(meeting.keywords) ? meeting.keywords.join(" ") : "",
    ];
    const matchesSearch =
      searchTerm.length === 0 ||
      searchFields.some((field) => field.toLowerCase().includes(searchTerm));

    return matchesDate && matchesType && matchesCategory && matchesSearch;
  });

  // ── Projects for inline select ───────────────────────────────────────────────
  const { projects } = useProjects({ limit: 500 });
  const projectOptions = projects
    .filter((project) => Boolean(project.name?.trim()))
    .map((project) => ({
      value: String(project.id),
      label: project.project_number
        ? `${project.project_number} - ${project.name?.trim() || "Unnamed Project"}`
        : project.name?.trim() || "Unnamed Project",
    }));
  const projectById = React.useMemo(() => {
    const map = new Map<number, { id: number; name: string | null }>();
    for (const project of projects) {
      map.set(project.id, { id: project.id, name: project.name?.trim() || null });
    }
    return map;
  }, [projects]);
  const categoryOptions = React.useMemo(
    () =>
      uniqueSorted(
        [
          ...meetings.map((meeting) => meeting.category ?? ""),
          ...MEETING_CATEGORY_OPTIONS,
        ].filter((value) => value !== ""),
      ).map((category) => ({
        value: category,
        label: category,
      })),
    [meetings],
  );

  // ── Inline edit handlers ─────────────────────────────────────────────────────
  const getInitialFieldValue = React.useCallback((meeting: Meeting, field: EditableField): string => {
    let initialValue = "";
    if (field === "date" && meeting.date) {
      // Format as YYYY-MM-DD for <input type="date">
      const d = new Date(meeting.date);
      if (!Number.isNaN(d.getTime())) {
        initialValue = d.toISOString().split("T")[0];
      }
    } else {
      initialValue = (meeting[field as keyof Meeting] as string | null) ?? "";
    }
    return initialValue;
  }, []);

  const handleCellClick = (meeting: Meeting, field: EditableField) => {
    const initialValue = getInitialFieldValue(meeting, field);
    setEditingCell({ meetingId: meeting.id, field });
    setEditingValue(initialValue);
  };

  const saveInlineField = async (
    meetingId: string,
    field: EditableField,
    rawValue: string | null,
  ): Promise<boolean> => {
    let saveValue = rawValue;
    if (!saveValue) saveValue = null;

    // Convert YYYY-MM-DD to full ISO string for date fields
    if (field === "date" && saveValue) {
      saveValue = new Date(`${saveValue}T12:00:00`).toISOString();
    }

    try {
      const supabase = createClient();
      const updatePayload: Record<string, unknown> =
        field === "project"
          ? (() => {
              const projectId = saveValue ? Number(saveValue) : null;
              if (!projectId) {
                return { project: null, project_id: null };
              }
              if (!Number.isFinite(projectId)) {
                throw new Error("Select a valid project before saving.");
              }
              const project = projectById.get(projectId);
              if (!project) {
                throw new Error("Selected project was not loaded. Search again and retry.");
              }
              return {
                project: project.name,
                project_id: project.id,
              };
            })()
          : { [field]: saveValue };

      const { data: updatedMeeting, error } = await supabase
        .from("document_metadata")
        .update(updatePayload as Database["public"]["Tables"]["document_metadata"]["Update"])
        .eq("id", meetingId)
        .is("deleted_at", null)
        .select("*")
        .single();

      if (error) throw new Error(error.message);

      setMeetings((prev) =>
        prev.map((m) =>
          m.id === meetingId ? { ...m, ...(updatedMeeting as Partial<Meeting>) } : m,
        ),
      );
      toast.success("Updated");
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update";
      toast.error(message);
      return false;
    }
  };

  const handleInlineFieldSave = async (
    meeting: Meeting,
    field: EditableField,
    value: string,
  ) => {
    await saveInlineField(meeting.id, field, value);
  };

  const handleCreateCategory = async (value: string): Promise<boolean> => {
    if (!editingCell || editingCell.field !== "category") return false;

    const saved = await saveInlineField(editingCell.meetingId, "category", value);
    if (saved) {
      setEditingCell(null);
      setEditingValue("");
    }
    return saved;
  };

  const handleInlineSave = async (options?: {
    valueOverride?: string;
    move?: "next" | "prev";
  }) => {
    if (!editingCell) return;
    const { meetingId, field } = editingCell;

    let saveValue: string | null =
      options?.valueOverride !== undefined ? options.valueOverride : editingValue;
    if (!saveValue) saveValue = null;

    // Close editing state immediately so UX feels snappy
    setEditingCell(null);
    setEditingValue("");

    if (options?.move) {
      const currentIndex = EDITABLE_FIELD_ORDER.indexOf(field);
      const nextIndex = options.move === "next" ? currentIndex + 1 : currentIndex - 1;
      const nextField = EDITABLE_FIELD_ORDER[nextIndex];
      if (nextField) {
        const nextMeeting = meetings.find((meeting) => meeting.id === meetingId);
        if (nextMeeting) {
          const nextValue = getInitialFieldValue(nextMeeting, nextField);
          window.requestAnimationFrame(() => {
            setEditingCell({ meetingId, field: nextField });
            setEditingValue(nextValue);
          });
        }
      }
    }

    await saveInlineField(meetingId, field, saveValue);
  };

  const handleInlineCancel = () => {
    setEditingCell(null);
    setEditingValue("");
  };

  // ── Build edit context and columns ───────────────────────────────────────────
  const editContext: EditContext = {
    editingCell,
    editingValue,
    projectOptions,
    categoryOptions,
    handleCellClick,
    setEditingValue,
    handleInlineSave,
    handleInlineFieldSave,
    handleCreateCategory,
    handleInlineCancel,
  };

  const getMeetingHref = React.useCallback(
    (meeting: Meeting) =>
      getMeetingDetailHref({ meetingId: meeting.id, projectId }),
    [projectId],
  );

  const tableColumns = buildMeetingTableColumns(editContext, getMeetingHref);

  // ── Sorting and pagination ────────────────────────────────────────────────────
  const sortedMeetings = sortMeetings(
    filteredMeetings,
    tableState.sortBy,
    tableState.sortDirection,
    (meeting, columnId) =>
      tableColumns.find((column) => column.id === columnId)?.sortValue?.(meeting) ?? null,
  );

  const unfilteredTotal = meetings.length;
  const totalItems = sortedMeetings.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / tableState.perPage));
  const pageStart = (tableState.page - 1) * tableState.perPage;
  const pageEnd = pageStart + tableState.perPage;
  const pagedMeetings = sortedMeetings.slice(pageStart, pageEnd);

  React.useEffect(() => {
    if (tableState.page > totalPages) {
      tableState.setPage(1);
      tableState.setSearchParams({ page: "1" });
    }
  }, [tableState.page, tableState.setPage, tableState.setSearchParams, totalPages]);

  // ── Filter options derived from raw data ─────────────────────────────────────
  const types = uniqueSorted(
    meetings.map((meeting) => meeting.type ?? "").filter((value) => value !== ""),
  );

  const categories = uniqueSorted(
    meetings.map((meeting) => meeting.category ?? "").filter((value) => value !== ""),
  );

  const filters = buildMeetingFilters({ types, categories });

  const detailFields = buildMeetingDetailFields({ projectOptions });

  // ── Detail panel ──────────────────────────────────────────────────────────────
  const detailParam = tableState.detailParam;
  const editingMeeting = editingMeetingId
    ? meetings.find((meeting) => meeting.id === editingMeetingId) || null
    : null;
  const detailPanelOpen = Boolean(editingMeetingId);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleFilterChange = (nextFilters: FilterState) => {
    tableState.setActiveFilters(nextFilters);
    tableState.setSearchParams({
      date: typeof nextFilters.datePreset === "string" ? nextFilters.datePreset : null,
      date_from: typeof nextFilters.dateFrom === "string" ? nextFilters.dateFrom : null,
      date_to: typeof nextFilters.dateTo === "string" ? nextFilters.dateTo : null,
      type: typeof nextFilters.type === "string" ? nextFilters.type : null,
      category: typeof nextFilters.category === "string" ? nextFilters.category : null,
      page: "1",
    });
    tableState.setPage(1);
  };

  const handleRowClick = (meeting: Meeting) => {
    handleOpenMeetingPage(meeting);
  };

  const handleOpenMeetingPage = (meeting: Meeting) => {
    router.push(getMeetingHref(meeting));
  };

  const handleEdit = (meeting: Meeting) => {
    setEditingMeetingId(meeting.id);
  };

  const handlePanelOpenChange = (open: boolean) => {
    if (!open) {
      setEditingMeetingId(null);
    }
  };

  const handleSave = async (data: Partial<Meeting>) => {
    if (!editingMeeting) return;

    const payload = sanitizeMeetingPayload(data);
    if (typeof payload.date === "string" && payload.date.length === 10) {
      payload.date = new Date(`${payload.date}T12:00:00`).toISOString();
    }
    if (payload.project !== undefined) {
      const projectId = payload.project ? Number(payload.project) : null;
      if (projectId && Number.isFinite(projectId)) {
        const project = projectById.get(projectId);
        payload.project = project?.name ?? null;
        payload.project_id = project?.id ?? null;
      } else {
        payload.project = null;
        payload.project_id = null;
      }
    }

    try {
      const supabase = createClient();
      const { data: updatedMeeting, error } = await supabase
        .from("document_metadata")
        .update(payload as Database["public"]["Tables"]["document_metadata"]["Update"])
        .eq("id", editingMeeting.id)
        .is("deleted_at", null)
        .select("*")
        .single();

      if (error) throw new Error(error.message);

      setMeetings((prev) =>
        prev.map((meeting) =>
          meeting.id === editingMeeting.id
            ? { ...meeting, ...(updatedMeeting as Partial<Meeting>) }
            : meeting,
        ),
      );
      toast.success("Meeting updated successfully");
      setEditingMeetingId(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update meeting";
      toast.error(message);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!meetingToDelete) return;

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("document_metadata")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", meetingToDelete.id)
        .is("deleted_at", null);

      if (error) throw new Error(error.message);

      setMeetings((prev) => prev.filter((meeting) => meeting.id !== meetingToDelete.id));
      tableState.setSelectedIds((prev) => prev.filter((id) => id !== meetingToDelete.id));
      toast.success("Meeting deleted successfully");
    } catch {
      toast.error("Failed to delete meeting");
    } finally {
      setDeleteDialogOpen(false);
      setMeetingToDelete(null);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      tableState.setSelectedIds(pagedMeetings.map((meeting) => meeting.id));
    } else {
      tableState.setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      tableState.setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    } else {
      tableState.setSelectedIds((prev) => prev.filter((itemId) => itemId !== id));
    }
  };

  const handleBulkDeleteConfirm = async () => {
    const selectedIds = tableState.selectedIds;
    if (selectedIds.length === 0) return;

    try {
      const supabase = createClient();

      const { error: meetingsDeleteError } = await supabase
        .from("document_metadata")
        .update({ deleted_at: new Date().toISOString() })
        .in("id", selectedIds)
        .is("deleted_at", null);

      if (meetingsDeleteError) throw new Error(meetingsDeleteError.message);

      setMeetings((prev) => prev.filter((meeting) => !selectedIds.includes(meeting.id)));
      tableState.setSelectedIds([]);

      if (detailParam && selectedIds.includes(detailParam)) {
        tableState.setSearchParams({ detail: null });
      }

      toast.success(`Deleted ${selectedIds.length} meeting${selectedIds.length === 1 ? "" : "s"}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete selected meetings";
      toast.error(message);
    } finally {
      setBulkDeleteDialogOpen(false);
    }
  };

  // ── Bulk edit ─────────────────────────────────────────────────────────────
  // Fields offered in the "Edit selected" dialog. Project uses the searchable
  // combobox (long list); category is a plain select of existing values; type
  // is free text. "No project" clears the assignment.
  const bulkEditFields: BulkEditField[] = React.useMemo(
    () => [
      {
        id: "project",
        label: "Project",
        type: "select",
        searchable: true,
        placeholder: "Select project",
        options: [{ value: "__none__", label: "No project" }, ...projectOptions],
      },
      {
        id: "category",
        label: "Category",
        type: "select",
        placeholder: "Select category",
        options: categoryOptions,
      },
      { id: "type", label: "Type", type: "text", placeholder: "Enter type…" },
    ],
    [projectOptions, categoryOptions],
  );

  const handleBulkEdit = async (
    fieldId: string,
    value: string,
    selectedIds: string[],
  ) => {
    if (selectedIds.length === 0) return;

    const normalized = value === "__none__" ? "" : value;

    let payload: Record<string, unknown>;
    if (fieldId === "project") {
      const nextProjectId = normalized ? Number(normalized) : null;
      if (nextProjectId) {
        if (!Number.isFinite(nextProjectId)) {
          toast.error("Select a valid project before saving.");
          return;
        }
        const project = projectById.get(nextProjectId);
        if (!project) {
          toast.error("Selected project was not loaded. Search again and retry.");
          return;
        }
        payload = { project: project.name, project_id: project.id };
      } else {
        payload = { project: null, project_id: null };
      }
    } else {
      payload = { [fieldId]: normalized || null };
    }

    try {
      const supabase = createClient();
      const { data: updatedRows, error } = await supabase
        .from("document_metadata")
        .update(payload as Database["public"]["Tables"]["document_metadata"]["Update"])
        .in("id", selectedIds)
        .is("deleted_at", null)
        .select("*");

      if (error) throw new Error(error.message);

      const updatedById = new Map(
        (updatedRows ?? []).map((row) => [row.id as string, row as Partial<Meeting>]),
      );
      setMeetings((prev) =>
        prev.map((meeting) =>
          updatedById.has(meeting.id)
            ? { ...meeting, ...updatedById.get(meeting.id) }
            : meeting,
        ),
      );
      const count = updatedById.size || selectedIds.length;
      toast.success(`Updated ${count} meeting${count === 1 ? "" : "s"}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update selected meetings";
      toast.error(message);
      throw error instanceof Error ? error : new Error(message);
    }
  };

  const handleOpenSource = (meeting: Meeting) => {
    if (meeting.source) {
      window.open(meeting.source, "_blank", "noopener,noreferrer");
    }
  };

  const handleOpenRecording = (meeting: Meeting) => {
    if (meeting.fireflies_link) {
      window.open(meeting.fireflies_link, "_blank", "noopener,noreferrer");
    }
  };

  const handleDownloadMarkdown = (meeting: Meeting) => {
    const file = buildMeetingMarkdownFile(meeting);
    if (!file) {
      toast.info("No transcript available for this meeting");
      return;
    }

    const blob = new Blob([file.body], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Bulk markdown export. Operates on the current selection when rows are
  // selected, otherwise on every meeting matching the active filters/search.
  // A single meeting downloads as a .md file; multiple are bundled into a zip.
  const handleBulkDownloadMarkdown = async () => {
    const selectedIds = new Set(tableState.selectedIds);
    const scope =
      selectedIds.size > 0
        ? sortedMeetings.filter((meeting) => selectedIds.has(meeting.id))
        : sortedMeetings;

    if (scope.length === 0) {
      toast.info("No meetings to export");
      return;
    }

    const files = scope
      .map((meeting) => buildMeetingMarkdownFile(meeting))
      .filter((file): file is { filename: string; body: string } => file !== null);

    if (files.length === 0) {
      toast.info("None of the selected meetings have a transcript to export");
      return;
    }

    // Single file → plain .md download, no zip overhead.
    if (files.length === 1) {
      const blob = new Blob([files[0].body], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = files[0].filename;
      link.click();
      URL.revokeObjectURL(url);
      return;
    }

    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const usedNames = new Map<string, number>();

      for (const file of files) {
        // Disambiguate collisions (e.g. two same-day meetings with same title).
        const count = usedNames.get(file.filename) ?? 0;
        usedNames.set(file.filename, count + 1);
        const name = count === 0
          ? file.filename
          : file.filename.replace(/\.md$/, `-${count + 1}.md`);
        zip.file(name, file.body);
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `meetings-${new Date().toISOString().slice(0, 10)}.zip`;
      link.click();
      URL.revokeObjectURL(url);

      const skipped = scope.length - files.length;
      toast.success(
        `Exported ${files.length} meeting${files.length === 1 ? "" : "s"}` +
          (skipped > 0 ? ` (${skipped} skipped — no transcript)` : ""),
      );
    } catch {
      toast.error("Failed to export markdown");
    }
  };

  const handleDownloadTranscriptPdf = (meeting: Meeting) => {
    const markdown = meeting.content?.trim() ?? meeting.summary?.trim() ?? "";
    if (!markdown) {
      toast.info("No transcript available for this meeting");
      return;
    }

    const dateLabel = meeting.date
      ? new Date(meeting.date).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "";
    const title = meeting.title ?? "Meeting Transcript";

    // Escape for use inside <title> tag only
    const safeTitle = title.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // Convert markdown to HTML using the marked library loaded via dynamic import
    import("marked").then(({ marked }) => {
      const bodyHtml = marked(markdown) as string;

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${safeTitle}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; font-size: 13px; line-height: 1.6; color: #111; padding: 48px 56px; max-width: 800px; margin: 0 auto; }
    h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
    .meta { font-size: 12px; color: #666; margin-bottom: 32px; }
    h2 { font-size: 15px; font-weight: 600; margin: 24px 0 8px; }
    h3 { font-size: 13px; font-weight: 600; margin: 16px 0 6px; }
    p { margin: 0 0 10px; }
    ul, ol { margin: 0 0 10px 20px; }
    li { margin-bottom: 3px; }
    pre { background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto; font-size: 12px; margin: 0 0 10px; }
    code { background: #f5f5f5; padding: 1px 4px; border-radius: 3px; font-size: 12px; }
    pre code { background: none; padding: 0; }
    blockquote { border-left: 3px solid #ddd; padding-left: 12px; color: #555; margin: 0 0 10px; }
    hr { border: none; border-top: 1px solid #eee; margin: 20px 0; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>${safeTitle}</h1>
  ${dateLabel ? `<p class="meta">${dateLabel}</p>` : ""}
  ${bodyHtml}
  <script>window.onload = () => { window.print(); };<\/script>
</body>
</html>`;

      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, "_blank");
      if (!printWindow) {
        toast.error("Could not open print window. Please allow pop-ups for this site.");
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }).catch(() => {
      toast.error("Failed to generate PDF");
    });
  };

  const handleExport = () => {
    if (sortedMeetings.length === 0) {
      toast.info("No meetings to export");
      return;
    }

    const cols = buildMeetingTableColumns();
    const visibleCols = cols.filter((column) =>
      tableState.visibleColumns.includes(column.id),
    );

    const headers = visibleCols.map((column) => column.label);
    const rows = sortedMeetings.map((meeting) =>
      visibleCols
        .map((column) =>
          column.csvValue ? column.csvValue(meeting) : String(column.render(meeting) ?? ""),
        )
        .join(","),
    );

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `meetings-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const isFiltered =
    Boolean(tableState.searchInput) ||
    Boolean(activeFilters.datePreset) ||
    Boolean(activeFilters.dateFrom) ||
    Boolean(activeFilters.dateTo) ||
    Boolean(activeFilters.type) ||
    Boolean(activeFilters.category);

  return {
    tableState,
    meetings,
    setMeetings,
    pagedMeetings,
    totalItems,
    unfilteredTotal,
    totalPages,
    filters,
    activeFilters,
    detailFields,
    editingMeeting,
    detailPanelOpen,
    tableColumns,
    isFiltered,
    deleteDialogOpen,
    setDeleteDialogOpen,
    meetingToDelete,
    setMeetingToDelete,
    bulkDeleteDialogOpen,
    setBulkDeleteDialogOpen,
    handleFilterChange,
    handleRowClick,
    handleOpenMeetingPage,
    handleEdit,
    handlePanelOpenChange,
    handleSave,
    handleDeleteConfirm,
    handleBulkDeleteConfirm,
    bulkEditFields,
    handleBulkEdit,
    handleSelectAll,
    handleSelectRow,
    handleOpenSource,
    handleOpenRecording,
    handleDownloadTranscriptPdf,
    handleDownloadMarkdown,
    handleBulkDownloadMarkdown,
    handleExport,
  };
}

export { EMPTY_FILTERS };
