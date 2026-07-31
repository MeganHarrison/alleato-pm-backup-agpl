"use client";

import { createClient } from "@/lib/supabase/client";

async function getDownloadAccessToken(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }

  const expiresSoon =
    !session?.access_token ||
    (typeof session.expires_at === "number" &&
      session.expires_at * 1000 <= Date.now() + 30_000);

  if (!expiresSoon) {
    return session.access_token;
  }

  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) {
    throw refreshError;
  }

  return refreshed.session?.access_token ?? null;
}

export async function triggerBrowserDownload(
  url: string,
  filename?: string,
  expectedContentTypePrefix?: string,
) {
  const accessToken = await getDownloadAccessToken();
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: accessToken
      ? {
          Authorization: `Bearer ${accessToken}`,
        }
      : undefined,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `Download failed (${response.status})`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (expectedContentTypePrefix && !contentType.startsWith(expectedContentTypePrefix)) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `Unexpected download type: ${contentType || "unknown"}`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.rel = "noopener";

  if (filename && filename.trim().length > 0) {
    link.download = filename;
  } else {
    link.setAttribute("download", "");
  }

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}
