"use client";

import { useMemo, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

import type { DailyBriefSourceRef } from "@/lib/daily-briefs/canonical-packets";
import {
  buildSourceIndex,
  cleanSourceTitle,
  markKnownSourceCitations,
  type DailyBriefSourceIndex,
} from "@/lib/daily-briefs/source-links";

const MAX_CITATION_LABEL = 60;

/** Flatten react-markdown children down to their plain text (code is a string). */
function nodeText(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(nodeText).join("");
  return "";
}

function clipLabel(value: string): string {
  return value.length > MAX_CITATION_LABEL
    ? `${value.slice(0, MAX_CITATION_LABEL - 1).trimEnd()}…`
    : value;
}

const CODE_CLASS =
  "rounded-sm bg-muted px-1 py-0.5 font-mono text-xs text-muted-foreground";
const CITATION_LINK_CLASS =
  "font-medium text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid";
const CITATION_TEXT_CLASS = "font-medium text-muted-foreground";

/**
 * Render an inline `code` span. When its text is a known source citation, show
 * the source's readable title instead of the raw id and link it to the source
 * (Outlook web / stored transcript / document). Teams citations have no url, so
 * they render as a readable label without a link. Anything that isn't a source
 * id falls through to normal inline-code styling.
 */
function renderCode(
  children: ReactNode,
  index: DailyBriefSourceIndex | null,
): ReactNode {
  const raw = nodeText(children);
  const ref = index?.resolve(raw) ?? null;
  if (!ref) {
    return <code className={CODE_CLASS}>{children}</code>;
  }

  const label = clipLabel(cleanSourceTitle(ref));
  if (ref.url) {
    return (
      <a
        href={ref.url}
        target="_blank"
        rel="noopener noreferrer"
        title={ref.title}
        className={CITATION_LINK_CLASS}
      >
        {label}
      </a>
    );
  }
  return (
    <span title={ref.title} className={CITATION_TEXT_CLASS}>
      {label}
    </span>
  );
}

function buildComponents(
  index: DailyBriefSourceIndex | null,
): Partial<Components> {
  return {
    p: ({ children }) => (
      <p className="text-sm leading-7 text-foreground">{children}</p>
    ),
    ul: ({ children }) => (
      <ul className="list-disc space-y-1 pl-5">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal space-y-1 pl-5">{children}</ol>
    ),
    li: ({ children }) => (
      <li className="pl-1 text-sm leading-7 text-foreground">{children}</li>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold text-foreground">{children}</strong>
    ),
    em: ({ children }) => <em className="italic">{children}</em>,
    a: ({ children, href }) => (
      <a
        href={href}
        className="text-primary underline underline-offset-4 hover:no-underline"
      >
        {children}
      </a>
    ),
    code: ({ children }) => renderCode(children, index),
    // Brief sections are split on `##`, so any residual `###`/`####` headings
    // land here. Render them as a styled subheading element (not a raw <h3>,
    // which the design-system lint bans) to keep visual consistency.
    h3: ({ children }) => (
      <div className="text-sm font-semibold text-foreground">{children}</div>
    ),
    h4: ({ children }) => (
      <div className="text-sm font-semibold text-foreground">{children}</div>
    ),
    h2: ({ children }) => (
      <div className="pt-6 text-xl font-semibold text-foreground" role="heading" aria-level={2}>
        {children}
      </div>
    ),
  };
}

/**
 * Renders the complete persisted Daily Brief Markdown artifact inside a normal
 * application page, including headings, prose, citations, and lists.
 * The brief content is authored as markdown, so raw text rendering leaked
 * literal `**` and backticks into the page. When `sources` are supplied, inline
 * source-id citations become readable links to the underlying source.
 */
export function BriefMarkdown({
  content,
  sources,
}: {
  content: string;
  sources?: DailyBriefSourceRef[];
}) {
  const components = useMemo(() => {
    const index =
      sources && sources.length > 0 ? buildSourceIndex(sources) : null;
    return buildComponents(index);
  }, [sources]);

  const renderedContent = useMemo(() => {
    if (!sources || sources.length === 0) return content;
    return markKnownSourceCitations(content, buildSourceIndex(sources));
  }, [content, sources]);

  return (
    <div className="space-y-3">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={components}
      >
        {renderedContent}
      </ReactMarkdown>
    </div>
  );
}
