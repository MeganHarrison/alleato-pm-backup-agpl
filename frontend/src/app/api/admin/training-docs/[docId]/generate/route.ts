export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { chromium } from "playwright";
import type { Page } from "playwright";
import { z } from "zod";

import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import {
  slugifyTrainingDoc,
  TRAINING_DOC_STORAGE_BUCKET,
} from "@/lib/training-docs/constants";
import { getTrainingDoc } from "@/lib/training-docs/server";

import { requireTrainingDocsAdmin } from "../../_shared";

const WHERE_POST = "admin/training-docs/[docId]/generate#POST";
const GENERATOR_NAME = "ai_training_doc_generator";

const generateTrainingDocSchema = z.object({
  route: z.string().min(1).optional(),
});

type CapturedStep = {
  title: string;
  instructionMarkdown: string;
  expectedResult: string;
  sourceUrl: string;
  screenshot: Buffer;
  metadata: Record<string, unknown>;
};

export const POST = withApiGuardrails(
  WHERE_POST,
  async ({ request, params }) => {
    const { userId, service } = await requireTrainingDocsAdmin(WHERE_POST);
    const body = await parseJsonBody(
      request,
      generateTrainingDocSchema,
      WHERE_POST,
    );
    const docId = params.docId;
    const doc = await getTrainingDoc(service, docId);

    if (!doc) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: WHERE_POST,
        message: "Training doc not found.",
        status: 404,
      });
    }

    const targetRoute = normalizeTargetRoute(body.route ?? doc.source_route);
    const origin = new URL(request.url).origin;
    const cookieHeader = request.headers.get("cookie");
    if (!cookieHeader) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: WHERE_POST,
        message:
          "A signed-in browser session is required before AI can capture training screenshots.",
        status: 401,
      });
    }

    let capturedSteps: CapturedStep[];
    try {
      capturedSteps = await captureTrainingSteps({
        origin,
        targetRoute,
        cookieHeader,
        fallbackTitle: doc.title,
      });
    } catch (error) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: WHERE_POST,
        message: "AI browser capture failed.",
        status: 500,
        details: error instanceof Error ? error.message : String(error),
      });
    }

    const uploadedAssetIds: string[] = [];
    const uploadedStoragePaths: Array<{ bucket: string; path: string }> = [];
    try {
      const previousGenerated = await readGeneratedStepCleanupTargets({
        service,
        docId,
      });

      const assetIdsByStep = new Map<number, string>();
      for (const [index, step] of capturedSteps.entries()) {
        const fileName = `step-${index + 1}.png`;
        const storagePath = `training-docs/${docId}/generated/${Date.now()}-${fileName}`;
        const { error: uploadError } = await service.storage
          .from(TRAINING_DOC_STORAGE_BUCKET)
          .upload(storagePath, step.screenshot, {
            contentType: "image/png",
            upsert: false,
          });

        if (uploadError) {
          throw new Error(
            `Failed to upload ${fileName}: ${uploadError.message}`,
          );
        }
        uploadedStoragePaths.push({
          bucket: TRAINING_DOC_STORAGE_BUCKET,
          path: storagePath,
        });

        const { data: asset, error: assetError } = await service
          .from("training_doc_assets")
          .insert({
            training_doc_id: docId,
            created_by: userId,
            storage_bucket: TRAINING_DOC_STORAGE_BUCKET,
            storage_path: storagePath,
            file_name: fileName,
            mime_type: "image/png",
            caption: step.title,
            alt_text: step.title,
            step_order: index,
            metadata: {
              generated_by: GENERATOR_NAME,
              source_url: step.sourceUrl,
              captured_at: new Date().toISOString(),
            },
          })
          .select("id")
          .single();

        if (assetError || !asset) {
          throw new Error(
            `Failed to save screenshot metadata for ${fileName}: ${assetError?.message ?? "missing asset id"}`,
          );
        }

        uploadedAssetIds.push(asset.id);
        assetIdsByStep.set(index, asset.id);
      }

      const { error: stepsError } = await service
        .from("training_doc_steps")
        .insert(
          capturedSteps.map((step, index) => ({
            training_doc_id: docId,
            screenshot_asset_id: assetIdsByStep.get(index) ?? null,
            created_by: userId,
            step_order: index,
            title: step.title,
            instruction_markdown: step.instructionMarkdown,
            expected_result: step.expectedResult,
            source_url: step.sourceUrl,
            action_metadata: {
              ...step.metadata,
              generated_by: GENERATOR_NAME,
              target_route: targetRoute,
            },
          })),
        );

      if (stepsError) {
        throw new Error(
          `Failed to save generated steps: ${stepsError.message}`,
        );
      }

      await deleteGeneratedStepTargets({
        service,
        targets: previousGenerated,
      });

      const { error: updateError } = await service
        .from("training_docs")
        .update({
          status: "in_review",
          source_route: targetRoute,
          review_notes: `AI generated ${capturedSteps.length} screenshot-backed steps from ${targetRoute} on ${new Date().toISOString()}.`,
          updated_by: userId,
        })
        .eq("id", docId);

      if (updateError) {
        throw new Error(
          `Generated steps were saved, but the training doc status could not be updated: ${updateError.message}`,
        );
      }
    } catch (error) {
      if (uploadedAssetIds.length > 0) {
        await service
          .from("training_doc_assets")
          .delete()
          .in("id", uploadedAssetIds);
      }
      for (const uploaded of uploadedStoragePaths) {
        await service.storage.from(uploaded.bucket).remove([uploaded.path]);
      }
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: WHERE_POST,
        message: "Failed to save AI-generated training steps.",
        status: 500,
        details: error instanceof Error ? error.message : String(error),
      });
    }

    const updated = await getTrainingDoc(service, docId);
    return NextResponse.json({
      doc: updated,
      generated: {
        route: targetRoute,
        stepCount: capturedSteps.length,
      },
    });
  },
);

