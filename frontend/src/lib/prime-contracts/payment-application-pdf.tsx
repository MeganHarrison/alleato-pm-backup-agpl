import {
  Document,
  Image as PdfImage,
  Page,
  Path,
  StyleSheet,
  Svg,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import React from "react";

import {
  computePrimePaymentApplication,
  type PaymentApplicationSummary,
  type PaymentApplicationSummaryLineItem,
} from "@/lib/invoicing/payment-application";

const ALLEATO_ORANGE = "#df8324";
const ALLEATO_BLACK = "#2f2f2f";

const ALLEATO_CONTACTS = [
  {
    name: "Brandon Clymer",
    title: "CEO",
    email: "bclymer@alleatogroup.com",
    phone: "317.760.0088",
  },
  {
    name: "Jesse Dawson",
    title: "Vice President",
    email: "jdawson@alleatogroup.com",
    phone: "502.612.2089",
  },
] as const;

export interface PaymentApplicationPdfData {
  id: string;
  applicationNumber: string;
  status: string;
  billingDate: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  notes: string | null;
  previousPaymentDue: number;
  lineItems: PaymentApplicationSummaryLineItem[];
  project: {
    name: string | null;
    number: string | null;
    address: string | null;
    state: string | null;
  } | null;
  contract: {
    title: string;
    contractNumber: string | null;
    startDate: string | null;
    originalContractValue: number;
    revisedContractValue: number;
  };
}

function fmtCurrency(value: number | null | undefined): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

function projectLocation(data: PaymentApplicationPdfData): string {
  return [data.project?.address, data.project?.state].filter(Boolean).join(", ");
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingHorizontal: 64,
    paddingBottom: 58,
    fontFamily: "Helvetica",
    color: ALLEATO_BLACK,
    backgroundColor: "#ffffff",
  },
  logoWrap: {
    alignItems: "center",
    marginBottom: 14,
  },
  logo: {
    width: 210,
    objectFit: "contain",
  },
  topRule: {
    height: 14,
    marginHorizontal: -64,
    marginBottom: 28,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 32,
    marginBottom: 34,
  },
  projectMeta: {
    flexGrow: 1,
    maxWidth: 260,
    gap: 8,
  },
  metaLine: {
    flexDirection: "row",
    fontSize: 11,
    lineHeight: 1.2,
  },
  metaLabel: {
    fontFamily: "Helvetica-Bold",
    width: 62,
  },
  contacts: {
    flexDirection: "row",
    gap: 34,
  },
  contact: {
    width: 148,
    gap: 4,
  },
  contactName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
  },
  contactDetail: {
    fontSize: 10,
    color: "#4b4b4b",
    lineHeight: 1.18,
  },
  titleBlock: {
    marginBottom: 12,
  },
  title: {
    fontSize: 17,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 10,
    color: "#666666",
  },
  rows: {
    marginTop: 4,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 0.6,
    borderBottomColor: "#cfcfcf",
    paddingVertical: 7.5,
  },
  summaryNumber: {
    width: 34,
    fontSize: 9,
    color: "#777777",
    fontFamily: "Helvetica-Bold",
  },
  summaryLabel: {
    flexGrow: 1,
    fontSize: 11,
    color: "#585858",
  },
  summaryLabelEmphasis: {
    fontFamily: "Helvetica-Bold",
    color: ALLEATO_BLACK,
  },
  summaryValue: {
    width: 154,
    textAlign: "right",
    fontSize: 11,
    color: "#565656",
  },
  rollup: {
    marginTop: 12,
    alignSelf: "flex-end",
    width: 260,
    gap: 7,
  },
  rollupLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 10,
  },
  rollupLabel: {
    fontFamily: "Helvetica-Bold",
  },
  totalBox: {
    marginTop: 13,
    backgroundColor: "#f1f1f1",
    borderRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 28,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 34,
  },
  totalLabel: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
  },
  totalValue: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
  },
  notes: {
    marginTop: 18,
    fontSize: 9,
    lineHeight: 1.35,
    color: "#666666",
  },
  footer: {
    position: "absolute",
    left: 64,
    right: 64,
    bottom: 24,
    alignItems: "center",
  },
  footerAddress: {
    fontSize: 9,
    color: ALLEATO_BLACK,
    marginBottom: 8,
  },
  footerRule: {
    height: 14,
    marginHorizontal: -64,
  },
});

