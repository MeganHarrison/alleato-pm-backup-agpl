import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { getApiRouteUser } from "@/lib/supabase/server";

/**
 * Allowed directory prefixes relative to the project root.
 * Only files within these directories can be read.
 * OWASP A01:2021 - Broken Access Control / OWASP A03:2021 - Injection (path traversal)
 */
const ALLOWED_DIRECTORIES = [
  "docs",
  "frontend/src",
  "frontend/public",
];

export const GET = withApiGuardrails(
  "files/read#GET",
  async ({ request }) => {
  
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "files/read#GET", message: "Authentication required." });
    }

    const searchParams = request.nextUrl.searchParams;
    const filePath = searchParams.get('path');

    if (!filePath) {
      return NextResponse.json(
        { error: 'Path parameter is required' },
        { status: 400 }
      );
    }

    // Get the project root (remove frontend from cwd)
    const projectRoot = process.cwd().replace('/frontend', '');

    // Use path.resolve to canonicalize and prevent traversal (e.g. ../../etc/passwd)
    const fullPath = path.resolve(projectRoot, filePath);

    // Verify the resolved path is within the project root
    if (!fullPath.startsWith(projectRoot + path.sep) && fullPath !== projectRoot) {
      return NextResponse.json(
        { error: 'Access denied: path is outside the project directory' },
        { status: 403 }
      );
    }

    // Verify the resolved path is within one of the allowed directories
    const relativePath = path.relative(projectRoot, fullPath);
    const isInAllowedDir = ALLOWED_DIRECTORIES.some(
      (dir) => relativePath === dir || relativePath.startsWith(dir + path.sep)
    );

    if (!isInAllowedDir) {
      return NextResponse.json(
        { error: `Access denied: only files within ${ALLOWED_DIRECTORIES.join(", ")} are accessible` },
        { status: 403 }
      );
    }

    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Ensure it is a file, not a directory or symlink target outside allowed paths
    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) {
      return NextResponse.json(
        { error: 'Path is not a file' },
        { status: 400 }
      );
    }

    // Read the file
    const content = fs.readFileSync(fullPath, 'utf-8');

    // Return as plain text for markdown files
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
    },
);
