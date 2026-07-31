"use client";

import type { ReactElement } from "react";
import { useEffect, useRef, useState } from "react";
import { FileText, MoreVertical, QrCode } from "lucide-react";

import { formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/ds";

import type {
  ColumnConfig,
  FilterConfig,
  TableColumn,
} from "@/components/tables/unified";
import { editableTextColumn } from "@/components/tables/unified";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDrawingDisplayIdentity } from "@/lib/drawings/drawing-identity";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DRAWING_DISCIPLINES,
  DRAWING_TYPES,
  type DrawingLogTableRow,
} from "@/types/drawings.types";

// ─── Status formatting helpers ──────────────────────────────────────────────

function formatStatus(status: string | null): string {
  if (!status) return "-";
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ─── Column definitions ─────────────────────────────────────────────────────

export const drawingColumns: ColumnConfig[] = [
  { id: "drawingNumber", label: "#", alwaysVisible: true },
  { id: "title", label: "Title", defaultVisible: true },
  { id: "revisionNumber", label: "Rev.", defaultVisible: true },
  { id: "discipline", label: "Discipline", defaultVisible: true },
  { id: "drawingType", label: "Type", defaultVisible: true },
  { id: "status", label: "Review Status", defaultVisible: false },
  { id: "publishState", label: "Status", defaultVisible: true },
  { id: "impliedSubmittals", label: "Req. Submittals", defaultVisible: true },
  { id: "drawingDate", label: "Drawing Date", defaultVisible: true },
  { id: "receivedDate", label: "Received", defaultVisible: true },
  { id: "setName", label: "Set", defaultVisible: false },
  { id: "fileName", label: "File", defaultVisible: false },
  { id: "uploadedByEmail", label: "Uploaded By", defaultVisible: false },
];

export const drawingDefaultVisibleColumns = drawingColumns
  .filter((c) => c.defaultVisible !== false || c.alwaysVisible)
  .map((c) => c.id);

export type DrawingPublishState = "draft" | "published" | "obsolete";

export function getDrawingPublishState(
  item: Pick<DrawingLogTableRow, "isPublished" | "isObsolete">,
): DrawingPublishState {
  if (item.isObsolete) return "obsolete";
  return item.isPublished ? "published" : "draft";
}

export function getDrawingPublishStateLabel(
  state: DrawingPublishState,
): string {
  switch (state) {
    case "draft":
      return "Draft";
    case "obsolete":
      return "Obsolete";
    case "published":
      return "Published";
  }
}

export function matchesDrawingPublishState(
  item: Pick<DrawingLogTableRow, "isPublished" | "isObsolete">,
  state: string | null | undefined,
): boolean {
  if (!state) return true;
  return getDrawingPublishState(item) === state;
}

// ─── Filters ────────────────────────────────────────────────────────────────

export const drawingFilters: FilterConfig[] = [
  {
    id: "discipline",
    label: "Discipline",
    type: "select",
    options: DRAWING_DISCIPLINES.map((v) => ({ value: v, label: v })),
  },
  {
    id: "drawingType",
    label: "Type",
    type: "select",
    options: DRAWING_TYPES.map((v) => ({ value: v, label: v })),
  },
  {
    id: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "draft", label: "Draft" },
      { value: "under_review", label: "Under Review" },
      { value: "approved", label: "Approved" },
      { value: "superseded", label: "Superseded" },
      { value: "void", label: "Void" },
    ],
  },
];

// ─── Table columns ──────────────────────────────────────────────────────────

export interface DrawingInlineEditHandlers {
  /** Disciplines to offer in the inline dropdown (standard list merged with values seen in data). */
  disciplines: string[];
  /** Persists a single-field change for one drawing. Throws on failure so the cell can revert. */
  onUpdate: (
    drawingId: string,
    data: { title?: string; discipline?: string; drawing_type?: string },
  ) => Promise<void>;
}

/**
 * drawingId → { total, missing } counts derived from the required-submittals scan.
 * Pass this when the page already has scan data loaded; omit to hide the column entirely.
 */
