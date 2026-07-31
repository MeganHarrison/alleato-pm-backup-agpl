import fs from "node:fs/promises";
import path from "node:path";

import type {
  AppPageScreenshotItem,
  AppPageScreenshotManifest,
} from "./types";

const MANIFEST_PATH = path.join(
  process.cwd(),
  "public/app-page-screenshots/manifest.json",
);

function statusLabel(status: string): string {
  if (status === "captured") return "Captured";
  if (status === "captured_http_404") return "404";
  if (status === "captured_access_denied") return "Access denied";
  if (status === "captured_login_redirect") return "Login redirect";
  if (status === "capture_error") return "Capture error";
  if (status === "skipped_dynamic_record") return "Needs record ID";
  if (status === "skipped_unknown_param") return "Needs sample param";
  if (status === "skipped_non_app_scope") return "Skipped scope";
  return status.replace(/_/g, " ");
}

export async function loadAppPageScreenshots(): Promise<{
  manifest: AppPageScreenshotManifest | null;
  items: AppPageScreenshotItem[];
  error: string | null;
}> {
  try {
    const raw = await fs.readFile(MANIFEST_PATH, "utf8");
    const manifest = JSON.parse(raw) as AppPageScreenshotManifest;
    const items = manifest.results.map((result, index) => ({
      ...result,
      id: `${result.route}:${index}`,
      imageUrl: result.screenshot
        ? `/app-page-screenshots/${result.screenshot}`
        : null,
      displayRoute: result.urlPath ?? result.route,
      statusLabel: statusLabel(result.status),
    }));

    return { manifest, items, error: null };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Screenshot manifest could not be loaded.";
    return { manifest: null, items: [], error: message };
  }
}
