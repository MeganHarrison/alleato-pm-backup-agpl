export type SubmittalDistributionEmailSettings = {
  email_notify_submittal_distributed?: boolean | null;
} | null;

export function shouldSendSubmittalDistributionEmail(
  settings: SubmittalDistributionEmailSettings,
) {
  return settings?.email_notify_submittal_distributed !== false;
}
