"use client";

import { useEffect, useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";

import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/unified-modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { MyFeedbackItem } from "@/hooks/use-my-feedback";

interface EditFeedbackDialogProps {
  item: MyFeedbackItem | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (input: { signal?: "positive" | "negative"; note: string | null }) => void;
}

export function EditFeedbackDialog({
  item,
  isSaving,
  onClose,
  onSave,
}: EditFeedbackDialogProps) {
  const [signal, setSignal] = useState<"positive" | "negative">("positive");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!item) return;
    setSignal(item.signal === "negative" ? "negative" : "positive");
    setNote(item.note ?? "");
  }, [item]);

  const open = Boolean(item);

  return (
    <Modal open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <ModalContent className="sm:max-w-md">
        <ModalHeader>
          <ModalTitle>Change your feedback</ModalTitle>
          <ModalDescription className="truncate">
            {item?.itemTitle}
          </ModalDescription>
        </ModalHeader>

        {item?.canEditSignal ? (
          <div className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Rating
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSignal("positive")}
                className={cn(
                  "flex-1 gap-2",
                  signal === "positive"
                    ? "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <ThumbsUp className="h-4 w-4" /> Helpful
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSignal("negative")}
                className={cn(
                  "flex-1 gap-2",
                  signal === "negative"
                    ? "bg-destructive/10 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <ThumbsDown className="h-4 w-4" /> Not helpful
              </Button>
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Note
          </span>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Add or correct the reason for your feedback"
            rows={4}
          />
        </div>

        <ModalFooter>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onSave({
                signal: item?.canEditSignal ? signal : undefined,
                note: note.trim() || null,
              })
            }
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
