import { TavusAvatarPage } from "@/components/ai-assistant/tavus-avatar-page";
import { PageShell } from "@/components/layout/page-shell";

export const metadata = {
  title: "AI Avatar | Alleato",
  description: "Live Tavus avatar experience for Alleato onboarding and demos",
};

export default function AIAvatarRoute() {
  return (
    <PageShell
      variant="detailWide"
      title="AI Avatar"
      description="A separate live Tavus avatar experience for onboarding and internal experiments."
    >
      <TavusAvatarPage />
    </PageShell>
  );
}
