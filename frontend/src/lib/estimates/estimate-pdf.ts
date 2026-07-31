import type { Database } from "@/types/database.types";

type EstimateRow = Database["public"]["Tables"]["estimates"]["Row"];
type GcItem = Database["public"]["Tables"]["estimate_gc_items"]["Row"];
type DetailItem = Database["public"]["Tables"]["estimate_detail_items"]["Row"];

const ALL_DIVISIONS: Array<{ code: string; name: string }> = [
  { code: "02", name: "Existing Conditions" },
  { code: "03", name: "Concrete" },
  { code: "04", name: "Masonry" },
  { code: "05", name: "Metals" },
  { code: "06", name: "Wood Plastics & Composites" },
  { code: "07", name: "Thermal & Moisture Protection" },
  { code: "08", name: "Openings" },
  { code: "09", name: "Finishes" },
  { code: "10", name: "Specialties" },
  { code: "11", name: "Equipment" },
  { code: "12", name: "Furnishings" },
  { code: "13", name: "Special Construction" },
  { code: "14", name: "Conveying Equipment" },
  { code: "21", name: "Fire Suppression" },
  { code: "22", name: "Plumbing" },
  { code: "23", name: "HVAC" },
  { code: "25", name: "Integrated Automation" },
  { code: "26", name: "Electrical" },
  { code: "27", name: "Communications" },
  { code: "28", name: "Electronic Safety & Security" },
  { code: "31", name: "Earthwork" },
  { code: "32", name: "Exterior Improvements" },
  { code: "33", name: "Utilities" },
  { code: "34", name: "Transportation" },
  { code: "50", name: "Design" },
  { code: "51", name: "Space Planning" },
  { code: "52", name: "Procurement" },
  { code: "53", name: "Construction Services" },
  { code: "54", name: "Miscellaneous Services" },
  { code: "55", name: "Other" },
];

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

