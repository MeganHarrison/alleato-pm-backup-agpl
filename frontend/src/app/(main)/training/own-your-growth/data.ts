export type SkillLevel = { v: number; name: string; desc: string };

export type Skill = { n: string; d: string };

export type PromptItem = { q: string; t: string };

export type LibraryChip = { label: string; solid: boolean };

export type LibraryItem = {
  tag: string;
  h: string;
  p: string;
  chips: LibraryChip[];
};

export const LEVELS: SkillLevel[] = [
  { v: 10, name: "Aware", desc: "I've heard of it but haven't really done it." },
  {
    v: 40,
    name: "Assisted",
    desc: "I can do it with an SOP or Claude, but a PM/Super needs to double-check my work.",
  },
  {
    v: 65,
    name: "Capable",
    desc: "I can do it on my own most of the time; still hit edge cases I'm unsure of.",
  },
  {
    v: 80,
    name: "Solo",
    desc: "I do it solo, document decisions, and escalate problems with a recommendation (1-3-1).",
  },
  { v: 100, name: "Teach", desc: 'I can teach "the Alleato way" of doing this to a new hire.' },
];

export function levelFor(v: number): string {
  if (v >= 100) return "Teach";
  if (v >= 80) return "Solo";
  if (v >= 65) return "Capable";
  if (v >= 40) return "Assisted";
  if (v > 0) return "Aware";
  return "—";
}

export const CORE: Skill[] = [
  {
    n: "Ownership & Reliability",
    d: "Own your work and your growth. Do what you said you'd do, on time, without being chased.",
  },
  {
    n: "Communication & Documentation",
    d: "Clear and timely, written and verbal. Leave a clean record others can follow.",
  },
  {
    n: "Self-Teaching & AI",
    d: "Learn first — try it, look it up, use Claude — then bring a sharper question.",
  },
  {
    n: "Problem-Solving (1-3-1)",
    d: "Bring one problem, three possible solutions, and your one recommendation.",
  },
  {
    n: "The Alleato Way (SOPs)",
    d: "Know and follow our standard process — and help make it better.",
  },
];

export const ROLES: Record<string, Skill[]> = {
  "Project Engineer": [
    {
      n: "Reading Drawings",
      d: "Civil, architectural, structural & MEP sets — reading them together, catching conflicts.",
    },
    {
      n: "RFIs & Submittals",
      d: "Writing clear RFIs and logging/tracking submittals against the specs.",
    },
    { n: "Scheduling Logic", d: "Look-aheads and MS Project — sequence, float, start-to-start, lag." },
    {
      n: "Subcontractor Coordination",
      d: "Coordinating trades in the field, holding scope, running short interval work.",
    },
    { n: "SOP & Process Adherence", d: "Doing it the Alleato way — following the standard process every time." },
    {
      n: "Budget & Cost Awareness",
      d: "Cost codes, change orders, understanding how field decisions hit the budget.",
    },
    {
      n: "Construction Software & AI",
      d: "Our platform, Bluebeam, MS Project, and using Claude to teach yourself faster.",
    },
  ],
  "Assistant Superintendent": [
    { n: "Site Logistics & Planning", d: "Daily reports, look-aheads & pull planning (Last Planner) on the ground." },
    { n: "Quality Control", d: "OSHA, IOSHA, JHAs, toolbox talks — layout & trade coordination." },
    { n: "Inspections & The AHJ", d: "Scheduling inspections and working with the authority having jurisdiction." },
    { n: "Field Leadership", d: "Running the crew, holding the schedule, setting the standard on site." },
    { n: "Reading Drawings", d: "Reading the full set in the field and catching conflicts early." },
    { n: "SOP & Process Adherence", d: "Following the standard site process every time." },
    { n: "Construction Software & AI", d: "Our platform, field tools, and Claude for faster answers." },
  ],
  Superintendent: [
    { n: "Master Scheduling", d: "Owning the schedule — sequence, float, recovery, look-aheads." },
    { n: "Field Leadership", d: "Leading multiple crews and trades; setting the site culture." },
    { n: "Safety & Compliance", d: "OSHA/IOSHA, JHAs, and a zero-incident standard." },
    { n: "Subcontractor Management", d: "Holding subs to scope, schedule and quality." },
    { n: "Quality Control", d: "Owning the punch, inspections, and the AHJ relationship." },
    { n: "Budget & Cost Awareness", d: "Field decisions, change orders, and cost impact." },
    { n: "SOP & Process Adherence", d: "Running the Alleato way and improving it." },
  ],
  "Assistant Project Manager": [
    { n: "Buyout & Subcontracts", d: "Scopes of work, buyout, and writing tight subcontracts." },
    { n: "RFIs & Submittals", d: "Owning the RFI and submittal logs end to end." },
    { n: "Change Order Management", d: "Pricing, documenting and tracking changes." },
    { n: "Scheduling Logic", d: "Look-aheads, MS Project, float and critical path." },
    { n: "Budget & Cost Control", d: "Cost codes, projections, and cost reports." },
    { n: "Communication & Documentation", d: "Meeting minutes, owner comms, clean written record." },
    { n: "Construction Software & AI", d: "Our platform, procurement logs, and Claude." },
  ],
  "Project Manager": [
    { n: "Reading Drawings & Specs", d: "The full set + specs, catching conflicts before they cost." },
    { n: "Submittals, RFIs & Buyout", d: "Owning submittal review, RFIs, subcontractor buyout & scopes." },
    { n: "Change Orders & Contracts", d: "Change orders, pay apps (G702/G703), cost control, contracts." },
    { n: "Scheduling & Sequencing", d: "Master schedule, critical path, recovery planning." },
    { n: "Budget & Financials", d: "Projections, WIP, margin protection, owner billings." },
    { n: "Client & Team Leadership", d: "Owner relationship, running the team, closeout." },
    { n: "Construction Software & AI", d: "Our platform, procurement logs, and Claude for leverage." },
  ],
  Estimator: [
    { n: "Quantity Takeoff", d: "Accurate takeoffs from drawings across trades." },
    { n: "Reading Drawings & Specs", d: "Reading civil, arch, structural, MEP together with the specs." },
    { n: "Pricing & Unit Costs", d: "Building pricing from historicals, quotes and unit costs." },
    { n: "Bid Assembly", d: "Assembling clean, competitive, complete bids." },
    { n: "Scope Review", d: "Catching gaps and overlaps in trade scopes." },
    { n: "Subcontractor Quotes", d: "Soliciting, leveling and comparing sub quotes." },
    { n: "Construction Software & AI", d: "Estimating tools, Bluebeam, and Claude to move faster." },
  ],
};

