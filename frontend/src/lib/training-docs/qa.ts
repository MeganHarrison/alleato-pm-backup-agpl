import { chromium } from "playwright";
import type { Page } from "playwright";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

import type { TrainingDocQaStatus } from "./constants";
import type { TrainingDocWithAssets } from "./types";
import {
  AUTH_REDIRECT_PREFIXES,
  evaluateDeterministic,
  normalizeRoute,
  routeHasUnresolvedParam,
  STATUS_RANK,
  type LivePageContext,
  type TrainingDocQaResult,
} from "./qa-evaluate";

export {
  evaluateDeterministic,
  normalizeRoute,
  routeHasUnresolvedParam,
} from "./qa-evaluate";
export type {
  LivePageContext,
  TrainingDocQaResult,
} from "./qa-evaluate";

type ServiceClient = SupabaseClient<Database>;

/**
 * Automated QA for training docs — the "doc vs. live app" drift check.
 *
 * A published training doc describes a real in-app workflow at `source_route`.
 * As the app changes (renamed buttons, moved routes, removed fields) the doc
 * silently goes stale. This engine re-opens the live route in an authenticated
 * headless browser, extracts the current UI, and decides whether the doc still
 * matches:
 *   - `passing`      — route loads and the doc's referenced UI is still present
 *   - `needs_update` — route loads but the UI drifted from what the doc describes
 *   - `failing`      — route is broken (won't load / redirects to login / blank)
 *
 * The deterministic route-health + structural check in `qa-evaluate.ts` is the
 * backbone (always runs, needs no API key). An optional LLM pass refines the
 * verdict on content accuracy when a provider is configured; if it is
 * unavailable the deterministic verdict stands and the notes say so.
 */

