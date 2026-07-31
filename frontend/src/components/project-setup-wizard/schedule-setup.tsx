"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Upload,
  File,
  Calendar,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
} from "lucide-react";
import { StepComponentProps } from "./project-setup-wizard";

interface UploadedDocument {
  id: string;
  project_id: number;
  title: string;
  file_id: string;
  url: string;
  content: string;
  metadata: {
    fileName: string;
    fileType: string;
    fileSize: number;
    category: string;
  };
}

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: "uploading" | "success" | "error";
  error?: string;
  documentId?: string;
}

export function ScheduleSetup({
  projectId,
  onNext,
  onSkip,
}: StepComponentProps) {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [uploadedDocuments, setUploadedDocuments] = useState<
    UploadedDocument[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setError(null);

      const newFiles: UploadingFile[] = acceptedFiles.map((file) => ({
        id: Math.random().toString(36).substr(2, 9),
        file,
        progress: 0,
        status: "uploading" as const,
      }));

      setUploadingFiles((prev) => [...prev, ...newFiles]);

      for (const uploadFile of newFiles) {
        try {
          const fileExt = uploadFile.file.name.split(".").pop();
          const filePath = `projects/${projectId}/schedules/${uploadFile.id}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from("schedules")
            .upload(filePath, uploadFile.file);

          if (uploadError) {
            throw new Error(
              `Storage upload failed: ${uploadError.message || JSON.stringify(uploadError)}`,
            );
          }

          const {
            data: { publicUrl },
          } = supabase.storage.from("schedules").getPublicUrl(filePath);

          const { data: document, error: dbError } = await supabase
            .from("files")
            .insert({
              id: uploadFile.id,
              content: uploadFile.file.name,
              url: publicUrl,
              status: "active",
              project_id: parseInt(projectId, 10),
              title: uploadFile.file.name,
              category: "schedule",
              metadata: {
                fileName: uploadFile.file.name,
                fileType: uploadFile.file.type || "application/octet-stream",
                fileSize: uploadFile.file.size,
              },
            })
            .select()
            .single();

          if (dbError) {
            throw new Error(
              `Database insert failed: ${dbError.message || JSON.stringify(dbError)}`,
            );
          }

          setUploadingFiles((prev) =>
            prev.map((f) =>
              f.id === uploadFile.id
                ? { ...f, status: "success" as const, documentId: document.id }
                : f,
            ),
          );

          setUploadedDocuments((prev) => [...prev, document as unknown as UploadedDocument]);
        } catch (err) {
          let errorMessage = "Upload failed";

          if (err && typeof err === "object" && "message" in err) {
            errorMessage = String(err.message);
          } else if (err instanceof Error) {
            errorMessage = err.message;
          } else if (typeof err === "string") {
            errorMessage = err;
          }

          setUploadingFiles((prev) =>
            prev.map((f) =>
              f.id === uploadFile.id
                ? {
                    ...f,
                    status: "error" as const,
                    error: errorMessage,
                  }
                : f,
            ),
          );
        }
      }
    },
    [projectId, supabase],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.ms-excel": [".xls", ".xlsx"],
      "application/vnd.ms-project": [".mpp"],
      "image/*": [".png", ".jpg", ".jpeg"],
    },
    maxSize: 50 * 1024 * 1024,
  });

  const removeFile = (fileId: string) => {
    setUploadingFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const deleteDocument = async (documentId: string) => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from("files")
        .delete()
        .eq("id", documentId);

      if (error) throw error;

      setUploadedDocuments((prev) => prev.filter((d) => d.id !== documentId));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete document",
      );
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ["B", "KB", "MB", "GB"];
    if (bytes === 0) return "0 B";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <p className="text-muted-foreground">
          Upload project schedules and timeline documents. You can add more
          schedule documents anytime after setup.
        </p>

        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
            transition-colors duration-200
            ${isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}
          `}
        >
          <input {...getInputProps()} />
          <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          {isDragActive ? (
            <p className="text-lg font-medium">Drop the files here...</p>
          ) : (
            <>
              <p className="text-lg font-medium mb-1">
                Drag & drop schedule files here, or click to select
              </p>
              <p className="text-sm text-muted-foreground">
                PDF, Excel, MS Project, Images (Max 50MB per file)
              </p>
            </>
          )}
        </div>

        {uploadingFiles.length > 0 && (
          <div className="space-y-2">
            {/* eslint-disable-next-line design-system/no-raw-heading */}
            <h4 className="font-medium">Uploading Files</h4>
            {uploadingFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-4 p-4 rounded-lg bg-muted"
              >
                <Calendar className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {file.file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.file.size)}
                  </p>
                  {file.status === "uploading" && (
                    <Progress value={file.progress} className="h-1 mt-1" />
                  )}
                  {file.error && (
                    <p className="text-xs text-destructive mt-1">
                      {file.error}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {file.status === "uploading" && (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  )}
                  {file.status === "success" && (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  )}
                  {file.status === "error" && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeFile(file.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {uploadedDocuments.length > 0 && (
          <div className="space-y-2">
            {/* eslint-disable-next-line design-system/no-raw-heading */}
            <h4 className="font-medium">Uploaded Schedules</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uploadedDocuments.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{doc.title}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatFileSize(doc.metadata.fileSize || 0)}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteDocument(doc.id)}
                        disabled={loading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onSkip} disabled={loading}>
          Skip for now
        </Button>
        <Button
          onClick={onNext}
          disabled={
            loading || uploadingFiles.some((f) => f.status === "uploading")
          }
        >
          {uploadingFiles.some((f) => f.status === "uploading")
            ? "Uploading..."
            : "Continue"}
        </Button>
      </div>
    </div>
  );
}