function normalizeTargetRoute(route: string | null | undefined): string {
  const trimmed = route?.trim();
  if (!trimmed) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: WHERE_POST,
      message: "Add a source route before generating training steps.",
      status: 400,
    });
  }

  if (/^https?:\/\//i.test(trimmed)) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: WHERE_POST,
      message: "Training generation only supports in-app relative routes.",
      status: 400,
    });
  }

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

async function captureTrainingSteps({
  origin,
  targetRoute,
  cookieHeader,
  fallbackTitle,
}: {
  origin: string;
  targetRoute: string;
  cookieHeader: string;
  fallbackTitle: string;
}): Promise<CapturedStep[]> {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      extraHTTPHeaders: { cookie: cookieHeader },
    });
    const page = await context.newPage();
    const targetUrl = new URL(targetRoute, origin).toString();
    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await installTrainingCaptureOverlayHider(page);
    await page
      .waitForLoadState("networkidle", { timeout: 10_000 })
      .catch(() => undefined);
    await page
      .waitForFunction(
        () => {
          const clean = (value: string | null | undefined) =>
            (value ?? "").replace(/\s+/g, " ").trim();
          const title = clean(document.querySelector("h1")?.textContent);
          const labelCount = document.querySelectorAll("label").length;
          const inputCount = document.querySelectorAll(
            "input, textarea, [role='combobox']",
          ).length;

          return Boolean(title) && (labelCount > 0 || inputCount > 0);
        },
        null,
        { timeout: 15_000 },
      )
      .catch(() => undefined);

    if (new URL(page.url()).pathname.startsWith("/auth/login")) {
      throw new Error(
        "The AI browser was redirected to login. Start generation from a signed-in admin session.",
      );
    }

    const pageContext = await page.evaluate(() => {
      const clean = (value: string | null | undefined) =>
        (value ?? "").replace(/\s+/g, " ").trim();
      const labels = Array.from(document.querySelectorAll("label"))
        .map((label) => clean(label.textContent))
        .filter(Boolean)
        .slice(0, 24);
      const buttons = Array.from(document.querySelectorAll("button"))
        .map((button) => clean(button.textContent))
        .filter(Boolean)
        .slice(0, 12);
      const headings = Array.from(document.querySelectorAll("h1, h2, h3"))
        .map((heading) => clean(heading.textContent))
        .filter(Boolean)
        .slice(0, 12);

      return {
        title:
          clean(document.querySelector("h1")?.textContent) ||
          fallbackTitle ||
          clean(document.title) ||
          "Workflow",
        labels,
        buttons,
        headings,
        scrollHeight: document.documentElement.scrollHeight,
      };
    });

    const capturePlans = buildCapturePlans(pageContext, page.url());
    const steps: CapturedStep[] = [];
    const maxScroll = Math.max(0, pageContext.scrollHeight - 1000);

    for (const [index, plan] of capturePlans.entries()) {
      const scrollY =
        capturePlans.length === 1
          ? 0
          : Math.round((maxScroll * index) / (capturePlans.length - 1));
      await page.evaluate((y) => window.scrollTo(0, y), scrollY);
      await page.waitForTimeout(350);
      await hideTrainingCaptureOverlays(page);
      steps.push({
        ...plan,
        screenshot: await page.screenshot({
          type: "png",
          fullPage: false,
        }),
      });
    }

    return steps;
  } finally {
    await browser.close();
  }
}

async function installTrainingCaptureOverlayHider(page: Page) {
  await page.addStyleTag({
    content: `
      [data-sonner-toaster],
      [data-radix-toast-viewport],
      [data-admin-feedback-root],
      [data-velt-root],
      [class*="Velt"],
      [class*="velt"],
      [class*="styles-module__toolbar"],
      [class*="styles-module__fixedMarkersLayer"],
      .cdk-overlay-container,
      .global-ai-widget-launcher,
      nextjs-portal,
      .__nextjs-toast,
      .__nextjs-build-watcher,
      .__nextjs-error-overlay {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `,
  });
}

