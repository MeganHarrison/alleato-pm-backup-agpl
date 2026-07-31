import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";

export const GET = withApiGuardrails<{ feature: string; filename: string }>(
  "/api/procore-screenshots/[feature]/[filename]#GET",
  async ({ params }) => {
    const { feature, filename } = await params;

    // Sanitize — only allow alphanumeric, hyphens, underscores, dots
    if (!/^[\w.-]+$/.test(feature) || !/^[\w.-]+$/.test(filename)) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "/api/procore-screenshots/[feature]/[filename]#GET",
        message: "Invalid path.",
        status: 400,
        severity: "low",
      });
    }

  const screenshotPath = path.join(
    process.cwd(),
    "..",
    ".claude",
    "procore-manifests",
    feature,
    "screenshots",
    filename,
  );

    try {
      const buffer = await readFile(screenshotPath);
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=3600",
        },
      });
    } catch (error: unknown) {
      throw new GuardrailError({
        code: "ROUTE_BINDING_MISSING",
        where: "/api/procore-screenshots/[feature]/[filename]#GET",
        message: "Screenshot not found.",
        status: 404,
        severity: "low",
        details: error instanceof Error ? { reason: error.message } : undefined,
      });
    }
  },
);
