import "server-only";

import { createClient } from "@supabase/supabase-js";

type AsrsRequestOptions = {
  body?: unknown;
  method?: "GET" | "POST";
};

function getAsrsCredentials(owner: string): { secretKey: string; url: string } {
  const url = process.env.SUPABASE_ASRS_URL;
  const secretKey =
    process.env.SUPABASE_ASRS_SECRET_KEY ??
    process.env.SUPABASE_ASRS_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error(
      `${owner} is unavailable: SUPABASE_ASRS_URL is not configured for the dedicated ASRS project.`,
    );
  }
  if (!secretKey) {
    throw new Error(
      `${owner} is unavailable: SUPABASE_ASRS_SECRET_KEY is not configured for server-side access.`,
    );
  }

  return { secretKey, url };
}

async function readErrorMessage(response: Response): Promise<string | null> {
  const body = await response.json().catch(() => null);
  if (
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof body.message === "string"
  ) {
    return body.message;
  }
  return null;
}

export async function requestAsrsJson(
  path: string,
  owner: string,
  options: AsrsRequestOptions = {},
): Promise<unknown> {
  const { secretKey, url } = getAsrsCredentials(owner);
  const method = options.method ?? "GET";
  const response = await fetch(new URL(`/rest/v1/${path}`, url), {
    method,
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
    },
    body:
      method === "POST" && options.body !== undefined
        ? JSON.stringify(options.body)
        : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await readErrorMessage(response);
    throw new Error(
      `${owner} is unavailable: ASRS query failed (${response.status})${detail ? `: ${detail}` : "."}`,
    );
  }

  return response.json();
}

export async function createAsrsSignedStorageUrl(
  storagePath: string,
  owner: string,
  expiresInSeconds = 60 * 60,
): Promise<string> {
  const { secretKey, url } = getAsrsCredentials(owner);
  const supabase = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase.storage
    .from("fmds-source-evidence")
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(
      `${owner} is unavailable: unable to sign its ASRS source evidence${error?.message ? ` (${error.message})` : "."}`,
    );
  }

  return data.signedUrl;
}
