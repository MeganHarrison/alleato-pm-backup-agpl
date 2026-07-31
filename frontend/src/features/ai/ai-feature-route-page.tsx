import {
  getAiFeature,
  type AiFeatureDetail,
} from "@/features/ai/ai-feature-catalog";

function requireAiFeature(featureId: string): AiFeatureDetail {
  const feature = getAiFeature(featureId);

  if (!feature) {
    throw new Error(`AI feature route is missing catalog data: ${featureId}`);
  }

  return feature;
}

export function getAiFeatureRouteModel(featureId: string) {
  const feature = requireAiFeature(featureId);

  return {
    feature,
    metadata: {
      title: `${feature.name} | MKH AI`,
      description: feature.summary,
    },
    shellProps: {
      // The feature detail owns its full-bleed Storyline layout. Rendering the
      // shared page header here would repeat the global header breadcrumb.
      variant: "table" as const,
      title: feature.name,
      showHeader: false,
      contentClassName: "p-0",
      containerPaddingClassName: "p-0",
    },
  };
}
