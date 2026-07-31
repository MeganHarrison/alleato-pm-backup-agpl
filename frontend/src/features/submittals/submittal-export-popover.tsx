"use client";

import * as React from "react";
import { ChevronDown, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { downloadPdf } from "@/hooks/use-pdf-export";
import { appToast as toast } from "@/lib/toast/app-toast";
import {
  buildSubmittalExportFilename,
  COVER_SHEET_EXPORT_ITEM,
} from "@/lib/submittals/export-packet";
import type { SubmittalAttachment } from "@/hooks/use-submittals";

interface SubmittalExportPopoverProps {
  projectId: number;
  submittalId: string;
  submittalNumber: string | number | null;
  submittalTitle: string | null;
  attachments: SubmittalAttachment[];
}

export function SubmittalExportPopover({
  projectId,
  submittalId,
  submittalNumber,
  submittalTitle,
  attachments,
}: SubmittalExportPopoverProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedItems, setSelectedItems] = React.useState<string[]>([
    COVER_SHEET_EXPORT_ITEM,
  ]);
  const [isExporting, setIsExporting] = React.useState(false);

  const exportItems = React.useMemo(
    () => [
      {
        id: COVER_SHEET_EXPORT_ITEM,
        label: "Cover Sheet",
      },
      ...attachments.map((attachment) => ({
        id: attachment.id,
        label: attachment.file_name,
      })),
    ],
    [attachments],
  );

  const allSelected =
    exportItems.length > 0 && selectedItems.length === exportItems.length;

  function toggleItem(itemId: string, checked: boolean) {
    setSelectedItems((current) => {
      if (checked) {
        return current.includes(itemId) ? current : [...current, itemId];
      }
      return current.filter((value) => value !== itemId);
    });
  }

  async function handleExport() {
    if (selectedItems.length === 0) {
      toast.error("Select at least one export item.");
      return;
    }

    const params = new URLSearchParams();
    for (const item of selectedItems) {
      params.append("item", item);
    }

    setIsExporting(true);
    try {
      await downloadPdf({
        endpoint: `/api/projects/${projectId}/submittals/${submittalId}/pdf?${params.toString()}`,
        filename: buildSubmittalExportFilename({
          submittalNumber,
          title: submittalTitle,
        }),
        loadingMessage: "Preparing submittal export…",
        successMessage: "Submittal export downloaded",
        errorMessage: "Failed to export submittal",
      });
      setOpen(false);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Export">
          <Download className="h-4 w-4" />
          Export
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="space-y-4 p-4">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={allSelected}
              onCheckedChange={(checked) => {
                setSelectedItems(
                  checked ? exportItems.map((item) => item.id) : [],
                );
              }}
              aria-label="Select all export items"
            />
            <Label className="text-base font-semibold text-foreground">
              Select All
            </Label>
          </div>

          <div className="space-y-3">
            {exportItems.map((item) => {
              const checked = selectedItems.includes(item.id);
              return (
                <div key={item.id} className="flex items-start gap-3">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) => toggleItem(item.id, Boolean(value))}
                    aria-label={`Include ${item.label}`}
                  />
                  <Label className="cursor-pointer text-base font-normal leading-8 text-foreground">
                    {item.label}
                  </Label>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-end border-t border-border px-4 py-3">
          <Button
            size="sm"
            onClick={() => void handleExport()}
            disabled={selectedItems.length === 0 || isExporting}
          >
            {isExporting ? "Preparing…" : "PDF"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
