"use client";

import { useCallback, useState } from "react";
import {
  Download,
  FileCode2,
  FileJson,
  FileSpreadsheet,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { InfoAlert } from "@/components/ds/InfoAlert";
import { exportScheduleToMspdiXml } from "@/lib/scheduling/schedule-mspdi-export";
import type { ScheduleTask } from "@/types/scheduling";

type ExportFormat = "csv" | "json" | "mspdi";

interface ImportExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  tasks: ScheduleTask[];
}

export const FLAT_SCHEDULE_EXPORT_COLUMNS: ReadonlyArray<{
  key: keyof ScheduleTask;
  label: string;
}> = [
  { key: "name", label: "Task Name" },
  { key: "wbs_code", label: "WBS Code" },
  { key: "start_date", label: "Start Date" },
  { key: "finish_date", label: "Finish Date" },
  { key: "duration_days", label: "Duration (Days)" },
  { key: "percent_complete", label: "% Complete" },
  { key: "status", label: "Status" },
  { key: "is_milestone", label: "Is Milestone" },
  { key: "constraint_type", label: "Constraint Type" },
  { key: "constraint_date", label: "Constraint Date" },
];

export const FLAT_SCHEDULE_EXPORT_LIMITATIONS = [
  "Dependencies and lead/lag relationships",
  "Hierarchy and parent task links",
  "Resources, calendars, segments, and leveling history",
  "Baselines, revisions, risks, and trade alerts",
] as const;

export const MSPDI_EXPORT_LIMITATIONS = [
  "Project/resource calendars, assignments, rates, costs, and earned value",
  "Leveling segment history and Alleato manual/auto schedule mode",
  "Baselines, revisions, risks, and trade alerts",
] as const;

