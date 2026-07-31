"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArrowLeft,
  Download,
  Eye,
  EyeOff,
  FileText,
  History,
  Info,
  Link2,
  Mail,
  MessageSquare,
  MoreVertical,
  PenLine,
  Printer,
  RotateCcw,
  Trash2,
  X,
  Check,
  ImageOff,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";
import { PageShell, PageTabs, SectionRuleHeading } from "@/components/layout";
import { DetailField, StatusBadge } from "@/components/ds";
import { InfoAlert } from "@/components/ds/InfoAlert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  InlineTable,
  InlineTableBody,
  InlineTableCell,
  InlineTableHeader,
  InlineTableHeaderCell,
  InlineTableHeaderRow,
  InlineTableRow,
} from "@/components/ds";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState, ErrorState } from "@/components/ds";
import { DrawingComments } from "@/components/drawings/DrawingComments";
import { DrawingRelatedItemsPanel } from "@/components/drawings/DrawingRelatedItemsPanel";
import { DrawingSketchPanel } from "@/components/drawings/DrawingSketchPanel";
import { DrawingChangeHistory } from "@/components/drawings/DrawingChangeHistory";
import { DrawingDistributeDialog } from "@/components/drawings/DrawingDistributeDialog";

import {
  useDrawing,
  useDrawingIntelligence,
  useUpdateDrawing,
  useDeleteDrawing,
  usePublishDrawing,
  useObsoleteDrawing,
} from "@/hooks/use-drawings";
import { useDrawingRevisions } from "@/hooks/use-drawing-revisions";
import { DRAWING_DISCIPLINES, DRAWING_TYPES } from "@/types/drawings.types";
import type { DrawingRevision } from "@/types/drawings.types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDateSafe(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "MMM d, yyyy");
  } catch {
    return "—";
  }
}

// ---------------------------------------------------------------------------
// Field display row
// ---------------------------------------------------------------------------

interface FieldRowProps {
  label: string;
  value: React.ReactNode;
}

