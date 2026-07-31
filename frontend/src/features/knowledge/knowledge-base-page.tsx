"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  BookOpen,
  Briefcase,
  Building2,
  CalendarDays,
  FileText,
  HardHat,
  List,
  Receipt,
  Settings,
  Shield,
  Users,
  X,
} from "lucide-react";

import { Button, EmptyState } from "@/components/ds";
import { ExpandableSearch } from "@/components/tables/unified/table-toolbar";
import { PageShell, SectionRuleHeading } from "@/components/layout";
import {
  useKnowledgeDocuments,
  type KnowledgeDocument,
} from "@/hooks/use-knowledge-documents";
import { useCurrentUserProfile } from "@/hooks/use-current-user-profile";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { KnowledgeMobileContextBar } from "./knowledge-mobile-context-bar";

const COMPANY_CATEGORY_ORDER = [
  "Company Policies",
  "HR & Onboarding",
  "Finance & Accounting",
  "Contracts",
  "Field Operations",
  "Meetings",
  "Notion & Tools",
  "Project Management",
  "Templates",
  "Other",
] as const;

type CompanyCategory = (typeof COMPANY_CATEGORY_ORDER)[number];

const COMPANY_CATEGORY_ICONS: Record<CompanyCategory, React.ReactNode> = {
  "Company Policies": <Shield className="h-4 w-4" />,
  "HR & Onboarding": <Users className="h-4 w-4" />,
  "Finance & Accounting": <Receipt className="h-4 w-4" />,
  Contracts: <FileText className="h-4 w-4" />,
  "Field Operations": <HardHat className="h-4 w-4" />,
  Meetings: <CalendarDays className="h-4 w-4" />,
  "Notion & Tools": <Briefcase className="h-4 w-4" />,
  "Project Management": <Building2 className="h-4 w-4" />,
  Templates: <BookOpen className="h-4 w-4" />,
  Other: <FileText className="h-4 w-4" />,
};

const COMPANY_CATEGORY_DESCRIPTIONS: Record<CompanyCategory, string> = {
  "Company Policies":
    "Policies, safety requirements, compliance notes, and handbook material.",
  "HR & Onboarding":
    "People operations, onboarding steps, benefits, and internal team guidance.",
  "Finance & Accounting":
    "Billing, AR/AP, expense policies, and accounting procedures.",
  Contracts: "Agreement templates, subcontract references, NDAs, and contract standards.",
  "Field Operations":
    "Site procedures, field standards, safety practices, and equipment references.",
  Meetings: "Meeting notes, recurring agendas, decision records, and follow-up references.",
  "Notion & Tools": "Internal tooling guides, workspace notes, and operational SOPs.",
  "Project Management": "Project setup, scheduling, PM workflows, and execution standards.",
  Templates: "Reusable forms, letters, RFI templates, and standard correspondence.",
  Other: "Reference material that does not fit a primary knowledge topic.",
};

const PAGE_SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "topics", label: "Topics" },
] as const;

export interface KnowledgeCategoryConfig {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  href?: string;
}

export interface KnowledgeSourceItem {
  id: string;
  categoryId: string;
  title: string;
  description: string;
  meta: string;
  href?: string;
  sourceDoc?: KnowledgeDocument;
}

function deriveCompanyCategory(doc: KnowledgeDocument): CompanyCategory {
  const first = doc.tags?.[0]?.trim();
  return first && (COMPANY_CATEGORY_ORDER as readonly string[]).includes(first)
    ? (first as CompanyCategory)
    : "Other";
}

