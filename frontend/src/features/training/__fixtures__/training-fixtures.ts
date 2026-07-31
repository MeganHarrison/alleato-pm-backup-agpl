// Synthetic fixtures for component tests only. NOT the real Alleato Training
// Platform content — that source could not be located (see
// scripts/training/source/README.md and frontend/src/content/training-guides/README.md).

import type { TrainingGuide, TrainingResource, TrainingRoleOption, TrainingTopicOption } from "../types";

export const fixtureRoles: TrainingRoleOption[] = [
  { id: "pm", name: "Project Manager" },
  { id: "superintendent", name: "Superintendent" },
  { id: "estimator", name: "Estimator" },
];

export const fixtureTopics: TrainingTopicOption[] = [
  { id: "budgets", name: "Budgets" },
  { id: "field-operations", name: "Field Operations" },
];

export const fixtureTracks = ["financials", "field"];

export const fixtureResources: TrainingResource[] = [
  {
    id: "sov-basics",
    title: "Reading a Schedule of Values",
    description: "Intro walkthrough of SOV line items for new PMs.",
    url: "https://example.com/videos/sov-basics",
    provider: "Example Videos",
    topicId: "budgets",
    roleIds: ["pm"],
    type: "video",
    level: "intro",
    track: "financials",
    status: "published",
    createdAt: "2020-01-01T00:00:00.000Z",
    embed: { canEmbed: true, provider: "youtube", embedUrl: "https://www.youtube.com/embed/sov-basics" },
  },
  {
    id: "change-orders-deep-dive",
    title: "Change Order Fundamentals (Deep Dive)",
    description: "Advanced treatment of PCOs vs. official change orders.",
    url: "https://example.com/courses/change-orders-deep-dive",
    provider: "Example Learning Co.",
    topicId: "budgets",
    roleIds: ["pm", "superintendent"],
    type: "course",
    level: "deep-dive",
    track: "financials",
    status: "published",
    createdAt: "2020-01-01T00:00:00.000Z",
  },
  {
    id: "daily-logs-basics",
    title: "Superintendent Daily Log Basics",
    description: "Field-level intro to daily logs.",
    url: "https://example.com/docs/daily-logs-basics",
    provider: "Example Docs",
    topicId: "field-operations",
    roleIds: ["superintendent"],
    type: "doc",
    level: "intro",
    track: "field",
    status: "published",
    createdAt: "2020-01-01T00:00:00.000Z",
  },
  {
    id: "estimating-walkthrough-candidate",
    title: "Loom: Estimating Walkthrough (candidate)",
    description: "Freshly found by the resource finder; awaiting review.",
    url: "https://example.com/videos/estimating-walkthrough",
    provider: "Loom",
    topicId: "budgets",
    roleIds: ["estimator"],
    type: "video",
    level: "intro",
    track: "financials",
    status: "review",
    createdAt: "2020-01-01T00:00:00.000Z",
    embed: { canEmbed: true, provider: "loom", embedUrl: "https://www.loom.com/embed/estimating-walkthrough" },
  },
];

export const fixtureGuide: TrainingGuide = {
  slug: "pm-handbook",
  title: "PM Handbook",
  description: "How Alleato project managers run a job from kickoff to closeout.",
  roleIds: ["pm"],
};
