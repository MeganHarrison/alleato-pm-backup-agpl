"use client";

import * as React from "react";
import { FileDown, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { apiFetchBlob } from "@/lib/api-client";

/**
 * ExportDialog props interface
 */
interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  selectedCostIds?: string[];
}

type ExportFormat = "csv" | "excel" | "pdf";
type ExportTemplate = "standard" | "accounting" | "summary";

/**
 * ExportDialog - Dialog for exporting Direct Costs data
 *
 * Provides customizable export options for direct costs data including format selection,
 * template selection, and column customization.
 *
 * @example
 * ```tsx
 * <ExportDialog
 *   open={isExportOpen}
 *   onOpenChange={setIsExportOpen}
 *   projectId={123}
 *   selectedCostIds={["uuid-1", "uuid-2"]}
 * />
 * ```
 */
export function ExportDialog({
  open,
  onOpenChange,
  projectId,
  selectedCostIds,
}: ExportDialogProps) {
  const [format, setFormat] = React.useState<ExportFormat>("csv");
  const [template, setTemplate] = React.useState<ExportTemplate>("standard");
  const [includeLineItems, setIncludeLineItems] = React.useState(true);
  const [isExporting, setIsExporting] = React.useState(false);

  // Reset state when dialog closes
  React.useEffect(() => {
    if (!open) {
      setFormat("csv");
      setTemplate("standard");
      setIncludeLineItems(true);
      setIsExporting(false);
    }
  }, [open]);

  const handleExport = async () => {
    setIsExporting(true);

    try {
      const exportParams = {
        format,
        template,
        include_line_items: includeLineItems,
        filters: {},
      };

      const blob = await apiFetchBlob(
        `/api/projects/${projectId}/direct-costs/export`,
        {
          method: "POST",
          body: JSON.stringify(exportParams),
        }
      );

      const ext = format === "excel" ? "xlsx" : format;
      const filename = `direct-costs-${new Date().toISOString().split("T")[0]}.${ext}`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);

      toast.success(`Direct costs exported as ${format.toUpperCase()}`);
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to export direct costs");
    } finally {
      setIsExporting(false);
    }
  };

  const exportScope = selectedCostIds?.length
    ? `${selectedCostIds.length} selected costs`
    : "All direct costs";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Export Direct Costs</DialogTitle>
          <DialogDescription>
            Choose your export format and options. {exportScope} will be
            exported.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Format Selection */}
          <div className="space-y-4">
            <Label htmlFor="export-format">Export Format</Label>
            <RadioGroup
              id="export-format"
              value={format}
              onValueChange={(value) => setFormat(value as ExportFormat)}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="csv" id="csv" />
                <Label htmlFor="csv" className="font-normal cursor-pointer">
                  CSV (Comma-separated values)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="excel" id="excel" />
                <Label htmlFor="excel" className="font-normal cursor-pointer">
                  Excel (Spreadsheet)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pdf" id="pdf" />
                <Label htmlFor="pdf" className="font-normal cursor-pointer">
                  PDF (Printable document)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Template Selection */}
          <div className="space-y-4">
            <Label htmlFor="export-template">Template</Label>
            <RadioGroup
              id="export-template"
              value={template}
              onValueChange={(value) => setTemplate(value as ExportTemplate)}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="standard" id="standard" />
                <Label
                  htmlFor="standard"
                  className="font-normal cursor-pointer"
                >
                  Standard - All fields
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="accounting" id="accounting" />
                <Label
                  htmlFor="accounting"
                  className="font-normal cursor-pointer"
                >
                  Accounting - Financial focus
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="summary" id="summary" />
                <Label htmlFor="summary" className="font-normal cursor-pointer">
                  Summary - High-level overview
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Include Line Items */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="include-line-items"
              checked={includeLineItems}
              onCheckedChange={(checked) =>
                setIncludeLineItems(checked === true)
              }
            />
            <Label
              htmlFor="include-line-items"
              className="font-normal cursor-pointer"
            >
              Include line items in export
            </Label>
          </div>

          {/* Export Scope Info */}
          <div className="rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
            <strong>Export scope:</strong> {exportScope}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <FileDown />
                Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
