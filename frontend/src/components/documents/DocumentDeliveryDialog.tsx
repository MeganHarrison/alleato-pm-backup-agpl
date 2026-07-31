"use client";

import * as React from "react";
import { CheckCircle2, Download, Loader2, Mail, X } from "lucide-react";
import { toast } from "sonner";

import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/unified-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api-client";
import { triggerBrowserDownload } from "@/lib/browser-download";
import type { DocumentRecordType } from "@/lib/documents/record-documents";

interface RecipientOption {
  id: string;
  email: string;
  name: string;
  source: string;
  defaultSelected: boolean;
}

interface Recipient {
  id: string;
  email: string;
  name: string;
}

type DialogTab = "download" | "email";

interface DocumentDeliveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEmailSent?: () => void;
  recordType: DocumentRecordType;
  recordId: string;
  title: string;
  number: string;
  initialTab?: DialogTab;
  allowedTabs?: DialogTab[];
  recipientsEndpoint?: string;
  emailEndpoint?: string;
  downloadEndpoint?: string;
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function DocumentDeliveryDialog({
  open,
  onOpenChange,
  onEmailSent,
  recordType,
  recordId,
  title,
  number,
  initialTab = "download",
  allowedTabs = ["download", "email"],
  recipientsEndpoint,
  emailEndpoint,
  downloadEndpoint,
}: DocumentDeliveryDialogProps) {
  const sanitizedAllowedTabs = React.useMemo<DialogTab[]>(
    () => (allowedTabs.length > 0 ? allowedTabs : ["download", "email"]),
    [allowedTabs],
  );
  const defaultTab = sanitizedAllowedTabs.includes(initialTab)
    ? initialTab
    : sanitizedAllowedTabs[0];
  const [activeTab, setActiveTab] = React.useState<DialogTab>(defaultTab);
  const [recipientOptions, setRecipientOptions] = React.useState<RecipientOption[]>([]);
  const [recipients, setRecipients] = React.useState<Recipient[]>([]);
  const [manualEmail, setManualEmail] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [isSending, setIsSending] = React.useState(false);
  const [isLoadingRecipients, setIsLoadingRecipients] = React.useState(false);
  const [metadataError, setMetadataError] = React.useState<string | null>(null);

  const resolvedRecipientsEndpoint =
    recipientsEndpoint ?? `/api/document-center/${recordType}/${recordId}/recipients`;
  const resolvedEmailEndpoint =
    emailEndpoint ?? `/api/document-center/${recordType}/${recordId}/email`;
  const resolvedDownloadEndpoint =
    downloadEndpoint ?? `/api/document-center/${recordType}/${recordId}/pdf`;

  React.useEffect(() => {
    if (!open) return;

    let isMounted = true;
    setActiveTab(defaultTab);
    setManualEmail("");
    setMessage("");
    setMetadataError(null);
    setRecipientOptions([]);
    setRecipients([]);
    setSubject(`${number} - ${title}`);

    const loadRecipients = async () => {
      setIsLoadingRecipients(true);
      try {
        const data = await apiFetch<{
          defaultSubject: string;
          recipients: RecipientOption[];
        }>(resolvedRecipientsEndpoint);

        if (!isMounted) return;

        setRecipientOptions(data.recipients);
        setRecipients(
          data.recipients
            .filter((recipient) => recipient.defaultSelected)
            .map((recipient) => ({
              id: recipient.id,
              email: recipient.email,
              name: recipient.name,
            })),
        );
        setSubject(data.defaultSubject || `${number} - ${title}`);
      } catch (error) {
        if (!isMounted) return;
        setMetadataError(
          error instanceof Error ? error.message : "Failed to load recipients",
        );
      } finally {
        if (isMounted) {
          setIsLoadingRecipients(false);
        }
      }
    };

    void loadRecipients();

    return () => {
      isMounted = false;
    };
  }, [defaultTab, number, open, recordId, recordType, resolvedRecipientsEndpoint, title]);

  const availableRecipients = React.useMemo(
    () =>
      recipientOptions.filter(
        (option) =>
          !recipients.some(
            (recipient) =>
              recipient.email.toLowerCase() === option.email.toLowerCase(),
          ),
      ),
    [recipientOptions, recipients],
  );

  const addRecipient = React.useCallback((recipient: Recipient) => {
    setRecipients((current) => {
      if (
        current.some(
          (item) => item.email.toLowerCase() === recipient.email.toLowerCase(),
        )
      ) {
        return current;
      }
      return [...current, recipient];
    });
  }, []);

  const removeRecipient = React.useCallback((id: string) => {
    setRecipients((current) => current.filter((recipient) => recipient.id !== id));
  }, []);

  const addManualEmail = React.useCallback(() => {
    const email = manualEmail.trim();
    if (!email) return;
    if (!validateEmail(email)) {
      toast.error("Enter a valid email address");
      return;
    }

    addRecipient({
      id: `manual-${email.toLowerCase()}`,
      email,
      name: email,
    });
    setManualEmail("");
  }, [addRecipient, manualEmail]);

  const handleDownload = React.useCallback(async () => {
    setIsDownloading(true);
    try {
      await triggerBrowserDownload(
        resolvedDownloadEndpoint,
        `${number}-${title}.pdf`,
        "application/pdf",
      );
      toast.success("Download started");
    } catch (error) {
      console.error("Document download failed", error);
      toast.error("Document download failed. Try again.");
    } finally {
      setIsDownloading(false);
    }
  }, [number, resolvedDownloadEndpoint, title]);

  const handleSend = React.useCallback(async () => {
    if (recipients.length === 0) {
      toast.error("Add at least one recipient");
      return;
    }

    if (!subject.trim()) {
      toast.error("Subject is required");
      return;
    }

    setIsSending(true);
    try {
      await apiFetch(resolvedEmailEndpoint, {
        method: "POST",
        body: JSON.stringify({
          recipients,
          subject: subject.trim(),
          message: message.trim(),
        }),
      });

      toast.success(
        `Email sent to ${recipients.length} recipient${recipients.length === 1 ? "" : "s"}`,
      );
      onEmailSent?.();
      onOpenChange(false);
    } catch (error) {
      toast.error("Send failed");
    } finally {
      setIsSending(false);
    }
  }, [message, onEmailSent, onOpenChange, recipients, resolvedEmailEndpoint, subject]);

  const showTabbedLayout = sanitizedAllowedTabs.length > 1;
  const modalTitle =
    sanitizedAllowedTabs.length === 1
      ? sanitizedAllowedTabs[0] === "email"
        ? "Email PDF"
        : "Preview PDF"
      : "Document Delivery";
  const modalDescription =
    sanitizedAllowedTabs.length === 1
      ? sanitizedAllowedTabs[0] === "email"
        ? `Email the PDF for ${number}${title ? ` · ${title}` : ""}.`
        : `Preview the PDF for ${number}${title ? ` · ${title}` : ""}.`
      : `Generate or email the merged PDF for ${number}${title ? ` · ${title}` : ""}.`;

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent size="2xl">
        <ModalHeader>
          <ModalTitle>{modalTitle}</ModalTitle>
          <ModalDescription>{modalDescription}</ModalDescription>
        </ModalHeader>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as DialogTab)}
          className="space-y-6"
        >
          {showTabbedLayout ? (
            <TabsList className={`grid w-full ${sanitizedAllowedTabs.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
              {sanitizedAllowedTabs.includes("download") ? (
                <TabsTrigger value="download">
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </TabsTrigger>
              ) : null}
              {sanitizedAllowedTabs.includes("email") ? (
                <TabsTrigger value="email">
                  <Mail className="mr-2 h-4 w-4" />
                  Email
                </TabsTrigger>
              ) : null}
            </TabsList>
          ) : null}

          {sanitizedAllowedTabs.includes("download") ? (
            <TabsContent value="download" className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-sm font-medium text-foreground">PDF template</p>
              <p className="mt-2 text-sm text-muted-foreground">
                The PDF is generated from the current record fields and line items at download time.
              </p>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => void handleDownload()} disabled={isDownloading}>
                {isDownloading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download />
                )}
                Download PDF
              </Button>
            </div>
            </TabsContent>
          ) : null}

          {sanitizedAllowedTabs.includes("email") ? (
            <TabsContent value="email" className="space-y-4">
            <div className="space-y-3">
              <Label>Recipients</Label>
              {recipients.length > 0 ? (
                <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-muted/20 p-3">
                  {recipients.map((recipient) => (
                    <Badge
                      key={recipient.id}
                      variant="secondary"
                      className="flex items-center gap-1 py-1"
                    >
                      <span>{recipient.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRecipient(recipient.id)}
                        className="h-4 w-4 rounded-full p-0"
                        aria-label={`Remove ${recipient.email}`}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
                  No recipients selected yet.
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="manual-email">Add Email</Label>
              <div className="flex gap-2">
                <Input
                  id="manual-email"
                  value={manualEmail}
                  onChange={(event) => setManualEmail(event.target.value)}
                  placeholder="name@company.com"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addManualEmail();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addManualEmail}>
                  Add
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Suggested Contacts</Label>
              {isLoadingRecipients ? (
                <div className="text-sm text-muted-foreground">Loading contacts...</div>
              ) : metadataError ? (
                <div className="text-sm text-destructive">{metadataError}</div>
              ) : availableRecipients.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No related contacts were found. Manual entry is still available.
                </div>
              ) : (
                <div className="space-y-2 rounded-xl border border-border bg-background p-3">
                  {availableRecipients.map((option) => (
                    <Button
                      key={option.id}
                      type="button"
                      variant="ghost"
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left h-auto font-normal hover:bg-muted/30"
                      onClick={() =>
                        addRecipient({
                          id: option.id,
                          email: option.email,
                          name: option.name,
                        })
                      }
                    >
                      <div>
                        <div className="text-sm font-medium">{option.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {option.email} · {option.source}
                        </div>
                      </div>
                      {option.defaultSelected ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : null}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="document-subject">Subject</Label>
              <Input
                id="document-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="document-message">Message</Label>
              <Textarea
                id="document-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={5}
                placeholder="Optional note to include with the PDF."
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={() => void handleSend()} disabled={isSending}>
                {isSending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Mail />
                )}
                Send Email
              </Button>
            </div>
            </TabsContent>
          ) : null}
        </Tabs>
      </ModalContent>
    </Modal>
  );
}
