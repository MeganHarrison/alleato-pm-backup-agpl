"use client";

import * as React from "react";
import { Tag } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/unified-modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api-client";
import { DetailPropertyItem } from "@/components/ui/detail-property-bar";
import { MEETING_CATEGORY_OPTIONS } from "@/lib/meetings/domain";

/** Categories already in use across meetings — offered as quick-fill suggestions. */
const CATEGORY_SUGGESTIONS = [
  "Internal",
  "Weekly Exec",
  "Weekly Ops",
  "Ops Update",
  "Interview",
  "Job Planner",
  ...MEETING_CATEGORY_OPTIONS,
];

interface MeetingCategoryControlProps {
  meetingId: string;
  meetingTitle: string;
  initialCategory: string | null;
}

export function MeetingCategoryControl({
  meetingId,
  meetingTitle,
  initialCategory,
}: MeetingCategoryControlProps) {
  const [category, setCategory] = React.useState(initialCategory ?? "");

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [draftCategory, setDraftCategory] = React.useState(category);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    setCategory(initialCategory ?? "");
  }, [meetingId, initialCategory]);

  function openDialog() {
    setDraftCategory(category);
    setDialogOpen(true);
  }

  async function handleSave() {
    const nextCategory = draftCategory.trim();
    setIsSaving(true);
    try {
      await apiFetch(`/api/documents/${meetingId}/assign-project`, {
        method: "PATCH",
        body: JSON.stringify({ category: nextCategory || null }),
      });
      setCategory(nextCategory);
      setDialogOpen(false);
      toast.success(nextCategory ? "Category updated" : "Category removed");
    } catch {
      toast.error("Failed to update category");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      {category ? (
        <DetailPropertyItem
          icon={Tag}
          onClick={openDialog}
          aria-label="Edit category"
        >
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            {category}
          </span>
        </DetailPropertyItem>
      ) : (
        <DetailPropertyItem
          icon={Tag}
          onClick={openDialog}
          muted
          aria-label="Add meeting category"
        >
          Add category
        </DetailPropertyItem>
      )}

      <Modal open={dialogOpen} onOpenChange={setDialogOpen}>
        <ModalContent size="md">
          <ModalHeader>
            <ModalTitle>Category</ModalTitle>
            <ModalDescription>{meetingTitle}</ModalDescription>
          </ModalHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="meeting-category">Category</Label>
            <Input
              id="meeting-category"
              value={draftCategory}
              onChange={(event) => setDraftCategory(event.target.value)}
              placeholder="e.g. Weekly Ops"
              maxLength={100}
              disabled={isSaving}
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {CATEGORY_SUGGESTIONS.map((suggestion) => (
                <Button
                  key={suggestion}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDraftCategory(suggestion)}
                  disabled={isSaving}
                  className={`inline-flex h-auto items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                    draftCategory === suggestion
                      ? "bg-primary/10 text-primary hover:bg-primary/10"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