function flatExportValue(task: ScheduleTask, key: keyof ScheduleTask): string {
  const value = task[key];
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function csvCell(value: string): string {
  const safeValue = /^\s*[=+\-@]/.test(value) ? `'${value}` : value;
  if (!/[",\r\n]/.test(safeValue)) return safeValue;
  return `"${safeValue.replaceAll("\"", "\"\"")}"`;
}

export function exportFlatScheduleToCsv(tasks: ScheduleTask[]): string {
  const headers = FLAT_SCHEDULE_EXPORT_COLUMNS.map((column) => csvCell(column.label));
  const rows = tasks.map((task) =>
    FLAT_SCHEDULE_EXPORT_COLUMNS.map((column) =>
      csvCell(flatExportValue(task, column.key)),
    ).join(","),
  );
  return [headers.join(","), ...rows].join("\n");
}

export function exportFlatScheduleToJson(tasks: ScheduleTask[]): string {
  return JSON.stringify(
    tasks.map((task) =>
      Object.fromEntries(
        FLAT_SCHEDULE_EXPORT_COLUMNS.map((column) => [
          column.key,
          task[column.key] ?? null,
        ]),
      ),
    ),
    null,
    2,
  );
}

export function ImportExportModal({
  open,
  onOpenChange,
  projectId,
  tasks,
}: ImportExportModalProps) {
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFormatChange = useCallback((format: ExportFormat) => {
    setExportFormat(format);
    setMessage(null);
    setWarnings([]);
    setError(null);
  }, []);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      setMessage(null);
      setWarnings([]);
      setError(null);
    }
    onOpenChange(nextOpen);
  }, [onOpenChange]);

  const handleExport = useCallback(() => {
    setIsProcessing(true);
    setMessage(null);
    setWarnings([]);
    setError(null);

    try {
      let content: string;
      let filename: string;
      let mimeType: string;
      let exportWarnings: string[] = [];
      if (exportFormat === "mspdi") {
        const result = exportScheduleToMspdiXml({ projectId, tasks });
        content = result.xml;
        exportWarnings = result.warnings;
        filename = `schedule-microsoft-project-${projectId}.xml`;
        mimeType = "application/xml";
      } else {
        content =
          exportFormat === "csv"
            ? exportFlatScheduleToCsv(tasks)
            : exportFlatScheduleToJson(tasks);
        filename = `schedule-flat-task-snapshot-${projectId}.${exportFormat}`;
        mimeType = exportFormat === "csv" ? "text/csv" : "application/json";
      }
      const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
      const link = document.createElement("a");
      try {
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
      } finally {
        link.remove();
        URL.revokeObjectURL(url);
      }
      setMessage(`Exported ${tasks.length} tasks to ${filename}`);
      setWarnings(exportWarnings);
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "Unable to export this schedule snapshot.",
      );
    } finally {
      setIsProcessing(false);
    }
  }, [exportFormat, projectId, tasks]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Export Schedule Snapshot</DialogTitle>
          <DialogDescription>
            Download a flat analysis snapshot or relationship-aware Microsoft
            Project XML. Schedule imports use the separate atomic import workflow.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label id="schedule-export-format-label">Export Format</Label>
            <div
              className="grid grid-cols-1 gap-2 sm:grid-cols-3"
              role="group"
              aria-labelledby="schedule-export-format-label"
            >
              <Button
                type="button"
                variant={exportFormat === "csv" ? "default" : "outline"}
                className="flex-1"
                onClick={() => handleFormatChange("csv")}
                aria-pressed={exportFormat === "csv"}
              >
                <FileSpreadsheet />
                CSV
              </Button>
              <Button
                type="button"
                variant={exportFormat === "json" ? "default" : "outline"}
                className="flex-1"
                onClick={() => handleFormatChange("json")}
                aria-pressed={exportFormat === "json"}
              >
                <FileJson />
                JSON
              </Button>
              <Button
                type="button"
                variant={exportFormat === "mspdi" ? "default" : "outline"}
                className="flex-1"
                onClick={() => handleFormatChange("mspdi")}
                aria-pressed={exportFormat === "mspdi"}
              >
                <FileCode2 />
                MS Project XML
              </Button>
            </div>
          </div>

          {exportFormat === "mspdi" ? (
            <InfoAlert variant="info">
              <div className="font-medium">Relationship-aware Project interchange</div>
              <p className="mt-2">
                Preserves task hierarchy, dates, duration, progress, actuals,
                constraints, deadlines, work, milestones, dependencies, and lag.
                It does not include:
              </p>
              <ul className="mt-2 list-inside list-disc">
                {MSPDI_EXPORT_LIMITATIONS.map((limitation) => (
                  <li key={limitation}>{limitation}</li>
                ))}
              </ul>
            </InfoAlert>
          ) : (
            <>
              <InfoAlert variant="warning">
                <div className="font-medium">Flat, intentionally lossy snapshot</div>
                <p className="mt-2 text-muted-foreground">
                  This export includes the visible task fields below. It is not a
                  round-trip backup and omits:
                </p>
                <ul className="mt-2 list-inside list-disc text-muted-foreground">
                  {FLAT_SCHEDULE_EXPORT_LIMITATIONS.map((limitation) => (
                    <li key={limitation}>{limitation}</li>
                  ))}
                </ul>
              </InfoAlert>

              <div className="text-sm text-muted-foreground">
                <p>{tasks.length} tasks with these fields:</p>
                <ul className="mt-2 list-inside list-disc">
                  {FLAT_SCHEDULE_EXPORT_COLUMNS.map((column) => (
                    <li key={column.key}>{column.label}</li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {message && (
            <InfoAlert
              variant="success"
              role={warnings.length > 0 ? "note" : "status"}
            >
              {message}
            </InfoAlert>
          )}

          {warnings.length > 0 && (
            <InfoAlert variant="warning" role="status">
              <div className="font-medium">
                Export completed with {warnings.length} warning
                {warnings.length === 1 ? "" : "s"}
              </div>
              <ul className="mt-2 list-inside list-disc">
                {warnings.map((warning, index) => (
                  <li key={`${index}-${warning}`}>{warning}</li>
                ))}
              </ul>
            </InfoAlert>
          )}

          {error && (
            <InfoAlert variant="error" role="alert">
              {error}
            </InfoAlert>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleExport}
            disabled={isProcessing || tasks.length === 0}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download />
                Export {tasks.length} Tasks
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
