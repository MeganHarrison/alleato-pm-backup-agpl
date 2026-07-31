"use client";

import { useEffect } from "react";
import { installGlobalErrorReporter } from "@/lib/app-error-reporter";

export function AppErrorTelemetryProvider() {
  useEffect(() => installGlobalErrorReporter(), []);
  return null;
}