function FieldRow({ label, value }: FieldRowProps) {
  return (
    <div className="flex flex-col gap-0.5 py-3 border-b border-border last:border-0">
      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
        {label}
      </span>
      <span className="text-sm text-foreground">{value || "—"}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit form state
// ---------------------------------------------------------------------------

interface EditFormState {
  drawing_number: string;
  title: string;
  discipline: string;
  drawing_type: string;
}

// ---------------------------------------------------------------------------
// Revision table row skeleton
// ---------------------------------------------------------------------------

function RevisionRowSkeleton() {
  return (
    <InlineTableRow>
      <InlineTableCell>
        <Skeleton className="h-4 w-4" />
      </InlineTableCell>
      <InlineTableCell>
        <Skeleton className="h-4 w-4" />
      </InlineTableCell>
      <InlineTableCell>
        <Skeleton className="h-4 w-16" />
      </InlineTableCell>
      <InlineTableCell>
        <Skeleton className="h-4 w-24" />
      </InlineTableCell>
      <InlineTableCell>
        <Skeleton className="h-4 w-20" />
      </InlineTableCell>
      <InlineTableCell>
        <Skeleton className="h-4 w-20" />
      </InlineTableCell>
      <InlineTableCell>
        <Skeleton className="h-5 w-20 rounded-full" />
      </InlineTableCell>
      <InlineTableCell>
        <Skeleton className="h-4 w-4" />
      </InlineTableCell>
    </InlineTableRow>
  );
}

// ---------------------------------------------------------------------------
// Revision table row
// ---------------------------------------------------------------------------

interface RevisionRowProps {
  revision: DrawingRevision;
  projectId: string;
  drawingId: string;
  onDownload: (revision: DrawingRevision) => void;
}

function RevisionRow({
  revision,
  projectId,
  drawingId,
  onDownload,
}: RevisionRowProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editingRevNum, setEditingRevNum] = useState(false);
  const [newRevNum, setNewRevNum] = useState(revision.revision_number);

  const handleSaveRevNum = async () => {
    if (!newRevNum.trim() || newRevNum === revision.revision_number) {
      setEditingRevNum(false);
      return;
    }
    try {
      await apiFetch(
        `/api/projects/${projectId}/drawings/${drawingId}/revisions/${revision.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ revision_number: newRevNum }),
        },
      );
      await queryClient.invalidateQueries({
        queryKey: ["drawing-revisions", projectId, drawingId],
      });
      setEditingRevNum(false);
      toast.success("Revision number updated");
    } catch {
      toast.error("Failed to update revision number");
    }
  };

  return (
    <InlineTableRow
      className={revision.is_current_revision ? "bg-muted/30" : undefined}
    >
      <InlineTableCell>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground transition-colors h-auto p-0"
          onClick={() =>
            router.push(`/${projectId}/drawings/viewer/${drawingId}`)
          }
          title="View in drawing viewer"
          type="button"
        >
          <Info className="h-4 w-4" />
        </Button>
      </InlineTableCell>
      <InlineTableCell>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground transition-colors h-auto p-0"
          onClick={() => onDownload(revision)}
          title="Download this revision"
          type="button"
        >
          <Download className="h-4 w-4" />
        </Button>
      </InlineTableCell>
      <InlineTableCell className="font-medium text-foreground">
        {editingRevNum ? (
          <div className="flex items-center gap-1">
            <Input
              className="h-6 w-20 text-sm px-1"
              value={newRevNum}
              onChange={(e) => setNewRevNum(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveRevNum();
                if (e.key === "Escape") setEditingRevNum(false);
              }}
              autoFocus
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleSaveRevNum}
            >
              <Check className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setEditingRevNum(false)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <>
            {revision.revision_number}
            {revision.is_current_revision && (
              <span className="ml-1.5 text-xs text-muted-foreground">
                (current)
              </span>
            )}
          </>
        )}
      </InlineTableCell>
      <InlineTableCell className="text-muted-foreground text-sm">
        {revision.drawing_set_id ?? "—"}
      </InlineTableCell>
      <InlineTableCell className="text-sm text-muted-foreground">
        {formatDateSafe(revision.drawing_date)}
      </InlineTableCell>
      <InlineTableCell className="text-sm text-muted-foreground">
        {formatDateSafe(revision.received_date)}
      </InlineTableCell>
      <InlineTableCell>
        <StatusBadge status={revision.status} />
      </InlineTableCell>
      <InlineTableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              <MoreVertical />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditingRevNum(true)}>
              Change drawing number
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </InlineTableCell>
    </InlineTableRow>
  );
}

function readableState(state: string) {
  if (state === "ready") return "Ready";
  if (state === "partial") return "Partial";
  if (state === "failed") return "Failed";
  return "Not ready";
}

function stateBadgeVariant(
  state: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (state === "ready") return "default";
  if (state === "failed") return "destructive";
  if (state === "partial") return "secondary";
  return "outline";
}

function DrawingAIExtractionPanel({
  projectId,
  drawingId,
}: {
  projectId: string;
  drawingId: string;
}) {
  const { data, isLoading, error } = useDrawingIntelligence(
    projectId,
    drawingId,
  );

  if (isLoading) {
    return (
      <div className="max-w-5xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <InfoAlert variant="error">
        {error instanceof Error
          ? error.message
          : "Could not load drawing AI extraction evidence."}
      </InfoAlert>
    );
  }

  if (!data) {
    return (
      <EmptyState
        icon={<FileText className="h-6 w-6 text-muted-foreground" />}
        title="No extraction evidence"
        description="The drawing intelligence endpoint did not return extraction data."
      />
    );
  }

  return (
    <div className="max-w-5xl space-y-8">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <SectionRuleHeading label="AI Extraction" />
          <Badge variant={stateBadgeVariant(data.readiness.state)}>
            {readableState(data.readiness.state)}
          </Badge>
        </div>

        <div className="grid gap-4">
          <DetailField
            label="Document record"
            value={data.documentMetadata?.title ?? "No document metadata"}
          >
            <div>
              <div>
                {data.documentMetadata?.title ?? "No document metadata"}
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {data.documentMetadata
                  ? `Status: ${data.documentMetadata.status ?? "unknown"} · Source: ${data.documentMetadata.sourceSystem ?? "unknown"}`
                  : "The OCR and visual AI pipeline has no source record for this drawing."}
              </p>
            </div>
          </DetailField>
          <DetailField
            label="OCR text"
            value={
              data.ocr.ready
                ? `${data.ocr.textLength.toLocaleString()} characters extracted`
                : "No extracted text"
            }
          >
            <div>
              <div>
                {data.ocr.ready
                  ? `${data.ocr.textLength.toLocaleString()} characters extracted`
                  : "No extracted text"}
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {data.revision
                  ? `Revision ${data.revision.revision_number} · Confidence: ${data.revision.ocr_confidence_label} (${data.revision.ocr_confidence_source})`
                  : "No drawing revision is linked to extraction metadata."}
              </p>
            </div>
          </DetailField>
          <DetailField
            label="Visual AI"
            value={
              data.vision.ready
                ? `${data.vision.pageCount} page${data.vision.pageCount === 1 ? "" : "s"} analyzed`
                : "No page summaries"
            }
          >
            <div>
              <div>
                {data.vision.ready
                  ? `${data.vision.pageCount} page${data.vision.pageCount === 1 ? "" : "s"} analyzed`
                  : "No page summaries"}
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {data.vision.pages[0]?.processedAt
                  ? `Last processed ${formatDateSafe(data.vision.pages[0].processedAt)} · ${data.vision.pages[0].visionModel ?? "model unknown"}`
                  : "Visual page extraction writes to document_page_intelligence."}
              </p>
            </div>
          </DetailField>
          <DetailField
            label="Retrieval"
            value={
              data.retrieval.ready
                ? `${data.retrieval.chunkCount} chunk${data.retrieval.chunkCount === 1 ? "" : "s"} available`
                : "No chunks"
            }
          >
            <div>
              <div>
                {data.retrieval.ready
                  ? `${data.retrieval.chunkCount} chunk${data.retrieval.chunkCount === 1 ? "" : "s"} available`
                  : "No chunks"}
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Chunks are used by retrieval-backed AI review and search.
              </p>
            </div>
          </DetailField>
        </div>

        {data.readiness.reasons.length > 0 && (
          <div className="space-y-2">
            <SectionRuleHeading label="Readiness reasons" />
            <ul className="space-y-1 text-sm text-muted-foreground">
              {data.readiness.reasons.map((reason) => (
                <li key={reason} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionRuleHeading label="Extracted Text" />
        {data.ocr.textPreview ? (
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-4 text-xs leading-5 text-foreground">
            {data.ocr.textPreview}
          </pre>
        ) : (
          <EmptyState
            title="No extracted text"
            description="No OCR/raw text is available for this drawing yet."
            className="py-6"
          />
        )}
      </section>

      <section className="space-y-3">
        <SectionRuleHeading label="Visual AI Pages" />
        {data.vision.pages.length === 0 ? (
          <EmptyState
            title="No visual AI pages"
            description="No page-level visual AI extraction rows are available."
            className="py-6"
          />
        ) : (
          <div className="divide-y divide-border">
            {data.vision.pages.map((page) => (
              <article key={page.pageNumber} className="space-y-2 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    Page {page.pageNumber}
                  </span>
                  {(page.sheetNumber || page.sheetTitle) && (
                    <span className="text-sm text-muted-foreground">
                      {[page.sheetNumber, page.sheetTitle]
                        .filter(Boolean)
                        .join(" — ")}
                    </span>
                  )}
                </div>
                {page.aiSummary ? (
                  <p className="text-sm leading-6 text-foreground">
                    {page.aiSummary}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No visual AI summary for this page.
                  </p>
                )}
                {(page.impliedSubmittals.length > 0 ||
                  page.notesAndRequirements.length > 0) && (
                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    {page.impliedSubmittals.length > 0 && (
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Implied submittals
                        </p>
                        <ul className="mt-1 space-y-1 text-muted-foreground">
                          {page.impliedSubmittals.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {page.notesAndRequirements.length > 0 && (
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Notes and requirements
                        </p>
                        <ul className="mt-1 space-y-1 text-muted-foreground">
                          {page.notesAndRequirements.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                {page.rawExtraction ? (
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer">
                      Raw visual extraction
                    </summary>
                    <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-foreground">
                      {JSON.stringify(page.rawExtraction, null, 2)}
                    </pre>
                  </details>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      {data.retrieval.chunks.length > 0 && (
        <section className="space-y-3">
          <SectionRuleHeading label="Retrieval Excerpts" />
          <div className="divide-y divide-border">
            {data.retrieval.chunks.map((chunk) => (
              <div
                key={`${chunk.chunkIndex}-${chunk.textPreview?.slice(0, 12)}`}
                className="py-3"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Chunk {chunk.chunkIndex ?? "unknown"} ·{" "}
                  {chunk.docType ?? "document"}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">
                  {chunk.textPreview}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function DrawingDetailPage() {
  const params = useParams()!;
  const router = useRouter();
  const projectId = params.projectId as string;
  const drawingId = params.drawingId as string;

  const { data: drawing, isLoading, error } = useDrawing(projectId, drawingId);
  const { data: revisions = [], isLoading: revisionsLoading } =
    useDrawingRevisions(projectId, drawingId);
  const updateDrawing = useUpdateDrawing(projectId);
  const deleteDrawing = useDeleteDrawing(projectId);
  const publishDrawing = usePublishDrawing(projectId);
  const obsoleteDrawing = useObsoleteDrawing(projectId);

  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDistributeDialog, setShowDistributeDialog] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState>({
    drawing_number: "",
    title: "",
    discipline: "",
    drawing_type: "",
  });

  // Verify the pdf-proxy can serve the file before rendering the iframe.
  // We use a Range: bytes=0-0 probe — cheap (1 byte) and confirms the file
  // actually exists in storage. If the file is missing, previewUrl stays null
  // and the EmptyState renders instead of raw JSON from Supabase.
  useEffect(() => {
    if (!drawing?.current_revision?.file_url) return;
    setPreviewLoading(true);
    const proxyUrl = `/api/projects/${projectId}/drawings/${drawingId}/pdf-proxy`;
    fetch(proxyUrl, { headers: { Range: "bytes=0-0" } })
      .then((r) => {
        if (r.ok || r.status === 206) setPreviewUrl(proxyUrl);
      })
      .catch(() => {})
      .finally(() => setPreviewLoading(false));
  }, [drawing, projectId, drawingId]);

  // Kick off editing mode — pre-fill the form from drawing data
  const handleStartEdit = () => {
    if (!drawing) return;
    setEditForm({
      drawing_number: drawing.drawing_number ?? "",
      title: drawing.title ?? "",
      discipline: drawing.discipline ?? "",
      drawing_type: drawing.drawing_type ?? "",
    });
    setIsEditing(true);
  };

  const handleCancelEdit = () => setIsEditing(false);

  const handleSaveEdit = async () => {
    if (!drawing) return;
    try {
      await updateDrawing.mutateAsync({
        drawingId,
        data: {
          drawing_number: editForm.drawing_number || undefined,
          title: editForm.title || undefined,
          discipline: editForm.discipline || undefined,
          drawing_type: editForm.drawing_type || undefined,
        },
      });
      setIsEditing(false);
    } catch (error) {
      reportNonCriticalFailure({
        area: "drawing-detail",
        operation: "update-drawing",
        error,
        userVisibleFallback: "Drawing updates were not saved.",
        metadata: { projectId, drawingId },
      });
    }
  };

  const handleDownloadCurrent = useCallback(async () => {
    if (!drawing) return;
    try {
      const data = await apiFetch<{ downloadUrl?: string; fileName?: string }>(
        `/api/projects/${projectId}/drawings/${drawingId}/download`,
      );
      if (data.downloadUrl) {
        const a = document.createElement("a");
        a.href = data.downloadUrl;
        a.download =
          data.fileName ?? `${drawing.drawing_number ?? drawing.title}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast.success("Drawing downloaded successfully");
      }
    } catch (error) {
      reportNonCriticalFailure({
        area: "drawing-detail",
        operation: "download-current-drawing",
        error,
        userVisibleFallback: "Current drawing could not be downloaded.",
        metadata: { projectId, drawingId },
      });
      toast.error("Failed to download drawing");
    }
  }, [projectId, drawingId, drawing]);

  const handleDownloadRevision = useCallback(
    async (revision: DrawingRevision) => {
      try {
        const data = await apiFetch<{
          downloadUrl?: string;
          fileName?: string;
        }>(`/api/projects/${projectId}/drawings/${drawingId}/download`);
        if (data.downloadUrl) {
          const a = document.createElement("a");
          a.href = data.downloadUrl;
          a.download =
            revision.file_name ?? `revision-${revision.revision_number}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          toast.success("Revision downloaded");
        }
      } catch {
        toast.error("Failed to download revision");
      }
    },
    [projectId, drawingId],
  );

  const currentRevision = drawing?.current_revision ?? null;

  const handleDelete = useCallback(() => {
    deleteDrawing.mutate(drawingId, {
      onSuccess: () => {
        router.push(`/${projectId}/drawings`);
      },
    });
  }, [deleteDrawing, drawingId, projectId, router]);

  const handlePrint = useCallback(async () => {
    if (!currentRevision?.file_url) return;
    try {
      const data = await apiFetch<{ downloadUrl?: string }>(
        `/api/projects/${projectId}/drawings/${drawingId}/download`,
      ).catch((error) => {
        reportNonCriticalFailure({
          area: "drawing-detail",
          operation: "load-print-url",
          error,
          userVisibleFallback: "Drawing print URL could not be loaded.",
          metadata: { projectId, drawingId },
        });
        return null;
      });
      if (data?.downloadUrl) {
        const printWindow = window.open(data.downloadUrl, "_blank");
        if (printWindow) {
          printWindow.addEventListener("load", () => {
            printWindow.print();
          });
        }
      }
    } catch (error) {
      reportNonCriticalFailure({
        area: "drawing-detail",
        operation: "print-drawing",
        error,
        userVisibleFallback: "Drawing print action could not be completed.",
        metadata: { projectId, drawingId },
      });
    }
  }, [projectId, drawingId, currentRevision]);

  // ---------------------------------------------------------------------------
  // Error / loading / not found states
  // ---------------------------------------------------------------------------

  if (error) {
    return (
      <ErrorState
        title="Drawing Not Found"
        error={error instanceof Error ? error.message : "An unexpected error occurred — please try again"}
        onRetry={() => router.push(`/${projectId}/drawings`)}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // Page skeleton while loading
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <PageShell variant="detail" title="" onBack={() => router.back()}>
        <Skeleton className="h-9 w-full max-w-2xl" />
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-48 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
          <Skeleton className="h-80 w-full rounded-lg" />
        </div>
      </PageShell>
    );
  }

  if (!drawing) return null;

  const isPdf =
    currentRevision?.file_type?.toLowerCase().includes("pdf") ||
    currentRevision?.file_url?.toLowerCase().endsWith(".pdf");

  // Build status badges for title area
  const statusBadges = (
    <div className="flex items-center gap-2">
      {currentRevision?.status && (
        <StatusBadge status={currentRevision.status} />
      )}
      {drawing.is_published === false && (
        <Badge variant="secondary">Unpublished</Badge>
      )}
      {drawing.is_obsolete === true && (
        <Badge variant="destructive">Obsolete</Badge>
      )}
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <PageShell
      variant="detail"
      title={drawing.title}
      description={
        drawing.drawing_number
          ? `${drawing.drawing_number}${drawing.discipline ? ` · ${drawing.discipline}` : ""}`
          : undefined
      }
      onBack={() => router.back()}
      statusBadge={statusBadges}
      actions={
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              router.push(`/${projectId}/drawings/viewer/${drawingId}`)
            }
          >
            <Eye />
            View
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadCurrent}
            disabled={!currentRevision?.file_url}
          >
            <Download />
            Download
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            disabled={!currentRevision?.file_url}
          >
            <Printer className="h-4 w-4 mr-1.5" />
            Print
          </Button>

          {drawing.is_published ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                publishDrawing.mutate({ drawingId, publish: false })
              }
              disabled={publishDrawing.isPending}
            >
              <EyeOff className="h-4 w-4 mr-1.5" />
              Unpublish
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() =>
                publishDrawing.mutate({ drawingId, publish: true })
              }
              disabled={publishDrawing.isPending}
            >
              <Eye className="h-4 w-4 mr-1.5" />
              Publish
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="px-2">
                <MoreVertical />
                <span className="sr-only">More actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowDistributeDialog(true)}>
                <Mail className="h-4 w-4 mr-2" />
                Email
              </DropdownMenuItem>
              {drawing.is_obsolete ? (
                <DropdownMenuItem
                  onClick={() =>
                    obsoleteDrawing.mutate({ drawingId, obsolete: false })
                  }
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Restore from Obsolete
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={() =>
                    obsoleteDrawing.mutate({ drawingId, obsolete: true })
                  }
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Mark as Obsolete
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Move to Recycle Bin
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      }
    >
      <>
        <PageTabs
          variant="inline"
          tabs={[
            {
              label: "General",
              href: "general",
              isActive: activeTab === "general",
            },
            {
              label: "AI Extraction",
              href: "ai-extraction",
              isActive: activeTab === "ai-extraction",
            },
            {
              label: "Sketches",
              href: "sketches",
              isActive: activeTab === "sketches",
            },
            {
              label: "Download Log",
              href: "download-log",
              isActive: activeTab === "download-log",
            },
            {
              label: "Revision Related Items",
              href: "revision-related",
              isActive: activeTab === "revision-related",
            },
            {
              label: "Drawing Related Items",
              href: "drawing-related",
              isActive: activeTab === "drawing-related",
            },
            {
              label: "Emails",
              href: "emails",
              isActive: activeTab === "emails",
            },
            {
              label: "Change History",
              href: "change-history",
              isActive: activeTab === "change-history",
            },
            {
              label: "Comments",
              href: "comments",
              isActive: activeTab === "comments",
            },
          ]}
          onTabClick={(href) => setActiveTab(href)}
        />
        <div className="mt-6">
          {/* ---------------------------------------------------------------- */}
          {/* GENERAL TAB                                                       */}
          {/* ---------------------------------------------------------------- */}
          {activeTab === "general" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left column — info + revisions */}
              <div className="lg:col-span-2 space-y-6">
                {/* General Information card */}
                <Card className="shadow-xs">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-base">
                      General Information
                    </CardTitle>
                    {!isEditing ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleStartEdit}
                      >
                        Edit
                      </Button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelEdit}
                          disabled={updateDrawing.isPending}
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSaveEdit}
                          disabled={updateDrawing.isPending}
                        >
                          <Check />
                          {updateDrawing.isPending ? "Saving…" : "Save"}
                        </Button>
                      </div>
                    )}
                  </CardHeader>

                  <CardContent>
                    {!isEditing ? (
                      /* View mode */
                      <div>
                        <FieldRow
                          label="Number"
                          value={drawing.drawing_number}
                        />
                        <FieldRow label="Title" value={drawing.title} />
                        <FieldRow
                          label="Discipline"
                          value={drawing.discipline}
                        />
                        <FieldRow label="Type" value={drawing.drawing_type} />
                        <FieldRow
                          label="Obsolete"
                          value={drawing.is_obsolete ? "Yes" : "No"}
                        />
                      </div>
                    ) : (
                      /* Edit mode */
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="drawing_number">Number</Label>
                          <Input
                            id="drawing_number"
                            value={editForm.drawing_number}
                            onChange={(e) =>
                              setEditForm((f) => ({
                                ...f,
                                drawing_number: e.target.value,
                              }))
                            }
                            placeholder="e.g. A-101"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="title">Title</Label>
                          <Input
                            id="title"
                            value={editForm.title}
                            onChange={(e) =>
                              setEditForm((f) => ({
                                ...f,
                                title: e.target.value,
                              }))
                            }
                            placeholder="Drawing title"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="discipline">Discipline</Label>
                          <Select
                            value={editForm.discipline}
                            onValueChange={(val) =>
                              setEditForm((f) => ({ ...f, discipline: val }))
                            }
                          >
                            <SelectTrigger id="discipline">
                              <SelectValue placeholder="Select discipline" />
                            </SelectTrigger>
                            <SelectContent>
                              {DRAWING_DISCIPLINES.map((d) => (
                                <SelectItem key={d} value={d}>
                                  {d}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="drawing_type">Type</Label>
                          <Select
                            value={editForm.drawing_type}
                            onValueChange={(val) =>
                              setEditForm((f) => ({
                                ...f,
                                drawing_type: val,
                              }))
                            }
                          >
                            <SelectTrigger id="drawing_type">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              {DRAWING_TYPES.map((t) => (
                                <SelectItem key={t} value={t}>
                                  {t}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Versions card */}
                <Card className="shadow-xs">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Versions</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <InlineTable variant="read">
                      <InlineTableHeader>
                        <InlineTableRow>
                          <InlineTableHeaderCell className="w-10"></InlineTableHeaderCell>
                          <InlineTableHeaderCell className="w-10"></InlineTableHeaderCell>
                          <InlineTableHeaderCell>
                            Revision
                          </InlineTableHeaderCell>
                          <InlineTableHeaderCell>Set</InlineTableHeaderCell>
                          <InlineTableHeaderCell>
                            Drawing Date
                          </InlineTableHeaderCell>
                          <InlineTableHeaderCell>
                            Received Date
                          </InlineTableHeaderCell>
                          <InlineTableHeaderCell>Status</InlineTableHeaderCell>
                          <InlineTableHeaderCell className="w-10"></InlineTableHeaderCell>
                        </InlineTableRow>
                      </InlineTableHeader>
                      <InlineTableBody>
                        {revisionsLoading ? (
                          <>
                            <RevisionRowSkeleton />
                            <RevisionRowSkeleton />
                          </>
                        ) : revisions.length === 0 ? (
                          <InlineTableRow>
                            <InlineTableCell
                              colSpan={8}
                              className="text-center text-muted-foreground text-sm py-8"
                            >
                              No revisions found
                            </InlineTableCell>
                          </InlineTableRow>
                        ) : (
                          revisions.map((rev) => (
                            <RevisionRow
                              key={rev.id}
                              revision={rev}
                              projectId={projectId}
                              drawingId={drawingId}
                              onDownload={handleDownloadRevision}
                            />
                          ))
                        )}
                      </InlineTableBody>
                    </InlineTable>
                  </CardContent>
                </Card>
              </div>

              {/* Right column — preview */}
              <div>
                <Card className="shadow-xs">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Drawing Preview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {currentRevision?.file_url ? (
                      <div className="space-y-3">
                        {previewLoading ? (
                          <div
                            className="w-full rounded-md border border-border bg-muted flex items-center justify-center"
                            style={{ height: 340 }}
                          >
                            <Skeleton className="h-full w-full rounded-md" />
                          </div>
                        ) : isPdf && previewUrl ? (
                          <iframe
                            src={`${previewUrl}#toolbar=0&navpanes=0`}
                            className="w-full rounded-md border border-border bg-muted"
                            style={{ height: 340 }}
                            title={`Preview of ${drawing.title}`}
                          />
                        ) : !isPdf && previewUrl ? (
                          /* Image preview */
                          <img
                            src={previewUrl}
                            alt={`Preview of ${drawing.title}`}
                            className="w-full rounded-md border border-border object-contain bg-muted"
                            style={{ maxHeight: 340 }}
                          />
                        ) : !previewLoading ? (
                          <EmptyState
                            icon={<ImageOff />}
                            title="Preview unavailable"
                            description="The file could not be loaded from storage."
                          />
                        ) : null}

                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <p className="font-medium text-foreground truncate">
                            {currentRevision.file_name}
                          </p>
                          <p>{formatBytes(currentRevision.file_size)}</p>
                        </div>

                        <Button
                          className="w-full"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            router.push(
                              `/${projectId}/drawings/viewer/${drawingId}`,
                            )
                          }
                        >
                          <Eye />
                          View Full Drawing
                        </Button>
                      </div>
                    ) : (
                      <EmptyState
                        icon={<ImageOff />}
                        title="No preview available"
                        description="Upload a drawing revision to see a preview here."
                      />
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* AI EXTRACTION TAB                                                 */}
          {/* ---------------------------------------------------------------- */}
          {activeTab === "ai-extraction" && (
            <DrawingAIExtractionPanel
              projectId={projectId}
              drawingId={drawingId}
            />
          )}

          {/* ---------------------------------------------------------------- */}
          {/* SKETCHES TAB                                                      */}
          {/* ---------------------------------------------------------------- */}
          {activeTab === "sketches" &&
            (currentRevision ? (
              <DrawingSketchPanel
                projectId={projectId}
                drawingId={drawingId}
                revisionId={currentRevision.id}
              />
            ) : (
              <EmptyState
                icon={<PenLine className="h-6 w-6 text-muted-foreground" />}
                title="No revision yet"
                description="Upload a drawing revision first to add sketches."
              />
            ))}

          {/* ---------------------------------------------------------------- */}
          {/* DOWNLOAD LOG TAB                                                  */}
          {/* ---------------------------------------------------------------- */}
          {activeTab === "download-log" && (
            <EmptyState
              icon={<Download className="h-6 w-6 text-muted-foreground" />}
              title="No downloads recorded"
              description="Download activity for this drawing will be logged here."
            />
          )}

          {/* ---------------------------------------------------------------- */}
          {/* REVISION RELATED ITEMS TAB                                        */}
          {/* ---------------------------------------------------------------- */}
          {activeTab === "revision-related" && (
            <DrawingRelatedItemsPanel
              projectId={projectId}
              drawingId={currentRevision?.id ?? drawingId}
            />
          )}

          {/* ---------------------------------------------------------------- */}
          {/* DRAWING RELATED ITEMS TAB                                         */}
          {/* ---------------------------------------------------------------- */}
          {activeTab === "drawing-related" && (
            <DrawingRelatedItemsPanel
              projectId={projectId}
              drawingId={drawingId}
            />
          )}

          {/* ---------------------------------------------------------------- */}
          {/* EMAILS TAB                                                        */}
          {/* ---------------------------------------------------------------- */}
          {activeTab === "emails" && (
            <>
              <div className="mb-4 flex justify-end">
                <Button size="sm" onClick={() => setShowDistributeDialog(true)}>
                  <Mail />
                  Compose Email
                </Button>
              </div>
              <EmptyState
                icon={<Mail className="h-6 w-6 text-muted-foreground" />}
                title="No emails"
                description="Emails sent or received related to this drawing will appear here."
              />
            </>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* CHANGE HISTORY TAB                                                */}
          {/* ---------------------------------------------------------------- */}
          {activeTab === "change-history" && (
            <DrawingChangeHistory projectId={projectId} drawingId={drawingId} />
          )}

          {/* ---------------------------------------------------------------- */}
          {/* COMMENTS TAB                                                      */}
          {/* ---------------------------------------------------------------- */}
          {activeTab === "comments" && (
            <div className="max-w-2xl">
              <DrawingComments
                drawingId={drawingId}
                projectId={Number(projectId)}
              />
            </div>
          )}
        </div>
      </>

      <DrawingDistributeDialog
        projectId={projectId}
        drawingId={drawingId}
        drawingNumber={drawing.drawing_number ?? drawing.title ?? "Drawing"}
        isOpen={showDistributeDialog}
        onClose={() => setShowDistributeDialog(false)}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete drawing?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;
              {drawing.title || drawing.drawing_number}&rdquo; and all
              associated revisions. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteDrawing.isPending}
            >
              {deleteDrawing.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
