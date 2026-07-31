import { readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";

import { renderSimpleMarkdown } from "@/app/(admin)/feedback-inbox/_components/markdown";
import { PageShell } from "@/components/layout";

const REPO_ROOT = path.resolve(process.cwd());
const ALLOWED_PREFIXES = ["docs/", "frontend/", "backend/", "scripts/"];

function normalizeRelativePath(rawPath: string | undefined): string | null {
  if (!rawPath) return null;
  const trimmedPath = rawPath.trim();
  if (!trimmedPath) return null;
  if (!ALLOWED_PREFIXES.some((prefix) => trimmedPath.startsWith(prefix))) {
    return null;
  }

  const resolvedPath = path.resolve(REPO_ROOT, trimmedPath);
  const relativeResolvedPath = path.relative(REPO_ROOT, resolvedPath);

  if (
    !relativeResolvedPath ||
    relativeResolvedPath.startsWith("..") ||
    path.isAbsolute(relativeResolvedPath)
  ) {
    return null;
  }

  return relativeResolvedPath;
}

async function readCommandCenterFile(relativePath: string) {
  const absolutePath = path.resolve(REPO_ROOT, relativePath);
  return readFile(absolutePath, "utf8");
}

export default async function CommandCenterFilePage({
  searchParams,
}: {
  searchParams: Promise<{ path?: string }>;
}) {
  const params = await searchParams;
  const relativePath = normalizeRelativePath(params.path);

  if (!relativePath) {
    notFound();
  }

  let content: string;
  try {
    content = await readCommandCenterFile(relativePath);
  } catch {
    notFound();
  }

  const fileName = path.basename(relativePath);
  const isMarkdown = relativePath.endsWith(".md");

  return (
    <PageShell
      variant="content"
      title={fileName}
      description={relativePath}
      breadcrumbs={[
        { label: "Command Center", href: "/command-center" },
        { label: fileName },
      ]}
    >
      {isMarkdown ? (
        <div className="min-w-0">{renderSimpleMarkdown(content)}</div>
      ) : (
        <pre className="overflow-x-auto rounded-md bg-muted px-4 py-3 text-xs leading-relaxed text-foreground whitespace-pre-wrap">
          {content}
        </pre>
      )}
    </PageShell>
  );
}
