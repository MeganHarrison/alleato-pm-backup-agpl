"use client";

import * as React from "react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { apiFetch } from "@/lib/api-client";
import { handleFormError } from "@/lib/handle-form-error";
import type { ProjectEmail } from "@/hooks/use-emails";

interface CreatedRule {
  id: string;
  action: string;
  label: string | null;
}

type MatchMode = "sender_exact" | "sender_domain" | "subject_contains";

export interface MarkAsJunkDialogProps {
  email: ProjectEmail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRuleCreated?: (email: ProjectEmail) => void;
}

function senderDomain(email: ProjectEmail): string {
  const addr = (email.from_email ?? "").trim().toLowerCase();
  if (!addr.includes("@")) return "";
  return addr.split("@", 2)[1] ?? "";
}

/**
 * "Mark as junk" creates a user-trained filter rule from a flagged email.
 *
 * Three match modes the admin can choose between, from most to least specific:
 *  - sender_exact: filter only this sender address (e.g. receipts@stripe.com)
 *  - sender_domain: filter every email from this domain (e.g. *@stripe.com)
 *  - subject_contains: filter on a subject substring (e.g. "%receipt%")
 *
 * The rule is POSTed to /api/email-filter-rules. The sync loop picks up
 * active rules on its next run.
 */
export function MarkAsJunkDialog({
  email,
  open,
  onOpenChange,
  onRuleCreated,
}: MarkAsJunkDialogProps) {
  const [mode, setMode] = React.useState<MatchMode>("sender_domain");
  const [subjectPattern, setSubjectPattern] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  // Reset state when the dialog opens for a new email.
  React.useEffect(() => {
    if (open && email) {
      setMode(senderDomain(email) ? "sender_domain" : "subject_contains");
      const subject = (email.subject ?? "").trim();
      // Suggest a sensible default: the first 3 meaningful words.
      const suggestion = subject
        .split(/\s+/)
        .filter((w) => w.length > 2)
        .slice(0, 3)
        .join(" ");
      setSubjectPattern(suggestion);
    }
  }, [open, email]);

  if (!email) return null;

  const domain = senderDomain(email);
  const sender = (email.from_email ?? "").trim().toLowerCase();

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        action: "skip",
        sourceMessageId: String(email.id),
        sourceSubject: email.subject ?? null,
      };

      if (mode === "sender_exact") {
        if (!sender) {
          toast.error("This email has no sender address to match on.");
          setSubmitting(false);
          return;
        }
        payload.senderPattern = sender;
        payload.label = `Skip mail from ${sender}`;
      } else if (mode === "sender_domain") {
        if (!domain) {
          toast.error("This email has no sender domain to match on.");
          setSubmitting(false);
          return;
        }
        payload.senderDomain = domain;
        payload.label = `Skip mail from @${domain}`;
      } else {
        const trimmed = subjectPattern.trim();
        if (trimmed.length < 2) {
          toast.error("Enter at least 2 characters to match on.");
          setSubmitting(false);
          return;
        }
        payload.subjectPattern = `%${trimmed}%`;
        payload.label = `Skip subjects containing "${trimmed}"`;
      }

      // apiFetch throws on non-2xx, so no need to inspect status.
      await apiFetch<CreatedRule>("/api/email-filter-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      toast.success("Rule created. Future emails matching this pattern will be skipped.");
      onRuleCreated?.(email);
      onOpenChange(false);
    } catch (err) {
      handleFormError(err, { entity: "email filter rule", action: "create" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Mark as junk</ModalTitle>
          <ModalDescription>
            Future emails that match this rule will be filtered out at sync
            time. This won&apos;t affect what&apos;s already in your mailbox.
          </ModalDescription>
        </ModalHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-md bg-muted/40 p-3 text-sm">
            <div className="font-medium">{email.subject || "(no subject)"}</div>
            <div className="text-muted-foreground">
              {email.from_name || email.from_email || "Unknown sender"}
              {email.from_email && email.from_name ? ` <${email.from_email}>` : ""}
            </div>
          </div>

          <RadioGroup
            value={mode}
            onValueChange={(v) => setMode(v as MatchMode)}
            className="space-y-3"
          >
            <div className="flex items-start gap-3">
              <RadioGroupItem
                value="sender_exact"
                id="junk-sender-exact"
                disabled={!sender}
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <Label htmlFor="junk-sender-exact" className="font-normal">
                  Only this sender
                </Label>
                <p className="text-xs text-muted-foreground">
                  {sender || "(no sender address)"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <RadioGroupItem
                value="sender_domain"
                id="junk-sender-domain"
                disabled={!domain}
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <Label htmlFor="junk-sender-domain" className="font-normal">
                  Anyone at this domain
                </Label>
                <p className="text-xs text-muted-foreground">
                  {domain ? `*@${domain}` : "(no domain)"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <RadioGroupItem
                value="subject_contains"
                id="junk-subject"
                className="mt-0.5"
              />
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="junk-subject" className="font-normal">
                  Subjects containing
                </Label>
                <Input
                  value={subjectPattern}
                  onChange={(e) => setSubjectPattern(e.target.value)}
                  onFocus={() => setMode("subject_contains")}
                  placeholder='e.g. "receipt"'
                  className="h-8"
                />
              </div>
            </div>
          </RadioGroup>
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
            {submitting ? "Creating rule..." : "Create rule"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
