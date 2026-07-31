export const WELCOME_ONBOARDING_STORAGE_KEY = "alleato_onboarding_completed_v3";
export const ONBOARDING_VISIBILITY_EVENT = "alleato:onboarding-visibility";

export type OnboardingInsightKind = "pattern" | "risk" | "decision";

export type OnboardingInsight = {
  kind: OnboardingInsightKind;
  text: string;
  meta: string;
};

export type MomentumStats = {
  fixesShipped: number;
  activeTesters: number;
  launchesThisWeek: number;
};

export const onboardingCopy = {
  shell: {
    eyebrow: "Alleato OS",
    skip: "Explore later",
    back: "Back",
    continue: "Continue",
    startExploring: "Start exploring",
  },
  foundation: {
    badge: "You’re getting the first look at what’s next",
    preheadingWithName: (firstName: string) => `Welcome, ${firstName}`,
    preheadingFallback: "Welcome",
    headline: "You’re here to help shape what comes next",
    headlineWithName: () => "You’re here to help shape what comes next",
    headlineFallback: "You’re here to help shape what comes next",
    body: [
      "This is your first look at Alleato’s new AI-powered project platform.",
      "This first version is only the beginning. The real power comes from improving it with the people who know the business best.",
      "If something is broken, tell us.",
      "If something is annoying, tell us.",
      "If you have an idea that would save time, reduce confusion, or make your work easier, definitely tell us.",
    ],
    statLabels: {
      fixesShipped: "fixes shipped this month",
      activeTesters: "testers active",
      launchesThisWeek: "launches this week",
    },
  },
  wow: {
    badge: "What becomes possible",
    headlineWithName: (name: string) => `${name}, this can become your project command layer.`,
    headlineFallback: "This can become your project command layer.",
    body:
      "Alleato can connect signals that usually live in separate places. These are the kinds of patterns we want the product to surface automatically:",
    closer:
      "This isn't a one-time demo. Your AI assistant lives in the bottom-right of every page — ask it anything, anytime.",
  },
  widget: {
    headline: "Feedback is only a click away.",
    body:
      "Submit feedback from the bottom-right button on any page. Bugs, ideas, questions, and wish-list items are all welcome.",
    askTab: "Ask AI",
    feedbackTab: "Send feedback",
    tryAsking: "Try asking",
    examples: [
      "What's blocking the Tampa project?",
      "Show me overdue RFIs assigned to me",
      "Summarize last week's owner meeting",
    ],
    inputPlaceholder: "Ask anything about your projects...",
    feedbackPlaceholder: "Bug, idea, or just confused — anything works",
    previewNote: "The form captures page context automatically. Screenshots make fixes dramatically faster.",
    feedbackFooter: "Every submission lands on the Client Feedback page within seconds.",
  },
  mission: {
    badge: "Ready when you are",
    headline: "Set up your first test project.",
    body:
      "Walk through it like a real project — create it, add a meeting, run an RFI. Note what feels off as you go. Tell us in the widget.",
    cta: "Create your first test project",
    ctaMeta: "Takes about 90 seconds. Real workflow, real data.",
    helperTitle: "Stuck or confused?",
    helperBody:
      "Click Ask Alleato in the bottom-right corner. The AI knows your projects, your meetings, and how the platform works. Use it like a teammate.",
    footer: "At the end of today, you'll see how much time the AI saved you.",
  },
};

export const defaultOnboardingInsights: OnboardingInsight[] = [
  {
    kind: "pattern",
    text: "Fire suppression appeared in 9 of 14 meetings. It isn't on any agenda or RFI.",
    meta: "4 projects · trending up",
  },
  {
    kind: "risk",
    text: "RFI #047 was discussed 4 times across 3 weeks. Still unresolved. Owner: not assigned.",
    meta: "Surfaced from transcripts",
  },
  {
    kind: "decision",
    text: "On 4/12 the team agreed to switch to Type-K connectors. Not in any document, contract, or submittal.",
    meta: "Auto-extracted",
  },
];

export const defaultMomentumStats: MomentumStats = {
  fixesShipped: 47,
  activeTesters: 12,
  launchesThisWeek: 3,
};
