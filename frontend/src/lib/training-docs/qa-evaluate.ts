import type { TrainingDocQaStatus } from "./constants";
import type { TrainingDocWithAssets } from "./types";

/**
 * Pure QA evaluation logic — no browser, no network, no database.
 *
 * Kept separate from `qa.ts` (which owns the Playwright capture, the optional
 * LLM call, and DB persistence) so this decision logic is trivially unit
 * testable and never drags heavy IO dependencies into a test runner.
 */

export interface LivePageContext {
  loaded: boolean;
  httpStatus: number | null;
  finalPathname: string;
  redirectedToAuth: boolean;
  title: string;
  headings: string[];
  labels: string[];
  buttons: string[];
  hasFormControls: boolean;
  captureError: string | null;
}

export interface TrainingDocQaResult {
  qa_status: TrainingDocQaStatus;
  qa_notes: string;
  checkedRoute: string | null;
  signals: string[];
  usedLlm: boolean;
  pageContext: LivePageContext | null;
}

export interface DeterministicVerdict {
  status: TrainingDocQaStatus;
  signals: string[];
  hardFail: boolean;
}

export const AUTH_REDIRECT_PREFIXES = ["/auth/login", "/access-denied", "/login"];

export const STATUS_RANK: Record<TrainingDocQaStatus, number> = {
  not_tested: 0,
  passing: 1,
  needs_update: 2,
  failing: 3,
};

export function normalizeRoute(route: string | null | undefined): string | null {
  const trimmed = route?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) {
    // Live QA only runs against in-app relative routes, mirroring generation.
    try {
      return new URL(trimmed).pathname;
    } catch {
      return null;
    }
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

/**
 * Docs whose route still contains an un-substituted param placeholder (e.g.
 * `/[projectId]/commitments`) can never be opened as-is. Callers should treat
 * these as un-checkable rather than failing them for a broken route.
 */
export function routeHasUnresolvedParam(
  route: string | null | undefined,
): boolean {
  return typeof route === "string" && /\[[^\]]+\]/.test(route);
}

function collectReferencedTerms(
  doc: TrainingDocWithAssets,
  key: "buttons" | "labels" | "headings",
): string[] {
  const terms = new Set<string>();
  for (const step of doc.steps) {
    const meta = step.action_metadata as Record<string, unknown> | null;
    const value = meta?.[key];
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === "string" && entry.trim()) {
          terms.add(entry.trim());
        }
      }
    }
  }
  return Array.from(terms);
}

function significantTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 3);
}

function present(term: string, haystack: string[]): boolean {
  const needle = term.toLowerCase();
  return haystack.some(
    (candidate) =>
      candidate.toLowerCase().includes(needle) ||
      needle.includes(candidate.toLowerCase()),
  );
}

/**
 * Classify a doc against a captured live page using only structural signals:
 * route health (hard failures) plus drift in referenced buttons/labels/title.
 */
export function evaluateDeterministic(
  doc: TrainingDocWithAssets,
  page: LivePageContext,
): DeterministicVerdict {
  const signals: string[] = [];

  if (!page.loaded) {
    signals.push(
      `Route did not load${page.captureError ? ` (${page.captureError})` : ""}.`,
    );
    return { status: "failing", signals, hardFail: true };
  }
  if (page.httpStatus !== null && page.httpStatus >= 400) {
    signals.push(`Route returned HTTP ${page.httpStatus}.`);
    return { status: "failing", signals, hardFail: true };
  }
  if (page.redirectedToAuth) {
    signals.push(
      `Route redirected to ${page.finalPathname} — the doc's route may be wrong or require different permissions.`,
    );
    return { status: "failing", signals, hardFail: true };
  }
  if (!page.title && !page.hasFormControls && page.headings.length === 0) {
    signals.push("Page rendered with no recognizable heading or form content.");
    return { status: "failing", signals, hardFail: true };
  }

  let drift = false;

  const referencedButtons = collectReferencedTerms(doc, "buttons");
  const referencedLabels = collectReferencedTerms(doc, "labels");

  const missingButtons = referencedButtons.filter(
    (term) => !present(term, page.buttons),
  );
  const missingLabels = referencedLabels.filter(
    (term) => !present(term, page.labels),
  );

  if (referencedButtons.length > 0 && missingButtons.length > 0) {
    drift = true;
    signals.push(
      `${missingButtons.length}/${referencedButtons.length} referenced button(s) not found on the current page: ${missingButtons
        .slice(0, 5)
        .join(", ")}.`,
    );
  }
  if (referencedLabels.length > 0 && missingLabels.length > 0) {
    drift = true;
    signals.push(
      `${missingLabels.length}/${referencedLabels.length} referenced field label(s) not found: ${missingLabels
        .slice(0, 5)
        .join(", ")}.`,
    );
  }

  const expectedTitleSource = doc.title;
  if (page.title && expectedTitleSource) {
    const expectedTokens = new Set(significantTokens(expectedTitleSource));
    const pageTokens = significantTokens(page.title);
    const overlap = pageTokens.some((token) => expectedTokens.has(token));
    if (expectedTokens.size > 0 && pageTokens.length > 0 && !overlap) {
      drift = true;
      signals.push(
        `Page title "${page.title}" does not obviously match the doc "${doc.title}".`,
      );
    }
  }

  if (drift) {
    return { status: "needs_update", signals, hardFail: false };
  }

  signals.push(
    `Route loaded (HTTP ${page.httpStatus ?? "200"}) and referenced UI is present.`,
  );
  return { status: "passing", signals, hardFail: false };
}