async function hideCaptureOverlays(page: Page): Promise<void> {
  await page
    .addStyleTag({
      content: `
        [data-sonner-toaster],
        [data-radix-toast-viewport],
        [data-admin-feedback-root],
        [data-velt-root],
        [class*="Velt"],
        [class*="velt"],
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
    })
    .catch(() => undefined);
}

/**
 * Open a live in-app route in an authenticated headless browser and extract the
 * current UI signals. Never throws — capture failures are returned as a
 * `captureError` on a not-loaded context so the caller can classify them.
 */
export async function captureLivePage({
  origin,
  route,
  cookieHeader,
}: {
  origin: string;
  route: string;
  cookieHeader: string;
}): Promise<LivePageContext> {
  const empty: LivePageContext = {
    loaded: false,
    httpStatus: null,
    finalPathname: route,
    redirectedToAuth: false,
    title: "",
    headings: [],
    labels: [],
    buttons: [],
    hasFormControls: false,
    captureError: null,
  };

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      extraHTTPHeaders: { cookie: cookieHeader },
    });
    const page = await context.newPage();
    const targetUrl = new URL(route, origin).toString();

    let httpStatus: number | null = null;
    try {
      const response = await page.goto(targetUrl, {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      httpStatus = response?.status() ?? null;
    } catch (error) {
      return {
        ...empty,
        captureError: error instanceof Error ? error.message : String(error),
      };
    }

    await hideCaptureOverlays(page);
    await page
      .waitForLoadState("networkidle", { timeout: 10_000 })
      .catch(() => undefined);
    await page
      .waitForFunction(
        () => {
          const title = (document.querySelector("h1")?.textContent ?? "").trim();
          const controls = document.querySelectorAll(
            "input, textarea, [role='combobox'], button",
          ).length;
          return Boolean(title) || controls > 0;
        },
        null,
        { timeout: 15_000 },
      )
      .catch(() => undefined);

    const finalPathname = (() => {
      try {
        return new URL(page.url()).pathname;
      } catch {
        return route;
      }
    })();

    const redirectedToAuth = AUTH_REDIRECT_PREFIXES.some((prefix) =>
      finalPathname.startsWith(prefix),
    );

    const extracted = await page.evaluate(() => {
      const clean = (value: string | null | undefined) =>
        (value ?? "").replace(/\s+/g, " ").trim();
      const collect = (selector: string, limit: number) =>
        Array.from(document.querySelectorAll(selector))
          .map((element) => clean(element.textContent))
          .filter(Boolean)
          .slice(0, limit);

      return {
        title:
          clean(document.querySelector("h1")?.textContent) ||
          clean(document.title),
        headings: collect("h1, h2, h3", 24),
        labels: collect("label", 40),
        buttons: collect("button, [role='button'], a[role='button']", 40),
        hasFormControls:
          document.querySelectorAll("input, textarea, [role='combobox']")
            .length > 0,
      };
    });

    return {
      loaded: true,
      httpStatus,
      finalPathname,
      redirectedToAuth,
      title: extracted.title,
      headings: extracted.headings,
      labels: extracted.labels,
      buttons: extracted.buttons,
      hasFormControls: extracted.hasFormControls,
      captureError: null,
    };
  } catch (error) {
    return {
      ...empty,
      captureError: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await browser.close();
  }
}

/**
 * Optional LLM refinement. Returns null when no provider is configured or the
 * call fails — the deterministic verdict then stands.
 */
async function evaluateWithLlm(
  doc: TrainingDocWithAssets,
  page: LivePageContext,
): Promise<{ status: TrainingDocQaStatus; reason: string } | null> {
  try {
    const [{ generateObject }, { getLanguageModel }, { z }] = await Promise.all([
      import("ai"),
      import("@/lib/ai/providers"),
      import("zod"),
    ]);

    const model = getLanguageModel("gpt-4.1-mini");

    const docSteps = doc.steps
      .slice(0, 12)
      .map(
        (step, index) =>
          `${index + 1}. ${step.title}${
            step.instruction_markdown
              ? ` — ${step.instruction_markdown.slice(0, 200)}`
              : ""
          }`,
      )
      .join("\n");

    const { object } = await generateObject({
      model,
      schema: z.object({
        status: z.enum(["passing", "needs_update", "failing"]),
        reason: z.string().max(600),
      }),
      prompt: [
        "You are QA-checking whether a help/training article still accurately describes a live app screen.",
        "",
        `ARTICLE TITLE: ${doc.title}`,
        `ARTICLE ROUTE: ${doc.source_route ?? "(none)"}`,
        "",
        "ARTICLE BODY (markdown, may be truncated):",
        doc.body_markdown.slice(0, 3500),
        "",
        "ARTICLE STEPS:",
        docSteps || "(no discrete steps recorded)",
        "",
        "LIVE PAGE NOW:",
        `- Heading: ${page.title || "(none)"}`,
        `- Section headings: ${page.headings.join(" | ") || "(none)"}`,
        `- Field labels: ${page.labels.join(" | ") || "(none)"}`,
        `- Buttons/actions: ${page.buttons.join(" | ") || "(none)"}`,
        "",
        "Decide:",
        "- passing: the article's steps, fields, and buttons still match this screen.",
        "- needs_update: the screen still exists but the article references fields/buttons/steps that no longer match.",
        "- failing: the article describes a workflow this screen clearly no longer supports.",
        "Give a one or two sentence reason citing the specific mismatch, or confirming the match.",
      ].join("\n"),
    });

    return object;
  } catch {
    return null;
  }
}

/**
 * Run the full QA check for a single doc (deterministic + optional LLM) and
 * return the combined verdict. Does not write to the database.
 */
export async function runTrainingDocQa({
  doc,
  origin,
  cookieHeader,
  useLlm = true,
}: {
  doc: TrainingDocWithAssets;
  origin: string;
  cookieHeader: string;
  useLlm?: boolean;
}): Promise<TrainingDocQaResult> {
  const route = normalizeRoute(doc.source_route);

  if (!route) {
    return {
      qa_status: "needs_update",
      qa_notes:
        "No source_route is set on this doc, so its accuracy cannot be verified against the live app. Add the in-app route it documents.",
      checkedRoute: null,
      signals: ["Missing source_route."],
      usedLlm: false,
      pageContext: null,
    };
  }

  if (routeHasUnresolvedParam(doc.source_route)) {
    return {
      qa_status: "needs_update",
      qa_notes: `The source_route "${doc.source_route}" still contains an unresolved parameter placeholder and cannot be opened for QA. Replace it with a concrete route (e.g. a real project id).`,
      checkedRoute: doc.source_route,
      signals: ["Route contains an unresolved [param] placeholder."],
      usedLlm: false,
      pageContext: null,
    };
  }

  const pageContext = await captureLivePage({ origin, route, cookieHeader });
  const deterministic = evaluateDeterministic(doc, pageContext);

  const signals = [...deterministic.signals];
  let status = deterministic.status;
  let usedLlm = false;

  // Only ask the LLM when the route is healthy — a hard route failure is
  // authoritative and needs no content judgment.
  if (useLlm && !deterministic.hardFail) {
    const llm = await evaluateWithLlm(doc, pageContext);
    if (llm) {
      usedLlm = true;
      signals.push(`AI review: ${llm.reason}`);
      // Take the more severe of the two verdicts.
      if (STATUS_RANK[llm.status] > STATUS_RANK[status]) {
        status = llm.status;
      }
    } else {
      signals.push("AI review unavailable — structural check only.");
    }
  }

  return {
    qa_status: status,
    qa_notes: signals.join("\n"),
    checkedRoute: route,
    signals,
    usedLlm,
    pageContext,
  };
}

/**
 * Persist a QA result onto the training_docs row.
 */
export async function persistTrainingDocQa(
  service: ServiceClient,
  docId: string,
  result: TrainingDocQaResult,
): Promise<void> {
  const { error } = await service
    .from("training_docs")
    .update({
      qa_status: result.qa_status,
      qa_notes: result.qa_notes,
      qa_last_run_at: new Date().toISOString(),
    })
    .eq("id", docId);

  if (error) {
    throw new Error(`Failed to persist QA result: ${error.message}`);
  }
}
