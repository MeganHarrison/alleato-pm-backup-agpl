#!/usr/bin/env node

import process from "node:process";
import { auditRenderRagCrons } from "../ops/reconcile-render-rag-crons.mjs";

const group =
  process.argv.find((arg) => arg.startsWith("--group="))?.split("=")[1] ??
  "all";

try {
  const report = await auditRenderRagCrons({
    token: process.env.RENDER_API_KEY?.trim(),
    group,
  });
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    console.error(
      "Render RAG cron health failed: one or more canonical source, health, or intelligence owners are missing, suspended, stale, or configuration-drifted.",
    );
    process.exitCode = 1;
  }
} catch (error) {
  console.error(`Render RAG cron health failed: ${error.message}`);
  process.exitCode = 1;
}

