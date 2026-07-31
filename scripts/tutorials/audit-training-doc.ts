import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { TRAINING_DOC_AUDIT_STATUSES } from "../../frontend/src/lib/training-docs/constants.ts";
import { resolveTutorialDocSlug } from "./slug-contract";

const require = createRequire(import.meta.url);

type AuditStatus = (typeof TRAINING_DOC_AUDIT_STATUSES)[number];

interface ManifestStep {
  expected?: string | null;
  instruction: string;
  screenshot: string;
  sourceUrl: string;
  title: string;
}

interface TutorialManifest {
  id: string;
  title: string;
  module: string;
  slug: string;
  description?: string;
  generatedAt: string;
  video?: {
    file?: string | null;
    mimeType?: string | null;
  } | null;
  steps: ManifestStep[];
}

interface ExistingTrainingDoc {
  id: string;
  slug: string;
  title: string;
  status: string;
  source_route: string | null;
  published_doc_path: string | null;
  last_published_at: string | null;
  updated_at: string;
  audit_status: string | null;
  qa_status: string | null;
  product_gap_issue_id: string | null;
  metadata: Record<string, unknown> | null;
}

interface AuditFinding {
  classification: Exclude<AuditStatus, "not_audited" | "aligned">;
  summary: string;
  evidence: string[];
  owner: string;
  nextAction: string;
  source?: string | null;
}

interface AuditArtifacts {
  manifestPath: string;
  outputDir: string;
  screenshots: string[];
  videoPath: string | null;
  localDocPath: string | null;
  documentationDraftPath: string | null;
  documentationInputPath: string | null;
  sourceBriefPath: string | null;
}

interface AuditResult {
  status: Exclude<AuditStatus, "not_audited">;
  findings: AuditFinding[];
  artifacts: AuditArtifacts;
  manifest: {
    id: string;
    slug: string;
    title: string;
    module: string;
    generatedAt: string;
    stepCount: number;
    sourceRoutes: string[];
  };
  existingDoc: ExistingTrainingDoc | null;
  query: string | null;
  productGapIssueId: string | null;
  generatedAt: string;
}

interface CliOptions {
  manifestPath: string;
  outputDir: string | null;
  findingsPath: string | null;
  query: string | null;
  skipDb: boolean;
  skipWriteback: boolean;
  productGapIssueId: string | null;
  createProductGapIssue: boolean;
  linearTeamId: string | null;
  linearProjectId: string | null;
}

const BLOCKED_ROUTE_PATTERNS = ["/auth/login", "/access-denied"];

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    manifestPath: "",
    outputDir: null,
    findingsPath: null,
    query: null,
    skipDb: false,
    skipWriteback: false,
    productGapIssueId: null,
    createProductGapIssue: false,
    linearTeamId: null,
    linearProjectId: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    if (arg === "--output-dir") {
      options.outputDir = requireValue(argv, ++index, arg);
    } else if (arg === "--findings") {
      options.findingsPath = requireValue(argv, ++index, arg);
    } else if (arg === "--query") {
      options.query = requireValue(argv, ++index, arg);
    } else if (arg === "--skip-db") {
      options.skipDb = true;
    } else if (arg === "--skip-writeback") {
      options.skipWriteback = true;
    } else if (arg === "--product-gap-issue-id") {
      options.productGapIssueId = requireValue(argv, ++index, arg);
    } else if (arg === "--create-product-gap-issue") {
      options.createProductGapIssue = true;
    } else if (arg === "--linear-team-id") {
      options.linearTeamId = requireValue(argv, ++index, arg);
    } else if (arg === "--linear-project-id") {
      options.linearProjectId = requireValue(argv, ++index, arg);
    } else if (!options.manifestPath) {
      options.manifestPath = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (!options.manifestPath) {
    throw new Error("Missing manifest path.");
  }

  return {
    ...options,
    manifestPath: path.resolve(options.manifestPath),
  };
}

