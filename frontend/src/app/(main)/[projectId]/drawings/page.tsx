"use client";

import * as React from "react";
import { useState, useCallback, useRef, useMemo } from "react";
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  Bell,
  BellOff,
  Download,
  FileText,
  Mail,
  MapPin,
  Maximize2,
  MoreVertical,
  Pencil,
  Plus,
  ScanSearch,
  Table2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import {
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterConfig,
  type FilterValue,
} from "@/components/tables/unified";
import { InfoAlert } from "@/components/ds/InfoAlert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DrawingUploadDialog } from "@/components/drawings/DrawingUploadDialog";
import { DrawingQRCode } from "@/components/drawings/DrawingQRCode";
import {
  useDrawings,
  useDeleteDrawing,
  usePublishDrawing,
  useObsoleteDrawing,
  useUpdateDrawing,
  useDrawingSubscription,
  useToggleDrawingSubscription,
} from "@/hooks/use-drawings";
import { useDrawingSets } from "@/hooks/use-drawing-sets";
import { apiFetch, apiFetchBlob } from "@/lib/api-client";
import type { DrawingLogTableRow } from "@/types/drawings.types";
import { DRAWING_DISCIPLINES, DRAWING_TYPES } from "@/types/drawings.types";
import {
  buildDrawingTableColumns,
  buildDrawingRowActions,
  drawingColumns,
  drawingDefaultVisibleColumns,
  getDrawingPublishState,
  getDrawingPublishStateLabel,
  matchesDrawingPublishState,
  renderDrawingCard,
  renderDrawingList,
  type ImpliedSubmittalCounts,
} from "@/features/drawings/drawings-table-config";
import { useRequiredSubmittals } from "@/hooks/use-submittals";
import { ScanDrawingsSheet } from "@/features/submittals/scan-drawings-sheet";

type DrawingFilterState = Record<string, FilterValue>;
type GalleryImageSize = "small" | "medium" | "large" | "xlarge";
type DrawingEditDraft = {
  drawingNumber: string;
  title: string;
  discipline: string;
  drawingType: string;
};
type BulkEditDraft = {
  discipline: string;
  drawingType: string;
};

const EMPTY_FILTERS: DrawingFilterState = {
  discipline: undefined,
  setId: undefined,
  publishState: undefined,
};

const GALLERY_IMAGE_SIZE_STORAGE_KEY = "drawings:gallery-image-size";
const SELECT_NO_CHANGE = "__no_change__";

const GALLERY_IMAGE_SIZE_OPTIONS: {
  value: GalleryImageSize;
  label: string;
  gridClassName: string;
}[] = [
  {
    value: "small",
    label: "Small",
    gridClassName: "grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3",
  },
  {
    value: "medium",
    label: "Medium",
    gridClassName: "grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3",
  },
  {
    value: "large",
    label: "Large",
    gridClassName: "grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4",
  },
  {
    value: "xlarge",
    label: "Extra large",
    gridClassName: "grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5",
  },
];

function isGalleryImageSize(value: string | null): value is GalleryImageSize {
  return GALLERY_IMAGE_SIZE_OPTIONS.some((option) => option.value === value);
}

