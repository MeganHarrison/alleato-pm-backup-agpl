"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ArrowRight, ImageIcon, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DrawingMarkupPin } from "@/hooks/use-drawing-pins";
import { useDeleteDrawingPin } from "@/hooks/use-drawing-pins";
import { usePhoto } from "@/hooks/use-photos";
import { ConfirmDeleteDialog } from "@/components/ds/ConfirmDeleteDialog";
import { DrawingPhotoPreview } from "./DrawingPhotoPreview";
import { PIN_TYPE_CONFIG } from "./LinkPinModal";
import { PunchItemPreviewDialog } from "@/components/domain/punch-items/punch-item-preview-dialog";

// ── Status color map ─────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted-foreground",
  open: "bg-primary",
  in_review: "bg-warning",
  closed: "bg-success",
  void: "bg-muted-foreground",
  // coordination issue statuses
  released: "bg-primary",
  elevated: "bg-destructive",
};

function StatusDot({ status }: { status: string | null }) {
  if (!status) return null;
  const cls = STATUS_COLORS[status.toLowerCase()] ?? "bg-muted-foreground";
  return <span className={cn("h-2 w-2 rounded-full shrink-0 inline-block", cls)} />;
}

// ── Props ────────────────────────────────────────────────────────────────────

interface DrawingLinksPanelProps {
  pins: DrawingMarkupPin[];
  projectId: string;
  drawingId: string;
  currentPage: number;
  onPinHover?: (pinId: string | null) => void;
  onStartLinkPlacement?: () => void;
}

