"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Printer, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

interface DrawingQRCodeProps {
  projectId: string;
  drawingId: string;
  drawingNumber: string;
  isOpen: boolean;
  onClose: () => void;
}

export function DrawingQRCode({
  projectId,
  drawingId,
  drawingNumber,
  isOpen,
  onClose,
}: DrawingQRCodeProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [requestNonce, setRequestNonce] = useState(Date.now());
  const [qrImageUrl, setQrImageUrl] = useState("");

  const qrUrl = `/api/projects/${projectId}/drawings/${drawingId}/qr-code?cacheBust=${requestNonce}`;
  const loadQrCode = useCallback(async (url: string): Promise<string | null> => {
    setIsLoading(true);
    setHasError(false);
    try {
      const response = await fetch(url, {
        cache: "no-store",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`QR generation failed (${response.status})`);
      }

      const blob = await response.blob();
      if (!blob || blob.size === 0) {
        throw new Error("QR generation returned empty response");
      }

      const nextImageUrl = URL.createObjectURL(blob);
      setQrImageUrl((prevImageUrl) => {
        if (prevImageUrl) URL.revokeObjectURL(prevImageUrl);
        return nextImageUrl;
      });
      setHasError(false);
      return nextImageUrl;
    } catch (error) {
      console.error("Failed to generate QR code image", error);
      setHasError(true);
      setQrImageUrl((prevImageUrl) => {
        if (prevImageUrl) URL.revokeObjectURL(prevImageUrl);
        return "";
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      const nextNonce = Date.now();
      setRequestNonce(nextNonce);
      loadQrCode(`/api/projects/${projectId}/drawings/${drawingId}/qr-code?cacheBust=${nextNonce}`);
    }
    return () => {
      setQrImageUrl((prevImageUrl) => {
        if (prevImageUrl) URL.revokeObjectURL(prevImageUrl);
        return "";
      });
      setIsLoading(false);
      setHasError(false);
    };
  }, [isOpen, projectId, drawingId, loadQrCode]);

  const handleDownload = async () => {
    const imageSourceUrl = qrImageUrl || (await loadQrCode(qrUrl));
    if (!imageSourceUrl) {
      setHasError(true);
      return;
    }

    const a = document.createElement("a");
    a.href = imageSourceUrl;
    a.download = `${drawingNumber}-qr.png`;
    a.click();
  };

  const handlePrint = () => {
    if (!qrImageUrl || hasError) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head><title>QR Code — ${drawingNumber}</title></head>
        <body style="display:flex;flex-direction:column;align-items:center;padding:40px;font-family:sans-serif;">
          <h2>${drawingNumber}</h2>
          <img src="${qrImageUrl}" style="width:300px;height:300px;" />
          <p style="margin-top:12px;font-size:14px;color:#666;">Scan to view drawing</p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[340px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-4 w-4" />
            QR Code — {drawingNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          <div className="relative w-64 h-64 rounded-lg bg-muted flex items-center justify-center">
            {isLoading && !hasError && (
              <Skeleton className="absolute inset-0 rounded-lg" />
            )}
            {hasError ? (
              <div className="text-center text-muted-foreground text-sm p-4">
                <QrCode className="h-8 w-8 mx-auto mb-2 opacity-40" />
                Failed to generate QR code
              </div>
            ) : (
              <img
                src={qrImageUrl}
                alt={`QR code for drawing ${drawingNumber}`}
                className="w-64 h-64 rounded-lg"
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false);
                  setHasError(true);
                }}
              />
            )}
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Scan to open the drawing viewer
          </p>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDownload} disabled={hasError}>
              <Download className="h-4 w-4 mr-1.5" />
              Download PNG
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={hasError}>
              <Printer className="h-4 w-4 mr-1.5" />
              Print
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
