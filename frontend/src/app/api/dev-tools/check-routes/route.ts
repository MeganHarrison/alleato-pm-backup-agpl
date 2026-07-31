import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"
import path from "path"
import { logger } from "@/lib/logger";

const execAsync = promisify(exec)

export const GET = withApiGuardrails(
  "dev-tools/check-routes#GET",
  async () => {
  // Only allow in development
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { conflicts: "Only available in development" },
      { status: 403 }
    )
  }

  try {
    // Run the check-route-conflicts script if it exists
    const scriptPath = path.join(process.cwd(), "../scripts/check-route-conflicts.sh")

    try {
      const { stdout, stderr } = await execAsync(`bash ${scriptPath}`)
      return NextResponse.json({
        conflicts: stdout || stderr || "✅ No route conflicts found",
      })
    } catch (execError) {
      // Script doesn't exist, do a basic check
      const appDir = path.join(process.cwd(), "src/app")
      const { stdout } = await execAsync(
        `find ${appDir} -type d -name "[*]" | sed 's|.*/||' | sort | uniq -c | awk '$1 > 1 {print}'`
      )

      if (stdout.trim()) {
        return NextResponse.json({
          conflicts: `⚠️ Potential conflicts found:\n${stdout}\n\nRun: npm run check:routes`,
        })
      }

      return NextResponse.json({
        conflicts: "✅ No obvious route conflicts found",
      })
    }
  } catch (error) {
    logger.error({ msg: "Error checking routes:", error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json(
      {
        conflicts: error instanceof Error ? error.message : "Failed to check routes",
      },
      { status: 500 }
    )
  }
  },
);
