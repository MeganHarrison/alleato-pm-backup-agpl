import {
  DocsTrainingProgressSchema,
  isAllowedDocsTrainingOrigin,
} from "@/lib/analytics/docs-training-contract";

const event = {
  schemaVersion: 1,
  event: "training.video.progress",
  sourceId: "prime-contracts/create-a-prime-contract",
  checkpoint: 25,
  positionSeconds: 45,
  watchedSeconds: 12,
} as const;

describe("docs training progress contract", () => {
  it("accepts the minimal versioned event and approved origins", () => {
    expect(DocsTrainingProgressSchema.parse(event)).toEqual(event);
    expect(isAllowedDocsTrainingOrigin("https://docs.alleatogroup.com")).toBe(true);
    expect(isAllowedDocsTrainingOrigin("https://alleato-docs-site.vercel.app")).toBe(false);
  });

  it("rejects PII-shaped extras, unsafe source paths, and unapproved origins", () => {
    expect(() =>
      DocsTrainingProgressSchema.parse({ ...event, email: "person@example.com" }),
    ).toThrow();
    expect(() =>
      DocsTrainingProgressSchema.parse({ ...event, sourceId: "../admin" }),
    ).toThrow();
    expect(isAllowedDocsTrainingOrigin("https://evil.example")).toBe(false);
    expect(isAllowedDocsTrainingOrigin(null)).toBe(false);
  });
});
