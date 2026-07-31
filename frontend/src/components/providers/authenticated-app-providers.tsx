"use client";

import { Suspense, type ReactNode } from "react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import { RootClientWidgets } from "@/app/root-client-widgets";
import { AppSessionTracker } from "@/components/analytics/app-session-tracker";
import { HeaderProvider } from "@/components/layout/header-context";
import { PostHogProvider } from "@/components/providers/posthog-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { VeltAuthProvider } from "@/components/velt/VeltAuthProvider";
import { FavoritesProvider } from "@/contexts/favorites-context";
import { ProjectProvider } from "@/contexts/project-context";

/**
 * Shared client infrastructure for authenticated application routes.
 *
 * Keep this composition out of app/layout.tsx: anything imported by the root
 * layout becomes part of the compile graph for public and authentication
 * routes. Authenticated route layouts should reuse this boundary instead of
 * reproducing the provider tree.
 */
export function AuthenticatedAppProviders({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <NuqsAdapter>
      <QueryProvider>
        <Suspense fallback={null}>
          <PostHogProvider>
            <ProjectProvider>
              <FavoritesProvider>
                <HeaderProvider>
                  <VeltAuthProvider>
                    <AppSessionTracker />
                    {children}
                    <RootClientWidgets />
                  </VeltAuthProvider>
                </HeaderProvider>
              </FavoritesProvider>
            </ProjectProvider>
          </PostHogProvider>
        </Suspense>
        <SpeedInsights />
      </QueryProvider>
    </NuqsAdapter>
  );
}
