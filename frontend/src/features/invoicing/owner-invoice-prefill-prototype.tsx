"use client";

import { useMemo, useState } from "react";

import { FormSection } from "@/components/forms/FormSection";
import { FormServerError } from "@/components/forms/FormServerError";
import { SectionRuleHeading } from "@/components/layout/spacing";
import {
  InlineTable,
  InlineTableBody,
  InlineTableCell,
  InlineTableFooter,
  InlineTableFooterCell,
  InlineTableFooterRow,
  InlineTableHeader,
  InlineTableHeaderCell,
  InlineTableHeaderRow,
  InlineTableRow,
} from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type BillingPeriodId = "june-2026" | "july-2026";
type SourceType =
  | "subcontractor_invoice"
  | "direct_cost"
  | "commitment_change_order";
type SourceStatus =
  | "approved"
  | "approved_as_noted"
  | "pending_approval"
  | "draft"
  | "pending";

interface SovLine {
  id: string;
  code: string;
  description: string;
  scheduledValue: number;
  retainageRate: number;
}

interface SourceRecord {
  id: string;
  type: SourceType;
  vendor: string;
  status: SourceStatus;
  billingPeriodId: BillingPeriodId;
  receivedDate?: string;
  amount: number;
  retainage: number;
  sovLineId?: string;
  mapping:
    | "exact_budget_code"
    | "division_fallback"
    | "linked_prime_change"
    | "none";
  attachmentNames: string[];
}

export interface PrefillOptions {
  billingPeriodId: BillingPeriodId | "";
  includeCosts: boolean;
  includeRetainage: boolean;
  includeBackup: boolean;
}

export interface SourceDecision extends SourceRecord {
  eligible: boolean;
  reason: string;
}

export interface PrefillRow extends SovLine {
  currentPayment: number;
  retainage: number;
  netDue: number;
  sourceIds: string[];
}

export interface PrefillPreview {
  rows: PrefillRow[];
  decisions: SourceDecision[];
  attachments: Array<{ sourceId: string; fileName: string }>;
  totals: {
    scheduledValue: number;
    currentPayment: number;
    retainage: number;
    netDue: number;
  };
}

const BILLING_PERIODS: Record<
  BillingPeriodId,
  { label: string; dateRange: string }
> = {
  "june-2026": { label: "June 2026", dateRange: "Jun 1–30, 2026" },
  "july-2026": { label: "July 2026", dateRange: "Jul 1–31, 2026" },
};

const SOV_LINES: SovLine[] = [
  {
    id: "concrete",
    code: "03-3000.C",
    description: "Cast-in-place concrete",
    scheduledValue: 180000,
    retainageRate: 0.1,
  },
  {
    id: "drywall",
    code: "09-2900.L",
    description: "Gypsum board assemblies",
    scheduledValue: 96000,
    retainageRate: 0.1,
  },
  {
    id: "electrical",
    code: "26-0500.E",
    description: "Common work for electrical",
    scheduledValue: 140000,
    retainageRate: 0.1,
  },
  {
    id: "general",
    code: "01.O",
    description: "General requirements",
    scheduledValue: 65000,
    retainageRate: 0.1,
  },
];

