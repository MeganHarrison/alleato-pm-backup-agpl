export const EXECUTIVE_SKILLS = [
  "financial-analysis",
  "operations-review",
  "risk-review",
  "people-capacity",
  "business-development",
  "marketing-strategy",
] as const;

export type ExecutiveSkill = (typeof EXECUTIVE_SKILLS)[number];

export type ExecutiveSkillCase = {
  category: "positive" | "confusing-neighbor" | "collision" | "negative";
  description: string;
  expectedSkills: readonly ExecutiveSkill[];
  prompt: string;
};

export function toExecutiveSkillEvalPrompt(prompt: string): string {
  return `${prompt}\n\nFor this evaluation, make reasonable assumptions, answer directly, and do not ask follow-up questions.`;
}

export const EXECUTIVE_SKILL_CASES: readonly ExecutiveSkillCase[] = [
  {
    category: "positive",
    description: "Cash-flow analysis loads the financial procedure.",
    expectedSkills: ["financial-analysis"],
    prompt: "Analyze cash flow, invoice aging, margin, and financial exposure.",
  },
  {
    category: "positive",
    description: "Schedule workflow analysis loads the operations procedure.",
    expectedSkills: ["operations-review"],
    prompt: "Analyze overdue RFIs, submittals, schedule blockers, and action owners.",
  },
  {
    category: "positive",
    description: "Enterprise risk analysis loads the risk procedure.",
    expectedSkills: ["risk-review"],
    prompt: "Analyze our highest contract, claim, compliance, and procurement risks.",
  },
  {
    category: "positive",
    description: "Staffing analysis loads the people procedure.",
    expectedSkills: ["people-capacity"],
    prompt: "Analyze workload, staffing gaps, role coverage, and accountability.",
  },
  {
    category: "positive",
    description: "Pursuit analysis loads the business-development procedure.",
    expectedSkills: ["business-development"],
    prompt: "Analyze our pursuit pipeline, client relationships, and proposal positioning.",
  },
  {
    category: "positive",
    description: "Content planning loads the marketing procedure.",
    expectedSkills: ["marketing-strategy"],
    prompt: "Build a source-backed LinkedIn, case-study, and newsletter content plan.",
  },
  {
    category: "confusing-neighbor",
    description: "Labor-cost analysis stays financial despite staffing context.",
    expectedSkills: ["financial-analysis"],
    prompt: "Treat staffing only as an input and analyze its impact on labor cost, margin, and cash.",
  },
  {
    category: "confusing-neighbor",
    description: "Procurement workflow stays operational despite risk language.",
    expectedSkills: ["operations-review"],
    prompt: "Focus on procurement workflow sequencing and owners; do not perform an enterprise risk review.",
  },
  {
    category: "confusing-neighbor",
    description: "Proposal liability stays a risk review despite pursuit context.",
    expectedSkills: ["risk-review"],
    prompt: "Review contractual liability in a pursuit; do not assess win strategy or positioning.",
  },
  {
    category: "confusing-neighbor",
    description: "Role coverage stays a capacity review despite schedule impact.",
    expectedSkills: ["people-capacity"],
    prompt: "Assess role coverage and workload; schedule delay is context, not an operations review.",
  },
  {
    category: "confusing-neighbor",
    description: "Case studies used for a pursuit stay business development.",
    expectedSkills: ["business-development"],
    prompt: "Select past-project proof for a live pursuit; do not create a marketing calendar.",
  },
  {
    category: "confusing-neighbor",
    description: "Thought leadership stays marketing despite client references.",
    expectedSkills: ["marketing-strategy"],
    prompt: "Plan thought leadership for existing client stories; do not score a pursuit pipeline.",
  },
  {
    category: "collision",
    description: "Financial exposure and contract risk load both procedures.",
    expectedSkills: ["financial-analysis", "risk-review"],
    prompt: "Analyze cash exposure and the contract risks that could change the forecast.",
  },
  {
    category: "collision",
    description: "Operations and staffing capacity load both procedures.",
    expectedSkills: ["operations-review", "people-capacity"],
    prompt: "Analyze schedule blockers and whether staffing capacity can clear them.",
  },
  {
    category: "collision",
    description: "Pursuit and campaign planning load both growth procedures.",
    expectedSkills: ["business-development", "marketing-strategy"],
    prompt: "Plan the pursuit strategy and the supporting account-based marketing campaign.",
  },
  {
    category: "collision",
    description: "Risk-driven operational recovery loads both procedures.",
    expectedSkills: ["risk-review", "operations-review"],
    prompt: "Identify procurement risks and build the operational recovery sequence.",
  },
  {
    category: "collision",
    description: "Growth staffing loads business-development and capacity procedures.",
    expectedSkills: ["business-development", "people-capacity"],
    prompt: "Assess the pursuit pipeline and the staffing capacity required to deliver wins.",
  },
  {
    category: "collision",
    description: "Marketing investment loads marketing and financial procedures.",
    expectedSkills: ["marketing-strategy", "financial-analysis"],
    prompt: "Plan the campaign and analyze its budget, cash timing, and expected margin.",
  },
  {
    category: "negative",
    description: "A financial definition does not trigger a company analysis.",
    expectedSkills: [],
    prompt: "Define cash flow in one sentence without reviewing Alleato data.",
  },
  {
    category: "negative",
    description: "An acronym definition does not trigger operations analysis.",
    expectedSkills: [],
    prompt: "What does RFI stand for? Do not review any project.",
  },
  {
    category: "negative",
    description: "A generic definition does not trigger risk analysis.",
    expectedSkills: [],
    prompt: "Define compliance in plain English without assessing our risks.",
  },
  {
    category: "negative",
    description: "A generic definition does not trigger people analysis.",
    expectedSkills: [],
    prompt: "Define accountability in one sentence without assessing a team.",
  },
  {
    category: "negative",
    description: "A generic definition does not trigger pursuit analysis.",
    expectedSkills: [],
    prompt: "What is a proposal? Do not review our pipeline.",
  },
  {
    category: "negative",
    description: "A generic definition does not trigger marketing analysis.",
    expectedSkills: [],
    prompt: "What is a newsletter? Do not create a content plan.",
  },
];
