import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import React from "react";

import type { MeetingDetail } from "@/lib/meetings/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * MeetingPdfData shapes directly off `MeetingDetail` (the `loadMeetingDetail`
 * return type) so the route can pass its output through with minimal
 * mapping. The only addition is `assigneeNamesById`, since `MeetingDetail`'s
 * items only carry `assignee_person_id` — the route resolves those ids to
 * display names via a `people` lookup before rendering.
 */
export interface MeetingPdfData extends MeetingDetail {
  assigneeNamesById: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GC_NAME = "Alleato Group";

function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
}

function fmtTime(value: string | null | undefined): string {
  if (!value) return "—";
  // Accept either a full timestamp or a bare "HH:MM[:SS]" time string.
  const isBareTime = /^\d{1,2}:\d{2}(:\d{2})?$/.test(value);
  const d = isBareTime ? new Date(`1970-01-01T${value}`) : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function capitalize(s: string | null | undefined): string {
  if (!s) return "—";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase().replace(/_/g, " ");
}

function personName(person: { first_name: string; last_name: string } | null | undefined): string {
  if (!person) return "—";
  const name = [person.first_name, person.last_name].filter(Boolean).join(" ").trim();
  return name || "—";
}

// ---------------------------------------------------------------------------
// Styles — mirrors the Prime CO PDF layout conventions
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
  meetingNumberBadge: { fontSize: 22, fontFamily: "Helvetica-Bold", textAlign: "right" },
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

  // ---- Attendees ----
  sectionLabel: { fontSize: 8.5, fontFamily: "Helvetica-Bold", marginTop: 10, marginBottom: 4 },
  attendeeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#ddd",
  },
  attendeeName: { fontSize: 8, flex: 2 },
  attendeeCompany: { fontSize: 8, color: "#555", flex: 2 },
  attendeeMark: { fontSize: 8, flex: 1, textAlign: "right" },
  attendeesBox: {
    borderWidth: 0.5,
    borderColor: "#aaa",
    marginBottom: 4,
  },
  attendeeHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#aaa",
  },
  attendeeHeaderText: { fontSize: 7, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },

  // ---- Category / item blocks ----
  categoryBlock: { marginTop: 12 },
  categoryHeader: {
    backgroundColor: "#f0f0f0",
    borderWidth: 0.5,
    borderColor: "#c0c0c0",
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  categoryHeaderText: { fontSize: 10, fontFamily: "Helvetica-Bold" },

  itemBlock: {
    borderWidth: 0.5,
    borderColor: "#ccc",
    padding: 8,
    marginBottom: 6,
  },
  itemHeaderRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  itemNumber: { fontSize: 8.5, fontFamily: "Helvetica-Bold", marginRight: 6 },
  itemTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", flex: 1 },
  itemStatusBadge: { fontSize: 7, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  itemDescription: { fontSize: 8, color: "#333", marginBottom: 4, lineHeight: 1.4 },
  itemMetaRow: { flexDirection: "row", marginTop: 2 },
  itemMetaCell: { flex: 1, flexDirection: "row" },
  itemMetaLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#666", marginRight: 3 },
  itemMetaValue: { fontSize: 7.5, color: "#1a1a1a" },
  itemMinutesLabel: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    marginTop: 4,
    marginBottom: 1,
    textTransform: "uppercase",
    color: "#444",
  },
  itemMinutesBody: { fontSize: 8, lineHeight: 1.4 },

  emptyText: { fontSize: 8, color: "#999", fontStyle: "italic" },

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

export function MeetingPdfDocument({ data }: { data: MeetingPdfData }) {
  const { meeting, attendees, categories, assigneeNamesById } = data;
  const isMinutesMode = meeting.mode === "minutes";

  const meetingLabel = `Meeting #${meeting.number}`;

  const generatedAt = new Date().toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });

  const timeRange = [fmtTime(meeting.start_time), fmtTime(meeting.end_time)]
    .filter((t) => t !== "—")
    .join(" – ");

  return (
    <Document>
      <Page size="LETTER" style={S.page}>
        {/* ── Header ── */}
        <View style={S.header}>
          <View style={S.headerLeft}>
            <Text style={S.gcName}>{GC_NAME}</Text>
            <Text style={S.headerMuted}>{capitalize(meeting.status)}</Text>
          </View>
          <View style={S.headerRight}>
            <Text style={S.meetingNumberBadge}>{meetingLabel}</Text>
            <Text style={S.projectLabel}>{meeting.name}</Text>
          </View>
        </View>

        <View style={S.divider} />

        {/* ── Title banner ── */}
        <View style={S.titleBanner}>
          <Text style={S.titleBannerText}>{meeting.name}</Text>
        </View>

        {/* ── Meta grid ── */}
        <View style={S.metaTable}>
          <View style={S.metaRow}>
            <View style={S.metaCell}>
              <Text style={S.metaLabel}>DATE:</Text>
              <Text style={S.metaValue}>{fmtDate(meeting.meeting_date)}</Text>
            </View>
            <View style={S.metaCellNoBorder}>
              <Text style={S.metaLabel}>TIME:</Text>
              <Text style={S.metaValue}>{timeRange || "—"}</Text>
            </View>
          </View>
          <View style={S.metaRowLast}>
            <View style={S.metaCell}>
              <Text style={S.metaLabel}>LOCATION:</Text>
              <Text style={S.metaValue}>{meeting.location || "—"}</Text>
            </View>
            <View style={S.metaCellNoBorder}>
              <Text style={S.metaLabel}>STATUS:</Text>
              <Text style={S.metaValue}>{capitalize(meeting.status)}</Text>
            </View>
          </View>
        </View>

        {/* ── Attendees ── */}
        <Text style={S.sectionLabel}>ATTENDEES</Text>
        {attendees.length === 0 ? (
          <Text style={S.emptyText}>No attendees recorded.</Text>
        ) : (
          <View style={S.attendeesBox}>
            <View style={S.attendeeHeaderRow}>
              <Text style={[S.attendeeHeaderText, { flex: 2 }]}>Name</Text>
              <Text style={[S.attendeeHeaderText, { flex: 2 }]}>Company</Text>
              {isMinutesMode ? (
                <Text style={[S.attendeeHeaderText, { flex: 1, textAlign: "right" }]}>
                  Attended
                </Text>
              ) : null}
            </View>
            {attendees.map((attendee) => (
              <View key={attendee.id} style={S.attendeeRow}>
                <Text style={S.attendeeName}>{personName(attendee.person)}</Text>
                <Text style={S.attendeeCompany}>{attendee.person.company_name || "—"}</Text>
                {isMinutesMode ? (
                  <Text style={S.attendeeMark}>{attendee.attended ? "Yes" : "No"}</Text>
                ) : null}
              </View>
            ))}
          </View>
        )}

        {/* ── Categories + items ── */}
        {categories.length === 0 ? (
          <View style={S.categoryBlock}>
            <Text style={S.emptyText}>No agenda items.</Text>
          </View>
        ) : (
          categories.map((category) => (
            <View key={category.id} style={S.categoryBlock} wrap>
              <View style={S.categoryHeader}>
                <Text style={S.categoryHeaderText}>{category.name}</Text>
              </View>

              {category.items.length === 0 ? (
                <Text style={S.emptyText}>No items in this category.</Text>
              ) : (
                category.items.map((item) => {
                  const assigneeName = item.assignee_person_id
                    ? (assigneeNamesById[item.assignee_person_id] ?? "—")
                    : "—";

                  return (
                    <View key={item.id} style={S.itemBlock} wrap={false}>
                      <View style={S.itemHeaderRow}>
                        <Text style={S.itemTitle}>
                          <Text style={S.itemNumber}>{item.agenda_number}</Text>
                          {item.title}
                        </Text>
                        <Text style={S.itemStatusBadge}>{capitalize(item.status)}</Text>
                      </View>

                      {item.description ? (
                        <Text style={S.itemDescription}>{item.description}</Text>
                      ) : null}

                      <View style={S.itemMetaRow}>
                        <View style={S.itemMetaCell}>
                          <Text style={S.itemMetaLabel}>Assignee:</Text>
                          <Text style={S.itemMetaValue}>{assigneeName}</Text>
                        </View>
                        <View style={S.itemMetaCell}>
                          <Text style={S.itemMetaLabel}>Due:</Text>
                          <Text style={S.itemMetaValue}>{fmtDate(item.due_date)}</Text>
                        </View>
                        <View style={S.itemMetaCell}>
                          <Text style={S.itemMetaLabel}>Priority:</Text>
                          <Text style={S.itemMetaValue}>{capitalize(item.priority)}</Text>
                        </View>
                      </View>

                      {isMinutesMode && item.official_minutes ? (
                        <View>
                          <Text style={S.itemMinutesLabel}>Official Minutes</Text>
                          <Text style={S.itemMinutesBody}>{item.official_minutes}</Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })
              )}
            </View>
          ))
        )}

        {/* ── Footer ── */}
        <View style={S.footer} fixed>
          <Text>{GC_NAME}</Text>
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

export async function renderMeetingPdfBuffer(data: MeetingPdfData): Promise<Buffer> {
  return renderToBuffer(<MeetingPdfDocument data={data} />);
}
