import type { AssistantToolRoutingPolicy } from "@/lib/ai/tool-registry";

export const meetingRoutingPolicy: AssistantToolRoutingPolicy = {
  useWhen: [
    "User asks what was discussed, decided, raised, or assigned in meetings.",
    "User asks for Fireflies, meeting transcripts, OACs, huddles, or meeting intelligence.",
  ],
  doNotUseWhen: [
    "User asks specifically for Teams messages, chats, or DMs.",
    "User asks specifically for Outlook inbox or email results.",
  ],
  preferredFreshness:
    "Use date-aware meeting retrieval for today/yesterday/specific dates; use semantic meeting search for topical historical questions.",
  emptyResultBehavior:
    "State that meeting retrieval returned no matching rows and do not fill the gap with Teams/email unless the user requested cross-source context.",
  citationRule: "Cite as Fireflies/meeting with meeting title and date.",
  regressionPrompts: [
    "what meetings were held today?",
    "what did the Westfield OAC decide?",
  ],
};
