function getAnnotationContainer(root: Document | ShadowRoot) {
  // Sanitization must be scoped to DOM that Velt explicitly owns. Generic
  // annotation attributes are also used by product features such as drawing
  // SVG markup and must never grant this observer permission to remove nodes.
  return Array.from(
    root.querySelectorAll("[data-velt-annotation], [data-annotation-id][data-velt-target]"),
  );
}

function isMalformedAnnotation(node: Element): boolean {
  const text = node.textContent?.trim() ?? "";
  const hasTarget = node.hasAttribute("data-velt-target");
  return !text || !hasTarget;
}

export function observeMalformedVeltAnnotations(root: Document): () => void {
  const sanitize = (container: ParentNode) => {
    const nodes = getAnnotationContainer(container as Document | ShadowRoot);
    nodes.forEach((node) => {
      if (isMalformedAnnotation(node as Element)) {
        node.remove();
      }
    });
  };

  sanitize(root);

  if (typeof MutationObserver === "undefined") {
    return () => undefined;
  }

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element) && !(node instanceof DocumentFragment)) {
          return;
        }

        if (node instanceof Element) {
          sanitize(node);
          sanitize(node.parentElement ?? node);
        } else if (node instanceof DocumentFragment) {
          sanitize(node);
          Array.from(node.children).forEach((child) => sanitize(child));
        }
      });
    });
  });

  observer.observe(root, {
    childList: true,
    subtree: true,
  });

  return () => observer.disconnect();
}
