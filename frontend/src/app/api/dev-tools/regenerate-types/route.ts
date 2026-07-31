import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"
import path from "path"
import { apiErrorResponse } from "@/lib/api-error";

const execAsync = promisify(exec)

export const POST = withApiGuardrails(
  "dev-tools/regenerate-types#POST",
  async () => {
  // Only allow in development
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { success: false, message: "Only available in development" },
      { status: 403 }
    )
  }

  try {
    // Get project ID from env
    const projectId = process.env.NEXT_PUBLIC_SUPABASE_URL?.split(".")[0].replace("https://", "")

    if (!projectId) {
      return NextResponse.json(
        { success: false, message: "Supabase project ID not found in env" },
        { status: 400 }
      )
    }

    // Run types generation + Dev Tools FK sync
    const typesPath = path.join(process.cwd(), "src/types/database.types.ts")
    const fkSyncScript = path.join(process.cwd(), "..", "scripts", "dev-tools", "generate-page-schema-fk-map.mjs")
    const command = `npx supabase gen types typescript --project-id "${projectId}" --schema public > "${typesPath}" && node "${fkSyncScript}"`

    await execAsync(command)

    return NextResponse.json({
      success: true,
      message: "Types regenerated and Dev Tools schema FK targets synced successfully",
    })
  } catch (error) {
    return apiErrorResponse(error)
  }
  },
);
