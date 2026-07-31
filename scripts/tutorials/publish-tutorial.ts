import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { createClient } = require("../../frontend/node_modules/@supabase/supabase-js");
const dotenv = require("../../frontend/node_modules/dotenv");

const repoRoot = path.resolve(import.meta.dirname, "../..");
dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });
dotenv.config({ path: path.join(repoRoot, ".env.local"), quiet: true });
dotenv.config({ path: path.join(repoRoot, "frontend/.env.local"), quiet: true });

interface ManifestStep {
  calloutSelector: string | null;
  expected: string | null;
  instruction: string;
  screenshot: string;
  screenshotMode: string;
  sourceUrl: string;
  title: string;
}

interface TutorialManifest {
  id: string;
  title: string;
  module: string;
  slug: string;
  description: string;
  generatedAt: string;
  video?: {
    file: string;
    mimeType: string;
  } | null;
  steps: ManifestStep[];
}

interface CliOptions {
  appToolCategory: string;
  manifestPath?: string;
  publishedDocPath?: string;
  sourceRoute: string | null;
  title?: string;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    appToolCategory: "Commitments",
    sourceRoute: "/1034/commitments/new",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    if (arg === "--app-tool-category") {
      options.appToolCategory = requireValue(argv, ++index, arg);
    } else if (arg === "--published-doc-path") {
      options.publishedDocPath = requireValue(argv, ++index, arg);
    } else if (arg === "--source-route") {
      options.sourceRoute = requireValue(argv, ++index, arg);
    } else if (arg === "--title") {
      options.title = requireValue(argv, ++index, arg);
    } else if (!options.manifestPath) {
      options.manifestPath = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (!options.manifestPath) {
    throw new Error("Missing manifest path.");
  }

  return options;
}

function requireValue(argv: string[], index: number, flag: string) {
  const value = argv[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function printHelp() {
  console.log(`Usage: npx tsx scripts/tutorials/publish-tutorial.ts <manifest.json> [options]

Options:
  --app-tool-category <name>    App training category. Default: Commitments
  --published-doc-path <path>   Non-null publish path used by /knowledge/app listing
  --source-route <route>        Source app route stored on the training doc
  --title <title>               Override manifest title
`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const manifestPath = path.resolve(options.manifestPath!);
  const outputDir = path.dirname(manifestPath);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as TutorialManifest;
  const generatedMarkdown = await readGeneratedMarkdown(outputDir, manifest.slug);
  const slug = manifest.slug === "create-commitment" ? "create-a-commitment" : manifest.slug;

  assertNoBadCapture(manifest);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing Supabase config. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const generatedAtSlug = manifest.generatedAt.replace(/[:.]/g, "-");
  const title = options.title ?? manifest.title;
  const publishedDocPath =
    options.publishedDocPath ?? `project-management-tools/training-docs/${slug}.mdx`;

  const { data: existingDoc, error: existingError } = await service
    .from("training_docs")
    .select("id, metadata")
    .eq("slug", slug)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to read existing training doc: ${existingError.message}`);
  }

  const metadata = {
    ...((existingDoc?.metadata && typeof existingDoc.metadata === "object") ? existingDoc.metadata : {}),
    appToolCategory: options.appToolCategory,
    appPublishedPath: `/knowledge/app/${options.appToolCategory.toLowerCase()}/${slug}`,
    tutorialId: manifest.id,
    tutorialModule: manifest.module,
    tutorialGeneratedAt: manifest.generatedAt,
    tutorialManifestPath: path.relative(repoRoot, manifestPath),
    generatedBy: "playwright-tutorial-recorder",
  };

  const docPayload = {
    title,
    slug,
    summary: manifest.description,
    body_markdown: stripGeneratedMarkdown(generatedMarkdown),
    audience: "internal",
    status: "published",
    source_route: options.sourceRoute,
    review_notes: null,
    target_collection: "project-management-tools/training-docs",
    published_doc_path: publishedDocPath,
    last_published_at: new Date().toISOString(),
    last_publish_error: null,
    metadata,
  };

  const { data: doc, error: docError } = await service
    .from("training_docs")
    .upsert(docPayload, { onConflict: "slug" })
    .select("id, slug, title, status, published_doc_path")
    .single();

  if (docError) {
    throw new Error(`Failed to upsert training doc: ${docError.message}`);
  }

  await replaceGeneratedRows(service, doc.id);

  const screenshotAssets = [];
  for (let index = 0; index < manifest.steps.length; index += 1) {
    const step = manifest.steps[index];
    const absoluteScreenshotPath = path.join(outputDir, step.screenshot);
    const fileName = path.basename(step.screenshot);
    const storagePath = `training-docs/${doc.id}/generated/${generatedAtSlug}/screenshots/${fileName}`;
    await uploadAsset(service, absoluteScreenshotPath, storagePath, "image/png");

    const { data: asset, error: assetError } = await service
      .from("training_doc_assets")
      .insert({
        training_doc_id: doc.id,
        storage_bucket: "documents",
        storage_path: storagePath,
        file_name: fileName,
        mime_type: "image/png",
        asset_type: "screenshot",
        caption: step.title,
        alt_text: `${title}: ${step.title}`,
        step_order: index + 1,
        metadata: {
          generatedBy: "playwright-tutorial-recorder",
          generatedAt: manifest.generatedAt,
          screenshotMode: step.screenshotMode,
        },
      })
      .select("id")
      .single();

    if (assetError) {
      throw new Error(`Failed to create screenshot asset: ${assetError.message}`);
    }
    screenshotAssets.push(asset);
  }

  if (manifest.video?.file) {
    const absoluteVideoPath = path.join(outputDir, manifest.video.file);
    const videoFileName = path.basename(manifest.video.file);
    const videoStoragePath = `training-docs/${doc.id}/generated/${generatedAtSlug}/video/${videoFileName}`;
    await uploadAsset(
      service,
      absoluteVideoPath,
      videoStoragePath,
      manifest.video.mimeType || "video/webm",
    );

    const { error: videoAssetError } = await service
      .from("training_doc_assets")
      .insert({
        training_doc_id: doc.id,
        storage_bucket: "documents",
        storage_path: videoStoragePath,
        file_name: videoFileName,
        mime_type: manifest.video.mimeType || "video/webm",
        asset_type: "video",
        caption: `${title} walkthrough video`,
        alt_text: `${title} walkthrough video`,
        step_order: 0,
        metadata: {
          generatedBy: "playwright-tutorial-recorder",
          generatedAt: manifest.generatedAt,
          kind: "walkthrough-video",
        },
      });

    if (videoAssetError) {
      throw new Error(`Failed to create walkthrough video asset: ${videoAssetError.message}`);
    }
  }

  await insertSteps(service, doc.id, manifest, screenshotAssets.map((asset) => asset.id));

  const { data: readBack, error: readBackError } = await service
    .from("training_docs")
    .select("id, slug, status, published_doc_path, metadata, training_doc_steps(id), training_doc_assets(id, asset_type)")
    .eq("id", doc.id)
    .single();

  if (readBackError) {
    throw new Error(`Failed to read back published tutorial: ${readBackError.message}`);
  }

  console.log(JSON.stringify({
    doc: {
      id: doc.id,
      slug: doc.slug,
      status: doc.status,
      publishedDocPath: doc.published_doc_path,
      appUrl: `/knowledge/app/${options.appToolCategory.toLowerCase()}/${slug}`,
    },
    stepCount: readBack.training_doc_steps.length,
    assetCounts: readBack.training_doc_assets.reduce((counts: Record<string, number>, asset: { asset_type: string }) => {
      counts[asset.asset_type] = (counts[asset.asset_type] ?? 0) + 1;
      return counts;
    }, {}),
  }, null, 2));
}

function assertNoBadCapture(manifest: TutorialManifest) {
  const badStep = manifest.steps.find((step) => {
    const url = new URL(step.sourceUrl);
    return url.pathname.startsWith("/auth/login") || url.pathname.startsWith("/access-denied");
  });

  if (badStep) {
    throw new Error(
      `Refusing to publish invalid tutorial capture. Step "${badStep.title}" source URL is ${badStep.sourceUrl}.`,
    );
  }
}

function stripGeneratedMarkdown(markdown: string) {
  if (!markdown.trim()) return "";
  return markdown
    .split("\n")
    .filter(
      (line) =>
        !line.startsWith("![") &&
        !line.startsWith("Callout selector:") &&
        !line.startsWith("Source screen:") &&
        !line.startsWith("[Watch the recorded workflow]") &&
        line.trim() !== "## Walkthrough Video",
    )
    .join("\n")
    .trim();
}

export async function readGeneratedMarkdown(outputDir: string, slug: string) {
  const documentationDraftPath = path.join(outputDir, "documentation-draft.md");
  const markdownPath = path.join(outputDir, `${slug}.md`);
  const documentationDraft = await readFile(documentationDraftPath, "utf8").catch(() => "");
  const generatedMarkdown = await readFile(markdownPath, "utf8").catch(() => "");
  return chooseGeneratedMarkdown(documentationDraft, generatedMarkdown);
}

export function chooseGeneratedMarkdown(
  documentationDraft: string,
  generatedMarkdown: string,
) {
  return documentationDraft || generatedMarkdown;
}

export function getUploadRetryContentType(contentType: string) {
  if (contentType === "video/webm") {
    return "application/octet-stream";
  }
  return null;
}

async function replaceGeneratedRows(service: ReturnType<typeof createClient>, docId: string) {
  const { error: stepsError } = await service
    .from("training_doc_steps")
    .delete()
    .eq("training_doc_id", docId);

  if (stepsError) {
    throw new Error(`Failed to clear existing generated steps: ${stepsError.message}`);
  }

  const { error: assetsError } = await service
    .from("training_doc_assets")
    .delete()
    .eq("training_doc_id", docId);

  if (assetsError) {
    throw new Error(`Failed to clear existing generated assets: ${assetsError.message}`);
  }
}

async function uploadAsset(
  service: ReturnType<typeof createClient>,
  filePath: string,
  storagePath: string,
  contentType: string,
) {
  const body = await readFile(filePath);
  let { error } = await service.storage
    .from("documents")
    .upload(storagePath, body, {
      contentType,
      upsert: true,
    });

  const retryContentType = getUploadRetryContentType(contentType);
  if (error && retryContentType) {
    const retry = await service.storage
      .from("documents")
      .upload(storagePath, body, {
        contentType: retryContentType,
        upsert: true,
      });
    error = retry.error;
  }

  if (error) {
    throw new Error(`Failed to upload ${path.basename(filePath)}: ${error.message}`);
  }
}

async function insertSteps(
  service: ReturnType<typeof createClient>,
  docId: string,
  manifest: TutorialManifest,
  screenshotAssetIds: string[],
) {
  const rows = manifest.steps.map((step, index) => ({
    training_doc_id: docId,
    screenshot_asset_id: screenshotAssetIds[index],
    step_order: index + 1,
    title: step.title,
    instruction_markdown: step.instruction,
    expected_result: step.expected,
    source_url: step.sourceUrl,
    action_metadata: {
      generatedBy: "playwright-tutorial-recorder",
      calloutSelector: step.calloutSelector,
      screenshotMode: step.screenshotMode,
      screenshot: step.screenshot,
    },
  }));

  const { error } = await service
    .from("training_doc_steps")
    .insert(rows);

  if (error) {
    throw new Error(`Failed to insert tutorial steps: ${error.message}`);
  }
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : null;

if (invokedPath === import.meta.url) {
  // Keep the CLI alive until the async Supabase writeback, asset uploads, and
  // read-back complete. A pending promise alone does not keep Node alive when
  // this script is run through tsx in CommonJS mode.
  const keepAlive = setInterval(() => undefined, 1 << 30);
  void main()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    })
    .finally(() => {
      clearInterval(keepAlive);
    });
}
