import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import React from "react";
import {
  buildContinuationSections,
  buildSubcontractorInvoicePdfFilename,
  type ContinuationRow,
} from "@/lib/subcontractor-invoice-pdf-helpers";

export interface SubcontractorInvoicePdfLineItem {
  id: number;
  sort_order: number | null;
  budget_code: string | null;
  description: string | null;
  scheduled_value: number | null;
  work_completed_previous: number | null;
  work_completed_period: number | null;
  materials_stored: number | null;
  total_completed_stored: number | null;
  retainage_pct: number | null;
  retainage_amount: number | null;
  materials_retainage_pct: number | null;
  materials_retainage_amount: number | null;
  net_amount_this_period: number | null;
}

export interface SubcontractorInvoicePdfRollup {
  original_contract_sum: number;
  net_change_by_change_orders: number;
  contract_sum_to_date: number;
  total_completed_and_stored: number;
  total_work_retainage: number;
  total_materials_retainage: number;
  total_retainage: number;
  total_earned_less_retainage: number;
  less_previous_certificates: number;
  current_payment_due: number;
  balance_to_finish_including_retainage: number;
  change_order_additions?: number;
  change_order_deductions?: number;
}

export interface SubcontractorInvoicePdfContractLine {
  id: string;
  line_number: number | null;
  sort_order: number | null;
  budget_code: string | null;
  description: string | null;
  amount: number | null;
}

export interface SubcontractorInvoicePdfChangeOrder {
  id: string;
  change_order_number: string | null;
  title: string | null;
  description: string | null;
  amount: number | null;
}

export interface SubcontractorInvoicePdfData {
  id: number;
  invoice_number: string | null;
  application_number: number;
  status: string | null;
  period_start: string | null;
  period_end: string | null;
  billing_date: string | null;
  created_at?: string | null;
  notes: string | null;
  project_name: string | null;
  project_number: string | null;
  project_address: string | null;
  contract_number: string | null;
  contract_title: string | null;
  contract_date: string | null;
  gc_company_name: string | null;
  gc_company_address: string | null;
  gc_company_city: string | null;
  gc_company_state: string | null;
  gc_company_zip: string | null;
  contract_company_name: string | null;
  contract_company_address: string | null;
  contract_company_city: string | null;
  contract_company_state: string | null;
  contract_company_zip: string | null;
  line_items: SubcontractorInvoicePdfLineItem[];
  contract_lines?: SubcontractorInvoicePdfContractLine[];
  approved_change_orders?: SubcontractorInvoicePdfChangeOrder[];
  rollup: SubcontractorInvoicePdfRollup;
  attachments?: string[];
}

function formatMoney(value: number | null | undefined): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value ?? 0);
}

function formatPercent(value: number | null | undefined): string {
  return `${(value ?? 0).toFixed(2)}%`;
}

function formatDate(value: string | null | undefined, blank = "—"): string {
  if (!value) return blank;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return blank;
  return parsed.toLocaleDateString("en-US");
}

function formatDateShort(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
  });
}

function formatCityStateZip(
  city: string | null,
  state: string | null,
  zip: string | null,
): string {
  const cityState = [city, state].filter(Boolean).join(", ");
  return [cityState, zip].filter(Boolean).join(" ");
}

function formatAddressBlock(
  name: string | null,
  address: string | null,
  city: string | null,
  state: string | null,
  zip: string | null,
): string[] {
  return [name, address, formatCityStateZip(city, state, zip)].filter(
    (value): value is string => Boolean(value && value.trim()),
  );
}

function safeText(value: string | null | undefined, blank = "—"): string {
  return value && value.trim() ? value.trim() : blank;
}

export { buildContinuationSections, buildSubcontractorInvoicePdfFilename };