const SOURCE_RECORDS: SourceRecord[] = [
  {
    id: "SC-104",
    type: "subcontractor_invoice",
    vendor: "Midwest Concrete",
    status: "approved",
    billingPeriodId: "june-2026",
    amount: 48000,
    retainage: 4800,
    sovLineId: "concrete",
    mapping: "exact_budget_code",
    attachmentNames: ["SC-104 signed invoice.pdf", "SC-104 lien waiver.pdf"],
  },
  {
    id: "SC-219",
    type: "subcontractor_invoice",
    vendor: "Central Interiors",
    status: "approved_as_noted",
    billingPeriodId: "june-2026",
    amount: 32000,
    retainage: 3200,
    sovLineId: "drywall",
    mapping: "exact_budget_code",
    attachmentNames: ["SC-219 invoice.pdf"],
  },
  {
    id: "SC-301",
    type: "subcontractor_invoice",
    vendor: "Delta Electric",
    status: "pending_approval",
    billingPeriodId: "june-2026",
    amount: 27500,
    retainage: 2750,
    sovLineId: "electrical",
    mapping: "exact_budget_code",
    attachmentNames: ["SC-301 invoice.pdf"],
  },
  {
    id: "DC-882",
    type: "direct_cost",
    vendor: "Concrete Supply Co.",
    status: "approved",
    billingPeriodId: "june-2026",
    receivedDate: "Jun 18, 2026",
    amount: 6400,
    retainage: 0,
    sovLineId: "concrete",
    mapping: "exact_budget_code",
    attachmentNames: ["DC-882 receipt.pdf"],
  },
  {
    id: "DC-901",
    type: "direct_cost",
    vendor: "Alleato General Conditions",
    status: "approved",
    billingPeriodId: "june-2026",
    receivedDate: "Jun 22, 2026",
    amount: 3200,
    retainage: 0,
    sovLineId: "general",
    mapping: "division_fallback",
    attachmentNames: ["DC-901 delivery ticket.pdf"],
  },
  {
    id: "CCO-14",
    type: "commitment_change_order",
    vendor: "Alleato General Conditions",
    status: "approved",
    billingPeriodId: "june-2026",
    amount: 8750,
    retainage: 0,
    sovLineId: "general",
    mapping: "linked_prime_change",
    attachmentNames: [],
  },
  {
    id: "SC-412",
    type: "subcontractor_invoice",
    vendor: "Midwest Concrete",
    status: "draft",
    billingPeriodId: "june-2026",
    amount: 12000,
    retainage: 1200,
    sovLineId: "concrete",
    mapping: "exact_budget_code",
    attachmentNames: ["SC-412 draft.pdf"],
  },
  {
    id: "DC-443",
    type: "direct_cost",
    vendor: "Field Equipment Rental",
    status: "approved",
    billingPeriodId: "july-2026",
    receivedDate: "Jul 2, 2026",
    amount: 4900,
    retainage: 0,
    sovLineId: "general",
    mapping: "division_fallback",
    attachmentNames: ["DC-443 receipt.pdf"],
  },
  {
    id: "CCO-31",
    type: "commitment_change_order",
    vendor: "Delta Electric",
    status: "pending",
    billingPeriodId: "june-2026",
    amount: 14300,
    retainage: 0,
    sovLineId: "electrical",
    mapping: "linked_prime_change",
    attachmentNames: [],
  },
  {
    id: "CCO-32",
    type: "commitment_change_order",
    vendor: "Site Utilities LLC",
    status: "approved",
    billingPeriodId: "june-2026",
    amount: 6800,
    retainage: 0,
    mapping: "none",
    attachmentNames: [],
  },
];

const TYPE_LABELS: Record<SourceType, string> = {
  subcontractor_invoice: "Subcontractor invoice",
  direct_cost: "Direct cost",
  commitment_change_order: "Commitment change order",
};

