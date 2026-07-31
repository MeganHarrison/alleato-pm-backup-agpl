import { isOverlayHost } from "@/lib/admin-feedback/targeting";

function isVisibleHTMLElement(node: Element | null): node is HTMLElement {
  return (
    node instanceof HTMLElement &&
    node.offsetParent !== null &&
    !isOverlayHost(node)
  );
}

/**
 * The header launcher should prefer stable page content instead of latching
 * onto whatever transient dialog happens to be open underneath it.
 *
 * Why: route-owned sheets/popovers can run their own focus management, which
 * makes the feedback composer feel "dead" even though it rendered. Users can
 * still target a specific dialog via the explicit point-to-an-area control.
 */
export function getBestComposerTarget(
  root: ParentNode = document,
): HTMLElement {
  const candidates = [
    "[data-feedback-id='app.main-content']",
    "main",
    "[role='dialog']:not([data-admin-feedback-root='true'])",
  ];

  for (const selector of candidates) {
    const target = root.querySelector(selector);
    if (isVisibleHTMLElement(target)) {
      return target;
    }
  }

  return document.body;
}
