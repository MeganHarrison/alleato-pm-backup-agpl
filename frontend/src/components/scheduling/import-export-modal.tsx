"use client";

/**
 * =============================================================================
 * IMPORT/EXPORT MODAL COMPONENT
 * =============================================================================
 *
 * Modal for importing and exporting schedule data.
 * Supports:
 * - Export to CSV
 * - Export to JSON
 * - Import from CSV
 * - Column mapping for imports
 */

import * as React from "react";
import { useState, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Download,
  Upload,
  FileSpreadsheet,
  FileJson,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScheduleTask } from "@/types/scheduling";
import { toast } from "sonner";

// =============================================================================
// TYPES
// =============================================================================

type ExportFormat = "csv" | "json";

interface ImportExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  tasks: ScheduleTask[];
  onImport: (tasks: Partial<ScheduleTask>[]) => Promise<void>;
}

interface ColumnMapping {
  [csvColumn: string]: keyof ScheduleTask | "skip";
}

const EXPORT_COLUMNS: Array<{ key: keyof ScheduleTask; label: string }> = [
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

const IMPORTABLE_COLUMNS: Array<{
  key: keyof ScheduleTask | "skip";
  label: string;
}> = [
  { key: "skip", label: "(Skip this column)" },
  { key: "name", label: "Task Name" },
  { key: "wbs_code", label: "WBS Code" },
  { key: "start_date", label: "Start Date" },
  { key: "finish_date", label: "Finish Date" },
  { key: "duration_days", label: "Duration (Days)" },
  { key: "percent_complete", label: "% Complete" },
  { key: "status", label: "Status" },
  { key: "is_milestone", label: "Is Milestone" },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function flattenTasks(tasks: ScheduleTask[]): ScheduleTask[] {
  const result: ScheduleTask[] = [];

  const flatten = (taskList: ScheduleTask[], level: number = 0) => {
    for (const task of taskList) {
      result.push(task);
      // Note: In a hierarchical view, we'd need to handle children here
      // For now, we assume tasks are already flattened from the API
    }
  };

  flatten(tasks);
  return result;
}

function exportToCSV(tasks: ScheduleTask[]): string {
  const headers = EXPORT_COLUMNS.map((col) => col.label);
  const rows = tasks.map((task) =>
    EXPORT_COLUMNS.map((col) => {
      const value = task[col.key];
      if (value === null || value === undefined) return "";
      if (typeof value === "boolean") return value ? "Yes" : "No";
      if (typeof value === "string" && value.includes(",")) {
        return `"${value}"`;
      }
      return String(value);
    })
  );

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
}

function exportToJSON(tasks: ScheduleTask[]): string {
  const exportData = tasks.map((task) => {
    const data: Record<string, unknown> = {};
    EXPORT_COLUMNS.forEach((col) => {
      data[col.key] = task[col.key];
    });
    return data;
  });

  return JSON.stringify(exportData, null, 2);
}

function parseCSV(content: string): { headers: string[]; rows: string[][] } {
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = lines[0]
    .split(",")
    .map((h) => h.trim().replace(/^"|"$/g, "").replace(/^\uFEFF/, ""));
  const rows = lines.slice(1).map((line) => {
    // Simple CSV parsing (doesn't handle all edge cases)
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    return values;
  });

  return { headers, rows };
}

function normalizeImportedStatus(value: string): ScheduleTask["status"] {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");

  if (normalized === "in_progress") return "in_progress";
  if (normalized === "complete" || normalized === "completed" || normalized === "done") {
    return "complete";
  }

  return "not_started";
}

function autoMapColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};

  const headerToKey: Record<string, keyof ScheduleTask> = {
    "task name": "name",
    name: "name",
    title: "name",
    "wbs code": "wbs_code",
    wbs: "wbs_code",
    "start date": "start_date",
    start: "start_date",
    "finish date": "finish_date",
    finish: "finish_date",
    end: "finish_date",
    "end date": "finish_date",
    duration: "duration_days",
    "duration (days)": "duration_days",
    "duration days": "duration_days",
    "% complete": "percent_complete",
    "percent complete": "percent_complete",
    progress: "percent_complete",
    status: "status",
    "is milestone": "is_milestone",
    milestone: "is_milestone",
  };

  headers.forEach((header) => {
    const normalizedHeader = header.toLowerCase().trim();
    mapping[header] = headerToKey[normalizedHeader] || "skip";
  });

  return mapping;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ImportExportModal({
  open,
  onOpenChange,
  projectId,
  tasks,
  onImport,
}: ImportExportModalProps) {
  const [activeTab, setActiveTab] = useState<"export" | "import">("export");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<{
    headers: string[];
    rows: string[][];
  } | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal closes
  React.useEffect(() => {
    if (!open) {
      setError(null);
      setSuccess(null);
      setImportFile(null);
      setParsedData(null);
      setColumnMapping({});
    }
  }, [open]);

  // Handle export
  const handleExport = useCallback(() => {
    setIsProcessing(true);
    setError(null);

    try {
      const flatTasks = flattenTasks(tasks);
      let content: string;
      let filename: string;
      let mimeType: string;

      if (exportFormat === "csv") {
        content = exportToCSV(flatTasks);
        filename = `schedule-export-${projectId}.csv`;
        mimeType = "text/csv";
      } else {
        content = exportToJSON(flatTasks);
        filename = `schedule-export-${projectId}.json`;
        mimeType = "application/json";
      }

      // Create and download file
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setSuccess(`Exported ${flatTasks.length} tasks to ${filename}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export");
    } finally {
      setIsProcessing(false);
    }
  }, [tasks, projectId, exportFormat]);

  const handleDownloadTemplate = useCallback(() => {
    try {
      const link = document.createElement("a");
      link.href = "/alleato-schedule-template.csv";
      link.download = `schedule-template-project-${projectId}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Schedule template downloaded");
    } catch {
      toast.error("Failed to download schedule template");
    }
  }, [projectId]);

  // Handle file selection
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setImportFile(file);
      setError(null);
      setSuccess(null);

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const parsed = parseCSV(content);

          if (parsed.headers.length === 0) {
            setError("File appears to be empty or invalid");
            return;
          }

          setParsedData(parsed);
          setColumnMapping(autoMapColumns(parsed.headers));
        } catch (err) {
          setError("Failed to parse file");
        }
      };
      reader.readAsText(file);
    },
    []
  );

  // Handle column mapping change
  const handleMappingChange = useCallback(
    (csvColumn: string, targetKey: keyof ScheduleTask | "skip") => {
      setColumnMapping((prev) => ({
        ...prev,
        [csvColumn]: targetKey,
      }));
    },
    []
  );

  // Handle import
  const handleImport = useCallback(async () => {
    if (!parsedData) return;

    // Validate that name column is mapped
    const hasNameMapping = Object.values(columnMapping).includes("name");
    if (!hasNameMapping) {
      setError("Task Name column is required for import");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Transform rows to task objects
      const importTasks: Partial<ScheduleTask>[] = parsedData.rows.map((row) => {
        const task: Partial<ScheduleTask> = {};

        parsedData.headers.forEach((header, index) => {
          const targetKey = columnMapping[header];
          if (targetKey === "skip" || !targetKey) return;

          const value = row[index]?.trim();
          if (!value) return;

          switch (targetKey) {
            case "name":
            case "wbs_code":
            case "constraint_type":
              (task as Record<string, unknown>)[targetKey] = value;
              break;
            case "status":
              (task as Record<string, unknown>)[targetKey] =
                normalizeImportedStatus(value);
              break;
            case "start_date":
            case "finish_date":
            case "constraint_date":
              // Try to parse date
              const date = new Date(value);
              if (!isNaN(date.getTime())) {
                (task as Record<string, unknown>)[targetKey] = date
                  .toISOString()
                  .split("T")[0];
              }
              break;
            case "duration_days":
            case "percent_complete":
              const num = parseInt(value, 10);
              if (!isNaN(num)) {
                (task as Record<string, unknown>)[targetKey] = num;
              }
              break;
            case "is_milestone":
              (task as Record<string, unknown>)[targetKey] =
                value.toLowerCase() === "yes" ||
                value.toLowerCase() === "true" ||
                value === "1";
              break;
          }
        });

        return task;
      });

      // Filter out empty tasks
      const validTasks = importTasks.filter((t) => t.name);

      if (validTasks.length === 0) {
        setError("No valid tasks found in file");
        return;
      }

      await onImport(validTasks);
      setSuccess(`Successfully imported ${validTasks.length} tasks`);

      // Reset import state
      setImportFile(null);
      setParsedData(null);
      setColumnMapping({});
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import tasks");
    } finally {
      setIsProcessing(false);
    }
  }, [parsedData, columnMapping, onImport]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Import / Export Schedule</DialogTitle>
          <DialogDescription>
            Export your schedule to CSV or JSON, or import tasks from a CSV
            file.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "export" | "import")}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export">
              <Download className="h-4 w-4 mr-2" />
              Export
            </TabsTrigger>
            <TabsTrigger value="import">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </TabsTrigger>
          </TabsList>

          {/* Export Tab */}
          <TabsContent value="export" className="space-y-4">
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Export Format</Label>
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant={exportFormat === "csv" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setExportFormat("csv")}
                  >
                    <FileSpreadsheet />
                    CSV
                  </Button>
                  <Button
                    type="button"
                    variant={exportFormat === "json" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setExportFormat("json")}
                  >
                    <FileJson />
                    JSON
                  </Button>
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                <p>
                  Export will include {tasks.length} tasks with the following
                  columns:
                </p>
                <ul className="list-disc list-inside mt-2 ml-2">
                  {EXPORT_COLUMNS.map((col) => (
                    <li key={col.key}>{col.label}</li>
                  ))}
                </ul>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
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
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
          </TabsContent>

          {/* Import Tab */}
          <TabsContent value="import" className="space-y-4">
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg border">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Need a template?</p>
                  <p className="text-xs text-muted-foreground">
                    Download the schedule CSV template and upload it after filling in tasks.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadTemplate}
                  className="shrink-0"
                >
                  <Download />
                  Download Template
                </Button>
              </div>

              {/* File Selection */}
              <div className="space-y-2">
                <Label>Select CSV File</Label>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                />
              </div>

              {/* Column Mapping */}
              {parsedData && (
                <div className="space-y-4">
                  <Label>Map Columns</Label>
                  <p className="text-sm text-muted-foreground">
                    Found {parsedData.rows.length} rows. Map CSV columns to task
                    fields:
                  </p>

                  <div className="max-h-[200px] overflow-y-auto space-y-2 border rounded-md p-4">
                    {parsedData.headers.map((header) => (
                      <div
                        key={header}
                        className="flex items-center gap-4 text-sm"
                      >
                        <span className="w-32 truncate font-mono bg-muted px-2 py-1 rounded">
                          {header}
                        </span>
                        <span className="text-muted-foreground">→</span>
                        <Select
                          value={columnMapping[header] || "skip"}
                          onValueChange={(v) =>
                            handleMappingChange(
                              header,
                              v as keyof ScheduleTask | "skip"
                            )
                          }
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {IMPORTABLE_COLUMNS.map((col) => (
                              <SelectItem key={col.key} value={col.key}>
                                {col.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Messages */}
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-4 rounded-md">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-950/20 p-4 rounded-md">
                <CheckCircle2 className="h-4 w-4" />
                {success}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleImport}
                disabled={isProcessing || !parsedData}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload />
                    Import Tasks
                  </>
                )}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
