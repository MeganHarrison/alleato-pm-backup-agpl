"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Loader2,
  Upload,
} from "lucide-react";
import { PageShell } from "@/components/layout";
import { SectionRuleHeading } from "@/components/layout/spacing";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { appToast as toast } from "@/lib/toast/app-toast";
import { apiFetch } from "@/lib/api-client";
import { InfoAlert } from "@/components/ds/InfoAlert";
import type {
  ScheduleImportConfidence,
  ScheduleImportPreview,
  ScheduleImportSourceFormat,
  ScheduleImportTask,
} from "@/lib/scheduling/schedule-import-preview";

type ImportResult = {
  imported: number;
  deletedExisting?: number;
  failed: number;
  dependenciesImported?: number;
  errors?: Array<{ index: number; name: string; error: string }>;
};

const SCHEDULE_IMPORT_FILE_LIMIT_BYTES = 50 * 1024 * 1024;
const SUPPORTED_SCHEDULE_ACCEPT = [
  ".mpp",
  ".mpt",
  ".xml",
  ".xlsx",
  ".csv",
  ".pdf",
  "application/vnd.ms-project",
  "text/xml",
  "application/xml",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "application/pdf",
].join(",");

const SOURCE_LABELS: Record<ScheduleImportSourceFormat, string> = {
  mpp: "Microsoft Project",
  mpt: "Microsoft Project template",
  xml: "Microsoft Project XML",
  xlsx: "Excel workbook",
  csv: "CSV file",
  pdf: "PDF schedule",
};

function formatFileSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

function sourceFormatFromName(fileName: string): ScheduleImportSourceFormat | null {
  const lowerFileName = fileName.toLowerCase();
  if (lowerFileName.endsWith(".mpp")) return "mpp";
  if (lowerFileName.endsWith(".mpt")) return "mpt";
  if (lowerFileName.endsWith(".xml")) return "xml";
  if (lowerFileName.endsWith(".xlsx")) return "xlsx";
  if (lowerFileName.endsWith(".csv")) return "csv";
  if (lowerFileName.endsWith(".pdf")) return "pdf";
  return null;
}

function confidenceCopy(confidence: ScheduleImportConfidence): {
  label: string;
  description: string;
  variant: "success" | "warning";
} {
  if (confidence === "high") {
    return {
      label: "High confidence",
      description: "Structured source detected. Review the preview, then import when it matches the source schedule.",
      variant: "success",
    };
  }

  return {
    label: "Review required",
    description: "PDF extraction is best effort. Confirm task names, dates, hierarchy, and missing dependencies before replacing the live schedule.",
    variant: "warning",
  };
}

