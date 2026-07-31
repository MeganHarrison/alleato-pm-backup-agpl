import { PageShell } from "@/components/layout";
import { AiFeatureDetailPage } from "@/features/ai/ai-feature-detail-page";
import { getAiFeatureRouteModel } from "@/features/ai/ai-feature-route-page";

const FEATURE_ID = "memory-center";
const route = getAiFeatureRouteModel(FEATURE_ID);

export const metadata = route.metadata;

export default function MemoryCenterFeaturePage() {
  return (
    <PageShell {...route.shellProps}>
      <AiFeatureDetailPage feature={route.feature} />
    </PageShell>
  );
}
