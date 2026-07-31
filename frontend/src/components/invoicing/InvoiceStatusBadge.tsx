import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type InvoiceStatus =
  | "draft"
  | "under_review"
  | "approved"
  | "approved_as_noted"
  | "pending_owner_approval"
  | "revise_and_resubmit"
  | "paid"
  | "void"
  | "not_invited"
  | "invited";

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; variant: "default" | "secondary" | "success" | "destructive" | "warning" | "info" | "outline"; className?: string }> = {
  draft:                { label: "Draft",                variant: "secondary" },
  under_review:         { label: "Under Review",         variant: "outline", className: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800" },
  // Approved-but-not-yet-paid is blue (info); only Paid — money settled — is green (success).
  approved:             { label: "Approved",             variant: "info" },
  approved_as_noted:    { label: "Approved as Noted",    variant: "info" },
  pending_owner_approval: { label: "Pending Owner Approval", variant: "warning" },
  revise_and_resubmit:  { label: "Revise and Resubmit",  variant: "destructive" },
  paid:                 { label: "Paid",                 variant: "success" },
  void:                 { label: "Void",                 variant: "outline" },
  not_invited:          { label: "Not Invited",          variant: "secondary" },
  invited:              { label: "Invited",              variant: "default" },
};

interface InvoiceStatusBadgeProps {
  status: InvoiceStatus | string;
  className?: string;
}

export function InvoiceStatusBadge({ status, className }: InvoiceStatusBadgeProps) {
  const config = STATUS_CONFIG[status as InvoiceStatus] ?? { label: status, variant: "secondary" as const };

  return (
    <Badge variant={config.variant} className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}
