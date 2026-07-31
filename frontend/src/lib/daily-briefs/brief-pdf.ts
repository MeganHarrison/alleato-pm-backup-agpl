import type { CanonicalDailyBriefPacket } from "./canonical-packets";

// ─────────────────────────────────────────────────────────────────────────────
// Server-side PDF rendering for the canonical Daily / Morning Brief.
//
// `buildCanonicalDailyBriefPdfHtml` is a PURE function (no chromium, no I/O) so
// it is unit-testable and shared between the on-demand PDF route and any future
// pre-render/attach flow. The route pairs it with `renderPdfFromHtml` from
// `@/lib/documents/pdf` to produce the actual PDF bytes.
// ─────────────────────────────────────────────────────────────────────────────

function esc(value: string | number | null | undefined): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Render a prose block (a section body) into escaped HTML paragraphs. Blank
 * lines separate paragraphs; single newlines become <br>. This intentionally
 * does NOT interpret markdown syntax — the goal is a faithful, safe transcript
 * of the brief text, not a second markdown renderer.
 */
function renderProse(body: string): string {
  const paragraphs = body
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return "";

  return paragraphs
    .map((para) => `<p>${esc(para).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

function formatGeneratedAt(value: string | null): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
}

function sourceSummary(packet: CanonicalDailyBriefPacket): string {
  const parts = Object.entries(packet.sourceCounts)
    .slice(0, 6)
    .map(([label, count]) => `${esc(label)}: ${esc(count)}`);
  const detail = parts.length > 0 ? ` (${parts.join(", ")})` : "";
  return `${esc(packet.sourceCount)} source${packet.sourceCount === 1 ? "" : "s"}${detail}`;
}

/**
 * Build a self-contained, print-ready HTML document for a canonical brief
 * packet. No external assets — everything is inline so it renders identically in
 * serverless chromium.
 */
export function buildCanonicalDailyBriefPdfHtml(
  packet: CanonicalDailyBriefPacket,
): string {
  const generated = formatGeneratedAt(packet.generatedAt);

  const nextMoves = packet.recommendedNextMoves.filter(
    (move) => typeof move === "string" && move.trim().length > 0,
  );

  const sectionsHtml = packet.sections
    .filter((section) => section.title?.trim() || section.body?.trim())
    .map(
      (section) => `
      <section class="brief-section">
        <h2>${esc(section.title)}</h2>
        ${renderProse(section.body ?? "")}
      </section>`,
    )
    .join("\n");

  const nextMovesHtml =
    nextMoves.length > 0
      ? `
      <section class="brief-section">
        <h2>Recommended next moves</h2>
        <ol>${nextMoves.map((move) => `<li>${esc(move)}</li>`).join("")}</ol>
      </section>`
      : "";

  const bodyHtml =
    sectionsHtml.trim().length > 0
      ? sectionsHtml
      : `<section class="brief-section"><p class="muted">This brief packet did not include rendered sections.</p></section>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(packet.title)}</title>
<style>
  @page { size: letter; margin: 0.7in 0.75in; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: "Georgia", "Times New Roman", serif;
    color: #1a1a1a; font-size: 11px; line-height: 1.55;
    -webkit-font-smoothing: antialiased;
  }
  .sans { font-family: "Helvetica Neue", Arial, sans-serif; }
  .masthead { border-bottom: 2px solid #1a1a1a; padding-bottom: 8px; margin-bottom: 4px; }
  .brand { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 9px; letter-spacing: .28em; text-transform: uppercase; color: #6b6b6b; }
  .title { font-size: 26px; font-weight: 700; letter-spacing: -.01em; margin: 3px 0 0; }
  .dateline { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; border-bottom: 1px solid #e4e4e2; padding: 6px 0; margin-bottom: 16px; }
  .dateline .date { font-style: italic; color: #6b6b6b; }
  .dateline .meta { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 8.5px; letter-spacing: .03em; color: #6b6b6b; text-transform: uppercase; text-align: right; }
  .brief-section { margin: 0 0 16px; page-break-inside: avoid; }
  h2 { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 11px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: #1a1a1a; border-bottom: 1px solid #1a1a1a; padding-bottom: 4px; margin: 0 0 8px; }
  p { margin: 0 0 8px; }
  ol, ul { margin: 0 0 8px; padding-left: 20px; }
  li { margin: 0 0 4px; }
  .muted { color: #9a9a9a; font-style: italic; }
  .footer { margin-top: 22px; border-top: 2px solid #1a1a1a; padding-top: 6px; font-family: "Helvetica Neue", Arial, sans-serif; font-size: 8px; letter-spacing: .1em; text-transform: uppercase; color: #9a9a9a; text-align: center; }
</style>
</head>
<body>
  <div class="masthead">
    <div class="brand">Alleato Group</div>
    <div class="title">${esc(packet.title)}</div>
  </div>
  <div class="dateline">
    <div class="date">Business date: ${esc(packet.businessDate)}</div>
    <div class="meta">${sourceSummary(packet)}${generated ? `<br>Compiled ${esc(generated)} UTC` : ""}</div>
  </div>
  ${bodyHtml}
  ${nextMovesHtml}
  <div class="footer">Alleato Group · The Morning Brief · Confidential</div>
</body>
</html>`;
}