export type ImpliedSubmittalCounts = Map<
  string,
  { total: number; missing: number }
>;

export function buildDrawingTableColumns(
  inlineEdit?: DrawingInlineEditHandlers,
  impliedSubmittalCounts?: ImpliedSubmittalCounts,
): TableColumn<DrawingLogTableRow>[] {
  const disciplineOptions = (
    inlineEdit?.disciplines ?? DRAWING_DISCIPLINES
  ).map((v) => ({ value: v, label: v }));
  const titleColumnBase: TableColumn<DrawingLogTableRow> = {
    ...drawingColumns[1],
    render: (item) => {
      const identity = getDrawingDisplayIdentity(item);
      const title = identity.title || "Untitled";
      return (
        <span className="max-w-64 truncate block" title={title}>
          {title}
        </span>
      );
    },
    sortValue: (item) => getDrawingDisplayIdentity(item).title || item.title,
  };

  return [
    {
      ...drawingColumns[0],
      render: (item) => {
        const identity = getDrawingDisplayIdentity(item);
        return <span className="font-medium">{identity.number || "-"}</span>;
      },
      sortValue: (item) =>
        getDrawingDisplayIdentity(item).number || item.drawingNumber,
    },
    inlineEdit
      ? editableTextColumn(
          titleColumnBase,
          {
            getValue: (item) => item.title,
            emptyLabel: "Enter title",
            onEdit: async (item, value) => {
              await inlineEdit.onUpdate(item.id, {
                title: value.trim() || "",
              });
            },
          },
        )
      : titleColumnBase,
    {
      ...drawingColumns[2],
      render: (item) => (
        <Badge variant="outline" className="text-xs">
          {item.revisionNumber || "-"}
        </Badge>
      ),
      sortValue: (item) => item.revisionNumber ?? "",
    },
    {
      ...drawingColumns[3],
      render: (item) => (
        <span className="text-sm">{item.discipline || "-"}</span>
      ),
      sortValue: (item) => item.discipline ?? "",
      editable: Boolean(inlineEdit),
      editType: "select",
      editValue: (item) => item.discipline ?? "",
      editOptions: disciplineOptions,
      editEmptyLabel: "Select discipline",
      onEdit: async (item, value) => {
        await inlineEdit!.onUpdate(item.id, { discipline: value });
      },
    },
    {
      ...drawingColumns[4],
      render: (item) => (
        <span className="text-sm text-muted-foreground">
          {item.drawingType || "-"}
        </span>
      ),
      sortValue: (item) => item.drawingType ?? "",
      editable: Boolean(inlineEdit),
      editType: "select",
      editValue: (item) => item.drawingType ?? "",
      editOptions: DRAWING_TYPES.map((v) => ({ value: v, label: v })),
      editEmptyLabel: "Select type",
      onEdit: async (item, value) => {
        await inlineEdit!.onUpdate(item.id, { drawing_type: value });
      },
    },
    {
      ...drawingColumns[5],
      render: (item) =>
        item.status ? (
          <StatusBadge status={formatStatus(item.status)} />
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
      sortValue: (item) => item.status ?? "",
      // Read-only: review status is driven by the revision publish lifecycle.
      editable: false,
    },
    // Status column: shows Draft / Published / Obsolete.
    {
      ...drawingColumns[6],
      render: (item) => {
        const state = getDrawingPublishState(item);
        if (state === "obsolete") {
          return <Badge variant="secondary">Obsolete</Badge>;
        }
        if (state === "draft") {
          return <Badge variant="destructive">Draft</Badge>;
        }
        return <Badge variant="outline">Published</Badge>;
      },
      sortValue: (item) => getDrawingPublishState(item),
    },
    // Implied submittals column — only rendered when scan data is available
    {
      ...drawingColumns[7],
      render: (item) => {
        if (!impliedSubmittalCounts) return null;
        const counts = impliedSubmittalCounts.get(item.id);
        if (!counts || counts.total === 0) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        return (
          <div className="flex items-center gap-1">
            <span className="text-xs text-foreground">{counts.total}</span>
            {counts.missing > 0 && (
              <span className="inline-flex items-center rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                {counts.missing} missing
              </span>
            )}
          </div>
        );
      },
      sortValue: (item) =>
        impliedSubmittalCounts?.get(item.id)?.missing ?? 0,
    },
    {
      ...drawingColumns[8],
      render: (item) => (
        <span className="text-sm">{formatDate(item.drawingDate)}</span>
      ),
      sortValue: (item) =>
        item.drawingDate ? new Date(item.drawingDate).getTime() : 0,
    },
    {
      ...drawingColumns[9],
      render: (item) => (
        <span className="text-sm">{formatDate(item.receivedDate)}</span>
      ),
      sortValue: (item) =>
        item.receivedDate ? new Date(item.receivedDate).getTime() : 0,
    },
    {
      ...drawingColumns[10],
      render: (item) => (
        <span className="text-sm text-muted-foreground">
          {item.setName || "-"}
        </span>
      ),
      sortValue: (item) => item.setName ?? "",
    },
    {
      ...drawingColumns[11],
      render: (item) => (
        <span className="text-xs text-muted-foreground truncate max-w-32 block">
          {item.fileName || "-"}
        </span>
      ),
      sortValue: (item) => item.fileName ?? "",
    },
    {
      ...drawingColumns[12],
      render: (item) => (
        <span className="text-sm text-muted-foreground">
          {item.uploadedByEmail || "-"}
        </span>
      ),
      sortValue: (item) => item.uploadedByEmail ?? "",
    },
  ];
}

export interface DrawingRowActionCallbacks {
  onEdit: (item: DrawingLogTableRow) => void;
  onEmail: (item: DrawingLogTableRow) => void;
  onDownload: (item: DrawingLogTableRow) => void;
  onPublish: (drawingId: string, publish: boolean) => void;
  onObsolete: (drawingId: string, obsolete: boolean) => void;
  onDelete: (item: DrawingLogTableRow) => void;
  onQrCode?: (drawingId: string, drawingNumber: string) => void;
}

/**
 * Returns a rowActions renderer for UnifiedTablePage that includes
 * Publish/Unpublish, Mark Obsolete/Restore, and Delete actions.
 */
export function buildDrawingRowActions(callbacks: DrawingRowActionCallbacks) {
  return (item: DrawingLogTableRow) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
          <MoreVertical className="h-4 w-4" />
          <span className="sr-only">Open actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            callbacks.onEdit(item);
          }}
        >
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            callbacks.onEmail(item);
          }}
        >
          Email
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            callbacks.onDownload(item);
          }}
        >
          Download
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            callbacks.onPublish(item.id, !item.isPublished);
          }}
        >
          {item.isPublished ? "Unpublish" : "Publish"}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            callbacks.onObsolete(item.id, !item.isObsolete);
          }}
        >
          {item.isObsolete ? "Restore" : "Mark Obsolete"}
        </DropdownMenuItem>
        {callbacks.onQrCode && (
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              callbacks.onQrCode!(item.id, item.drawingNumber ?? "Drawing");
            }}
          >
            QR Code
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            callbacks.onDelete(item);
          }}
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Card / List views ──────────────────────────────────────────────────────

