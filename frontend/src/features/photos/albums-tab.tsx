"use client";

import { useState } from "react";
import { FolderOpen, FolderPlus, Pencil, Trash2 } from "lucide-react";

import {
  Button,
  EmptyState,
  Input,
  Skeleton,
} from "@/components/ds";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useCreatePhotoAlbum,
  useDeletePhotoAlbum,
  usePhotoAlbums,
  useRenamePhotoAlbum,
} from "@/hooks/use-photo-albums";
import { usePhotos } from "@/hooks/use-photos";

interface AlbumsTabProps {
  projectId: number;
}

export function AlbumsTab({ projectId }: AlbumsTabProps) {
  const { data: albums, isLoading } = usePhotoAlbums(projectId);
  const createAlbum = useCreatePhotoAlbum(projectId);
  const renameAlbum = useRenamePhotoAlbum(projectId);
  const deleteAlbum = useDeletePhotoAlbum(projectId);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleCreate = () => {
    if (!newName.trim()) return;
    createAlbum.mutate(
      { name: newName.trim() },
      {
        onSuccess: () => {
          setNewName("");
          setCreateOpen(false);
        },
      },
    );
  };

  const handleRename = () => {
    if (!renameId || !renameName.trim()) return;
    renameAlbum.mutate(
      { albumId: renameId, name: renameName.trim() },
      { onSuccess: () => setRenameId(null) },
    );
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteAlbum.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
  };

  const albumToDelete = albums?.find((a) => a.id === deleteId);
  const albumToRename = albums?.find((a) => a.id === renameId);

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {["a", "b", "c", "d"].map((k) => (
          <Skeleton key={k} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {albums?.length
              ? `${albums.length} album${albums.length !== 1 ? "s" : ""}`
              : "No albums yet"}
          </p>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <FolderPlus className="mr-1.5 size-4" />
            New Album
          </Button>
        </div>

        {!albums?.length ? (
          <EmptyState
            icon={<FolderOpen />}
            title="No albums yet"
            description="Create albums to organise your photos by trade, phase, or location."
            action={<Button onClick={() => setCreateOpen(true)}><FolderPlus />New Album</Button>}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {albums.map((album) => (
              <AlbumCard
                key={album.id}
                albumId={album.id}
                name={album.name}
                projectId={projectId}
                onRename={() => {
                  setRenameId(album.id);
                  setRenameName(album.name);
                }}
                onDelete={() => setDeleteId(album.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New Album</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Album name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newName.trim() || createAlbum.isPending}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={Boolean(renameId)} onOpenChange={() => setRenameId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename "{albumToRename?.name}"</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="New name"
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameId(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleRename}
              disabled={!renameName.trim() || renameAlbum.isPending}
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={Boolean(deleteId)} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete "{albumToDelete?.name}"?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Photos in this album will be moved to Default. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteAlbum.isPending}
            >
              Delete Album
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ─── Album Card ─────────────────────────────────────────────────────────── */

function AlbumCard({
  albumId,
  name,
  projectId,
  onRename,
  onDelete,
}: {
  albumId: string;
  name: string;
  projectId: number;
  onRename: () => void;
  onDelete: () => void;
}) {
  const { data: photos } = usePhotos(projectId, name);
  const count = photos?.length ?? 0;

  return (
    <div className="group overflow-hidden rounded-lg border border-border bg-card transition-shadow hover:shadow-xs">
      {/* Cover — first photo or placeholder */}
      <div className="relative aspect-video bg-muted">
        {photos?.[0] ? (
          <img
            src={photos[0].file_url}
            alt={name}
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <FolderOpen className="size-8 text-muted-foreground/40" />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{name}</p>
          <p className="text-xs text-muted-foreground">
            {count} photo{count !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onRename}
            aria-label={`Rename ${name}`}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onDelete}
            aria-label={`Delete ${name}`}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
