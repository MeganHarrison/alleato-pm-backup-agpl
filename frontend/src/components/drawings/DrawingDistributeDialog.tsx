"use client";

import * as React from "react";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InfoAlert } from "@/components/ds/InfoAlert";

interface DrawingDistributeDialogProps {
  projectId: string;
  drawingId: string;
  drawingNumber: string;
  isOpen: boolean;
  onClose: () => void;
}

export function DrawingDistributeDialog({
  projectId: _projectId,
  drawingId: _drawingId,
  drawingNumber: _drawingNumber,
  isOpen,
  onClose,
}: DrawingDistributeDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Distribute Drawing</DialogTitle>
        </DialogHeader>

        <div className="mt-2">
          <InfoAlert>
            Drawing distribution is not yet available. This feature is coming
            soon — recipients will receive an email notification with a download
            link when it is ready.
          </InfoAlert>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            <Send className="mr-1.5 h-3.5 w-3.5" />
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