function Rule({ flipped = false }: { flipped?: boolean }) {
  return (
    <Svg style={flipped ? styles.footerRule : styles.topRule} viewBox="0 0 612 18">
      {flipped ? (
        <>
          <Path d="M0 0 H315 L346 18 H0 Z" fill={ALLEATO_BLACK} />
          <Path d="M354 0 H612 V18 H386 Z" fill={ALLEATO_ORANGE} />
        </>
      ) : (
        <>
          <Path d="M0 0 H286 L278 18 H0 Z" fill={ALLEATO_ORANGE} />
          <Path d="M302 0 H612 V18 H294 Z" fill={ALLEATO_BLACK} />
        </>
      )}
    </Svg>
  );
}

function InvoiceSummaryRows({ summary }: { summary: PaymentApplicationSummary }) {
  return (
    <View style={styles.rows}>
      {summary.lines.map((line) => (
        <View key={line.number} style={styles.summaryRow} wrap={false}>
          <Text style={styles.summaryNumber}>{line.number}</Text>
          <Text
            style={[
              styles.summaryLabel,
              ...(line.highlight ? [styles.summaryLabelEmphasis] : []),
              ...(line.indent ? [{ paddingLeft: 16 }] : []),
            ]}
          >
            {line.label}
          </Text>
          <Text style={styles.summaryValue}>{fmtCurrency(line.value)}</Text>
        </View>
      ))}
    </View>
  );
}

export function PaymentApplicationPdfDocument({
  data,
}: {
  data: PaymentApplicationPdfData;
}) {
  const summary = computePrimePaymentApplication({
    lineItems: data.lineItems,
    contract: {
      original_contract_value: data.contract.originalContractValue,
      revised_contract_value: data.contract.revisedContractValue,
    },
    previousPaymentDue: data.previousPaymentDue,
  });

  const logoPath = `${process.cwd()}/public/Alleato-Group-Logo_Dark.png`;
  const location = projectLocation(data);
  const projectName = data.project?.name ?? "Unknown Project";

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.logoWrap}>
          <PdfImage src={logoPath} style={styles.logo} />
        </View>
        <Rule />

        <View style={styles.metaRow}>
          <View style={styles.projectMeta}>
            <View style={styles.metaLine}>
              <Text style={styles.metaLabel}>Project: </Text>
              <Text>{projectName}</Text>
            </View>
            {location ? (
              <View style={styles.metaLine}>
                <Text style={styles.metaLabel}>Location: </Text>
                <Text>{location}</Text>
              </View>
            ) : null}
            <View style={styles.metaLine}>
              <Text style={styles.metaLabel}>Invoice: </Text>
              <Text>{data.applicationNumber}</Text>
            </View>
            <View style={styles.metaLine}>
              <Text style={styles.metaLabel}>Period: </Text>
              <Text>
                {fmtDate(data.periodFrom)} - {fmtDate(data.periodTo)}
              </Text>
            </View>
          </View>

          <View style={styles.contacts}>
            {ALLEATO_CONTACTS.map((contact) => (
              <View key={contact.email} style={styles.contact}>
                <Text style={styles.contactName}>{contact.name}</Text>
                <Text style={styles.contactDetail}>{contact.title}</Text>
                <Text style={styles.contactDetail}>{contact.email}</Text>
                <Text style={styles.contactDetail}>{contact.phone}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.title}>Invoice Summary</Text>
          <Text style={styles.subtitle}>
            Contract {data.contract.contractNumber ?? "-"} - {data.contract.title} | Billing Date{" "}
            {fmtDate(data.billingDate)}
          </Text>
        </View>

        <InvoiceSummaryRows summary={summary} />

        <View style={styles.rollup}>
          <View style={styles.rollupLine}>
            <Text style={styles.rollupLabel}>Total Completed</Text>
            <Text>{fmtCurrency(summary.total_completed_and_stored)}</Text>
          </View>
          <View style={styles.rollupLine}>
            <Text style={styles.rollupLabel}>Retainage</Text>
            <Text>{fmtCurrency(summary.total_retainage)}</Text>
          </View>
          <View style={styles.rollupLine}>
            <Text style={styles.rollupLabel}>Previously Certified</Text>
            <Text>{fmtCurrency(summary.less_previous_certificates)}</Text>
          </View>
        </View>

        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>Current Payment Due</Text>
          <Text style={styles.totalValue}>{fmtCurrency(summary.current_payment_due)}</Text>
        </View>

        {data.notes ? <Text style={styles.notes}>Notes: {data.notes}</Text> : null}

        <View style={styles.footer} fixed>
          <Text style={styles.footerAddress}>
            701 94th Ave. N, Suite #118 St. Petersburg, FL 33702     8383 Craig Street #150 Indianapolis, IN 46250
          </Text>
          <Rule flipped />
        </View>
      </Page>
    </Document>
  );
}

export async function renderPaymentApplicationPdfBuffer(
  data: PaymentApplicationPdfData,
): Promise<Buffer> {
  return renderToBuffer(<PaymentApplicationPdfDocument data={data} />);
}
