/**
 * PSR PDF Document — rendered by @react-pdf/renderer.
 * Produces a PDF matching the 9-page PSR format used by Alleato accounting.
 *
 * Install dependency: cd frontend && npm install @react-pdf/renderer
 */
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { PsrApiResponse } from "@/types/psr.types";

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 8,
    padding: 30,
    color: "#1a1a1a",
  },
  title: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 9,
    color: "#666",
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginTop: 12,
    marginBottom: 6,
    borderBottom: "1pt solid #e2e8f0",
    paddingBottom: 2,
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  infoCell: {
    width: "22%",
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 6.5,
    color: "#999",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  infoValue: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
  },
  table: {
    width: "100%",
    borderTop: "1pt solid #e2e8f0",
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "0.5pt solid #e2e8f0",
    minHeight: 16,
    alignItems: "center",
  },
  tableHeader: {
    backgroundColor: "#f8fafc",
  },
  tableHeaderText: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#64748b",
    padding: "3pt 4pt",
  },
  tableCell: {
    fontSize: 7,
    padding: "2pt 4pt",
    color: "#374151",
  },
  tableCellRight: {
    fontSize: 7,
    padding: "2pt 4pt",
    textAlign: "right",
    color: "#374151",
  },
  totalRow: {
    backgroundColor: "#f1f5f9",
    borderTop: "1pt solid #cbd5e1",
  },
  totalText: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    padding: "3pt 4pt",
  },
  kpiRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  kpiBox: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderRadius: 4,
    padding: "6pt 8pt",
    border: "0.5pt solid #e2e8f0",
  },
  kpiLabel: {
    fontSize: 6,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  kpiValue: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },
  pageNumber: {
    position: "absolute",
    bottom: 20,
    right: 30,
    fontSize: 7,
    color: "#94a3b8",
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

interface PsrDocumentProps {
  data: PsrApiResponse;
  month: string;
}

export function PsrDocument({ data, month }: PsrDocumentProps) {
  const monthLabel = new Date(month + "-01").toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  const info = data.projectInfo;
  const open = data.openItems;

  return (
    <Document title={`PSR — ${data.projectInfo.name} — ${monthLabel}`}>
      {/* ─── PAGE 1: Cover / Project Summary ─── */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>Project Status Report</Text>
        <Text style={styles.subtitle}>
          {info.name} · Month Ending: {monthLabel}
        </Text>

        <Text style={styles.sectionHeader}>Project Information</Text>
        <View style={styles.infoGrid}>
          <InfoCell label="Start Date" value={fmtDate(info.startDate)} />
          <InfoCell label="Completion Date" value={fmtDate(info.completionDate)} />
          <InfoCell label="Contract Budget" value={fmt(info.contractBudget)} />
          <InfoCell label="Current Budget" value={fmt(info.currentBudget)} />
          <InfoCell label="Projected Profit" value={fmt(info.currentProjectedProfit)} />
          <InfoCell label="Original Fee" value={fmt(info.originalFee)} />
          <InfoCell label="Current Fee" value={fmt(info.currentFee)} />
          <InfoCell label="Original Insurance" value={fmt(info.originalInsurance)} />
          <InfoCell label="Current Insurance" value={fmt(info.currentInsurance)} />
          <InfoCell label="Unallocated Costs" value={fmt(info.currentUnallocatedCosts)} />
          <InfoCell label="Owner Contingency" value={fmt(info.currentOwnerContingency)} />
          <InfoCell label="Remaining Buyout" value={fmt(info.remainingBuyout)} />
          <InfoCell label="Job to Date Cost" value={fmt(info.jobToDateCost)} />
        </View>

        <Text style={styles.sectionHeader}>Open Items</Text>
        <View style={styles.kpiRow}>
          <KpiBox label="Open RFIs" value={String(open.openRfis)} />
          <KpiBox label="Open Submittals" value={String(open.openSubmittals)} />
          <KpiBox label="CEs Not in PCO" value={String(open.openCEsNotInPCO)} />
          <KpiBox label="Open PCCOs" value={String(open.openPCCOs)} />
          <KpiBox label="Sub COs Not Funded" value={String(open.subCOsNotFunded)} />
          <KpiBox label="Open PCOs" value={String(open.openPCOs)} />
        </View>

        {data.monthlyBilling.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>Monthly Billing</Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={[styles.tableHeaderText, { width: "30%" }]}>Category</Text>
                {data.monthlyBilling.map((b) => (
                  <Text key={b.month} style={[styles.tableHeaderText, { flex: 1, textAlign: "right" }]}>
                    {b.monthLabel.slice(0, 3)}
                  </Text>
                ))}
              </View>
              <BillingRow label="Owner Payments" data={data.monthlyBilling} getValue={(b) => fmt(b.ownerPayments)} />
              <BillingRow label="Owner Billing" data={data.monthlyBilling} getValue={(b) => fmt(b.ownerBilling)} />
              <BillingRow label="Sub Invoices" data={data.monthlyBilling} getValue={(b) => String(b.subBilling)} />
            </View>
          </>
        )}

        {/* General comments */}
        {data.comments.filter((c) => c.section === "general").map((c, i) => (
          <View key={i} style={{ marginTop: 12 }}>
            <Text style={styles.sectionHeader}>Comments</Text>
            {/* eslint-disable-next-line design-system/no-hardcoded-colors -- react-pdf requires static colors; CSS tokens unsupported */}
            <Text style={{ fontSize: 8, color: "#374151", lineHeight: 1.5 }}>{c.body}</Text>
          </View>
        ))}

        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) =>
          `${pageNumber} / ${totalPages}`
        } fixed />
      </Page>

      {/* ─── PAGES 2-3: Budget Detail ─── */}
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>Budget Detail</Text>
        <Text style={styles.subtitle}>{info.name} · {monthLabel}</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            {["Budget Code", "Original Budget", "Budget Mods", "CCOs", "Revised Budget", "Actual", "Pending", "Projected", "Direct Costs", "Committed", "FTC", "EAC", "Over/Under"].map((h, i) => (
              <Text key={i} style={[styles.tableHeaderText, { flex: i === 0 ? 3 : 1, textAlign: i === 0 ? "left" : "right" }]}>{h}</Text>
            ))}
          </View>
          {data.budgetLines.slice(0, 40).map((line, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 3 }]}>{line.budgetCode}</Text>
              <Text style={[styles.tableCellRight, { flex: 1 }]}>{fmt(line.originalBudget)}</Text>
              <Text style={[styles.tableCellRight, { flex: 1 }]}>{fmt(line.budgetModifications)}</Text>
              <Text style={[styles.tableCellRight, { flex: 1 }]}>{fmt(line.contractChangeOrders)}</Text>
              <Text style={[styles.tableCellRight, { flex: 1 }]}>{fmt(line.revisedBudget)}</Text>
              <Text style={[styles.tableCellRight, { flex: 1 }]}>{fmt(line.actualAmount)}</Text>
              <Text style={[styles.tableCellRight, { flex: 1 }]}>{fmt(line.pendingBudgetChanges)}</Text>
              <Text style={[styles.tableCellRight, { flex: 1 }]}>{fmt(line.projectedBudget)}</Text>
              <Text style={[styles.tableCellRight, { flex: 1 }]}>{fmt(line.directCosts)}</Text>
              <Text style={[styles.tableCellRight, { flex: 1 }]}>{fmt(line.committedCosts)}</Text>
              <Text style={[styles.tableCellRight, { flex: 1 }]}>{fmt(line.forecastToComplete)}</Text>
              <Text style={[styles.tableCellRight, { flex: 1 }]}>{fmt(line.estimatedCostAtCompletion)}</Text>
              <Text style={[styles.tableCellRight, { flex: 1 }]}>{fmt(line.projectOverUnder)}</Text>
            </View>
          ))}
          {/* Grand totals */}
          <View style={[styles.tableRow, styles.totalRow]}>
            <Text style={[styles.totalText, { flex: 3 }]}>Grand Total</Text>
            <Text style={[styles.totalText, { flex: 1, textAlign: "right" }]}>{fmt(data.budgetGrandTotals.originalBudget)}</Text>
            <Text style={[{ flex: 1 }]} />
            <Text style={[{ flex: 1 }]} />
            <Text style={[styles.totalText, { flex: 1, textAlign: "right" }]}>{fmt(data.budgetGrandTotals.revisedBudget)}</Text>
            <Text style={[styles.totalText, { flex: 1, textAlign: "right" }]}>{fmt(data.budgetGrandTotals.actualAmount)}</Text>
            <Text style={[{ flex: 1 }]} />
            <Text style={[{ flex: 1 }]} />
            <Text style={[{ flex: 1 }]} />
            <Text style={[styles.totalText, { flex: 1, textAlign: "right" }]}>{fmt(data.budgetGrandTotals.committedCosts)}</Text>
            <Text style={[styles.totalText, { flex: 1, textAlign: "right" }]}>{fmt(data.budgetGrandTotals.forecastToComplete)}</Text>
            <Text style={[styles.totalText, { flex: 1, textAlign: "right" }]}>{fmt(data.budgetGrandTotals.estimatedCostAtCompletion)}</Text>
            <Text style={[styles.totalText, { flex: 1, textAlign: "right" }]}>{fmt(data.budgetGrandTotals.projectOverUnder)}</Text>
          </View>
        </View>
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>

      {/* ─── PAGE 4: Submittals ─── */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>Submittals</Text>
        <Text style={styles.subtitle}>{info.name} · {monthLabel}</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableHeaderText, { width: "12%" }]}>Number</Text>
            <Text style={[styles.tableHeaderText, { flex: 3 }]}>Title</Text>
            <Text style={[styles.tableHeaderText, { flex: 1 }]}>Status</Text>
            <Text style={[styles.tableHeaderText, { flex: 2 }]}>Ball in Court</Text>
          </View>
          {data.submittals.map((s, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.tableCell, { width: "12%" }]}>{s.submittalNumber}</Text>
              <Text style={[styles.tableCell, { flex: 3 }]}>{s.title}</Text>
              <Text style={[styles.tableCell, { flex: 1 }]}>{s.status}</Text>
              <Text style={[styles.tableCell, { flex: 2 }]}>{s.ballInCourt ?? "—"}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>

      {/* ─── PAGE 5: RFIs ─── */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>RFIs</Text>
        <Text style={styles.subtitle}>{info.name} · {monthLabel}</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableHeaderText, { width: "8%" }]}>#</Text>
            <Text style={[styles.tableHeaderText, { flex: 3 }]}>Subject</Text>
            <Text style={[styles.tableHeaderText, { flex: 1 }]}>Status</Text>
            <Text style={[styles.tableHeaderText, { flex: 1 }]}>Due Date</Text>
          </View>
          {data.rfis.map((r, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.tableCell, { width: "8%" }]}>{r.number}</Text>
              <Text style={[styles.tableCell, { flex: 3 }]}>{r.subject}</Text>
              <Text style={[styles.tableCell, { flex: 1 }]}>{r.status}</Text>
              <Text style={[styles.tableCell, { flex: 1 }]}>{fmtDate(r.dueDate)}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>

      {/* ─── PAGE 6: Change Requests ─── */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>Change Requests</Text>
        <Text style={styles.subtitle}>{info.name} · {monthLabel}</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableHeaderText, { width: "12%" }]}>Number</Text>
            <Text style={[styles.tableHeaderText, { flex: 3 }]}>Title</Text>
            <Text style={[styles.tableHeaderText, { flex: 1 }]}>Scope</Text>
            <Text style={[styles.tableHeaderText, { flex: 1 }]}>Status</Text>
            <Text style={[styles.tableHeaderText, { flex: 1, textAlign: "right" }]}>Cost</Text>
            <Text style={[styles.tableHeaderText, { flex: 1, textAlign: "right" }]}>Markup</Text>
            <Text style={[styles.tableHeaderText, { flex: 1, textAlign: "right" }]}>Total</Text>
          </View>
          {data.changeRequests.map((cr, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.tableCell, { width: "12%" }]}>{cr.number}</Text>
              <Text style={[styles.tableCell, { flex: 3 }]}>{cr.title}</Text>
              <Text style={[styles.tableCell, { flex: 1 }]}>{cr.scope}</Text>
              <Text style={[styles.tableCell, { flex: 1 }]}>{cr.status}</Text>
              <Text style={[styles.tableCellRight, { flex: 1 }]}>{fmt(cr.cost)}</Text>
              <Text style={[styles.tableCellRight, { flex: 1 }]}>{fmt(cr.markup)}</Text>
              <Text style={[styles.tableCellRight, { flex: 1 }]}>{fmt(cr.total)}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>

      {/* ─── PAGE 7: Change Orders (PCCOs) ─── */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>Contract Change Orders (PCCOs)</Text>
        <Text style={styles.subtitle}>{info.name} · {monthLabel}</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableHeaderText, { flex: 1 }]}>Status</Text>
            <Text style={[styles.tableHeaderText, { width: "10%" }]}>#</Text>
            <Text style={[styles.tableHeaderText, { flex: 4 }]}>Description</Text>
            <Text style={[styles.tableHeaderText, { flex: 1, textAlign: "right" }]}>Amount</Text>
          </View>
          {data.changeOrders.map((co, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 1 }]}>{co.status}</Text>
              <Text style={[styles.tableCell, { width: "10%" }]}>{co.number ?? "—"}</Text>
              <Text style={[styles.tableCell, { flex: 4 }]}>{co.description ?? "—"}</Text>
              <Text style={[styles.tableCellRight, { flex: 1 }]}>{fmt(co.amount)}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>

      {/* ─── PAGE 8: Schedule ─── */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>Schedule</Text>
        <Text style={styles.subtitle}>{info.name} · {monthLabel}</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableHeaderText, { flex: 4 }]}>Task Name</Text>
            <Text style={[styles.tableHeaderText, { flex: 1, textAlign: "right" }]}>Duration</Text>
            <Text style={[styles.tableHeaderText, { flex: 1 }]}>Start</Text>
            <Text style={[styles.tableHeaderText, { flex: 1 }]}>Finish</Text>
            <Text style={[styles.tableHeaderText, { flex: 1, textAlign: "right" }]}>% Done</Text>
          </View>
          {data.scheduleTasks.slice(0, 50).map((t) => (
            <View key={t.id} style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 4 }]}>
                {t.isMilestone ? "◆ " : ""}{t.name}
              </Text>
              <Text style={[styles.tableCellRight, { flex: 1 }]}>
                {t.duration != null ? `${t.duration}d` : "—"}
              </Text>
              <Text style={[styles.tableCell, { flex: 1 }]}>{fmtDate(t.startDate)}</Text>
              <Text style={[styles.tableCell, { flex: 1 }]}>{fmtDate(t.finishDate)}</Text>
              <Text style={[styles.tableCellRight, { flex: 1 }]}>
                {t.percentComplete != null ? `${t.percentComplete}%` : "—"}
              </Text>
            </View>
          ))}
        </View>
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoCell}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function KpiBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kpiBox}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
    </View>
  );
}

function BillingRow({
  label,
  data,
  getValue,
}: {
  label: string;
  data: PsrApiResponse["monthlyBilling"];
  getValue: (b: PsrApiResponse["monthlyBilling"][number]) => string;
}) {
  return (
    <View style={styles.tableRow}>
      <Text style={[styles.tableCell, { width: "30%" }]}>{label}</Text>
      {data.map((b) => (
        <Text key={b.month} style={[styles.tableCellRight, { flex: 1 }]}>
          {getValue(b)}
        </Text>
      ))}
    </View>
  );
}

// Suppress unused import warning
void Font;
