"use client";

import { useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from "@/components/ui/unified-modal";

interface ChangeEventEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  changeEventTitle: string;
  changeEventNumber: string | number;
  projectId: number;
  changeEventId: string;
}

export function ChangeEventEmailDialog({
  open,
  onOpenChange,
  changeEventTitle,
  changeEventNumber,
  projectId,
  changeEventId,
}: ChangeEventEmailDialogProps) {
  const [recipients, setRecipients] = useState("");
  const [subject, setSubject] = useState(
    `Change Event #${changeEventNumber}: ${changeEventTitle}`
  );
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  function handleClose() {
    if (!isSending) {
      onOpenChange(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const recipientList = recipients
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);

    if (recipientList.length === 0) {
      toast.error("Please enter at least one recipient email address.");
      return;
    }

    if (!subject.trim()) {
      toast.error("Please enter a subject.");
      return;
    }

    setIsSending(true);
    try {
      await apiFetch(
        `/api/projects/${projectId}/change-events/${changeEventId}/email`,
        {
          method: "POST",
          body: JSON.stringify({
            recipients: recipientList,
            subject: subject.trim(),
            message: message.trim() || undefined,
          }),
        }
      );

      toast.success(`Email sent to ${recipientList.join(", ")}`);
      onOpenChange(false);
      setRecipients("");
      setMessage("");
    } catch (error) {
      toast.error("Failed to send email. Please try again.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={handleClose}>
      <ModalContent size="lg">
        <ModalHeader>
          <ModalTitle>Email Change Event</ModalTitle>
          <ModalDescription>
            Send change event #{changeEventNumber} as a PDF attachment.
          </ModalDescription>
        </ModalHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ce-email-recipients">
              Recipients <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ce-email-recipients"
              type="text"
              placeholder="email@example.com, another@example.com"
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              disabled={isSending}
              required
            />
            <p className="text-xs text-muted-foreground">
              Separate multiple email addresses with commas.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ce-email-subject">
              Subject <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ce-email-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={isSending}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ce-email-message">Message (optional)</Label>
            <textarea
              id="ce-email-message"
              rows={4}
              placeholder="Add a personal message to include in the email body..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={isSending}
              className="w-full rounded-md border border-input bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-input disabled:opacity-50 disabled:cursor-not-allowed resize-none"
            />
          </div>

          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSending}>
              {isSending ? "Sending..." : "Send Email"}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
