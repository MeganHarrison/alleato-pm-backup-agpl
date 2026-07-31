"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ds";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScanResult {
  scanned: number;
  alertsGenerated: number;
  errors: string[];
}

export interface ScanButtonProps {
  onScan: () => void;
  isScanning: boolean;
  lastScanResult?: ScanResult | null;
}

// ---------------------------------------------------------------------------
// ScanButton Component
//
// Usage:
//   <ScanButton
//     onScan={handleScan}
//     isScanning={isMutationPending}
//     lastScanResult={scanResult}
//   />
// ---------------------------------------------------------------------------

export function ScanButton({
  onScan,
  isScanning,
  lastScanResult,
}: ScanButtonProps) {
  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant="default"
        onClick={onScan}
        disabled={isScanning}
        className="gap-2"
      >
        {isScanning ? (
          <>
            {/* Animated dots loading indicator — no spinner icons per design system */}
            <span className="flex items-center gap-1">
              <span
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-current"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-current"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-current"
                style={{ animationDelay: "300ms" }}
              />
            </span>
            Scanning...
          </>
        ) : (
          <>
            <RefreshCw />
            Run Portfolio Scan
          </>
        )}
      </Button>

      {lastScanResult && !isScanning && (
        <div className="flex flex-col gap-0.5">
          <p className="text-xs text-muted-foreground">
            Scanned{" "}
            <span className="font-medium text-foreground">
              {lastScanResult.scanned}
            </span>{" "}
            {lastScanResult.scanned === 1 ? "project" : "projects"}.{" "}
            <span className="font-medium text-foreground">
              {lastScanResult.alertsGenerated}
            </span>{" "}
            {lastScanResult.alertsGenerated === 1 ? "alert" : "alerts"}{" "}
            generated.
          </p>
          {lastScanResult.errors.length > 0 && (
            <p
              className={cn(
                "text-xs",
                "text-destructive"
              )}
            >
              {lastScanResult.errors.length}{" "}
              {lastScanResult.errors.length === 1 ? "error" : "errors"} during
              scan.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
