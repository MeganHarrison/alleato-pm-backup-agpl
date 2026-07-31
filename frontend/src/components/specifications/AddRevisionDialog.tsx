"use client";

import * as React from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Upload, X, FileText } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

import { useAddRevision } from "@/hooks/use-specification-revisions";
import {
  addRevisionSchema,
  type AddRevisionFormData,
} from "@/lib/schemas/specification-schemas";

interface AddRevisionDialogProps {
  projectId: string;
  sectionId: string;
  children?: React.ReactNode;
  onRevisionAdded?: () => void;
}

export function AddRevisionDialog({
  projectId,
  sectionId,
  children,
  onRevisionAdded,
}: AddRevisionDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const addRevisionMutation = useAddRevision(projectId, sectionId);

  const form = useForm<AddRevisionFormData>({
    resolver: zodResolver(addRevisionSchema),
    reValidateMode: "onBlur",
    defaultValues: {
      notes: "",
      notify_subscribers: true,
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > 50 * 1024 * 1024) {
      form.setError("file", {
        type: "manual",
        message: "File must be under 50MB",
      });
      return;
    }

    setSelectedFile(file);
    form.setValue("file", file);
    form.clearErrors("file");

    // Create preview URL
    // CRITICAL: URL.createObjectURL creates memory leak if not revoked
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const removeFile = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    form.setValue("file", undefined as any);
  };

  const handleSubmit = async (data: AddRevisionFormData) => {
    try {
      await addRevisionMutation.mutateAsync(data);

      // Cleanup
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      form.reset();
      setSelectedFile(null);
      setPreviewUrl(null);
      setOpen(false);
      onRevisionAdded?.();
    } catch (error) {
      // Error already handled by mutation
      console.error("Add revision failed:", error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline">
            <Upload />
            Add Revision
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add New Revision</DialogTitle>
          <DialogDescription>
            Upload a new revision of this specification. The revision number will be
            automatically incremented.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* File Upload */}
            <FormField
              control={form.control}
              name="file"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>File *</FormLabel>
                  <FormControl>
                    <div className="space-y-4">
                      {!selectedFile ? (
                        <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-border transition-colors">
                          <input
                            type="file"
                            accept="*/*"
                            onChange={handleFileChange}
                            className="hidden"
                            id="revision-file-upload"
                          />
                          <label
                            htmlFor="revision-file-upload"
                            className="cursor-pointer flex flex-col items-center space-y-2"
                          >
                            <Upload className="h-12 w-12 text-muted-foreground" />
                            <div className="text-sm text-muted-foreground">
                              <span className="font-medium text-primary hover:text-primary/80">
                                Click to upload
                              </span>{" "}
                              or drag and drop
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Any file type (max 50MB)
                            </p>
                          </label>
                        </div>
                      ) : (
                        <div className="border border-border rounded-lg p-4 flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <FileText className="h-8 w-8 text-red-500" />
                            <div>
                              <p className="text-sm font-medium">{selectedFile.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatFileSize(selectedFile.size)}
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={removeFile}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Revision Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="What changed in this revision..."
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Describe the changes made in this revision
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notify Subscribers */}
            <FormField
              control={form.control}
              name="notify_subscribers"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-4 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Notify subscribers</FormLabel>
                    <FormDescription>
                      Send notification to all users subscribed to this specification
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            {/* Actions */}
            <div className="flex justify-end space-x-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={addRevisionMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addRevisionMutation.isPending || !selectedFile}
              >
                {addRevisionMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Add Revision
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
