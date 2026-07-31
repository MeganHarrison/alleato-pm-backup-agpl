"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { cn } from "@/lib/utils";
import type { Components } from "react-markdown";

interface Props {
  content: string;
  className?: string;
}

// Compact markdown renderer for timeline detail panels.
// Headings are scaled down — meeting notes use h3/h4 as section headers.
export function TimelineMarkdown({ content, className }: Props) {
  return (
    <div className={cn("text-sm text-foreground", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={
          {
            h1: ({ children }) => (
              <p className="font-semibold text-sm mt-3 mb-1">{children}</p>
            ),
            h2: ({ children }) => (
              <p className="font-semibold text-sm mt-3 mb-1">{children}</p>
            ),
            h3: ({ children }) => (
              <p className="font-semibold text-sm mt-3 mb-1">{children}</p>
            ),
            h4: ({ children }) => (
              <p className="font-medium text-sm mt-2 mb-0.5">{children}</p>
            ),
            p: ({ children }) => (
              <p className="text-sm text-foreground leading-relaxed mb-2">{children}</p>
            ),
            ul: ({ children }) => (
              <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>
            ),
            li: ({ children }) => (
              <li className="text-sm text-foreground">{children}</li>
            ),
            strong: ({ children }) => (
              <strong className="font-semibold">{children}</strong>
            ),
            em: ({ children }) => (
              <em className="italic">{children}</em>
            ),
            hr: () => <hr className="my-3 border-border" />,
            blockquote: ({ children }) => (
              <blockquote className="border-l-2 border-border pl-3 text-muted-foreground italic mb-2">
                {children}
              </blockquote>
            ),
            a: ({ children, href }) => (
              <a
                href={href}
                className="text-primary underline"
                target={href?.startsWith("http") ? "_blank" : undefined}
                rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
              >
                {children}
              </a>
            ),
            code: ({ children }) => (
              <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">
                {children}
              </code>
            ),
          } as Partial<Components>
        }
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
