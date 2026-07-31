import { createSign } from "node:crypto";

const GITHUB_API = "https://api.github.com";
const API_VERSION = "2022-11-28";

export interface GitHubTarget {
  readonly owner: string;
  readonly repo: string;
  readonly issueNumber: number;
  readonly installationId: number;
}

interface SessionAuthLike {
  readonly initiator: { readonly attributes: Readonly<Record<string, string | readonly string[]>> } | null;
  readonly current: { readonly attributes: Readonly<Record<string, string | readonly string[]>> } | null;
}

function readAttr(
  attributes: Readonly<Record<string, string | readonly string[]>> | undefined,
  key: string,
): string | undefined {
  const value = attributes?.[key];
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

export function githubTargetFromAuth(auth: SessionAuthLike): GitHubTarget {
  const attributes = (auth.initiator ?? auth.current)?.attributes;
  const repository = readAttr(attributes, "repository");
  const number = readAttr(attributes, "pull_request_number") || readAttr(attributes, "issue_number");
  const installationId = readAttr(attributes, "installation_id");

  if (!repository || !repository.includes("/")) {
    throw new Error("No GitHub repository on the session. This tool only runs on GitHub-triggered turns.");
  }
  if (!number) throw new Error("No pull request or issue number on the session.");
  if (!installationId) throw new Error("No GitHub installation id on the session.");

  const [owner, repo] = repository.split("/");
  return { owner, repo, issueNumber: Number(number), installationId: Number(installationId) };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Configure the GitHub App credentials.`);
  return value;
}

function normalizePrivateKey(key: string): string {
  return key.includes("\\n") ? key.replace(/\\n/g, "\n") : key;
}

function appJwt(): string {
  const appId = requireEnv("GITHUB_APP_ID");
  const privateKey = normalizePrivateKey(requireEnv("GITHUB_APP_PRIVATE_KEY"));
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ iat: now - 60, exp: now + 9 * 60, iss: appId }),
  ).toString("base64url");
  const signature = createSign("RSA-SHA256")
    .update(`${header}.${payload}`)
    .sign(privateKey)
    .toString("base64url");
  return `${header}.${payload}.${signature}`;
}

const tokenCache = new Map<number, { token: string; expiresAt: number }>();
const REFRESH_SAFETY_MS = 60_000;

async function installationToken(installationId: number): Promise<string> {
  const cached = tokenCache.get(installationId);
  if (cached && cached.expiresAt - REFRESH_SAFETY_MS > Date.now()) return cached.token;

  const res = await fetch(`${GITHUB_API}/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${appJwt()}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": API_VERSION,
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Failed to mint a GitHub installation token (${res.status} ${res.statusText})${detail ? `: ${detail}` : ""}`,
    );
  }
  const data = (await res.json()) as { token: string; expires_at: string };
  tokenCache.set(installationId, { token: data.token, expiresAt: Date.parse(data.expires_at) });
  return data.token;
}

export function redactToken(text: string, token: string): string {
  return token ? text.split(token).join("***") : text;
}

export async function githubRequest<T = unknown>(opts: {
  readonly method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  readonly path: string;
  readonly installationId: number;
  readonly body?: unknown;
}): Promise<T> {
  const token = await installationToken(opts.installationId);
  const res = await fetch(`${GITHUB_API}${opts.path}`, {
    method: opts.method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": API_VERSION,
      ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      redactToken(
        `GitHub ${opts.method} ${opts.path} failed (${res.status} ${res.statusText})${detail ? `: ${detail}` : ""}`,
        token,
      ),
    );
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
