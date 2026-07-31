export type AiFeatureCategory =
  | "assistant"
  | "financial"
  | "governance"
  | "knowledge"
  | "personalization";

export interface AiFeaturePoint {
  title: string;
  description: string;
}

export interface AiFeatureProcessStep {
  title: string;
  description: string;
}

export interface AiFeatureDetail {
  id: string;
  name: string;
  title: string;
  summary: string;
  category: AiFeatureCategory;
  workflow: string;
  href: string;
  launchHref: string;
  launchLabel: string;
  proof: [{ value: string; label: string }, { value: string; label: string }];
  challenge: {
    description: string;
    points: AiFeaturePoint[];
  };
  solution: {
    description: string;
    points: AiFeaturePoint[];
  };
  humansInTheLoop: AiFeaturePoint[];
  deployments: AiFeaturePoint[];
  process: AiFeatureProcessStep[];
  result: {
    description: string;
    points: AiFeaturePoint[];
  };
}

function featureHref(id: string) {
  return `/ai/features/${id}`;
}

export const aiFeatureCatalog: AiFeatureDetail[] = [
  {
    id: "project-cost-allocation-wip",
    name: "Cost allocation & WIP analysis",
    title: "Project cost allocation & WIP analysis",
    summary:
      "Connect project cost sources, surface WIP and margin variance, and keep every finding tied to the underlying record.",
    category: "financial",
    workflow: "Analyze financial exposure",
    href: featureHref("project-cost-allocation-wip"),
    launchHref: "/ai",
    launchLabel: "Start in MKH AI",
    proof: [
      {
        value: "Source-backed",
        label: "Every finding stays connected to project evidence.",
      },
      {
        value: "Approval-gated",
        label: "The assistant proposes; your team decides.",
      },
    ],
    challenge: {
      description:
        "Project costing and work-in-progress analysis depend on information spread across budgets, commitments, invoices, change records, and progress updates. Manual reconciliation delays visibility and makes margin drift harder to catch.",
      points: [
        {
          title: "Manual allocation",
          description:
            "Shared and indirect costs are coded inconsistently across projects.",
        },
        {
          title: "Delayed WIP review",
          description:
            "Completion and billing signals arrive after the decision window.",
        },
        {
          title: "Fragmented variance",
          description:
            "Cost, schedule, and change exposure are reviewed in separate tools.",
        },
      ],
    },
    solution: {
      description:
        "MKH AI assembles the connected financial record, compares actual and forecast conditions, and explains the variances that require attention. The output is a reviewable operating brief—not an unaudited black-box answer.",
      points: [
        {
          title: "Connected cost model",
          description:
            "Budgets, commitments, direct costs, invoices, and changes are evaluated together.",
        },
        {
          title: "Predictive WIP review",
          description:
            "Completion, billing, and exposure signals are compared before period close.",
        },
        {
          title: "Evidence-linked findings",
          description:
            "Each risk links back to the project record that supports it.",
        },
        {
          title: "Action-ready output",
          description:
            "The review ends with prioritized next steps and named approval points.",
        },
      ],
    },
    humansInTheLoop: [
      {
        title: "Project manager",
        description:
          "Confirms field progress, pending scope, and operational context.",
      },
      {
        title: "Accounting",
        description:
          "Validates cost treatment, billing status, and period-close assumptions.",
      },
      {
        title: "Executive reviewer",
        description:
          "Approves corrective action when margin or cash exposure crosses tolerance.",
      },
    ],
    deployments: [
      {
        title: "Project review",
        description:
          "Run before owner meetings, forecast updates, or change-management decisions.",
      },
      {
        title: "Period close",
        description:
          "Use as a source-backed review layer before final WIP reporting.",
      },
      {
        title: "Portfolio escalation",
        description:
          "Surface the projects whose evidence indicates material exposure.",
      },
    ],
    process: [
      { title: "Project ledger", description: "Budget and cost records" },
      {
        title: "Progress signals",
        description: "Schedule, billing, and field status",
      },
      {
        title: "Variance analysis",
        description: "Cost, margin, and WIP exceptions",
      },
      {
        title: "Human review",
        description: "Confirm assumptions and proposed actions",
      },
      {
        title: "Operating decision",
        description: "Approve, assign, or investigate",
      },
    ],
    result: {
      description:
        "Teams get earlier visibility into project financial exposure without sacrificing review control. The result is a faster WIP conversation, clearer corrective action, and a defensible path from every conclusion back to source evidence.",
      points: [
        {
          title: "Earlier margin visibility",
          description:
            "Material drift is surfaced while the team can still respond.",
        },
        {
          title: "Faster reconciliation",
          description:
            "The review starts from connected evidence instead of manual collection.",
        },
        {
          title: "Stronger decisions",
          description: "Assumptions, owners, and next actions remain explicit.",
        },
      ],
    },
  },
  {
    id: "assistant",
    name: "AI assistant",
    title: "Source-backed project assistant",
    summary:
      "Ask project questions, investigate risk, and start governed workflows from one conversation.",
    category: "assistant",
    workflow: "Ask and investigate",
    href: featureHref("assistant"),
    launchHref: "/ai",
    launchLabel: "Open AI assistant",
    proof: [
      {
        value: "Connected",
        label: "Answers draw from approved project and company sources.",
      },
      {
        value: "Actionable",
        label: "Conversations can move into governed workflows.",
      },
    ],
    challenge: {
      description:
        "Project decisions are slowed by fragmented records and repeated manual research. Teams need answers quickly, but they also need to understand which sources support the answer and what they can safely do next.",
      points: [
        {
          title: "Scattered context",
          description:
            "Critical information lives across multiple project tools.",
        },
        {
          title: "Slow investigation",
          description: "Teams repeat the same searches before every decision.",
        },
        {
          title: "Unclear trust",
          description: "Generic AI answers do not show what evidence was used.",
        },
      ],
    },
    solution: {
      description:
        "The MKH AI assistant connects the conversation to approved Alleato sources, shows evidence, and routes proposed actions through the appropriate review path.",
      points: [
        {
          title: "Contextual answers",
          description: "Project and company scope follow the user’s question.",
        },
        {
          title: "Visible evidence",
          description: "Source records stay close to important claims.",
        },
        {
          title: "Guided actions",
          description: "The assistant proposes the next useful workflow.",
        },
        {
          title: "Durable receipts",
          description: "Actions retain approval and execution context.",
        },
      ],
    },
    humansInTheLoop: [
      {
        title: "Requester",
        description: "Frames the question and confirms the working scope.",
      },
      {
        title: "Record owner",
        description: "Reviews proposed changes before project data is updated.",
      },
      {
        title: "Admin",
        description: "Controls available skills, sources, and permissions.",
      },
    ],
    deployments: [
      {
        title: "Project workspace",
        description: "Investigate a selected project in context.",
      },
      {
        title: "Company workspace",
        description: "Review cross-project or operational questions.",
      },
      {
        title: "Persistent widget",
        description: "Ask from the current workflow without leaving the page.",
      },
    ],
    process: [
      { title: "Question", description: "User intent and scope" },
      { title: "Source plan", description: "Relevant approved evidence" },
      { title: "Answer", description: "Claims with citations" },
      { title: "Review", description: "User validates the result" },
      { title: "Next action", description: "Open or approve a workflow" },
    ],
    result: {
      description:
        "Users spend less time hunting for context and more time making decisions. Answers remain useful because they show their evidence and lead to a clear next action.",
      points: [
        {
          title: "Faster orientation",
          description: "Start from an assembled project context.",
        },
        {
          title: "Higher confidence",
          description: "Important claims remain traceable.",
        },
        {
          title: "Less workflow switching",
          description: "Move from question to action in context.",
        },
      ],
    },
  },
  {
    id: "approvals",
    name: "AI action approvals",
    title: "Governed approval for Eve RFI creation",
    summary:
      "Approve or deny Eve's exact RFI payload inline before one project record is created.",
    category: "governance",
    workflow: "Review and decide",
    href: featureHref("approvals"),
    launchHref: "/ai/approvals",
    launchLabel: "View approval registry",
    proof: [
      {
        value: "Inline approval",
        label: "Eve parks the RFI call until the requester approves or denies it.",
      },
      {
        value: "Receipt kept",
        label: "The approved payload, Eve call, and idempotent execution stay linked.",
      },
    ],
    challenge: {
      description:
        "AI can accelerate project administration, but silent writes create unacceptable operational risk. Reviewers need to see exactly what will change, why it was proposed, and what evidence supports it.",
      points: [
        {
          title: "Hidden mutations",
          description:
            "Unreviewed automation can change critical records silently.",
        },
        {
          title: "Thin context",
          description:
            "Reviewers cannot decide when the source and consequence are missing.",
        },
        {
          title: "Weak accountability",
          description:
            "Approval history is lost when decisions happen outside the workflow.",
        },
      ],
    },
    solution: {
      description:
        "The live RFI action uses Eve's durable native approval request in chat. The separate approval registry is an administrative view; it does not resume an Eve session or make other mutation tools live.",
      points: [
        {
          title: "Readable proposal",
          description: "The intended record change is shown before execution.",
        },
        {
          title: "Permission recheck",
          description:
            "Current user, project, and RFI write access are verified again at execution.",
        },
        {
          title: "Deny safely",
          description: "Denying or cancelling creates no RFI and performs no fallback write.",
        },
        {
          title: "Decision receipt",
          description: "Approve, reject, and execution state remain visible.",
        },
      ],
    },
    humansInTheLoop: [
      {
        title: "AI assistant",
        description: "Prepares the exact typed RFI payload.",
      },
      {
        title: "Authorized reviewer",
        description: "Approves or rejects the payload in the originating chat.",
      },
      {
        title: "System executor",
        description:
          "Applies only the approved payload and records the result.",
      },
    ],
    deployments: [
      {
        title: "RFI creation",
        description: "Live for authorized users in the main AI Assistant.",
      },
      {
        title: "Approval registry",
        description: "Shows governance context but does not resume Eve approvals.",
      },
      {
        title: "Other mutations",
        description: "Remain unavailable until each action proves the same boundary.",
      },
    ],
    process: [
      { title: "Draft", description: "Eve prepares the exact RFI payload" },
      { title: "Permission", description: "RFI write access is verified" },
      { title: "Review", description: "Requester inspects the payload inline" },
      { title: "Decision", description: "Approve or reject" },
      { title: "Receipt", description: "One execution result is recorded" },
    ],
    result: {
      description:
        "Authorized users can create one well-defined record from chat without giving up human control, payload integrity, or retry safety.",
      points: [
        {
          title: "Safer automation",
          description: "The supported RFI write cannot bypass Eve approval.",
        },
        {
          title: "Quicker decisions",
          description: "The exact RFI fields arrive in the originating chat.",
        },
        {
          title: "Clear recovery",
          description: "Denied, failed, and replayed calls remain explicit.",
        },
      ],
    },
  },
  {
    id: "skill-library",
    name: "Skill library",
    title: "Approved procedures for repeatable AI work",
    summary: "Browse the approved procedures the assistant can apply.",
    category: "knowledge",
    workflow: "Browse procedures",
    href: featureHref("skill-library"),
    launchHref: "/ai/skills",
    launchLabel: "Open skill library",
    proof: [
      {
        value: "Repeatable",
        label: "Shared procedures reduce one-off prompting.",
      },
      {
        value: "Governed",
        label: "Published skills define scope and expected output.",
      },
    ],
    challenge: {
      description:
        "One-off prompts produce inconsistent results and make good operating methods difficult to reuse. Teams need a shared catalog of approved procedures.",
      points: [
        {
          title: "Prompt drift",
          description: "The same job is described differently every time.",
        },
        {
          title: "Hidden methods",
          description:
            "Strong procedures remain trapped with individual users.",
        },
        {
          title: "Unclear capability",
          description: "Users cannot see what the assistant is prepared to do.",
        },
      ],
    },
    solution: {
      description:
        "The skill library makes approved AI procedures discoverable, explains when each one applies, and keeps execution connected to a consistent contract.",
      points: [
        {
          title: "Clear intent",
          description: "Each skill names the job and expected result.",
        },
        {
          title: "Shared inputs",
          description: "Required context is defined before execution.",
        },
        {
          title: "Consistent output",
          description: "The procedure establishes a repeatable response shape.",
        },
        {
          title: "Visible governance",
          description: "Availability and ownership are explicit.",
        },
      ],
    },
    humansInTheLoop: [
      {
        title: "Operator",
        description: "Selects the skill that matches the current job.",
      },
      {
        title: "Domain owner",
        description: "Confirms the procedure reflects approved practice.",
      },
      {
        title: "Admin",
        description: "Publishes, updates, or retires shared skills.",
      },
    ],
    deployments: [
      {
        title: "Conversation",
        description: "Skills can guide work started in the assistant.",
      },
      {
        title: "Workflow surface",
        description: "A canonical skill can power a focused AI feature.",
      },
      {
        title: "Team standard",
        description: "Approved procedures become shared operating practice.",
      },
    ],
    process: [
      { title: "Find", description: "Browse by job or domain" },
      { title: "Inspect", description: "Review purpose and inputs" },
      { title: "Run", description: "Apply the approved procedure" },
      { title: "Review", description: "Validate output and evidence" },
      { title: "Improve", description: "Feed corrections to the owner" },
    ],
    result: {
      description:
        "AI-assisted work becomes easier to discover, more consistent to run, and simpler to govern across the organization.",
      points: [
        {
          title: "Less reinvention",
          description: "Teams reuse approved operating methods.",
        },
        {
          title: "More consistency",
          description: "Inputs and outputs follow a known contract.",
        },
        {
          title: "Clear ownership",
          description: "Each procedure has a visible governance path.",
        },
      ],
    },
  },
  {
    id: "teach-alleato",
    name: "Teach Alleato",
    title: "Turn field knowledge into reviewed AI guidance",
    summary:
      "Submit field knowledge for review before it changes assistant behavior.",
    category: "knowledge",
    workflow: "Submit knowledge",
    href: featureHref("teach-alleato"),
    launchHref: "/ai/teach",
    launchLabel: "Open Teach Alleato",
    proof: [
      {
        value: "Human reviewed",
        label: "Submitted knowledge does not publish itself.",
      },
      {
        value: "Source aware",
        label: "Reviewers can inspect where the guidance came from.",
      },
    ],
    challenge: {
      description:
        "Operational knowledge is often communicated informally and disappears into conversations. Directly training AI from unreviewed notes, however, can spread mistakes.",
      points: [
        {
          title: "Knowledge loss",
          description:
            "Useful field judgment is difficult to capture consistently.",
        },
        {
          title: "Unreviewed guidance",
          description: "Raw submissions may be incomplete or project-specific.",
        },
        {
          title: "No correction loop",
          description: "Contributors cannot see what was accepted or changed.",
        },
      ],
    },
    solution: {
      description:
        "Teach Alleato captures proposed guidance, preserves its context, and routes it through a human review workflow before it can influence shared assistant behavior.",
      points: [
        {
          title: "Structured submission",
          description: "The contributor explains the rule and when it applies.",
        },
        {
          title: "Context preserved",
          description:
            "Project, source, and examples remain available to reviewers.",
        },
        {
          title: "Corrective review",
          description: "Reviewers can edit, comment, approve, or reject.",
        },
        {
          title: "Governed publication",
          description:
            "Only accepted guidance reaches shared memory or skills.",
        },
      ],
    },
    humansInTheLoop: [
      {
        title: "Contributor",
        description: "Captures the field knowledge and its context.",
      },
      {
        title: "Domain reviewer",
        description: "Corrects and decides whether the guidance is reusable.",
      },
      {
        title: "Admin",
        description:
          "Publishes accepted knowledge to the appropriate destination.",
      },
    ],
    deployments: [
      {
        title: "Field learning",
        description:
          "Capture lessons while the project context is still fresh.",
      },
      {
        title: "Process improvement",
        description: "Turn recurring corrections into governed guidance.",
      },
      {
        title: "Onboarding",
        description:
          "Preserve approved institutional knowledge for new teammates.",
      },
    ],
    process: [
      { title: "Submit", description: "Capture rule and context" },
      { title: "Triage", description: "Assign the right reviewer" },
      { title: "Correct", description: "Edit and add evidence" },
      { title: "Approve", description: "Accept or reject" },
      { title: "Publish", description: "Update the governed destination" },
    ],
    result: {
      description:
        "Useful operating knowledge becomes durable without allowing unreviewed advice to silently change assistant behavior.",
      points: [
        {
          title: "Knowledge retained",
          description: "Field judgment becomes searchable and reusable.",
        },
        {
          title: "Quality protected",
          description: "Review remains mandatory before publication.",
        },
        {
          title: "Learning visible",
          description:
            "Contributors can follow the disposition of a submission.",
        },
      ],
    },
  },
  {
    id: "ai-profile",
    name: "AI profile",
    title: "Personal context you can inspect and control",
    summary:
      "Review the preferences and personal context available to the assistant.",
    category: "personalization",
    workflow: "Review personal context",
    href: featureHref("ai-profile"),
    launchHref: "/ai/profile",
    launchLabel: "Open AI profile",
    proof: [
      {
        value: "Visible",
        label: "Users can inspect the context available to the assistant.",
      },
      {
        value: "Correctable",
        label: "Preferences can be updated when they are wrong.",
      },
    ],
    challenge: {
      description:
        "Personalized assistance is only useful when users understand what the system knows and can correct it. Hidden profile assumptions weaken trust.",
      points: [
        {
          title: "Opaque context",
          description: "Users cannot tell which preferences affect responses.",
        },
        {
          title: "Stale assumptions",
          description: "Roles and working preferences change over time.",
        },
        {
          title: "Weak control",
          description:
            "Incorrect context persists without an obvious fix path.",
        },
      ],
    },
    solution: {
      description:
        "The AI profile gives each user a readable view of the personal context available to the assistant and a direct path to correct it.",
      points: [
        {
          title: "Readable profile",
          description:
            "Role, preferences, and working context are presented plainly.",
        },
        {
          title: "Editable context",
          description: "Users can correct common personal assumptions.",
        },
        {
          title: "Scope clarity",
          description: "Personal context stays distinct from company memory.",
        },
        {
          title: "Controlled use",
          description:
            "The assistant applies only the context available to the user.",
        },
      ],
    },
    humansInTheLoop: [
      {
        title: "User",
        description: "Reviews and corrects their personal context.",
      },
      {
        title: "Assistant",
        description: "Uses the approved context to tailor responses.",
      },
      {
        title: "Admin",
        description: "Controls organization-level access and policy.",
      },
    ],
    deployments: [
      {
        title: "Personal assistance",
        description:
          "Adapt tone, role context, and preferred working patterns.",
      },
      {
        title: "Workflow defaults",
        description: "Use approved preferences to reduce repeated setup.",
      },
      {
        title: "Trust review",
        description:
          "Inspect the profile when a response feels incorrectly personalized.",
      },
    ],
    process: [
      { title: "Inspect", description: "See available personal context" },
      { title: "Correct", description: "Update inaccurate preferences" },
      { title: "Save", description: "Confirm the intended profile" },
      { title: "Apply", description: "Use context in assistance" },
      { title: "Review", description: "Revisit when needs change" },
    ],
    result: {
      description:
        "Personalization becomes transparent and useful because users can see, correct, and control the context shaping their assistant experience.",
      points: [
        {
          title: "Better relevance",
          description:
            "Responses align with the user’s actual role and preferences.",
        },
        {
          title: "Higher trust",
          description: "Personalization is visible instead of implied.",
        },
        {
          title: "Easy correction",
          description: "Bad assumptions have a direct fix path.",
        },
      ],
    },
  },
  {
    id: "memory-center",
    name: "Memory center",
    title: "Govern the company knowledge available to AI",
    summary: "Inspect and correct the company memories available to MKH AI.",
    category: "personalization",
    workflow: "Inspect company memory",
    href: featureHref("memory-center"),
    launchHref: "/settings/memory",
    launchLabel: "Open memory center",
    proof: [
      {
        value: "Inspectable",
        label: "Company memory is visible to authorized reviewers.",
      },
      {
        value: "Governed",
        label: "Corrections follow an explicit ownership path.",
      },
    ],
    challenge: {
      description:
        "Company context improves AI answers, but stale or incorrect memory can scale confusion. Authorized users need to know what the assistant can recall and how to correct it.",
      points: [
        {
          title: "Stale context",
          description:
            "Policies, preferences, and organizational facts change.",
        },
        {
          title: "Unknown provenance",
          description: "Reviewers need to understand where a memory came from.",
        },
        {
          title: "No ownership",
          description:
            "Incorrect knowledge persists when no correction path is clear.",
        },
      ],
    },
    solution: {
      description:
        "The memory center makes company-level AI context inspectable and correctable while preserving the boundary between shared memory and personal preferences.",
      points: [
        {
          title: "Memory inventory",
          description:
            "Authorized reviewers can inspect available company context.",
        },
        {
          title: "Source awareness",
          description: "Provenance stays visible where it is available.",
        },
        {
          title: "Correction workflow",
          description: "Stale or inaccurate items can be updated or removed.",
        },
        {
          title: "Scope boundary",
          description:
            "Company memory remains distinct from individual profiles.",
        },
      ],
    },
    humansInTheLoop: [
      {
        title: "Knowledge owner",
        description: "Confirms whether shared context is still accurate.",
      },
      {
        title: "Admin",
        description: "Corrects, retires, or approves company memories.",
      },
      {
        title: "User",
        description: "Reports answers that appear to rely on bad context.",
      },
    ],
    deployments: [
      {
        title: "Company policy",
        description: "Maintain approved organizational rules and preferences.",
      },
      {
        title: "Operational context",
        description: "Preserve durable knowledge used across projects.",
      },
      {
        title: "Quality recovery",
        description: "Trace and correct memory behind an inaccurate response.",
      },
    ],
    process: [
      { title: "Inspect", description: "Review shared memory" },
      { title: "Trace", description: "Check source and scope" },
      { title: "Correct", description: "Edit or retire bad context" },
      { title: "Approve", description: "Confirm the change" },
      { title: "Verify", description: "Test downstream behavior" },
    ],
    result: {
      description:
        "Company context stays useful because authorized people can inspect what the assistant knows, correct mistakes, and verify the result.",
      points: [
        {
          title: "More accurate context",
          description: "Stale knowledge has an explicit maintenance path.",
        },
        {
          title: "Clearer ownership",
          description: "Shared and personal memory remain separated.",
        },
        {
          title: "Faster recovery",
          description: "Bad context can be traced and corrected directly.",
        },
      ],
    },
  },
];

export function getAiFeature(featureSlug: string) {
  return aiFeatureCatalog.find((feature) => feature.id === featureSlug);
}
