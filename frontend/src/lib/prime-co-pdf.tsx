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
// Types
// ---------------------------------------------------------------------------

export interface PrimeCoPdfLineItem {
  id: number;
  cost_code: string | null;
  description: string | null;
  line_amount: number | null;
}

export interface PrimeCoPdfData {
  id: number;
  pcco_number: string | null;
  revision: number | null;
  title: string;
  description: string | null;
  change_reason: string | null;
  status: string | null;
  total_amount: number | null;
  executed: boolean | null;
  paid_in_full: boolean | null;
  field_change: boolean | null;
  schedule_impact: number | null;
  location: string | null;
  reference: string | null;
  request_received_from: string | null;
  signed_co_received_date: string | null;
  created_at: string | null;
  created_by: string | null;
  line_items: PrimeCoPdfLineItem[];
  // Related
  contract_number: string | null;
  contract_title: string | null;
  linked_change_order: string | null; // e.g. "#003 - PCOs 03 - 06"
  accounting_method: string | null;
  // Project
  project_name: string | null;
  project_number: string | null;
  project_address: string | null;
  project_city: string | null;
  project_state: string | null;
  project_zip: string | null;
  // Owner (TO)
  owner_name: string | null;
  owner_address: string | null;
  owner_city: string | null;
  owner_state: string | null;
  owner_zip: string | null;
  // GC (FROM) — hardcoded defaults
  gc_name?: string;
  gc_address?: string;
  gc_city_state?: string;
  gc_phone?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GC_NAME = "Alleato Group";
const GC_ADDRESS = "8383 Craig St, Suite 150";
const GC_CITY_STATE = "Indianapolis, Indiana 46250";
const GC_PHONE = "Phone: +13177600088";

function fmtCurrency(value: number | null | undefined): string {
  if (value == null) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
}

function capitalize(s: string | null | undefined): string {
  if (!s) return "—";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

// ---------------------------------------------------------------------------
// Styles — mirrors the Procore PCO PDF layout
// ---------------------------------------------------------------------------

const S = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 36,
    fontSize: 8.5,
    fontFamily: "Helvetica",
    color: "#1a1a1a",
  },

  // ---- Header ----
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  headerLeft: { flexDirection: "column" },
  gcName: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  headerMuted: { fontSize: 8, color: "#333", lineHeight: 1.5 },
  pcoNumberBadge: { fontSize: 22, fontFamily: "Helvetica-Bold", textAlign: "right" },
  headerRight: { flexDirection: "column", alignItems: "flex-end" },
  projectLabel: { fontSize: 9, fontFamily: "Helvetica-Bold", textAlign: "right" },
  projectMuted: { fontSize: 8, color: "#333", textAlign: "right", lineHeight: 1.5 },

  divider: { borderBottomWidth: 1.5, borderBottomColor: "#1a1a1a", marginBottom: 10 },

  // ---- Title banner ----
  titleBanner: {
    backgroundColor: "#f0f0f0",
    borderWidth: 0.5,
    borderColor: "#c0c0c0",
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 0,
  },
  titleBannerText: { fontSize: 13, fontFamily: "Helvetica-Bold" },

