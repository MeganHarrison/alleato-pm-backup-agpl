import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type React from "react";

import {
  ArrowUpRight,
  BookOpen,
  Bot,
  ChevronRight,
  Code2,
  FileText,
  FolderKanban,
  LayoutList,
  Search,
  Sparkles,
  Wrench,
} from "lucide-react";

import { MarkdownRenderer } from "@/components/docs/markdown-renderer";
import { Badge, Button, EmptyState, IconBadge, Input } from "@/components/ds";
import { cn } from "@/lib/utils";
import { getHelpActionsForIds } from "@/lib/help-actions";
import {
  getHelpArticleBySlug,
  getHelpArticles,
  type HelpArticle,
} from "@/lib/help-articles";
import {
  filterTechnicalDocs,
  getTechnicalDocBySlug,
  getTechnicalDocCategories,
  getTechnicalDocs,
  type TechnicalDoc,
} from "@/lib/technical-docs";

type DocsTab = "project-tools" | "ai-features";

type TocItem = {
  id: string;
  label: string;
  level?: 2 | 3;
};

interface DocPageProps {
  params: Promise<{
    slug?: string[];
  }>;
  searchParams?: Promise<{
    q?: string;
    tab?: string;
  }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: DocPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const slug = resolvedParams.slug?.join("/") ?? "";

  if (!slug) {
    return {
      title: "Documentation",
      description: "Controlled Alleato OS application documentation",
    };
  }

