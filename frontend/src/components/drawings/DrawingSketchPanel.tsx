"use client";

import { useRef, useState } from "react";
import { PenLine, Download, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { EmptyState } from "@/components/ds";
import {
  useRevisionSketches,
  useAddSketch,
  useDeleteSketch,
} from "@/hooks/use-drawings";

interface DrawingSketchPanelProps {
  projectId: string;
  drawingId: string;
  revisionId: string;
}

const VALID_TYPES = ["image/png", "image/jpeg", "image/jpg", "application/pdf"];
const MAX_SIZE = 50 * 1024 * 1024; // 50MB

export function DrawingSketchPanel({
  projectId,
  drawingId,
  revisionId,
}: DrawingSketchPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteSketchId, setDeleteSketchId] = useState<string | null>(null);
  const [uploadName, setUploadName] = useState("");

  const { data: sketches, isLoading } = useRevisionSketches(
    projectId,
    drawingId,
    revisionId,
  );
  const addSketch = useAddSketch(projectId, drawingId, revisionId);
  const deleteSketch = useDeleteSketch(projectId, drawingId, revisionId);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!VALID_TYPES.includes(file.type)) {
      alert("Only PNG, JPEG, and PDF files are supported");
      return;
    }
    if (file.size > MAX_SIZE) {
      alert("File too large (max 50MB)");
      return;
    }

    const name = uploadName.trim() || file.name.replace(/\.[^/.]+$/, "");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", name);

    await addSketch.mutateAsync(formData);
    setUploadName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = async () => {
    if (!deleteSketchId) return;
    await deleteSketch.mutateAsync(deleteSketchId);
    setDeleteSketchId(null);
  };

  if (!revisionId) {
    return (
      <EmptyState
        icon={<PenLine className="h-6 w-6 text-muted-foreground" />}
        title="No revision selected"
        description="Select a revision to view or add sketches."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 justify-end">
        {addSketch.isPending && (
          <span className="text-sm text-muted-foreground">Uploading...</span>
        )}
        <Input
          placeholder="Sketch name (optional)"
          value={uploadName}
          onChange={(e) => setUploadName(e.target.value)}
          className="max-w-[220px]"
        />
        <Button
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={addSketch.isPending}
        >
          <Upload className="h-4 w-4 mr-1.5" />
          Upload Sketch
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.pdf"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground text-sm">
          Loading sketches...
        </div>
      ) : !sketches || sketches.length === 0 ? (
        <EmptyState
          icon={<PenLine className="h-6 w-6 text-muted-foreground" />}
          title="No sketches yet"
          description="Upload PNG, JPEG, or PDF sketch files to annotate this revision."
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {sketches.map((sketch) => (
            <div
              key={sketch.id}
              className="group relative rounded-lg bg-muted overflow-hidden aspect-square flex flex-col"
            >
              {/* Thumbnail */}
              <div className="flex-1 flex items-center justify-center p-2">
                {sketch.signed_url && (
                  sketch.file_url.includes(".pdf") ? (
                    <div className="flex flex-col items-center gap-1">
                      <PenLine className="h-8 w-8 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">PDF</span>
                    </div>
                  ) : (
                    <img
                      src={sketch.signed_url}
                      alt={sketch.name}
                      className="object-contain w-full h-full"
                    />
                  )
                )}
              </div>

              {/* Footer */}
              <div className="px-2 pb-2 pt-1 bg-card">
                <p className="text-xs font-medium truncate text-foreground">
                  #{sketch.sketch_number} — {sketch.name}
                </p>
              </div>

              {/* Hover actions */}
              <div className="absolute top-1 right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {sketch.signed_url && (
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-6 w-6"
                    asChild
                  >
                    <a href={sketch.signed_url} download={sketch.name}>
                      <Download className="h-3 w-3" />
                    </a>
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-6 w-6 hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => setDeleteSketchId(sketch.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog
        open={!!deleteSketchId}
        onOpenChange={() => setDeleteSketchId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sketch</AlertDialogTitle>
            <AlertDialogDescription>
              Delete this sketch? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
