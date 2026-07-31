"use client";

import * as React from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  RotateCw,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ErrorState } from "@/components/ds";
import { FileUploadField } from "@/components/forms/FileUploadField";
import { RHFDateField } from "@/components/forms/fields/RHFDateField";

import {
  DrawingUploadBatchError,
  type DrawingPerFileUploadMetadata,
  useDrawingUpload,
} from "@/hooks/use-drawing-upload";
import { useDrawingSets } from "@/hooks/use-drawing-sets";
import {
  uploadDrawingFormSchema,
  type UploadDrawingFormData,
} from "@/lib/schemas/drawing-schemas";
import {
  DRAWING_MAX_UPLOAD_LABEL,
  getDrawingUploadFileError,
} from "@/lib/drawings/upload-constraints";
import { apiFetch } from "@/lib/api-client";
import {
  getDrawingUploadDetectedMetadata,
  type DrawingUploadDetectedMetadata,
} from "@/lib/drawings/drawing-identity";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import {
  DRAWING_DISCIPLINES,
  DRAWING_TYPES,
} from "@/types/drawings.types";


interface DrawingUploadDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete?: () => void;
  /** Files pre-populated from drag-and-drop on the page */
  initialFiles?: File[];
}

interface FileInfo {
  name: string;
  size: number;
  type: string;
  file: File;
  metadata: DrawingUploadDetectedMetadata;
  rotationDegrees: number;
}

function createFileInfo(file: File): FileInfo {
  return {
    name: file.name,
    size: file.size,
    type: file.type,
    file,
    metadata: getDrawingUploadDetectedMetadata(file.name),
    rotationDegrees: 0,
  };
}

function buildPerFileUploadMetadata(
  files: FileInfo[],
): Record<string, DrawingPerFileUploadMetadata> {
  return Object.fromEntries(
    files.map((fileInfo) => [
      fileInfo.name,
      {
        drawing_number: fileInfo.metadata.drawingNumber,
        title: fileInfo.metadata.title,
        revision_number: fileInfo.metadata.revisionNumber,
        discipline: fileInfo.metadata.discipline,
        rotation_degrees: fileInfo.rotationDegrees,
        ocr_confidence_label: fileInfo.metadata.confidence,
        ocr_confidence_score: fileInfo.metadata.confidenceScore,
        ocr_confidence_source: fileInfo.metadata.source,
      },
    ]),
  );
}

