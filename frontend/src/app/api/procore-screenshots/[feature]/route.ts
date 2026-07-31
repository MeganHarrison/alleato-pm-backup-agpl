import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";

/** Returns the list of available screenshot state IDs for a feature. */
export const GET = withApiGuardrails<{ feature: string }>(
  "/api/procore-screenshots/[feature]#GET",
  async ({ params }) => {
    const { feature } = await params;

    if (!/^[\w-]+$/.test(feature)) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "/api/procore-screenshots/[feature]#GET",
        message: "Invalid feature.",
        status: 400,
        severity: "low",
      });
    }

  const manifestPath = path.join(
    process.cwd(),
    "..",
    ".claude",
    "procore-manifests",
    feature,
    "manifest.json",
  );

    try {
      const raw = await readFile(manifestPath, "utf-8");
      const manifest = JSON.parse(raw) as {
        states?: Record<string, { screenshot?: string }>;
      };
      const stateIds = Object.keys(manifest.states ?? {});
      return NextResponse.json({ feature, stateIds });
    } catch (error: unknown) {
      throw new GuardrailError({
        code: "ROUTE_BINDING_MISSING",
        where: "/api/procore-screenshots/[feature]#GET",
        message: "Manifest not found.",
        status: 404,
        severity: "low",
        details: error instanceof Error ? { reason: error.message } : undefined,
      });
    }
  },
);
