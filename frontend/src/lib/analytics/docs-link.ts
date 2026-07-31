import "server-only";

const CANONICAL_DOCS_ORIGIN = "https://docs.alleatogroup.com";
const LEGACY_DOCS_ORIGIN = "https://alleato-docs-site.vercel.app";
const ATTRIBUTED_DOCS_LINK_ROUTE = "/api/engagement/docs/link";

export function docsPathFromUrl(sourceUrl: string): string | null {
  try {
    const url = new URL(sourceUrl, CANONICAL_DOCS_ORIGIN);
    if (
      url.origin !== CANONICAL_DOCS_ORIGIN &&
      url.origin !== LEGACY_DOCS_ORIGIN
    ) {
      return null;
    }
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

export function attributedDocsHref(sourceUrl: string): string {
  const path = docsPathFromUrl(sourceUrl);
  return path
    ? `${ATTRIBUTED_DOCS_LINK_ROUTE}?path=${encodeURIComponent(path)}`
    : sourceUrl;
}