const styles = StyleSheet.create({
  page: {
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 28,
    fontFamily: "Helvetica",
    fontSize: 8,
    color: "#111111",
    lineHeight: 1.25,
  },
  pageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  headerTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    letterSpacing: 0.4,
  },
  headerSubTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    letterSpacing: 0.3,
  },
  pageCount: {
    fontSize: 7,
  },
  pageFooter: {
    position: "absolute",
    left: 22,
    right: 22,
    bottom: 8,
    textAlign: "center",
    fontSize: 7,
    color: "#555555",
  },
  twoColumn: {
    flexDirection: "row",
    gap: 14,
  },
  leftColumn: {
    width: "58%",
  },
  rightColumn: {
    width: "42%",
  },
  metaGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  metaColumn: {
    width: "48%",
  },
  fieldGroup: {
    marginBottom: 8,
  },
  fieldLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    marginBottom: 2,
  },
  fieldLine: {
    marginBottom: 1,
  },
  summarySheet: {
    borderWidth: 1,
    borderColor: "#111111",
    padding: 7,
    marginBottom: 8,
  },
  summarySheetRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  summarySheetLabel: {
    fontFamily: "Helvetica-Bold",
    width: "44%",
  },
  summarySheetValue: {
    width: "54%",
    textAlign: "left",
  },
  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    marginBottom: 5,
  },
  bodyText: {
    marginBottom: 4,
  },
  ruleTable: {
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: "#111111",
    marginTop: 4,
  },
  ruleRow: {
    flexDirection: "row",
  },
  ruleCellNumber: {
    width: "8%",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#111111",
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  ruleCellLabel: {
    width: "62%",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#111111",
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  ruleCellValue: {
    width: "30%",
    borderBottomWidth: 1,
    borderColor: "#111111",
    paddingVertical: 3,
    paddingHorizontal: 4,
    textAlign: "right",
  },
  emphasized: {
    fontFamily: "Helvetica-Bold",
  },
  signatureBlock: {
    borderWidth: 1,
    borderColor: "#111111",
    padding: 7,
    minHeight: 220,
  },
  signatureLineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  signatureLine: {
    width: "68%",
    borderBottomWidth: 1,
    borderColor: "#111111",
    minHeight: 12,
  },
  shortLine: {
    width: "25%",
    borderBottomWidth: 1,
    borderColor: "#111111",
    minHeight: 12,
  },
  notaryLine: {
    borderBottomWidth: 1,
    borderColor: "#111111",
    minHeight: 12,
    marginTop: 6,
  },
  changeSummary: {
    marginTop: 10,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: "#111111",
  },
  changeSummaryHeader: {
    flexDirection: "row",
    backgroundColor: "#F3F3F3",
  },
  changeSummaryRow: {
    flexDirection: "row",
  },
  changeCellLabel: {
    width: "56%",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#111111",
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  changeCellValue: {
    width: "22%",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#111111",
    paddingVertical: 3,
    paddingHorizontal: 4,
    textAlign: "right",
  },
  changeCellValueLast: {
    width: "22%",
    borderBottomWidth: 1,
    borderColor: "#111111",
    paddingVertical: 3,
    paddingHorizontal: 4,
    textAlign: "right",
  },
  continuationMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  continuationMetaBlock: {
    width: "31%",
  },
  detailTable: {
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: "#111111",
    marginTop: 4,
    width: "98.5%",
    alignSelf: "flex-start",
  },
  detailHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#F3F3F3",
  },
  detailLetterRow: {
    flexDirection: "row",
  },
  detailRow: {
    flexDirection: "row",
  },
  detailItem: {
    width: "5.5%",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#111111",
    paddingVertical: 2,
    paddingHorizontal: 1,
    textAlign: "center",
    fontSize: 5.8,
  },
  detailBudget: {
    width: "12.5%",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#111111",
    paddingVertical: 2,
    paddingHorizontal: 1,
    fontSize: 5.8,
  },
  detailDescription: {
    width: "20.5%",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#111111",
    paddingVertical: 2,
    paddingHorizontal: 2,
    fontSize: 5.8,
  },
  detailNumber: {
    width: "8.5%",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#111111",
    paddingVertical: 2,
    paddingHorizontal: 1,
    textAlign: "right",
    fontSize: 5.8,
  },
  detailNarrowNumber: {
    width: "8%",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#111111",
    paddingVertical: 2,
    paddingHorizontal: 1,
    textAlign: "right",
    fontSize: 5.8,
  },
  detailTotal: {
    width: "9%",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#111111",
    paddingVertical: 2,
    paddingHorizontal: 1,
    textAlign: "right",
    fontSize: 5.8,
  },
  detailPercent: {
    width: "5.5%",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#111111",
    paddingVertical: 2,
    paddingHorizontal: 1,
    textAlign: "right",
    fontSize: 5.8,
  },
  detailBalance: {
    width: "7.5%",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#111111",
    paddingVertical: 2,
    paddingHorizontal: 1,
    textAlign: "right",
    fontSize: 5.8,
  },
  detailRetainage: {
    width: "6.5%",
    borderBottomWidth: 1,
    borderColor: "#111111",
    paddingVertical: 2,
    paddingHorizontal: 1,
    textAlign: "right",
    fontSize: 5.8,
  },
  detailHeaderText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 5.4,
  },
  detailLetterText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 5.2,
    textAlign: "center",
  },
  tableSectionTitle: {
    marginTop: 8,
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
  },
  footerNote: {
    marginTop: 6,
    fontSize: 7,
  },
});

