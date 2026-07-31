/** @jest-environment jsdom */

import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Link from "next/link";
import { toast } from "sonner";

import { SkillGrowthClient } from "../SkillGrowthClient";
import type { SkillCheckin, SkillGrowthData } from "../skill-growth";

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.setTimeout(10_000);

const initialData: SkillGrowthData = {
  roles: [
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      contextKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      slug: "project-manager",
      name: "Project Manager",
      description: "Own the project.",
      skills: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Communication",
          description: "Create shared understanding.",
          importance: 4,
          isCore: true,
          sortOrder: 10,
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          name: "Scheduling",
          description: "Own the master schedule.",
          importance: 5,
          isCore: false,
          sortOrder: 10,
        },
      ],
    },
  ],
  checkins: [],
  historyTruncated: false,
};

function phases() {
  return [30, 60, 90].map((days) => ({
    days: days as 30 | 60 | 90,
    action: `${days}-day action`,
    measure: `${days}-day measure`,
  }));
}

const savedCheckin: SkillCheckin = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  roleId: initialData.roles[0].id,
  roleName: "Project Manager",
  checkinDate: "2026-07-26",
  scores: initialData.roles[0].skills.map((skill, index) => ({
    skillId: skill.id,
    name: skill.name,
    score: 30 + index * 10,
    target: 70 + index * 10,
    importance: skill.importance,
    isCore: skill.isCore,
  })),
  quarterLabel: "Q3 2026",
  feedbackPerson: "Jamie",
  feedbackFrequency: "Every other Friday",
  rescoreDays: 60,
  nextCheckinDate: "2026-09-24",
  makeTimeBy: "Delegate routine filing",
  plans: initialData.roles[0].skills.map((skill, index) => ({
    skillId: skill.id,
    description: skill.description,
    evidence: {
      situation: "Weekly planning meeting",
      behavior: "Prepared the constraint log",
      outcome: "Owners closed constraints before the next meeting",
    },
    frequency: "Weekly",
    resource: "Look-ahead SOP",
    feedback: "Jamie reviews it the next day",
    phases: phases(),
    isFocus: true,
    sortOrder: index,
  })),
  createdAt: "2026-07-26T12:00:00Z",
  updatedAt: "2026-07-26T12:00:00Z",
};

function fillAssessment() {
  fireEvent.change(
    screen.getByRole("spinbutton", { name: "Communication current score" }),
    { target: { value: "30" } },
  );
  fireEvent.change(
    screen.getByRole("spinbutton", { name: "Communication target score" }),
    { target: { value: "70" } },
  );
  fireEvent.change(
    screen.getByRole("spinbutton", { name: "Scheduling current score" }),
    { target: { value: "40" } },
  );
  fireEvent.change(
    screen.getByRole("spinbutton", { name: "Scheduling target score" }),
    { target: { value: "80" } },
  );

  for (const skill of ["Communication", "Scheduling"]) {
    fireEvent.change(
      screen.getByRole("textbox", { name: `${skill} evidence situation` }),
      { target: { value: "Weekly planning meeting" } },
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: `${skill} evidence behavior` }),
      { target: { value: "Prepared the constraint log" } },
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: `${skill} evidence outcome` }),
      { target: { value: "Owners closed constraints on time" } },
    );
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: `Select ${skill} as a focus skill`,
      }),
    );
  }

  screen.getAllByLabelText("Practice frequency").forEach((input) => {
    fireEvent.change(input, { target: { value: "Weekly" } });
  });
  screen.getAllByLabelText("Resource or support").forEach((input) => {
    fireEvent.change(input, { target: { value: "Look-ahead SOP" } });
  });
  screen.getAllByLabelText("Feedback path").forEach((input) => {
    fireEvent.change(input, {
      target: { value: "Jamie reviews it the next day" },
    });
  });
  for (const days of [30, 60, 90]) {
    screen.getAllByLabelText(`${days}-day action`).forEach((input) => {
      fireEvent.change(input, { target: { value: `${days}-day action` } });
    });
    screen.getAllByLabelText(`${days}-day measure`).forEach((input) => {
      fireEvent.change(input, { target: { value: `${days}-day measure` } });
    });
  }
}

