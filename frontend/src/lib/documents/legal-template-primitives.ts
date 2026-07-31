function esc(value: string | number | null | undefined): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type ParagraphAlign = "left" | "center" | "right" | "justify";

export function renderLegalParagraph(
  content: string,
  options: {
    align?: ParagraphAlign;
    marginTop?: string;
    marginBottom?: string;
    className?: string;
    bold?: boolean;
  } = {},
): string {
  const {
    align = "left",
    marginTop = "0in",
    marginBottom = "0.083in",
    className = "",
    bold = false,
  } = options;

  const style = `line-height:100%;margin:${marginTop} 0 ${marginBottom} 0;`;
  const classes = ["legal-paragraph", className].filter(Boolean).join(" ");

  return `
    <p class="${classes}" align="${align}" style="${style}">
      <font color="#000000">
        <span style="text-decoration:none">
          <font face="Times New Roman, serif">
            <font size="3" style="font-size:12pt">
              <span style="font-style:normal">
                <span style="font-weight:${bold ? "bold" : "normal"}">${content}</span>
              </span>
            </font>
          </font>
        </span>
      </font>
    </p>
  `;
}

export function renderLegalClause({
  letter,
  title,
  bodyHtml,
  className = "",
}: {
  letter: string;
  title: string;
  bodyHtml: string[];
  className?: string;
}): string {
  return `
    <section class="legal-clause${className ? ` ${className}` : ""}">
      ${renderLegalParagraph(`<b>${esc(letter)}.\n\t${esc(title)}</b>`, {
        marginBottom: "0in",
      })}
      ${bodyHtml.join("")}
    </section>
  `;
}

export function renderLegalSpacer(options: { marginBottom?: string } = {}): string {
  const marginBottom = options.marginBottom ?? "0in";
  return `<p class="legal-spacer" align="justify" style="line-height:100%;margin-bottom:${marginBottom};"><font color="#000000"><span style="text-decoration:none">&nbsp;</span></font></p>`;
}

export function renderLegalBulletList(
  items: string[],
  options: {
    emptyMessage?: string;
    className?: string;
    itemMarginBottom?: string;
  } = {},
): string {
  const {
    emptyMessage = "None specified in the commitment record.",
    className = "",
    itemMarginBottom = "8px",
  } = options;

  if (items.length === 0) {
    return renderLegalParagraph(esc(emptyMessage), { marginBottom: "0.1in" });
  }

  return `
    <ul class="legal-bullet-list${className ? ` ${className}` : ""}" style="margin:0 0 0.14in 0.18in;padding:0;">
      ${items
        .map(
          (item) => `
            <li style="margin:0 0 ${itemMarginBottom} 0;">
              <font color="#000000">
                <span style="text-decoration:none">
                  <font face="Times New Roman, serif">
                    <font size="3" style="font-size:12pt">
                      <span style="font-style:normal">
                        <span style="font-weight:normal">${esc(item)}</span>
                      </span>
                    </font>
                  </font>
                </span>
              </font>
            </li>
          `,
        )
        .join("")}
    </ul>
  `;
}

export function renderLegalTable({
  headers,
  rows,
  widths,
  headerAlign = [],
  rowAlign = [],
  className = "",
  emptyMessage = "No records found.",
}: {
  headers: string[];
  rows: Array<Array<string | number | null | undefined>>;
  widths?: string[];
  headerAlign?: Array<"left" | "center" | "right">;
  rowAlign?: Array<"left" | "center" | "right">;
  className?: string;
  emptyMessage?: string;
}): string {
  const headerCells = headers
    .map((header, index) => {
      const align = headerAlign[index] ?? "left";
      const width = widths?.[index];
      const widthStyle = width ? `width:${width};` : "";
      return `<th style="border:1px solid #000;padding:6px 8px;text-align:${align};font-weight:700;${widthStyle}">${esc(header)}</th>`;
    })
    .join("");

  const bodyRows = rows.length
    ? rows
        .map(
          (row) => `
            <tr>
              ${row
                .map((cell, index) => {
                  const align = rowAlign[index] ?? headerAlign[index] ?? "left";
                  return `<td style="border:1px solid #000;padding:6px 8px;text-align:${align};vertical-align:top;">${esc(cell)}</td>`;
                })
                .join("")}
            </tr>
          `,
        )
        .join("")
    : `<tr><td colspan="${headers.length}" style="border:1px solid #000;padding:12px 8px;text-align:center;">${esc(emptyMessage)}</td></tr>`;

  return `
    <table class="legal-table${className ? ` ${className}` : ""}" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;table-layout:fixed;margin:0 0 0.18in 0;">
      <thead>
        <tr>${headerCells}</tr>
      </thead>
      <tbody>
        ${bodyRows}
      </tbody>
    </table>
  `;
}