async function hideTrainingCaptureOverlays(page: Page) {
  await page.evaluate(() => {
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    for (const element of Array.from(document.body.querySelectorAll("*"))) {
      const style = window.getComputedStyle(element);
      if (style.position !== "fixed" && style.position !== "sticky") continue;

      const rect = element.getBoundingClientRect();
      const nearBottom = rect.bottom > viewportHeight - 180;
      const nearLeft = rect.left < 220;
      const nearRight = rect.right > viewportWidth - 220;
      const text = (element.textContent ?? "").replace(/\s+/g, " ").trim();
      const className = element.getAttribute("class") ?? "";
      const isInternalChrome =
        /\b(issue|feedback|debug|error|toast|annotations)\b/i.test(text) ||
        /velt|feedback|sonner|toast|nextjs|global-ai-widget|styles-module/i.test(
          className,
        );

      if (nearBottom && (nearLeft || nearRight) && isInternalChrome) {
        (element as HTMLElement).style.setProperty(
          "display",
          "none",
          "important",
        );
      }
    }
  });
}

function buildCapturePlans(
  pageContext: {
    title: string;
    labels: string[];
    buttons: string[];
    headings: string[];
  },
  sourceUrl: string,
): Omit<CapturedStep, "screenshot">[] {
  const fieldList = pageContext.labels.length
    ? pageContext.labels.map((label) => `- ${label}`).join("\n")
    : "- Review the visible fields on this screen.";
  const actionList = pageContext.buttons.length
    ? pageContext.buttons.map((button) => `- ${button}`).join("\n")
    : "- Use the primary action shown on the page.";

  return [
    {
      title: `Open ${pageContext.title}`,
      instructionMarkdown: `Navigate to this workflow and confirm the ${pageContext.title} screen is visible.`,
      expectedResult: `The ${pageContext.title} workflow loads without redirecting or showing an error state.`,
      sourceUrl,
      metadata: {
        kind: "open_workflow",
        headings: pageContext.headings,
      },
    },
    {
      title: "Complete the required information",
      instructionMarkdown: `Work through the visible fields in order.\n\n${fieldList}`,
      expectedResult:
        "Required fields are completed and the page is ready for review.",
      sourceUrl,
      metadata: {
        kind: "complete_fields",
        labels: pageContext.labels,
      },
    },
    {
      title: "Review and continue",
      instructionMarkdown: `Review the page for accuracy, then use the correct action.\n\n${actionList}`,
      expectedResult:
        "The workflow advances only after the information has been reviewed.",
      sourceUrl,
      metadata: {
        kind: "review_actions",
        buttons: pageContext.buttons,
      },
    },
  ];
}

type CleanupTargets = {
  stepIds: string[];
  assets: Array<{
    id: string;
    storage_bucket: string;
    storage_path: string;
  }>;
};

async function readGeneratedStepCleanupTargets({
  service,
  docId,
}: {
  service: Awaited<ReturnType<typeof requireTrainingDocsAdmin>>["service"];
  docId: string;
}): Promise<CleanupTargets> {
  const { data: stepRows, error: stepsReadError } = await service
    .from("training_doc_steps")
    .select("id, screenshot_asset_id")
    .eq("training_doc_id", docId)
    .eq("action_metadata->>generated_by", GENERATOR_NAME);

  if (stepsReadError) {
    throw new Error(
      `Failed to read existing generated steps: ${stepsReadError.message}`,
    );
  }

  const stepIds = (stepRows ?? []).map((step) => step.id);
  const assetIds = Array.from(
    new Set(
      (stepRows ?? [])
        .map((step) => step.screenshot_asset_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  if (!assetIds.length) {
    return { stepIds, assets: [] };
  }

  const { data: assets, error: assetReadError } = await service
    .from("training_doc_assets")
    .select("id, storage_bucket, storage_path")
    .in("id", assetIds);

  if (assetReadError) {
    throw new Error(
      `Failed to read existing generated screenshots: ${assetReadError.message}`,
    );
  }

  return { stepIds, assets: assets ?? [] };
}

async function deleteGeneratedStepTargets({
  service,
  targets,
}: {
  service: Awaited<ReturnType<typeof requireTrainingDocsAdmin>>["service"];
  targets: CleanupTargets;
}) {
  if (!targets.stepIds.length && !targets.assets.length) return;

  if (targets.stepIds.length) {
    const { error: stepDeleteError } = await service
      .from("training_doc_steps")
      .delete()
      .in("id", targets.stepIds);

    if (stepDeleteError) {
      throw new Error(
        `Failed to replace existing generated steps: ${stepDeleteError.message}`,
      );
    }
  }

  for (const asset of targets.assets) {
    await service.storage
      .from(asset.storage_bucket)
      .remove([asset.storage_path]);
  }

  if (!targets.assets.length) return;

  const { error: assetDeleteError } = await service
    .from("training_doc_assets")
    .delete()
    .in(
      "id",
      targets.assets.map((asset) => asset.id),
    );

  if (assetDeleteError) {
    throw new Error(
      `Failed to delete existing generated screenshots: ${assetDeleteError.message}`,
    );
  }
}