describe("SkillGrowthClient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("starts unanchored, identifies core skills, and exposes the rubric", () => {
    render(<SkillGrowthClient initialData={initialData} today="2026-07-26" />);

    expect(
      screen.getByRole("spinbutton", { name: "Communication current score" }),
    ).toHaveValue(null);
    expect(screen.getByText("1. Communication (Core)")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Scoring rubric"));
    expect(screen.getByText(/60–70 handles normal work/)).toBeInTheDocument();
    expect(screen.queryByTestId("skill-wheel")).not.toBeInTheDocument();
  });

  it("rehydrates saved evidence so an existing check-in remains updateable", () => {
    render(
      <SkillGrowthClient
        initialData={{ ...initialData, checkins: [savedCheckin] }}
        today="2026-07-26"
      />,
    );

    expect(
      screen.getByRole("textbox", {
        name: "Communication evidence situation",
      }),
    ).toHaveValue("Weekly planning meeting");
    expect(
      screen.getByRole("textbox", {
        name: "Communication evidence behavior",
      }),
    ).toHaveValue("Prepared the constraint log");
    expect(
      screen.getByRole("textbox", {
        name: "Communication evidence outcome",
      }),
    ).toHaveValue("Owners closed constraints before the next meeting");

    fireEvent.change(
      screen.getByRole("spinbutton", {
        name: "Communication current score",
      }),
      { target: { value: "35" } },
    );

    expect(
      screen.getByRole("button", { name: "Update check-in" }),
    ).toBeEnabled();
  });

  it("starts on the role resolved from the employee profile", () => {
    const coreRole = {
      ...initialData.roles[0],
      id: null,
      contextKey: "alleato-core",
      slug: "alleato-core",
      name: "Alleato Core",
    };
    render(
      <SkillGrowthClient
        initialData={{
          roles: [coreRole, ...initialData.roles],
          checkins: [],
          historyTruncated: false,
        }}
        today="2026-07-26"
        suggestedRoleSlug="project-manager"
      />,
    );

    expect(screen.getByRole("combobox", { name: "Skill library" })).toHaveValue(
      initialData.roles[0].contextKey,
    );
  });

  it("requires an explicit decision before a role switch discards a draft", async () => {
    const otherRole = {
      ...initialData.roles[0],
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      contextKey: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      slug: "estimator",
      name: "Estimator",
    };
    render(
      <SkillGrowthClient
        initialData={{
          roles: [...initialData.roles, otherRole],
          checkins: [],
          historyTruncated: false,
        }}
        today="2026-07-26"
      />,
    );

    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Scheduling current score" }),
      { target: { value: "35" } },
    );
    const library = screen.getByRole("combobox", { name: "Skill library" });
    fireEvent.change(library, { target: { value: otherRole.contextKey } });
    expect(
      await screen.findByText("Discard unsaved assessment changes?"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Discard and switch" }));
    await waitFor(() => expect(library).toHaveValue(otherRole.contextKey));
  });

  it("protects a draft from ordinary in-app navigation", async () => {
    render(
      <>
        <Link href="/training">Training home</Link>
        <SkillGrowthClient initialData={initialData} today="2026-07-26" />
      </>,
    );
    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Scheduling current score" }),
      { target: { value: "35" } },
    );
    fireEvent.click(screen.getByRole("link", { name: "Training home" }));
    expect(
      await screen.findByText("Discard unsaved assessment changes?"),
    ).toBeInTheDocument();
  });

  it("requires an explicit 2–4 selection and complete phased plans", () => {
    render(<SkillGrowthClient initialData={initialData} today="2026-07-26" />);
    fillAssessment();

    expect(screen.getByTestId("skill-wheel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save check-in" })).toBeEnabled();
    expect(screen.getAllByLabelText("90-day measure")).toHaveLength(2);
  });

  it("preserves a selected focus plan when its score is refined", () => {
    render(<SkillGrowthClient initialData={initialData} today="2026-07-26" />);
    fillAssessment();

    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Communication current score" }),
      { target: { value: "31" } },
    );

    expect(
      screen.getByRole("checkbox", {
        name: "Select Communication as a focus skill",
      }),
    ).toBeChecked();
    expect(screen.getAllByLabelText("30-day action")[0]).toHaveValue(
      "30-day action",
    );
    expect(screen.getByRole("button", { name: "Save check-in" })).toBeEnabled();
  });

  it("persists the selected skills, structured evidence, and all phases", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ checkin: savedCheckin }),
    });
    global.fetch = fetchMock as typeof fetch;
    render(<SkillGrowthClient initialData={initialData} today="2026-07-26" />);
    fillAssessment();
    fireEvent.click(screen.getByRole("button", { name: "Save check-in" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(request.focusSkillIds).toEqual([
      initialData.roles[0].skills[0].id,
      initialData.roles[0].skills[1].id,
    ]);
    expect(request.plans[0]).toEqual(
      expect.objectContaining({
        evidence: {
          situation: "Weekly planning meeting",
          behavior: "Prepared the constraint log",
          outcome: "Owners closed constraints on time",
        },
        phases: expect.arrayContaining([
          { days: 30, action: "30-day action", measure: "30-day measure" },
          { days: 90, action: "90-day action", measure: "90-day measure" },
        ]),
      }),
    );
    expect(toast.success).toHaveBeenCalledWith("Skill Wheel check-in saved.");
  });

  it("shows structured evidence and phase detail in saved history", () => {
    render(
      <SkillGrowthClient
        initialData={{ ...initialData, checkins: [savedCheckin] }}
        today="2026-07-27"
      />,
    );
    fireEvent.click(
      screen.getByText(/Jul 26, 2026/, {
        selector: "span",
      }),
    );

    expect(
      screen.getAllByText(/Prepared the constraint log/).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/90-day action/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Re-scoring every 60 days/)).toBeInTheDocument();
  });
});
