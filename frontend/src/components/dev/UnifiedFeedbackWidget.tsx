"use client";

/**
 * UnifiedFeedbackWidget — Renders the Agentation annotation toolbar for
 * local development. Annotations are stored client-side (localStorage) and
 * picked up by the agentation-watch MCP skill.
 *
 * IMPORTANT: This widget does NOT sync to the admin feedback backend or
 * create GitHub issues. That pipeline is reserved for the client-facing
 * feedback form on the production site.
 */

import { Agentation } from "agentation";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useIsMobile } from "@/hooks/use-mobile";

const MCP_ENDPOINT = "http://localhost:4747";
const TOOLBAR_SETTINGS_KEY = "feedback-toolbar-settings";
const BLOCK_INTERACTIONS_MIGRATION_KEY =
  "feedback-toolbar-settings:block-interactions-default-off";

export function UnifiedFeedbackWidget() {
  const [isReady, setIsReady] = useState(false);
  const pathname = usePathname()!;
  const isMobile = useIsMobile();
  const isImmersiveChatRoute =
    pathname === "/ai" ||
    pathname?.startsWith("/ai/") ||
    pathname?.startsWith("/ai-assistant") ||
    pathname?.startsWith("/ai-avatar");

  const webhookUrl = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return `${window.location.origin}/api/agentation`;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const hasMigrated =
        window.localStorage.getItem(BLOCK_INTERACTIONS_MIGRATION_KEY) === "1";

      if (!hasMigrated) {
        const savedRaw = window.localStorage.getItem(TOOLBAR_SETTINGS_KEY);
        const savedSettings = savedRaw ? JSON.parse(savedRaw) : {};

        window.localStorage.setItem(
          TOOLBAR_SETTINGS_KEY,
          JSON.stringify({
            ...savedSettings,
            blockInteractions: false,
          }),
        );
        window.localStorage.setItem(BLOCK_INTERACTIONS_MIGRATION_KEY, "1");
      }
    } catch (error) {
      console.warn("Failed to migrate Agentation toolbar settings; using defaults.", error);
    } finally {
      setIsReady(true);
    }
  }, []);

  if (!isReady || isMobile || isImmersiveChatRoute) return null;

  return <Agentation endpoint={MCP_ENDPOINT} webhookUrl={webhookUrl} />;
}
