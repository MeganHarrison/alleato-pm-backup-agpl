"use client";

import { useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import {
  Camera,
  Clock,
  Download,
  FolderOpen,
  Image,
  MapPin,
  Plus,
  RotateCcw,
  Star,
  StarOff,
  Trash2,
  Upload,
} from "lucide-react";

import { PageShell, PageTabs } from "@/components/layout";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Textarea,
} from "@/components/ds";
import { ExpandableSearch } from "@/components/tables/unified/table-toolbar";
import {
  useDeletePhoto,
  useDeletePhotoPermanently,
  usePhotos,
  useRestorePhoto,
  useUpdatePhoto,
  useUploadPhotos,
} from "@/hooks/use-photos";
import type { PhotoSummary } from "@/hooks/use-photos";
import { AlbumsTab } from "@/features/photos/albums-tab";
import { PhotoUploadDialog } from "@/features/photos/photo-upload-dialog";
import {
  ALBUM_OPTIONS,
  formatFileSize,
  formatPhotoDate,
} from "@/features/photos/photos-grid-config";
import { cn } from "@/lib/utils";

export default function ProjectPhotosPage() {
  const params = useParams<{ projectId: string }>()!;
  const projectId = parseInt(params.projectId, 10);

  const [activeTab, setActiveTab] = useState<
    "photos" | "map" | "timeline" | "albums" | "recycle-bin"
  >("photos");
  const [search, setSearch] = useState("");
  const [album, setAlbum] = useState("__all__");
  const [isStarred, setIsStarred] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<PhotoSummary | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const albumFilter = album === "__all__" ? undefined : album;
  const { data: photos, isLoading } = usePhotos(projectId, albumFilter, {
    starred: isStarred || undefined,
  });
  const deletePhoto = useDeletePhoto(projectId);
  const uploadPhotos = useUploadPhotos(projectId);

  const filteredPhotos = (photos ?? []).filter((photo) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      photo.title.toLowerCase().includes(q) ||
      photo.description?.toLowerCase().includes(q) ||
      photo.file_name.toLowerCase().includes(q)
    );
  });

  const handleDelete = useCallback(
    (photoId: number) => {
      deletePhoto.mutate(photoId);
      setLightboxPhoto(null);
    },
    [deletePhoto],
  );

  // ─── Drag-and-drop handlers ────────────────────────────────────────────────
  const dragCounter = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (files.length > 0) {
        uploadPhotos.mutate(files);
      }
    },
    [uploadPhotos],
  );

  return (
    <PageShell
      variant="dashboard"
      title="Photos"
      actions={
        <Button size="sm" onClick={() => setUploadOpen(true)}>
          <Upload className="mr-1.5 size-4" />
          Upload Photo
        </Button>
      }
    >
      <div className="space-y-4">
        <PageTabs
          tabs={[
            { label: "Photos", href: "photos", isActive: activeTab === "photos" },
            { label: "Map", href: "map", isActive: activeTab === "map" },
            {
              label: "Timeline",
              href: "timeline",
              isActive: activeTab === "timeline",
            },
            { label: "Albums", href: "albums", isActive: activeTab === "albums" },
            {
              label: "Recycle Bin",
              href: "recycle-bin",
              isActive: activeTab === "recycle-bin",
            },
          ]}
          variant="inline"
          className="mb-0"
          onTabClick={(href) =>
            setActiveTab(
              href as
                | "photos"
                | "map"
                | "timeline"
                | "albums"
                | "recycle-bin",
            )
          }
        />

        {/* ─── Photos Tab ─────────────────────────────────────────────── */}
        {activeTab === "photos" ? (
          <section
            aria-label="Photo drop zone"
            className="space-y-4"
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {/* Dropbox-style drag overlay */}
            {isDragging && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm transition-all duration-200 animate-in fade-in">
                <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-primary bg-primary/5 px-16 py-12 shadow-sm transition-transform duration-200 scale-100">
                  <div className="rounded-full bg-primary/10 p-4">
                    <Upload className="size-8 text-primary" />
                  </div>
                  <p className="text-lg font-semibold text-foreground">
                    Drop photos to upload
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Images will be uploaded instantly
                  </p>
                </div>
              </div>
            )}

            {/* Upload progress banner */}
            {uploadPhotos.isPending && (
              <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2.5 text-sm text-primary">
                <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Uploading photos...
              </div>
            )}

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              <ExpandableSearch
                placeholder="Search photos..."
                value={search}
                onChange={setSearch}
              />

              <Select value={album} onValueChange={setAlbum}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All Albums" />
                </SelectTrigger>
                <SelectContent>
                  {ALBUM_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant={isStarred ? "default" : "outline"}
                size="sm"
                onClick={() => setIsStarred((v) => !v)}
                className="gap-1.5"
              >
                <Star className={cn("size-4", isStarred && "fill-current")} />
                Starred
              </Button>
            </div>

            {/* Loading state */}
            {isLoading && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {["a","b","c","d","e","f","g","h"].map((k) => (
                  <div key={k} className="space-y-2">
                    <Skeleton className="aspect-video w-full rounded-lg" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {!isLoading && filteredPhotos.length === 0 && (
              <div
                className={cn(
                  "rounded-lg border-2 border-dashed transition-colors",
                  isDragging ? "border-primary bg-primary/5" : "border-transparent",
                )}
              >
                <EmptyState
                  icon={<Camera />}
                  title={isStarred ? "No starred photos" : "No photos yet"}
                  description={
                    isStarred
                      ? "Star photos to find them quickly here."
                      : search || albumFilter
                        ? "No photos match your current filters."
                        : "Drag and drop images here, or click Upload Photo to get started."
                  }
                  action={
                    !search && !albumFilter && !isStarred ? (
                      <Button size="sm" variant="outline" onClick={() => setUploadOpen(true)}>
                        <Plus />
                        Upload Photo
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            )}

            {/* Photo grid */}
            {!isLoading && filteredPhotos.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredPhotos.map((photo) => (
                  <PhotoCard
                    key={photo.id}
                    photo={photo}
                    projectId={projectId}
                    onClick={() => setLightboxPhoto(photo)}
                  />
                ))}
              </div>
            )}
          </section>
        ) : null}

        {/* ─── Map Tab ────────────────────────────────────────────────── */}
        {activeTab === "map" ? (
          <EmptyState
            icon={<MapPin />}
            title="Map View"
            description="View geotagged photos on a project map. Photos with location data will appear as pins."
          />
        ) : null}

        {/* ─── Timeline Tab ───────────────────────────────────────────── */}
        {activeTab === "timeline" ? (
          <EmptyState
            icon={<Clock />}
            title="Timeline View"
            description="Browse photos chronologically to track project progress over time."
          />
        ) : null}

        {/* ─── Albums Tab ─────────────────────────────────────────────── */}
        {activeTab === "albums" ? (
          <AlbumsTab projectId={projectId} />
        ) : null}

        {/* ─── Recycle Bin Tab ─────────────────────────────────────────── */}
        {activeTab === "recycle-bin" ? (
          <RecycleBinTab projectId={projectId} />
        ) : null}
      </div>

      {/* Mobile FAB */}
      <Button
        size="icon"
        onClick={() => setUploadOpen(true)}
        className="fixed right-4 bottom-[calc(3.5rem+1rem+env(safe-area-inset-bottom))] z-40 size-14 rounded-full shadow-sm sm:hidden"
        aria-label="Upload photo"
      >
        <Plus className="size-6" />
      </Button>

      <PhotoUploadDialog
        projectId={projectId}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
      />

      {lightboxPhoto && (
        <PhotoLightbox
          photo={lightboxPhoto}
          projectId={projectId}
          onClose={() => setLightboxPhoto(null)}
          onDelete={handleDelete}
          onUpdate={(updated) => setLightboxPhoto(updated)}
        />
      )}
    </PageShell>
  );
}

// ─── Photo Card ──────────────────────────────────────────────────────────────

function PhotoCard({
  photo,
  projectId,
  onClick,
}: {
  photo: PhotoSummary;
  projectId: number;
  onClick: () => void;
}) {
  const updatePhoto = useUpdatePhoto(projectId, photo.id);

  const toggleStar = (e: React.MouseEvent) => {
    e.stopPropagation();
    updatePhoto.mutate({ starred: !photo.starred });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative w-full cursor-pointer overflow-hidden rounded-lg bg-muted text-left transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative aspect-video">
        <img
          src={photo.file_url}
          alt={photo.title}
          className="size-full object-cover"
          loading="lazy"
        />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={toggleStar}
          className="absolute right-2 top-2 size-8 rounded-full bg-background/80 opacity-0 transition-opacity group-hover:opacity-100"
        >
          {photo.starred ? (
            <Star className="size-4 fill-current text-primary" />
          ) : (
            <StarOff className="size-4 text-muted-foreground" />
          )}
        </Button>

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/80 to-transparent px-3 pb-2 pt-6">
          <p className="truncate text-sm font-medium text-foreground">
            {photo.title}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs text-muted-foreground">
          {formatPhotoDate(photo.date_taken ?? photo.created_at)}
        </span>
        <div className="flex items-center gap-1.5">
          {photo.album && (
            <Badge variant="secondary" className="text-xs">
              {photo.album}
            </Badge>
          )}
          {photo.file_size ? (
            <span className="text-xs text-muted-foreground">
              {formatFileSize(photo.file_size)}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

// ─── Lightbox ────────────────────────────────────────────────────────────────

function PhotoLightbox({
  photo,
  projectId,
  onClose,
  onDelete,
  onUpdate,
}: {
  photo: PhotoSummary;
  projectId: number;
  onClose: () => void;
  onDelete: (id: number) => void;
  onUpdate: (updated: PhotoSummary) => void;
}) {
  const updatePhoto = useUpdatePhoto(projectId, photo.id);
  const [editDescription, setEditDescription] = useState(photo.description ?? "");
  const [editAlbum, setEditAlbum] = useState(photo.album ?? "Default");
  const [isDirty, setIsDirty] = useState(false);

  const handleSave = () => {
    updatePhoto.mutate(
      { description: editDescription || null, album: editAlbum },
      {
        onSuccess: (updated) => {
          onUpdate(updated);
          setIsDirty(false);
        },
      },
    );
  };

  const toggleStar = () => {
    updatePhoto.mutate(
      { starred: !photo.starred },
      { onSuccess: (updated) => onUpdate(updated) },
    );
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl overflow-hidden p-0">
        <DialogHeader className="px-6 pb-0 pt-6">
          <DialogTitle>{photo.title}</DialogTitle>
        </DialogHeader>

        {/* Image */}
        <div className="relative bg-muted">
          <img
            src={photo.file_url}
            alt={photo.title}
            className="max-h-[55vh] w-full object-contain"
          />
        </div>

        {/* Details */}
        <div className="space-y-4 px-6 pb-6">
          {/* Editable description */}
          <div className="space-y-1.5">
            <label
              htmlFor="lightbox-description"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Description
            </label>
            <Textarea
              id="lightbox-description"
              value={editDescription}
              onChange={(e) => {
                setEditDescription(e.target.value);
                setIsDirty(true);
              }}
              placeholder="Add a description..."
              rows={2}
              className="resize-none text-sm"
            />
          </div>

          {/* Editable album */}
          <div className="space-y-1.5">
            <label
              htmlFor="lightbox-album"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Album
            </label>
            <Select
              value={editAlbum}
              onValueChange={(v) => {
                setEditAlbum(v);
                setIsDirty(true);
              }}
            >
              <SelectTrigger id="lightbox-album" className="w-50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALBUM_OPTIONS.filter((o) => o.value !== "__all__").map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Metadata chips */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {photo.location && <span>{photo.location}</span>}
            {photo.trade && <span>{photo.trade}</span>}
            {photo.file_size ? <span>{formatFileSize(photo.file_size)}</span> : null}
            {photo.date_taken && <span>{formatPhotoDate(photo.date_taken)}</span>}
            {photo.width && photo.height && (
              <span>{photo.width} × {photo.height}</span>
            )}
          </div>

          {photo.tags && photo.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {photo.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            {isDirty && (
              <Button
                size="sm"
                onClick={handleSave}
                disabled={updatePhoto.isPending}
              >
                Save
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={toggleStar}>
              {photo.starred ? (
                <>
                  <Star className="mr-1.5 size-4 fill-current text-warning" />
                  Starred
                </>
              ) : (
                <>
                  <StarOff className="mr-1.5 size-4" />
                  Star
                </>
              )}
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={photo.file_url} download={photo.file_name}>
                <Download className="mr-1.5 size-4" />
                Download
              </a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(photo.id)}
              className="ml-auto text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="mr-1.5 size-4" />
              Delete
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Recycle Bin Tab ─────────────────────────────────────────────────────────

function RecycleBinTab({ projectId }: { projectId: number }) {
  const { data: deleted, isLoading } = usePhotos(projectId, undefined, {
    deleted: true,
  });
  const restorePhoto = useRestorePhoto(projectId);
  const deleteForever = useDeletePhotoPermanently(projectId);

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {["a","b","c","d"].map((k) => (
          <div key={k} className="space-y-2">
            <Skeleton className="aspect-video w-full rounded-lg" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  if (!deleted?.length) {
    return (
      <EmptyState
        icon={<Trash2 />}
        title="Recycle Bin is empty"
        description="Deleted photos will appear here for 30 days before permanent removal."
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {deleted.length} photo{deleted.length !== 1 ? "s" : ""} — deleted items are
        removed permanently after 30 days.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {deleted.map((photo) => (
          <div
            key={photo.id}
            className="overflow-hidden rounded-lg bg-muted opacity-75"
          >
            <div className="relative aspect-video">
              <img
                src={photo.file_url}
                alt={photo.title}
                className="size-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="space-y-2 p-3">
              <p className="truncate text-sm font-medium text-foreground">
                {photo.title}
              </p>
              <p className="text-xs text-muted-foreground">
                Deleted {formatPhotoDate(photo.deleted_at ?? photo.updated_at)}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => restorePhoto.mutate(photo.id)}
                  disabled={restorePhoto.isPending}
                >
                  <RotateCcw className="mr-1.5 size-3.5" />
                  Restore
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-destructive hover:bg-destructive/10"
                  onClick={() => deleteForever.mutate(photo.id)}
                  disabled={deleteForever.isPending}
                >
                  <Trash2 className="mr-1.5 size-3.5" />
                  Delete Forever
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
