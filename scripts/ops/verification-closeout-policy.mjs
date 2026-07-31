const IMPLEMENTATION_PREFIX = /^(frontend|backend|supabase|scripts|agents|\.github)\//;
const IMPLEMENTATION_ROOT_FILES = new Set([
  "package.json",
  "pnpm-lock.yaml",
  "render.yaml",
  "vercel.json",
  "tsconfig.json",
]);

export function isImplementationFile(file) {
  return IMPLEMENTATION_PREFIX.test(file) || IMPLEMENTATION_ROOT_FILES.has(file);
}

export function implementationFilesWithoutTask(stagedFiles, taskFiles) {
  if (taskFiles.length > 0) return [];
  return stagedFiles.filter((file) => isImplementationFile(file));
}

export function taskFilesFromStagedFiles(stagedFiles) {
  return stagedFiles.filter((file) =>
    /^docs\/ops\/tasks\/[^/]+\.md$/.test(file) && file !== "docs/ops/tasks/TASK-TEMPLATE.md",
  );
}