function requireValue(argv: string[], index: number, flag: string) {
  const value = argv[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function printHelp() {
  console.log(`Usage: npx tsx scripts/tutorials/audit-training-doc.ts <manifest.json> [options]

Options:
  --output-dir <dir>    Override the artifact output directory. Default: manifest directory
  --findings <json>     Optional manual findings JSON for product gaps or blockers
  --query <text>        Reference query used for the workflow audit
  --skip-db             Skip Supabase training_docs lookup
  --skip-writeback      Do not persist the audit result back into training_docs
  --product-gap-issue-id <AAI-123>  Link an existing Linear issue for product-gap findings
  --create-product-gap-issue        Create a Linear issue for product-gap findings (requires valid Linear auth)
  --linear-team-id <uuid>           Linear team id used for auto-create
  --linear-project-id <uuid>        Optional Linear project id used for auto-create
`);
}

function normalizeRoutePath(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = value.startsWith("http")
      ? new URL(value)
      : new URL(value, "http://localhost");
    return parsed.pathname;
  } catch {
    return value.startsWith("/") ? value : `/${value}`;
  }
}

export function validateAuditCapture(
  manifest: TutorialManifest,
  outputDir: string,
): AuditArtifacts {
  if (!Array.isArray(manifest.steps) || manifest.steps.length === 0) {
    throw new Error("Audit capture is invalid: manifest has no recorded steps.");
  }

  const screenshots = manifest.steps.map((step, index) => {
    if (!step.screenshot?.trim()) {
      throw new Error(
        `Audit capture is invalid: step ${index + 1} is missing a screenshot path.`,
      );
    }
    const screenshotPath = path.resolve(outputDir, step.screenshot);
    if (!existsSync(screenshotPath)) {
      throw new Error(
        `Audit capture is invalid: screenshot is missing for step ${index + 1} at ${screenshotPath}.`,
      );
    }
    return screenshotPath;
  });

  for (const [index, step] of manifest.steps.entries()) {
    const normalizedRoute = normalizeRoutePath(step.sourceUrl);
    if (!normalizedRoute) {
      throw new Error(
        `Audit capture is invalid: step ${index + 1} is missing a source URL.`,
      );
    }
    for (const blockedRoute of BLOCKED_ROUTE_PATTERNS) {
      if (normalizedRoute.includes(blockedRoute)) {
        throw new Error(
          `Audit capture is invalid: step ${index + 1} captured a blocked route (${normalizedRoute}).`,
        );
      }
    }
  }

  const manifestVideoPath =
    manifest.video?.file && manifest.video.file.trim()
      ? path.resolve(outputDir, manifest.video.file)
      : null;
  const sessionVideoPath = path.resolve(outputDir, "session.webm");
  const firstAvailableVideo =
    (manifestVideoPath && existsSync(manifestVideoPath) && manifestVideoPath) ||
    (existsSync(sessionVideoPath) && sessionVideoPath) ||
    null;

  if (!firstAvailableVideo) {
    throw new Error(
      `Audit capture is invalid: no walkthrough video was found in ${outputDir}.`,
    );
  }

  const localDocPath = resolveOptionalFile(outputDir, `${manifest.slug}.md`);
  const documentationDraftPath = resolveOptionalFile(
    outputDir,
    "documentation-draft.md",
  );
  const documentationInputPath = resolveOptionalFile(
    outputDir,
    "documentation-input.json",
  );
  const sourceBriefPath = resolveOptionalFile(outputDir, "source-brief.md");

  return {
    manifestPath: path.resolve(outputDir, "manifest.json"),
    outputDir,
    screenshots,
    videoPath: firstAvailableVideo,
    localDocPath,
    documentationDraftPath,
    documentationInputPath,
    sourceBriefPath,
  };
}

function resolveOptionalFile(outputDir: string, fileName: string): string | null {
  const candidate = path.resolve(outputDir, fileName);
  return existsSync(candidate) ? candidate : null;
}

export function parseFindingsFile(raw: string): AuditFinding[] {
  const parsed = JSON.parse(raw) as unknown;
  const findingsInput = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "object" && parsed && "findings" in parsed
      ? (parsed as { findings?: unknown }).findings
      : null;

  if (!Array.isArray(findingsInput)) {
    throw new Error("Manual findings file must be an array or an object with a findings array.");
  }

  return findingsInput.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Manual findings entry ${index + 1} is not an object.`);
    }
    const finding = item as Partial<AuditFinding>;
    if (
      finding.classification !== "doc_stale" &&
      finding.classification !== "product_gap" &&
      finding.classification !== "capture_blocked"
    ) {
      throw new Error(
        `Manual findings entry ${index + 1} has an invalid classification.`,
      );
    }
    if (!finding.summary?.trim()) {
      throw new Error(`Manual findings entry ${index + 1} is missing a summary.`);
    }
    return {
      classification: finding.classification,
      summary: finding.summary.trim(),
      evidence: Array.isArray(finding.evidence)
        ? finding.evidence.map((value) => String(value))
        : [],
      owner: finding.owner?.trim() || "Unassigned",
      nextAction: finding.nextAction?.trim() || "Review and decide the next owner action.",
      source: finding.source?.trim() || null,
    };
  });
}

export function deriveAuditFindings(params: {
  manifest: TutorialManifest;
  artifacts: AuditArtifacts;
  existingDoc: ExistingTrainingDoc | null;
  query: string | null;
  manualFindings: AuditFinding[];
  productGapIssueId: string | null;
}): AuditResult {
  const {
    manifest,
    artifacts,
    existingDoc,
    manualFindings,
    productGapIssueId,
    query,
  } = params;
  const findings = [...manualFindings];

  if (!existingDoc) {
    findings.push({
      classification: "doc_stale",
      summary: "No training_docs row exists for this workflow slug yet.",
      evidence: [manifest.slug, artifacts.manifestPath],
      owner: "Docs pipeline",
      nextAction: "Run the create or publish flow for this workflow before closing the audit.",
      source: "training_docs",
    });
  } else {
    const manifestRoute = normalizeRoutePath(manifest.steps[0]?.sourceUrl ?? null);
    const docRoute = normalizeRoutePath(existingDoc.source_route);

    if (!existingDoc.published_doc_path) {
      findings.push({
        classification: "doc_stale",
        summary: "The existing training doc does not have a published docs path.",
        evidence: [existingDoc.id, existingDoc.slug],
        owner: "Docs pipeline",
        nextAction: "Republish the workflow so the docs site path is restored.",
        source: "training_docs",
      });
    }

    if (manifestRoute && docRoute && manifestRoute !== docRoute) {
      findings.push({
        classification: "doc_stale",
        summary: `The captured route (${manifestRoute}) does not match the stored source route (${docRoute}).`,
        evidence: [manifest.steps[0].sourceUrl, existingDoc.source_route ?? ""],
        owner: "Docs pipeline",
        nextAction: "Refresh the stored training doc metadata after verifying the intended route.",
        source: "route-compare",
      });
    }

    if (
      existingDoc.last_published_at &&
      Date.parse(existingDoc.last_published_at) < Date.parse(manifest.generatedAt)
    ) {
      findings.push({
        classification: "doc_stale",
        summary: "The stored published timestamp is older than the latest capture.",
        evidence: [existingDoc.last_published_at, manifest.generatedAt],
        owner: "Docs pipeline",
        nextAction: "Refresh and republish the training doc from the latest capture artifacts.",
        source: "publish-timestamp",
      });
    }
  }

  if (!artifacts.documentationInputPath && !query) {
    findings.push({
      classification: "doc_stale",
      summary: "No retrieval query or documentation input artifact was recorded for this audit.",
      evidence: [artifacts.outputDir],
      owner: "Docs pipeline",
      nextAction: "Rerun compose or pass --query so the source-brief context is traceable.",
      source: "artifact-contract",
    });
  }

  const status = selectAuditStatus(findings);
  return {
    status,
    findings,
    artifacts,
    manifest: {
      id: manifest.id,
      slug: manifest.slug,
      title: manifest.title,
      module: manifest.module,
      generatedAt: manifest.generatedAt,
      stepCount: manifest.steps.length,
      sourceRoutes: Array.from(
        new Set(
          manifest.steps
            .map((step) => normalizeRoutePath(step.sourceUrl))
            .filter((value): value is string => Boolean(value)),
        ),
      ),
    },
    existingDoc,
    query,
    productGapIssueId,
    generatedAt: new Date().toISOString(),
  };
}

export function selectAuditStatus(
  findings: AuditFinding[],
): Exclude<AuditStatus, "not_audited"> {
  if (findings.some((finding) => finding.classification === "capture_blocked")) {
    return "capture_blocked";
  }
  if (findings.some((finding) => finding.classification === "product_gap")) {
    return "product_gap";
  }
  if (findings.some((finding) => finding.classification === "doc_stale")) {
    return "doc_stale";
  }
  return "aligned";
}

export function renderAuditReport(result: AuditResult): string {
  const lines = [
    "# Audit Report",
    "",
    `- Status: ${result.status}`,
    `- Workflow: ${result.manifest.title}`,
    `- Slug: ${result.manifest.slug}`,
    `- Module: ${result.manifest.module}`,
    `- Capture generated at: ${result.manifest.generatedAt}`,
    `- Audit generated at: ${result.generatedAt}`,
    `- Query: ${result.query ?? "Not recorded"}`,
    "",
    "## Evidence",
    "",
    `- Manifest: ${result.artifacts.manifestPath}`,
    `- Video: ${result.artifacts.videoPath ?? "Missing"}`,
    `- Screenshots: ${result.artifacts.screenshots.length}`,
    `- Local doc: ${result.artifacts.localDocPath ?? "Missing"}`,
    `- Draft: ${result.artifacts.documentationDraftPath ?? "Missing"}`,
    `- Source brief: ${result.artifacts.sourceBriefPath ?? "Missing"}`,
    "",
    "## Existing Training Doc",
    "",
  ];

  if (result.existingDoc) {
    lines.push(`- Row ID: ${result.existingDoc.id}`);
    lines.push(`- Status: ${result.existingDoc.status}`);
    lines.push(`- Audit status: ${result.existingDoc.audit_status ?? "Not recorded"}`);
    lines.push(`- QA status: ${result.existingDoc.qa_status ?? "Not recorded"}`);
    lines.push(
      `- Published path: ${result.existingDoc.published_doc_path ?? "Missing"}`,
    );
    lines.push(
      `- Last published at: ${result.existingDoc.last_published_at ?? "Missing"}`,
    );
    lines.push(
      `- Source route: ${result.existingDoc.source_route ?? "Missing"}`,
    );
    lines.push(
      `- Product gap issue: ${result.productGapIssueId ?? result.existingDoc.product_gap_issue_id ?? "Not linked"}`,
    );
  } else {
    lines.push("- No existing `training_docs` row was found or DB lookup was skipped.");
  }

  lines.push("");
  lines.push("## Findings");
  lines.push("");

  if (result.findings.length === 0) {
    lines.push("- No findings. The capture and stored doc contract are aligned.");
  } else {
    for (const finding of result.findings) {
      lines.push(`### ${finding.classification}`);
      lines.push("");
      lines.push(finding.summary);
      lines.push("");
      lines.push(`- Owner: ${finding.owner}`);
      lines.push(`- Next action: ${finding.nextAction}`);
      if (finding.source) {
        lines.push(`- Source: ${finding.source}`);
      }
      if (finding.evidence.length > 0) {
        lines.push("- Evidence:");
        for (const evidence of finding.evidence) {
          lines.push(`  - ${evidence}`);
        }
      }
      lines.push("");
    }
  }

  return `${lines.join("\n").trim()}\n`;
}

