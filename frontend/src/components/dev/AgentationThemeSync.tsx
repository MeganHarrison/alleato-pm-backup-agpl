"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

const AGENTATION_THEME_KEY = "feedback-toolbar-theme";

export function AgentationThemeSync() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!resolvedTheme) {
      return;
    }

    const nextTheme = resolvedTheme === "dark" ? "dark" : "light";
    const currentTheme = window.localStorage.getItem(AGENTATION_THEME_KEY);

    if (currentTheme !== nextTheme) {
      window.localStorage.setItem(AGENTATION_THEME_KEY, nextTheme);
    }
  }, [resolvedTheme]);

  return null;
}
