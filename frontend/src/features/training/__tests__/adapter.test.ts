import type {
  TrainingResource as TrainingResourceDomain,
  TrainingRole,
  TrainingTopic,
} from "@/lib/training/types";

import {
  buildTrainingLibraryPageModel,
  toTrainingResourceViewModel,
} from "../adapter";

const roles: TrainingRole[] = [
  {
    id: "role-pm",
    slug: "project-manager",
    name: "Project Manager",
    description: null,
    aliases: ["PM"],
    sortOrder: 10,
  },
  {
    id: "role-super",
    slug: "superintendent",
    name: "Superintendent",
    description: null,
    aliases: [],
    sortOrder: 20,
  },
];

const topics: TrainingTopic[] = [
  {
    id: "topic-budget",
    slug: "budget",
    name: "Budget",
    description: null,
    sortOrder: 10,
  },
];

function resource(
  overrides: Partial<TrainingResourceDomain> = {},
): TrainingResourceDomain {
  return {
    id: "resource-1",
    topicId: "topic-budget",
    topicSlug: "budget",
    topicName: "Budget",
    title: "Budget basics",
    description: null,
    url: "https://youtu.be/abc_123",
    embedUrl: null,
    thumbnailUrl: null,
    provider: null,
    type: "video",
    level: "intro",
    track: "financial",
    status: "published",
    durationMinutes: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    roles: [roles[0]],
    ...overrides,
  };
}

describe("training presentation adapter", () => {
  it("maps the canonical domain and derives a trusted player URL", () => {
    expect(toTrainingResourceViewModel(resource())).toMatchObject({
      id: "resource-1",
      description: null,
      provider: null,
      topicId: "topic-budget",
      roleIds: ["role-pm"],
      embed: {
        canEmbed: true,
        provider: "youtube",
        embedUrl: "https://www.youtube-nocookie.com/embed/abc_123",
      },
    });
  });

  it("keeps an untrusted video link link-only", () => {
    expect(
      toTrainingResourceViewModel(
        resource({
          url: "https://untrusted.example/video",
          embedUrl: "https://untrusted.example/embed/video",
        }),
      ).embed,
    ).toBeUndefined();
  });

  it("falls back to the canonical video URL when the stored embed URL is invalid", () => {
    expect(
      toTrainingResourceViewModel(
        resource({
          embedUrl: "https://untrusted.example/embed/abc_123",
        }),
      ).embed,
    ).toEqual({
      canEmbed: true,
      provider: "youtube",
      embedUrl: "https://www.youtube-nocookie.com/embed/abc_123",
    });
  });

  it("defaults to the unique role matching the viewer job title", () => {
    const model = buildTrainingLibraryPageModel({
      resources: [
        resource({ track: "field" }),
        resource({ id: "resource-2", track: "financial" }),
      ],
      roles,
      topics,
      viewerTitle: "PM",
    });

    expect(model.initialRoleId).toBe("role-pm");
    expect(model.tracks).toEqual(["field", "financial"]);
  });

  it("leaves the role unselected when the title is missing or unmatched", () => {
    expect(
      buildTrainingLibraryPageModel({
        resources: [],
        roles,
        topics,
        viewerTitle: "Operations",
      }).initialRoleId,
    ).toBeNull();
  });
});
