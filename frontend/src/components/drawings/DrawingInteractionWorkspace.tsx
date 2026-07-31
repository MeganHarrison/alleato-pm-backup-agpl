"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Cloud,
  ChevronLeft,
  ChevronRight,
  Download,
  Eraser,
  Filter,
  Highlighter,
  History,
  Info,
  Link2,
  LoaderCircle,
  MessageSquare,
  MoreVertical,
  MousePointer2,
  Pencil,
  RotateCcw,
  RotateCw,
  Search,
  Square,
  Type,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useCommentUtils } from "@veltdev/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DetailField, DetailFieldGrid, ErrorState } from "@/components/ds";
import { ExpandableSearch } from "@/components/tables/unified/table-toolbar";
import { PageShell } from "@/components/layout";
import { useDrawing, useDrawings } from "@/hooks/use-drawings";
import { apiFetch } from "@/lib/api-client";
import { getDrawingDisplayIdentity } from "@/lib/drawings/drawing-identity";
import {
  getDrawingCommentScope,
  getDrawingCommentTargetId,
} from "@/lib/comments/comment-scope";
import { handleFormError } from "@/lib/handle-form-error";
import { formatFileSize } from "@/lib/schemas/drawing-schemas";
import { useCommentsVisibilityStore } from "@/lib/stores/comments-visibility-store";
import { formatDate } from "@/lib/utils";
import {
  PdfjsExpressDrawingViewer,
  type PdfjsExpressDrawingViewerHandle,
} from "@/components/drawings/PdfjsExpressDrawingViewer";
import type { PdfjsExpressMarkupTool } from "@/components/drawings/PdfjsExpressMarkupOverlay";
import {
  useCreateDrawingPin,
  useDrawingPins,
  type CreatePinInput,
  type DrawingMarkupPin,
} from "@/hooks/use-drawing-pins";
import { DrawingComments } from "@/components/drawings/DrawingComments";
import { DrawingChangeHistory } from "@/components/drawings/DrawingChangeHistory";
import { DrawingLinksPanel } from "@/components/drawings/DrawingLinksPanel";
import { LinkPinModal } from "@/components/drawings/LinkPinModal";
import { DrawingLinkedRecordPreviewDialog } from "@/components/drawings/DrawingLinkedRecordPreviewDialog";

type DrawingSidePanel = "links" | "filter" | "info" | "search" | "comments" | "history" | null;
type MarkupFilterType = Exclude<PdfjsExpressMarkupTool, "idle" | "select" | "link" | "eraser">;
type PinFilterType = DrawingMarkupPin["pin_type"];

const MARKUP_FILTERS: Array<{ type: MarkupFilterType; label: string }> = [
  { type: "pen", label: "Freehand" }, { type: "highlighter", label: "Highlights" }, { type: "rectangle", label: "Rectangles" },
  { type: "cloud", label: "Clouds" }, { type: "arrow", label: "Arrows" }, { type: "text", label: "Text" }, { type: "note", label: "Notes" },
];
const PIN_TYPE_FILTERS: Array<{ type: PinFilterType; label: string }> = [
  { type: "rfi", label: "RFIs" }, { type: "punch_item", label: "Punch Items" }, { type: "coordination_issue", label: "Coordination Issues" }, { type: "task", label: "Tasks" },
  { type: "drawing", label: "Drawing Links" }, { type: "document", label: "Documents" }, { type: "photo", label: "Photos" }, { type: "submittal", label: "Submittals" },
];
const MARKUP_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#111827"] as const;
const COLORABLE_MARKUP_TOOLS = new Set<PdfjsExpressMarkupTool>(["pen", "highlighter", "rectangle", "cloud", "arrow", "text"]);
const DRAWING_LOAD_TIMEOUT_MS = 20_000;
interface DrawingInteractionWorkspaceProps {
  projectId: string;
  drawingId: string;
}