export function KnowledgeBasePage() {
  const { data: documents = [], isLoading } = useKnowledgeDocuments();
  const { profile } = useCurrentUserProfile();

  const categories = React.useMemo<KnowledgeCategoryConfig[]>(
    () =>
      COMPANY_CATEGORY_ORDER.map((category) => ({
        id: category,
        label: category,
        description: COMPANY_CATEGORY_DESCRIPTIONS[category],
        icon: COMPANY_CATEGORY_ICONS[category],
      })),
    [],
  );

  const items = React.useMemo<KnowledgeSourceItem[]>(
    () =>
      documents.map((doc) => {
        const date = doc.date ?? doc.created_at;
        return {
          id: doc.id,
          categoryId: deriveCompanyCategory(doc),
          title: doc.title ?? doc.file_name ?? "Untitled",
          description: doc.file_name ?? "Knowledge source",
          meta: [date ? new Date(date).toLocaleDateString() : null, doc.source]
            .filter(Boolean)
            .join(" · "),
          sourceDoc: doc,
        };
      }),
    [documents],
  );

  return (
    <KnowledgeBrowsePage
      actionHref={profile?.isAdmin === true ? "/knowledge/manage" : null}
      actionIcon={<Settings className="h-4 w-4" />}
      actionLabel="Add knowledge"
      categories={categories}
      emptyDescription="Admins can add approved knowledge from the source manager."
      emptyTitle="No knowledge entries yet"
      eyebrow="Product knowledge"
      isAdmin={profile?.isAdmin === true}
      isLoading={isLoading}
      items={items}
      modeLabel="Product"
      navLabel="All knowledge"
      overviewDescription="Search approved internal sources, browse by topic, and open the documents Ask Alleato can cite when it answers operational questions."
      searchPlaceholder="Search knowledge..."
      showCategoriesWhenEmpty={false}
      sourceListNoun="sources"
      title="Alleato Knowledge Base"
      topBarLabel="Knowledge"
    />
  );
}

