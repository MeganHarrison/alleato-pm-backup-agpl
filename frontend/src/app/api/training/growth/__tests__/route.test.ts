import { NextRequest } from "next/server";

import { createSkillGrowthDataAccess } from "@/features/training/skill-growth-server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

import { POST } from "../route";

jest.mock("@/features/training/skill-growth-server", () => ({
  createSkillGrowthDataAccess: jest.fn(),
}));

jest.mock("@/lib/auth/current-user", () => ({
  getCurrentUser: jest.fn(),
}));

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}));

const createAccessMock = jest.mocked(createSkillGrowthDataAccess);
const createClientMock = jest.mocked(createClient);
const getUserMock = jest.mocked(getCurrentUser);
const saveMock = jest.fn();
const skillId = "11111111-1111-4111-8111-111111111111";
const secondSkillId = "22222222-2222-4222-8222-222222222222";
const phases = [30, 60, 90].map((days) => ({
  days,
  action: `${days}-day action`,
  measure: `${days}-day measure`,
}));
const validPayload = {
  roleId: null,
  checkinDate: "2026-07-26",
  quarterLabel: "Q3 2026",
  feedbackPerson: "Jamie",
  feedbackFrequency: "Every other Friday",
  rescoreDays: 60,
  nextCheckinDate: "2026-09-24",
  makeTimeBy: "Delegate routine filing",
  focusSkillIds: [skillId, secondSkillId],
  scores: [
    { skillId, score: 50, target: 70 },
    { skillId: secondSkillId, score: 40, target: 80 },
  ],
  plans: [skillId, secondSkillId].map((currentSkillId) => ({
    skillId: currentSkillId,
    description: "Own the work.",
    evidence: {
      situation: "Weekly planning meeting.",
      behavior: "Prepared the constraint log.",
      outcome: "Owners closed constraints on time.",
    },
    frequency: "Weekly",
    resource: "Look-ahead SOP",
    feedback: "Jamie reviews it the next day",
    phases,
  })),
};

function request(body: unknown) {
  return new NextRequest("http://localhost/api/training/growth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function callPost(body: unknown) {
  return POST(request(body), { params: Promise.resolve({}) });
}

describe("POST /api/training/growth", () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";
  });

  beforeEach(() => {
    jest.clearAllMocks();
    getUserMock.mockResolvedValue({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      email: "learner@example.com",
    });
    createClientMock.mockResolvedValue({} as never);
    createAccessMock.mockReturnValue({
      load: jest.fn(),
      save: saveMock,
    });
  });

  it("saves a validated, authenticated check-in", async () => {
    saveMock.mockResolvedValue({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      roleId: null,
      roleName: "Alleato Core",
      checkinDate: "2026-07-26",
      scores: [],
      quarterLabel: "Q3 2026",
      feedbackPerson: "Jamie",
      feedbackFrequency: "Every other Friday",
      rescoreDays: 60,
      nextCheckinDate: "2026-09-24",
      makeTimeBy: "Delegate routine filing",
      plans: [],
      createdAt: "2026-07-26T12:00:00Z",
      updatedAt: "2026-07-26T12:00:00Z",
    });

    const response = await callPost(validPayload);

    expect(response.status).toBe(200);
    expect(saveMock).toHaveBeenCalledWith(validPayload);
  });

  it("rejects out-of-range scores before the data mutation", async () => {
    const response = await callPost({
      ...validPayload,
      scores: [
        {
          skillId,
          score: 101,
          target: 70,
        },
      ],
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(
      expect.objectContaining({ error_code: "INVALID_PAYLOAD" }),
    );
    expect(saveMock).not.toHaveBeenCalled();
  });

  it("returns a specific authentication recovery message", async () => {
    getUserMock.mockResolvedValue(null);

    const response = await callPost(validPayload);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error_code: "AUTH_EXPIRED",
        error_message: "Sign in again before saving your Skill Wheel check-in.",
      }),
    );
    expect(saveMock).not.toHaveBeenCalled();
  });
});
