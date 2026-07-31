"use client";

import * as React from "react";
import { Check, ImageOff, LoaderCircle, Pencil, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { usePhoto, useUpdatePhoto } from "@/hooks/use-photos";

interface DrawingPhotoPreviewProps {
  projectId: string;
  photoId: string;
  label: string;
  trigger?: React.ReactElement<{ onClick?: React.MouseEventHandler }>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerClickOpensDialog?: boolean;
}

function PhotoLoadState({ message }: { message: string }) {
  return (
    <div className="flex min-h-28 items-center justify-center gap-2 px-4 text-sm text-muted-foreground">
      <ImageOff className="h-4 w-4" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

export function DrawingPhotoPreview({
  projectId,
  photoId,
  label,
  trigger,
  open,
  onOpenChange,
  triggerClickOpensDialog = true,
}: DrawingPhotoPreviewProps) {
  const [hoverOpen, setHoverOpen] = React.useState(false);
  const [pinnedPreviewOpen, setPinnedPreviewOpen] = React.useState(false);
  const [internalDialogOpen, setInternalDialogOpen] = React.useState(false);
  const [imageFailed, setImageFailed] = React.useState(false);
  const [titleOverride, setTitleOverride] = React.useState<string | null>(null);
  const [titleDraft, setTitleDraft] = React.useState("");
  const [editingTitle, setEditingTitle] = React.useState(false);
  const dialogOpen = open ?? internalDialogOpen;
  const numericProjectId = Number(projectId);
  const numericPhotoId = Number(photoId);
  const hasValidIds =
    Number.isFinite(numericProjectId) && Number.isFinite(numericPhotoId);
  const photoQuery = usePhoto(numericProjectId, numericPhotoId, {
    enabled: hasValidIds && (hoverOpen || pinnedPreviewOpen || dialogOpen),
  });
  const updatePhoto = useUpdatePhoto(numericProjectId, numericPhotoId);

  React.useEffect(() => {
    setImageFailed(false);
  }, [photoQuery.data?.file_url]);

  const photoTitle = titleOverride ?? photoQuery.data?.title ?? label;
  React.useEffect(() => {
    if (!editingTitle) setTitleDraft(photoTitle);
  }, [editingTitle, photoTitle]);

  const saveTitle = () => {
    const nextTitle = titleDraft.trim();
    if (!nextTitle) return;
    updatePhoto.mutate(
      { title: nextTitle },
      {
        onSuccess: (updated) => {
          setTitleOverride(updated.title);
          setTitleDraft(updated.title);
          setEditingTitle(false);
        },
      },
    );
  };
  const openDialog = () => {
    setPinnedPreviewOpen(false);
    setInternalDialogOpen(true);
    onOpenChange?.(true);
  };
  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (open === undefined) setInternalDialogOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };
  const triggerWithPreview = trigger
    ? React.cloneElement(trigger, {
        onClick: (event: React.MouseEvent) => {
          trigger.props.onClick?.(event);
          if (!event.defaultPrevented) {
            if (triggerClickOpensDialog) {
              setInternalDialogOpen(true);
              onOpenChange?.(true);
            } else {
              setPinnedPreviewOpen(true);
              setHoverOpen(true);
            }
          }
        },
      })
    : null;

  const image =
    photoQuery.data && !imageFailed ? (
      <img
        src={photoQuery.data.file_url}
        alt={photoTitle}
        className="h-full w-full object-contain"
        onError={() => setImageFailed(true)}
      />
    ) : null;

  return (
    <>
      {triggerWithPreview && (
        <HoverCard
          open={(hoverOpen || pinnedPreviewOpen) && !dialogOpen}
          onOpenChange={(nextOpen) => {
            setHoverOpen(nextOpen);
            if (!nextOpen) setPinnedPreviewOpen(false);
          }}
          openDelay={200}
          closeDelay={100}
        >
          <HoverCardTrigger asChild>{triggerWithPreview}</HoverCardTrigger>
          <HoverCardContent side="top" align="center" className="w-72 p-2">
            <div className="aspect-video overflow-hidden rounded-md bg-muted">
              {photoQuery.isLoading ? (
                <div
                  className="flex h-full items-center justify-center"
                  role="status"
                  aria-label="Loading photo preview"
                >
                  <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : image ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="relative h-full w-full cursor-zoom-in overflow-hidden p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label={`Open ${photoTitle} in lightbox`}
                  onClick={openDialog}
                >
                  {React.cloneElement(image, {
                    className: "h-full w-full object-contain",
                  })}
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/75 via-foreground/35 to-transparent px-3 pb-2 pt-7 text-left text-xs font-medium text-background">
                    {photoTitle}
                  </span>
                </Button>
              ) : (
                <PhotoLoadState message="Photo preview unavailable" />
              )}
            </div>
          </HoverCardContent>
        </HoverCard>
      )}

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent
          size="wide"
          showCloseButton={false}
          className="overflow-hidden p-0"
        >
          <DialogTitle className="sr-only">{photoTitle}</DialogTitle>
          <div className="relative flex min-h-64 max-h-dvh items-center justify-center bg-muted">
            {photoQuery.isLoading ? (
              <LoaderCircle
                className="h-5 w-5 animate-spin text-muted-foreground"
                aria-label="Loading photo"
              />
            ) : image ? (
              <>
                {image}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-4 pb-4 pt-12 text-left">
                  {editingTitle ? (
                    <div className="flex max-w-md items-center gap-2">
                      <Input
                        autoFocus
                        value={titleDraft}
                        onChange={(event) => setTitleDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") saveTitle();
                          if (event.key === "Escape") {
                            setTitleDraft(photoTitle);
                            setEditingTitle(false);
                          }
                        }}
                        aria-label="Photo name"
                        className="h-9 border-background/30 bg-foreground/35 text-background placeholder:text-background/60"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        onClick={saveTitle}
                        disabled={updatePhoto.isPending || !titleDraft.trim()}
                        aria-label="Save photo name"
                      >
                        <Check />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-left text-sm font-medium text-background">
                      <span className="min-w-0 truncate">{photoTitle}</span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0 text-background hover:bg-background/15 hover:text-background"
                        onClick={() => {
                          setTitleDraft(photoTitle);
                          setEditingTitle(true);
                        }}
                        aria-label="Edit photo name"
                      >
                        <Pencil />
                      </Button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <PhotoLoadState message="This photo could not be loaded" />
            )}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="absolute right-3 top-3 h-10 w-10 rounded-full bg-foreground/45 text-background hover:bg-foreground/65 hover:text-background"
              onClick={() => handleDialogOpenChange(false)}
              aria-label="Close photo lightbox"
            >
              <X />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