export function KnowledgeBrowsePage({
  actionHref,
  actionIcon,
  actionLabel,
  activeCategoryId,
  categories,
  emptyDescription,
  emptyTitle,
  eyebrow,
  isAdmin,
  isLoading,
  items,
  modeLabel,
  navLabel,
  overviewDescription,
  searchPlaceholder,
  showCategoriesWhenEmpty = false,
  sideNavSlot,
  sourceListNoun,
  title,
  topBarLabel,
  withShell = true,
}: {
  actionHref: string | null;
  actionIcon: React.ReactNode;
  actionLabel: string;
  activeCategoryId?: string;
  categories: readonly KnowledgeCategoryConfig[];
  emptyDescription: string;
  emptyTitle: string;
  eyebrow: string;
  isAdmin: boolean;
  isLoading: boolean;
  items: readonly KnowledgeSourceItem[];
  modeLabel: string;
  navLabel: string;
  overviewDescription: string;
  searchPlaceholder: string;
  showCategoriesWhenEmpty?: boolean;
  /** Replaces the default topic nav (left column) when provided. */
  sideNavSlot?: React.ReactNode;
  sourceListNoun: string;
  title: string;
  topBarLabel: string;
  withShell?: boolean;
}) {
  const [search, setSearch] = React.useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string | null>(
    activeCategoryId ?? null,
  );
  const [openingDocumentId, setOpeningDocumentId] = React.useState<string | null>(null);
  const [openError, setOpenError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setSelectedCategoryId(activeCategoryId ?? null);
  }, [activeCategoryId]);

  const categoryCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      counts[item.categoryId] = (counts[item.categoryId] ?? 0) + 1;
    }
    return counts;
  }, [items]);

  const visibleCategories = React.useMemo(
    () =>
      categories.filter(
        (category) => category.href || (categoryCounts[category.id] ?? 0) > 0,
      ),
    [categories, categoryCounts],
  );

  const searchTerm = search.trim().toLowerCase();
  const displayCategories = React.useMemo(() => {
    if (!searchTerm) return visibleCategories;

    return visibleCategories.filter((category) => {
      if (
        category.label.toLowerCase().includes(searchTerm) ||
        category.description.toLowerCase().includes(searchTerm)
      ) {
        return true;
      }

      return items.some((item) => {
        if (item.categoryId !== category.id) return false;
        return [item.title, item.description, item.meta]
          .join(" ")
          .toLowerCase()
          .includes(searchTerm);
      });
    });
  }, [items, searchTerm, visibleCategories]);

  const matchingItems = React.useMemo(() => {
    return items.filter((item) => {
      if (selectedCategoryId && item.categoryId !== selectedCategoryId) return false;
      if (!searchTerm) return Boolean(selectedCategoryId);

      const category = categories.find((candidate) => candidate.id === item.categoryId);
      const haystack = [
        item.title,
        item.description,
        item.meta,
        category?.label,
        category?.description,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(searchTerm);
    });
  }, [categories, items, searchTerm, selectedCategoryId]);

  const selectedCategory = categories.find(
    (category) => category.id === selectedCategoryId,
  );

  async function handleOpenDocument(item: KnowledgeSourceItem) {
    if (item.href) return;
    if (!item.sourceDoc) return;

    setOpenError(null);
    setOpeningDocumentId(item.id);

    try {
      const response = await apiFetch<{ url?: string }>(
        `/api/knowledge/signed-url?id=${encodeURIComponent(item.sourceDoc.id)}`,
      );

      if (!response.url) {
        throw new Error("No document URL was returned.");
      }

      window.open(response.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error.";
      setOpenError(`Could not open ${item.title}: ${message}`);
    } finally {
      setOpeningDocumentId(null);
    }
  }

  const content = (
    <div className="space-y-6">
      <DocsTopBar
        actionHref={isAdmin ? actionHref : null}
        actionIcon={actionIcon}
        actionLabel={actionLabel}
        modeLabel={modeLabel}
        search={search}
        searchPlaceholder={searchPlaceholder}
        topBarLabel={topBarLabel}
        onSearchChange={setSearch}
      />
      <KnowledgeMobileContextBar
        className={withShell ? "-mt-6" : undefined}
        currentLabel={selectedCategory ? `${selectedCategory.label} Training Docs` : title}
        rootLabel={modeLabel === "Product" ? "Company Knowledge" : modeLabel}
        onOpenMenu={() => setMobileMenuOpen(true)}
      />
      <KnowledgeMobileDrawer
        activeCategoryId={selectedCategoryId}
        categories={visibleCategories}
        counts={categoryCounts}
        headingLabel={modeLabel === "Product" ? "Company Knowledge" : modeLabel}
        isOpen={mobileMenuOpen}
        navLabel={navLabel}
        totalCount={items.length}
        onClose={() => setMobileMenuOpen(false)}
        onSelect={setSelectedCategoryId}
      />

      <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[15rem_minmax(0,48rem)_13rem] xl:gap-16">
        {sideNavSlot ?? (
          <KnowledgeTopicNav
            activeCategoryId={selectedCategoryId}
            categories={visibleCategories}
            counts={categoryCounts}
            headingLabel={modeLabel === "Product" ? "Product" : modeLabel}
            navLabel={navLabel}
            totalCount={items.length}
            onSelect={setSelectedCategoryId}
          />
        )}

        <main className="min-w-0 space-y-10">
          <section id="overview" className="scroll-mt-24 space-y-4">
            <div className="space-y-3">
              <p className="text-sm font-semibold text-primary">{eyebrow}</p>
              <h1 className="text-3xl font-semibold leading-tight tracking-normal text-foreground md:text-4xl">
                {selectedCategory ? `${selectedCategory.label} Training Docs` : title}
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                {selectedCategory
                  ? selectedCategory.description
                  : overviewDescription}
              </p>
            </div>
          </section>

          {isLoading ? (
            <KnowledgeDocsSkeleton />
          ) : items.length === 0 && !showCategoriesWhenEmpty ? (
            <EmptyState
              icon={<BookOpen className="h-5 w-5" />}
              title={emptyTitle}
              description={emptyDescription}
            />
          ) : (
            <>
              {!selectedCategory ? (
                <TopicCards
                  categories={displayCategories}
                  counts={categoryCounts}
                  hasFilter={Boolean(searchTerm)}
                  onClearFilters={() => {
                    setSearch("");
                    setSelectedCategoryId(activeCategoryId ?? null);
                  }}
                  onSelect={setSelectedCategoryId}
                />
              ) : null}
              <KnowledgeSourceList
                documents={matchingItems}
                activeCategoryLabel={selectedCategory?.label ?? null}
                hasFilter={Boolean(searchTerm || selectedCategoryId)}
                openingDocumentId={openingDocumentId}
                openError={openError}
                sourceListNoun={sourceListNoun}
                onOpenDocument={handleOpenDocument}
              />
            </>
          )}
        </main>

        <OnThisPage actionHref={isAdmin ? actionHref : null} actionLabel={actionLabel} />
      </div>
    </div>
  );

  if (!withShell) return content;

  return (
    <PageShell
      variant="detailWide"
      title={title}
      showHeader={false}
      contentClassName="mx-auto max-w-screen-2xl"
    >
      {content}
    </PageShell>
  );
}

function DocsTopBar({
  actionHref,
  actionIcon,
  actionLabel,
  modeLabel,
  search,
  searchPlaceholder,
  topBarLabel,
  onSearchChange,
}: {
  actionHref: string | null;
  actionIcon: React.ReactNode;
  actionLabel: string;
  modeLabel: string;
  search: string;
  searchPlaceholder: string;
  topBarLabel: string;
  onSearchChange: (value: string) => void;
}) {
  return (
    <header className="hidden flex-col gap-4 pb-4 lg:flex lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <BookOpen className="h-4 w-4 text-primary" />
          {topBarLabel}
        </div>
        <nav aria-label="Knowledge views" className="hidden items-center gap-5 text-sm lg:flex">
          <span className="font-medium text-foreground">{modeLabel}</span>
          <Link href="/knowledge/manage" className="text-muted-foreground hover:text-foreground">
            Sources
          </Link>
        </nav>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="w-full sm:w-auto">
          <ExpandableSearch
            ariaLabel={searchPlaceholder}
            defaultExpanded
            placeholder={searchPlaceholder}
            value={search}
            onChange={onSearchChange}
          />
        </div>
        {actionHref ? (
          <Button asChild variant="ghost" size="sm" className="justify-start gap-1.5">
            <Link href={actionHref}>
              {actionIcon}
              {actionLabel}
            </Link>
          </Button>
        ) : null}
      </div>
    </header>
  );
}

function KnowledgeTopicNav({
  activeCategoryId,
  categories,
  counts,
  headingLabel,
  navLabel,
  totalCount,
  onSelect,
}: {
  activeCategoryId: string | null;
  categories: readonly KnowledgeCategoryConfig[];
  counts: Record<string, number>;
  headingLabel: string;
  navLabel: string;
  totalCount: number;
  onSelect: (categoryId: string | null) => void;
}) {
  return (
    <aside className="hidden lg:block">
      <nav aria-label="Knowledge topics" className="sticky top-6 space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">{headingLabel}</p>
          <TopicButton
            label={navLabel}
            count={totalCount}
            isActive={activeCategoryId === null}
            onClick={() => onSelect(null)}
          />
          {categories.map((category) => (
            <TopicButton
              key={category.id}
              href={category.href}
              label={category.label}
              count={counts[category.id] ?? 0}
              isActive={activeCategoryId === category.id}
              onClick={() => onSelect(category.id)}
              icon={category.icon}
            />
          ))}
        </div>
      </nav>
    </aside>
  );
}

function KnowledgeMobileDrawer({
  activeCategoryId,
  categories,
  counts,
  headingLabel,
  isOpen,
  navLabel,
  totalCount,
  onClose,
  onSelect,
}: {
  activeCategoryId: string | null;
  categories: readonly KnowledgeCategoryConfig[];
  counts: Record<string, number>;
  headingLabel: string;
  isOpen: boolean;
  navLabel: string;
  totalCount: number;
  onClose: () => void;
  onSelect: (categoryId: string | null) => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex lg:hidden">
      <aside className="h-full w-10/12 max-w-sm overflow-y-auto bg-background px-6 py-8 shadow-sm">
        <div className="mb-8 space-y-8">
          <Image
            src="/Alleato-Group-Logo_Dark.png"
            alt="Alleato"
            width={104}
            height={23}
            priority
            className="h-auto w-28 dark:invert"
            style={{ height: "auto" }}
          />
          <div className="text-sm font-semibold text-foreground">{headingLabel}</div>
        </div>
        <nav aria-label="Mobile knowledge topics" className="space-y-2 text-lg">
          <MobileTopicLink
            label={navLabel}
            count={totalCount}
            isActive={activeCategoryId === null}
            onClick={() => {
              onSelect(null);
              onClose();
            }}
          />
          {categories.map((category) => (
            <MobileTopicLink
              key={category.id}
              href={category.href}
              label={category.label}
              count={counts[category.id] ?? 0}
              isActive={activeCategoryId === category.id}
              onClick={() => {
                onSelect(category.id);
                onClose();
              }}
            />
          ))}
        </nav>
      </aside>
      <div className="relative min-w-16 flex-1 bg-foreground/20 backdrop-blur-[2px]">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Close knowledge menu"
          onClick={onClose}
          className="absolute right-4 top-8 h-12 w-12 rounded-full bg-background text-muted-foreground shadow-sm"
        >
          <X className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}

function TopicButton({
  label,
  count,
  isActive,
  onClick,
  href,
  icon,
}: {
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
  href?: string;
  icon?: React.ReactNode;
}) {
  const className = cn(
    "flex h-auto min-h-10 w-full justify-between gap-3 whitespace-normal rounded-md px-3 py-2 text-left text-sm transition-colors",
    isActive
      ? "bg-primary/10 font-medium text-primary"
      : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );

  const content = (
    <>
      <span className="flex min-w-0 items-center gap-2">
        {icon && <span className="shrink-0">{icon}</span>}
        <span className="truncate">{label}</span>
      </span>
      <span className="shrink-0 text-xs tabular-nums">{count}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className} onClick={onClick}>
        {content}
      </Link>
    );
  }

  return (
    <Button type="button" variant="ghost" onClick={onClick} className={className}>
      {content}
    </Button>
  );
}

