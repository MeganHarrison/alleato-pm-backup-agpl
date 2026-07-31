import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"
import { apiErrorResponse } from "@/lib/api-error";

const execAsync = promisify(exec)

export const POST = withApiGuardrails(
  "dev-tools/clear-cache#POST",
  async () => {
  // Only allow in development
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { success: false, message: "Only available in development" },
      { status: 403 }
    )
  }

  try {
    // Clear .next directory
    await execAsync("rm -rf .next")

    return NextResponse.json({
      success: true,
      message: "Cache cleared. Please refresh the page and wait for rebuild.",
    })
  } catch (error) {
    return apiErrorResponse(error)
  }
  },
);
