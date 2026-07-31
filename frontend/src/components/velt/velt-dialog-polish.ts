const DIALOG_SELECTOR =
  "velt-comment-dialog-internal .velt-comment-dialog:not(.velt-comment-dialog--wireframe-host)";
const HEADER_SELECTOR =
  'velt-comment-dialog-header-internal .velt-header[aria-label="Comment dialog header controls"]';
const AUTHOR_SELECTOR = ".velt-thread-card--author";
const STATUS_TRIGGER_SELECTOR =
  'velt-comment-dialog-status-dropdown-internal [data-testid="velt-dropdown-trigger"]';
const HEADER_OPTIONS_SELECTOR =
  'velt-comment-dialog-header-internal [aria-label="Comment options menu"]';
const THREAD_OPTIONS_SELECTOR =
  'velt-comment-dialog-thread-card-internal [aria-label="Thread card options"]';
const TEXT_COMMENT_HOST_SELECTOR =
  "velt-text-comment-internal[data-testid='velt-text-comment-container']";
const TEXT_COMMENT_SURFACE_SELECTOR = ".velt-text-comment";
const LEGACY_ISSUE_TOGGLE_SELECTOR = "[data-alleato-comment-issue-toggle]";

const polishedStatusTriggers = new WeakSet<HTMLElement>();
let warnedAboutContractDrift = false;

function polishTextCommentComposer(
  host: Element,
): (() => void) | null {
  const surface = host.querySelector(TEXT_COMMENT_SURFACE_SELECTOR);
  if (!surface) {
    return null;
  }

  if (host.getAttribute("data-alleato-text-comment-polish") !== "true") {
    host.setAttribute("data-alleato-text-comment-polish", "true");
  }

  return () => undefined;
}

function polishDialog(
  dialog: Element,
): (() => void) | null {
  const header = dialog.querySelector(HEADER_SELECTOR);
  const author = dialog.querySelector(AUTHOR_SELECTOR);
  const statusTrigger = dialog.querySelector<HTMLElement>(STATUS_TRIGGER_SELECTOR);
  const headerOptions = dialog.querySelector<HTMLElement>(HEADER_OPTIONS_SELECTOR);

  if (!header || !author || !statusTrigger || !headerOptions) {
    if (!warnedAboutContractDrift) {
      warnedAboutContractDrift = true;
      console.warn(
        "[velt] Comment dialog polish was skipped because the Velt dialog DOM contract changed.",
      );
    }
    return null;
  }

  if (dialog.getAttribute("data-alleato-dialog-polish") !== "true") {
    dialog.setAttribute("data-alleato-dialog-polish", "true");
  }

  headerOptions.setAttribute("data-alleato-primary-options", "true");

  if (polishedStatusTriggers.has(statusTrigger)) return null;
  polishedStatusTriggers.add(statusTrigger);

  let hoverTimer: number | undefined;
  const openStatusMenu = () => {
    window.clearTimeout(hoverTimer);
    hoverTimer = window.setTimeout(() => {
      if (
        statusTrigger.matches(":hover") &&
        statusTrigger.getAttribute("aria-expanded") !== "true"
      ) {
        statusTrigger.click();
      }
    }, 140);
  };
  const cancelStatusMenu = () => window.clearTimeout(hoverTimer);

  statusTrigger.addEventListener("pointerenter", openStatusMenu);
  statusTrigger.addEventListener("pointerleave", cancelStatusMenu);
  return () => {
    window.clearTimeout(hoverTimer);
    statusTrigger.removeEventListener("pointerenter", openStatusMenu);
    statusTrigger.removeEventListener("pointerleave", cancelStatusMenu);
    polishedStatusTriggers.delete(statusTrigger);
  };
}

/**
 * Applies the quiet Alleato dialog hierarchy after Velt mounts its Angular
 * portal. The native Velt nodes stay in place so status, menu, and resolve
 * handlers keep their vendor-supported behavior.
 */
export function observeVeltCommentDialogPolish(
  root: Document,
): () => void {
  const cleanups = new Map<Element, () => void>();

  const polish = () => {
    // This control was previously injected by the app and is intentionally no
    // longer part of the comment surface. Remove stale nodes too so hot reload
    // and vendor DOM mutations cannot leave the old control visible.
    root
      .querySelectorAll(LEGACY_ISSUE_TOGGLE_SELECTOR)
      .forEach((toggle) => toggle.remove());

    root.querySelectorAll(DIALOG_SELECTOR).forEach((dialog) => {
      dialog.querySelectorAll<HTMLElement>(THREAD_OPTIONS_SELECTOR).forEach((menu) => {
        menu.setAttribute("data-alleato-redundant-options", "true");
      });
      cleanups.get(dialog)?.();
      cleanups.delete(dialog);
      const cleanup = polishDialog(dialog);
      if (cleanup) cleanups.set(dialog, cleanup);
    });

    root.querySelectorAll(TEXT_COMMENT_HOST_SELECTOR).forEach((host) => {
      cleanups.get(host)?.();
      cleanups.delete(host);
      const cleanup = polishTextCommentComposer(host);
      if (cleanup) cleanups.set(host, cleanup);
    });

    cleanups.forEach((cleanup, dialog) => {
      if (dialog.isConnected) return;
      cleanup();
      cleanups.delete(dialog);
    });
  };

  polish();
  if (typeof MutationObserver === "undefined") {
    return () => cleanups.forEach((cleanup) => cleanup());
  }

  let frame: number | undefined;
  const observer = new MutationObserver(() => {
    window.cancelAnimationFrame(frame ?? 0);
    frame = window.requestAnimationFrame(polish);
  });
  observer.observe(root.body ?? root.documentElement, {
    childList: true,
    subtree: true,
  });

  return () => {
    observer.disconnect();
    window.cancelAnimationFrame(frame ?? 0);
    cleanups.forEach((cleanup) => cleanup());
    cleanups.clear();
  };
}
