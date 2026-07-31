import { parseTrainingAdminPayload } from "../schemas";

const topicId = "10000000-0000-4000-8000-000000000001";
const roleId = "10000000-0000-4000-8000-000000000002";
const docId = "10000000-0000-4000-8000-000000000003";

describe("training admin payload schemas", () => {
  it("accepts a complete free training resource", () => {
    expect(
      parseTrainingAdminPayload(
        "training_resource",
        {
          topic_id: topicId,
          title: "Concrete placement basics",
          description: null,
          url: "https://example.com/concrete",
          embed_url: null,
          thumbnail_url: null,
          provider: "Example",
          resource_type: "video",
          level: "intro",
          track: "field",
          status: "review",
          duration_minutes: 20,
          source_attribution: null,
          metadata: {},
        },
        "create",
      ),
    ).toMatchObject({
      topic_id: topicId,
      title: "Concrete placement basics",
      status: "review",
    });
  });

  it("rejects non-http resource URLs", () => {
    expect(() =>
      parseTrainingAdminPayload(
        "training_resource",
        {
          topic_id: topicId,
          title: "Unsafe URL",
          description: null,
          url: "javascript:alert(1)",
          embed_url: null,
          thumbnail_url: null,
          provider: null,
          resource_type: "doc",
          level: "intro",
          track: "pm",
          status: "review",
          duration_minutes: null,
          source_attribution: null,
          metadata: {},
        },
        "create",
      ),
    ).toThrow(/url/i);
  });

  it("enforces the role versus Alleato Core skill boundary", () => {
    expect(() =>
      parseTrainingAdminPayload(
        "training_role_skill",
        {
          role_id: roleId,
          is_core: true,
          name: "Communication",
          slug: "communication",
          description: "Communicates clearly.",
          importance: 3,
          sort_order: 0,
          active: true,
        },
        "create",
      ),
    ).toThrow(/cannot belong to a role/i);
  });

  it("prevents self-referential training doc relations", () => {
    expect(() =>
      parseTrainingAdminPayload(
        "training_doc_relations",
        {
          source_doc_id: docId,
          target_doc_id: docId,
          relation_type: "related",
          sort_order: 0,
        },
        "create",
      ),
    ).toThrow(/cannot relate to itself/i);
  });
});