async function readManifest(manifestPath: string): Promise<TutorialManifest> {
  return JSON.parse(await readFile(manifestPath, "utf8")) as TutorialManifest;
}

function loadEnv() {
  const dotenv = require("../../frontend/node_modules/dotenv");
  const repoRoot = path.resolve(import.meta.dirname, "../..");
  dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });
  dotenv.config({ path: path.join(repoRoot, ".env.local"), quiet: true });
  dotenv.config({ path: path.join(repoRoot, "frontend/.env.local"), quiet: true });
}

function getMetadataString(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function createServiceClient() {
  loadEnv();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return null;
  }

  const { createClient } = require("../../frontend/node_modules/@supabase/supabase-js");
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function lookupExistingTrainingDoc(
  service: ReturnType<typeof createServiceClient>,
  slug: string,
): Promise<ExistingTrainingDoc | null> {
  if (!service) return null;

  const { data, error } = await service
    .from("training_docs")
    .select(
      "id, slug, title, status, source_route, published_doc_path, last_published_at, updated_at, metadata",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read existing training doc for audit: ${error.message}`);
  }

  if (!data) return null;

  const row = data as Omit<
    ExistingTrainingDoc,
    "audit_status" | "qa_status" | "product_gap_issue_id"
  >;
  return {
    ...row,
    audit_status: getMetadataString(row.metadata, "lastParityStatus"),
    qa_status: getMetadataString(row.metadata, "qaStatus"),
    product_gap_issue_id: getMetadataString(row.metadata, "productGapIssueId"),
  };
}

export function mergeAuditMetadata(
  currentMetadata: Record<string, unknown> | null | undefined,
  result: AuditResult,
): Record<string, unknown> {
  const metadata = { ...(currentMetadata ?? {}) };
  metadata.lastAuditedAt = result.generatedAt;
  metadata.lastParityStatus = result.status;

  const auditNotes =
    result.findings.length > 0
      ? result.findings.map((finding) => finding.summary).join("\n")
      : null;
  if (auditNotes) {
    metadata.auditNotes = auditNotes;
  } else {
    delete metadata.auditNotes;
  }

  const primaryFinding = result.findings[0] ?? null;
  if (primaryFinding) {
    metadata.blockerType = primaryFinding.classification;
    metadata.blockerOwner = primaryFinding.owner;
  } else {
    delete metadata.blockerType;
    delete metadata.blockerOwner;
  }

  if (result.productGapIssueId) {
    metadata.productGapIssueId = result.productGapIssueId;
  } else if (result.status === "product_gap") {
    delete metadata.productGapIssueId;
  } else {
    delete metadata.productGapIssueId;
  }

  return metadata;
}

export async function createLinearIssueForProductGap(params: {
  manifest: AuditResult["manifest"];
  findings: AuditFinding[];
  linearTeamId: string;
  linearProjectId?: string | null;
}): Promise<string> {
  loadEnv();
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Linear issue creation was requested, but LINEAR_API_KEY is not configured.",
    );
  }

  const title = `Product gap: ${params.manifest.title}`;
  const descriptionLines = [
    `Audit status: product_gap`,
    `Workflow: ${params.manifest.title}`,
    `Slug: ${params.manifest.slug}`,
    `Module: ${params.manifest.module}`,
    "",
    "Findings:",
    ...params.findings.flatMap((finding) => [
      `- ${finding.summary}`,
      ...finding.evidence.map((evidence) => `  - ${evidence}`),
    ]),
  ];

  const response = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: apiKey,
    },
    body: JSON.stringify({
      query: `
        mutation CreateIssue($input: IssueCreateInput!) {
          issueCreate(input: $input) {
            success
            issue {
              identifier
            }
          }
        }
      `,
      variables: {
        input: {
          teamId: params.linearTeamId,
          projectId: params.linearProjectId ?? undefined,
          title,
          description: descriptionLines.join("\n"),
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Linear issue creation failed with HTTP ${response.status}. Check LINEAR_API_KEY and team/project ids.`,
    );
  }

  const payload = (await response.json()) as {
    errors?: Array<{ message?: string }>;
    data?: {
      issueCreate?: {
        success?: boolean;
        issue?: { identifier?: string | null } | null;
      } | null;
    };
  };

  if (payload.errors?.length) {
    const details = payload.errors
      .map((error) => error.message)
      .filter(Boolean)
      .join("; ");
    throw new Error(
      `Linear issue creation failed: ${details || "unknown GraphQL error"}.`,
    );
  }

  const identifier = payload.data?.issueCreate?.issue?.identifier?.trim();
  if (!payload.data?.issueCreate?.success || !identifier) {
    throw new Error(
      "Linear issue creation failed: the response did not include a created issue identifier.",
    );
  }

  return identifier;
}

