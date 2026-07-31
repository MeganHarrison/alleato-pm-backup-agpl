"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

interface HealthStatus {
  status: "healthy" | "error" | "loading";
  backend: boolean;
  openai_configured: boolean;
  timestamp: string;
  error?: string;
}

export function BackendStatusIndicator() {
  const [health, setHealth] = useState<HealthStatus>({
    status: "loading",
    backend: false,
    openai_configured: false,
    timestamp: new Date().toISOString(),
  });

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const data = await apiFetch<HealthStatus>("/api/health", {
          cache: "no-store",
        });

        if (data) {
          setHealth(data);
        }
      } catch (error) {
        setHealth({
          status: "error",
          backend: false,
          openai_configured: false,
          timestamp: new Date().toISOString(),
          error:
            error instanceof Error
              ? error.message
              : "Failed to check backend status",
        });
      }
    };

    // Initial check
    checkHealth();

    // Poll every 30 seconds
    const interval = setInterval(checkHealth, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-4 mb-4">
      <div className="flex items-center gap-1.5">
        <span
          className={`h-2 w-2 rounded-full ${
            health.status === "loading"
              ? "bg-muted-foreground animate-pulse"
              : health.backend
                ? "bg-green-500"
                : "bg-destructive"
          }`}
        />
        <span className="text-xs text-muted-foreground">
          {health.status === "loading"
            ? "Connecting..."
            : health.backend
              ? "Backend online"
              : "Backend offline"}
        </span>
      </div>
      {health.status !== "loading" && health.backend && (
        <div className="flex items-center gap-1.5">
          <span
            className={`h-2 w-2 rounded-full ${health.openai_configured ? "bg-green-500" : "bg-amber-400"}`}
          />
          <span className="text-xs text-muted-foreground">
            {health.openai_configured ? "AI configured" : "AI not configured"}
          </span>
        </div>
      )}
      {health.error && (
        <span className="text-xs text-destructive ml-auto">{health.error}</span>
      )}
    </div>
  );
}
