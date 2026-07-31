"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { useDeferredMount } from "@/hooks/use-deferred-mount";
import {
  shouldForceCollaborationRuntime,
  shouldHideGlobalCollaborationLayerForRoute,
} from "@/lib/performance/runtime-gates";
import { useCollaborationRuntimeStore } from "@/lib/stores/collaboration-runtime-store";

const AskAlleatoRoot = dynamic(
  () => import("@/components/ask-alleato/AskAlleatoRoot").then((mod) => mod.AskAlleatoRoot),
  { ssr: false },
);
const GlobalAiWidget = dynamic(
  () => import("@/components/ai-assistant/global-ai-widget").then((mod) => mod.GlobalAiWidget),
  { ssr: false },
);
const AdminFeedbackWidget = dynamic(
  () => import("@/components/admin-feedback/AdminFeedbackWidget").then((mod) => mod.AdminFeedbackWidget),
  { ssr: false },
);
const VeltGlobalLayer = dynamic(
  () => import("@/components/velt/VeltGlobalLayer").then((m) => m.VeltGlobalLayer),
  { ssr: false },
);
const AgentationThemeSync = dynamic(
  () => import("@/components/dev/AgentationThemeSync").then((mod) => mod.AgentationThemeSync),
  { ssr: false },
);
const DevAnnotationOverlay = dynamic(
  () => import("@/components/dev/dev-annotation-overlay").then((mod) => mod.DevAnnotationOverlay),
  { ssr: false },
);
const DevAutoFillForms = dynamic(
  () => import("@/components/dev/DevAutoFillForms").then((mod) => mod.DevAutoFillForms),
  { ssr: false },
);
const UnifiedFeedbackWidget = dynamic(
  () => import("@/components/dev/UnifiedFeedbackWidget").then((mod) => mod.UnifiedFeedbackWidget),
  { ssr: false },
);
const DesignViolationOverlay = dynamic(
  () => import("@/components/dev/design-violation-overlay").then((mod) => mod.DesignViolationOverlay),
  { ssr: false },
);
const AppErrorTelemetryProvider = dynamic(
  () => import("@/components/providers/app-error-telemetry-provider").then((mod) => mod.AppErrorTelemetryProvider),
  { ssr: false },
);

const ENABLE_DEV_BRIDGE = process.env.NEXT_PUBLIC_ENABLE_DEV_BRIDGE === "true";

export function RootClientWidgets() {
  const pathname = usePathname();
  const shouldMountDeferredWidgets = useDeferredMount(6_000);
  const userEnabledCollaboration = useCollaborationRuntimeStore(
    (state) => state.enabled,
  );
  const shouldMountCollaborationWidgets =
    !shouldHideGlobalCollaborationLayerForRoute(pathname) &&
    (userEnabledCollaboration ||
      (shouldMountDeferredWidgets && shouldForceCollaborationRuntime(pathname)));

  return (
    <Suspense fallback={null}>
      <AppErrorTelemetryProvider />
      {shouldMountDeferredWidgets && <AskAlleatoRoot />}
      {shouldMountDeferredWidgets && <GlobalAiWidget />}
      {shouldMountDeferredWidgets && <AdminFeedbackWidget />}
      {shouldMountCollaborationWidgets && <VeltGlobalLayer />}
      {shouldMountDeferredWidgets && process.env.NODE_ENV === "development" && (
        <>
          <AgentationThemeSync />
          {ENABLE_DEV_BRIDGE && <DevAnnotationOverlay />}
          <DevAutoFillForms />
          <UnifiedFeedbackWidget />
          <DesignViolationOverlay />
        </>
      )}
    </Suspense>
  );
}