async function writeAuditResultToTrainingDoc(
  service: NonNullable<ReturnType<typeof createServiceClient>>,
  existingDoc: ExistingTrainingDoc,
  result: AuditResult,
) {
  const { error } = await service
    .from("training_docs")
    .update({
      metadata: mergeAuditMetadata(existingDoc.metadata, result),
    })
    .eq("id", existingDoc.id);

  if (error) {
    throw new Error(`Failed to write audit result back to training_docs: ${error.message}`);
  }
}

async function writeAuditArtifacts(
  outputDir: string,
  result: AuditResult,
): Promise<{ reportPath: string; parityPath: string }> {
  await mkdir(outputDir, { recursive: true });
  const reportPath = path.join(outputDir, "audit-report.md");
  const parityPath = path.join(outputDir, "parity-gaps.json");
  await writeFile(reportPath, renderAuditReport(result), "utf8");
  await writeFile(parityPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return { reportPath, parityPath };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const manifest = await readManifest(options.manifestPath);
  const outputDir = options.outputDir
    ? path.resolve(options.outputDir)
    : path.dirname(options.manifestPath);
  const artifacts = validateAuditCapture(manifest, outputDir);
  const manualFindings = options.findingsPath
    ? parseFindingsFile(readFileSync(path.resolve(options.findingsPath), "utf8"))
    : [];
  const service = options.skipDb ? null : createServiceClient();
  const existingDoc = options.skipDb
    ? null
    : await lookupExistingTrainingDoc(service, resolveTutorialDocSlug(manifest.slug));

  let productGapIssueId = options.productGapIssueId?.trim() || null;
  if (
    manualFindings.some((finding) => finding.classification === "product_gap") &&
    options.createProductGapIssue
  ) {
    if (!options.linearTeamId) {
      throw new Error(
        "Linear issue creation was requested for a product gap, but --linear-team-id was not provided.",
      );
    }
    productGapIssueId = await createLinearIssueForProductGap({
      manifest: {
        id: manifest.id,
        slug: manifest.slug,
        title: manifest.title,
        module: manifest.module,
        generatedAt: manifest.generatedAt,
        stepCount: manifest.steps.length,
        sourceRoutes: [],
      },
      findings: manualFindings.filter(
        (finding) => finding.classification === "product_gap",
      ),
      linearTeamId: options.linearTeamId,
      linearProjectId: options.linearProjectId,
    });
  }

  const result = deriveAuditFindings({
    manifest,
    artifacts,
    existingDoc,
    query: options.query,
    manualFindings,
    productGapIssueId,
  });

  if (
    result.status === "product_gap" &&
    !result.productGapIssueId &&
    !options.skipWriteback
  ) {
    throw new Error(
      "Product-gap findings require --product-gap-issue-id or --create-product-gap-issue before writeback.",
    );
  }

  const paths = await writeAuditArtifacts(outputDir, result);
  if (!options.skipWriteback && existingDoc && service) {
    await writeAuditResultToTrainingDoc(service, existingDoc, result);
  }

  console.log(
    JSON.stringify(
      {
        status: result.status,
        findings: result.findings.length,
        productGapIssueId: result.productGapIssueId,
        wroteBack: Boolean(!options.skipWriteback && existingDoc && service),
        reportPath: paths.reportPath,
        parityPath: paths.parityPath,
      },
      null,
      2,
    ),
  );
}

const isMainModule =
  process.argv[1] != null &&
  path.resolve(process.argv[1]) === path.resolve(import.meta.filename);

if (isMainModule) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
