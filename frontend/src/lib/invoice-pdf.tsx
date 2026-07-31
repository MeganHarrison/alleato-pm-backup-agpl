import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import React from "react";

// ---------------------------------------------------------------------------
// Types (kept local to decouple from feature modules)
// ---------------------------------------------------------------------------

export interface InvoicePdfLineItem {
  id: number;
  description: string | null;
  scheduled_value: number;
  work_completed_previous: number;
  work_completed_period: number;
  materials_stored: number;
  retainage_pct: number;
  retainage_amount: number;
}

export interface InvoicePdfProject {
  id: number;
  name: string | null;
  number?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
}

export interface InvoicePdfContract {
  contract_number?: string | null;
  contract_title?: string | null;
  company_name?: string | null;
  retention_percentage?: number | null;
}

export interface InvoicePdfData {
  id: number;
  invoice_number: string | null;
  status: string;
  billing_date: string | null;
  period_start: string | null;
  period_end: string | null;
  notes?: string | null;
  lineItems: InvoicePdfLineItem[];
  project: InvoicePdfProject | null;
  contract: InvoicePdfContract | null;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function fmtCurrency(value: number | null | undefined): string {
  if (value == null) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtPercent(value: number | null | undefined): string {
  if (value == null) return "0%";
  return `${Math.round(value)}%`;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 50,
    paddingHorizontal: 36,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#1a1a1a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerLeft: { flexDirection: "column" },
  companyName: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  headerMuted: { fontSize: 9, color: "#555", lineHeight: 1.4 },
  headerRight: { flexDirection: "column", alignItems: "flex-end" },
  projectName: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  divider: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#1a1a1a",
    marginBottom: 14,
  },
  invoiceTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    marginBottom: 10,
  },
  metaGrid: {
    flexDirection: "row",
    marginBottom: 16,
  },
  metaCol: { flex: 1, flexDirection: "column" },
  metaRow: { flexDirection: "row", marginBottom: 3 },
  metaLabel: {
    fontFamily: "Helvetica-Bold",
    width: 90,
    fontSize: 9,
  },
  metaValue: { fontSize: 9, flex: 1 },
  sectionHeading: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#cccccc",
  },
  table: { width: "100%", marginBottom: 12 },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#dddddd",
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#2d2d2d",
  },
  th: {
    color: "#ffffff",
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    padding: 4,
    textAlign: "center",
  },
  td: {
    fontSize: 7,
    padding: 4,
    textAlign: "right",
  },
  tdLeft: {
    fontSize: 7,
    padding: 4,
    textAlign: "left",
  },
  // Column widths (percentages — must sum to 100)
  colDesc: { width: "22%" },
  colSched: { width: "11%" },
  colPrev: { width: "10%" },
  colPeriod: { width: "10%" },
  colStored: { width: "9%" },
  colTotal: { width: "11%" },
  colPct: { width: "7%" },
  colRetain: { width: "10%" },
  colNet: { width: "10%" },
  totalsRow: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    borderTopWidth: 1,
    borderTopColor: "#333333",
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
  },
  totalsCell: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    padding: 5,
    textAlign: "right",
  },
  summary: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  summaryBox: { width: 240 },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e5e5",
  },
  summaryLabel: { fontSize: 9, color: "#555" },
  summaryValue: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  summaryTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: "#1a1a1a",
    marginTop: 2,
  },
  summaryTotalLabel: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  summaryTotalValue: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  notesSection: { marginTop: 18 },
  notesBody: {
    fontSize: 9,
    color: "#333",
    lineHeight: 1.5,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: "#cccccc",
    fontSize: 7,
    color: "#777",
  },
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function computeLineNet(item: InvoicePdfLineItem): {
  totalCompletedStored: number;
  pctComplete: number;
  retainageAmount: number;
  netThisPeriod: number;
} {
  const totalCompletedStored =
    (item.work_completed_previous || 0) +
    (item.work_completed_period || 0) +
    (item.materials_stored || 0);

  const pctComplete =
    item.scheduled_value > 0
      ? (totalCompletedStored / item.scheduled_value) * 100
      : 0;

  const thisPeriodAmount =
    (item.work_completed_period || 0) + (item.materials_stored || 0);

  const retainageAmount =
    item.retainage_amount != null && item.retainage_amount !== 0
      ? item.retainage_amount
      : thisPeriodAmount * ((item.retainage_pct || 0) / 100);

  const netThisPeriod = thisPeriodAmount - retainageAmount;

  return { totalCompletedStored, pctComplete, retainageAmount, netThisPeriod };
}

