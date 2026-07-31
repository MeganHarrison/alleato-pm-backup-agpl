import { defineEval } from "eve/evals";
import {
  EXECUTIVE_SKILL_CASES,
  EXECUTIVE_SKILLS,
  toExecutiveSkillEvalPrompt,
} from "./executive-skill-cases.js";

export default EXECUTIVE_SKILL_CASES.map((testCase) =>
  defineEval({
    description: testCase.description,
    metadata: { category: testCase.category },
    tags: [testCase.category, ...testCase.expectedSkills],
    async test(t) {
      await t.send(toExecutiveSkillEvalPrompt(testCase.prompt));
      t.succeeded();
      t.noFailedActions();
      for (const skill of EXECUTIVE_SKILLS) {
        if (testCase.expectedSkills.includes(skill)) {
          t.loadedSkill(skill);
        } else {
          t.calledTool("load_skill", {
            count: 0,
            input: { skill },
          });
        }
      }
    },
  }),
);