export function DrawingUploadDialog({
  projectId,
  open,
  onOpenChange,
  onUploadComplete,
  initialFiles,
}: DrawingUploadDialogProps) {
  const [selectedFiles, setSelectedFiles] = useState<FileInfo[]>([]);

  // When initialFiles are provided (from drag-and-drop), populate selectedFiles
  React.useEffect(() => {
    if (initialFiles && initialFiles.length > 0 && open) {
      setSelectedFiles(initialFiles.map(createFileInfo));
    }
  }, [initialFiles, open]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [newSetName, setNewSetName] = useState("");
  const [isSubmittingUpload, setIsSubmittingUpload] = useState(false);
  const [uploadPhase, setUploadPhase] = useState<"idle" | "preparing" | "creating-set" | "uploading" | "finalizing">("idle");
  const uploadInFlightRef = React.useRef(false);
  const queryClient = useQueryClient();

  const { data: sets = [] } = useDrawingSets(projectId);
  const {
    uploadMultipleDrawings,
    isUploading,
    progress,
    errors,
    clearUploadState,
  } = useDrawingUpload(projectId);
  const isBusy = isSubmittingUpload || isUploading;

  const form = useForm<UploadDrawingFormData>({
    resolver: zodResolver(uploadDrawingFormSchema),
    reValidateMode: "onBlur",
    defaultValues: {
      drawing_set_id: "",
      drawing_date: "",
      received_date: "",
    },
  });

  const handleFilesSelected = (files: File[]) => {
    const newFiles = files.map(createFileInfo);
    setSelectedFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const rotateFile = (index: number) => {
    setSelectedFiles((current) =>
      current.map((fileInfo, fileIndex) =>
        fileIndex === index
          ? {
              ...fileInfo,
              rotationDegrees: (fileInfo.rotationDegrees + 90) % 360,
            }
          : fileInfo,
      ),
    );
  };

  const updateFileMetadata = (
    index: number,
    field: keyof Pick<
      DrawingUploadDetectedMetadata,
      "drawingNumber" | "title" | "revisionNumber" | "discipline"
    >,
    value: string,
  ) => {
    setSelectedFiles((current) =>
      current.map((fileInfo, fileIndex) =>
        fileIndex === index
          ? {
              ...fileInfo,
              metadata: {
                ...fileInfo.metadata,
                [field]: value,
                confidence: "high",
                confidenceScore: 1,
                source: "manual",
              },
            }
          : fileInfo,
      ),
    );
  };

  const resolveSetId = async (rawSetId: string): Promise<string | null> => {
    if (rawSetId !== "__new__") return rawSetId;
    if (!newSetName.trim()) {
      toast.error("Please enter a name for the new drawing set");
      return null;
    }
    const trimmedSetName = newSetName.trim();
    const existingSet = sets.find(
      (set) => set.name.trim().toLowerCase() === trimmedSetName.toLowerCase(),
    );
    if (existingSet) {
      return existingSet.id;
    }
    try {
      const newSet = await apiFetch<{ id: string }>(`/api/projects/${projectId}/drawings/sets`, {
        method: "POST",
        body: JSON.stringify({ name: trimmedSetName, issued_at: new Date().toISOString() }),
      });
      queryClient.invalidateQueries({ queryKey: ["drawing-sets", projectId] });
      return newSet.id;
    } catch (error) {
      toast.error("Failed to create drawing set", {
        description: error instanceof Error ? error.message : "An unexpected error occurred",
      });
      return null;
    }
  };

  const handleUpload = async (data: UploadDrawingFormData) => {
    if (uploadInFlightRef.current) return;

    if (selectedFiles.length === 0) {
      toast.error("You must attach a file");
      return;
    }

    const invalidFiles = selectedFiles
      .map((fileInfo) => ({
        fileName: fileInfo.name,
        error: getDrawingUploadFileError(fileInfo.file),
      }))
      .filter((item): item is { fileName: string; error: string } => Boolean(item.error));

    if (invalidFiles.length > 0) {
      toast.error("Remove invalid drawing files", {
        description: invalidFiles
          .map((item) => `${item.fileName}: ${item.error}`)
          .join("; "),
      });
      return;
    }

    uploadInFlightRef.current = true;
    setIsSubmittingUpload(true);
    setUploadPhase("preparing");
    clearUploadState();

    try {
      setUploadPhase(data.drawing_set_id === "__new__" ? "creating-set" : "preparing");
      const setId = await resolveSetId(data.drawing_set_id);
      if (setId === null) return;

      const uploadData = { ...data, drawing_set_id: setId };
      if (data.drawing_set_id === "__new__") {
        form.setValue("drawing_set_id", setId, {
          shouldDirty: true,
          shouldValidate: true,
        });
        setNewSetName("");
      }
      setUploadPhase("uploading");

      if (selectedFiles.length === 1) {
        const selectedFile = selectedFiles[0];
        const file = selectedFile.file;
        const fileMetadata = selectedFile.metadata;

        try {
          const signedUpload = await apiFetch<{ path: string; token: string }>(
            `/api/projects/${projectId}/drawings/upload-url`,
            {
              method: "POST",
              body: JSON.stringify({
                file_name: file.name,
                file_size: file.size,
                file_type: file.type,
              }),
            },
          );

          const supabase = createSupabaseClient();
          const { error: directUploadError } = await supabase.storage
            .from("project-files")
            .uploadToSignedUrl(signedUpload.path, signedUpload.token, file, {
              contentType: file.type,
              upsert: false,
            });
          if (directUploadError) {
            throw new Error(`Failed to upload file to storage: ${directUploadError.message}`);
          }

          await apiFetch(`/api/projects/${projectId}/drawings`, {
            method: "POST",
            body: JSON.stringify({
              drawing_number:
                uploadData.drawing_number || fileMetadata.drawingNumber,
              title: uploadData.title || fileMetadata.title,
              discipline: uploadData.discipline || fileMetadata.discipline,
              drawing_type: uploadData.drawing_type,
              revision_number:
                uploadData.revision_number || fileMetadata.revisionNumber,
              drawing_date: uploadData.drawing_date,
              received_date: uploadData.received_date || new Date().toISOString(),
              drawing_set_id: uploadData.drawing_set_id,
              description: uploadData.description,
              area_id: uploadData.area_id,
              rotation_degrees: selectedFile.rotationDegrees,
              ocr_confidence_label: fileMetadata.confidence,
              ocr_confidence_score: fileMetadata.confidenceScore,
              ocr_confidence_source: fileMetadata.source,
              upload_path: signedUpload.path,
              file_name: file.name,
              file_size: file.size,
              file_type: file.type,
            }),
          });
          queryClient.invalidateQueries({ queryKey: ["drawings", projectId] });
        } catch (error) {
          toast.error("Upload failed", {
            description: error instanceof Error ? error.message : "An unexpected error occurred",
          });
          return;
        }
      } else {
        const fileList = new DataTransfer();
        selectedFiles.forEach((fileInfo) => fileList.items.add(fileInfo.file));
        try {
          await uploadMultipleDrawings(
            fileList.files,
            uploadData,
            buildPerFileUploadMetadata(selectedFiles),
          );
        } catch (error) {
          if (error instanceof DrawingUploadBatchError) {
            const uploadedCount = error.results.length;
            const failedFileNames = new Set(error.failures.map((failure) => failure.fileName));
            setSelectedFiles((currentFiles) =>
              currentFiles.filter((fileInfo) => failedFileNames.has(fileInfo.name)),
            );
            queryClient.invalidateQueries({ queryKey: ["drawings", projectId] });
            if (uploadedCount > 0) {
              toast.success(`Uploaded ${uploadedCount} of ${selectedFiles.length} drawings`);
            }
            return;
          }

          throw error;
        }
      }

      setUploadPhase("finalizing");
      toast.success(
        `Successfully uploaded ${selectedFiles.length} drawing${selectedFiles.length > 1 ? "s" : ""}`
      );

      handleClose(true);
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error("Upload failed", {
        description:
          error instanceof Error ? error.message : "An unexpected error occurred",
      });
    } finally {
      uploadInFlightRef.current = false;
      setIsSubmittingUpload(false);
      setUploadPhase("idle");
    }
  };

  const handleClose = (force = false) => {
    if (isBusy && !force) return;
    form.reset();
    setSelectedFiles([]);
    setShowAdvanced(false);
    setUploadPhase("idle");
    clearUploadState();
    onOpenChange(false);
    onUploadComplete?.();
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isBusy) return;
    onOpenChange(nextOpen);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const completedUploadCount = progress.filter((item) => item.status === "completed").length;
  const failedUploadCount = progress.filter((item) => item.status === "error").length;
  const activeUpload = progress.find((item) => item.status === "uploading" || item.status === "processing");
  const totalUploadCount = selectedFiles.length;
  const finishedUploadCount = completedUploadCount + failedUploadCount;
  const batchProgressValue =
    totalUploadCount > 1
      ? Math.round((finishedUploadCount / totalUploadCount) * 100)
      : uploadPhase === "finalizing"
        ? 95
        : uploadPhase === "uploading"
          ? 60
          : uploadPhase === "creating-set"
            ? 25
            : isSubmittingUpload
              ? 10
              : 0;
  const progressLabel =
    totalUploadCount > 1
      ? `${finishedUploadCount} of ${totalUploadCount} drawings processed`
      : uploadPhase === "creating-set"
        ? "Creating drawing set"
        : uploadPhase === "finalizing"
          ? "Finalizing upload"
          : "Uploading drawing";
  const progressDetail =
    activeUpload?.fileName ??
    (failedUploadCount > 0
      ? `${failedUploadCount} failed, ${completedUploadCount} completed`
      : "Keep this dialog open while drawings are processed.");
  const uploadErrorSummary = errors
    .map((error) => `${error.fileName}: ${error.error}`)
    .join("; ");
  const selectedFileErrors = selectedFiles
    .map((fileInfo, index) => ({
      index,
      error: getDrawingUploadFileError(fileInfo.file),
    }))
    .filter((item): item is { index: number; error: string } => Boolean(item.error));
  const hasSelectedFileErrors = selectedFileErrors.length > 0;
  const selectedFileErrorSummary = selectedFileErrors
    .map((item) => `${selectedFiles[item.index].name}: ${item.error}`)
    .join("; ");
  const submitLabel =
    errors.length > 0 && selectedFiles.length > 0
      ? `Retry failed ${selectedFiles.length === 1 ? "drawing" : "drawings"}`
      : "Process";

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-h-dvh overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Upload Drawings</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleUpload)} className="space-y-6">
            {/* File Upload */}
            <FileUploadField
              accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif"
              multiple
              maxSize={0}
              onFilesSelected={handleFilesSelected}
              hint={`Max ${DRAWING_MAX_UPLOAD_LABEL} per file, or drag and drop`}
              required
              disabled={isBusy}
            />

            {/* Selected Files */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                {selectedFiles.map((file, index) => {
                  const fileError = getDrawingUploadFileError(file.file);
                  return (
                  <div
                    key={index}
                    className={`flex items-center justify-between rounded-md p-3 ${
                      fileError
                        ? "border border-destructive/30 bg-destructive/5"
                        : "bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {fileError ? (
                        <AlertCircle className="h-4 w-4 flex-shrink-0 text-destructive" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(file.size)}
                          </p>
                          <Badge variant="secondary" className="text-xs">
                            {file.type.split("/")[1]?.toUpperCase()}
                          </Badge>
                          <Badge
                            variant={
                              file.metadata.confidence === "low"
                                ? "outline"
                                : "secondary"
                            }
                            className="text-xs"
                          >
                            {file.metadata.source} {file.metadata.confidence}
                          </Badge>
                        </div>
                        {fileError ? (
                          <p className="mt-1 text-xs text-destructive">{fileError}</p>
                        ) : null}
                        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                          <div className="space-y-1">
                            <label
                              htmlFor={`drawing-number-${index}`}
                              className="text-[11px] font-medium text-muted-foreground"
                            >
                              #
                            </label>
                            <Input
                              id={`drawing-number-${index}`}
                              aria-label={`${file.name} drawing number`}
                              value={file.metadata.drawingNumber}
                              onChange={(event) =>
                                updateFileMetadata(
                                  index,
                                  "drawingNumber",
                                  event.target.value,
                                )
                              }
                              disabled={isBusy}
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="space-y-1 md:col-span-2">
                            <label
                              htmlFor={`drawing-title-${index}`}
                              className="text-[11px] font-medium text-muted-foreground"
                            >
                              Title
                            </label>
                            <Input
                              id={`drawing-title-${index}`}
                              aria-label={`${file.name} title`}
                              value={file.metadata.title}
                              onChange={(event) =>
                                updateFileMetadata(
                                  index,
                                  "title",
                                  event.target.value,
                                )
                              }
                              disabled={isBusy}
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2 md:col-span-1">
                            <div className="space-y-1">
                              <label
                                htmlFor={`drawing-revision-${index}`}
                                className="text-[11px] font-medium text-muted-foreground"
                              >
                                Rev
                              </label>
                              <Input
                                id={`drawing-revision-${index}`}
                                aria-label={`${file.name} revision`}
                                value={file.metadata.revisionNumber}
                                onChange={(event) =>
                                  updateFileMetadata(
                                    index,
                                    "revisionNumber",
                                    event.target.value,
                                  )
                                }
                                disabled={isBusy}
                                className="h-8 text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <label
                                htmlFor={`drawing-discipline-${index}`}
                                className="text-[11px] font-medium text-muted-foreground"
                              >
                                Disc.
                              </label>
                              <Input
                                id={`drawing-discipline-${index}`}
                                aria-label={`${file.name} discipline`}
                                value={file.metadata.discipline}
                                onChange={(event) =>
                                  updateFileMetadata(
                                    index,
                                    "discipline",
                                    event.target.value,
                                  )
                                }
                                disabled={isBusy}
                                className="h-8 text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    {!isBusy && (
                      <div className="flex shrink-0 items-center gap-1 self-start">
                        {file.rotationDegrees !== 0 ? (
                          <Badge variant="outline" className="h-7 px-2 text-xs">
                            {file.rotationDegrees}°
                          </Badge>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => rotateFile(index)}
                          aria-label={`Rotate ${file.name}`}
                          title={`Rotate ${file.name}`}
                          className="h-8 w-8 text-muted-foreground"
                        >
                          <RotateCw className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFile(index)}
                          aria-label={`Remove ${file.name}`}
                          title={`Remove ${file.name}`}
                          className="h-8 w-8 text-muted-foreground"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
            )}

            {hasSelectedFileErrors ? (
              <ErrorState
                title="Some drawings cannot be uploaded"
                error={selectedFileErrorSummary}
                className="items-start rounded-md border border-destructive/20 bg-destructive/5 px-3 py-3 text-left [&>div:first-child]:hidden [&_p]:max-w-none"
              />
            ) : null}

            {/* Drawing Set */}
            <FormField
              control={form.control}
              name="drawing_set_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Drawing Set <span className="text-destructive">*</span>
                  </FormLabel>
                  <p className="text-sm text-muted-foreground -mt-1">
                    Group and label drawings into a collection as they are issued to keep them organized.
                  </p>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isBusy}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select or Create set" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {sets.map((set) => (
                        <SelectItem key={set.id} value={set.id}>
                          {set.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="__new__">+ Create new set...</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* New set name input when "Create new set" is selected */}
            {form.watch("drawing_set_id") === "__new__" && (
              <FormItem>
                <FormLabel>New Set Name</FormLabel>
                <Input
                  value={newSetName}
                  onChange={(e) => setNewSetName(e.target.value)}
                  placeholder="e.g. IFC Set 01 - 2024"
                  disabled={isBusy}
                />
              </FormItem>
            )}

            {/* Dates */}
            <div className="grid grid-cols-2 gap-6">
              <RHFDateField
                control={form.control}
                name="drawing_date"
                label="Default Drawing Date"
                disabled={isBusy}
                placeholder="Pick drawing date"
              />

              <RHFDateField
                control={form.control}
                name="received_date"
                label="Default Received Date"
                disabled={isBusy}
                placeholder="Pick received date"
              />
            </div>

            {/* Advanced Options */}
            <div className="border-t pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowAdvanced((v) => !v)}
                className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 px-0"
              >
                {showAdvanced ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                Advanced Options
              </Button>

              {showAdvanced && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="drawing_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Drawing Number</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="A-101" disabled={isBusy} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="revision_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Revision</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="A" disabled={isBusy} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="First Floor Plan"
                            disabled={isBusy}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="discipline"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Discipline</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={isBusy}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select discipline" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {DRAWING_DISCIPLINES.map((d) => (
                              <SelectItem key={d} value={d}>
                                {d}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="drawing_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={isBusy}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {DRAWING_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Additional notes about this drawing..."
                            rows={3}
                            disabled={isBusy}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>

            {(isSubmittingUpload || progress.length > 0) && (
              <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium text-foreground">{progressLabel}</p>
                    <p className="truncate text-xs text-muted-foreground">{progressDetail}</p>
                  </div>
                  {isSubmittingUpload ? (
                    <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
                  ) : failedUploadCount > 0 ? (
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  )}
                </div>
                <Progress value={batchProgressValue} className="h-1.5" />
              </div>
            )}

            {/* Errors */}
            {errors.length > 0 && (
              <ErrorState
                title="Some drawings did not upload"
                error={uploadErrorSummary}
                className="items-start rounded-md border border-destructive/20 bg-destructive/5 px-3 py-3 text-left [&>div:first-child]:hidden [&_p]:max-w-none"
              />
            )}

            {/* Validation hint */}
            {selectedFiles.length === 0 && form.formState.isSubmitted && (
              <p className="text-sm text-destructive">You must attach a file</p>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t">
              <p className="text-xs text-muted-foreground">* Required fields</p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleClose()}
                  disabled={isBusy}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isBusy || selectedFiles.length === 0 || hasSelectedFileErrors}
                >
                  {isBusy ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    submitLabel
                  )}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