const WEEKS_PER_MONTH = 4.334;

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function escapeHtml(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getEffectiveQty(
  item: GcItem,
  durationMonths: number,
  durationWeeks: number,
): number {
  if (item.qty_basis === "weeks") return durationWeeks;
  if (item.qty_basis === "months") {
    return durationMonths > 0
      ? durationMonths
      : Math.ceil(durationWeeks / WEEKS_PER_MONTH);
  }
  return item.qty || 1;
}

export function calculateDurationWeeks(months: number): number {
  return Number((Math.max(months, 0) * WEEKS_PER_MONTH).toFixed(3));
}

export function computeEstimateGcTotal(
  items: GcItem[],
  durationMonths: number,
  durationWeeks: number,
): number {
  return items.reduce((sum, item) => {
    const qty = getEffectiveQty(item, durationMonths, durationWeeks);
    return sum + qty * (item.rate ?? 0) * (item.allocation ?? 0);
  }, 0);
}

export function computeEstimateDetailDivisionTotal(
  items: DetailItem[],
  divCode: string,
): number {
  return items
    .filter((item) => item.division_code === divCode)
    .reduce((sum, item) => sum + (item.estimated_amount ?? 0), 0);
}

export function buildEstimatePrintHtml(opts: {
  estimate: EstimateRow;
  projectName: string;
  gcTotal: number;
  detailTotalsByDiv: Record<string, number>;
  subtotal: number;
  contingencyAmount: number;
  insurance: number;
  insuranceRate: number;
  fee: number;
  feeRate: number;
  grandTotal: number;
}): string {
  const divRows = [
    { code: "01", name: "General Conditions", total: opts.gcTotal },
    ...ALL_DIVISIONS.filter(
      (division) => (opts.detailTotalsByDiv[division.code] ?? 0) > 0,
    ).map((division) => ({
      code: division.code,
      name: division.name,
      total: opts.detailTotalsByDiv[division.code] ?? 0,
    })),
  ];

  const divisionRows = divRows
    .map(
      (division) =>
        `<tr><td style="padding:5px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(`${division.code} - ${division.name}`)}</td><td style="padding:5px 12px;text-align:right;border-bottom:1px solid #e5e7eb;font-variant-numeric:tabular-nums;">${formatCurrency(division.total)}</td></tr>`,
    )
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Estimate - ${escapeHtml(opts.estimate.title)}</title>
<style>
  body{font-family:system-ui,sans-serif;font-size:11px;color:#111;margin:0;padding:24px;}
  table{width:100%;border-collapse:collapse;}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #d97706;}
  .logo{font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#d97706;}
  .contacts{display:flex;gap:32px;font-size:10px;line-height:1.6;}
  .contact-block{min-width:160px;}
  .contact-name{font-weight:700;}
  .project-bar{background:#f3f4f6;padding:10px 12px;border-radius:4px;margin-bottom:16px;display:flex;gap:32px;font-size:10px;}
  .project-bar span{color:#6b7280;}
  .project-bar strong{color:#111;}
  th{background:#1f2937;color:#fff;padding:8px 12px;text-align:left;font-size:10px;letter-spacing:.05em;text-transform:uppercase;}
  th:last-child{text-align:right;}
  .subtotal td{font-weight:600;background:#f9fafb;}
  .total td{font-weight:800;font-size:13px;background:#1f2937;color:#fff;}
  .total td:last-child{color:#fbbf24;}
  @media print{body{padding:12px;}button{display:none;}}
</style></head><body>
<div class="header">
  <div><div class="logo">ALLEATO</div><div style="font-size:10px;color:#6b7280;margin-top:4px;">Alleato Group LLC</div></div>
  <div class="contacts">${ALLEATO_CONTACTS.map((contact) => `<div class="contact-block"><div class="contact-name">${escapeHtml(contact.name)}</div><div>${escapeHtml(contact.title)}</div><div>${escapeHtml(contact.email)}</div><div>${escapeHtml(contact.phone)}</div></div>`).join("")}</div>
</div>
<div class="project-bar">
  <div><span>Project: </span><strong>${escapeHtml(opts.projectName)}</strong></div>
  <div><span>Estimate: </span><strong>${escapeHtml(opts.estimate.title)}</strong></div>
  ${opts.estimate.location ? `<div><span>Location: </span><strong>${escapeHtml(opts.estimate.location)}</strong></div>` : ""}
  ${opts.estimate.estimate_date ? `<div><span>Date: </span><strong>${escapeHtml(String(opts.estimate.estimate_date))}</strong></div>` : ""}
  ${opts.estimate.estimator ? `<div><span>Estimator: </span><strong>${escapeHtml(opts.estimate.estimator)}</strong></div>` : ""}
  <div><span>Revision: </span><strong>R${opts.estimate.revision}</strong></div>
</div>
<table>
  <thead><tr><th>Division</th><th style="text-align:right;">Total</th></tr></thead>
  <tbody>${divisionRows}</tbody>
  <tfoot>
    <tr class="subtotal"><td style="padding:7px 12px;border-top:2px solid #e5e7eb;">Subtotal</td><td style="padding:7px 12px;text-align:right;border-top:2px solid #e5e7eb;">${formatCurrency(opts.subtotal)}</td></tr>
    ${opts.contingencyAmount > 0 ? `<tr><td style="padding:5px 12px;">Contingency</td><td style="padding:5px 12px;text-align:right;">${formatCurrency(opts.contingencyAmount)}</td></tr>` : ""}
    <tr><td style="padding:5px 12px;">Insurance (${(opts.insuranceRate * 100).toFixed(2)}%)</td><td style="padding:5px 12px;text-align:right;">${formatCurrency(opts.insurance)}</td></tr>
    <tr><td style="padding:5px 12px;border-bottom:2px solid #e5e7eb;">Fee (${(opts.feeRate * 100).toFixed(1)}%)</td><td style="padding:5px 12px;text-align:right;border-bottom:2px solid #e5e7eb;">${formatCurrency(opts.fee)}</td></tr>
    <tr class="total"><td style="padding:10px 12px;">TOTAL ESTIMATE</td><td style="padding:10px 12px;text-align:right;">${formatCurrency(opts.grandTotal)}</td></tr>
  </tfoot>
</table>
</body></html>`;
}

export function getEstimatePdfFilename(estimate: EstimateRow): string {
  const title =
    (estimate.title || "estimate")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "estimate";
  return `${title}-R${estimate.revision}.pdf`;
}