  if (slug.startsWith("technical/")) {
    const technicalDoc = await getTechnicalDocBySlug(slug.replace(/^technical\//, ""));
    if (!technicalDoc) {
      return {
        title: "Documentation",
        description: "Controlled Alleato OS application documentation",
      };
    }

    return {
      title: technicalDoc.title,
      description: technicalDoc.description,
    };
  }

  const article = await getHelpArticleBySlug(slug);
  if (!article) {
    return {
      title: "Documentation",
      description: "Controlled Alleato OS application documentation",
    };
  }

  return {
    title: article.frontmatter.title,
    description: article.frontmatter.description,
  };
}

export default async function DocPage({ params, searchParams }: DocPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const slug = resolvedParams.slug?.join("/") ?? "";
  const query = resolvedSearchParams?.q?.trim() ?? "";

  const [articles, technicalDocs] = await Promise.all([
    getHelpArticles(),
    getTechnicalDocs(),
  ]);

  if (slug) {
    if (slug.startsWith("technical/")) {
      const technicalDoc = await getTechnicalDocBySlug(slug.replace(/^technical\//, ""));
      if (!technicalDoc) {
        notFound();
      }
      return (
        <TechnicalArticlePage
          doc={technicalDoc}
          articles={articles}
          technicalDocs={technicalDocs}
        />
      );
    }

    const article = await getHelpArticleBySlug(slug);
    if (!article) {
      notFound();
    }
    return (
      <ArticlePage
        article={article}
        articles={articles}
        technicalDocs={technicalDocs}
      />
    );
  }

  const activeTab = resolvedSearchParams?.tab === "ai-features" ? "ai-features" : "project-tools";
  const filteredArticles = filterArticles(articles, { query, activeTab });
  const filteredTechnicalDocs = filterTechnicalDocsByTab(
    filterTechnicalDocs(technicalDocs, query),
    activeTab,
  );

  return (
    <DocsChrome
      activeTab={activeTab}
      articles={articles}
      technicalDocs={technicalDocs}
      tocItems={getHomeToc(activeTab)}
    >
      <div className="space-y-8">
        <section id="overview" className="space-y-5">
          <div className="space-y-2">
            <Badge
              variant="active"
              className="rounded-md bg-primary/10 text-primary"
            >
              {activeTab === "project-tools" ? "Project tools" : "AI features"}
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {activeTab === "project-tools" ? "Documentation" : "AI features"}
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
              {activeTab === "project-tools"
                ? "Guides and technical references for working inside Alleato PM."
                : "A practical map of the assistant, tools, memory, models, and feedback loops that power Alleato AI."}
            </p>
          </div>

          <form action="/docs" className="flex flex-col gap-2.5 sm:flex-row">
            <input type="hidden" name="tab" value={activeTab} />
            <label className="relative flex-1 sm:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
              <span className="sr-only">Search documentation</span>
              <Input
                name="q"
                defaultValue={query}
                placeholder="Search documentation..."
                className="h-10 border-border/70 bg-background pl-9 text-sm shadow-none placeholder:text-muted-foreground/50"
              />
            </label>
            <Button
              type="submit"
              variant="outline"
              className="h-10 border-border/70 bg-background px-4 text-sm shadow-none"
            >
              Search
            </Button>
          </form>
        </section>

        {activeTab === "ai-features" && !query ? <AiOverviewCard /> : null}
        {activeTab === "project-tools" && !query ? <ProjectToolsHero /> : null}

        <section id="featured-guides" className="space-y-4">
          <SectionHeading
            title={activeTab === "project-tools" ? "Featured guides" : "AI entry points"}
            description={
              activeTab === "project-tools"
                ? "Start with the most common project workflows, then follow the related technical references."
                : "Use these references to understand how the AI stack is wired and governed."
            }
          />
          {activeTab === "project-tools" ? (
            <ArticleList articles={filteredArticles} compact />
          ) : (
            <TechnicalDocGrid docs={filteredTechnicalDocs.filter((doc) => doc.featured)} />
          )}
        </section>

        {activeTab === "project-tools" ? (
          <>
            <TechnicalDocumentationSection docs={filteredTechnicalDocs} query={query} />
            {filteredArticles.length === 0 && filteredTechnicalDocs.length === 0 ? (
              <EmptyState
                icon={<BookOpen />}
                title="No documentation found"
                description="Try a broader search phrase."
              />
            ) : null}
          </>
        ) : (
          <AiTechnicalSection docs={filteredTechnicalDocs} query={query} />
        )}
      </div>
    </DocsChrome>
  );
}

function TechnicalArticlePage({
  doc,
  articles,
  technicalDocs,
}: {
  doc: TechnicalDoc & { content: string };
  articles: HelpArticle[];
  technicalDocs: TechnicalDoc[];
}) {
  const contentWithoutTitle = doc.content.replace(/^#\s+.+\n+/, "");
  const tocItems = getTocItems(contentWithoutTitle);

  return (
    <DocsChrome
      activeTab={isAiTechnicalDoc(doc) ? "ai-features" : "project-tools"}
      articles={articles}
      technicalDocs={technicalDocs}
      currentHref={doc.href}
      tocItems={tocItems}
    >
      <article className="space-y-6">
        <div className="space-y-3 border-b border-border pb-6">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Link href="/docs" className="transition hover:text-foreground">
              Documentation
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span>{doc.category}</span>
          </div>
          <div className="space-y-2">
            <Badge variant="outline" className="rounded-md">
              {doc.sourcePath}
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {doc.title}
            </h1>
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
              {doc.description}
            </p>
          </div>
        </div>

        <MarkdownRenderer content={contentWithoutTitle} />
      </article>
    </DocsChrome>
  );
}

function ArticlePage({
  article,
  articles,
  technicalDocs,
}: {
  article: HelpArticle;
  articles: HelpArticle[];
  technicalDocs: TechnicalDoc[];
}) {
  const actions = getHelpActionsForIds(article.frontmatter.related_actions);
  const tocItems = getTocItems(article.content);

  return (
    <DocsChrome
      activeTab={isAiHelpArticle(article) ? "ai-features" : "project-tools"}
      articles={articles}
      technicalDocs={technicalDocs}
      currentHref={article.href}
      tocItems={tocItems}
    >
      <article className="space-y-8">
        <MarkdownRenderer content={article.content} />

        {actions.length > 0 ? (
          <section id="ai-action-readiness" className="space-y-4 border-t border-border pt-6">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                AI Action Readiness
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The assistant can use this guide now. Write actions remain gated
                until their preview and confirmation tools are ready.
              </p>
            </div>
            <div className="divide-y divide-border border-y border-border">
              {actions.map((action) => (
                <div
                  key={action.id}
                  className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
                >
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium text-foreground">
                      {action.label}
                    </h3>
                    <p className="max-w-2xl text-sm text-muted-foreground">
                      {action.description}
                    </p>
                    {action.unavailableReason ? (
                      <p className="max-w-2xl text-xs text-muted-foreground">
                        {action.unavailableReason}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <span className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
                      {formatActionStatus(action.status)}
                    </span>
                    <span className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
                      {formatSafetyLevel(action.safetyLevel)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </article>
    </DocsChrome>
  );
}

function DocsChrome({
  activeTab,
  articles,
  technicalDocs,
  currentHref,
  tocItems,
  children,
}: {
  activeTab: DocsTab;
  articles: HelpArticle[];
  technicalDocs: TechnicalDoc[];
  currentHref?: string;
  tocItems: TocItem[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <div className="border-b border-border/70 bg-background">
        <div className="mx-auto flex w-full max-w-screen-2xl items-center gap-8 px-4 sm:px-6 lg:px-8">
          <nav className="flex min-h-12 items-end gap-6 overflow-x-auto" aria-label="Documentation sections">
            <DocsTabLink href="/docs" active={activeTab === "project-tools"}>
              Project tools
            </DocsTabLink>
            <DocsTabLink href="/docs?tab=ai-features" active={activeTab === "ai-features"}>
              AI features
            </DocsTabLink>
          </nav>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-screen-2xl flex-1 content-start grid-cols-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:px-8 xl:grid-cols-[16rem_minmax(0,48rem)_14rem]">
        <DocsSidebar
          activeTab={activeTab}
          articles={articles}
          technicalDocs={technicalDocs}
          currentHref={currentHref}
        />
        <main className="min-w-0">{children}</main>
        <DocsToc items={tocItems} />
      </div>
    </div>
  );
}

function DocsTabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "relative inline-flex min-h-12 items-center whitespace-nowrap text-sm font-medium transition-colors",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
      aria-current={active ? "page" : undefined}
    >
      {children}
      <span
        className={cn(
          "absolute bottom-0 left-0 right-0 h-0.5 rounded-full",
          active ? "bg-emerald-600" : "bg-transparent",
        )}
      />
    </Link>
  );
}

function DocsSidebar({
  activeTab,
  articles,
  technicalDocs,
  currentHref,
}: {
  activeTab: DocsTab;
  articles: HelpArticle[];
  technicalDocs: TechnicalDoc[];
  currentHref?: string;
}) {
  const projectArticles = articles.filter((article) => !isAiHelpArticle(article));
  const aiDocs = technicalDocs.filter(isAiTechnicalDoc).slice(0, 10);
  const projectCategories = groupArticlesByCategory(projectArticles).slice(0, 5);

  return (
    <aside className="hidden min-w-0 lg:block">
      <div className="sticky top-6 space-y-8">
        <div className="space-y-1">
          <SidebarTopLink href="/docs" active={activeTab === "project-tools"} icon={<FolderKanban />}>
            Project tools
          </SidebarTopLink>
          <SidebarTopLink href="/docs?tab=ai-features" active={activeTab === "ai-features"} icon={<Bot />}>
            AI features
          </SidebarTopLink>
        </div>

        {activeTab === "project-tools" ? (
          <div className="space-y-6">
            {projectCategories.map((category) => (
              <div key={category.name} className="space-y-2">
                <h2 className="px-2 text-xs font-semibold text-foreground">
                  {category.name}
                </h2>
                <div className="space-y-1">
                  {category.articles.slice(0, 6).map((article) => (
                    <SidebarDocLink
                      key={article.href}
                      href={article.href}
                      active={currentHref === article.href}
                    >
                      {article.frontmatter.title}
                    </SidebarDocLink>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            <h2 className="px-2 text-xs font-semibold text-foreground">
              AI features
            </h2>
            <SidebarDocLink href="/docs/ai-overview" active={currentHref === "/docs/ai-overview"}>
              AI overview
            </SidebarDocLink>
            {aiDocs.map((doc) => (
              <SidebarDocLink key={doc.href} href={doc.href} active={currentHref === doc.href}>
                {doc.title}
              </SidebarDocLink>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function SidebarTopLink({
  href,
  active,
  icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-10 items-center gap-3 rounded-md px-2 text-sm font-medium transition-colors",
        active ? "bg-emerald-50 text-emerald-700" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-md [&>svg]:h-3.5 [&>svg]:w-3.5",
          active ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground",
        )}
      >
        {icon}
      </span>
      {children}
    </Link>
  );
}

function SidebarDocLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-md px-2 py-1.5 text-sm leading-5 transition-colors",
        active ? "bg-emerald-50 font-medium text-emerald-700" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

function DocsToc({ items }: { items: TocItem[] }) {
  if (items.length === 0) return <aside className="hidden xl:block" />;

  return (
    <aside className="hidden xl:block">
      <div className="sticky top-6 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <LayoutList className="h-4 w-4 text-muted-foreground" />
          On this page
        </div>
        <nav className="space-y-1" aria-label="On this page">
          {items.map((item) => (
            <a
              key={`${item.id}-${item.label}`}
              href={`#${item.id}`}
              className={cn(
                "block rounded-md py-1 text-sm transition-colors hover:text-foreground",
                item.level === 3 ? "pl-3 text-muted-foreground" : "text-muted-foreground",
              )}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </aside>
  );
}

function ProjectToolsHero() {
  return (
    <section id="project-tool-map" className="overflow-hidden rounded-lg border border-border/70 bg-muted/30">
      <div className="grid gap-0 md:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4 p-6 sm:p-7">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Wrench className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              Find the tool, then follow the workflow
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              The left rail keeps core project documentation nearby while the
              right rail tracks sections inside the guide you are reading.
            </p>
          </div>
        </div>
        <div className="border-t border-border/70 p-6 md:border-l md:border-t-0">
          <div className="space-y-3">
            {["Budget", "Commitments", "Change management"].map((label) => (
              <div key={label} className="flex items-center gap-3 rounded-md bg-background px-3 py-2 text-sm">
                <span className="h-2 w-2 rounded-full bg-primary" />
                <span className="font-medium text-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function AiOverviewCard() {
  return (
    <Link
      id="ai-overview"
      href="/docs/ai-overview"
      className="group block rounded-lg border border-border/70 bg-muted/30 p-6 transition-colors hover:bg-muted/50 sm:p-7"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-foreground transition-colors group-hover:text-primary">
                How the AI works
              </h2>
              <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase text-primary">
                New
              </span>
            </div>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              A guided tour of the agents, tools, models, memory, and feedback loops behind the
              assistant. Built for stakeholders.
            </p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground">
          Take the tour
          <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      </div>
    </Link>
  );
}

function TechnicalDocumentationSection({
  docs,
  query,
}: {
  docs: TechnicalDoc[];
  query: string;
}) {
  if (docs.length === 0) return null;

  const featuredDocs = docs.filter((doc) => doc.featured);
  const categories = getTechnicalDocCategories(docs);

  return (
    <section id="technical-references" className="space-y-6">
      <SectionHeading
        title="Technical references"
        description="Engineering references for architecture, APIs, data contracts, design standards, and implementation guardrails."
      />

      {!query && featuredDocs.length > 0 ? (
        <TechnicalDocGrid docs={featuredDocs} featured />
      ) : null}

      <div className="space-y-8">
        {categories.map((category) => (
          <section key={category.name} className="space-y-3">
            <div className="flex flex-col gap-1 border-b border-border pb-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  {category.name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {category.description}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                {category.docs.length}
              </span>
            </div>

            <TechnicalDocGrid docs={category.docs} />
          </section>
        ))}
      </div>
    </section>
  );
}

function AiTechnicalSection({
  docs,
  query,
}: {
  docs: TechnicalDoc[];
  query: string;
}) {
  if (docs.length === 0) {
    return (
      <EmptyState
        icon={<Bot />}
        title="No AI documentation found"
        description={query ? "Try a broader search phrase." : "AI documentation has not been indexed yet."}
      />
    );
  }

  return (
    <section id="ai-reference-library" className="space-y-6">
      <SectionHeading
        title="AI reference library"
        description="Architecture, RAG, tool inventory, evaluation, memory, and source-pipeline references."
      />
      <TechnicalDocGrid docs={docs} />
    </section>
  );
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-1 border-b border-border pb-3">
      <h2 className="text-base font-semibold text-foreground">
        {title}
      </h2>
      <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function TechnicalDocGrid({
  docs,
  featured = false,
}: {
  docs: TechnicalDoc[];
  featured?: boolean;
}) {
  if (docs.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
      {docs.map((doc) => (
        <TechnicalDocLink key={doc.href} doc={doc} featured={featured || doc.featured} />
      ))}
    </div>
  );
}

function TechnicalDocLink({
  doc,
  featured = false,
}: {
  doc: TechnicalDoc;
  featured?: boolean;
}) {
  return (
    <Link
      href={doc.href}
      className="group -mx-3 flex min-h-12 items-start gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted"
    >
      <IconBadge size="sm" className="mt-0.5 bg-primary/10 text-primary">
        <Code2 className="h-3.5 w-3.5" />
      </IconBadge>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-medium text-foreground transition-colors group-hover:text-primary">
            {doc.title}
          </h3>
          {featured ? (
            <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase text-primary">
              Key
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {doc.description}
        </p>
        <p className="mt-1 truncate text-[11px] text-muted-foreground/70">
          {doc.sourcePath}
        </p>
      </div>
      <ChevronRight className="mt-2 h-3.5 w-3.5 shrink-0 text-muted-foreground/20 transition-all group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
    </Link>
  );
}

function ArticleList({
  articles,
  compact = false,
}: {
  articles: HelpArticle[];
  compact?: boolean;
}) {
  const categories = groupArticlesByCategory(articles);

  if (articles.length === 0) {
    return (
      <EmptyState
        icon={<FileText />}
        title="No guides found"
        description="Try a broader search phrase."
      />
    );
  }

  return (
    <div className={compact ? "space-y-8" : "space-y-10"}>
      {categories.map((category) => (
        <section key={category.name} className="space-y-3">
          <div className="flex items-baseline justify-between border-b border-border pb-2">
            <h2 className="text-sm font-semibold text-foreground">
              {category.name}
            </h2>
            <span className="text-xs text-muted-foreground">
              {category.articles.length}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
            {category.articles.map((article) => (
              <Link
                key={article.slug}
                href={article.href}
                className="group -mx-3 flex min-h-12 items-start gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted"
              >
                <IconBadge size="sm" className="mt-0.5 bg-primary/10 text-primary">
                  <FileText className="h-3.5 w-3.5" />
                </IconBadge>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                    {article.frontmatter.title}
                  </h3>
                  <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {article.frontmatter.description}
                  </p>
                </div>
                <ChevronRight className="mt-2 h-3.5 w-3.5 shrink-0 text-muted-foreground/20 transition-all group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function groupArticlesByCategory(articles: HelpArticle[]) {
  const groups = new Map<string, HelpArticle[]>();

  for (const article of articles) {
    const category = article.frontmatter.category;
    groups.set(category, [...(groups.get(category) ?? []), article]);
  }

  return Array.from(groups.entries()).map(([name, groupedArticles]) => ({
    name,
    articles: groupedArticles,
  }));
}

function filterArticles(
  articles: HelpArticle[],
  filters: { query: string; activeTab: DocsTab },
) {
  const query = filters.query.toLowerCase();
  return articles.filter((article) => {
    if (filters.activeTab === "ai-features" && !isAiHelpArticle(article)) return false;
    if (filters.activeTab === "project-tools" && isAiHelpArticle(article)) return false;
    if (!query) return true;

    const searchable = [
      article.frontmatter.title,
      article.frontmatter.description,
      article.frontmatter.category,
      article.frontmatter.module,
      article.frontmatter.tags.join(" "),
      article.content,
    ]
      .join(" ")
      .toLowerCase();

    return searchable.includes(query);
  });
}

function filterTechnicalDocsByTab(docs: TechnicalDoc[], activeTab: DocsTab) {
  if (activeTab === "ai-features") {
    return docs.filter(isAiTechnicalDoc);
  }

  return docs.filter((doc) => !isAiTechnicalDoc(doc));
}

function isAiHelpArticle(article: HelpArticle) {
  return article.section === "ai-features";
}

function isAiTechnicalDoc(doc: TechnicalDoc) {
  const tokens = [
    doc.category,
    doc.title,
    doc.description,
    doc.sourcePath,
  ].join(" ").toLowerCase();

  return tokens.includes("ai") || tokens.includes("rag") || tokens.includes("assistant");
}

function getHomeToc(activeTab: DocsTab): TocItem[] {
  if (activeTab === "ai-features") {
    return [
      { id: "overview", label: "Overview" },
      { id: "ai-overview", label: "How the AI works" },
      { id: "featured-guides", label: "AI entry points" },
      { id: "ai-reference-library", label: "Reference library" },
    ];
  }

  return [
    { id: "overview", label: "Overview" },
    { id: "project-tool-map", label: "Project tool map" },
    { id: "featured-guides", label: "Featured guides" },
    { id: "technical-references", label: "Technical references" },
  ];
}

function getTocItems(content: string): TocItem[] {
  const seen = new Set<string>();
  const items: TocItem[] = [];

  for (const line of content.split("\n")) {
    if (items.length >= 12) break;

      const match = /^(#{2,3})\s+(.+)$/.exec(line.trim());
    if (!match) continue;

      const label = match[2].replace(/[#*_`]/g, "").trim();
      const baseId = slugifyHeading(label);
      const id = seen.has(baseId) ? `${baseId}-${seen.size + 1}` : baseId;
      seen.add(id);

    items.push({
      id,
      label,
      level: match[1].length as 2 | 3,
    });
  }

  return items;
}

function slugifyHeading(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function formatActionStatus(status: string): string {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatSafetyLevel(level: string): string {
  if (level === "admin_confirm") return "Admin confirm";
  if (level === "preview_confirm") return "Preview confirm";
  return "Read only";
}
