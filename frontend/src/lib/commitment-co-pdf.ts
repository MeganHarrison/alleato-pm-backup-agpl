import { buildBrandedDocumentHtml } from "@/lib/documents/branded-letterhead";

function esc(value: string | number | null | undefined): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtCurrency(value: number | null | undefined): string {
  if (value == null) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return `${month}/${day}/${year}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

function yesNo(value: boolean | null | undefined): string {
  if (value == null) return "—";
  return value ? "Yes" : "No";
}

function placeholder(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? esc(trimmed) : "—";
}

function formatPartyAddress(lines: Array<string | null | undefined>): string {
  const filtered = lines.map((line) => line?.trim()).filter(Boolean);
  return filtered.length > 0 ? filtered.map((line) => esc(line)).join("<br />") : "—";
}

function renderMetaField(label: string, value: string | null | undefined): string {
  return `
    <div class="meta-field">
      <div class="meta-label">${esc(label)}</div>
      <div class="meta-value">${value && value !== "—" ? value : "—"}</div>
    </div>
  `;
}

export interface CommitmentCoPdfLineItem {
  budgetCodeLabel: string;
  description: string | null;
  amount: number | null;
}

export interface CommitmentCoPdfAttachment {
  fileName: string;
  attachedAt?: string | null;
}

export interface CommitmentCoPdfData {
  changeOrderNumber: string | null;
  title: string | null;
  description: string | null;
  status: string | null;
  amount: number | null;
  requestedDate: string | null;
  approvedDate: string | null;
  createdAt: string | null;
  createdByName: string | null;
  approvedByName: string | null;
  designatedReviewer: string | null;
  requestReceivedFrom: string | null;
  revision: number | null;
  dueDate: string | null;
  invoicedDate: string | null;
  paidDate: string | null;
  location: string | null;
  reference: string | null;
  changeReason: string | null;
  paidInFull: boolean | null;
  executed: boolean | null;
  accountingMethod: string | null;
  scheduleImpact: number | null;
  fieldChange: boolean | null;
  signedChangeOrderReceivedDate: string | null;
  commitmentNumber: string | null;
  commitmentTitle: string | null;
  projectName: string | null;
  projectNumber: string | null;
  projectAddressLines: string[];
  contractorName: string;
  contractorAddressLines: string[];
  vendorName: string | null;
  vendorAddressLines: string[];
  attachments: CommitmentCoPdfAttachment[];
  lineItems: CommitmentCoPdfLineItem[];
  originalContractSum: number;
  priorAuthorizedChangeOrders: number;
}

export function buildCommitmentCoPdfHtml(data: CommitmentCoPdfData): string {
  const printedOn = new Date().toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const title = data.title?.trim() || data.description?.trim() || "Commitment Change Order";
  const number = data.changeOrderNumber?.trim() || "CCO";
  const totalAmount = data.amount ?? data.lineItems.reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const lineItemSubtotal = data.lineItems.reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const priorContractSum = data.originalContractSum + data.priorAuthorizedChangeOrders;
  const newContractSum = priorContractSum + totalAmount;
  const contractTimeSentence =
    data.scheduleImpact && data.scheduleImpact !== 0
      ? `The contract time will be changed by ${Math.abs(data.scheduleImpact)} ${Math.abs(data.scheduleImpact) === 1 ? "day" : "days"} by this Change Order.`
      : "The contract time will not be changed by this Change Order.";

  const lineItemRows = data.lineItems.length
    ? data.lineItems
        .map(
          (item, index) => `
            <tr>
              <td class="line-num">${index + 1}</td>
              <td>${placeholder(item.budgetCodeLabel)}</td>
              <td>${placeholder(item.description)}</td>
              <td class="amount">${fmtCurrency(item.amount)}</td>
            </tr>`,
        )
        .join("")
    : `
      <tr>
        <td colspan="4" class="empty">No line items</td>
      </tr>`;

  const attachmentsMarkup = data.attachments.length
    ? data.attachments
        .map((attachment) => {
          const attachedAt = attachment.attachedAt ? ` <span class="attachment-date">(${esc(fmtDate(attachment.attachedAt))})</span>` : "";
          return `<li>${esc(attachment.fileName)}${attachedAt}</li>`;
        })
        .join("")
    : "<li>—</li>";

  const bodyHtml = `
    <section class="cco-shell">
      <div class="topline">
        <div class="topline-left">
          <div class="contractor-name">${esc(data.contractorName)}</div>
          <div class="address-block">${formatPartyAddress(data.contractorAddressLines)}</div>
        </div>
        <div class="topline-right">
          <div class="project-line">${placeholder(
            [data.projectNumber, data.projectName].filter(Boolean).join(" - "),
          )}</div>
          <div class="address-block">${formatPartyAddress(data.projectAddressLines)}</div>
        </div>
      </div>

      <h1 class="document-title">Subcontract Change Order #${esc(number)}: ${esc(title)}</h1>

      <div class="party-grid">
        <div class="party-card">
          <div class="party-label">Contract Company</div>
          <div class="party-name">${placeholder(data.vendorName)}</div>
          <div class="address-block">${formatPartyAddress(data.vendorAddressLines)}</div>
        </div>
        <div class="party-card">
          <div class="party-label">Contract For</div>
          <div class="party-name">${placeholder(
            [data.commitmentNumber, data.commitmentTitle].filter(Boolean).join(":"),
          )}</div>
        </div>
      </div>

      <div class="meta-grid">
        ${renderMetaField("Date Created", esc(fmtDate(data.createdAt)))}
        ${renderMetaField(
          "Created By",
          placeholder(
            data.createdByName ? `${data.createdByName} (${data.contractorName})` : null,
          ),
        )}
        ${renderMetaField("Contract Status", placeholder(data.status))}
        ${renderMetaField("Revision", data.revision == null ? "0" : esc(String(data.revision)))}
        ${renderMetaField("Request Received From", placeholder(data.requestReceivedFrom))}
        ${renderMetaField("Location", placeholder(data.location))}
        ${renderMetaField("Designated Reviewer", placeholder(data.designatedReviewer))}
        ${renderMetaField("Reviewed By", placeholder(data.approvedByName))}
        ${renderMetaField("Due Date", esc(fmtDate(data.dueDate)))}
        ${renderMetaField("Review Date", esc(fmtDate(data.approvedDate)))}
        ${renderMetaField("Invoiced Date", esc(fmtDate(data.invoicedDate)))}
        ${renderMetaField("Paid Date", esc(fmtDate(data.paidDate)))}
        ${renderMetaField("Reference", placeholder(data.reference))}
        ${renderMetaField("Change Reason", placeholder(data.changeReason))}
        ${renderMetaField("Paid In Full", yesNo(data.paidInFull))}
        ${renderMetaField("Executed", yesNo(data.executed))}
        ${renderMetaField("Accounting Method", placeholder(data.accountingMethod))}
        ${renderMetaField(
          "Schedule Impact",
          data.scheduleImpact == null ? "—" : esc(`${data.scheduleImpact} day${Math.abs(data.scheduleImpact) === 1 ? "" : "s"}`),
        )}
        ${renderMetaField("Field Change", yesNo(data.fieldChange))}
        ${renderMetaField("Signed Change Order Received Date", esc(fmtDate(data.signedChangeOrderReceivedDate)))}
      </div>

      <section class="text-section">
        <div class="section-label">Description</div>
        <p>${placeholder(data.description)}</p>
      </section>

      <section class="text-section">
        <div class="section-label">Attachments</div>
        <ul class="attachments-list">${attachmentsMarkup}</ul>
      </section>

      <section class="line-items-section">
        <div class="section-label">Change Order Line Items</div>
        <table>
          <thead>
            <tr>
              <th class="line-num">#</th>
              <th>Budget Code</th>
              <th>Description</th>
              <th class="amount">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${lineItemRows}
          </tbody>
        </table>
      </section>

      <section class="financial-summary">
        <div class="summary-row">
          <div class="summary-label">Grand Total</div>
          <div class="summary-value">${fmtCurrency(totalAmount)}</div>
        </div>
        <div class="summary-row">
          <div class="summary-label">The original (Contract Sum)</div>
          <div class="summary-value">${fmtCurrency(data.originalContractSum)}</div>
        </div>
        <div class="summary-row">
          <div class="summary-label">Net change by previously authorized Change Orders</div>
          <div class="summary-value">${fmtCurrency(data.priorAuthorizedChangeOrders)}</div>
        </div>
        <div class="summary-row">
          <div class="summary-label">The contract sum prior to this Change Order was</div>
          <div class="summary-value">${fmtCurrency(priorContractSum)}</div>
        </div>
        <div class="summary-row">
          <div class="summary-label">The contract sum will be increased by this Change Order in the amount of</div>
          <div class="summary-value">${fmtCurrency(totalAmount)}</div>
        </div>
        <div class="summary-row total">
          <div class="summary-label">The new contract sum including this Change Order will be</div>
          <div class="summary-value">${fmtCurrency(newContractSum)}</div>
        </div>
      </section>

      <p class="contract-time-note">${esc(contractTimeSentence)}</p>

      <section class="signature-section">
        <div class="signature-party">
          <div class="party-name">${esc(data.contractorName)}</div>
          <div class="address-block">${formatPartyAddress(data.contractorAddressLines)}</div>
          <div class="signature-row">
            <div class="signature-line"></div>
            <div class="signature-label">Signature</div>
          </div>
          <div class="signature-row date">
            <div class="signature-line"></div>
            <div class="signature-label">Date</div>
          </div>
        </div>
        <div class="signature-party">
          <div class="party-name">${placeholder(data.vendorName)}</div>
          <div class="address-block">${formatPartyAddress(data.vendorAddressLines)}</div>
          <div class="signature-row">
            <div class="signature-line"></div>
            <div class="signature-label">Signature</div>
          </div>
          <div class="signature-row date">
            <div class="signature-line"></div>
            <div class="signature-label">Date</div>
          </div>
        </div>
      </section>

      <div class="printed-on">Printed On: ${esc(printedOn)}</div>
      <div class="sr-only">Line Items Subtotal ${fmtCurrency(lineItemSubtotal)}</div>
    </section>
  `;

  return buildBrandedDocumentHtml({
    title: `${number} - ${title}`,
    renderHeading: false,
    bodyHtml,
    contentWidth: "100%",
    renderFooterInBody: false,
  }).replace(
    "</head>",
    `<style>
      .cco-shell {
        width: 100%;
        max-width: 100%;
        color: #1f2933;
        font-size: 12px;
      }
      .topline {
        display: flex;
        justify-content: space-between;
        gap: 24px;
        margin-bottom: 18px;
      }
      .topline-left,
      .topline-right {
        width: 48%;
      }
      .topline-right {
        text-align: right;
      }
      .contractor-name,
      .project-line,
      .party-name {
        font-size: 14px;
        font-weight: 700;
        color: #171717;
      }
      .address-block {
        margin-top: 4px;
        color: #4b5563;
        line-height: 1.45;
      }
      .document-title {
        margin: 0 0 18px;
        font-size: 24px;
        line-height: 1.2;
        color: #171717;
      }
      .party-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin-bottom: 18px;
      }
      .party-card {
        border: 1px solid #d9dde3;
        padding: 14px 16px;
      }
      .party-label,
      .section-label {
        margin-bottom: 8px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #8a4b08;
      }
      .meta-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0;
        border: 1px solid #d9dde3;
        margin-bottom: 18px;
      }
      .meta-field {
        display: grid;
        grid-template-columns: 190px 1fr;
        gap: 12px;
        padding: 9px 12px;
        border-bottom: 1px solid #e7eaee;
      }
      .meta-field:nth-last-child(-n + 2) {
        border-bottom: 0;
      }
      .meta-label {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: #6b7280;
      }
      .meta-value {
        min-height: 16px;
        color: #171717;
      }
      .text-section {
        margin-bottom: 18px;
      }
      .text-section p {
        margin: 0;
        line-height: 1.55;
      }
      .attachments-list {
        margin: 0;
        padding-left: 18px;
        color: #171717;
      }
      .attachments-list li + li {
        margin-top: 4px;
      }
      .attachment-date {
        color: #6b7280;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        border: 1px solid #d9dde3;
        padding: 8px 10px;
        text-align: left;
        vertical-align: top;
      }
      th {
        background: #f3f4f6;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #4b5563;
      }
      .line-num {
        width: 42px;
        text-align: center;
      }
      .amount {
        width: 140px;
        text-align: right;
        white-space: nowrap;
      }
      .empty {
        text-align: center;
        color: #6b7280;
        padding: 18px 10px;
      }
      .financial-summary {
        width: 420px;
        margin: 16px 0 18px auto;
        border: 1px solid #d9dde3;
      }
      .summary-row {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 12px;
        padding: 9px 12px;
        border-bottom: 1px solid #e7eaee;
      }
      .summary-row:last-child {
        border-bottom: 0;
      }
      .summary-row.total {
        background: #f6efe8;
        font-weight: 700;
      }
      .summary-label {
        color: #171717;
      }
      .summary-value {
        text-align: right;
        white-space: nowrap;
      }
      .contract-time-note {
        margin: 0 0 20px;
        font-size: 12px;
      }
      .signature-section {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 28px;
        margin-top: 20px;
      }
      .signature-row {
        margin-top: 18px;
      }
      .signature-row.date {
        margin-top: 14px;
      }
      .signature-line {
        border-bottom: 1px solid #7b8088;
        height: 22px;
      }
      .signature-label {
        margin-top: 4px;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #6b7280;
      }
      .printed-on {
        margin-top: 18px;
        text-align: right;
        font-size: 10px;
        color: #6b7280;
      }
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
    </style></head>`,
  );
}
