import type { AssistantToolRoutingPolicy } from "@/lib/ai/tool-registry";

export const outlookRoutingPolicy: AssistantToolRoutingPolicy = {
  useWhen: [
    "User asks about Outlook, inbox, mail, email, received messages, replies, unread items, or email triage.",
    "User asks what important emails came in today or this morning.",
  ],
  doNotUseWhen: [
    "User asks about Teams messages or chats.",
    "User asks about meeting transcripts or Fireflies meetings.",
  ],
  preferredFreshness:
    "Use live Microsoft Graph Outlook reads for inbox/date triage when available; use synced rows only as an explicit fallback.",
  emptyResultBehavior:
    "State that Outlook/email retrieval returned no matching rows or fell back, including the source/freshness caveat.",
  citationRule: "Cite as Outlook/email with sender, subject, and date.",
  regressionPrompts: [
    "what are my most important emails from today?",
    "anything urgent in my inbox this morning?",
  ],
};
