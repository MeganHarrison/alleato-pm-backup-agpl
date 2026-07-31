"use client";

import { useCallback, useRef, useState } from "react";
import { ImageIcon, ImagePlus, X } from "lucide-react";

import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ds";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useUploadPhotos } from "@/hooks/use-photos";
import { ALBUM_OPTIONS } from "./photos-grid-config";

interface PhotoUploadDialogProps {
  projectId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PhotoUploadDialog({
  projectId,
  open,
  onOpenChange,
}: PhotoUploadDialogProps) {
  const uploadPhotos = useUploadPhotos(projectId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [album, setAlbum] = useState("Default");
  const [isPrivate, setIsPrivate] = useState(false);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const images = Array.from(incoming).filter((f) =>
      f.type.startsWith("image/"),
    );
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size));
      return [...prev, ...images.filter((f) => !existing.has(f.name + f.size))];
    });
  }, []);

  const removeFile = (index: number) =>
    setFiles((prev) => prev.filter((_, i) => i !== index));

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const handleSubmit = async () => {
    if (!files.length) return;
    await uploadPhotos.mutateAsync({ files, album, is_private: isPrivate });
    setFiles([]);
    setIsPrivate(false);
    onOpenChange(false);
  };

  const handleClose = () => {
    setFiles([]);
    setIsPrivate(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Photos</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop zone — label wraps the hidden input so clicking anywhere activates browse */}
          <label
            htmlFor="photo-file-input"
            className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
              dragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-muted/30"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <ImagePlus className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                Drop photos here or{" "}
                <span className="text-primary underline-offset-2 hover:underline">
                  browse
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                JPG, PNG, GIF, WEBP — multiple files supported
              </p>
            </div>
            <Input
              ref={inputRef}
              id="photo-file-input"
              type="file"
              title="Select photos to upload"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />
          </label>

          {/* File list */}
          {files.length > 0 && (
            <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border bg-muted/20 p-2">
              {files.map((file, i) => (
                <li
                  key={`${file.name}-${file.size}`}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-muted">
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="flex-1 truncate text-foreground">
                    {file.name}
                  </span>
                  <Button
                    type="button"
                    onClick={() => removeFile(i)}
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {/* Album selector */}
          <div className="flex items-center gap-3">
            <label
              htmlFor="album-select"
              className="whitespace-nowrap text-sm font-medium text-foreground"
            >
              Album
            </label>
            <Select value={album} onValueChange={setAlbum}>
              <SelectTrigger id="album-select" className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALBUM_OPTIONS.filter((opt) => opt.value !== "__all__").map(
                  (opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Private toggle */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="is-private"
              checked={isPrivate}
              onCheckedChange={(v) => setIsPrivate(Boolean(v))}
            />
            <Label htmlFor="is-private" className="cursor-pointer text-sm font-normal">
              Private — only visible to admins
            </Label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!files.length || uploadPhotos.isPending}
              onClick={handleSubmit}
            >
              {uploadPhotos.isPending
                ? "Uploading..."
                : files.length > 1
                  ? `Upload ${files.length} Photos`
                  : "Upload Photo"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
