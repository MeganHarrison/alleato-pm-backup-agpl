"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ContentSectionStack,
  RecordDetailPage,
  SectionRuleHeading,
} from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DetailPropertyItem } from "@/components/ui/detail-property-bar";
import {
  DetailField,
  DetailFieldGrid,
  ErrorState,
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
import { toast } from "sonner";
import { reportErrorObject } from "@/lib/app-error-reporter";
import { formatCurrency, formatDate } from "@/lib/table-config/formatters";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Building2,
  CalendarDays,
  CheckCircle2,
  ReceiptText,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { buildAcumaticaApBillHref } from "@/lib/acumatica/ap-bill-url";

interface DirectCostDetailPageProps {
  params: Promise<{
    projectId: string;
    costId: string;
  }>;
}

interface LineItem {
  id: string;
  description: string | null;
  quantity: number;
  uom: string;
  unit_cost: number;
  line_total: number;
  line_order: number;
  budget_code: { code: string; description: string } | null;
}

/** Normalize an invoice_number that may have been stored as a serialized object
 *  (e.g. "{}" or "[object Object]") due to an Acumatica sync bug where an empty
 *  AcuField envelope was written directly to the varchar column. */
function extractInvoiceNumber(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    // Reject empty-object artefacts left by the old sync bug
    if (trimmed === "" || trimmed === "{}" || trimmed === "[object Object]") return null;
    return trimmed;
  }
  if (typeof raw === "object") {
    // Handle { value: "..." } shape that slipped through unwrap
    const obj = raw as Record<string, unknown>;
    if (typeof obj.value === "string" && obj.value.trim() !== "") return obj.value.trim();
  }
  return null;
}

interface DirectCostDetail {
  id: string;
  project_id: number;
  date: string;
  cost_type: string;
  status: string;
  description: string | null;
  total_amount: number;
  invoice_number: unknown;
  received_date: string | null;
  paid_date: string | null;
  acumatica_ref_nbr: string | null;
  acumatica_doc_type: string | null;
  acumatica_sync_at: string | null;
  created_at: string;
  updated_at: string;
  vendor: { id: string; name: string } | null;
  employee: { id: string; first_name: string; last_name: string } | null;
  line_items: LineItem[];
}