export default function ScheduleImportPage() {
  const params = useParams()!;
  const projectId = params.projectId as string;
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<ScheduleImportPreview | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const [existingTaskCount, setExistingTaskCount] = React.useState(0);
  const [replaceExisting, setReplaceExisting] = React.useState(true);
  const [result, setResult] = React.useState<ImportResult | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const refreshExistingTaskCount = React.useCallback(async () => {
    const payload = await apiFetch<{ pagination?: { total_records?: number } }>(
      `/api/projects/${projectId}/scheduling/tasks?limit=1`,
    );
    setExistingTaskCount(payload.pagination?.total_records ?? 0);
  }, [projectId]);

  React.useEffect(() => {
    refreshExistingTaskCount().catch((err) => {
      setError(err instanceof Error ? err.message : "Unable to check the current schedule.");
    });
  }, [refreshExistingTaskCount]);

  const convertProjectFile = React.useCallback(
    async (file: File, sourceFormat: ScheduleImportSourceFormat) => {
      const formData = new FormData();
      formData.append("file", file);

      const { convertUrl } = await apiFetch<{ convertUrl: string }>(
        `/api/projects/${projectId}/scheduling/tasks/convert-token`,
        { method: "POST" },
      );

      const response = await fetch(convertUrl, {
        method: "POST",
        body: formData,
      });

      const payload = await response.json().catch(() => ({})) as {
        tasks?: ScheduleImportTask[];
        detail?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          payload.detail ||
            payload.error ||
            `Microsoft Project conversion failed (HTTP ${response.status}).`,
        );
      }

      const convertedTasks = payload.tasks ?? [];
      if (!Array.isArray(convertedTasks) || convertedTasks.length === 0) {
        throw new Error("No active schedule tasks were found in this file.");
      }

      setPreview({
        tasks: convertedTasks,
        source_format: sourceFormat,
        confidence: "high",
        task_count: convertedTasks.length,
        dependency_count: convertedTasks.reduce(
          (count, task) => count + (task.predecessors?.length ?? task.predecessor_external_ids?.length ?? 0),
          0,
        ),
        warnings: [],
      });
    },
    [projectId],
  );

  const previewTabularOrPdfFile = React.useCallback(
    async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const payload = await apiFetch<ScheduleImportPreview>(
        `/api/projects/${projectId}/scheduling/tasks/preview`,
        { method: "POST", body: formData },
      );
      setPreview(payload);
    },
    [projectId],
  );

  const handleFileSelect = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      setError(null);
      setResult(null);
      setPreview(null);
      setFileName(file?.name ?? null);

      if (!file) return;

      const sourceFormat = sourceFormatFromName(file.name);
      if (!sourceFormat) {
        setError("Upload a schedule file as .mpp, .mpt, .xml, .xlsx, .csv, or .pdf.");
        return;
      }

      if (file.size > SCHEDULE_IMPORT_FILE_LIMIT_BYTES) {
        setError(`Schedule files must be smaller than ${formatFileSize(SCHEDULE_IMPORT_FILE_LIMIT_BYTES)}.`);
        return;
      }

      setIsProcessing(true);
      try {
        if (sourceFormat === "mpp" || sourceFormat === "mpt" || sourceFormat === "xml") {
          await convertProjectFile(file, sourceFormat);
        } else {
          await previewTabularOrPdfFile(file);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to preview schedule import file.");
      } finally {
        setIsProcessing(false);
      }
    },
    [convertProjectFile, previewTabularOrPdfFile],
  );

  const handleImport = React.useCallback(async () => {
    if (!preview || preview.tasks.length === 0) {
      setError("Select a supported schedule file before importing.");
      return;
    }

    if (existingTaskCount > 0 && !replaceExisting) {
      setError("This project already has schedule tasks. Choose replace before importing this schedule source.");
      return;
    }

    setIsImporting(true);
    setError(null);
    setResult(null);

    try {
      const payload = await apiFetch<ImportResult>(
        `/api/projects/${projectId}/scheduling/tasks/import`,
        { method: "POST", body: JSON.stringify({ tasks: preview.tasks, replaceExisting }) },
      );

      setResult(payload);
      toast.success(`Imported ${payload?.imported ?? 0} schedule tasks`);
      setPreview(null);
      setFileName(null);
      await refreshExistingTaskCount();
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Schedule import failed.");
    } finally {
      setIsImporting(false);
    }
  }, [existingTaskCount, preview, projectId, refreshExistingTaskCount, replaceExisting]);

  const previewTasks = preview?.tasks.slice(0, 10) ?? [];
  const confidence = preview ? confidenceCopy(preview.confidence) : null;
  const sourceLabel = preview ? SOURCE_LABELS[preview.source_format] : null;
  const isBusy = isProcessing || isImporting;

  return (
    <PageShell
      variant="detail"
      title="Schedule Import"
      description="Import schedule tasks from Microsoft Project, Excel, CSV, or a review-required PDF extraction."
      actions={undefined}
    >
      <section className="space-y-4">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="space-y-2">
            <Label htmlFor="schedule-source-file">Schedule source file</Label>
            <Input
              ref={fileInputRef}
              id="schedule-source-file"
              type="file"
              accept={SUPPORTED_SCHEDULE_ACCEPT}
              onChange={handleFileSelect}
              className="min-h-11"
            />
            <p className="text-xs text-muted-foreground">
              Supports .mpp, .mpt, .xml, .xlsx, .csv, and selectable-text .pdf files up to 50 MB.
            </p>
          </div>
          <Button
            type="button"
            onClick={handleImport}
            disabled={isBusy || !preview || preview.tasks.length === 0}
            className="min-h-11"
          >
            {isBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {isProcessing ? "Reading..." : isImporting ? "Importing..." : "Import Tasks"}
          </Button>
        </div>

        {existingTaskCount > 0 && (
          <InfoAlert
            variant="warning"
            icon={
              <Checkbox
                id="replace-existing-schedule"
                checked={replaceExisting}
                onCheckedChange={(checked) => setReplaceExisting(checked === true)}
                className="mt-0.5"
              />
            }
          >
            <div className="space-y-1">
              <Label htmlFor="replace-existing-schedule" className="font-medium">
                Replace current schedule
              </Label>
              <p>
                This project already has {existingTaskCount} schedule tasks. The source is validated before replacement; if validation or import fails, the current schedule remains unchanged.
              </p>
            </div>
          </InfoAlert>
        )}
      </section>

      {error && (
        <InfoAlert variant="error" role="alert">{error}</InfoAlert>
      )}

      {result && (
        <InfoAlert variant="success" role="status">
          {result.deletedExisting ? `Replaced ${result.deletedExisting} existing tasks and imported ${result.imported} tasks` : `Imported ${result.imported} tasks`}
          {result.dependenciesImported ? ` with ${result.dependenciesImported} dependencies` : ""}
          {result.failed > 0 ? `; ${result.failed} failed.` : "."}
        </InfoAlert>
      )}

      {preview && confidence && (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoAlert
              variant={confidence.variant}
              icon={preview.confidence === "high" ? <CheckCircle2 className="mt-px h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-px h-4 w-4 shrink-0" />}
            >
              <div className="space-y-1">
                <p className="font-medium">{confidence.label}</p>
                <p>{confidence.description}</p>
              </div>
            </InfoAlert>
            <InfoAlert
              variant="info"
              icon={preview.source_format === "pdf" ? <FileText className="mt-px h-4 w-4 shrink-0" /> : <FileSpreadsheet className="mt-px h-4 w-4 shrink-0" />}
            >
              <div className="space-y-1">
                <p className="font-medium">{sourceLabel}</p>
                <p>{fileName} - {preview.task_count} tasks and {preview.dependency_count} dependencies found.</p>
              </div>
            </InfoAlert>
          </div>

          {preview.warnings.length > 0 && (
            <InfoAlert variant="warning">
              <div className="space-y-1">
                {preview.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            </InfoAlert>
          )}

          <div>
            <SectionRuleHeading label="Import Preview" className="mb-1 pb-0" />
            <p className="text-sm text-muted-foreground">
              Review the first {previewTasks.length} rows before importing.
            </p>
          </div>

          <div className="overflow-hidden rounded-md border">
            <div className="grid grid-cols-[minmax(10rem,1fr)_7rem_7rem_5rem_6rem] gap-3 bg-muted/50 px-4 py-2 text-xs font-medium uppercase text-muted-foreground max-sm:hidden">
              <span>Task</span>
              <span>Start</span>
              <span>Finish</span>
              <span className="text-right">Done</span>
              <span className="text-right">Pred.</span>
            </div>
            <div className="divide-y">
              {previewTasks.map((task) => (
                <div
                  key={`${task.external_id}-${task.sort_order}`}
                  className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[minmax(10rem,1fr)_7rem_7rem_5rem_6rem] sm:gap-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{task.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {task.wbs_code ?? "No WBS"}
                      {task.parent_external_id ? " / nested task" : ""}
                    </p>
                  </div>
                  <span className="text-muted-foreground">{task.start_date ?? "-"}</span>
                  <span className="text-muted-foreground">{task.finish_date ?? "-"}</span>
                  <span className="text-right text-muted-foreground max-sm:text-left">
                    {task.percent_complete}%
                  </span>
                  <span className="text-right text-muted-foreground max-sm:text-left">
                    {task.predecessors?.length ?? task.predecessor_external_ids?.length ?? 0}
                  </span>
                </div>
              ))}
              {preview.tasks.length > previewTasks.length && (
                <div className="px-4 py-3 text-sm text-muted-foreground">
                  {preview.tasks.length - previewTasks.length} more tasks will be imported.
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {isProcessing && !preview && (
        <section className="space-y-2">
          <SectionRuleHeading label="Import Preview" className="mb-1 pb-0" />
          <p className="text-sm text-muted-foreground">
            {fileName} - reading schedule source.
          </p>
        </section>
      )}
    </PageShell>
  );
}