export function DrawingInteractionWorkspace({ projectId, drawingId }: DrawingInteractionWorkspaceProps) {
  const pathname = usePathname();
  const router = useRouter();
  const drawingCommentTargetId = getDrawingCommentTargetId(drawingId);

  const {
    data: drawing,
    isLoading,
    error,
    refetch: refetchDrawing,
  } = useDrawing(projectId, drawingId);
  const { data: drawingsData } = useDrawings(projectId, { page_size: 200 });
  const { data: pins = [] } = useDrawingPins(projectId, drawingId);
  const createPin = useCreateDrawingPin(projectId, drawingId);
  const setCommentsVisible = useCommentsVisibilityStore((state) => state.setVisible);
  const commentElement = useCommentUtils();
  const viewerHandleRef = useRef<PdfjsExpressDrawingViewerHandle | null>(null);
  const [pageInfo, setPageInfo] = useState({ current: 1, total: 0 });
  const [markupTool, setMarkupTool] = useState<PdfjsExpressMarkupTool>("select");
  const [markupColor, setMarkupColor] = useState<string>(MARKUP_COLORS[0]);
  const [sidePanel, setSidePanel] = useState<DrawingSidePanel>(null);
  const [drawingSearch, setDrawingSearch] = useState("");
  const [hiddenMarkupTypes, setHiddenMarkupTypes] = useState<MarkupFilterType[]>([]);
  const [hiddenPinTypes, setHiddenPinTypes] = useState<PinFilterType[]>([]);
  const [showPins, setShowPins] = useState(true);
  const [pendingLinkPosition, setPendingLinkPosition] = useState<{ x: number; y: number; page: number } | null>(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [canUndoAnnotation, setCanUndoAnnotation] = useState(false);
  const [previewPin, setPreviewPin] = useState<DrawingMarkupPin | null>(null);
  const [drawingLoadTimedOut, setDrawingLoadTimedOut] = useState(false);
  const [drawingLoadAttempt, setDrawingLoadAttempt] = useState(0);

  useEffect(() => {
    if (!isLoading) {
      setDrawingLoadTimedOut(false);
      return;
    }

    const timeout = window.setTimeout(() => setDrawingLoadTimedOut(true), DRAWING_LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [drawingId, drawingLoadAttempt, isLoading]);

  const retryDrawingLoad = useCallback(() => {
    setDrawingLoadTimedOut(false);
    setDrawingLoadAttempt((attempt) => attempt + 1);
    void refetchDrawing();
  }, [refetchDrawing]);

  const drawings = drawingsData?.drawings ?? [];
  const currentIndex = drawings.findIndex((item) => item.id === drawingId);
  const prevDrawing = currentIndex > 0 ? drawings[currentIndex - 1] : null;
  const nextDrawing =
    currentIndex >= 0 && currentIndex < drawings.length - 1
      ? drawings[currentIndex + 1]
      : null;

  const drawingIdentity = useMemo(() => {
    if (!drawing) return null;
    return getDrawingDisplayIdentity({
      drawingNumber: drawing.drawing_number,
      title: drawing.title,
      fileName: drawing.current_revision?.file_name,
      revisionNumber: drawing.current_revision?.revision_number?.toString(),
    });
  }, [drawing]);
  const proxyFileUrl = `/api/projects/${projectId}/drawings/${drawingId}/pdf-proxy`;
  const drawingSearchResults = useMemo(() => {
    const query = drawingSearch.trim().toLocaleLowerCase();
    if (!query) return drawings;
    return drawings.filter((item) =>
      [item.drawingNumber, item.title].some((value) => value?.toLocaleLowerCase().includes(query)),
    );
  }, [drawingSearch, drawings]);

  const handlePageNumberChange = useCallback((current: number, total: number) => {
    setPageInfo({ current, total });
  }, []);

  useEffect(() => {
    const handleUndoShortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z" || event.shiftKey || !canUndoAnnotation) return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.isContentEditable)) return;
      event.preventDefault();
      viewerHandleRef.current?.undo();
    };
    window.addEventListener("keydown", handleUndoShortcut);
    return () => window.removeEventListener("keydown", handleUndoShortcut);
  }, [canUndoAnnotation]);

  const navigateToDrawing = useCallback(
    (targetDrawingId: string) => {
      window.location.assign(`/${projectId}/drawings/viewer/${targetDrawingId}`);
    },
    [projectId],
  );

  const navigateToDrawingsRegister = useCallback(() => {
    window.location.assign(`/${projectId}/drawings`);
  }, [projectId]);

  const handlePinClick = useCallback((pin: DrawingMarkupPin) => {
    if (pin.pin_type !== "photo") setPreviewPin(pin);
  }, []);

  const handleLinkPosition = useCallback((position: { x: number; y: number; page: number }) => {
    setPendingLinkPosition(position);
    setLinkModalOpen(true);
  }, []);

  const handleLinkConfirm = useCallback(
    async (input: CreatePinInput) => {
      await createPin.mutateAsync(input);
      toast.success("Punch item created and linked to drawing");
      setSidePanel("links");
      setMarkupTool("select");
    },
    [createPin],
  );

  const drawingCommentScope = useMemo(() => {
    const documentName = drawingIdentity
      ? [drawingIdentity.number, drawingIdentity.title].filter(Boolean).join(" - ")
      : undefined;
    return getDrawingCommentScope({
      projectId,
      drawingId,
      routePath: pathname ?? undefined,
      page: pageInfo.current,
      documentName,
    });
  }, [drawingId, drawingIdentity, pageInfo.current, pathname, projectId]);

  const prepareDrawingComments = useCallback(() => {
    if (!commentElement) {
      toast.error("Drawing comments are still loading.", {
        description: "Wait a moment and try the Comment tool again.",
      });
      return;
    }

    setMarkupTool("select");
    setCommentsVisible(true);
    setSidePanel("comments");
    // Mount the drawing-scoped embedded sidebar before entering Velt comment
    // mode. VeltCommentTool opens its own sidebar immediately, which races the
    // conditional drawing sidebar and leaves the drawing canvas inert.
    window.requestAnimationFrame(() => {
      commentElement.setContextProvider(() => ({
        ...drawingCommentScope.context,
        submissionIntent: "comment",
      }));
      commentElement.enableContextInPageModeComposer?.();
      commentElement.showCommentsOnDom();
      commentElement.enableCommentMode();
    });
  }, [commentElement, drawingCommentScope.context, setCommentsVisible]);

  const handleDownload = useCallback(async () => {
    if (!drawing) return;

    try {
      const data = await apiFetch<{ downloadUrl?: string; fileName?: string }>(
        `/api/projects/${projectId}/drawings/${drawingId}/download`,
      );

      if (!data.downloadUrl) {
        throw new Error("Download URL was not returned by the drawings API.");
      }

      const anchor = document.createElement("a");
      anchor.href = data.downloadUrl;
      const fallbackName = [
        drawingIdentity?.number,
        drawingIdentity?.title,
      ]
        .filter(Boolean)
        .join(" - ");
      anchor.download = data.fileName ?? `${fallbackName || "drawing"}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      toast.success("Drawing downloaded");
    } catch (downloadError) {
      console.error(downloadError);
      handleFormError(downloadError, {
        entity: "drawing",
        action: "download",
      });
    }
  }, [drawing, drawingId, drawingIdentity, projectId]);

  if (error) {
    return (
      <PageShell
        variant="table"
        title="Drawing Viewer"
        showHeader={false}
        fillHeight
        className="min-h-0 flex-1"
        contentClassName="flex h-full"
      >
        <ErrorState
          title="Failed to load drawing"
          error={error}
          onRetry={retryDrawingLoad}
          className="m-auto"
        />
      </PageShell>
    );
  }

  if (isLoading && !drawingLoadTimedOut) {
    return (
      <PageShell
        variant="table"
        title="Drawing Viewer"
        showHeader={false}
        fillHeight
        className="min-h-0 flex-1"
        contentClassName="flex h-full"
      >
        <div
          className="m-auto flex items-center gap-2 text-sm text-muted-foreground"
          role="status"
        >
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading drawing...
        </div>
      </PageShell>
    );
  }

  if (isLoading) {
    return (
      <PageShell
        variant="table"
        title="Drawing Viewer"
        showHeader={false}
        fillHeight
        className="min-h-0 flex-1"
        contentClassName="flex h-full"
      >
        <ErrorState
          title="Drawing is taking too long to load"
          description="The drawing service did not respond in time. Try again; your drawing changes have not been modified."
          onRetry={retryDrawingLoad}
          className="m-auto"
        />
      </PageShell>
    );
  }

  if (!drawing) {
    return (
      <PageShell
        variant="table"
        title="Drawing Viewer"
        showHeader={false}
        fillHeight
        className="min-h-0 flex-1"
        contentClassName="flex h-full"
      >
        <ErrorState
          title="Drawing not found"
          description="The requested drawing could not be loaded."
          className="m-auto"
        />
      </PageShell>
    );
  }

  if (!drawing.current_revision?.file_url) {
    return (
      <PageShell
        variant="table"
        title="Drawing Viewer"
        showHeader={false}
        fillHeight
        className="min-h-0 flex-1"
        contentClassName="flex h-full"
      >
        <ErrorState
          title="No drawing file available"
          description="This drawing does not have a current revision file to display."
          className="m-auto"
        />
      </PageShell>
    );
  }

  const panelActions = [
    { panel: "links" as const, icon: Link2, label: `Links${pins.length ? ` (${pins.length})` : ""}` },
    { panel: "filter" as const, icon: Filter, label: "Filter annotations" },
    { panel: "info" as const, icon: Info, label: "Drawing info" },
    { panel: "search" as const, icon: Search, label: "Search drawings" },
    { panel: "comments" as const, icon: MessageSquare, label: "Comments" },
    { panel: "history" as const, icon: History, label: "History" },
  ];

  return (
    <PageShell
      variant="table"
      title="Drawing Viewer"
      showHeader={false}
      fillHeight
      className="dark min-h-0 flex-1 overflow-hidden bg-background"
      contentClassName="flex h-full flex-col !pt-0 !pb-0"
      containerPaddingClassName="px-0 py-0"
    >
      <div className="flex h-14 shrink-0 items-center gap-1 border-b border-border bg-card px-1.5 text-foreground sm:h-12 sm:gap-2 sm:px-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={navigateToDrawingsRegister}
          className="h-11 w-11 px-0 text-muted-foreground hover:bg-muted hover:text-foreground sm:h-8 sm:w-auto sm:px-2"
          aria-label="Drawings"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Drawings</span>
        </Button>

        <div className="hidden h-4 w-px bg-border sm:block" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!prevDrawing}
          onClick={() => prevDrawing && navigateToDrawing(prevDrawing.id)}
          className="h-11 w-11 p-0 text-muted-foreground hover:bg-muted hover:text-foreground sm:h-8 sm:w-8"
          aria-label="Previous drawing"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!nextDrawing}
          onClick={() => nextDrawing && navigateToDrawing(nextDrawing.id)}
          className="h-11 w-11 p-0 text-muted-foreground hover:bg-muted hover:text-foreground sm:h-8 sm:w-8"
          aria-label="Next drawing"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground">
            {drawingIdentity
              ? [drawingIdentity.number, drawingIdentity.title]
                  .filter(Boolean)
                  .join(" - ")
              : "Loading drawing..."}
          </div>
          <div className="hidden truncate text-xs text-muted-foreground sm:block">
            {drawing?.current_revision?.revision_number
              ? `Revision ${drawing.current_revision.revision_number}`
              : "No revision number"}
            {pageInfo.total > 0 ? ` • Page ${pageInfo.current} of ${pageInfo.total}` : ""}
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!canUndoAnnotation}
          onClick={() => viewerHandleRef.current?.undo()}
          className="hidden h-8 w-8 p-0 text-muted-foreground hover:bg-muted hover:text-foreground sm:inline-flex"
          aria-label="Undo last annotation"
          title="Undo last annotation (Ctrl/Command+Z)"
        >
          <Undo2 className="h-4 w-4" />
        </Button>

        {panelActions.map(({ panel, icon: Icon, label }) => (
          <Button
            key={panel}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSidePanel((current) => current === panel ? null : panel)}
            className={
              sidePanel === panel
                ? "hidden h-8 w-8 bg-muted p-0 text-foreground hover:bg-muted hover:text-foreground sm:inline-flex"
                : "hidden h-8 w-8 p-0 text-muted-foreground hover:bg-muted hover:text-foreground sm:inline-flex"
            }
            aria-label={label}
            title={label}
          >
            <Icon className="h-4 w-4" />
          </Button>
        ))}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleDownload}
          className="hidden h-8 w-8 p-0 text-muted-foreground hover:bg-muted hover:text-foreground sm:inline-flex"
          aria-label="Download drawing"
          title="Download drawing"
        >
          <Download className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={navigateToDrawingsRegister}
          className="hidden h-8 w-8 p-0 text-muted-foreground hover:bg-muted hover:text-foreground sm:inline-flex"
          aria-label="Close viewer"
        >
          <X className="h-4 w-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-11 w-11 shrink-0 p-0 text-muted-foreground hover:bg-muted hover:text-foreground sm:hidden"
              aria-label="More drawing actions"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {panelActions.map(({ panel, icon: Icon, label }) => (
              <DropdownMenuItem key={panel} onSelect={() => setSidePanel(panel)}>
                <Icon className="h-4 w-4" />
                {label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void handleDownload()}>
              <Download className="h-4 w-4" />
              Download drawing
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={navigateToDrawingsRegister}>
              <X className="h-4 w-4" />
              Close viewer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden bg-background">
        <aside className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-border bg-card py-3" aria-label="Drawing annotation tools">
          {[
            { tool: "select" as const, icon: MousePointer2, label: "Select" },
            { tool: "pen" as const, icon: Pencil, label: "Pen" },
            { tool: "highlighter" as const, icon: Highlighter, label: "Highlight" },
            { tool: "rectangle" as const, icon: Square, label: "Rectangle" },
            { tool: "cloud" as const, icon: Cloud, label: "Cloud" },
            { tool: "arrow" as const, icon: ArrowUpRight, label: "Arrow" },
            { tool: "text" as const, icon: Type, label: "Text" },
            { tool: "link" as const, icon: Link2, label: "Link" },
            { tool: "eraser" as const, icon: Eraser, label: "Eraser" },
          ].map(({ tool, icon: Icon, label }) => (
            <Button
              key={tool}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setMarkupTool(tool)}
              className={
                markupTool === tool
                  ? "h-10 w-10 bg-primary p-0 text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                  : "h-10 w-10 p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
              }
              aria-label={`${label} markup tool`}
              aria-pressed={markupTool === tool}
              title={label}
            >
              <Icon className="h-4 w-4" />
            </Button>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={prepareDrawingComments}
            className="h-10 w-10 p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Comment on drawing"
            title="Comment"
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
          {COLORABLE_MARKUP_TOOLS.has(markupTool) && (
            <>
              <div className="my-1 h-px w-8 bg-border" />
              <div className="flex flex-col items-center gap-1" aria-label="Markup color">
                {MARKUP_COLORS.map((color) => (
                  <Button
                    key={color}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setMarkupColor(color)}
                    className={
                      markupColor === color
                        ? "h-5 w-5 rounded-full border-2 border-foreground p-0"
                        : "h-5 w-5 rounded-full border-2 border-transparent p-0 hover:border-foreground/60"
                    }
                    style={{ backgroundColor: color }}
                    aria-label={`Use markup color ${color}`}
                    title={color}
                  />
                ))}
              </div>
            </>
          )}
          <div className="mt-auto flex flex-col items-center gap-1">
            <div className="mb-1 h-px w-8 bg-border" />
            {[
              { action: () => viewerHandleRef.current?.zoomIn(), icon: ZoomIn, label: "Zoom in" },
              { action: () => viewerHandleRef.current?.zoomOut(), icon: ZoomOut, label: "Zoom out" },
              { action: () => viewerHandleRef.current?.rotateCounterClockwise(), icon: RotateCcw, label: "Rotate left" },
              { action: () => viewerHandleRef.current?.rotateClockwise(), icon: RotateCw, label: "Rotate right" },
            ].map(({ action, icon: Icon, label }) => (
              <Button key={label} type="button" variant="ghost" size="sm" onClick={action} className="h-10 w-10 p-0 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={label} title={label}>
                <Icon className="h-4 w-4" />
              </Button>
            ))}
          </div>
        </aside>

        <div className="relative flex min-h-0 min-w-0 flex-1">
        <div id={drawingCommentTargetId} data-drawing-comment-target="true" className="min-w-0 flex-1 overflow-hidden">
          <PdfjsExpressDrawingViewer
            ref={viewerHandleRef}
            fileUrl={proxyFileUrl}
            licenseKey={process.env.NEXT_PUBLIC_PDFJS_EXPRESS_LICENSE_KEY}
            projectId={projectId}
            drawingId={drawingId}
            page={pageInfo.current}
            markupTool={markupTool}
            markupColor={markupColor}
            pins={pins}
            hiddenMarkupTypes={hiddenMarkupTypes}
            hiddenPinTypes={hiddenPinTypes}
            showPins={showPins}
            onPinClick={handlePinClick}
            onLinkPosition={handleLinkPosition}
            onNoteOpen={() => setSidePanel("comments")}
            onUndoAvailabilityChange={setCanUndoAnnotation}
            className="h-full w-full overflow-hidden"
            onPageNumberChange={handlePageNumberChange}
          />
        </div>

        {sidePanel && (
          <aside className="absolute inset-y-0 right-0 z-20 flex w-4/5 max-w-80 flex-col border-l border-border bg-card text-foreground shadow-md sm:static sm:w-80 sm:shrink-0 sm:shadow-none">
            <div className="flex h-11 shrink-0 items-center justify-between px-4">
              <span className="text-sm font-medium">{{ links: "Links", filter: "Filter", info: "Info", search: "Search", comments: "Comments", history: "History" }[sidePanel]}</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setSidePanel(null)} className="h-7 w-7 p-0 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close side panel">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {sidePanel === "links" && (
                <DrawingLinksPanel
                  pins={pins}
                  projectId={projectId}
                  drawingId={drawingId}
                  currentPage={pageInfo.current}
                  onStartLinkPlacement={() => {
                    setMarkupTool("link");
                    setSidePanel(null);
                  }}
                />
              )}
              {sidePanel === "filter" && (
                <div className="space-y-6 p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Visibility</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setHiddenMarkupTypes([]);
                        setHiddenPinTypes([]);
                        setShowPins(true);
                      }}
                      className="h-7 px-2 text-xs"
                    >
                      Show all
                    </Button>
                  </div>
                  <div className="space-y-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPins((current) => !current)}
                      className="flex h-9 w-full justify-between px-2 text-sm"
                    >
                      <span>Linked items</span>
                      <span className="text-muted-foreground">{showPins ? "Visible" : "Hidden"}</span>
                    </Button>
                    {MARKUP_FILTERS.map(({ type, label }) => {
                      const visible = !hiddenMarkupTypes.includes(type);
                      return (
                        <Button
                          key={type}
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setHiddenMarkupTypes((current) =>
                              visible ? [...current, type] : current.filter((item) => item !== type),
                            )
                          }
                          className="flex h-9 w-full justify-between px-2 text-sm"
                        >
                          <span>{label}</span>
                          <span className="text-muted-foreground">{visible ? "Visible" : "Hidden"}</span>
                        </Button>
                      );
                    })}
                  </div>
                  <div className="space-y-1">
                    <p className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Linked item types</p>
                    {PIN_TYPE_FILTERS.map(({ type, label }) => {
                      const visible = showPins && !hiddenPinTypes.includes(type);
                      return (
                        <Button
                          key={type}
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setHiddenPinTypes((current) =>
                              current.includes(type) ? current.filter((item) => item !== type) : [...current, type],
                            )
                          }
                          className="flex h-9 w-full justify-between px-2 text-sm"
                        >
                          <span>{label}</span>
                          <span className="text-muted-foreground">{visible ? "Visible" : "Hidden"}</span>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}
              {sidePanel === "info" && (
                <DetailFieldGrid columns={1} className="gap-y-4 p-4">
                  <DetailField label="Drawing"><span className="font-medium">{drawingIdentity?.title ?? "Untitled drawing"}</span><span className="block text-muted-foreground">{drawingIdentity?.number ?? "No drawing number"}</span></DetailField>
                  <DetailField label="Discipline">{drawing.discipline ?? "-"}</DetailField>
                  <DetailField label="Revision">{drawing.current_revision?.revision_number ?? "-"}</DetailField>
                  <DetailField label="Status"><span className="capitalize">{drawing.current_revision?.status ?? "-"}</span></DetailField>
                  <DetailField label="Drawing Date">{formatDate(drawing.current_revision?.drawing_date) || "-"}</DetailField>
                  <DetailField label="Received">{formatDate(drawing.current_revision?.received_date) || "-"}</DetailField>
                  <DetailField label="File">{drawing.current_revision?.file_name ?? "-"}</DetailField>
                  <DetailField label="Size">
                    {typeof drawing.current_revision?.file_size === "number"
                      ? formatFileSize(drawing.current_revision.file_size)
                      : "-"}
                  </DetailField>
                </DetailFieldGrid>
              )}
              {sidePanel === "search" && (
                <div className="p-3"><ExpandableSearch value={drawingSearch} onChange={setDrawingSearch} placeholder="Search drawings" ariaLabel="Search drawings" /><div className="mt-3 divide-y divide-border">{drawingSearchResults.map((item) => <Button key={item.id} type="button" variant="ghost" size="sm" onClick={() => navigateToDrawing(item.id)} className="flex h-auto w-full justify-start gap-3 px-1 py-3 text-left hover:text-primary"><span className="w-16 shrink-0 text-xs text-muted-foreground">{item.drawingNumber}</span><span className="truncate text-sm">{item.title}</span></Button>)}</div></div>
              )}
              {sidePanel === "comments" && (
                <div className="flex h-full min-h-0 flex-col">
                  <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                    <DrawingComments
                      drawingId={drawingId}
                      documentId={drawingCommentScope.documentId}
                      projectId={Number(projectId)}
                      className="drawing-comments-panel min-h-full"
                    />
                  </div>
                  <div className="shrink-0 border-t border-border px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 text-xs text-muted-foreground">
                        {pins.length} linked item{pins.length === 1 ? "" : "s"}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setMarkupTool("link");
                          setSidePanel(null);
                        }}
                        className="h-8 shrink-0 gap-1.5 px-2 text-xs"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                        Link item
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              {sidePanel === "history" && <div className="p-3"><DrawingChangeHistory projectId={projectId} drawingId={drawingId} /></div>}
            </div>
          </aside>
        )}
        </div>
      </div>
        <LinkPinModal
        open={linkModalOpen}
        onOpenChange={setLinkModalOpen}
        projectId={projectId}
        drawingReference={drawing?.drawing_number ?? undefined}
        pendingPosition={pendingLinkPosition}
        onConfirm={handleLinkConfirm}
        />
        <DrawingLinkedRecordPreviewDialog
          pin={previewPin}
          projectId={projectId}
          onOpenChange={(open) => { if (!open) setPreviewPin(null); }}
        />
    </PageShell>
  );
}
