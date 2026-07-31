export const PROGRESS_REPORT_SYSTEM_PROMPT = `You are a senior construction project manager with 20 years of experience writing weekly progress reports for owners and developers. Your reports are complete and specific but tight — the owner should finish knowing exactly where the project stands, with no gaps and no wasted words.

Your task: generate three sections of a weekly progress report from project source data.

## Output format

Return ONLY a valid JSON object — no markdown fences, no preamble, no commentary:
{
  "past_week_highlights": "- bullet 1\\n- bullet 2\\n...",
  "upcoming_week_activities": "- bullet 1\\n- bullet 2\\n...",
  "open_items": "- bullet 1\\n- bullet 2\\n..."
}

Each bullet is a Markdown list item. Lead with a bold topic label where it aids scanning (e.g. "- **Level 3 MEP:** ...") and then ONE crisp sentence. Do NOT write a second sentence or a generic impact clause ("this keeps work aligned", "this reduces risk") — fold the consequence into the one sentence or leave it out.

## Completeness and specifics (this is what makes the report valuable)

- Be complete: cover EVERY meaningful development from the week's sources — never drop an item. An active week usually yields 6–12 bullets per section; a genuinely quiet week yields fewer. Do NOT cap the count artificially, and do NOT pad a quiet week with filler.
- Pack the hard specifics an owner needs to act into each bullet: dollar amounts, quantities, dates (written as words — "July 22"), floor/zone/area, trade and subcontractor names, and RFI / submittal / change-event / change-order numbers, pulled straight from the sources.
- Name who owes the next step ("Alleato to issue the revised warehouse TI schedule by July 24").
- Spell out abbreviations on first use ("certificate of insurance" not "COI").

## Writing rules

- Active voice; most significant items first.
- No filler: never write "The team continued to make progress", "Work proceeded as planned", or any empty phrase. Every bullet must carry a concrete fact.
- Never invent details. Richness comes from surfacing what is actually in the sources — never from fabrication.
- Use only source-backed evidence an Alleato user could open directly: meetings/transcripts, emails, documents, Teams messages, photos, RFIs, submittals, and Acumatica-backed project signals.
- Owner-facing only: internal schedule cleanup, date corrections, or note-taking that does not change a client-visible milestone is not a highlight.

## Section definitions

**Past Week Highlights** — concrete things that advanced (completed work, installs, approvals, inspections passed, submittals approved, RFIs closed, mobilization, design progress, coordination decisions reached), each stated with its schedule/scope consequence in the SAME sentence.

**Upcoming Week Activities** — specific work planned for the next 7 days, naming the trade, scope, location, and the milestone or approval it drives toward — "Concrete pour — Level 3 deck, Wednesday" not "Continue concrete work". Include design, procurement, submittal, and coordination workstreams, not just field work.

**Open Items** — decisions/approvals the client owes: pending change events/orders (with amounts), open RFIs (with numbers and due dates), submittals awaiting owner approval, design questions, contract items, schedule/long-lead risks. Each says what is needed, by whom, and by when. If there are genuinely none, write a single bullet: "- No open items requiring client action this week."
`;

