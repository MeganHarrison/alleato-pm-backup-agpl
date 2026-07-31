import { ADMIN_FEEDBACK_OVERLAY_ATTRIBUTE } from "@/lib/admin-feedback/constants";
import { compressImageDataUrl } from "@/lib/admin-feedback/compress-image";
import { isOverlayHost } from "@/lib/admin-feedback/targeting";

// Number of times to re-run html-to-image when it returns an empty result. The
// first call frequently yields "data:," because the cloned node's images/fonts
// have not decoded yet; a paint between attempts lets them settle.
export const MAX_SCREENSHOT_CAPTURE_ATTEMPTS = 3;
const SCREENSHOT_RENDER_TIMEOUT_MS = 8000;
// A genuine PNG/JPEG data URL is far longer than this; anything shorter is a
// degenerate/empty capture ("data:," or a near-empty base64 payload).
const MIN_VALID_DATA_URL_LENGTH = 100;

/** True when html-to-image returned nothing usable. */
export function isEmptyCapture(dataUrl: string | null | undefined): boolean {
  if (!dataUrl || dataUrl === "data:,") {
    return true;
  }
  return dataUrl.length < MIN_VALID_DATA_URL_LENGTH;
}

/** Reject a promise that does not settle within `ms`, with a labelled error. */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Run `render` until it produces a non-empty capture, yielding `betweenAttempts`
 * (typically a paint) before each retry. Treats a thrown/hung render as a failed
 * attempt. Throws an explicit, reason-bearing error if every attempt is empty.
 */
export async function renderWithRetry(
  render: () => Promise<string>,
  options: {
    attempts?: number;
    betweenAttempts?: () => Promise<void> | void;
  } = {},
): Promise<string> {
  const attempts = options.attempts ?? MAX_SCREENSHOT_CAPTURE_ATTEMPTS;
  let lastReason: string | null = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0 && options.betweenAttempts) {
      await options.betweenAttempts();
    }

    try {
      const dataUrl = await render();
      if (!isEmptyCapture(dataUrl)) {
        return dataUrl;
      }
      lastReason = null;
    } catch (error) {
      lastReason = error instanceof Error ? error.message : String(error);
    }
  }

  const suffix = lastReason ? ` (${lastReason})` : "";
  throw new Error(
    `Capture produced an empty image after ${attempts} attempts${suffix}`,
  );
}

/** Wait for two animation frames so cloned images/fonts can decode/paint. */
function nextPaint(): Promise<void> {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}

function isCapturable(el: HTMLElement | null): el is HTMLElement {
  // A third-party overlay custom element (Velt/Snippyly) renders as an empty
  // `data:,` image — never use one as the capture root. Likewise, a zero-size
  // node produces a blank canvas. Reject both so we fall back to <main>/<body>.
  return (
    el != null &&
    !isOverlayHost(el) &&
    el.offsetWidth > 0 &&
    el.offsetHeight > 0
  );
}

export function shouldProtectCaptureRoot(
  root: HTMLElement,
  candidate: Element | null,
) {
  if (!(candidate instanceof HTMLElement)) {
    return false;
  }

  return candidate === root || candidate.contains(root) || root.contains(candidate);
}

/**
 * Resolve a real, renderable capture root. The clicked target can be a Velt
 * overlay (Velt's overlays cover the viewport, so elementFromPoint returns
 * them) or a zero-size element — neither can be screenshotted. Prefer the
 * nearest meaningful container, then fall back to the page main / body.
 */
function resolveCaptureRoot(target: HTMLElement): HTMLElement {
  const container = target.closest(
    "main, section, [role='region'], [data-feedback-id]",
  ) as HTMLElement | null;

  for (const candidate of [
    isCapturable(target) ? target : null,
    container,
    document.querySelector("main") as HTMLElement | null,
    document.querySelector(
      "[data-feedback-id='app.main-content']",
    ) as HTMLElement | null,
    document.body,
  ]) {
    if (isCapturable(candidate)) {
      return candidate;
    }
  }

  return document.body;
}

export async function captureTargetScreenshot(target: HTMLElement) {
  const primaryRoot = resolveCaptureRoot(target);

  // Hide everything that floats above the page during capture: our own feedback
  // overlays, Radix dialogs, and Velt/Snippyly overlay custom elements. Without
  // this, the composer or a Velt layer would bleed into the screenshot.
  const hidden: { el: HTMLElement; prev: string }[] = [];
  const hide = (el: Element | null) => {
    // Skip nodes the clone `filter` below already drops (our own feedback
    // overlays / Velt hosts). Hiding them in the LIVE DOM blinks the visible
    // composer out and back on every capture for zero benefit — they never
    // reach the rendered canvas anyway. Only genuinely-foreign floats (other
    // Radix dialogs, etc.) still need the live hide.
    if (
      el instanceof HTMLElement &&
      !shouldProtectCaptureRoot(primaryRoot, el) &&
      !isOverlayHost(el) &&
      el.style.visibility !== "hidden"
    ) {
      hidden.push({ el, prev: el.style.visibility });
      el.style.visibility = "hidden";
    }
  };
  document
    .querySelectorAll(
      `[${ADMIN_FEEDBACK_OVERLAY_ATTRIBUTE}], [data-radix-dialog-overlay], [role="dialog"]`,
    )
    .forEach(hide);
  // Velt overlays are body-level custom elements that any static selector misses.
  Array.from(document.body.children).forEach((el) => {
    if (isOverlayHost(el)) {
      hide(el);
    }
  });

  try {
    const { toPng } = await import("html-to-image");
    const options = {
      backgroundColor: "#ffffff",
      pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      filter: (node: HTMLElement) => {
        if (node.nodeType !== 1) return true;
        return !isOverlayHost(node);
      },
    } as const;

    const renderRoot = (root: HTMLElement) =>
      withTimeout(
        toPng(root, options),
        SCREENSHOT_RENDER_TIMEOUT_MS,
        "Screenshot render",
      );

    let dataUrl: string;
    try {
      // Retry the primary root: the first attempt often returns "data:," before
      // images/fonts have decoded — a paint between attempts fixes that.
      dataUrl = await renderWithRetry(() => renderRoot(primaryRoot), {
        betweenAttempts: nextPaint,
      });
    } catch (primaryError) {
      if (primaryRoot === document.body) {
        throw primaryError;
      }
      // Fall back to the whole document body once (e.g. oversized/unsupported
      // root) so the user gets a usable screenshot instead of a hard failure.
      dataUrl = await renderWithRetry(() => renderRoot(document.body), {
        betweenAttempts: nextPaint,
      });
    }

    // Full-page captures (e.g. the Budget table) can be many MB as PNG, which
    // overflows the 4.5MB request-body limit on submit. Compress up front so
    // the stored/annotated screenshot stays within budget.
    return compressImageDataUrl(dataUrl);
  } finally {
    hidden.forEach(({ el, prev }) => {
      el.style.visibility = prev;
    });
  }
}
