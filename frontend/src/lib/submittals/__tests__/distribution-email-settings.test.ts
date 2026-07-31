import { shouldSendSubmittalDistributionEmail } from "../distribution-email-settings";

describe("submittal distribution email settings", () => {
  it("sends distribution email when settings are missing", () => {
    expect(shouldSendSubmittalDistributionEmail(null)).toBe(true);
  });

  it("sends distribution email when the setting is enabled", () => {
    expect(
      shouldSendSubmittalDistributionEmail({
        email_notify_submittal_distributed: true,
      }),
    ).toBe(true);
  });

  it("skips distribution email when the setting is disabled", () => {
    expect(
      shouldSendSubmittalDistributionEmail({
        email_notify_submittal_distributed: false,
      }),
    ).toBe(false);
  });
});