export function buildProgressReportUserMessage({
  projectName,
  weekStart,
  weekEnd,
  meetings,
  emails,
  photos,
  financialContext,
  deterministicDraft,
  rfis,
  submittals,
  transcriptMeetings,
  intelligenceSignals,
  reportSuggestions,
}: {
  projectName: string;
  weekStart: string;
  weekEnd: string;
  meetings: Array<{
    title: string | null;
    date: string | null;
    summary: string | null;
    overview: string | null;
    action_items: string | null;
    summary_bullets: unknown;
  }>;
  emails: Array<{
    subject: string;
    body_text: string | null;
    body: string | null;
    received_at: string | null;
    sent_at: string | null;
  }>;
  photos: Array<{
    title: string;
    description: string | null;
    location: string | null;
    date_taken: string | null;
  }>;
  financialContext?: {
    pendingChangeEventsCount: number;
    pendingChangeOrdersCount: number;
  } | null;
  deterministicDraft?: {
    pastWeekHighlights: string;
    upcomingWeekActivities: string;
    openItems: string;
  } | null;
  rfis?: Array<{
    number: number;
    subject: string;
    status: string;
    due_date: string | null;
  }> | null;
  submittals?: Array<{
    submittal_number: string;
    title: string;
    status: string | null;
    submission_date: string | null;
  }> | null;
  transcriptMeetings?: Array<{
    title: string | null;
    date: string | null;
    transcript: string;
  }> | null;
  intelligenceSignals?: Array<{
    title: string;
    summary: string;
    whyItMatters?: string | null;
    nextAction?: string | null;
    evidence: Array<{
      sourceType: string;
      sourceTitle: string | null;
      excerpt: string | null;
      summary: string | null;
    }>;
  }> | null;
  reportSuggestions?: Array<{
    title: string;
    reportType: string;
    period: string | null;
    summary: string | null;
    updates: string[];
    risks: string[];
    financialChanges: string[];
    scheduleChanges: string[];
  }> | null;
}): string {
  const parts: string[] = [
    `Project: ${projectName}`,
    `Reporting week: ${weekStart} through ${weekEnd}`,
    "",
  ];

  if (meetings.length > 0) {
    parts.push("## Meetings this week");
    for (const meeting of meetings) {
      parts.push(`### ${meeting.title ?? "Untitled meeting"} (${meeting.date ?? "no date"})`);
      if (meeting.overview) parts.push(`Overview: ${meeting.overview.slice(0, 800)}`);
      if (meeting.summary) parts.push(`Summary: ${meeting.summary.slice(0, 800)}`);
      if (meeting.action_items) parts.push(`Action items: ${meeting.action_items.slice(0, 600)}`);
      const bullets = parseBullets(meeting.summary_bullets);
      if (bullets.length > 0) parts.push(`Key points: ${bullets.slice(0, 10).join("; ")}`);
    }
    parts.push("");
  }

  if (emails.length > 0) {
    parts.push("## Emails / correspondence this week");
    for (const email of emails.slice(0, 8)) {
      const date = email.received_at ?? email.sent_at ?? "";
      const preview = (email.body_text ?? email.body ?? "").slice(0, 400);
      parts.push(`- Subject: ${email.subject}${date ? ` (${date.slice(0, 10)})` : ""}${preview ? `\n  Preview: ${preview}` : ""}`);
    }
    parts.push("");
  }

  if (photos.length > 0) {
    parts.push("## Progress photos uploaded");
    for (const photo of photos.slice(0, 12)) {
      const loc = photo.location ? ` at ${photo.location}` : "";
      const desc = photo.description ? ` — ${photo.description}` : "";
      parts.push(`- ${photo.title}${loc}${desc}`);
    }
    parts.push("");
  }

  if (deterministicDraft) {
    parts.push("## Existing deterministic draft");
    parts.push("Past week highlights:");
    parts.push(deterministicDraft.pastWeekHighlights);
    parts.push("");
    parts.push("Upcoming week activities:");
    parts.push(deterministicDraft.upcomingWeekActivities);
    parts.push("");
    parts.push("Open items:");
    parts.push(deterministicDraft.openItems);
    parts.push("");
    parts.push(
      "Use this draft as grounding. Keep stronger owner-facing bullets, preserve named accountability when useful, and replace only when richer evidence supports a better version.",
    );
    parts.push("");
  }

  if (transcriptMeetings && transcriptMeetings.length > 0) {
    parts.push("## Full meeting transcripts");
    for (const meeting of transcriptMeetings) {
      parts.push(`### ${meeting.title ?? "Untitled meeting"} (${meeting.date ?? "no date"})`);
      parts.push(meeting.transcript.slice(0, 6000));
    }
    parts.push("");
  }

  if (rfis && rfis.length > 0) {
    parts.push("## RFIs opened this week");
    for (const rfi of rfis.slice(0, 10)) {
      const due = rfi.due_date ? ` (due ${rfi.due_date.slice(0, 10)})` : "";
      parts.push(`- RFI #${rfi.number}: ${rfi.subject} — ${rfi.status}${due}`);
    }
    parts.push("");
  }

  if (submittals && submittals.length > 0) {
    parts.push("## Submittals activity this week");
    for (const sub of submittals.slice(0, 10)) {
      parts.push(`- ${sub.submittal_number}: ${sub.title} — ${sub.status ?? "submitted"}`);
    }
    parts.push("");
  }

  if (intelligenceSignals && intelligenceSignals.length > 0) {
    parts.push("## Project Intelligence signals");
    for (const signal of intelligenceSignals.slice(0, 8)) {
      parts.push(`### ${signal.title}`);
      parts.push(`Summary: ${signal.summary}`);
      if (signal.whyItMatters) parts.push(`Why it matters: ${signal.whyItMatters}`);
      if (signal.nextAction) parts.push(`Next action: ${signal.nextAction}`);
      for (const evidence of signal.evidence.slice(0, 3)) {
        const sourceLabel = [evidence.sourceType, evidence.sourceTitle].filter(Boolean).join(" — ");
        parts.push(`- Evidence: ${sourceLabel || evidence.sourceType}`);
        if (evidence.excerpt) parts.push(`  Excerpt: ${evidence.excerpt.slice(0, 300)}`);
        else if (evidence.summary) parts.push(`  Summary: ${evidence.summary.slice(0, 300)}`);
      }
    }
    parts.push("");
  }

  if (reportSuggestions && reportSuggestions.length > 0) {
    parts.push("## Operating-record report suggestions");
    parts.push(
      "These suggestions come from the daily source synthesis and project database snapshot. Use them as high-priority grounding, but do not invent details beyond the listed items.",
    );
    for (const suggestion of reportSuggestions.slice(0, 6)) {
      parts.push(`### ${suggestion.title}`);
      parts.push(`Type: ${suggestion.reportType}${suggestion.period ? ` (${suggestion.period})` : ""}`);
      if (suggestion.summary) parts.push(`Summary: ${suggestion.summary}`);
      if (suggestion.updates.length > 0) parts.push(`Updates: ${suggestion.updates.slice(0, 8).join("; ")}`);
      if (suggestion.risks.length > 0) parts.push(`Risks/open items: ${suggestion.risks.slice(0, 6).join("; ")}`);
      if (suggestion.financialChanges.length > 0) {
        parts.push(`Financial changes: ${suggestion.financialChanges.slice(0, 6).join("; ")}`);
      }
      if (suggestion.scheduleChanges.length > 0) {
        parts.push(`Schedule changes: ${suggestion.scheduleChanges.slice(0, 6).join("; ")}`);
      }
    }
    parts.push("");
  }

  if (financialContext) {
    parts.push("## Financial context");
    if (financialContext.pendingChangeEventsCount > 0) {
      parts.push(`- ${financialContext.pendingChangeEventsCount} change event${financialContext.pendingChangeEventsCount === 1 ? "" : "s"} pending review`);
    }
    if (financialContext.pendingChangeOrdersCount > 0) {
      parts.push(`- ${financialContext.pendingChangeOrdersCount} change order${financialContext.pendingChangeOrdersCount === 1 ? "" : "s"} awaiting approval`);
    }
    parts.push("");
  }

  if (
    meetings.length === 0 &&
    emails.length === 0 &&
    photos.length === 0
  ) {
    parts.push("No source material was found for this reporting week. Generate generic placeholder bullets so the PM can edit them.");
  }

  parts.push("Generate the three report sections now. Return only the JSON object.");

  return parts.join("\n");
}

function parseBullets(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}
