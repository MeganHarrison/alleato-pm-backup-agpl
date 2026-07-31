"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownSummaryProps {
  content: string;
}

/**
 * Renders the summary section markdown with clean bullet-point styling.
 * Preprocesses content to remove empty list items that create blank bullets.
 */
export function MarkdownSummary({ content }: MarkdownSummaryProps) {
  const cleanedContent = content
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed !== "-" && trimmed !== "*" && trimmed !== "- " && trimmed !== "* ";
    })
    .join("\n");

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => (
          <p className="text-sm text-foreground leading-relaxed mb-3 last:mb-0">
            {children}
          </p>
        ),
        ul: ({ children }) => (
          <ul className="space-y-2.5">{children}</ul>
        ),
        li: ({ children }) => {
          const childArray = Array.isArray(children) ? children : [children];
          const hasContent = childArray.some((child) => {
            if (typeof child === "string") return child.trim().length > 0;
            return child != null;
          });
          if (!hasContent) return null;

          return (
            <li className="flex items-start gap-2.5 text-sm text-foreground leading-relaxed">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0 flex-none" />
              <span>{children}</span>
            </li>
          );
        },
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
        ),
      }}
    >
      {cleanedContent}
    </ReactMarkdown>
  );
}
