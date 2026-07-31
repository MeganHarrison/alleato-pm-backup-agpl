"use client";

import { ArrowUpRight, Link2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DrawingMarkupPin } from "@/hooks/use-drawing-pins";
import { PIN_TYPE_CONFIG } from "./LinkPinModal";

function recordHref(projectId: string, pin: DrawingMarkupPin): string | null {
  if (!pin.entity_id) return null;
  switch (pin.pin_type) {
    case "rfi": return `/${projectId}/rfis/${pin.entity_id}`;
    case "punch_item": return `/${projectId}/punch-list/${pin.entity_id}`;
    case "drawing": return `/${projectId}/drawings/viewer/${pin.entity_id}`;
    case "photo": return `/${projectId}/photos?photoId=${pin.entity_id}`;
    case "document": return `/${projectId}/documents/${pin.entity_id}`;
    case "submittal": return `/${projectId}/submittals/${pin.entity_id}`;
    case "task": return `/${projectId}/tasks`;
    case "coordination_issue": return null;
  }
}

export function DrawingLinkedRecordPreviewDialog({
  pin,
  projectId,
  onOpenChange,
}: {
  pin: DrawingMarkupPin | null;
  projectId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const config = pin ? PIN_TYPE_CONFIG[pin.pin_type] : null;
  const href = pin ? recordHref(projectId, pin) : null;
  const label = pin?.entity_label ?? pin?.entity_number ?? config?.label ?? "Linked record";
  const description = pin?.entity_description ?? "No description is available for this linked record.";

  return (
    <Dialog open={pin !== null} onOpenChange={onOpenChange}>
      <DialogContent size="form" data-testid="drawing-linked-record-preview-dialog">
        <DialogHeader className="space-y-3 pr-8 text-left">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link2 className="h-4 w-4" aria-hidden="true" />
            <span>{config?.label ?? "Linked record"}{pin?.entity_number ? ` ${pin.entity_number}` : ""}</span>
            {pin?.entity_status && <span className="capitalize">{pin.entity_status.replace(/_/g, " ")}</span>}
          </div>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription className="whitespace-pre-wrap">{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          {href ? (
            <Button onClick={() => { onOpenChange(false); router.push(href); }}>
              View {config?.label.toLowerCase() ?? "record"}
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">This link has no destination record.</p>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { recordHref };