// ─── Drawing grid card component ────────────────────────────────────────────

interface DrawingGridCardProps {
  item: DrawingLogTableRow;
  onClick: (item: DrawingLogTableRow) => void;
  selected?: boolean;
  onSelect?: (id: string, checked: boolean) => void;
}

const PDF_THUMBNAIL_CACHE_LIMIT = 80;
const pdfThumbnailCache = new Map<string, string>();

function getPdfThumbnailCacheKey(fileUrl: string, width: number, height: number) {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  return `${fileUrl}:${Math.round(width)}x${Math.round(height)}@${pixelRatio}`;
}

function cachePdfThumbnail(cacheKey: string, dataUrl: string) {
  if (pdfThumbnailCache.has(cacheKey)) {
    pdfThumbnailCache.delete(cacheKey);
  }
  pdfThumbnailCache.set(cacheKey, dataUrl);

  if (pdfThumbnailCache.size <= PDF_THUMBNAIL_CACHE_LIMIT) return;

  const oldestKey = pdfThumbnailCache.keys().next().value;
  if (oldestKey) {
    pdfThumbnailCache.delete(oldestKey);
  }
}

function DrawingPreviewFallback({ error }: { error?: string | null }) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center text-muted-foreground/40"
      title={error ?? undefined}
    >
      <FileText className="h-8 w-8" />
    </div>
  );
}