// This route renders the shared RecordDetailPage template in every state.
// eslint-disable-next-line design-system/require-page-shell
export default function DirectCostDetailPage({
  params,
}: DirectCostDetailPageProps) {
  const [directCost, setDirectCost] = useState<DirectCostDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [resolvedParams, setResolvedParams] = useState<{
    projectId: string;
    costId: string;
  } | null>(null);

  useEffect(() => {
    params.then(setResolvedParams);
  }, [params]);

  useEffect(() => {
    if (!resolvedParams) return;

    const fetchDirectCost = async () => {
      try {
        setIsLoading(true);
        setLoadError(null);
        const data = await apiFetch<DirectCostDetail>(
          `/api/projects/${resolvedParams.projectId}/direct-costs/${resolvedParams.costId}`,
        );
        setDirectCost(data);
      } catch (error) {
        const loadFailure = error instanceof Error ? error : new Error("Unknown error");
        setLoadError(loadFailure.message);
        reportErrorObject(loadFailure, {
          severity: "high",
          action: "direct_cost_detail_load",
          route: window.location.pathname,
          context: resolvedParams,
        });
        toast.error("Direct cost could not be loaded", {
          description: loadFailure.message,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchDirectCost();
  }, [resolvedParams, reloadKey]);

  if (!resolvedParams || isLoading) {
    return (
      <RecordDetailPage title="Direct Cost Details">
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-48" />
            </div>
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-36" />
            </div>
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-52" />
            </div>
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
      </RecordDetailPage>
    );
  }

  if (!directCost) {
    return (
      <RecordDetailPage title="Direct Cost Details">
        {loadError ? (
          <ErrorState
            title="Direct cost could not be loaded"
            description="We could not load this direct cost. Try again or return to Direct Costs."
            onRetry={() => setReloadKey((value) => value + 1)}
          />
        ) : (
          <ErrorState
            title="Direct cost not found"
            description="The direct cost you are looking for does not exist or has been removed."
          />
        )}
      </RecordDetailPage>
    );
  }

  const invoiceNumber = extractInvoiceNumber(directCost.invoice_number);
  const pageTitle = invoiceNumber
    ? `Invoice #${invoiceNumber}`
    : `Direct cost ${directCost.id.slice(0, 8)}`;

  const lineItemsTotal = directCost.line_items?.reduce(
    (sum, li) => sum + (li.line_total ?? li.quantity * li.unit_cost),
    0,
  ) ?? 0;
  const sortedLineItems = [...(directCost.line_items ?? [])].sort(
    (a, b) => a.line_order - b.line_order,
  );
  const acumaticaHref = directCost.acumatica_ref_nbr
    ? buildAcumaticaApBillHref(
        directCost.acumatica_doc_type,
        directCost.acumatica_ref_nbr,
      )
    : null;

  return (
    <>
      <RecordDetailPage
        title={pageTitle}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/${resolvedParams.projectId}/direct-costs`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Direct Costs
            </Link>
          </Button>
        }
        properties={<>
          <DetailPropertyItem
            icon={Banknote}
            contentClassName="text-sm font-semibold text-foreground"
          >
            {formatCurrency(directCost.total_amount)}
          </DetailPropertyItem>
          <DetailPropertyItem
            icon={Building2}
            muted={!directCost.vendor?.name}
            title={directCost.vendor?.name ?? undefined}
          >
            {directCost.vendor?.name ?? "Vendor not set"}
          </DetailPropertyItem>
          <DetailPropertyItem icon={CheckCircle2}>
            {directCost.status}
          </DetailPropertyItem>
          <DetailPropertyItem icon={ReceiptText}>
            {directCost.cost_type}
          </DetailPropertyItem>
          <DetailPropertyItem icon={CalendarDays}>
            {formatDate(directCost.date)}
          </DetailPropertyItem>
          {directCost.received_date ? (
            <DetailPropertyItem icon={CalendarDays}>
              Received {formatDate(directCost.received_date)}
            </DetailPropertyItem>
          ) : null}
          {directCost.paid_date ? (
            <DetailPropertyItem icon={CalendarDays}>
              Paid {formatDate(directCost.paid_date)}
            </DetailPropertyItem>
          ) : null}
          {directCost.acumatica_sync_at ? (
            acumaticaHref ? (
              <DetailPropertyItem
                icon={ArrowRight}
                href={acumaticaHref}
                external
              >
                {directCost.acumatica_doc_type ? `${directCost.acumatica_doc_type} ` : ""}
                {directCost.acumatica_ref_nbr}
              </DetailPropertyItem>
            ) : (
              <DetailPropertyItem icon={ArrowRight} muted>
                Synced from Acumatica
              </DetailPropertyItem>
            )
          ) : null}
        </>}
      >

        <ContentSectionStack className="space-y-8">
          <section className="space-y-4">
            <SectionRuleHeading label="Invoice Details" />
            <DetailFieldGrid columns={2} className="gap-y-3">
              <DetailField label="Invoice number">
                {invoiceNumber ?? "—"}
              </DetailField>
              {directCost.employee ? (
                <DetailField label="Employee">
                  {directCost.employee.first_name} {directCost.employee.last_name}
                </DetailField>
              ) : null}
              {directCost.description ? (
                <DetailField label="Description" span={2}>
                  {directCost.description}
                </DetailField>
              ) : null}
              <DetailField label="Created">
                {formatDate(directCost.created_at, "MMM d, yyyy HH:mm")}
              </DetailField>
              {directCost.updated_at &&
              directCost.updated_at !== directCost.created_at ? (
                <DetailField label="Last updated">
                  {formatDate(directCost.updated_at, "MMM d, yyyy HH:mm")}
                </DetailField>
              ) : null}
            </DetailFieldGrid>
          </section>

          {/* Line Items */}
          {sortedLineItems.length > 0 && (
            <section className="space-y-4">
              <div>
                <SectionRuleHeading
                  label={`Line Items (${sortedLineItems.length})`}
                />
                <InlineTable variant="read">
                  <InlineTableHeader>
                    <InlineTableHeaderRow>
                      <InlineTableHeaderCell>Budget Code</InlineTableHeaderCell>
                      <InlineTableHeaderCell>Description</InlineTableHeaderCell>
                      <InlineTableHeaderCell align="right">Qty</InlineTableHeaderCell>
                      <InlineTableHeaderCell>UOM</InlineTableHeaderCell>
                      <InlineTableHeaderCell align="right">Unit Cost</InlineTableHeaderCell>
                      <InlineTableHeaderCell align="right">Line Total</InlineTableHeaderCell>
                    </InlineTableHeaderRow>
                  </InlineTableHeader>
                  <InlineTableBody>
                    {sortedLineItems.map((li) => (
                      <InlineTableRow key={li.id}>
                        <InlineTableCell className="font-medium">
                          {li.budget_code?.code ?? "-"}
                        </InlineTableCell>
                        <InlineTableCell>
                          {li.description ?? li.budget_code?.description ?? "-"}
                        </InlineTableCell>
                        <InlineTableCell align="right">
                          {li.quantity}
                        </InlineTableCell>
                        <InlineTableCell>{li.uom}</InlineTableCell>
                        <InlineTableCell align="right">
                          {formatCurrency(li.unit_cost)}
                        </InlineTableCell>
                        <InlineTableCell align="right" className="font-medium">
                          {formatCurrency(
                            li.line_total ?? li.quantity * li.unit_cost,
                          )}
                        </InlineTableCell>
                      </InlineTableRow>
                    ))}
                  </InlineTableBody>
                  <InlineTableFooter>
                    <InlineTableFooterRow>
                      <InlineTableFooterCell colSpan={5}>
                        Total
                      </InlineTableFooterCell>
                      <InlineTableFooterCell align="right">
                        {formatCurrency(lineItemsTotal)}
                      </InlineTableFooterCell>
                    </InlineTableFooterRow>
                  </InlineTableFooter>
                </InlineTable>
              </div>
            </section>
          )}
        </ContentSectionStack>
      </RecordDetailPage>
    </>
  );
}
