"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  CheckCircle2,
  CircleDollarSign,
  Download,
  FilePlus2,
  Mail,
  Pencil,
  Send,
  Trash2,
  UserPlus,
} from "lucide-react";

import { PageShell } from "@/components/layout";
import { PageTabs } from "@/components/layout/PageTabs";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Modal,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/unified-modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CommitmentsHelpSheet } from "@/components/commitments/CommitmentsHelpSheet";
import { InvoiceStatusBadge } from "@/components/invoicing/InvoiceStatusBadge";
import {
  SummaryTab,
  DetailTab,
  RelatedItemsTab,
  EmailsTab,
  ChangeHistoryTab,
  type SovLineItem,
} from "@/components/invoicing/subcontractor-detail-tabs";
import {
  useSubcontractorInvoiceDetail,
  useDeleteSubcontractorInvoice,
} from "@/hooks/use-subcontractor-invoices";
import { apiFetch } from "@/lib/api-client";
import { usePdfExport } from "@/hooks/use-pdf-export";
import { handleFormError } from "@/lib/handle-form-error";
import { appToast as toast } from "@/lib/toast/app-toast";

async function patchStatus(
  projectId: string,
  invoiceId: string | number,
  status: string,
) {
  return apiFetch(
    `/api/projects/${projectId}/invoicing/subcontractor/invoices/${invoiceId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
  );
}

async function postTransition(
  projectId: string,
  invoiceId: string | number,
  action:
    | "approve"
    | "approve-as-noted"
    | "pending-owner-approval"
    | "revise",
  body?: Record<string, unknown>,
) {
  return apiFetch(
    `/api/projects/${projectId}/invoicing/subcontractor/invoices/${invoiceId}/${action}`,
    {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    },
  );
}

interface SubcontractorInvoiceDetailProps {
  projectId: string;
  invoiceId: number;
  backHref: string;
  backLabel: string;
}

export function SubcontractorInvoiceDetail({
  projectId,
  invoiceId,
  backHref,
  backLabel,
}: SubcontractorInvoiceDetailProps) {
  const router = useRouter();

  const {
    data: invoice,
    isLoading,
    error,
    refetch,
  } = useSubcontractorInvoiceDetail(projectId, invoiceId);

  const deleteInvoice = useDeleteSubcontractorInvoice(projectId);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState("summary");
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewStatus, setReviewStatus] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [editing, setEditing] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailCc, setEmailCc] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("check");
  const [paymentNumber, setPaymentNumber] = useState("");
  const [paymentCheckNumber, setPaymentCheckNumber] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  async function handleStatus(next: string, successMsg: string) {
    setBusy(true);
    try {
      await patchStatus(projectId, invoiceId, next);
      toast.success(successMsg);
      await refetch();
    } catch (err) {
      handleFormError(err, { entity: "subcontractor invoice", action: "update status" });
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitForReview() {
    setBusy(true);
    let submitted = false;
    try {
      await apiFetch(
        `/api/projects/${projectId}/invoicing/subcontractor/invoices/${invoiceId}/submit`,
        { method: "POST" },
      );
      submitted = true;
      toast.success("Submitted for review");
    } catch (err) {
      // HTTP 502 means the invoice was submitted but the PM email notification
      // failed — the status update already succeeded in the DB. Treat it as a
      // partial success so the UI reflects the new status.
      const status = (err as { status?: number })?.status;
      if (status === 502) {
        submitted = true;
        toast.success("Submitted for review");
      } else {
        toast.error("Submit failed");
      }
    } finally {
      if (submitted) {
        await refetch();
      }
      setBusy(false);
    }
  }

  async function handleTransition(
    action: "approve-as-noted" | "pending-owner-approval",
    successMsg: string,
  ) {
    setBusy(true);
    try {
      await postTransition(projectId, invoiceId, action);
      toast.success(successMsg);
      await refetch();
    } catch (err) {
      handleFormError(err, { entity: "subcontractor invoice", action });
    } finally {
      setBusy(false);
    }
  }

  async function handleRecordOwnerApproval() {
    setBusy(true);
    try {
      await postTransition(projectId, invoiceId, "approve", {
        notes: invoice?.notes ?? undefined,
      });
      toast.success("Owner approval recorded");
      await refetch();
    } catch (err) {
      handleFormError(err, { entity: "subcontractor invoice", action: "record owner approval" });
    } finally {
      setBusy(false);
    }
  }

  const { exportPdf: handleExportPdf } = usePdfExport({
    endpoint: `/api/projects/${projectId}/invoicing/subcontractor/invoices/${invoiceId}/pdf`,
    filename: `subcontract-invoice-${invoice?.invoice_number || `APP-${invoiceId}`}`,
  });

  // Opens and pre-fills the email dialog for invoice delivery.
  function handleEmailInvoice() {
    const invoiceNumber = invoice?.invoice_number || `APP-${invoiceId}`;
    setEmailTo("");
    setEmailCc("");
    setEmailSubject(`Invoice ${invoiceNumber}`);
    setEmailMessage(`Please find attached invoice ${invoiceNumber}.`);
    setEmailDialogOpen(true);
  }

  // Sends the subcontractor invoice PDF by email and logs it in invoice history.
  async function handleSendInvoiceEmail() {
    const to = emailTo
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const cc = emailCc
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (to.length === 0) {
      toast.error("At least one recipient email is required");
      return;
    }

    setEmailBusy(true);
    try {
      await apiFetch(
        `/api/projects/${projectId}/invoicing/subcontractor/invoices/${invoiceId}/emails`,
        {
          method: "POST",
          body: JSON.stringify({
            to_recipients: to,
            cc_recipients: cc,
            subject: emailSubject.trim(),
            body: emailMessage.trim(),
            email_type: "invoice",
          }),
        },
      );
      toast.success("Invoice emailed successfully");
      setEmailDialogOpen(false);
      await refetch();
      setActiveTab("emails");
    } catch (err) {
      handleFormError(err, { entity: "subcontractor invoice email", action: "send" });
    } finally {
      setEmailBusy(false);
    }
  }

  async function handleInviteSubcontractor() {
    setBusy(true);
    try {
      const body = await apiFetch<{ message?: string }>(
        `/api/projects/${projectId}/invoicing/subcontractor/invoices/${invoiceId}/invite`,
        { method: "POST" },
      );
      toast.success(body.message ?? "Subcontractor invitation sent");
      await refetch();
      setActiveTab("emails");
    } catch (err) {
      handleFormError(err, { entity: "subcontractor invoice invitation", action: "send" });
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateInvoice() {
    router.push(
      `/${projectId}/invoicing/subcontractor/new?contract=${invoice?.subcontract_id ?? invoice?.purchase_order_id ?? ""}`,
    );
  }

  async function handleResendErp() {
    try {
      const body = await apiFetch<{ message?: string }>(
        `/api/projects/${projectId}/invoicing/subcontractor/invoices/${invoiceId}/erp-resend`,
        { method: "POST" },
      );
      toast.success(body.message ?? "ERP resend queued");
      await refetch();
      setActiveTab("history");
    } catch (err) {
      handleFormError(err, { entity: "subcontractor invoice", action: "resend ERP export" });
    }
  }

  function openPaymentDialog() {
    const due = invoice?.rollup?.current_payment_due ?? 0;
    setPaymentAmount(due > 0 ? due.toFixed(2) : "");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentMethod("check");
    setPaymentNumber("");
    setPaymentCheckNumber("");
    setPaymentNotes("");
    setPaymentDialogOpen(true);
  }

  async function handleMarkPaid() {
    setBusy(true);
    try {
      await apiFetch(
        `/api/projects/${projectId}/invoicing/subcontractor/invoices/${invoiceId}/mark-paid`,
        {
          method: "POST",
          body: JSON.stringify({
            amount: Number(paymentAmount),
            payment_date: paymentDate,
            payment_method: paymentMethod,
            payment_number: paymentNumber.trim() || undefined,
            check_number: paymentCheckNumber.trim() || undefined,
            notes: paymentNotes.trim() || undefined,
          }),
        },
      );
      toast.success("Invoice marked paid");
      setPaymentDialogOpen(false);
      await refetch();
      setActiveTab("history");
    } catch (err) {
      handleFormError(err, { entity: "subcontractor invoice", action: "mark paid" });
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) {
    return (
      <PageShell variant="detail" title="Loading invoice…">
        <div className="px-6 py-4">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </PageShell>
    );
  }

  if (error || !invoice) {
    return (
      <PageShell variant="detail" title="Invoice not found">
        <div className="px-6 py-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            {error instanceof Error
              ? error.message
              : "The requested subcontractor invoice could not be loaded."}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(backHref)}
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> {backLabel}
          </Button>
        </div>
      </PageShell>
    );
  }

  const status = invoice.status as string;
  const isDraft = status === "draft";
  const isInvited = status === "invited";
  const isNotInvited = status === "not_invited";
  const isUnderReview = status === "under_review";
  const isPendingOwnerApproval = status === "pending_owner_approval";
  const isReviseAndResubmit = status === "revise_and_resubmit";
  const canEdit = isDraft || isInvited || isReviseAndResubmit;
  const canInviteSubcontractor = isNotInvited || isInvited || isDraft || isReviseAndResubmit;
  const canDelete = !["approved", "paid"].includes(status);
  const canResendErp = ["approved", "approved_as_noted", "paid"].includes(
    status,
  );
  const canMarkPaid = ["approved", "approved_as_noted"].includes(status);

  const lineItems: SovLineItem[] =
    invoice.subcontractor_invoice_line_items ?? [];
  const tabCounts = invoice.tab_counts ?? {
    related_items: 0,
    emails: 0,
    change_history: 0,
  };

  const title = invoice.invoice_number ?? `Invoice #${invoice.id}`;

  return (
    <PageShell
      variant="detail"
      title={title}
      description={
        invoice.contract_number
          ? `Contract ${invoice.contract_number}${invoice.contract_title ? ` — ${invoice.contract_title}` : ""}`
          : undefined
      }
      onBack={() => router.push(backHref)}
      backLabel={backLabel}
      contentClassName="space-y-4"
      actions={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <CommitmentsHelpSheet buttonVariant="ghost" />
          {canInviteSubcontractor && (
            <Button
              size="sm"
              variant={isInvited ? "outline" : "default"}
              disabled={busy}
              onClick={handleInviteSubcontractor}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              {isInvited ? "Resend Invite" : "Invite Subcontractor"}
            </Button>
          )}
          {(isDraft || isInvited || isReviseAndResubmit) && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={handleSubmitForReview}
            >
              Submit for Review
            </Button>
          )}
          {isUnderReview && (
            <Button
              size="sm"
              disabled={busy}
              onClick={() => {
                setReviewStatus("");
                setReviewComment(invoice.notes ?? "");
                setReviewModalOpen(true);
              }}
            >
              Finish Review
            </Button>
          )}
          {isPendingOwnerApproval && (
            <Button
              size="sm"
              disabled={busy}
              onClick={handleRecordOwnerApproval}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Record Owner Approval
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm">
                Actions <ChevronDown className="h-4 w-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {canEdit && !editing && (
                <DropdownMenuItem
                  onClick={() => {
                    setEditing(true);
                    setActiveTab("summary");
                  }}
                >
                  <Pencil className="h-4 w-4 mr-2" /> Edit
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleExportPdf}>
                <Download className="h-4 w-4 mr-2" /> Export
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCreateInvoice}>
                <FilePlus2 className="h-4 w-4 mr-2" /> Create Invoice
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled
                title="Contract email is sent from the commitment email workflow."
              >
                <Mail className="h-4 w-4 mr-2" /> Email Contract
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleEmailInvoice}>
                <Mail className="h-4 w-4 mr-2" /> Email Invoice
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleInviteSubcontractor}
                disabled={!canInviteSubcontractor || busy}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                {isInvited ? "Resend Subcontractor Invite" : "Invite Subcontractor"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleResendErp}
                disabled={!canResendErp}
              >
                <Send className="h-4 w-4 mr-2" /> Resend to ERP
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={openPaymentDialog}
                disabled={!canMarkPaid || busy}
              >
                <CircleDollarSign className="h-4 w-4 mr-2" /> Mark Paid
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setDeleteOpen(true)}
                disabled={!canDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
    >
      <PageTabs
        variant="inline"
        className=""
        tabs={[
          {
            label: "Summary",
            href: "summary",
            isActive: activeTab === "summary",
          },
          {
            label: "Detail",
            href: "detail",
            isActive: activeTab === "detail",
          },
          {
            label: "Related Items",
            href: "related",
            isActive: activeTab === "related",
            count:
              tabCounts.related_items > 0
                ? tabCounts.related_items
                : undefined,
          },
          {
            label: "Emails",
            href: "emails",
            isActive: activeTab === "emails",
            count: tabCounts.emails > 0 ? tabCounts.emails : undefined,
          },
          {
            label: "Change History",
            href: "history",
            isActive: activeTab === "history",
            count:
              tabCounts.change_history > 0
                ? tabCounts.change_history
                : undefined,
          },
        ]}
        onTabClick={(href) => setActiveTab(href)}
      />

      <div className="pt-2">
        {activeTab === "summary" && (
          <SummaryTab
            invoice={invoice}
            editing={editing}
            projectId={projectId}
            invoiceId={invoiceId}
            onSave={async () => {
              setEditing(false);
              await refetch();
            }}
            onCancel={() => setEditing(false)}
          />
        )}
        {activeTab === "detail" && (
          <DetailTab
            projectId={projectId}
            invoiceId={invoiceId}
            lineItems={lineItems}
            canEdit={canEdit}
            isRetainageRelease={invoice.is_retainage_release ?? false}
            onRefetch={refetch}
          />
        )}
        {activeTab === "related" && (
          <RelatedItemsTab projectId={projectId} invoiceId={invoiceId} />
        )}
        {activeTab === "emails" && (
          <EmailsTab projectId={projectId} invoiceId={invoiceId} />
        )}
        {activeTab === "history" && (
          <ChangeHistoryTab projectId={projectId} invoiceId={invoiceId} />
        )}
      </div>

      {/* Finish Review Modal */}
      <Modal open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
        <ModalContent size="md">
          <ModalHeader>
            <ModalTitle>Finish Review</ModalTitle>
          </ModalHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={reviewStatus} onValueChange={setReviewStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="approved_as_noted">
                    Approved as Noted
                  </SelectItem>
                  <SelectItem value="revise_and_resubmit">
                    Revise and Resubmit
                  </SelectItem>
                  <SelectItem value="pending_owner_approval">
                    Pending Owner Approval
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Overall Comments</Label>
              <Textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Add comments..."
                className="min-h-20"
              />
            </div>
          </div>
          <ModalFooter>
            <Button
              variant="outline"
              onClick={() => setReviewModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={!reviewStatus || busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const trimmedComment = reviewComment.trim();
                  const transitionBody =
                    trimmedComment.length > 0
                      ? reviewStatus === "revise_and_resubmit"
                        ? { reason: trimmedComment }
                        : { notes: trimmedComment }
                      : undefined;
                  const actionMap = {
                    approved: "approve",
                    approved_as_noted: "approve-as-noted",
                    pending_owner_approval: "pending-owner-approval",
                    revise_and_resubmit: "revise",
                  } as const;
                  await postTransition(
                    projectId,
                    invoiceId,
                    actionMap[
                      reviewStatus as keyof typeof actionMap
                    ],
                    transitionBody,
                  );
                  const statusLabels: Record<string, string> = {
                    approved: "Invoice approved",
                    approved_as_noted: "Invoice approved as noted",
                    revise_and_resubmit: "Invoice sent back for revision",
                    pending_owner_approval: "Invoice sent for owner approval",
                  };
                  toast.success(
                    statusLabels[reviewStatus] ?? "Status updated",
                  );
                  setReviewModalOpen(false);
                  await refetch();
                } catch (err) {
                  handleFormError(err, { entity: "subcontractor invoice", action: "update status" });
                } finally {
                  setBusy(false);
                }
              }}
            >
              Update
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <ModalContent size="lg">
          <ModalHeader>
            <ModalTitle>Mark Invoice Paid</ModalTitle>
          </ModalHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Date</Label>
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="ach">ACH</SelectItem>
                    <SelectItem value="wire">Wire</SelectItem>
                    <SelectItem value="electronic">Electronic</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Payment #</Label>
                <Input
                  value={paymentNumber}
                  onChange={(e) => setPaymentNumber(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Check #</Label>
              <Input
                value={paymentCheckNumber}
                onChange={(e) => setPaymentCheckNumber(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                className="min-h-20"
                placeholder="Optional"
              />
            </div>
          </div>
          <ModalFooter>
            <Button
              variant="outline"
              onClick={() => setPaymentDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={
                busy ||
                !paymentAmount ||
                Number(paymentAmount) <= 0 ||
                !paymentDate ||
                !paymentMethod
              }
              onClick={handleMarkPaid}
            >
              Mark Paid
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <ModalContent size="lg">
          <ModalHeader>
            <ModalTitle>Email Invoice</ModalTitle>
          </ModalHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>To</Label>
              <Input
                placeholder="recipient@example.com, team@example.com"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>CC</Label>
              <Input
                placeholder="Optional"
                value={emailCc}
                onChange={(e) => setEmailCc(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                className="min-h-24"
              />
            </div>
          </div>
          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              disabled={emailBusy}
              onClick={() => setEmailDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={emailBusy}
              onClick={handleSendInvoiceEmail}
            >
              {emailBusy ? "Sending..." : "Send Invoice"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subcontractor Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this invoice? This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await deleteInvoice.mutateAsync(invoiceId);
                setDeleteOpen(false);
                router.push(backHref);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
