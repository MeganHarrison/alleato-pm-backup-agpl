"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const SESSION_KEY = "alleato.app-usage-session-id";

function entrySurface(pathname: string): "admin" | "main" | "training" | "other" {
  if (pathname.startsWith("/analytics") || pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/training")) return "training";
  if (pathname.startsWith("/")) return "main";
  return "other";
}

function sessionId() {
  const current = window.sessionStorage.getItem(SESSION_KEY);
  if (current) return current;
  const next = crypto.randomUUID();
  window.sessionStorage.setItem(SESSION_KEY, next);
  return next;
}

/**
 * Records only an authenticated session boundary and periodic liveness. It
 * intentionally excludes page paths, query strings, IP addresses, and user-agent
 * data so the engagement view answers use without becoming browsing surveillance.
 */
export function AppSessionTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const body = JSON.stringify({ id: sessionId(), entrySurface: entrySurface(pathname) });
    const record = () => {
      void fetch("/api/engagement/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        credentials: "same-origin",
        keepalive: true,
      });
    };

    record();
    const interval = window.setInterval(record, 60_000);
    const onVisibility = () => { if (document.visibilityState === "visible") record(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pathname]);

  return null;
}
