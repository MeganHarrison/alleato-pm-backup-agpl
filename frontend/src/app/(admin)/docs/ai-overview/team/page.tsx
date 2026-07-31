import type { Metadata } from "next";
import { Briefcase } from "lucide-react";

import { PageShell } from "@/components/layout";
import { SectionNav } from "../_components/section-nav";
import { Section, SectionTitleContent } from "../_components/section-shell";
import { loadAgents, type AgentSummary } from "../_lib/ai-stats";

export const metadata: Metadata = {
  title: "Eve and executive skills",
  description:
    "One Eve runtime applies six executive skills and uses authenticated production tools.",
};

export const dynamic = "force-dynamic";

const SKILL_OWNS: Record<AgentSummary["name"], string[]> = {
  "business-development": [
    "Pipeline, pursuits, and growth opportunities",
    "Market positioning and relationship strategy",
  ],
  "financial-analysis": [
    "Margin, cash, budget, and forecast analysis",
    "Financial exposure and supporting evidence",
  ],
  "marketing-strategy": [
    "Market signals, campaigns, and content strategy",
    "Positioning grounded in approved source material",
  ],
  "operations-review": [
    "Schedule, commitments, RFIs, and delivery status",
    "Execution blockers and operational follow-through",
  ],
  "people-capacity": [
    "Staffing, ownership, workload, and capacity",
    "People-related gaps that affect delivery",
  ],
  "risk-review": [
    "Cross-project risk and evidence gaps",
    "Exposure, mitigations, and decision priorities",
  ],
};

const SELECTION_EXAMPLES = [
  {
    question: '"How are we tracking on margin?"',
    behavior: "Eve applies financial analysis and reads financial tools",
  },
  {
    question: '"Which projects are most at risk?"',
    behavior: "Eve combines risk review with portfolio risk tools",
  },
  {
    question: '"Where are we short on project leadership?"',
    behavior: "Eve applies people and capacity with staffing tools",
  },
  {
    question: '"What did we decide last meeting?"',
    behavior: "Eve searches authenticated meeting and document sources",
  },
];

function SkillCard({ skill }: { skill: AgentSummary }) {
  return (
    <div className="rounded-lg bg-muted/40 p-5">
      <div className="flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Briefcase className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-base font-semibold text-foreground">{skill.label}</p>
            <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
              {skill.description}
            </p>
          </div>
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              What it contributes
            </p>
            <ul className="space-y-1">
              {SKILL_OWNS[skill.name].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span
                    className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50"
                    aria-hidden="true"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <p className="truncate font-mono text-xs text-muted-foreground">{skill.promptFile}</p>
        </div>
      </div>
    </div>
  );
}

export default async function TeamPage() {
  const skills = await loadAgents();

  return (
    <PageShell
      variant="content"
      title="Eve and executive skills"
      titleContent={
        <SectionTitleContent
          title="Eve and executive skills"
          subtitle="One Eve runtime answers every request. Six skills shape its analysis; authenticated tools supply the evidence."
        />
      }
    >
      <SectionNav />
      <div className="space-y-14">
        <Section
          eyebrow="Runtime owner"
          title="One Eve root"
          description="Eve owns reasoning, skill selection, tool calls, and the final response. Skills are instruction modules inside Eve, not separate workers."
        >
          <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
            <p>
              Eve selects the relevant skill from the user&apos;s question and verified surface
              context. It can combine multiple skills when the question crosses domains.
            </p>
            <p>
              Data access comes from the authenticated production tool catalog. Project-scoped
              tools enforce the signed-in user&apos;s project access before returning evidence.
            </p>
          </div>
        </Section>

        <Section
          eyebrow="Executive skills"
          title="Six live analysis skills"
          description="Each skill changes how Eve evaluates evidence and structures the answer."
        >
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {skills.map((skill) => (
              <li key={skill.name}>
                <SkillCard skill={skill} />
              </li>
            ))}
          </ul>
        </Section>

        <Section
          eyebrow="Selection"
          title="How Eve chooses skills and tools"
          description="The user does not select a skill manually. Eve interprets the request, applies the relevant guidance, and calls the tools needed to verify the answer."
        >
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {SELECTION_EXAMPLES.map(({ question, behavior }) => (
              <li key={question} className="rounded-lg bg-muted/40 p-4">
                <p className="text-sm text-foreground">{question}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {behavior}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </PageShell>
  );
}
