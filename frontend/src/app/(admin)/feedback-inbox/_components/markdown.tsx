import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

export function renderSimpleMarkdown(text: string) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      components={{
        p: ({ children }) => (
          <p className="text-sm leading-relaxed">{children}</p>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline hover:opacity-80 break-all"
          >
            {children}
          </a>
        ),
        code: ({ children, className }) => {
          const isBlock = className?.includes("language-");
          if (isBlock) {
            return (
              <code className="block overflow-x-auto text-xs font-mono leading-relaxed whitespace-pre-wrap">
                {children}
              </code>
            );
          }
          return (
            <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="my-1.5 overflow-x-auto rounded bg-muted px-3 py-2 text-xs font-mono leading-relaxed whitespace-pre-wrap">
            {children}
          </pre>
        ),
        h1: ({ children }) => (
          <h1 className="mt-2 mb-1 text-base font-semibold text-foreground">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="mt-2 mb-1 text-sm font-semibold text-foreground">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="mt-1.5 mb-0.5 text-xs font-semibold text-foreground">
            {children}
          </h3>
        ),
        ul: ({ children }) => (
          <ul className="my-1 ml-4 list-disc space-y-0.5 text-sm">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="my-1 ml-4 list-decimal space-y-0.5 text-sm">{children}</ol>
        ),
        li: ({ children }) => <li className="text-sm">{children}</li>,
        blockquote: ({ children }) => (
          <blockquote className="my-1 border-l-2 border-border pl-3 text-sm text-muted-foreground">
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <div className="my-2 overflow-x-auto">
            <table className="w-full text-xs border-collapse">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-muted">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="px-2 py-1 text-left font-medium text-foreground border border-border">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-2 py-1 text-muted-foreground border border-border">
            {children}
          </td>
        ),
        hr: () => <hr className="my-2 border-border" />,
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
      }}
    >
      {text}
    </ReactMarkdown>
  );
}
