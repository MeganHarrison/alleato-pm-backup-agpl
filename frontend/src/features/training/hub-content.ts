import type { HubModuleTileProps } from "./HubModuleTile";

/**
 * Ported from training-source/data.js (`modules`). The prototype's internal
 * Training Finder contributor link is represented by the employee-facing
 * Ask the Library route now that the grounded assistant exists.
 * Every course module with approved source material links to its owned
 * training route. HubModuleTile reserves "Coming soon" for modules that do
 * not yet have a registered destination.
 */
export const HUB_MODULE_TILES: HubModuleTileProps[] = [
  {
    tag: "MODULE 1",
    title: "The Method",
    description:
      "Start here. Four principles, six steps: list the real skills of your role, score each honestly (0–100), see the gaps on your wheel, pick 2–4 to attack, and build precise daily reps.",
    primaryLink: { label: "Read the method", href: "/training/method" },
  },
  {
    tag: "MODULE 2",
    title: "The Skill Wheel Exercise",
    description:
      "The core rep. Label eight wedges with your role's real skills, shade each to your honest score, and let the short wedges tell you exactly where to aim.",
    primaryLink: { label: "Build your wheel", href: "/training/growth" },
  },
  {
    tag: "MODULE 3",
    title: "For Managers: Coaching It",
    description:
      "Run it as a coaching tool, never a test. Right-size scores both ways, hold the line at 2–4 focus areas, and give feedback that actually moves the wheel.",
    primaryLink: {
      label: "Manager coaching guide",
      href: "/training/guides/manager-coaching-guide",
    },
  },
  {
    tag: "MODULE 4",
    title: "Self-Teaching with AI",
    description:
      "Learn first, then ask a sharper question. Use ready-to-use prompts for drawings, scheduling, RFIs, and SOPs. Always verify AI against the real drawings, specs, and our SOPs.",
    primaryLink: { label: "AI prompt starters", href: "/training/prompts" },
  },
  {
    tag: "PM TRACK",
    title: "Running a Project: PM / PE",
    description:
      "Everything the office side needs to run a job: reading drawings & specs, submittal review, RFIs, procurement, buyout, change orders, pay apps, scheduling, cost control, contracts, and closeout.",
    primaryLink: { label: "PM Handbook", href: "/training/guides/pm-handbook" },
  },
  {
    tag: "FIELD TRACK",
    title: "Running a Jobsite: Superintendent",
    description:
      "Everything the field side needs to run a site: logistics & planning, daily reports, look-aheads & pull planning, quality control, safety, layout, trade coordination, inspections, and field leadership.",
    primaryLink: {
      label: "Superintendent Handbook",
      href: "/training/guides/superintendent-handbook",
    },
  },
  {
    tag: "OUR SOFTWARE",
    title: "Alleato PM Software: How to Use It",
    description:
      "Learn the project management platform that replaced Job Planner, including its module map, standard how-to format, and a worked example.",
    primaryLink: {
      label: "Software Guide",
      href: "/training/guides/alleato-pm-software-guide",
    },
  },
  {
    tag: "AI · ALWAYS-ON",
    title: "Ask the Library",
    description:
      "Ask a construction or Alleato question and get an answer grounded in the approved training library, with the source material kept close.",
    primaryLink: {
      label: "Ask a question",
      href: "/training/ask",
    },
  },
];
