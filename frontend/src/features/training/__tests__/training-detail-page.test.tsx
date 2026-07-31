import {
  getTrainingPageShellProps,
  TRAINING_PAGE_SURFACE_CLASS,
} from "../TrainingDetailPage";

describe("getTrainingPageShellProps", () => {
  it("leaves shared navigation to the site header and uses a white surface", () => {
    const props = getTrainingPageShellProps({
      title: "Manager Coaching Guide",
      description: "A focused coaching guide.",
    });

    expect(props).not.toHaveProperty("breadcrumbs");
    expect(props).not.toHaveProperty("tabs");
    expect(props.className).toBe(TRAINING_PAGE_SURFACE_CLASS);
  });
});
