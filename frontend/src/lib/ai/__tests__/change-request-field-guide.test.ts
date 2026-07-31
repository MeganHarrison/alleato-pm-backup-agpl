import {
  buildChangeRequestReviewCard,
  CHANGE_REQUEST_FIELD_GUIDE,
  renderChangeRequestFieldGuide,
  renderChangeRequestToolDescription,
} from "../change-request-field-guide";

describe("change request field guide", () => {
  it("documents required, recommended, optional, generated, and confirmation fields", () => {
    expect(CHANGE_REQUEST_FIELD_GUIDE.canonicalTool).toBe("createChangeEvent");
    expect(CHANGE_REQUEST_FIELD_GUIDE.aliases).toContain("change request");
    expect(CHANGE_REQUEST_FIELD_GUIDE.requiredFields.map((field) => field.name)).toEqual([
      "projectId",
      "title",
    ]);
    expect(CHANGE_REQUEST_FIELD_GUIDE.recommendedFields.map((field) => field.name)).toEqual([
      "description",
      "type",
      "scope",
      "expectingRevenue",
    ]);
    // Every recommended field must carry a non-empty reason the agent can use to make the case.
    for (const field of CHANGE_REQUEST_FIELD_GUIDE.recommendedFields) {
      expect(field.whyItMatters.trim().length).toBeGreaterThan(0);
    }
    expect(CHANGE_REQUEST_FIELD_GUIDE.optionalFields.map((field) => field.name)).toEqual([
      "status",
      "reason",
      "origin",
      "originId",
      "lineItemRevenueSource",
      "primeContractId",
    ]);
    expect(CHANGE_REQUEST_FIELD_GUIDE.unsupportedFormSections.map((field) => field.name)).toEqual([
      "lineItems",
    ]);
    expect(CHANGE_REQUEST_FIELD_GUIDE.followUpSections.map((field) => field.name)).toEqual([
      "attachments",
    ]);
    expect(CHANGE_REQUEST_FIELD_GUIDE.generatedFields.map((field) => field.name)).toEqual([
      "number",
      "updated_at",
    ]);
    expect(CHANGE_REQUEST_FIELD_GUIDE.previewRule).toContain(
      "confirmed=false first",
    );
  });

  it("renders prompt and tool-description guidance from the same source", () => {
    const fieldGuide = renderChangeRequestFieldGuide();
    expect(fieldGuide).toContain("Canonical tool: `createChangeEvent`");
    expect(fieldGuide).toContain("projectId (Project): Numeric Alleato project id");
    // The recommended tier and its rationale must surface in the rendered guide.
    expect(fieldGuide).toContain("Recommended");
    expect(fieldGuide).toContain(
      CHANGE_REQUEST_FIELD_GUIDE.recommendedFields[0].whyItMatters,
    );

    const toolDescription = renderChangeRequestToolDescription();
    expect(toolDescription).toContain("change request");
    expect(toolDescription).toContain("projectId and title");
    expect(toolDescription).toContain("primeContractId");
    expect(toolDescription).toContain("expectingRevenue");
    expect(toolDescription).toContain("line items");
    // Card enforcement + active pursuit of recommended fields are the core of the fix.
    expect(toolDescription).toContain("confirmed=false first");
    expect(toolDescription).toContain("form card");
    expect(toolDescription).toContain("Recommended");
    expect(toolDescription).toContain("attachments");
  });

  it("builds structured review-card metadata from preview fields", () => {
    const reviewCard = buildChangeRequestReviewCard({
      project_id: 43,
      title: "Owner-requested lobby finish change",
      description: "Owner asked to upgrade the lobby finish package.",
      type: "Owner Change",
      scope: "TBD",
      status: "Open",
      reason: "Back Charge",
      origin: "Internal",
      origin_id: "5b769b58-6f0a-4c1f-bf51-63010c88ad5a",
      expecting_revenue: true,
      prime_contract_id: "614ccdf0-25c6-4f85-a4cc-0ce94d6f36cf",
    });

    expect(reviewCard.title).toBe("Change event draft");
    expect(reviewCard.subtitle).toBe("Review the fields before Alleato creates the record.");
    expect(reviewCard.recordType).toBe("change_event");
    expect(reviewCard.groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "General information",
          fields: expect.arrayContaining([
            expect.objectContaining({
              key: "project_id",
              label: "Project",
              value: "43",
              required: true,
            }),
            expect.objectContaining({
              key: "number",
              label: "Number",
              value: "Generated after confirmation",
              generated: true,
            }),
            expect.objectContaining({
              key: "title",
              label: "Title",
              value: "Owner-requested lobby finish change",
              required: true,
            }),
            expect.objectContaining({
              key: "description",
              label: "Description",
              value: "Owner asked to upgrade the lobby finish package.",
            }),
          ]),
        }),
        expect.objectContaining({
          title: "Source and contract",
          fields: expect.arrayContaining([
            expect.objectContaining({
              key: "origin",
              label: "Origin",
              value: "Internal",
            }),
            expect.objectContaining({
              key: "origin_id",
              label: "Origin record",
              value: "5b769b58-6f0a-4c1f-bf51-63010c88ad5a",
            }),
            expect.objectContaining({
              key: "prime_contract_id",
              label: "Prime contract",
              value: "614ccdf0-25c6-4f85-a4cc-0ce94d6f36cf",
            }),
          ]),
        }),
        expect.objectContaining({
          title: "Revenue settings",
          fields: expect.arrayContaining([
            expect.objectContaining({
              key: "expecting_revenue",
              label: "Expecting revenue",
              value: "Yes",
            }),
          ]),
        }),
        expect.objectContaining({
          title: "Line items",
          fields: [
            expect.objectContaining({
              key: "line_items",
              value: "Not supported by chat create yet",
            }),
          ],
        }),
        expect.objectContaining({
          title: "Generated by Alleato",
          fields: expect.arrayContaining([
            expect.objectContaining({
              key: "updated_at",
              label: "Updated at",
              value: "Set at write time",
              generated: true,
            }),
          ]),
        }),
      ]),
    );
    expect(reviewCard.groups).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Attachments",
        }),
      ]),
    );
    expect(reviewCard.notices).toEqual([]);
  });
});