function escapeCsvValue(value: string | number | null | undefined): string {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export default function ProjectDrawingsPage() {
  const params = useParams<{ projectId: string }>()!;
  const pathname = usePathname()!;
  const router = useRouter();
  const searchParams = useSearchParams()!;
  const [uploadOpen, setUploadOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);
  const [galleryImageSize, setGalleryImageSize] =
    useState<GalleryImageSize>("medium");
  const [hasLoadedGalleryImageSize, setHasLoadedGalleryImageSize] =
    useState(false);
  const [editTarget, setEditTarget] = useState<DrawingLogTableRow | null>(null);
  const [editDraft, setEditDraft] = useState<DrawingEditDraft>({
    drawingNumber: "",
    title: "",
    discipline: "",
    drawingType: "",
  });
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEditDraft, setBulkEditDraft] = useState<BulkEditDraft>({
    discipline: SELECT_NO_CHANGE,
    drawingType: SELECT_NO_CHANGE,
  });
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [scanDrawingsOpen, setScanDrawingsOpen] = useState(false);
  const dragCounter = useRef(0);

  const projectId = params.projectId ?? "";
  const queryClient = useQueryClient();

  const deleteDrawing = useDeleteDrawing(projectId);
  const publishDrawing = usePublishDrawing(projectId);
  const obsoleteDrawing = useObsoleteDrawing(projectId);
  const updateDrawing = useUpdateDrawing(projectId);
  const drawingSubscription = useDrawingSubscription(projectId);
  const toggleDrawingSubscription = useToggleDrawingSubscription(projectId);
  const { data: drawingSets = [] } = useDrawingSets(projectId);
  const { data: requiredSubmittals } = useRequiredSubmittals(
    parseInt(projectId, 10),
  );
  const impliedSubmittalCounts = useMemo<ImpliedSubmittalCounts>(() => {
    const counts = new Map<string, { total: number; missing: number }>();
    for (const item of requiredSubmittals?.items ?? []) {
      const existing = counts.get(item.drawingId) ?? { total: 0, missing: 0 };
      existing.total += 1;
      if (!item.existingSubmittal) existing.missing += 1;
      counts.set(item.drawingId, existing);
    }
    return counts;
  }, [requiredSubmittals]);
  const urlDiscipline = searchParams.get("discipline") ?? undefined;
  const urlSetId = searchParams.get("set") ?? undefined;
  const urlAreaId = searchParams.get("area_id") ?? undefined;
  const urlPublishState = searchParams.get("status") ?? undefined;

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<DrawingLogTableRow | null>(
    null,
  );

  // QR code state
  const [qrTarget, setQrTarget] = useState<{
    drawingId: string;
    drawingNumber: string;
  } | null>(null);

  const initialFilters: DrawingFilterState = {
    discipline: urlDiscipline,
    setId: urlSetId,
    areaId: urlAreaId,
    publishState: urlPublishState,
  };

  const tableState = useUnifiedTableState({
    entityKey: "drawings",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "card",
      allowedViews: ["table", "card", "list"],
      page: 1,
      perPage: 50,
      search: "",
      sortBy: "drawingNumber",
      sortDirection: "asc",
      visibleColumns: drawingDefaultVisibleColumns,
      filters: initialFilters,
    },
  });

  const activeFilters = tableState.activeFilters as DrawingFilterState;
  const {
    setActiveFilters: syncActiveFiltersFromUrl,
    setSelectedIds: clearSelectionForUrlFilters,
  } = tableState;
  const galleryImageSizeOption =
    GALLERY_IMAGE_SIZE_OPTIONS.find(
      (option) => option.value === galleryImageSize,
    ) ?? GALLERY_IMAGE_SIZE_OPTIONS[1];

  React.useEffect(() => {
    syncActiveFiltersFromUrl((current) => {
      const currentDrawingFilters = current as DrawingFilterState;
      if (
        currentDrawingFilters.discipline === urlDiscipline &&
        currentDrawingFilters.setId === urlSetId &&
        currentDrawingFilters.areaId === urlAreaId &&
        currentDrawingFilters.publishState === urlPublishState
      ) {
        return current;
      }

      return {
        ...current,
        discipline: urlDiscipline,
        setId: urlSetId,
        areaId: urlAreaId,
        publishState: urlPublishState,
      };
    });
    clearSelectionForUrlFilters([]);
  }, [
    clearSelectionForUrlFilters,
    syncActiveFiltersFromUrl,
    urlAreaId,
    urlDiscipline,
    urlPublishState,
    urlSetId,
  ]);

  React.useEffect(() => {
    const storedValue = window.localStorage.getItem(
      GALLERY_IMAGE_SIZE_STORAGE_KEY,
    );
    if (isGalleryImageSize(storedValue)) {
      setGalleryImageSize(storedValue);
    }
    setHasLoadedGalleryImageSize(true);
  }, []);

  React.useEffect(() => {
    if (!hasLoadedGalleryImageSize) return;

    window.localStorage.setItem(
      GALLERY_IMAGE_SIZE_STORAGE_KEY,
      galleryImageSize,
    );
  }, [galleryImageSize, hasLoadedGalleryImageSize]);

  const { data: drawingsData, isLoading } = useDrawings(projectId, {
    page: tableState.page,
    page_size: tableState.perPage,
    search: tableState.debouncedSearch || undefined,
    discipline:
      typeof activeFilters.discipline === "string"
        ? activeFilters.discipline
        : undefined,
    set_id:
      typeof activeFilters.setId === "string" ? activeFilters.setId : undefined,
    area_id:
      typeof activeFilters.areaId === "string"
        ? activeFilters.areaId
        : undefined,
    include_unpublished: true,
  });

  const drawings: DrawingLogTableRow[] = React.useMemo(
    () => drawingsData?.drawings ?? [],
    [drawingsData],
  );

  // Computed disciplines (standard + from data)
  const allDisciplines = React.useMemo(() => {
    const fromData = new Set(
      drawings.map((d) => d.discipline).filter(Boolean) as string[],
    );
    const merged = new Set([...DRAWING_DISCIPLINES, ...fromData]);
    return Array.from(merged).sort();
  }, [drawings]);

  const drawingFilterOptions = React.useMemo<FilterConfig[]>(
    () => [
      {
        id: "discipline",
        label: "Discipline",
        type: "select",
        options: allDisciplines.map((discipline) => ({
          value: discipline,
          label: discipline,
        })),
      },
      {
        id: "setId",
        label: "Set",
        type: "select",
        options: drawingSets.map((set) => ({
          value: set.id,
          label: set.name,
        })),
      },
      {
        id: "publishState",
        label: "Status",
        type: "select",
        options: [
          { value: "draft", label: "Draft" },
          { value: "published", label: "Published" },
          { value: "obsolete", label: "Obsolete" },
        ],
      },
    ],
    [allDisciplines, drawingSets],
  );

  const filteredItems = React.useMemo(() => {
    const search = tableState.debouncedSearch.trim().toLowerCase();
    const disciplineFilter =
      typeof activeFilters.discipline === "string"
        ? activeFilters.discipline
        : "";
    const publishStateFilter =
      typeof activeFilters.publishState === "string"
        ? activeFilters.publishState
        : "";
    return drawings.filter((row) => {
      if (disciplineFilter && row.discipline !== disciplineFilter) return false;
      if (!matchesDrawingPublishState(row, publishStateFilter)) return false;
      if (!search) return true;
      return (
        row.drawingNumber.toLowerCase().includes(search) ||
        row.title.toLowerCase().includes(search) ||
        (row.discipline ?? "").toLowerCase().includes(search) ||
        (row.fileName ?? "").toLowerCase().includes(search)
      );
    });
  }, [activeFilters, drawings, tableState.debouncedSearch]);

  // Inline cell edits (Discipline / Type in table view). Persists directly and
  // refreshes the cache. No toast here — UnifiedTablePage shows its own per-cell
  // "<field> updated" confirmation on commit, so the hook's toast is skipped.
  const handleInlineUpdate = useCallback(
    async (
      drawingId: string,
      data: { title?: string; discipline?: string; drawing_type?: string },
    ) => {
      await apiFetch(`/api/projects/${projectId}/drawings/${drawingId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      await queryClient.invalidateQueries({
        queryKey: ["drawings", projectId],
      });
    },
    [projectId, queryClient],
  );

  const tableColumns = React.useMemo(
    () =>
      buildDrawingTableColumns(
        {
          disciplines: allDisciplines,
          onUpdate: handleInlineUpdate,
        },
        impliedSubmittalCounts,
      ),
    [allDisciplines, handleInlineUpdate, impliedSubmittalCounts],
  );
  const activeSetId = urlSetId;
  const activeSet = activeSetId
    ? drawingSets.find((set) => set.id === activeSetId)
    : undefined;
  const isSetScopedView = Boolean(activeSetId);

  const tabs = [
    {
      label: "Current Drawings",
      href: `/${projectId}/drawings`,
      isActive: !isSetScopedView,
    },
    {
      label: "Drawing Sets",
      href: `/${projectId}/drawings/sets`,
      isActive: isSetScopedView,
    },
    {
      label: "Recycle Bin",
      href: `/${projectId}/drawings/recycle-bin`,
      isActive: false,
    },
  ];

  const handleFilterChange = (nextFilters: DrawingFilterState) => {
    tableState.setActiveFilters(nextFilters);
    tableState.setSearchParams({
      discipline:
        typeof nextFilters.discipline === "string"
          ? nextFilters.discipline
          : null,
      set: typeof nextFilters.setId === "string" ? nextFilters.setId : null,
      status:
        typeof nextFilters.publishState === "string"
          ? nextFilters.publishState
          : null,
      area_id:
        typeof nextFilters.areaId === "string"
          ? nextFilters.areaId
          : (urlAreaId ?? null),
      page: "1",
    });
    tableState.setPage(1);
  };

  const handleSelectAll = (checked: boolean) => {
    tableState.setSelectedIds(
      checked ? filteredItems.map((item) => item.id) : [],
    );
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    tableState.setSelectedIds(
      checked
        ? [...tableState.selectedIds, id]
        : tableState.selectedIds.filter((s) => s !== id),
    );
  };

  const handleBulkDownload = async () => {
    const count = tableState.selectedIds.length;
    if (count === 0) return;
    toast.info(`Packaging ${count} drawing${count === 1 ? "" : "s"}…`);
    try {
      const blob = await apiFetchBlob(
        `/api/projects/${projectId}/drawings/bulk-download`,
        {
          method: "POST",
          body: JSON.stringify({ drawingIds: tableState.selectedIds }),
        },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `drawings-${new Date().toISOString().split("T")[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${count} drawing${count === 1 ? "" : "s"}`);
    } catch (error) {
      console.error("Failed to bulk download drawings", {
        projectId,
        drawingIds: tableState.selectedIds,
        error,
      });
      toast.error("Could not download selected drawings");
    }
  };

  const selectedItems = React.useMemo(
    () =>
      filteredItems.filter((item) => tableState.selectedIds.includes(item.id)),
    [filteredItems, tableState.selectedIds],
  );

  const buildDrawingLink = (drawingId: string) =>
    `${window.location.origin}/${projectId}/drawings/viewer/${drawingId}`;

  const handleEmailDrawings = (items: DrawingLogTableRow[]) => {
    if (items.length === 0) return;

    const subject =
      items.length === 1
        ? `Drawing ${items[0].drawingNumber || items[0].title}`
        : `${items.length} drawings`;
    const body = items
      .map((item) => {
        const label = [item.drawingNumber, item.title]
          .filter(Boolean)
          .join(" - ");
        return `${label || "Drawing"}\n${buildDrawingLink(item.id)}`;
      })
      .join("\n\n");

    window.location.href = `mailto:?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
  };

  const handleDownloadDrawing = async (item: DrawingLogTableRow) => {
    try {
      const data = await apiFetch<{ downloadUrl?: string; fileName?: string }>(
        `/api/projects/${projectId}/drawings/${item.id}/download`,
      );
      if (!data.downloadUrl) {
        toast.error("No downloadable file found for this drawing");
        return;
      }

      const anchor = document.createElement("a");
      anchor.href = data.downloadUrl;
      anchor.download =
        data.fileName ?? `${item.drawingNumber || item.title || "drawing"}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } catch (error) {
      console.error("Failed to download drawing", {
        projectId,
        drawingId: item.id,
        error,
      });
      toast.error("Could not download drawing");
    }
  };

  const openEditDialog = (item: DrawingLogTableRow) => {
    setEditTarget(item);
    setEditDraft({
      drawingNumber: item.drawingNumber,
      title: item.title,
      discipline: item.discipline ?? "",
      drawingType: item.drawingType ?? "",
    });
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    if (!editDraft.drawingNumber.trim() || !editDraft.title.trim()) {
      toast.error("Drawing number and title are required");
      return;
    }

    await updateDrawing.mutateAsync({
      drawingId: editTarget.id,
      data: {
        drawing_number: editDraft.drawingNumber.trim(),
        title: editDraft.title.trim(),
        discipline: editDraft.discipline.trim() || undefined,
        drawing_type: editDraft.drawingType.trim() || undefined,
      },
    });
    setEditTarget(null);
  };

  const handleSaveBulkEdit = async () => {
    if (selectedItems.length === 0) return;

    const data: {
      discipline?: string;
      drawing_type?: string;
    } = {};

    if (bulkEditDraft.discipline !== SELECT_NO_CHANGE) {
      data.discipline = bulkEditDraft.discipline;
    }
    if (bulkEditDraft.drawingType !== SELECT_NO_CHANGE) {
      data.drawing_type = bulkEditDraft.drawingType;
    }

    if (Object.keys(data).length === 0) {
      toast.error("Choose at least one field to update");
      return;
    }

    await Promise.all(
      selectedItems.map((item) =>
        updateDrawing.mutateAsync({
          drawingId: item.id,
          data,
        }),
      ),
    );
    toast.success(
      `Updated ${selectedItems.length} drawing${
        selectedItems.length === 1 ? "" : "s"
      }`,
    );
    setBulkEditOpen(false);
    setBulkEditDraft({
      discipline: SELECT_NO_CHANGE,
      drawingType: SELECT_NO_CHANGE,
    });
    tableState.setSelectedIds([]);
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedItems.length === 0) return;

    await Promise.all(
      selectedItems.map((item) => deleteDrawing.mutateAsync(item.id)),
    );
    setBulkDeleteOpen(false);
    tableState.setSelectedIds([]);
  };

  const handleExportCsv = () => {
    const header = [
      "Drawing Number",
      "Drawing Title",
      "Discipline",
      "Type",
      "Revision",
      "Set",
      "Status",
      "Drawing Date",
      "Received Date",
    ];
    const rows = filteredItems.map((drawing) => [
      drawing.drawingNumber,
      drawing.title,
      drawing.discipline ?? "",
      drawing.drawingType ?? "",
      drawing.revisionNumber ?? "",
      drawing.setName ?? "",
      getDrawingPublishStateLabel(getDrawingPublishState(drawing)),
      drawing.drawingDate ?? "",
      drawing.receivedDate ?? "",
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map(escapeCsvValue).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `Drawing-Log-${projectId}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    window.open(
      `/api/projects/${projectId}/drawings/pdf`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const handleDeleteDrawing = (item: DrawingLogTableRow) => {
    setDeleteTarget(item);
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    deleteDrawing.mutate(deleteTarget.id, {
      onSettled: () => setDeleteTarget(null),
    });
  };

  // ─── Drag-and-drop handlers ──────────────────────────────────────────────
  const ACCEPTED_TYPES = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/tiff",
  ];

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files).filter(
      (f) =>
        ACCEPTED_TYPES.includes(f.type) ||
        f.name.match(/\.(pdf|png|jpe?g|tiff?)$/i),
    );
    if (files.length > 0) {
      setDroppedFiles(files);
      setUploadOpen(true);
    }
  }, []);

  // Clear dropped files when dialog closes
  const handleUploadOpenChange = useCallback((open: boolean) => {
    setUploadOpen(open);
    if (!open) {
      setDroppedFiles([]);
    }
  }, []);

  const isFiltered =
    Boolean(tableState.searchInput) ||
    Boolean(activeFilters.discipline) ||
    Boolean(activeFilters.setId) ||
    Boolean(activeFilters.publishState);

  const selectedCount = tableState.selectedIds.length;
  const gallerySizeControls =
    tableState.currentView === "card" ? (
      <TooltipProvider>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={`Drawing size: ${galleryImageSizeOption.label}`}
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>
              Drawing size: {galleryImageSizeOption.label}
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Drawing size</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={galleryImageSize}
              onValueChange={(value) => {
                if (isGalleryImageSize(value)) setGalleryImageSize(value);
              }}
            >
              {GALLERY_IMAGE_SIZE_OPTIONS.map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </TooltipProvider>
    ) : null;

  const headerActions =
    selectedCount > 0 ? (
      <>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {selectedCount} selected
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              aria-label={`Actions for ${selectedCount} selected drawings`}
            >
              <MoreVertical className="h-4 w-4" />
              Selected actions
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setBulkEditOpen(true)}>
              <Pencil className="h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleEmailDrawings(selectedItems)}
            >
              {drawingSubscription.data?.subscribed ? (
                <BellOff className="h-4 w-4" />
              ) : (
                <Bell className="h-4 w-4" />
              )}
              Email
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleBulkDownload}>
              <Download className="h-4 w-4" />
              Download
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => tableState.setSelectedIds([])}>
              <X className="h-4 w-4" />
              Clear selection
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    ) : (
      <>
        <Button size="sm" onClick={() => setUploadOpen(true)}>
          <Plus className="h-4 w-4" />
          Upload
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              aria-label="More drawing actions"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setScanDrawingsOpen(true)}>
              <ScanSearch className="h-4 w-4" />
              Scan for submittals
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={
                drawingSubscription.isLoading ||
                toggleDrawingSubscription.isPending
              }
              onClick={() =>
                toggleDrawingSubscription.mutate(
                  !(drawingSubscription.data?.subscribed ?? false),
                )
              }
            >
              <Mail className="h-4 w-4" />
              {drawingSubscription.data?.subscribed
                ? "Unsubscribe from updates"
                : "Subscribe to updates"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Drawing log</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() =>
                router.push(`/${projectId}/drawings/revisions-report`)
              }
            >
              <FileText className="h-4 w-4" />
              All Sets and Revisions
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push(`/${projectId}/drawings/areas`)}
            >
              <MapPin className="h-4 w-4" />
              Create Locations
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    );

  return (
    <div
      className="relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Dropbox-style drag overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm transition-all duration-200 animate-in fade-in">
          <InfoAlert
            variant="info"
            icon={<Upload className="size-8 shrink-0" />}
            className="items-center px-16 py-12 shadow-sm"
          >
            <p className="text-lg font-semibold text-foreground">
              Drop drawings to upload
            </p>
            <p className="text-sm text-muted-foreground">
              PDF, PNG, JPG, or TIFF files
            </p>
          </InfoAlert>
        </div>
      )}

      <UnifiedTablePage
        header={{
          title: "Drawings",
          actions: headerActions,
        }}
        tabs={tabs}
        toolbar={{
          totalItems: drawings.length,
          filteredItems: filteredItems.length,
          selectedCount: tableState.selectedIds.length,
          searchValue: tableState.searchInput,
          onSearchChange: tableState.setSearchInput,
          searchPlaceholder: "Search drawings...",
          currentView: tableState.currentView,
          onViewChange: (view) => {
            tableState.setCurrentView(view);
            tableState.setSearchParams({ view });
          },
          enabledViews: ["table", "card", "list"],
          viewSwitcherDisplay: "icons",
          filters: drawingFilterOptions,
          activeFilters,
          onFilterChange: handleFilterChange,
          onClearFilters: () => handleFilterChange(EMPTY_FILTERS),
          columns: drawingColumns,
          visibleColumns: tableState.visibleColumns,
          onColumnVisibilityChange: tableState.setVisibleColumns,
          customActions: (
            <>
              {gallerySizeControls}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Export drawings"
                    title="Export drawings"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportPdf}>
                    <FileText className="h-4 w-4" />
                    PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportCsv}>
                    <Table2 className="h-4 w-4" />
                    CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ),
        }}
        data={{
          items: filteredItems,
          isLoading,
          isFetching: false,
        }}
        table={{
          columns: tableColumns,
          getRowId: (item) => item.id,
          onRowClick: (item) =>
            router.push(`/${projectId}/drawings/viewer/${item.id}`),
          rowActions: buildDrawingRowActions({
            onEdit: openEditDialog,
            onEmail: (item) => handleEmailDrawings([item]),
            onDownload: handleDownloadDrawing,
            onPublish: (drawingId, publish) =>
              publishDrawing.mutate({ drawingId, publish }),
            onObsolete: (drawingId, obsolete) =>
              obsoleteDrawing.mutate({ drawingId, obsolete }),
            onDelete: handleDeleteDrawing,
            onQrCode: (drawingId, drawingNumber) =>
              setQrTarget({ drawingId, drawingNumber }),
          }),
        }}
        selection={{
          selectedIds: tableState.selectedIds,
          onSelectAll: handleSelectAll,
          onSelectRow: handleSelectRow,
        }}
        sorting={{
          sortBy: tableState.sortBy,
          sortDirection: tableState.sortDirection,
          onSortChange: (sortBy, direction) => {
            tableState.setSortBy(sortBy);
            tableState.setSortDirection(direction);
            tableState.setSearchParams({ sort: sortBy, sort_dir: direction });
          },
        }}
        layout={{
          cardGridClassName: galleryImageSizeOption.gridClassName,
        }}
        views={{
          card: (item) =>
            renderDrawingCard(
              item,
              (r) => router.push(`/${projectId}/drawings/viewer/${r.id}`),
              handleDeleteDrawing,
              {
                selected: tableState.selectedIds.includes(item.id),
                onSelect: handleSelectRow,
              },
              () =>
                setQrTarget({
                  drawingId: item.id,
                  drawingNumber: item.drawingNumber ?? "Drawing",
                }),
              openEditDialog,
              {
                onPublish: (drawingId, publish) =>
                  publishDrawing.mutate({ drawingId, publish }),
                onObsolete: (drawingId, obsolete) =>
                  obsoleteDrawing.mutate({ drawingId, obsolete }),
              },
            ),
          cardGroupBy: (item) => item.discipline || "Ungrouped",
          list: (item) =>
            renderDrawingList(
              item,
              (r) => router.push(`/${projectId}/drawings/viewer/${r.id}`),
              handleDeleteDrawing,
              () =>
                setQrTarget({
                  drawingId: item.id,
                  drawingNumber: item.drawingNumber ?? "Drawing",
                }),
              openEditDialog,
              {
                onPublish: (drawingId, publish) =>
                  publishDrawing.mutate({ drawingId, publish }),
                onObsolete: (drawingId, obsolete) =>
                  obsoleteDrawing.mutate({ drawingId, obsolete }),
              },
            ),
        }}
        emptyState={{
          title: isSetScopedView
            ? "No drawings in this set"
            : "No drawings found",
          description:
            "Drag and drop files here, or click Upload to get started.",
          filteredDescription: isSetScopedView
            ? activeSet
              ? `${activeSet.name} does not have any drawings attached yet.`
              : "This drawing set does not have any drawings attached yet."
            : "Try adjusting your search or filters.",
          isFiltered,
          action: (
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              <Plus className="h-4 w-4" />
              Upload your first drawing
            </Button>
          ),
        }}
        features={{
          enableSearch: true,
          enableFilters: true,
          enableViews: true,
          enableColumnToggle: true,
          enableExport: false,
          enableBulkDelete: false,
          enableRowSelection: true,
          enableRowActions: true,
        }}
      />

      <Dialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Drawing</DialogTitle>
            <DialogDescription>
              Update the drawing metadata shown in the drawing log.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="drawing-edit-number">Drawing Number</Label>
              <Input
                id="drawing-edit-number"
                value={editDraft.drawingNumber}
                onChange={(event) =>
                  setEditDraft((current) => ({
                    ...current,
                    drawingNumber: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="drawing-edit-title">Title</Label>
              <Input
                id="drawing-edit-title"
                value={editDraft.title}
                onChange={(event) =>
                  setEditDraft((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="drawing-edit-discipline">Discipline</Label>
                <Select
                  value={editDraft.discipline || undefined}
                  onValueChange={(value) =>
                    setEditDraft((current) => ({
                      ...current,
                      discipline: value,
                    }))
                  }
                >
                  <SelectTrigger id="drawing-edit-discipline">
                    <SelectValue placeholder="Select discipline" />
                  </SelectTrigger>
                  <SelectContent>
                    {allDisciplines.map((discipline) => (
                      <SelectItem key={discipline} value={discipline}>
                        {discipline}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="drawing-edit-type">Type</Label>
                <Select
                  value={editDraft.drawingType || undefined}
                  onValueChange={(value) =>
                    setEditDraft((current) => ({
                      ...current,
                      drawingType: value,
                    }))
                  }
                >
                  <SelectTrigger id="drawing-edit-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {DRAWING_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateDrawing.isPending}>
              {updateDrawing.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Selected Drawings</DialogTitle>
            <DialogDescription>
              Apply metadata changes to {selectedCount} selected drawing
              {selectedCount === 1 ? "" : "s"}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="bulk-drawing-discipline">Discipline</Label>
              <Select
                value={bulkEditDraft.discipline}
                onValueChange={(value) =>
                  setBulkEditDraft((current) => ({
                    ...current,
                    discipline: value,
                  }))
                }
              >
                <SelectTrigger id="bulk-drawing-discipline">
                  <SelectValue placeholder="Leave unchanged" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SELECT_NO_CHANGE}>
                    Leave unchanged
                  </SelectItem>
                  {allDisciplines.map((discipline) => (
                    <SelectItem key={discipline} value={discipline}>
                      {discipline}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bulk-drawing-type">Type</Label>
              <Select
                value={bulkEditDraft.drawingType}
                onValueChange={(value) =>
                  setBulkEditDraft((current) => ({
                    ...current,
                    drawingType: value,
                  }))
                }
              >
                <SelectTrigger id="bulk-drawing-type">
                  <SelectValue placeholder="Leave unchanged" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SELECT_NO_CHANGE}>
                    Leave unchanged
                  </SelectItem>
                  {DRAWING_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveBulkEdit}
              disabled={updateDrawing.isPending}
            >
              {updateDrawing.isPending ? "Saving..." : "Apply Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DrawingUploadDialog
        projectId={projectId}
        open={uploadOpen}
        onOpenChange={handleUploadOpenChange}
        initialFiles={droppedFiles.length > 0 ? droppedFiles : undefined}
      />

      <ScanDrawingsSheet
        projectId={parseInt(projectId, 10)}
        open={scanDrawingsOpen}
        onOpenChange={setScanDrawingsOpen}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete drawing?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;
              {deleteTarget?.drawingNumber
                ? `${deleteTarget.drawingNumber} — ${deleteTarget.title || "Untitled"}`
                : deleteTarget?.title || "this drawing"}
              &rdquo;. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteDrawing.isPending}
            >
              {deleteDrawing.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {qrTarget && (
        <DrawingQRCode
          projectId={projectId}
          drawingId={qrTarget.drawingId}
          drawingNumber={qrTarget.drawingNumber}
          isOpen={true}
          onClose={() => setQrTarget(null)}
        />
      )}

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete selected drawings?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move {selectedCount} selected drawing
              {selectedCount === 1 ? "" : "s"} to the Recycle Bin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteDrawing.isPending}
            >
              {deleteDrawing.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