export function renderLegalSignatureBlock({
  leftTitle,
  leftCompany,
  leftSignerName,
  leftSignerTitle,
  leftSignedDate,
  rightTitle,
  rightCompany,
  rightSignerName,
  rightSignerTitle,
  rightSignedDate,
}: {
  leftTitle: string;
  leftCompany: string;
  leftSignerName?: string | null;
  leftSignerTitle?: string | null;
  leftSignedDate?: string | null;
  rightTitle: string;
  rightCompany: string;
  rightSignerName?: string | null;
  rightSignerTitle?: string | null;
  rightSignedDate?: string | null;
}): string {
  const renderField = (label: string, value: string | null | undefined) => `
    <div class="legal-signature-field-row">
      <div class="legal-signature-label">${esc(label)}</div>
      <div class="legal-signature-line">${esc(value ?? "")}</div>
    </div>
  `;

  const renderSide = (
    title: string,
    company: string,
    printedName: string | null | undefined,
    roleTitle: string | null | undefined,
    signedDate: string | null | undefined,
  ) => `
    <div class="legal-signature-side">
      <div class="legal-signature-title" style="text-align:center;margin:0 0 0.12in 0;">${esc(title)}</div>
      <div class="legal-signature-company" style="border-bottom:1px solid #000;padding:0 0 0.08in 0;margin:0 0 0.12in 0;">${esc(company)}</div>
      <div class="legal-signature-fields">
        ${renderField("By:", null)}
        ${renderField("Printed Name:", printedName)}
        ${renderField("Its:", roleTitle)}
        ${renderField("Date:", signedDate)}
      </div>
    </div>
  `;

  return `
    <div class="legal-signature-block legal-page-break">
      <p align="justify" style="line-height:100%;margin:0 0 0.14in 0;">
        <font color="#000000"><span style="text-decoration:none"><font face="Times New Roman, serif"><font size="3" style="font-size:12pt"><span style="font-style:normal"><span style="font-weight:normal">IN TENDING TO BE LEGALLY BOUND, the parties have voluntarily executed this Agreement, by their authorized representative.</span></span></font></font></span></font>
      </p>
      <table class="legal-signature-grid" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;table-layout:fixed;">
        <col style="width:48%;" />
        <col style="width:4%;" />
        <col style="width:48%;" />
        <tr>
          <td style="border:none;padding:0;">${renderSide(leftTitle, leftCompany, leftSignerName, leftSignerTitle, leftSignedDate)}</td>
          <td style="border:none;padding:0;"></td>
          <td style="border:none;padding:0;">${renderSide(rightTitle, rightCompany, rightSignerName, rightSignerTitle, rightSignedDate)}</td>
        </tr>
      </table>
    </div>
  `;
}

export function renderLegalInlineValueOrBlank(
  value: string | null | undefined,
  width = "220px",
): string {
  const text = value?.trim();
  if (!text) {
    return `<span style="display:inline-block;min-width:${width};border-bottom:1px solid #111;height:1em;vertical-align:baseline;"></span>`;
  }

  return `<span style="font-weight:600;">${esc(text)}</span>`;
}

export { esc as escapeLegalTemplateHtml };