export const PROMPTS: PromptItem[] = [
  {
    q: "DRAWINGS",
    t: "Explain how to read a civil grading plan like I'm new to commercial construction — what symbols and callouts matter most.",
  },
  {
    q: "SUBMITTALS",
    t: "Summarize this 50-page MEP submittal into key items, then list what I should verify against the project specs.",
  },
  {
    q: "SCHEDULE",
    t: "Walk me through building a look-ahead schedule in MS Project — what is start-to-start, float, and lag?",
  },
  {
    q: "SOP",
    t: "Turn how I just did this task (from my screen recording / notes) into a clean step-by-step SOP.",
  },
  {
    q: "RFI",
    t: "Draft an RFI for this unclear detail; ask me any questions you need to make it complete and professional.",
  },
  { q: "QUIZ ME", t: "Quiz me on FM Global / in-rack sprinkler basics until I can answer without notes." },
];

export const LIBRARY: LibraryItem[] = [
  {
    tag: "Module 1",
    h: "The Method",
    p: "Start here. Four principles, six steps: list the real skills of your role, score each honestly 0–100, see the gaps, and build precise daily reps. 45 minutes, once — then a habit.",
    chips: [
      { label: "Workbook (PDF)", solid: true },
      { label: "Audio overview", solid: false },
      { label: "Ask questions", solid: false },
    ],
  },
  {
    tag: "Module 2",
    h: "The Skill Wheel Exercise",
    p: "The core rep. Label eight wedges with your real skills, shade each to your honest score, and let the short wedges tell you exactly where to aim. Re-shade at 30/60/90 days and watch it fill out.",
    chips: [
      { label: "Do the exercise", solid: true },
      { label: "Worked example", solid: false },
      { label: "Quiz yourself", solid: false },
    ],
  },
  {
    tag: "Module 3",
    h: "For Managers: Coaching It",
    p: "Run it as a coaching tool, never a scorecard. Right-size scores both ways, hold the line at 2–4 focus areas, and give feedback that actually moves the wheel.",
    chips: [
      { label: "Facilitator guide", solid: true },
      { label: "Coaching prompts", solid: false },
    ],
  },
  {
    tag: "Module 4",
    h: "Self-Teaching with AI",
    p: "Learn first, then ask a sharper question. Ready-to-use prompts for drawings, scheduling, RFIs and SOPs — plus the 15–30 minute daily micro-routine that compounds. Always verify against real specs.",
    chips: [
      { label: "Prompt library", solid: true },
      { label: "Listen", solid: false },
    ],
  },
  {
    tag: "PM Track",
    h: "Running a Project — PM / PE",
    p: "Everything the office side needs to run a job: drawings & specs, submittals, RFIs, buyout, change orders, pay apps, cost control, contracts and closeout — paired with the best videos and courses.",
    chips: [
      { label: "PM Handbook", solid: true },
      { label: "Resource Library", solid: false },
    ],
  },
  {
    tag: "Field Track",
    h: "Running a Jobsite — Superintendent",
    p: "Everything the field side needs: site logistics & planning, daily reports, look-aheads & pull planning, QC, safety, layout, coordination, inspections & the AHJ — how-to for each, with curated resources.",
    chips: [
      { label: "Superintendent Handbook", solid: true },
      { label: "Resource Library", solid: false },
    ],
  },
  {
    tag: "Our Software",
    h: "Alleato PM Software — How to Use It",
    p: 'Our project management platform that replaced Job Planner. Budgets, commitments, change events, invoices, meetings, documents, scheduling — with a worked "Create a Change Event" example.',
    chips: [
      { label: "Software Guide", solid: true },
      { label: "SOP & Training Hub", solid: false },
    ],
  },
  {
    tag: "AI · Always-On",
    h: "Training Finder (AI Skill)",
    p: "A reusable AI skill that finds training material on ANY construction topic on demand. It searches the web, vets the sources, and hands back curated videos, courses and a draft how-to guide — you keep growing without starting from scratch.",
    chips: [{ label: "How to use it", solid: true }],
  },
];

export const HERO_WHEEL_VALUES = [92, 74, 58, 80, 42, 66, 88, 50, 71, 95, 60, 78, 45];
