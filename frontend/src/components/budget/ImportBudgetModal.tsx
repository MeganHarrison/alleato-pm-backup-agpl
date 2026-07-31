"use client";

import * as React from "react";
import {
  Upload,
  X,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import {
  BaseModal,
  ModalBody,
  ModalFooter,
} from "@/components/budget/modals/BaseModal";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ImportResult {
  success: boolean;
  importedCount: number;
  totalRows: number;
  error?: string;
  errors?: string[];
  warnings?: string[];
  skippedRows?: number;
  message: string;
}

interface ImportBudgetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSuccess?: () => void;
}

export function ImportBudgetModal({
  open,
  onOpenChange,
  projectId,
  onSuccess,
}: ImportBudgetModalProps) {
  const [file, setFile] = React.useState<File | null>(null);
  const [isImporting, setIsImporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [importResult, setImportResult] = React.useState<ImportResult | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) {
      setFile(null);
      setError(null);
      setIsImporting(false);
      setIsDragging(false);
      setImportResult(null);
    }
  }, [open]);

  const handleDownloadTemplate = async () => {
    const templateUrl = "/alleato-budget-template.xlsx";
    try {
      // Fetch the asset first so we can confirm it actually resolved to the
      // spreadsheet. A bare `<a download>` silently downloads nothing when the
      // request is redirected (e.g. to /auth/login) or 404s — this surfaces
      // that as a real error instead of a false "success" toast.
      const response = await fetch(templateUrl);
      const contentType = response.headers.get("content-type") ?? "";
      if (!response.ok || contentType.includes("text/html")) {
        throw new Error(`Template unavailable (status ${response.status})`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `budget-template-project-${projectId}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // Defer revoke so the browser has read the blob before it's released.
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      toast.success("Template downloaded");
    } catch {
      toast.error("Couldn't download the template. Please try again.");
    }
  };

  const validateFile = (selectedFile: File): string | null => {
    const validExcelTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    const validCsvTypes = ["text/csv", "application/csv"];
    const isExcel =
      validExcelTypes.includes(selectedFile.type) ||
      selectedFile.name.endsWith(".xlsx");
    const isCsv =
      validCsvTypes.includes(selectedFile.type) ||
      selectedFile.name.endsWith(".csv");
    if (!isExcel && !isCsv) return "Please upload a valid Excel (.xlsx) or CSV (.csv) file";
    const maxSize = 10 * 1024 * 1024;
    if (selectedFile.size > maxSize) return "File size must be less than 10MB";
    return null;
  };

  const handleFileSelect = (selectedFile: File) => {
    const validationError = validateFile(selectedFile);
    if (validationError) {
      setError(validationError);
      setFile(null);
      return;
    }
    setFile(selectedFile);
    setError(null);
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) handleFileSelect(selectedFile);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    const droppedFile = event.dataTransfer.files?.[0];
    if (droppedFile) handleFileSelect(droppedFile);
  };

  const handleRemoveFile = () => {
    setFile(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImport = async () => {
    if (!file) return;
    setIsImporting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const result = await apiFetch<ImportResult>(`/api/projects/${projectId}/budget/import`, {
        method: "POST",
        body: formData,
      });
      setImportResult(result);

      let message = `Budget imported successfully! ${result.importedCount || 0} line item(s) added.`;
      if (result.warnings?.length || result.skippedRows) {
        const issues = [];
        if (result.warnings?.length) issues.push(`${result.warnings.length} warnings`);
        if (result.skippedRows) issues.push(`${result.skippedRows} skipped rows`);
        message += ` (${issues.join(", ")})`;
      }

      toast.success(message);
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to import budget";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsImporting(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <BaseModal
      isOpen={open}
      onClose={() => { if (!isImporting) onOpenChange(false); }}
      title="Import Budget"
      size="md"
    >
      <ModalBody>
        <div className="space-y-5">
          {/* Notes */}
          <div className="rounded-lg bg-warning/10 p-4 text-warning flex items-start gap-3">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="text-sm space-y-1">
              <p className="font-medium text-foreground">Before you import</p>
              <ul className="text-muted-foreground space-y-0.5 list-disc list-inside">
                <li>Budget uses project currency — no conversion is applied</li>
                <li>Take a snapshot first to preserve current state</li>
              </ul>
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              How to import
            </p>
            <ol className="text-sm text-foreground space-y-1 list-decimal list-inside ml-0.5">
              <li>Download the Excel template below</li>
              <li>Fill in your budget line items</li>
              <li>Upload the completed file</li>
            </ol>
          </div>

          {/* Template download */}
          <div className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-8 w-8 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Budget Import Template</p>
                <p className="text-xs text-muted-foreground">Excel format (.xlsx)</p>
              </div>
            </div>
            <Button onClick={handleDownloadTemplate} variant="outline" size="sm">
              <Upload className="h-3.5 w-3.5" />
              Download
            </Button>
          </div>

          {/* File upload */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">
              Excel or CSV file <span className="text-destructive">*</span>
            </p>

            {!file ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors",
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40 hover:bg-muted/40",
                )}
              >
                <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Drop file here or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">
                  .xlsx or .csv, max 10 MB
                </p>
              </div>
            ) : (
              <div className="rounded-lg bg-muted/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                  <Button
                    onClick={handleRemoveFile}
                    variant="ghost"
                    size="icon"
                    disabled={isImporting}
                    className="h-7 w-7 shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              onChange={handleFileInputChange}
              className="hidden"
            />

            {error && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-destructive">{error}</p>
              </div>
            )}
          </div>

          {/* Import results */}
          {importResult && (importResult.warnings?.length || importResult.errors?.length) ? (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Import results
              </p>

              {importResult.warnings && importResult.warnings.length > 0 && (
                <div className="rounded-md bg-warning/10 p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-warning mt-0.5" />
                    <div className="flex-1 space-y-1.5">
                      <p className="text-sm font-medium text-warning">
                        {importResult.warnings.length} warning{importResult.warnings.length !== 1 ? "s" : ""}
                      </p>
                      <ul className="text-xs text-warning space-y-0.5 max-h-20 overflow-y-auto">
                        {importResult.warnings.slice(0, 5).map((w) => (
                          <li key={w}>{w}</li>
                        ))}
                        {importResult.warnings.length > 5 && (
                          <li className="italic">+{importResult.warnings.length - 5} more…</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {importResult.errors && importResult.errors.length > 0 && (
                <div className="rounded-md bg-destructive/10 p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <p className="text-sm font-medium text-destructive">
                        {importResult.errors.length} error{importResult.errors.length !== 1 ? "s" : ""}
                      </p>
                      <ul className="text-xs text-destructive space-y-0.5 max-h-20 overflow-y-auto">
                        {importResult.errors.slice(0, 5).map((e) => (
                          <li key={e}>{e}</li>
                        ))}
                        {importResult.errors.length > 5 && (
                          <li className="italic">+{importResult.errors.length - 5} more…</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </ModalBody>

      <ModalFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isImporting}
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleImport}
          disabled={!file || isImporting}
        >
          {isImporting ? (
            <>
              <div className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Importing…
            </>
          ) : (
            <>
              <Upload className="h-3.5 w-3.5" />
              Import
            </>
          )}
        </Button>
      </ModalFooter>
    </BaseModal>
  );
}