function SummaryRuleRow({
  number,
  label,
  value,
  emphasize = false,
}: {
  number: string;
  label: string;
  value: number;
  emphasize?: boolean;
}) {
  return (
    <View style={styles.ruleRow}>
      <Text style={[styles.ruleCellNumber, emphasize ? styles.emphasized : {}]}>
        {number}
      </Text>
      <Text style={[styles.ruleCellLabel, emphasize ? styles.emphasized : {}]}>
        {label}
      </Text>
      <Text style={[styles.ruleCellValue, emphasize ? styles.emphasized : {}]}>
        {formatMoney(value)}
      </Text>
    </View>
  );
}

function DetailTable({
  rows,
  totalsLabel,
  includeTotals = true,
}: {
  rows: ContinuationRow[];
  totalsLabel: string;
  includeTotals?: boolean;
}) {
  const totals = rows.reduce<ContinuationRow>(
    (acc, row) => ({
      itemNo: "",
      budgetCode: "",
      description: totalsLabel,
      scheduledValue: acc.scheduledValue + row.scheduledValue,
      previousWork: acc.previousWork + row.previousWork,
      thisPeriodWork: acc.thisPeriodWork + row.thisPeriodWork,
      materialsStored: acc.materialsStored + row.materialsStored,
      totalCompletedStored: acc.totalCompletedStored + row.totalCompletedStored,
      percentComplete: 0,
      balanceToFinish: acc.balanceToFinish + row.balanceToFinish,
      retainage: acc.retainage + row.retainage,
    }),
    {
      itemNo: "",
      budgetCode: "",
      description: totalsLabel,
      scheduledValue: 0,
      previousWork: 0,
      thisPeriodWork: 0,
      materialsStored: 0,
      totalCompletedStored: 0,
      percentComplete: 0,
      balanceToFinish: 0,
      retainage: 0,
    },
  );

  totals.percentComplete =
    totals.scheduledValue > 0
      ? (totals.totalCompletedStored / totals.scheduledValue) * 100
      : 0;

  const renderRow = (row: ContinuationRow, key: string, emphasize = false) => (
    <View key={key} style={styles.detailRow} wrap={false}>
      <Text style={[styles.detailItem, emphasize ? styles.emphasized : {}]}>
        {row.itemNo}
      </Text>
      <Text style={[styles.detailBudget, emphasize ? styles.emphasized : {}]}>
        {row.budgetCode}
      </Text>
      <Text
        style={[styles.detailDescription, emphasize ? styles.emphasized : {}]}
      >
        {row.description}
      </Text>
      <Text style={[styles.detailNumber, emphasize ? styles.emphasized : {}]}>
        {formatMoney(row.scheduledValue)}
      </Text>
      <Text style={[styles.detailNumber, emphasize ? styles.emphasized : {}]}>
        {formatMoney(row.previousWork)}
      </Text>
      <Text
        style={[
          styles.detailNarrowNumber,
          emphasize ? styles.emphasized : {},
        ]}
      >
        {formatMoney(row.thisPeriodWork)}
      </Text>
      <Text
        style={[styles.detailNarrowNumber, emphasize ? styles.emphasized : {}]}
      >
        {formatMoney(row.materialsStored)}
      </Text>
      <Text style={[styles.detailTotal, emphasize ? styles.emphasized : {}]}>
        {formatMoney(row.totalCompletedStored)}
      </Text>
      <Text style={[styles.detailPercent, emphasize ? styles.emphasized : {}]}>
        {formatPercent(row.percentComplete)}
      </Text>
      <Text style={[styles.detailBalance, emphasize ? styles.emphasized : {}]}>
        {formatMoney(row.balanceToFinish)}
      </Text>
      <Text style={[styles.detailRetainage, emphasize ? styles.emphasized : {}]}>
        {formatMoney(row.retainage)}
      </Text>
    </View>
  );

  return (
    <View style={styles.detailTable}>
      <View style={styles.detailLetterRow} wrap={false}>
        <Text style={[styles.detailItem, styles.detailLetterText]}>A</Text>
        <Text style={[styles.detailBudget, styles.detailLetterText]}>B</Text>
        <Text style={[styles.detailDescription, styles.detailLetterText]} />
        <Text style={[styles.detailNumber, styles.detailLetterText]}>C</Text>
        <Text style={[styles.detailNumber, styles.detailLetterText]}>D</Text>
        <Text style={[styles.detailNarrowNumber, styles.detailLetterText]}>E</Text>
        <Text style={[styles.detailNarrowNumber, styles.detailLetterText]}>F</Text>
        <Text style={[styles.detailTotal, styles.detailLetterText]}>G</Text>
        <Text style={[styles.detailPercent, styles.detailLetterText]} />
        <Text style={[styles.detailBalance, styles.detailLetterText]}>H</Text>
        <Text style={[styles.detailRetainage, styles.detailLetterText]}>I</Text>
      </View>
      <View style={styles.detailHeaderRow} wrap={false}>
        <Text style={[styles.detailItem, styles.detailHeaderText]}>ITEM NO.</Text>
        <Text style={[styles.detailBudget, styles.detailHeaderText]}>
          BUDGET CODE
        </Text>
        <Text style={[styles.detailDescription, styles.detailHeaderText]}>
          DESCRIPTION OF WORK
        </Text>
        <Text style={[styles.detailNumber, styles.detailHeaderText]}>
          {"SCHEDULED\nVALUE"}
        </Text>
        <Text style={[styles.detailNumber, styles.detailHeaderText]}>
          {"FROM PREVIOUS\nAPPLICATION\n(D + E)"}
        </Text>
        <Text style={[styles.detailNarrowNumber, styles.detailHeaderText]}>
          {"THIS\nPERIOD"}
        </Text>
        <Text style={[styles.detailNarrowNumber, styles.detailHeaderText]}>
          {"MATERIALS\nPRESENTLY STORED\n(NOT IN D OR E)"}
        </Text>
        <Text style={[styles.detailTotal, styles.detailHeaderText]}>
          {"TOTAL COMPLETED\nAND STORED TO DATE\n(D + E + F)"}
        </Text>
        <Text style={[styles.detailPercent, styles.detailHeaderText]}>
          {"%\n(G / C)"}
        </Text>
        <Text style={[styles.detailBalance, styles.detailHeaderText]}>
          {"BALANCE TO\nFINISH\n(C - G)"}
        </Text>
        <Text style={[styles.detailRetainage, styles.detailHeaderText]}>
          RETAINAGE
        </Text>
      </View>
      {rows.map((row, index) => renderRow(row, `${row.itemNo}-${index}`))}
      {includeTotals ? renderRow(totals, `${totalsLabel}-totals`, true) : null}
    </View>
  );
}

