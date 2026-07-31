import {
  getTrainingGuideBySlug,
  getTrainingGuideSummaries,
  TRAINING_GUIDE_SLUGS,
} from "../catalog";

describe("training guide catalog", () => {
  it("loads exactly the four registered guides with render-ready bodies", async () => {
    const guides = await getTrainingGuideSummaries();

    expect(guides.map((guide) => guide.slug)).toEqual(TRAINING_GUIDE_SLUGS);
    expect(TRAINING_GUIDE_SLUGS).toContain("manager-coaching-guide");

    for (const slug of TRAINING_GUIDE_SLUGS) {
      const guide = await getTrainingGuideBySlug(slug);
      expect(guide).not.toBeNull();
      expect(guide?.slug).toBe(slug);
      expect(guide?.title).toBeTruthy();
      expect(guide?.body).not.toMatch(/^\s*#\s+/);
      expect(guide?.body.length).toBeGreaterThan(500);
    }
  });

  it("returns null for an unregistered slug without touching the filesystem", async () => {
    await expect(
      getTrainingGuideBySlug("../../not-a-guide"),
    ).resolves.toBeNull();
  });
});
