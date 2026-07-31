"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/unified-modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api-client";
import { handleFormError } from "@/lib/handle-form-error";
import { toast } from "sonner";
import type { ProjectEmail } from "@/hooks/use-emails";
import {
  EMAIL_IMPORTANCE_REASON_LABELS,
  type EmailImportanceFeedbackState,
  type EmailImportanceReasonCategory,
  type EmailImportanceSignal,
} from "@/lib/ai/email-importance-feedback-types";

const IMPORTANT_REASON_OPTIONS: EmailImportanceReasonCategory[] = [
  "client_deadline",
  "decision_needed",
  "financial_risk",
  "project_blocker",
  "executive_visibility",
  "follow_up_required",
  "other",
];

const NOT_IMPORTANT_REASON_OPTIONS: EmailImportanceReasonCategory[] = [
  "informational_only",
  "automated_notification",
  "marketing_noise",
  "duplicate_update",
  "routine_internal",
  "other",
];

interface EmailImportanceFeedbackDialogProps {
  email: ProjectEmail | null;
  open: boolean;
  signal: EmailImportanceSignal | null;
  existingFeedback?: EmailImportanceFeedbackState | null;
  onOpenChange: (open: boolean) => void;
  onRecorded: (
    emailId: number,
    feedback: EmailImportanceFeedbackState,
  ) => Promise<void> | void;
}

export function buildEmailImportanceSnapshot(email: ProjectEmail) {
  return {
    id: email.id,
    projectId: email.project_id,
    subject: email.subject,
    fromName: email.from_name,
    fromEmail: email.from_email,
    toList: email.to_list,
    status: email.status,
    receivedAt: email.received_at,
    sentAt: email.sent_at,
    hasAttachments: email.has_attachments,
    project: email.project
      ? {
          id: email.project.id,
          name: email.project.name,
          projectNumber: email.project.project_number,
        }
      : null,
  };
}

export function EmailImportanceFeedbackDialog({
  email,
  open,
  signal,
  existingFeedback,
  onOpenChange,
  onRecorded,
}: EmailImportanceFeedbackDialogProps) {
  const [reasonCategory, setReasonCategory] =
    React.useState<EmailImportanceReasonCategory>("other");
  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open || !signal) return;
    const options =
      signal === "important"
        ? IMPORTANT_REASON_OPTIONS
        : NOT_IMPORTANT_REASON_OPTIONS;
    const defaultReason =
      existingFeedback?.signal === signal && existingFeedback.reasonCategory
        ? existingFeedback.reasonCategory
        : options[0];

    setReasonCategory(defaultReason);
    setReason(
      existingFeedback?.signal === signal ? existingFeedback.reason ?? "" : "",
    );
  }, [existingFeedback, open, signal]);

  if (!email || !signal) return null;

  const reasonOptions =
    signal === "important"
      ? IMPORTANT_REASON_OPTIONS
      : NOT_IMPORTANT_REASON_OPTIONS;

  const signalLabel =
    signal === "important" ? "Mark important" : "Mark not important";
  const isEditingExisting = existingFeedback?.signal === signal;
  const submitLabel = isEditingExisting ? "Save reason" : signalLabel;
  const description =
    signal === "not_important"
      ? "Not important emails leave the default view. Use filters to show them again."
      : "Important emails stay in the default view and train future ranking.";

  const handleSubmit = async () => {
    if (submitting) return;

    setSubmitting(true);
    try {
      await apiFetch("/api/ai-assistant/email-importance-feedback", {
        method: "POST",
        body: JSON.stringify({
          emailId: email.id,
          projectId: email.project_id,
          signal,
          reasonCategory,
          reason: reason.trim() || null,
          emailSnapshot: buildEmailImportanceSnapshot(email),
        }),
      });

      await onRecorded(email.id, {
        signal,
        reasonCategory,
        reason: reason.trim() || null,
        createdAt: new Date().toISOString(),
      });
      toast.success(
        signal === "not_important"
          ? "Marked not important. It is hidden from the default view."
          : "Marked important.",
      );
      onOpenChange(false);
    } catch (error) {
      handleFormError(error, { entity: "email feedback", action: "create" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent size="md">
        <ModalHeader>
          <ModalTitle>{isEditingExisting ? "Edit feedback" : signalLabel}</ModalTitle>
          <ModalDescription>{description}</ModalDescription>
        </ModalHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-md bg-muted/40 p-3 text-sm">
            <div className="font-medium">{email.subject || "(no subject)"}</div>
            <div className="text-muted-foreground">
              {email.from_name || email.from_email || "Unknown sender"}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Why?</Label>
            <Select
              value={reasonCategory}
              onValueChange={(value) =>
                setReasonCategory(value as EmailImportanceReasonCategory)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {reasonOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {EMAIL_IMPORTANCE_REASON_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-importance-note">Optional note</Label>
            <Textarea
              id="email-importance-note"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Add context the ranking model should learn from..."
              rows={4}
            />
          </div>
        </div>

        <ModalFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Saving..." : submitLabel}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
