"use client";

import * as React from "react";
import { Loader2, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EditModeActionsProps {
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void | Promise<void>;
  onCancel: () => void;
  isSaving?: boolean;
  editLabel?: string;
  saveLabel?: string;
  cancelLabel?: string;
  className?: string;
}

/**
 * EditModeActions — view/edit toggle with save/cancel states.
 *
 * In view mode: shows an "Edit" button.
 * In edit mode: shows "Cancel" (ghost) and "Save" (primary) buttons.
 *
 * Usage:
 *   <EditModeActions
 *     isEditing={editing}
 *     onEdit={() => setEditing(true)}
 *     onSave={handleSave}
 *     onCancel={() => setEditing(false)}
 *     isSaving={isSaving}
 *   />
 */
export function EditModeActions({
  isEditing,
  onEdit,
  onSave,
  onCancel,
  isSaving = false,
  editLabel = "Edit",
  saveLabel = "Save",
  cancelLabel = "Cancel",
  className,
}: EditModeActionsProps) {
  if (!isEditing) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onEdit}
        className={cn("gap-1.5", className)}
      >
        <Pencil className="h-3.5 w-3.5" />
        {editLabel}
      </Button>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onCancel}
        disabled={isSaving}
        className="gap-1.5 text-muted-foreground"
      >
        <X className="h-3.5 w-3.5" />
        {cancelLabel}
      </Button>
      <Button
        type="button"
        size="sm"
        onClick={onSave}
        disabled={isSaving}
        className="gap-1.5"
      >
        {isSaving ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Saving…
          </>
        ) : (
          saveLabel
        )}
      </Button>
    </div>
  );
}