function DrawingPdfThumbnail({
  fileUrl,
  title,
}: {
  fileUrl: string;
  title: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shouldRender, setShouldRender] = useState(false);
  const [cachedDataUrl, setCachedDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!("IntersectionObserver" in window)) {
      setShouldRender(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShouldRender(true);
          observer.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );

    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas || !shouldRender) return;

    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<unknown> } | null =
      null;
    let loadingTask: { destroy: () => void; promise: Promise<unknown> } | null =
      null;
    let renderTimeout: number | null = null;

    const renderPreview = () => {
      if (renderTimeout !== null) {
        window.clearTimeout(renderTimeout);
      }

      renderTimeout = window.setTimeout(async () => {
        const rect = container.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        try {
          setError(null);
          const cacheKey = getPdfThumbnailCacheKey(
            fileUrl,
            rect.width,
            rect.height,
          );
          const cached = pdfThumbnailCache.get(cacheKey);
          if (cached) {
            setCachedDataUrl(cached);
            return;
          }

          setCachedDataUrl(null);
          renderTask?.cancel();
          loadingTask?.destroy();

          const { pdfjs } = await import("react-pdf");
          pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
          loadingTask = pdfjs.getDocument(fileUrl);
          const pdf = (await loadingTask.promise) as {
            getPage: (pageNumber: number) => Promise<{
              getViewport: (options: { scale: number }) => {
                width: number;
                height: number;
              };
              render: (options: {
                canvas: HTMLCanvasElement;
                canvasContext: CanvasRenderingContext2D;
                viewport: { width: number; height: number };
              }) => { cancel: () => void; promise: Promise<unknown> };
            }>;
          };
          const page = await pdf.getPage(1);
          if (cancelled) return;

          const baseViewport = page.getViewport({ scale: 1 });
          const scale = Math.min(
            rect.width / baseViewport.width,
            rect.height / baseViewport.height,
          );
          const pixelRatio = window.devicePixelRatio || 1;
          const viewport = page.getViewport({ scale: scale * pixelRatio });
          const cssWidth = baseViewport.width * scale;
          const cssHeight = baseViewport.height * scale;
          const context = canvas.getContext("2d");

          if (!context) {
            setError("Could not render drawing thumbnail.");
            return;
          }

          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = `${cssWidth}px`;
          canvas.style.height = `${cssHeight}px`;
          context.clearRect(0, 0, canvas.width, canvas.height);

          renderTask = page.render({
            canvas,
            canvasContext: context,
            viewport,
          });
          await renderTask.promise;

          if (!cancelled) {
            const dataUrl = canvas.toDataURL("image/png");
            cachePdfThumbnail(cacheKey, dataUrl);
            setCachedDataUrl(dataUrl);
          }
        } catch (loadError) {
          if (cancelled) return;
          if (
            loadError instanceof Error &&
            loadError.name === "RenderingCancelledException"
          ) {
            return;
          }
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not render drawing thumbnail.",
          );
        }
      }, 50);
    };

    const resizeObserver = new ResizeObserver(renderPreview);
    resizeObserver.observe(container);
    renderPreview();

    return () => {
      cancelled = true;
      if (renderTimeout !== null) {
        window.clearTimeout(renderTimeout);
      }
      resizeObserver.disconnect();
      renderTask?.cancel();
      loadingTask?.destroy();
    };
  }, [fileUrl, shouldRender]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 flex items-center justify-center overflow-hidden bg-background"
    >
      {error ? <DrawingPreviewFallback error={error} /> : null}
      {cachedDataUrl && !error ? (
        <img
          src={cachedDataUrl}
          alt={title}
          className="absolute inset-0 h-full w-full object-contain"
        />
      ) : null}
      <canvas
        ref={canvasRef}
        aria-label={title}
        className={error || cachedDataUrl ? "hidden" : "block"}
      />
    </div>
  );
}

