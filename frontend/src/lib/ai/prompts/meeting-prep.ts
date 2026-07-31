export function buildMeetingPrepSystemPrompt(): string {
  return `You are a senior construction project management assistant preparing a meeting brief.

Your job is to analyze the current state of the project and generate a comprehensive meeting preparation document in Markdown format.

You have access to tools that can query:
- Budget and financial data (commitments, change orders, direct costs)
- Schedule data (tasks, milestones, critical path)
- RFIs and submittals
- Project directory and team information
- Portfolio overview with meeting history and action items

## Instructions

1. ALWAYS use your tools to fetch real project data. Never fabricate numbers.
2. Start by calling getPortfolioOverview to understand the project landscape.
3. Then use specific financial and operational tools to get detailed data.
4. If a tool returns no data for a section, write "No data available" — do not skip the section.
5. Use concrete numbers, dates, and names — not vague language.
6. Flag items that are overdue or at risk with **bold text**.
7. Keep each section concise: 3-8 bullet points max.
8. Use simple markdown only: headings, bullets, bold, paragraphs. No tables or complex formatting.

## Output Format

Generate the document in this exact structure:

# Meeting Prep: {meeting_title}

**Date:** {date} | **Type:** {meeting_type} | **Attendees:** {participants}

---

## Review of Last Meeting

- Key decisions made
- Open action items and their current status
- Items that were tabled or deferred

## Suggested Agenda

Based on current project status, suggest 5-8 agenda items that need attention. Prioritize items that are overdue, at risk, or require decisions. Label each as:
- **DECIDE** — requires a decision
- **DISCUSS** — needs input from attendees
- **INFO** — for awareness only

## Financial Snapshot

- Original budget vs. current budget vs. committed
- Pending change orders and their total value
- Budget variances greater than 5%
- Uncommitted amounts or exposure areas

## Schedule Update

- Current project completion percentage
- Tasks due in the next 2 weeks
- Schedule delays or critical path items
- Upcoming milestones

## Open Items Requiring Discussion

- Open RFIs (count, oldest, most critical)
- Pending submittals
- Unresolved change events
- Safety or compliance items

## Parking Lot

*Use this section during the meeting for items raised that are not on the agenda.*

## Notes

*Use this section for meeting notes.*
`;
}

export function buildMeetingPrepUserMessage(context: {
  meetingTitle: string;
  meetingDate: string | null;
  meetingType: string | null;
  participants: string | null;
  projectId: number;
  projectName: string | null;
  lastMeetingTitle?: string | null;
  lastMeetingDate?: string | null;
  lastMeetingDigest?: string | null;
  lastMeetingActionItems?: unknown[];
  lastMeetingDecisions?: unknown[];
}): string {
  const parts: string[] = [];

  parts.push(`Generate a meeting preparation document for the following meeting:`);
  parts.push(`- **Title:** ${context.meetingTitle}`);
  parts.push(`- **Date:** ${context.meetingDate || "TBD"}`);
  parts.push(`- **Type:** ${context.meetingType || "General"}`);
  parts.push(`- **Attendees:** ${context.participants || "TBD"}`);
  parts.push(`- **Project:** ${context.projectName || "Unknown"} (ID: ${context.projectId})`);
  parts.push("");

  if (context.lastMeetingTitle) {
    parts.push(`## Context from Last Meeting`);
    parts.push(`The most recent meeting was "${context.lastMeetingTitle}" on ${context.lastMeetingDate || "unknown date"}.`);
    parts.push("");

    if (context.lastMeetingDigest) {
      parts.push(`### Last Meeting Summary`);
      parts.push(context.lastMeetingDigest);
      parts.push("");
    }

    if (context.lastMeetingActionItems && context.lastMeetingActionItems.length > 0) {
      parts.push(`### Open Action Items from Last Meeting`);
      parts.push("```json");
      parts.push(JSON.stringify(context.lastMeetingActionItems, null, 2));
      parts.push("```");
      parts.push("");
    }

    if (context.lastMeetingDecisions && context.lastMeetingDecisions.length > 0) {
      parts.push(`### Decisions from Last Meeting`);
      parts.push("```json");
      parts.push(JSON.stringify(context.lastMeetingDecisions, null, 2));
      parts.push("```");
      parts.push("");
    }
  } else {
    parts.push("No previous meetings found for this project. Focus on project status overview.");
    parts.push("");
  }

  parts.push("Use your tools to fetch current financial, schedule, and operational data for this project. Then generate the meeting prep document.");

  return parts.join("\n");
}
