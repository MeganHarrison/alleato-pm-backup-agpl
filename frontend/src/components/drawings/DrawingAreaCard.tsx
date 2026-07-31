"use client";

import React, { useState } from "react";
import { Edit2, Trash2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { drawingAreaSchema, type DrawingAreaFormData, type DrawingAreaWithCount } from "@/types/drawings.types";
import { toast } from "sonner";

interface DrawingAreaCardProps {
  area?: DrawingAreaWithCount;
  parentArea?: DrawingAreaWithCount;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: DrawingAreaFormData) => Promise<void>;
  onDelete?: () => Promise<void>;
}

export function DrawingAreaCard({
  area,
  parentArea,
  isOpen,
  onClose,
  onSave,
  onDelete,
}: DrawingAreaCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const isEditing = Boolean(area);

  const form = useForm<DrawingAreaFormData>({
    resolver: zodResolver(drawingAreaSchema),
    reValidateMode: "onBlur",
    defaultValues: {
      name: area?.name || "",
      description: area?.description || "",
      parentAreaId: parentArea?.id,
      sortOrder: area?.sort_order ?? 0,
    },
  });

  const handleSubmit = async (data: DrawingAreaFormData) => {
    try {
      setIsLoading(true);
      await onSave(data);
      toast.success(`Area ${isEditing ? "updated" : "created"} successfully`);
      onClose();
    } catch (error) {
      toast.error(`Failed to ${isEditing ? "update" : "create"} area`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;

    try {
      setIsLoading(true);
      await onDelete();
      toast.success("Area deleted successfully");
      setShowDeleteDialog(false);
      onClose();
    } catch (error) {
      toast.error("Failed to delete area");
      setShowDeleteDialog(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit Drawing Area" : "Create Drawing Area"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-muted-foreground mb-1">
                Name *
              </label>
              <Input
                id="name"
                {...form.register("name")}
                placeholder="e.g., Architectural Plans"
                disabled={isLoading}
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-muted-foreground mb-1">
                Description
              </label>
              <Textarea
                id="description"
                {...form.register("description")}
                placeholder="Optional description for this area"
                rows={3}
                disabled={isLoading}
              />
              {form.formState.errors.description && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.description.message}
                </p>
              )}
            </div>

            {parentArea && (
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Parent Area
                </label>
                <div className="p-2 bg-muted rounded-md text-sm text-muted-foreground">
                  {parentArea.name}
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              {isEditing && onDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={isLoading}
                  className="mr-auto"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
              
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    {isEditing ? "Updating..." : "Creating..."}
                  </>
                ) : (
                  <>
                    <Save />
                    {isEditing ? "Update" : "Create"}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Drawing Area</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{area?.name}"? This action cannot be undone.
              {area?.drawing_count != null && area.drawing_count > 0 && (
                <span className="block mt-2 text-destructive font-medium">
                  This area contains {area.drawing_count} drawings and cannot be deleted.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isLoading || (area?.drawing_count != null && area.drawing_count > 0)}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isLoading ? "Deleting..." : "Delete Area"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
