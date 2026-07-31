import { notFound } from "next/navigation";

import { ArrowLeft, ArrowRight, Calendar, FileText, Tag } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { PageContainer } from "@/components/layout";
import { EmptyState } from "@/components/ds";
import { createClient } from "@/lib/supabase/server";

interface PageProps {
  params: Promise<{ articleId: string }>;
}

export default async function SupportArticleDetailPage({ params }: PageProps) {
  const { articleId } = await params;
  const supabase = await createClient();

  const { data: article, error } = await supabase
    .from("support_articles")
    .select("*")
    .eq("id", Number(articleId))
    .single();

  if (error || !article) {
    notFound();
  }

  return (
    <PageContainer maxWidth="xl" className="pb-12">
      {/* Back link */}
      <div className="mb-6">
        <Link
          href="/support-articles"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Support Articles
        </Link>
        <h1 className="text-2xl font-semibold text-foreground">
          {article.title}
        </h1>
        {article.description ? (
          <p className="text-sm text-muted-foreground mt-2">{article.description}</p>
        ) : null}
      </div>

      {/* Meta bar */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-border pb-4 mb-8">
        {article.category ? (
          <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            {article.category}
            {article.subcategory ? ` · ${article.subcategory}` : ""}
          </span>
        ) : null}
        {article.source_updated_at ? (
          <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            Updated {format(new Date(article.source_updated_at), "MMM d, yyyy")}
          </span>
        ) : null}
        {article.word_count ? (
          <span className="text-xs font-medium text-muted-foreground">
            {article.word_count.toLocaleString()} words
          </span>
        ) : null}
        {article.url ? (
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            View on Procore
          </a>
        ) : null}
      </div>

      <div className="grid gap-16 lg:grid-cols-[minmax(0,1fr)_240px]">
        {/* Main content — rendered markdown */}
        <article className="prose prose-sm dark:prose-invert max-w-none">
          {article.markdown_content ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1 className="text-xl font-semibold text-foreground mt-8 mb-3 first:mt-0">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-base font-semibold text-foreground mt-5 mb-2">{children}</h3>
                ),
                h4: ({ children }) => (
                  <h4 className="text-sm font-semibold text-foreground mt-4 mb-1">{children}</h4>
                ),
                p: ({ children }) => (
                  <p className="text-sm text-muted-foreground leading-relaxed mb-3">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="space-y-1 pl-4 list-disc mb-3">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal pl-4 space-y-1 mb-3">{children}</ol>
                ),
                li: ({ children }) => (
                  <li className="text-sm text-muted-foreground leading-relaxed">{children}</li>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold text-foreground">{children}</strong>
                ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline underline-offset-2"
                  >
                    {children}
                  </a>
                ),
                table: ({ children }) => (
                  <div className="overflow-x-auto mb-4">
                    <table className="w-full text-sm border-collapse border border-border">{children}</table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="border border-border bg-muted px-3 py-2 text-left text-xs font-semibold text-foreground">{children}</th>
                ),
                td: ({ children }) => (
                  <td className="border border-border px-3 py-2 text-sm text-muted-foreground">{children}</td>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-primary/30 pl-4 italic text-muted-foreground mb-3">{children}</blockquote>
                ),
                code: ({ children, className }) => {
                  const isBlock = className?.includes("language-");
                  if (isBlock) {
                    return (
                      <pre className="rounded-md bg-muted p-3 text-xs font-mono overflow-x-auto mb-3">
                        <code>{children}</code>
                      </pre>
                    );
                  }
                  return (
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground">{children}</code>
                  );
                },
                img: ({ src, alt }) => (
                  <img src={src} alt={alt ?? ""} className="rounded-md max-w-full h-auto my-4" />
                ),
              }}
            >
              {article.markdown_content}
            </ReactMarkdown>
          ) : (
            <EmptyState
              icon={<FileText />}
              title="No content available"
              description="This article has not been crawled yet."
            />
          )}
        </article>

        {/* Sidebar */}
        <aside className="space-y-6">
          {/* Breadcrumb */}
          {article.breadcrumb && article.breadcrumb.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">Breadcrumb</p>
              <p className="text-xs text-muted-foreground">
                {article.breadcrumb.join(" › ")}
              </p>
            </div>
          ) : null}

          {/* Tags */}
          {article.tags && article.tags.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary inline-flex items-center gap-1.5">
                <Tag className="h-3 w-3" />
                Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {article.tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-full border border-border/60 bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {/* Metadata */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Details</p>
            <dl className="space-y-2 text-xs">
              {article.last_crawled_at ? (
                <div>
                  <dt className="text-muted-foreground">Last crawled</dt>
                  <dd className="font-medium text-foreground">
                    {format(new Date(article.last_crawled_at), "MMM d, yyyy h:mm a")}
                  </dd>
                </div>
              ) : null}
              {article.slug ? (
                <div>
                  <dt className="text-muted-foreground">Slug</dt>
                  <dd className="font-mono text-foreground break-all">{article.slug}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        </aside>
      </div>
    </PageContainer>
  );
}