  // ---- Meta grid (bordered table) ----
  metaTable: {
    borderWidth: 0.5,
    borderColor: "#aaa",
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#bbb",
  },
  metaRowLast: {
    flexDirection: "row",
  },
  metaCell: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRightWidth: 0.5,
    borderRightColor: "#bbb",
  },
  metaCellNoBorder: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  metaLabel: { fontFamily: "Helvetica-Bold", fontSize: 7.5, marginRight: 4, minWidth: 80 },
  metaValue: { fontSize: 7.5, flex: 1 },
  metaValueBold: { fontSize: 7.5, fontFamily: "Helvetica-Bold", flex: 1 },

  // ---- Named sections ----
  sectionLabel: { fontSize: 8.5, fontFamily: "Helvetica-Bold", marginTop: 10, marginBottom: 2 },
  sectionBody: { fontSize: 8.5, marginBottom: 4, lineHeight: 1.5 },
  italic: { fontFamily: "Helvetica-Oblique" },

  // ---- Line items table ----
  table: { width: "100%", marginTop: 10, marginBottom: 2 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    borderWidth: 0.5,
    borderColor: "#aaa",
  },
  tableRow: {
    flexDirection: "row",
    borderLeftWidth: 0.5,
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: "#aaa",
  },
  thNum: { width: 24, fontSize: 7.5, fontFamily: "Helvetica-Bold", padding: 4, textAlign: "center", borderRightWidth: 0.5, borderColor: "#aaa" },
  thCode: { flex: 2, fontSize: 7.5, fontFamily: "Helvetica-Bold", padding: 4, borderRightWidth: 0.5, borderColor: "#aaa" },
  thDesc: { flex: 4, fontSize: 7.5, fontFamily: "Helvetica-Bold", padding: 4, borderRightWidth: 0.5, borderColor: "#aaa" },
  thAmt: { flex: 1.5, fontSize: 7.5, fontFamily: "Helvetica-Bold", padding: 4, textAlign: "right" },

  tdNum: { width: 24, fontSize: 7.5, padding: 4, textAlign: "center", borderRightWidth: 0.5, borderColor: "#aaa" },
  tdCode: { flex: 2, fontSize: 7.5, padding: 4, borderRightWidth: 0.5, borderColor: "#aaa" },
  tdDesc: { flex: 4, fontSize: 7.5, padding: 4, borderRightWidth: 0.5, borderColor: "#aaa" },
  tdAmt: { flex: 1.5, fontSize: 7.5, padding: 4, textAlign: "right" },

  // ---- Totals ----
  totalsSection: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 16 },
  totalsBox: {
    width: 220,
    borderWidth: 0.5,
    borderColor: "#aaa",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: "#ccc",
  },
  totalRowLast: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#f0f0f0",
  },
  totalLabel: { fontSize: 8, color: "#333" },
  totalValue: { fontSize: 8 },
  totalLabelBold: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  totalValueBold: { fontSize: 9, fontFamily: "Helvetica-Bold" },

  // ---- Signature block ----
  sigSection: { marginTop: 20 },
  sigAddressRow: { flexDirection: "row", marginBottom: 12 },
  sigAddressBlock: { flex: 1 },
  sigAddressName: { fontSize: 8.5, fontFamily: "Helvetica-Bold" },
  sigAddressLine: { fontSize: 8, color: "#333", lineHeight: 1.4 },
  sigLineRow: { flexDirection: "row", gap: 24, marginTop: 4 },
  sigBlock: { flex: 1 },
  sigLine: { borderBottomWidth: 0.75, borderBottomColor: "#555", marginBottom: 3 },
  sigLineLabel: { fontSize: 7, color: "#666", textTransform: "uppercase", fontFamily: "Helvetica-Bold" },

  // ---- Footer ----
  footer: {
    position: "absolute",
    bottom: 20,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: "#bbb",
    fontSize: 7,
    color: "#666",
  },
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PrimeCoPdfDocument({ data }: { data: PrimeCoPdfData }) {
  const gcName = data.gc_name ?? GC_NAME;
  const gcAddress = data.gc_address ?? GC_ADDRESS;
  const gcCityState = data.gc_city_state ?? GC_CITY_STATE;
  const gcPhone = data.gc_phone ?? GC_PHONE;

  const pcoLabel = `PCO #${data.pcco_number ?? data.id}`;

  const projectLine1 = [data.project_number, data.project_name].filter(Boolean).join(" - ");
  const projectLine2 = [data.project_address].filter(Boolean).join(", ");
  const projectLine3 = [data.project_city, data.project_state, data.project_zip]
    .filter(Boolean)
    .join(", ");

  const contractLabel = [
    data.contract_number,
    data.contract_title,
  ]
    .filter(Boolean)
    .join(" - ");

  // Owner (TO) address block
  const ownerCityStateZip = [data.owner_city, data.owner_state, data.owner_zip]
    .filter(Boolean)
    .join(", ");

  // Subtotal from line items; grand total from stored value
  const subtotal = data.line_items.reduce((sum, li) => sum + (li.line_amount ?? 0), 0);
  const grandTotal = data.total_amount ?? subtotal;
  const markup = grandTotal - subtotal;

  const generatedAt = new Date().toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });

  return (
    <Document>
      <Page size="LETTER" style={S.page}>
        {/* ── Header ── */}
        <View style={S.header}>
          <View style={S.headerLeft}>
            <Text style={S.gcName}>{gcName}</Text>
            <Text style={S.headerMuted}>{gcAddress}</Text>
            <Text style={S.headerMuted}>{gcCityState}</Text>
            <Text style={S.headerMuted}>{gcPhone}</Text>
          </View>
          <View style={S.headerRight}>
            <Text style={S.pcoNumberBadge}>{pcoLabel}</Text>
            {projectLine1 ? (
              <Text style={S.projectLabel}>{projectLine1}</Text>
            ) : null}
            {projectLine2 ? (
              <Text style={S.projectMuted}>{projectLine2}</Text>
            ) : null}
            {projectLine3 ? (
              <Text style={S.projectMuted}>{projectLine3}</Text>
            ) : null}
          </View>
        </View>

        <View style={S.divider} />

        {/* ── Title banner ── */}
        <View style={S.titleBanner}>
          <Text style={S.titleBannerText}>
            Prime Contract Potential Change Order #{data.pcco_number ?? data.id}: {data.title}
          </Text>
        </View>

        {/* ── Meta grid ── */}
        <View style={S.metaTable}>
          {/* Row 1: TO / FROM */}
          <View style={S.metaRow}>
            <View style={S.metaCell}>
              <Text style={S.metaLabel}>TO:</Text>
              <View style={{ flexDirection: "column", flex: 1 }}>
                {data.owner_name ? (
                  <Text style={S.metaValue}>{data.owner_name}</Text>
                ) : null}
                {data.owner_address ? (
                  <Text style={S.metaValue}>{data.owner_address}</Text>
                ) : null}
                {ownerCityStateZip ? (
                  <Text style={S.metaValue}>{ownerCityStateZip}</Text>
                ) : null}
              </View>
            </View>
            <View style={S.metaCellNoBorder}>
              <Text style={S.metaLabel}>FROM:</Text>
              <View style={{ flexDirection: "column", flex: 1 }}>
                <Text style={S.metaValue}>{gcName}</Text>
                <Text style={S.metaValue}>{gcAddress}</Text>
                <Text style={S.metaValue}>{gcCityState}</Text>
              </View>
            </View>
          </View>

          {/* Row 2: PCO NUMBER/REVISION / CONTRACT */}
          <View style={S.metaRow}>
            <View style={S.metaCell}>
              <Text style={S.metaLabel}>PCO NUMBER/REVISION:</Text>
              <Text style={S.metaValue}>
                {data.pcco_number ?? "—"} / {data.revision ?? 0}
              </Text>
            </View>
            <View style={S.metaCellNoBorder}>
              <Text style={S.metaLabel}>CONTRACT:</Text>
              <Text style={S.metaValue}>{contractLabel || "—"}</Text>
            </View>
          </View>

          {/* Row 3: REQUEST RECEIVED FROM / CREATED BY */}
          <View style={S.metaRow}>
            <View style={S.metaCell}>
              <Text style={S.metaLabel}>REQUEST RECEIVED FROM:</Text>
              <Text style={S.metaValue}>{data.request_received_from || ""}</Text>
            </View>
            <View style={S.metaCellNoBorder}>
              <Text style={S.metaLabel}>CREATED BY:</Text>
              <Text style={S.metaValue}>{data.created_by || "—"}</Text>
            </View>
          </View>

          {/* Row 4: STATUS / CREATED DATE */}
          <View style={S.metaRow}>
            <View style={S.metaCell}>
              <Text style={S.metaLabel}>STATUS:</Text>
              <Text style={S.metaValue}>{capitalize(data.status)}</Text>
            </View>
            <View style={S.metaCellNoBorder}>
              <Text style={S.metaLabel}>CREATED DATE:</Text>
              <Text style={S.metaValue}>{fmtDate(data.created_at)}</Text>
            </View>
          </View>

          {/* Row 5: REFERENCE / PRIME CONTRACT CHANGE ORDER */}
          <View style={S.metaRow}>
            <View style={S.metaCell}>
              <Text style={S.metaLabel}>REFERENCE:</Text>
              <Text style={S.metaValue}>{data.reference || "PRIME CONTRACT"}</Text>
            </View>
            <View style={S.metaCellNoBorder}>
              <Text style={S.metaLabel}>PRIME CONTRACT{"\n"}CHANGE ORDER:</Text>
              <Text style={S.metaValue}>{data.linked_change_order || "—"}</Text>
            </View>
          </View>

          {/* Row 6: FIELD CHANGE */}
          <View style={S.metaRow}>
            <View style={S.metaCell}>
              <Text style={S.metaLabel}>FIELD CHANGE:</Text>
              <Text style={S.metaValue}>{data.field_change ? "Yes" : "No"}</Text>
            </View>
            <View style={S.metaCellNoBorder}>
              <Text style={S.metaLabel}></Text>
              <Text style={S.metaValue}></Text>
            </View>
          </View>

          {/* Row 7: LOCATION / ACCOUNTING METHOD */}
          <View style={S.metaRow}>
            <View style={S.metaCell}>
              <Text style={S.metaLabel}>LOCATION:</Text>
              <Text style={S.metaValue}>{data.location || ""}</Text>
            </View>
            <View style={S.metaCellNoBorder}>
              <Text style={S.metaLabel}>ACCOUNTING METHOD:</Text>
              <Text style={S.metaValue}>{data.accounting_method || "Amount Based"}</Text>
            </View>
          </View>

          {/* Row 8: SCHEDULE IMPACT / PAID IN FULL */}
          <View style={S.metaRow}>
            <View style={S.metaCell}>
              <Text style={S.metaLabel}>SCHEDULE IMPACT:</Text>
              <Text style={S.metaValue}>
                {data.schedule_impact ? `${data.schedule_impact} days` : ""}
              </Text>
            </View>
            <View style={S.metaCellNoBorder}>
              <Text style={S.metaLabel}>PAID IN FULL:</Text>
              <Text style={S.metaValue}>{data.paid_in_full ? "Yes" : "No"}</Text>
            </View>
          </View>

          {/* Row 9: EXECUTED / SIGNED CO RECEIVED DATE + TOTAL AMOUNT */}
          <View style={S.metaRowLast}>
            <View style={S.metaCell}>
              <Text style={S.metaLabel}>EXECUTED:</Text>
              <Text style={S.metaValue}>{data.executed ? "Yes" : "No"}</Text>
            </View>
            <View style={S.metaCellNoBorder}>
              <Text style={S.metaLabel}>SIGNED CHANGE ORDER{"\n"}RECEIVED DATE:</Text>
              <Text style={S.metaValue}>{fmtDate(data.signed_co_received_date)}</Text>
            </View>
          </View>
          <View style={[S.metaRowLast, { borderTopWidth: 0.5, borderTopColor: "#bbb" }]}>
            <View style={S.metaCell}>
              <Text style={S.metaLabel}></Text>
              <Text style={S.metaValue}></Text>
            </View>
            <View style={S.metaCellNoBorder}>
              <Text style={S.metaLabel}>TOTAL AMOUNT:</Text>
              <Text style={S.metaValueBold}>{fmtCurrency(grandTotal)}</Text>
            </View>
          </View>
        </View>

        {/* ── Change Order Title ── */}
        <Text style={S.sectionLabel}>POTENTIAL CHANGE ORDER TITLE: <Text style={{ fontFamily: "Helvetica" }}>{data.title}</Text></Text>

        {/* ── Change Reason ── */}
        {data.change_reason ? (
          <Text style={S.sectionLabel}>
            CHANGE REASON:{" "}
            <Text style={{ fontFamily: "Helvetica" }}>{data.change_reason}</Text>
          </Text>
        ) : null}

        {/* ── Description ── */}
        {data.description ? (
          <View style={{ marginTop: 8 }}>
            <Text style={S.sectionLabel}>
              POTENTIAL CHANGE ORDER DESCRIPTION:{" "}
              <Text style={S.italic}>(The Contract Is Changed As Follows)</Text>
            </Text>
            <Text style={S.sectionBody}>{data.description}</Text>
          </View>
        ) : null}

        {/* ── Line Items ── */}
        <View style={S.table}>
          {/* Table header */}
          <View style={S.tableHeader}>
            <Text style={S.thNum}>#</Text>
            <Text style={S.thCode}>Budget Code</Text>
            <Text style={S.thDesc}>Description</Text>
            <Text style={S.thAmt}>Amount</Text>
          </View>

          {data.line_items.length === 0 ? (
            <View style={S.tableRow}>
              <Text style={[S.tdDesc, { width: "100%", textAlign: "center", color: "#999" }]}>
                No line items
              </Text>
            </View>
          ) : (
            data.line_items.map((li, idx) => (
              <View key={li.id} style={S.tableRow} wrap={false}>
                <Text style={S.tdNum}>{idx + 1}</Text>
                <Text style={S.tdCode}>{li.cost_code || "—"}</Text>
                <Text style={S.tdDesc}>{li.description || "—"}</Text>
                <Text style={S.tdAmt}>{fmtCurrency(li.line_amount)}</Text>
              </View>
            ))
          )}
        </View>

        {/* ── Totals ── */}
        <View style={S.totalsSection}>
          <View style={S.totalsBox}>
            {data.line_items.length > 0 && markup !== 0 ? (
              <>
                <View style={S.totalRow}>
                  <Text style={S.totalLabel}>Subtotal:</Text>
                  <Text style={S.totalValue}>{fmtCurrency(subtotal)}</Text>
                </View>
                {markup > 0 ? (
                  <View style={S.totalRow}>
                    <Text style={S.totalLabel}>Markup / Fees:</Text>
                    <Text style={S.totalValue}>{fmtCurrency(markup)}</Text>
                  </View>
                ) : null}
              </>
            ) : null}
            <View style={S.totalRowLast}>
              <Text style={S.totalLabelBold}>Grand Total:</Text>
              <Text style={S.totalValueBold}>{fmtCurrency(grandTotal)}</Text>
            </View>
          </View>
        </View>

        {/* ── Signature block ── */}
        <View style={S.sigSection} wrap={false}>
          {/* Party names */}
          <View style={S.sigAddressRow}>
            <View style={S.sigAddressBlock}>
              <Text style={S.sigAddressName}>{data.owner_name || "Owner"}</Text>
              {data.owner_address ? (
                <Text style={S.sigAddressLine}>{data.owner_address}</Text>
              ) : null}
              {ownerCityStateZip ? (
                <Text style={S.sigAddressLine}>{ownerCityStateZip}</Text>
              ) : null}
            </View>
            <View style={S.sigAddressBlock}>
              <Text style={S.sigAddressName}>{gcName}</Text>
              <Text style={S.sigAddressLine}>{gcAddress}</Text>
              <Text style={S.sigAddressLine}>{gcCityState}</Text>
            </View>
          </View>

          {/* Signature lines — 3 columns: Architect / Owner / GC */}
          <View style={S.sigLineRow}>
            <View style={S.sigBlock}>
              <View style={S.sigLine}><Text> </Text></View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={S.sigLineLabel}>SIGNATURE</Text>
                <Text style={S.sigLineLabel}>DATE</Text>
              </View>
            </View>
            <View style={S.sigBlock}>
              <View style={S.sigLine}><Text> </Text></View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={S.sigLineLabel}>SIGNATURE</Text>
                <Text style={S.sigLineLabel}>DATE</Text>
              </View>
            </View>
            <View style={S.sigBlock}>
              <View style={S.sigLine}><Text> </Text></View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={S.sigLineLabel}>SIGNATURE</Text>
                <Text style={S.sigLineLabel}>DATE</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Footer ── */}
        <View style={S.footer} fixed>
          <Text>{gcName}</Text>
          <Text
            render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
          <Text>Printed On: {generatedAt}</Text>
        </View>
      </Page>
    </Document>
  );
}

// ---------------------------------------------------------------------------
// Buffer render helper
// ---------------------------------------------------------------------------

export async function renderPrimeCoPdfBuffer(data: PrimeCoPdfData): Promise<Buffer> {
  return renderToBuffer(<PrimeCoPdfDocument data={data} />);
}