function MobileTopicLink({
  label,
  count,
  isActive,
  onClick,
  href,
}: {
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
  href?: string;
}) {
  const className = cn(
    "flex min-h-12 items-start justify-between gap-3 rounded-md px-4 py-3 text-left transition-colors",
    isActive
      ? "bg-primary/10 font-medium text-primary"
      : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );

  const content = (
    <>
      <span>{label}</span>
      <span className="text-xs tabular-nums">{count}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className} onClick={onClick}>
        {content}
      </Link>
    );
  }

  return (
    <Button type="button" variant="ghost" onClick={onClick} className={cn(className, "h-auto w-full")}>
      {content}
    </Button>
  );
}

function TopicCards({
  categories,
  counts,
  onSelect,
  onClearFilters,
  hasFilter,
}: {
  categories: readonly KnowledgeCategoryConfig[];
  counts: Record<string, number>;
  onSelect: (categoryId: string) => void;
  onClearFilters: () => void;
  hasFilter: boolean;
}) {
  return (
    <section id="topics" className="scroll-mt-24 space-y-4">
      {categories.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-5 w-5" />}
          title="No matching topics"
          description="Try a broader phrase or clear the current filter."
          action={
            hasFilter ? (
              <Button size="sm" variant="secondary" onClick={onClearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {categories.map((category) => (
            <TopicCard
              key={category.id}
              category={category}
              count={counts[category.id] ?? 0}
              onSelect={() => onSelect(category.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function TopicCard({
  category,
  count,
  onSelect,
}: {
  category: KnowledgeCategoryConfig;
  count: number;
  onSelect: () => void;
}) {
  const className =
    "group flex h-auto min-h-36 w-full items-start justify-between gap-5 whitespace-normal rounded-lg bg-muted/45 px-5 py-5 text-left text-foreground transition-colors hover:bg-muted/70";
  const content = (
    <>
      <span className="flex min-w-0 gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-background/80 text-muted-foreground group-hover:text-primary">
          {category.icon}
        </span>
        <span className="space-y-1">
          <span className="block text-base font-semibold text-foreground group-hover:text-primary">
            {category.label}
          </span>
          <span className="block max-w-2xl text-sm leading-6 text-muted-foreground">
            {category.description}
          </span>
        </span>
      </span>
      <span className="shrink-0 rounded-md bg-background/80 px-2 py-1 text-sm tabular-nums text-muted-foreground">
        {count}
      </span>
    </>
  );

  if (category.href) {
    return (
      <Link href={category.href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <Button type="button" variant="ghost" onClick={onSelect} className={className}>
      {content}
    </Button>
  );
}

function KnowledgeSourceList({
  documents,
  activeCategoryLabel,
  hasFilter,
  openingDocumentId,
  openError,
  sourceListNoun,
  onOpenDocument,
}: {
  documents: readonly KnowledgeSourceItem[];
  activeCategoryLabel: string | null;
  hasFilter: boolean;
  openingDocumentId: string | null;
  openError: string | null;
  sourceListNoun: string;
  onOpenDocument: (item: KnowledgeSourceItem) => void;
}) {
  if (!hasFilter) return null;

  const title = activeCategoryLabel
    ? `${activeCategoryLabel} ${sourceListNoun}`
    : `Matching ${sourceListNoun}`;

  return (
    <section className="space-y-3" aria-label={title}>
      <SectionRuleHeading
        label={title}
        className="mb-0"
      />

      {openError && (
        <p role="alert" className="text-sm text-destructive">
          {openError}
        </p>
      )}

      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No approved {sourceListNoun} match the current category and search.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {documents.map((doc) => {
            const rowClassName =
              "block w-full py-3 text-left text-foreground transition-colors hover:text-primary";
            const rowContent = (
              <p className="truncate text-sm font-medium">{doc.title}</p>
            );

            if (doc.href) {
              return (
                <Link
                  key={doc.id}
                  href={doc.href}
                  target="_blank"
                  rel="noreferrer"
                  className={rowClassName}
                >
                  {rowContent}
                </Link>
              );
            }

            if (doc.sourceDoc) {
              return (
                <Button
                  key={doc.id}
                  type="button"
                  variant="ghost"
                  className="h-auto w-full justify-start rounded-none px-0 py-3 text-left text-foreground hover:bg-transparent hover:text-primary disabled:cursor-wait"
                  onClick={() => onOpenDocument(doc)}
                  disabled={openingDocumentId === doc.id}
                >
                  {rowContent}
                </Button>
              );
            }

            return (
              <div key={doc.id} className="py-3">
                {rowContent}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function OnThisPage({
  actionHref,
  actionLabel,
}: {
  actionHref: string | null;
  actionLabel: string;
}) {
  return (
    <aside className="hidden xl:block">
      <nav aria-label="On this page" className="sticky top-6 space-y-3 text-sm">
        <div className="flex items-center gap-2 font-medium text-foreground">
          <List className="h-4 w-4 text-muted-foreground" />
          On this page
        </div>
        <div className="space-y-2">
          {PAGE_SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="block text-muted-foreground hover:text-primary"
            >
              {section.label}
            </a>
          ))}
          {actionHref ? (
            <Link href={actionHref} className="block pt-2 text-primary">
              {actionLabel}
            </Link>
          ) : null}
        </div>
      </nav>
    </aside>
  );
}

function KnowledgeDocsSkeleton() {
  return (
    <div className="space-y-8" aria-label="Loading knowledge">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="min-h-36 space-y-4 rounded-lg bg-muted/45 p-5">
            <div className="h-9 w-9 animate-pulse rounded-md bg-background/80" />
            <div className="space-y-2">
              <div className="h-5 w-2/3 animate-pulse rounded-md bg-background/80" />
              <div className="h-4 w-full animate-pulse rounded-md bg-background/80" />
              <div className="h-4 w-3/4 animate-pulse rounded-md bg-background/80" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
