export type AlleatoAiWorkflow =
  | "executive-command-center"
  | "project-manager-daily-priorities"
  | "client-update-drafting"
  | "operations-handoff-review";

export type AlleatoAiTone = "executive" | "practical" | "client-facing" | "operations";

export type AlleatoAiUserProfile = {
  userId: string;
  displayName: string;
  emailPatterns?: string[];
  role: string;
  company: string;
  focusAreas: string[];
  knownPriorities: string[];
  knownPainPoints: string[];
  excitedAbout: string[];
  recommendedWorkflow: AlleatoAiWorkflow;
  recommendedProjectId: string;
  recommendedProjectPath: string;
  adminNotes: string;
  preferredTone?: AlleatoAiTone;
};

export const DEFAULT_ALLEATO_AI_PROFILE_ID = "demo-megan";

export const alleatoAiDemoProfiles: AlleatoAiUserProfile[] = [
  {
    userId: "demo-megan",
    displayName: "Megan",
    emailPatterns: ["megan"],
    role: "Executive Sponsor",
    company: "Alleato",
    focusAreas: ["Portfolio visibility", "AI summaries", "Client communication"],
    knownPriorities: [
      "Quickly identify projects needing attention",
      "Understand risks without digging through tasks",
    ],
    knownPainPoints: [
      "Too much project information spread across different tools",
    ],
    excitedAbout: [
      "AI daily briefing",
      "Project health summaries",
      "Draft client updates",
    ],
    recommendedWorkflow: "executive-command-center",
    recommendedProjectId: "riverside-buildout",
    recommendedProjectPath: "/financial-insights",
    adminNotes:
      "Megan cares most about executive visibility. Lead with portfolio health, then show AI-generated client updates.",
    preferredTone: "executive",
  },
  {
    userId: "demo-chris",
    displayName: "Chris",
    emailPatterns: ["chris"],
    role: "Project Manager",
    company: "Alleato",
    focusAreas: ["Daily priorities", "Task ownership", "Schedule blockers"],
    knownPriorities: [
      "See what needs attention today",
      "Keep ownership and follow-up clear across project teams",
    ],
    knownPainPoints: [
      "Unclear handoffs between field updates, RFIs, and schedule impacts",
    ],
    excitedAbout: [
      "Today view",
      "Blocker summaries",
      "Ownership prompts",
    ],
    recommendedWorkflow: "project-manager-daily-priorities",
    recommendedProjectId: "goodwill-bart",
    recommendedProjectPath: "/1/home",
    adminNotes:
      "Chris is likely to care about field team adoption, mobile usability, blockers, and clear task ownership. Show daily priorities first.",
    preferredTone: "practical",
  },
  {
    userId: "demo-sarah",
    displayName: "Sarah",
    emailPatterns: ["sarah"],
    role: "Client-Facing Team Lead",
    company: "Alleato",
    focusAreas: ["Client updates", "Documents", "Project communication"],
    knownPriorities: [
      "Turn project activity into clear client-ready updates",
      "Find the right documents and decisions quickly",
    ],
    knownPainPoints: [
      "Status updates take too long to assemble from scattered notes",
    ],
    excitedAbout: [
      "AI-generated client updates",
      "Document-aware summaries",
      "Weekly change summaries",
    ],
    recommendedWorkflow: "client-update-drafting",
    recommendedProjectId: "client-update-demo",
    recommendedProjectPath: "/1/emails",
    adminNotes:
      "Sarah is excited about AI-generated client updates. Lead with communication, documents, and a draftable status summary.",
    preferredTone: "client-facing",
  },
  {
    userId: "demo-daniel",
    displayName: "Daniel",
    emailPatterns: ["daniel"],
    role: "Operations Lead",
    company: "Alleato",
    focusAreas: ["Workload visibility", "Handoffs", "Process consistency"],
    knownPriorities: [
      "Find overdue items before they become escalations",
      "Make handoffs and next owners visible",
    ],
    knownPainPoints: [
      "Task ownership is unclear across teams and tools",
    ],
    excitedAbout: [
      "Risk summary",
      "Overdue item review",
      "Handoff tracking",
    ],
    recommendedWorkflow: "operations-handoff-review",
    recommendedProjectId: "operations-demo",
    recommendedProjectPath: "/1/tasks",
    adminNotes:
      "Daniel has been frustrated by unclear task ownership in current tools. Show risk summary and handoff review first.",
    preferredTone: "operations",
  },
];

export function findAlleatoAiProfile(input: {
  profileId?: string | null;
  email?: string | null;
  displayName?: string | null;
}) {
  if (input.profileId) {
    const exact = alleatoAiDemoProfiles.find(
      (profile) => profile.userId === input.profileId,
    );
    if (exact) {
      return exact;
    }
  }

  const normalizedEmail = input.email?.toLowerCase() ?? "";
  const normalizedName = input.displayName?.toLowerCase() ?? "";
  const matched = alleatoAiDemoProfiles.find((profile) =>
    profile.emailPatterns?.some(
      (pattern) =>
        normalizedEmail.includes(pattern.toLowerCase()) ||
        normalizedName.includes(pattern.toLowerCase()),
    ),
  );

  return matched ?? alleatoAiDemoProfiles[0];
}