function DrawingGridCard({
  item,
  onClick,
  selected,
  onSelect,
}: DrawingGridCardProps) {
  const isPdf =
    item.fileType?.toLowerCase().includes("pdf") ||
    item.fileUrl?.toLowerCase().endsWith(".pdf");
  const isImage =
    item.fileType?.startsWith("image/") ||
    /\.(png|jpe?g|tiff?)$/i.test(item.fileUrl ?? "");

  const publishState = getDrawingPublishState(item);
  const isDraft = publishState === "draft";
  const isObsolete = publishState === "obsolete";
  const dimmed = isObsolete;
  const identity = getDrawingDisplayIdentity(item);
  const numberLabel = (identity.number || "").replace(/[[\]]/g, "");
  const titleLabel = (identity.title || item.fileName || "Untitled").replace(
    /[[\]]/g,
    "",
  );
  const showTitle = titleLabel !== numberLabel;
  const pdfPreviewUrl = `/api/projects/${item.projectId}/drawings/${item.id}/pdf-proxy`;
  const stateClassName = selected
    ? " border-primary ring-1 ring-primary"
    : isDraft
      ? " border-destructive ring-1 ring-destructive/30"
      : " border-border";

  return (
    <Button
      type="button"
      variant="ghost"
      className={`group/card relative flex flex-col items-stretch justify-start h-auto w-full overflow-hidden rounded-lg border bg-background p-0 text-left transition-all hover:bg-muted/40${dimmed ? " opacity-60" : ""}${stateClassName}`}
      onClick={() => onClick(item)}
    >
      {/* Selection checkbox */}
      {onSelect && (
        <div
          className={`absolute left-1.5 top-1.5 z-20 transition-opacity ${selected ? "opacity-100" : "opacity-100 sm:opacity-0 sm:group-hover/card:opacity-100 sm:group-focus-visible/card:opacity-100"}`}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(item.id, !selected);
          }}
        >
          <div
            className={`flex h-4.5 w-4.5 items-center justify-center rounded border-2 text-primary-foreground transition-colors ${selected ? "border-primary bg-primary" : "border-muted-foreground/40 bg-background/80 backdrop-blur-sm"}`}
          >
            {selected && (
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path
                  d="M1 4L3.5 6.5L9 1"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Landscape thumbnail (PDF proportions ~11:8.5) */}
      <div
        className="relative w-full bg-muted"
        style={{ aspectRatio: "11 / 8.5" }}
      >
        {isPdf ? (
          <DrawingPdfThumbnail fileUrl={pdfPreviewUrl} title={item.title} />
        ) : item.fileUrl && isImage ? (
          <img
            src={item.fileUrl}
            alt={item.title}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-contain"
          />
        ) : (
          <DrawingPreviewFallback />
        )}
        {/* State overlay badge */}
        {(isObsolete || isDraft) && (
          <div className="absolute top-1.5 right-1.5">
            {isObsolete ? (
              <Badge variant="secondary" className="text-[10px] px-1 py-0">
                Obsolete
              </Badge>
            ) : (
              <Badge variant="destructive" className="text-[10px] px-1 py-0">
                Draft
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Compact footer */}
      <div className="min-h-12 px-2 py-2">
        <p className="truncate text-sm font-semibold leading-tight text-foreground">
          {numberLabel || titleLabel}
        </p>
        {showTitle ? (
          <p className="mt-1 truncate text-xs leading-tight text-muted-foreground">
            {titleLabel}
          </p>
        ) : null}
      </div>
    </Button>
  );
}

export function renderDrawingCard(
  item: DrawingLogTableRow,
  onClick: (item: DrawingLogTableRow) => void,
  onDelete?: (item: DrawingLogTableRow) => void,
  options?: {
    selected?: boolean;
    onSelect?: (id: string, checked: boolean) => void;
  },
  onQrCode?: () => void,
  onEdit?: (item: DrawingLogTableRow) => void,
  lifecycleActions?: {
    onPublish: (drawingId: string, publish: boolean) => void;
    onObsolete: (drawingId: string, obsolete: boolean) => void;
  },
): ReactElement {
  return (
    <div className="relative group/wrapper">
      {(onEdit || onDelete || onQrCode || lifecycleActions) && (
        <div
          className="absolute right-1.5 top-1.5 z-20 opacity-100 transition-opacity sm:opacity-0 sm:group-hover/wrapper:opacity-100 sm:group-focus-within/wrapper:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="sm"
                className="h-6 w-6 p-0"
                aria-label="Open drawing actions"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEdit && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(item);
                  }}
                >
                  Edit
                </DropdownMenuItem>
              )}
              {onQrCode && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onQrCode();
                  }}
                >
                  QR Code
                </DropdownMenuItem>
              )}
              {lifecycleActions && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      lifecycleActions.onPublish(item.id, !item.isPublished);
                    }}
                  >
                    {item.isPublished ? "Unpublish" : "Publish"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      lifecycleActions.onObsolete(item.id, !item.isObsolete);
                    }}
                  >
                    {item.isObsolete ? "Restore" : "Mark Obsolete"}
                  </DropdownMenuItem>
                </>
              )}
              {onDelete && (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(item);
                  }}
                >
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      <DrawingGridCard
        item={item}
        onClick={onClick}
        selected={options?.selected}
        onSelect={options?.onSelect}
      />
    </div>
  );
}

