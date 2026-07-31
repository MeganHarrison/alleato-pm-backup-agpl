import { PageShell } from "@/components/layout";
import { AiFeatureDetailPage } from "@/features/ai/ai-feature-detail-page";
import { getAiFeatureRouteModel } from "@/features/ai/ai-feature-route-page";

const FEATURE_ID = "approvals";
const route = getAiFeatureRouteModel(FEATURE_ID);

export const metadata = route.metadata;

export default function ApprovalsFeaturePage() {
  return (
    <PageShell {...route.shellProps}>
      <AiFeatureDetailPage feature={route.feature} />
    </PageShell>
  );
}
