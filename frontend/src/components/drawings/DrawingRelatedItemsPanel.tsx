"use client";

import { useState } from "react";
import { Link2, Unlink, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ds";
import {
  useDrawingRelatedItems,
  useAddRelatedItem,
  useRemoveRelatedItem,
} from "@/hooks/use-drawings";

// UUID v4 validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface DrawingRelatedItemsPanelProps {
  projectId: string;
  drawingId: string;
}

const RELATED_TYPE_LABELS: Record<string, string> = {
  rfi: "RFI",
  submittal: "Submittal",
  change_order: "Change Order",
  observation: "Observation",
  punch_item: "Punch Item",
  task: "Task",
};

const RELATED_TYPE_ROUTES: Record<string, string> = {
  rfi: "rfis",
  submittal: "submittals",
  change_order: "change-orders",
};

export function DrawingRelatedItemsPanel({
  projectId,
  drawingId,
}: DrawingRelatedItemsPanelProps) {
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkType, setLinkType] = useState("rfi");
  const [linkId, setLinkId] = useState("");
  const [linkIdError, setLinkIdError] = useState<string | null>(null);
  const [removeItemId, setRemoveItemId] = useState<string | null>(null);

  const { data: items, isLoading } = useDrawingRelatedItems(projectId, drawingId);
  const addItem = useAddRelatedItem(projectId, drawingId);
  const removeItem = useRemoveRelatedItem(projectId, drawingId);

  const validateAndAdd = async () => {
    const trimmed = linkId.trim();
    if (!trimmed) {
      setLinkIdError("Item ID is required.");
      return;
    }
    if (!UUID_REGEX.test(trimmed)) {
      setLinkIdError("Must be a valid UUID (e.g. 550e8400-e29b-41d4-a716-446655440000).");
      return;
    }
    setLinkIdError(null);
    try {
      await addItem.mutateAsync({ related_id: trimmed, related_type: linkType });
      setLinkId("");
      setShowLinkDialog(false);
    } catch {
      // error is surfaced via useAddRelatedItem onError toast — no additional action needed
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    setShowLinkDialog(open);
    if (!open) {
      setLinkId("");
      setLinkIdError(null);
    }
  };

  const handleRemove = async () => {
    if (!removeItemId) return;
    await removeItem.mutateAsync(removeItemId);
    setRemoveItemId(null);
  };

  // Group items by type
  const grouped = (items ?? []).reduce<Record<string, typeof items>>(
    (acc, item) => {
      const key = item!.related_type;
      if (!acc[key]) acc[key] = [];
      acc[key]!.push(item!);
      return acc;
    },
    {}
  );

  if (isLoading) {
    return (
      <div className="py-8 text-center text-muted-foreground text-sm">
        Loading related items...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowLinkDialog(true)}>
          <Link2 className="h-4 w-4 mr-1.5" />
          Link Item
        </Button>
      </div>

      {!items || items.length === 0 ? (
        <EmptyState
          icon={<Link2 className="h-6 w-6 text-muted-foreground" />}
          title="No related items"
          description="Link RFIs, submittals, change orders, and other items to this drawing."
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([type, typeItems]) => (
            <div key={type}>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="text-xs">
                  {RELATED_TYPE_LABELS[type] ?? type}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {typeItems!.length} item{typeItems!.length !== 1 ? "s" : ""}
                </span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Linked</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {typeItems!.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-sm">
                        {item.related_id}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {RELATED_TYPE_LABELS[item.related_type] ?? item.related_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(item.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {RELATED_TYPE_ROUTES[item.related_type] && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              asChild
                            >
                              <a
                                href={`/${projectId}/${RELATED_TYPE_ROUTES[item.related_type]}/${item.related_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ArrowRight className="h-3.5 w-3.5" />
                              </a>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => setRemoveItemId(item.id)}
                          >
                            <Unlink className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </div>
      )}

      {/* Link Item Dialog */}
      <Dialog open={showLinkDialog} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Link Related Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Item Type</label>
              <Select value={linkType} onValueChange={(v) => { setLinkType(v); setLinkIdError(null); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RELATED_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Item ID (UUID)</label>
              <Input
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={linkId}
                onChange={(e) => {
                  setLinkId(e.target.value);
                  setLinkIdError(null);
                }}
                aria-invalid={!!linkIdError}
                className={linkIdError ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {linkIdError ? (
                <p className="text-xs text-destructive">{linkIdError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Paste the UUID of the {RELATED_TYPE_LABELS[linkType] ?? linkType} to link. The server will verify the item exists.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleDialogOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void validateAndAdd()}
              disabled={!linkId.trim() || addItem.isPending}
            >
              {addItem.isPending ? "Linking..." : "Link Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Remove Dialog */}
      <AlertDialog open={!!removeItemId} onOpenChange={() => setRemoveItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Link</AlertDialogTitle>
            <AlertDialogDescription>
              Remove this related item link from the drawing? The item itself will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              className="bg-destructive hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
