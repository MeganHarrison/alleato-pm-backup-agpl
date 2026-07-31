import * as React from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/layout";
import { MessageResponse } from "@/components/ai-elements/message";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";

interface Props {
  params: Promise<{ slug: string[] }>;
}

export default async function SupportArticlePage({ params }: Props) {
  const { slug: slugParts } = await params;
  const slug = slugParts.join("/");
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: article } = await (supabase as any)
    .from("support_articles")
    .select(
      "id, title, description, markdown_content, category, subcategory, breadcrumb, tags, url, word_count, last_crawled_at",
    )
    .eq("slug", slug)
    .single() as {
      data: {
        id: number;
        title: string;
        description: string | null;
        markdown_content: string | null;
        category: string | null;
        subcategory: string | null;
        breadcrumb: string[] | null;
        tags: string[] | null;
        url: string;
        word_count: number | null;
        last_crawled_at: string | null;
      } | null;
    };

  if (!article) notFound();

  return (
    <PageShell variant="content" title={article.title}>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/">Projects</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/procore-docs">Procore Docs</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {article.breadcrumb?.filter(Boolean).map((segment) => (
            <React.Fragment key={segment}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{segment}</BreadcrumbPage>
              </BreadcrumbItem>
            </React.Fragment>
          ))}
          {!article.breadcrumb?.length && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{article.title}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>

      {/* Back + external link row */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 text-muted-foreground" asChild>
          <Link href="/procore-docs">
            <ArrowLeft />
            Back to docs
          </Link>
        </Button>
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowRight className="h-3 w-3" />
          View on Procore
        </a>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-2">
        {article.category && (
          <Badge variant="secondary" className="text-xs">
            {article.category}
          </Badge>
        )}
        {article.subcategory && article.subcategory !== article.category && (
          <Badge variant="outline" className="text-xs">
            {article.subcategory}
          </Badge>
        )}
        {article.word_count && (
          <span className="text-xs text-muted-foreground">
            {Math.ceil(article.word_count / 200)} min read
          </span>
        )}
      </div>

      {/* Description */}
      {article.description && (
        <p className="max-w-2xl text-sm text-muted-foreground leading-relaxed">
          {article.description}
        </p>
      )}

      {/* Article content */}
      <div className="max-w-none">
        {article.markdown_content ? (
          <MessageResponse className="text-sm leading-relaxed">
            {article.markdown_content}
          </MessageResponse>
        ) : (
          <p className="text-sm text-muted-foreground">
            No content available. View the full article on{" "}
            <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
              Procore&apos;s documentation site
            </a>
            .
          </p>
        )}
      </div>

      {/* Tags */}
      {article.tags && article.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-8 pt-6">
          {article.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs font-normal">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </PageShell>
  );
}

export async function generateMetadata({ params }: Props) {
  const { slug: slugParts } = await params;
  const slug = slugParts.join("/");
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("support_articles")
    .select("title, description")
    .eq("slug", slug)
    .single() as { data: { title: string; description: string | null } | null };

  if (!data) return {};
  return {
    title: `${data.title} — Procore Docs`,
    description: data.description ?? undefined,
  };
}
