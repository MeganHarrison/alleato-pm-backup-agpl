"use client";

import { FileDown, Loader2 } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { usePdfExport, type UsePdfExportOptions } from "@/hooks/use-pdf-export";
import { cn } from "@/lib/utils";

export interface ExportPdfButtonProps extends UsePdfExportOptions {
  label?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  /** Hide the leading icon (e.g. inside a compact toolbar). */
  hideIcon?: boolean;
}

/**
 * Drop-in "Export PDF" button. Standalone-button convenience wrapper around
 * {@link usePdfExport}; for dropdown menu items or other custom triggers, call
 * the hook directly and wire `exportPdf` to your own element.
 */
export function ExportPdfButton({
  label = "Export PDF",
  variant = "outline",
  size = "sm",
  className,
  hideIcon = false,
  ...options
}: ExportPdfButtonProps) {
  const { exportPdf, isExporting } = usePdfExport(options);

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={exportPdf}
      disabled={isExporting}
    >
      {!hideIcon &&
        (isExporting ? (
          <Loader2 className={cn("h-4 w-4 animate-spin", label && "mr-2")} />
        ) : (
          <FileDown className={cn("h-4 w-4", label && "mr-2")} />
        ))}
      {label}
    </Button>
  );
}
