"use client";

import * as React from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api-client";
import { knowledgeDocumentKeys } from "@/hooks/use-knowledge-documents";
import { useQueryClient } from "@tanstack/react-query";

interface KnowledgeUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KnowledgeUploadDialog({
  open,
  onOpenChange,
}: KnowledgeUploadDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [title, setTitle] = React.useState("");
  const [tags, setTags] = React.useState("");
  const [isUploading, setIsUploading] = React.useState(false);
  const [fileError, setFileError] = React.useState<string | null>(null);

  function handleClose() {
    setTitle("");
    setTags("");
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onOpenChange(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setFileError("Choose a file before uploading.");
      return;
    }
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
    if (file.size > MAX_FILE_SIZE) {
      setFileError("File exceeds the 50 MB limit. Please choose a smaller file.");
      return;
    }
    setFileError(null);

    const formData = new FormData();
    formData.append("file", file);
    if (title.trim()) formData.append("title", title.trim());
    if (tags.trim()) formData.append("tags", tags.trim());

    setIsUploading(true);
    try {
      await apiFetch("/api/knowledge/upload", {
        method: "POST",
        body: formData,
      });
      await queryClient.invalidateQueries({
        queryKey: knowledgeDocumentKeys.all,
      });
      toast.success("Knowledge source uploaded and queued for processing");
      handleClose();
    } catch (error) {
      toast.error("Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Upload Knowledge Source</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="knowledge-file">File *</Label>
            <Input
              ref={fileInputRef}
              id="knowledge-file"
              type="file"
              accept=".pdf,.docx,.doc,.txt,.md,.markdown"
              onChange={() => {
                if (fileError) setFileError(null);
              }}
            />
            <p className="text-xs text-muted-foreground">
              PDF, Word, or plain text. Max 50MB.
            </p>
            {fileError && (
              <p className="text-sm text-destructive">{fileError}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="knowledge-title">Title</Label>
            <Input
              id="knowledge-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Defaults to the file name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="knowledge-tags">Tags</Label>
            <Input
              id="knowledge-tags"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="Comma-separated tags"
            />
            <p className="text-xs text-muted-foreground">
              The document will be processed by the RAG pipeline and become
              searchable once embedded.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isUploading}>
              <Upload />
              {isUploading ? "Uploading..." : "Upload Source"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