export function renderDrawingList(
  item: DrawingLogTableRow,
  onClick: (item: DrawingLogTableRow) => void,
  onDelete?: (item: DrawingLogTableRow) => void,
  onQrCode?: () => void,
  onEdit?: (item: DrawingLogTableRow) => void,
  lifecycleActions?: {
    onPublish: (drawingId: string, publish: boolean) => void;
    onObsolete: (drawingId: string, obsolete: boolean) => void;
  },
): ReactElement {
  const publishState = getDrawingPublishState(item);
  const isDraft = publishState === "draft";
  const isObsolete = publishState === "obsolete";
  const dimmed = isObsolete;
  const identity = getDrawingDisplayIdentity(item);
  const label =
    identity.number && identity.title
      ? `${identity.number} - ${identity.title}`
      : identity.number || identity.title || "Untitled";

  return (
    <div className={`relative${dimmed ? " opacity-60" : ""}`}>
      {(onEdit || onDelete || lifecycleActions) && (
        <div
          className="absolute right-2 top-1/2 z-20 -translate-y-1/2"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                aria-label="Open drawing actions"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEdit && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(item);
                  }}
                >
                  Edit
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(item);
                  }}
                >
                  Delete
                </DropdownMenuItem>
              )}
              {lifecycleActions && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      lifecycleActions.onPublish(item.id, !item.isPublished);
                    }}
                  >
                    {item.isPublished ? "Unpublish" : "Publish"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      lifecycleActions.onObsolete(item.id, !item.isObsolete);
                    }}
                  >
                    {item.isObsolete ? "Restore" : "Mark Obsolete"}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <Button
        type="button"
        variant="ghost"
        className={`h-auto flex w-full items-center justify-between rounded-md px-4 py-2 text-left hover:bg-muted/50${onDelete || onEdit ? " pr-12" : ""}`}
        onClick={() => onClick(item)}
      >
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">
            {item.revisionNumber ? `Rev. ${item.revisionNumber}` : "No rev."}
            {item.discipline ? ` · ${item.discipline}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onQrCode && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={(e) => {
                e.stopPropagation();
                onQrCode();
              }}
            >
              <QrCode className="h-4 w-4" />
              <span className="sr-only">QR Code</span>
            </Button>
          )}
          {isObsolete && <Badge variant="secondary">Obsolete</Badge>}
          {isDraft && <Badge variant="destructive">Draft</Badge>}
          {publishState === "published" && (
            <Badge variant="outline">Published</Badge>
          )}
        </div>
      </Button>
    </div>
  );
}