export function SubcontractorInvoicePdfDocument({
  data,
}: {
  data: SubcontractorInvoicePdfData;
}) {
  const invoiceNumber = data.invoice_number || `APP-${data.application_number}`;
  const contractorBlock = formatAddressBlock(
    data.gc_company_name,
    data.gc_company_address,
    data.gc_company_city,
    data.gc_company_state,
    data.gc_company_zip,
  );
  const subcontractorBlock = formatAddressBlock(
    data.contract_company_name,
    data.contract_company_address,
    data.contract_company_city,
    data.contract_company_state,
    data.contract_company_zip,
  );
  const periodText =
    data.period_start && data.period_end
      ? `${formatDateShort(data.period_start)} - ${formatDateShort(data.period_end)}`
      : "—";
  const certificateDate = formatDate(data.billing_date || data.created_at);
  const submittedDate = formatDate(data.created_at, "");
  const { contractRows, changeOrderRows, grandTotals } = buildContinuationSections(
    data,
  );

  return (
    <Document>
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <Text style={styles.pageFooter} fixed>
          Alleato group subcontractor invoice
        </Text>
        <View style={styles.pageHeader}>
          <Text style={styles.headerTitle}>
            APPLICATION AND CERTIFICATE FOR PAYMENT
          </Text>
          <View>
            <Text style={styles.headerSubTitle}>DOCUMENT SUMMARY SHEET</Text>
            <Text style={styles.pageCount}>Page 1 of 2</Text>
          </View>
        </View>

        <View style={styles.twoColumn}>
          <View style={styles.leftColumn}>
            <View style={styles.metaGrid}>
              <View style={styles.metaColumn}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>TO CONTRACTOR:</Text>
                  {contractorBlock.map((line) => (
                    <Text key={`to-${line}`} style={styles.fieldLine}>
                      {line}
                    </Text>
                  ))}
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>FROM SUBCONTRACTOR:</Text>
                  {subcontractorBlock.map((line) => (
                    <Text key={`from-${line}`} style={styles.fieldLine}>
                      {line}
                    </Text>
                  ))}
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>SUBCONTRACT FOR:</Text>
                  <Text>{safeText(data.contract_title || data.project_name)}</Text>
                </View>
              </View>

              <View style={styles.metaColumn}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>PROJECT:</Text>
                  <Text style={styles.fieldLine}>{safeText(data.project_name)}</Text>
                  <Text style={styles.fieldLine}>{safeText(data.project_address)}</Text>
                </View>
              </View>
            </View>

            <Text style={styles.sectionTitle}>
              SUBCONTRACTOR'S APPLICATION FOR PAYMENT
            </Text>
            <Text style={styles.bodyText}>
              Application is made for payment, as shown below, in connection with
              the Subcontract. Continuation Sheet is attached.
            </Text>

            <View style={styles.ruleTable}>
              <SummaryRuleRow
                number="1."
                label="Original Contract Sum"
                value={data.rollup.original_contract_sum}
              />
              <SummaryRuleRow
                number="2."
                label="Net change by change orders"
                value={data.rollup.net_change_by_change_orders}
              />
              <SummaryRuleRow
                number="3."
                label="Contract Sum to date (Line 1 ± 2)"
                value={data.rollup.contract_sum_to_date}
                emphasize
              />
              <SummaryRuleRow
                number="4."
                label="Total completed and stored to date (Column G on detail sheet)"
                value={data.rollup.total_completed_and_stored}
              />
              <SummaryRuleRow
                number="5a."
                label="0.00% of completed work"
                value={data.rollup.total_work_retainage}
              />
              <SummaryRuleRow
                number="5b."
                label="0.00% of stored material"
                value={data.rollup.total_materials_retainage}
              />
              <SummaryRuleRow
                number="5."
                label="Total retainage"
                value={data.rollup.total_retainage}
              />
              <SummaryRuleRow
                number="6."
                label="Total earned less retainage (Line 4 less Line 5)"
                value={data.rollup.total_earned_less_retainage}
                emphasize
              />
              <SummaryRuleRow
                number="7."
                label="Less previous certificates for payment"
                value={data.rollup.less_previous_certificates}
              />
              <SummaryRuleRow
                number="8."
                label="Current payment due"
                value={data.rollup.current_payment_due}
                emphasize
              />
              <SummaryRuleRow
                number="9."
                label="Balance to finish, including retainage (Line 3 less Line 6)"
                value={data.rollup.balance_to_finish_including_retainage}
              />
            </View>

            <View style={styles.changeSummary}>
              <View style={styles.changeSummaryHeader}>
                <Text style={[styles.changeCellLabel, styles.emphasized]}>
                  CHANGE ORDER SUMMARY
                </Text>
                <Text style={[styles.changeCellValue, styles.emphasized]}>
                  ADDITIONS
                </Text>
                <Text style={[styles.changeCellValueLast, styles.emphasized]}>
                  DEDUCTIONS
                </Text>
              </View>
              <View style={styles.changeSummaryRow}>
                <Text style={styles.changeCellLabel}>
                  Total changes approved in previous months by Owner/Client:
                </Text>
                <Text style={styles.changeCellValue}>
                  {formatMoney(data.rollup.change_order_additions ?? 0)}
                </Text>
                <Text style={styles.changeCellValueLast}>
                  {formatMoney(Math.abs(data.rollup.change_order_deductions ?? 0))}
                </Text>
              </View>
              <View style={styles.changeSummaryRow}>
                <Text style={styles.changeCellLabel}>Total approved this month:</Text>
                <Text style={styles.changeCellValue}>{formatMoney(0)}</Text>
                <Text style={styles.changeCellValueLast}>{formatMoney(0)}</Text>
              </View>
              <View style={styles.changeSummaryRow}>
                <Text style={[styles.changeCellLabel, styles.emphasized]}>Totals:</Text>
                <Text style={[styles.changeCellValue, styles.emphasized]}>
                  {formatMoney(data.rollup.change_order_additions ?? 0)}
                </Text>
                <Text style={[styles.changeCellValueLast, styles.emphasized]}>
                  {formatMoney(Math.abs(data.rollup.change_order_deductions ?? 0))}
                </Text>
              </View>
              <View style={styles.changeSummaryRow}>
                <Text style={styles.changeCellLabel}>Net change by change orders:</Text>
                <Text style={styles.changeCellValueLast}>
                  {formatMoney(data.rollup.net_change_by_change_orders)}
                </Text>
                <Text style={styles.changeCellValueLast} />
              </View>
            </View>
          </View>

          <View style={styles.rightColumn}>
            <View style={styles.summarySheet}>
              {[
                ["APPLICATION NO:", String(data.application_number)],
                ["INVOICE NO:", invoiceNumber],
                ["PERIOD:", periodText],
                ["PROJECT NO:", safeText(data.project_number)],
                ["CONTRACT NO:", safeText(data.contract_number)],
                ["CONTRACT DATE:", formatDate(data.contract_date)],
                ["CERTIFICATE DATE:", certificateDate],
                ["SUBMITTED DATE:", submittedDate || "—"],
              ].map(([label, value]) => (
                <View key={label} style={styles.summarySheetRow}>
                  <Text style={styles.summarySheetLabel}>{label}</Text>
                  <Text style={styles.summarySheetValue}>{value}</Text>
                </View>
              ))}
            </View>

            <View style={styles.signatureBlock}>
              <Text style={styles.bodyText}>
                The undersigned certifies that to the best of the
                Subcontractor&apos;s knowledge, information and belief, the Work
                covered by this Application for Payment has been completed in
                accordance with the Subcontract Documents, that all amounts have
                been paid by the Subcontractor for Work which previous
                Certificates for payment were issued and payments received from
                the Owner/Client, and that current payments shown herein is now
                due.
              </Text>
              <Text style={styles.bodyText}>
                SUBCONTRACTOR: {safeText(data.contract_company_name)}
              </Text>
              <View style={styles.signatureLineRow}>
                <Text>By:</Text>
                <View style={styles.signatureLine} />
                <Text>Date:</Text>
                <View style={styles.shortLine} />
              </View>
              <Text style={[styles.bodyText, { marginTop: 10 }]}>State of:</Text>
              <View style={styles.notaryLine} />
              <Text style={[styles.bodyText, { marginTop: 8 }]}>County of:</Text>
              <View style={styles.notaryLine} />
              <Text style={[styles.bodyText, { marginTop: 8 }]}>
                Subscribed and sworn to before me this day of
              </Text>
              <View style={styles.notaryLine} />
              <Text style={[styles.bodyText, { marginTop: 8 }]}>Notary Public:</Text>
              <View style={styles.notaryLine} />
              <Text style={[styles.bodyText, { marginTop: 8 }]}>
                My commission expires:
              </Text>
              <View style={styles.notaryLine} />
            </View>
          </View>
        </View>
      </Page>

      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <Text style={styles.pageFooter} fixed>
          Alleato group subcontractor invoice
        </Text>
        <View style={styles.pageHeader}>
          <Text style={styles.headerTitle}>CONTINUATION SHEET</Text>
          <View>
            <Text style={styles.headerSubTitle}>DOCUMENT DETAIL SHEET</Text>
            <Text style={styles.pageCount}>Page 2 of 2</Text>
          </View>
        </View>

        <Text style={styles.bodyText}>
          Document SUMMARY SHEET, APPLICATION AND CERTIFICATE FOR PAYMENT,
          containing Contractor&apos;s signed Certification is attached.
        </Text>
        <Text style={styles.bodyText}>
          Use Column I on Contracts where variable retainage for line items apply.
        </Text>

        <View style={styles.continuationMeta}>
          <View style={styles.continuationMetaBlock}>
            <Text style={styles.fieldLabel}>APPLICATION NUMBER:</Text>
            <Text>{String(data.application_number)}</Text>
          </View>
          <View style={styles.continuationMetaBlock}>
            <Text style={styles.fieldLabel}>APPLICATION DATE:</Text>
            <Text>{formatDate(data.billing_date)}</Text>
          </View>
          <View style={styles.continuationMetaBlock}>
            <Text style={styles.fieldLabel}>PERIOD:</Text>
            <Text>{periodText}</Text>
          </View>
        </View>

        <Text style={styles.tableSectionTitle}>Contract Lines</Text>
        <DetailTable rows={contractRows} totalsLabel="TOTALS:" />

        <Text style={styles.tableSectionTitle}>Change Orders</Text>
        <DetailTable rows={changeOrderRows} totalsLabel="TOTALS:" />

        <Text style={styles.tableSectionTitle}>Grand Totals</Text>
        <DetailTable
          rows={[grandTotals]}
          totalsLabel="GRAND TOTALS:"
          includeTotals={false}
        />

        {data.notes ? (
          <Text style={styles.footerNote}>Notes: {data.notes}</Text>
        ) : null}
      </Page>
    </Document>
  );
}

export async function renderSubcontractorInvoicePdfBuffer(
  data: SubcontractorInvoicePdfData,
): Promise<Buffer> {
  return renderToBuffer(<SubcontractorInvoicePdfDocument data={data} />);
}