function DrawingPhotoSidebarActions({
  projectId,
  photoId,
  label,
  onViewAllPhotos,
}: {
  projectId: string;
  photoId: string;
  label: string;
  onViewAllPhotos: () => void;
}) {
  const photo = usePhoto(Number(projectId), Number(photoId));
  const photoTitle = photo.data?.title || label;

  return (
    <>
      <DrawingPhotoPreview
        projectId={projectId}
        photoId={photoId}
        label={label}
        trigger={(
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 overflow-hidden p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
            title={`Preview ${photoTitle}`}
            aria-label={`Preview ${photoTitle}`}
          >
            {photo.data?.file_url ? (
              <img
                src={photo.data.file_url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <ImageIcon className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
        )}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
        onClick={onViewAllPhotos}
        title="View all photos"
        aria-label="View all photos"
      >
        <ArrowRight />
      </Button>
    </>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export function DrawingLinksPanel({
  pins,
  projectId,
  drawingId,
  currentPage,
  onPinHover,
  onStartLinkPlacement,
}: DrawingLinksPanelProps) {
  const router = useRouter();
  const deletePin = useDeleteDrawingPin(projectId, drawingId);
  const [pendingDeletePin, setPendingDeletePin] = React.useState<DrawingMarkupPin | null>(null);
  const [previewPunchItemId, setPreviewPunchItemId] = React.useState<string | null>(null);

  // Group pins by type
  const grouped = pins.reduce<Record<string, DrawingMarkupPin[]>>((acc, pin) => {
    const key = pin.pin_type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(pin);
    return acc;
  }, {});

  if (pins.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3">
          <Link2 className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground mb-1">No links yet</p>
        <p className="text-xs text-muted-foreground">
          Add a link, then click the drawing location to connect RFIs, documents, photos, submittals, and more.
        </p>
        {onStartLinkPlacement && (
          <Button
            type="button"
            size="sm"
            onClick={onStartLinkPlacement}
            className="mt-4 h-8 gap-1.5 px-3"
          >
            <Plus className="h-3.5 w-3.5" />
            Add link
          </Button>
        )}
      </div>
    );
  }

  const navigateToEntity = (pin: DrawingMarkupPin) => {
    if (!pin.entity_id) return;
    switch (pin.pin_type) {
      case "rfi":
        router.push(`/${projectId}/rfis/${pin.entity_id}`);
        break;
      case "punch_item":
        router.push(`/${projectId}/punch-list/${pin.entity_id}`);
        break;
      case "drawing":
        router.push(`/${projectId}/drawings/viewer/${pin.entity_id}`);
        break;
      case "photo":
        router.push(`/${projectId}/photos?photoId=${pin.entity_id}`);
        break;
      case "document":
        router.push(`/${projectId}/documents/${pin.entity_id}`);
        break;
      case "submittal":
        router.push(`/${projectId}/submittals/${pin.entity_id}`);
        break;
      default:
        break;
    }
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto divide-y divide-border">
        {onStartLinkPlacement && (
          <div className="flex items-center justify-between px-3 py-2">
            <p className="text-xs text-muted-foreground">
              {pins.length} link{pins.length === 1 ? "" : "s"} on this drawing
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onStartLinkPlacement}
              className="h-7 gap-1.5 px-2 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
          </div>
        )}
        {Object.entries(grouped).map(([type, typePins]) => {
          const config = PIN_TYPE_CONFIG[type as DrawingMarkupPin["pin_type"]];
          if (!config) return null;
          return (
            <div key={type}>
              <div className="px-3 py-1.5 flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: config.color }}
                />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  {config.label}s ({typePins.length})
                </span>
              </div>
              {typePins.map((pin) => (
                <div
                  key={pin.id}
                  onMouseEnter={() => onPinHover?.(pin.id)}
                  onMouseLeave={() => onPinHover?.(null)}
                  className={cn(
                    "group px-3 py-2 flex items-start gap-2 hover:bg-muted transition-colors cursor-default",
                    pin.page !== currentPage && "opacity-50"
                  )}
                >
                  {/* Color indicator */}
                  <div
                    className="h-5 w-5 rounded shrink-0 flex items-center justify-center text-primary-foreground mt-0.5"
                    style={{ backgroundColor: pin.color ?? config.color }}
                  >
                    <span className="text-[9px] font-bold">
                      {config.label[0]}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    {pin.entity_number && (
                      <p className="text-[10px] text-muted-foreground leading-none mb-0.5">
                        {pin.entity_number}
                      </p>
                    )}
                    {pin.pin_type === "punch_item" && pin.entity_id ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="block max-w-full truncate text-left text-xs leading-snug text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => setPreviewPunchItemId(pin.entity_id)}
                        aria-label={`View details for ${pin.entity_label ?? config.label}`}
                      >
                        {pin.entity_label ?? config.label}
                      </Button>
                    ) : (
                      <p className="truncate text-xs leading-snug text-foreground">
                        {pin.entity_label ?? config.label}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {pin.entity_status && <StatusDot status={pin.entity_status} />}
                      {pin.entity_status && (
                        <span className="text-[10px] text-muted-foreground capitalize">
                          {pin.entity_status.replace("_", " ")}
                        </span>
                      )}
                      {pin.page !== currentPage && (
                        <span className="text-[10px] text-muted-foreground">
                          · Page {pin.page}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {pin.entity_id && pin.pin_type === "photo" ? (
                      <DrawingPhotoSidebarActions
                        projectId={projectId}
                        photoId={pin.entity_id}
                        label={pin.entity_number ?? pin.entity_label ?? "Photo"}
                        onViewAllPhotos={() => router.push(`/${projectId}/photos`)}
                      />
                    ) : pin.entity_id ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                        onClick={() => navigateToEntity(pin)}
                        title="Open in tool"
                      >
                        <ArrowRight />
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive hover:bg-muted"
                      onClick={() => setPendingDeletePin(pin)}
                      title="Remove link"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <ConfirmDeleteDialog
        open={pendingDeletePin !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeletePin(null);
        }}
        title="Remove this link?"
        description="The pin will be removed from the drawing. The linked item will not be deleted."
        confirmLabel="Remove"
        isDeleting={deletePin.isPending}
        onConfirm={() => {
          if (pendingDeletePin) {
            deletePin.mutate(pendingDeletePin.id, {
              onSettled: () => setPendingDeletePin(null),
            });
          }
        }}
      />

      <PunchItemPreviewDialog
        open={previewPunchItemId !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewPunchItemId(null);
        }}
        projectId={Number(projectId)}
        punchItemId={previewPunchItemId}
        onViewFullPage={() => {
          setPreviewPunchItemId(null);
          router.push(`/${projectId}/punch-list`);
        }}
      />
    </>
  );
}