const STATUS_LABELS: Record<SourceStatus, string> = {
  approved: "Approved",
  approved_as_noted: "Approved as Noted",
  pending_approval: "Pending Approval",
  draft: "Draft",
  pending: "Pending",
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

function decideSource(
  source: SourceRecord,
  billingPeriodId: BillingPeriodId | "",
): SourceDecision {
  if (!billingPeriodId) {
    return {
      ...source,
      eligible: false,
      reason: "Select a billing period to evaluate this source.",
    };
  }

  if (source.billingPeriodId !== billingPeriodId) {
    return {
      ...source,
      eligible: false,
      reason: `Its ${source.type === "direct_cost" ? "received date" : "billing period"} is outside ${BILLING_PERIODS[billingPeriodId].label}.`,
    };
  }

  if (source.mapping === "none" || !source.sovLineId) {
    return {
      ...source,
      eligible: false,
      reason:
        "No owner SOV line matches its budget code or linked prime change.",
    };
  }

  if (source.type === "subcontractor_invoice") {
    const accepted = [
      "approved",
      "approved_as_noted",
      "pending_approval",
    ].includes(source.status);
    return {
      ...source,
      eligible: accepted,
      reason: accepted
        ? `${STATUS_LABELS[source.status]} is an eligible subcontractor invoice status.`
        : `${STATUS_LABELS[source.status]} is not an eligible subcontractor invoice status.`,
    };
  }

  if (source.status !== "approved") {
    return {
      ...source,
      eligible: false,
      reason: `${TYPE_LABELS[source.type]} must be Approved; this record is ${STATUS_LABELS[source.status]}.`,
    };
  }

  if (source.type === "direct_cost") {
    return {
      ...source,
      eligible: true,
      reason: `Approved and received ${source.receivedDate} within ${BILLING_PERIODS[billingPeriodId].dateRange}.`,
    };
  }

  return {
    ...source,
    eligible: true,
    reason:
      "Approved and linked to an owner SOV line through its prime contract change.",
  };
}

export function buildPrefillPreview(options: PrefillOptions): PrefillPreview {
  const decisions = SOURCE_RECORDS.map((source) =>
    decideSource(source, options.billingPeriodId),
  );

  const rows = SOV_LINES.map((line): PrefillRow => {
    const applicable = options.includeCosts
      ? decisions.filter(
          (source) => source.eligible && source.sovLineId === line.id,
        )
      : [];
    const currentPayment = applicable.reduce(
      (sum, source) => sum + source.amount,
      0,
    );
    const retainage = options.includeRetainage
      ? applicable.reduce((sum, source) => {
          if (source.type === "subcontractor_invoice")
            return sum + source.retainage;
          if (source.type === "direct_cost")
            return sum + source.amount * line.retainageRate;
          return sum;
        }, 0)
      : 0;

    return {
      ...line,
      currentPayment,
      retainage,
      netDue: currentPayment - retainage,
      sourceIds: applicable.map((source) => source.id),
    };
  });

  const attachments = options.includeBackup
    ? decisions.flatMap((source) =>
        source.eligible && source.type !== "commitment_change_order"
          ? source.attachmentNames.map((fileName) => ({
              sourceId: source.id,
              fileName,
            }))
          : [],
      )
    : [];

  return {
    rows,
    decisions,
    attachments,
    totals: {
      scheduledValue: rows.reduce((sum, row) => sum + row.scheduledValue, 0),
      currentPayment: rows.reduce((sum, row) => sum + row.currentPayment, 0),
      retainage: rows.reduce((sum, row) => sum + row.retainage, 0),
      netDue: rows.reduce((sum, row) => sum + row.netDue, 0),
    },
  };
}

export function OwnerInvoicePrefillPrototype() {
  const [billingPeriodId, setBillingPeriodId] = useState<BillingPeriodId | "">(
    "june-2026",
  );
  const [includeCosts, setIncludeCosts] = useState(true);
  const [includeRetainage, setIncludeRetainage] = useState(false);
  const [includeBackup, setIncludeBackup] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [error, setError] = useState("");
  const [createdMessage, setCreatedMessage] = useState("");

  const preview = useMemo(
    () =>
      buildPrefillPreview({
        billingPeriodId,
        includeCosts,
        includeRetainage,
        includeBackup,
      }),
    [billingPeriodId, includeBackup, includeCosts, includeRetainage],
  );

  const updateCosts = (checked: boolean) => {
    setIncludeCosts(checked);
    if (!checked) setIncludeRetainage(false);
    setCreatedMessage("");
  };

  const reset = () => {
    setBillingPeriodId("");
    setIncludeCosts(false);
    setIncludeRetainage(false);
    setIncludeBackup(false);
    setShowSources(false);
    setError("");
    setCreatedMessage("");
  };

  const createPreview = () => {
    if (!billingPeriodId) {
      setError("Select a billing period before creating the draft preview.");
      setCreatedMessage("");
      return;
    }
    setError("");
    setCreatedMessage(
      `Draft preview created for ${BILLING_PERIODS[billingPeriodId].label}. Nothing was saved.`,
    );
  };

  return (
    <>
      <FormSection title="Invoice setup">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="prime-contract">Prime contract</Label>
            <Select defaultValue="pc-001">
              <SelectTrigger id="prime-contract">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pc-001">
                  PC-001 · Northside Medical Office
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="billing-period">Billing period</Label>
            <Select
              value={billingPeriodId}
              onValueChange={(value: BillingPeriodId) => {
                setBillingPeriodId(value);
                setError("");
                setCreatedMessage("");
              }}
            >
              <SelectTrigger id="billing-period" aria-invalid={Boolean(error)}>
                <SelectValue placeholder="Select a billing period" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(BILLING_PERIODS).map(([id, period]) => (
                  <SelectItem key={id} value={id}>
                    {period.label} · {period.dateRange}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormServerError message={error} />
          </div>
        </div>
      </FormSection>

      <FormSection
        title="Automatic completion options"
        description="These choices are applied once, when the draft owner invoice is created."
      >
        <div className="divide-y divide-border/60">
          <OptionRow
            id="include-costs"
            checked={includeCosts}
            onCheckedChange={updateCosts}
            label="Pre-fill the SOV with costs from the selected billing period"
            description="Includes eligible subcontractor invoices, direct costs, and approved commitment change orders."
          />
          <OptionRow
            id="include-retainage"
            checked={includeRetainage}
            disabled={!includeCosts}
            onCheckedChange={(checked) => {
              setIncludeRetainage(checked);
              setCreatedMessage("");
            }}
            label="Also pre-fill retainage"
            description={
              includeCosts
                ? "Uses subcontractor retainage and the owner SOV rate for eligible direct costs."
                : "Turn on cost prefill first. Retainage cannot be calculated without those costs."
            }
          />
          <OptionRow
            id="include-backup"
            checked={includeBackup}
            onCheckedChange={(checked) => {
              setIncludeBackup(checked);
              setCreatedMessage("");
            }}
            label="Include source backup"
            description="Copies attachments from eligible subcontractor invoices and direct costs into the draft."
          />
        </div>
      </FormSection>

      <FormSection
        title="Resulting schedule of values"
        description="Current payment, retainage, and backup update as you change the options above."
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSources((current) => !current)}
          >
            {showSources
              ? "Hide source eligibility"
              : "Review source eligibility"}
          </Button>
        }
      >
        {createdMessage ? (
          <p
            className="text-sm text-foreground"
            role="status"
            aria-live="polite"
          >
            {createdMessage}
          </p>
        ) : null}

        <div className="hidden md:block">
          <InlineTable variant="read">
            <InlineTableHeader>
              <InlineTableHeaderRow>
                <InlineTableHeaderCell>SOV line</InlineTableHeaderCell>
                <InlineTableHeaderCell align="right">
                  Scheduled value
                </InlineTableHeaderCell>
                <InlineTableHeaderCell align="right">
                  Current payment
                </InlineTableHeaderCell>
                <InlineTableHeaderCell align="right">
                  Retainage
                </InlineTableHeaderCell>
                <InlineTableHeaderCell align="right">
                  Net due
                </InlineTableHeaderCell>
              </InlineTableHeaderRow>
            </InlineTableHeader>
            <InlineTableBody>
              {preview.rows.map((row) => (
                <InlineTableRow key={row.id}>
                  <InlineTableCell>
                    <span className="font-medium text-foreground">
                      {row.code}
                    </span>
                    <span className="ml-2 text-muted-foreground">
                      {row.description}
                    </span>
                    {row.sourceIds.length ? (
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Sources: {row.sourceIds.join(", ")}
                      </span>
                    ) : null}
                  </InlineTableCell>
                  <InlineTableCell align="right" numeric>
                    {money.format(row.scheduledValue)}
                  </InlineTableCell>
                  <InlineTableCell align="right" numeric>
                    {money.format(row.currentPayment)}
                  </InlineTableCell>
                  <InlineTableCell align="right" numeric>
                    {money.format(row.retainage)}
                  </InlineTableCell>
                  <InlineTableCell align="right" numeric>
                    {money.format(row.netDue)}
                  </InlineTableCell>
                </InlineTableRow>
              ))}
            </InlineTableBody>
            <InlineTableFooter>
              <InlineTableFooterRow>
                <InlineTableFooterCell>Total</InlineTableFooterCell>
                <InlineTableFooterCell align="right" numeric>
                  {money.format(preview.totals.scheduledValue)}
                </InlineTableFooterCell>
                <InlineTableFooterCell align="right" numeric>
                  {money.format(preview.totals.currentPayment)}
                </InlineTableFooterCell>
                <InlineTableFooterCell align="right" numeric>
                  {money.format(preview.totals.retainage)}
                </InlineTableFooterCell>
                <InlineTableFooterCell align="right" numeric>
                  {money.format(preview.totals.netDue)}
                </InlineTableFooterCell>
              </InlineTableFooterRow>
            </InlineTableFooter>
          </InlineTable>
        </div>

        <div className="divide-y divide-border/60 md:hidden">
          {preview.rows.map((row) => (
            <div key={row.id} className="space-y-3 py-4 first:pt-0">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {row.code} · {row.description}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {row.sourceIds.length
                    ? `Sources: ${row.sourceIds.join(", ")}`
                    : "No source costs applied"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <MobileAmount
                  label="Scheduled value"
                  value={row.scheduledValue}
                />
                <MobileAmount
                  label="Current payment"
                  value={row.currentPayment}
                />
                <MobileAmount label="Retainage" value={row.retainage} />
                <MobileAmount label="Net due" value={row.netDue} />
              </div>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 py-4 text-sm font-medium">
            <MobileAmount
              label="Total current payment"
              value={preview.totals.currentPayment}
            />
            <MobileAmount label="Total net due" value={preview.totals.netDue} />
          </div>
        </div>

        {showSources ? (
          <SourceEligibility
            decisions={preview.decisions}
            includeCosts={includeCosts}
          />
        ) : null}
      </FormSection>

      {includeBackup ? (
        <FormSection
          title="Backup to include"
          description={`${preview.attachments.length} attachment${preview.attachments.length === 1 ? "" : "s"} would be copied into the draft owner invoice.`}
        >
          {preview.attachments.length ? (
            <ul className="divide-y divide-border/60 text-sm">
              {preview.attachments.map((attachment) => (
                <li
                  key={`${attachment.sourceId}-${attachment.fileName}`}
                  className="flex flex-col gap-0.5 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="text-foreground">{attachment.fileName}</span>
                  <span className="text-xs text-muted-foreground">
                    From {attachment.sourceId}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No eligible source attachments were found for this billing period.
            </p>
          )}
        </FormSection>
      ) : null}

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={reset}>
          Reset prototype
        </Button>
        <Button onClick={createPreview}>
          {createdMessage ? "Refresh draft preview" : "Create draft preview"}
        </Button>
      </div>
    </>
  );
}

function OptionRow({
  id,
  checked,
  disabled = false,
  onCheckedChange,
  label,
  description,
}: {
  id: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <div className="flex gap-3 py-4 first:pt-0 last:pb-0">
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="mt-0.5"
      />
      <div className="space-y-1">
        <Label
          htmlFor={id}
          className={disabled ? "text-muted-foreground" : undefined}
        >
          {label}
        </Label>
        <p className="text-sm leading-5 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function MobileAmount({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 tabular-nums text-foreground">
        {money.format(value)}
      </p>
    </div>
  );
}

function SourceEligibility({
  decisions,
  includeCosts,
}: {
  decisions: SourceDecision[];
  includeCosts: boolean;
}) {
  return (
    <div className="space-y-3 pt-4" aria-label="Source eligibility details">
      <SectionRuleHeading
        label="Source eligibility"
        className="mb-0"
        actions={
          <span className="text-xs font-normal normal-case tracking-normal text-muted-foreground">
            {decisions.filter((source) => source.eligible).length} eligible ·{" "}
            {decisions.filter((source) => !source.eligible).length} excluded
          </span>
        }
      />
      {!includeCosts ? (
        <p className="text-sm text-muted-foreground">
          Eligible sources are shown below, but they are not applied while cost
          prefill is off.
        </p>
      ) : null}
      <div className="divide-y divide-border/60">
        {decisions.map((source) => (
          <div
            key={source.id}
            className="grid gap-1 py-3 first:pt-0 sm:grid-cols-[8rem_minmax(0,1fr)_auto] sm:gap-4"
          >
            <div>
              <p className="text-sm font-medium text-foreground">{source.id}</p>
              <p className="text-xs text-muted-foreground">
                {TYPE_LABELS[source.type]}
              </p>
            </div>
            <div>
              <p className="text-sm text-foreground">{source.vendor}</p>
              <p className="text-xs leading-5 text-muted-foreground">
                {source.reason}
              </p>
            </div>
            <div className="flex items-baseline justify-between gap-4 sm:block sm:text-right">
              <p
                className={`text-xs font-medium ${source.eligible ? "text-foreground" : "text-destructive"}`}
              >
                {source.eligible ? "Eligible" : "Excluded"}
              </p>
              <p className="text-xs tabular-nums text-muted-foreground">
                {money.format(source.amount)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
