/* eslint-disable design-system/no-hardcoded-colors, design-system/no-raw-heading */
import * as React from "react";
import { EmailShell } from "@/emails/_shell/EmailShell";
import type { BrandonBriefItem, BrandonDailyUpdatePacket } from "./brandon-daily-update";

function formatGeneratedAt(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function sectionLabel(key: keyof BrandonDailyUpdatePacket["sections"]) {
  switch (key) {
    case "needsBrandon":
      return "Needs Brandon";
    case "waitingOnOthers":
      return "Waiting on others";
    case "importantUpdates":
      return "Important updates";
    default:
      return key;
  }
}

function ItemBlock({ item }: { item: BrandonBriefItem }) {
  const stored = Array.isArray(item.citations) ? item.citations : [];
  const citations = stored.length > 0
    ? stored
    : [{
        source: item.source,
        sourceDetail: item.sourceDetail,
        sourceUrl: item.sourceUrl,
        sourceId: item.sourceId,
        evidence: item.evidence,
        date: item.date,
      }];

  return (
    <div
      style={{
        margin: "0 0 16px",
        padding: "16px",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        background: "#f9fafb",
      }}
    >
      <p style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700 }}>{item.title}</p>
      <p style={{ margin: "0 0 8px", fontSize: 12, color: "#475569" }}>
        {[item.project, item.source, item.date].filter(Boolean).join(" • ")}
      </p>
      <p style={{ margin: "0 0 10px" }}>{item.summary}</p>
      {item.bullets.length > 0 ? (
        <ul style={{ margin: "0 0 10px", paddingLeft: 18 }}>
          {item.bullets.slice(0, 4).map((bullet) => (
            <li key={bullet} style={{ margin: "0 0 6px" }}>
              {bullet}
            </li>
          ))}
        </ul>
      ) : null}
      {item.recommendedAction ? (
        <p style={{ margin: "0 0 8px" }}>
          <strong>Recommended move:</strong> {item.recommendedAction}
        </p>
      ) : null}
      {item.whyItMatters ? (
        <p style={{ margin: "0 0 8px", color: "#475569" }}>
          <strong>Why it matters:</strong> {item.whyItMatters}
        </p>
      ) : null}
      <div
        style={{
          marginTop: 10,
          paddingTop: 10,
          borderTop: "1px solid #e5e7eb",
          fontSize: 12,
          color: "#475569",
        }}
      >
        <strong style={{ color: "#334155" }}>
          {citations.length > 1 ? `Sources (${citations.length})` : "Source"}:
        </strong>
        <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
          {citations.map((citation, idx) => (
            <li
              key={`${citation.sourceId ?? citation.sourceUrl ?? citation.sourceDetail}-${idx}`}
              style={{ margin: "0 0 4px" }}
            >
              <span style={{ fontWeight: 600 }}>{citation.source}</span>
              {citation.sourceDetail ? <> — {citation.sourceDetail}</> : null}
              {citation.date ? <> ({citation.date})</> : null}
              {citation.sourceUrl ? (
                <>
                  {" "}
                  <a
                    href={citation.sourceUrl}
                    style={{ color: "#1d4ed8", textDecoration: "underline" }}
                  >
                    View source ↗
                  </a>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function ExecutiveBriefingEmail({
  packet,
  briefUrl,
  senderLabel,
  introNote,
}: {
  packet: BrandonDailyUpdatePacket;
  briefUrl: string;
  senderLabel?: string | null;
  introNote?: string | null;
}) {
  const sections = Object.entries(packet.sections) as Array<
    [keyof BrandonDailyUpdatePacket["sections"], BrandonBriefItem[]]
  >;

  return (
    <EmailShell
      previewText="Daily operating brief from Alleato"
      eyebrow="Executive Briefing"
      heading="Daily operating brief"
      ctaLabel="Open Daily Executive Brief"
      ctaUrl={briefUrl}
      footerNote="Sent by Alleato. Use your normal Alleato login to open the Daily Executive Brief."
    >
      <p style={{ margin: "0 0 12px" }}>Hi Brandon,</p>
      <p style={{ margin: "0 0 12px" }}>
        {senderLabel ? `${senderLabel} sent` : "Alleato generated"} the latest daily operating
        brief on {formatGeneratedAt(packet.generatedAt)} covering the last {packet.windowDays} day
        {packet.windowDays === 1 ? "" : "s"}.
      </p>
      {introNote ? (
        <div
          style={{
            margin: "0 0 16px",
            padding: "12px 14px",
            borderRadius: 10,
            background: "#f8fafc",
            border: "1px solid #e5e7eb",
          }}
        >
          <p style={{ margin: 0 }}>
            <strong>Note:</strong> {introNote}
          </p>
        </div>
      ) : null}

      {sections.map(([key, items]) => (
        <div key={key} style={{ margin: "0 0 20px" }}>
          <h2 style={{ margin: "0 0 10px", fontSize: 18 }}>{sectionLabel(key)}</h2>
          {items.length > 0 ? (
            items.map((item) => <ItemBlock key={`${item.title}-${item.sourceId ?? item.date}`} item={item} />)
          ) : (
            <p style={{ margin: 0, color: "#475569" }}>No items surfaced in this section.</p>
          )}
        </div>
      ))}
    </EmailShell>
  );
}