export function InvoicePdfDocument({ data }: { data: InvoicePdfData }) {
  const companyName = "Alleato Group";
  const companyAddress = "2050 Meridian Blvd., Suite 300";
  const companyCityState = "Franklin, TN 37067";
  const companyPhone = "(615) 771-0024";

  const projectAddress = [
    data.project?.address,
    data.project?.city,
    data.project?.state,
  ]
    .filter(Boolean)
    .join(", ");

  const invoiceNumber = data.invoice_number || `INV-${data.id}`;

  let totalScheduled = 0;
  let totalPrev = 0;
  let totalPeriod = 0;
  let totalStored = 0;
  let totalGross = 0;
  let totalRetainage = 0;
  let totalNet = 0;

  const computed = data.lineItems.map((item) => {
    const c = computeLineNet(item);
    totalScheduled += item.scheduled_value || 0;
    totalPrev += item.work_completed_previous || 0;
    totalPeriod += item.work_completed_period || 0;
    totalStored += item.materials_stored || 0;
    totalGross += c.totalCompletedStored;
    totalRetainage += c.retainageAmount;
    totalNet += c.netThisPeriod;
    return { item, ...c };
  });

  const contractorLabel =
    data.contract?.company_name || "Contractor";
  const ownerLabel = "Owner";

  const generatedAt = new Date().toLocaleString("en-US");

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.companyName}>{companyName}</Text>
            <Text style={styles.headerMuted}>{companyAddress}</Text>
            <Text style={styles.headerMuted}>{companyCityState}</Text>
            <Text style={styles.headerMuted}>{companyPhone}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.projectName}>
              {data.project?.number ? `${data.project.number} — ` : ""}
              {data.project?.name || "Unknown Project"}
            </Text>
            {projectAddress ? (
              <Text style={styles.headerMuted}>{projectAddress}</Text>
            ) : null}
          </View>
        </View>
        <View style={styles.divider} />

        <Text style={styles.invoiceTitle}>INVOICE #{invoiceNumber}</Text>

        {/* Meta grid */}
        <View style={styles.metaGrid}>
          <View style={styles.metaCol}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Status:</Text>
              <Text style={styles.metaValue}>{data.status}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Billing Date:</Text>
              <Text style={styles.metaValue}>{fmtDate(data.billing_date)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Period Start:</Text>
              <Text style={styles.metaValue}>{fmtDate(data.period_start)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Period End:</Text>
              <Text style={styles.metaValue}>{fmtDate(data.period_end)}</Text>
            </View>
          </View>
          <View style={styles.metaCol}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>From:</Text>
              <Text style={styles.metaValue}>{contractorLabel}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>To:</Text>
              <Text style={styles.metaValue}>{ownerLabel}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Contract:</Text>
              <Text style={styles.metaValue}>
                {data.contract?.contract_number || "—"}
                {data.contract?.contract_title
                  ? ` — ${data.contract.contract_title}`
                  : ""}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Retainage:</Text>
              <Text style={styles.metaValue}>
                {data.contract?.retention_percentage != null
                  ? `${data.contract.retention_percentage}%`
                  : "—"}
              </Text>
            </View>
          </View>
        </View>

        {/* Line items table */}
        <Text style={styles.sectionHeading}>Schedule of Values</Text>
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.th, styles.colDesc, { textAlign: "left" }]}>
              Description
            </Text>
            <Text style={[styles.th, styles.colSched]}>Scheduled Value</Text>
            <Text style={[styles.th, styles.colPrev]}>Previous</Text>
            <Text style={[styles.th, styles.colPeriod]}>This Period</Text>
            <Text style={[styles.th, styles.colStored]}>Stored</Text>
            <Text style={[styles.th, styles.colTotal]}>Total</Text>
            <Text style={[styles.th, styles.colPct]}>%</Text>
            <Text style={[styles.th, styles.colRetain]}>Retainage</Text>
            <Text style={[styles.th, styles.colNet]}>Net</Text>
          </View>

          {computed.length === 0 ? (
            <View style={styles.tableRow}>
              <Text
                style={[
                  styles.tdLeft,
                  { width: "100%", textAlign: "center", color: "#999" },
                ]}
              >
                No line items
              </Text>
            </View>
          ) : (
            computed.map(
              ({ item, totalCompletedStored, pctComplete, retainageAmount, netThisPeriod }) => (
                <View key={item.id} style={styles.tableRow} wrap={false}>
                  <Text style={[styles.tdLeft, styles.colDesc]}>
                    {item.description || "—"}
                  </Text>
                  <Text style={[styles.td, styles.colSched]}>
                    {fmtCurrency(item.scheduled_value)}
                  </Text>
                  <Text style={[styles.td, styles.colPrev]}>
                    {fmtCurrency(item.work_completed_previous)}
                  </Text>
                  <Text style={[styles.td, styles.colPeriod]}>
                    {fmtCurrency(item.work_completed_period)}
                  </Text>
                  <Text style={[styles.td, styles.colStored]}>
                    {fmtCurrency(item.materials_stored)}
                  </Text>
                  <Text style={[styles.td, styles.colTotal]}>
                    {fmtCurrency(totalCompletedStored)}
                  </Text>
                  <Text style={[styles.td, styles.colPct]}>
                    {fmtPercent(pctComplete)}
                  </Text>
                  <Text style={[styles.td, styles.colRetain]}>
                    {fmtCurrency(retainageAmount)}
                  </Text>
                  <Text style={[styles.td, styles.colNet]}>
                    {fmtCurrency(netThisPeriod)}
                  </Text>
                </View>
              ),
            )
          )}

          {computed.length > 0 && (
            <View style={styles.totalsRow}>
              <Text style={[styles.totalsCell, styles.colDesc, { textAlign: "left" }]}>
                Totals
              </Text>
              <Text style={[styles.totalsCell, styles.colSched]}>
                {fmtCurrency(totalScheduled)}
              </Text>
              <Text style={[styles.totalsCell, styles.colPrev]}>
                {fmtCurrency(totalPrev)}
              </Text>
              <Text style={[styles.totalsCell, styles.colPeriod]}>
                {fmtCurrency(totalPeriod)}
              </Text>
              <Text style={[styles.totalsCell, styles.colStored]}>
                {fmtCurrency(totalStored)}
              </Text>
              <Text style={[styles.totalsCell, styles.colTotal]}>
                {fmtCurrency(totalGross)}
              </Text>
              <Text style={[styles.totalsCell, styles.colPct]}>
                {fmtPercent(
                  totalScheduled > 0 ? (totalGross / totalScheduled) * 100 : 0,
                )}
              </Text>
              <Text style={[styles.totalsCell, styles.colRetain]}>
                {fmtCurrency(totalRetainage)}
              </Text>
              <Text style={[styles.totalsCell, styles.colNet]}>
                {fmtCurrency(totalNet)}
              </Text>
            </View>
          )}
        </View>

        {/* Summary */}
        <View style={styles.summary}>
          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Gross Work Completed</Text>
              <Text style={styles.summaryValue}>{fmtCurrency(totalGross)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Less Retainage</Text>
              <Text style={styles.summaryValue}>
                {fmtCurrency(totalRetainage)}
              </Text>
            </View>
            <View style={styles.summaryTotalRow}>
              <Text style={styles.summaryTotalLabel}>Net Amount Due</Text>
              <Text style={styles.summaryTotalValue}>{fmtCurrency(totalNet)}</Text>
            </View>
          </View>
        </View>

        {/* Notes */}
        {data.notes ? (
          <View style={styles.notesSection}>
            <Text style={styles.sectionHeading}>Notes</Text>
            <Text style={styles.notesBody}>{data.notes}</Text>
          </View>
        ) : null}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>{companyName}</Text>
          <Text
            render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
          <Text>Generated {generatedAt}</Text>
        </View>
      </Page>
    </Document>
  );
}

// ---------------------------------------------------------------------------
// Buffer rendering helper
// ---------------------------------------------------------------------------

export async function renderInvoicePdfBuffer(
  data: InvoicePdfData,
): Promise<Buffer> {
  return renderToBuffer(<InvoicePdfDocument data={data} />);
}
