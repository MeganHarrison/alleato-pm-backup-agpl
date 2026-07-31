"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import Link from "next/link";
import {
  BarChart3,
  BookOpen,
  Briefcase,
  Calculator,
  Check,
  ChevronsUpDown,
  ClipboardList,
  DollarSign,
  FileText,
  FolderKanban,
  HardHat,
  Layers,
  LineChart,
  Package,
  PenTool,
  Receipt,
  Search,
  Settings,
  Shield,
  Sparkles,
  Users,
  Workflow,
  X,
  ChevronRight,
} from "lucide-react";

import { PageShell } from "@/components/layout";
import { SectionRuleHeading } from "@/components/layout/spacing";
import { EmptyState, IconBadge, SectionHeader } from "@/components/ds";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputActions,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Article {
  id: number;
  title: string;
  url: string;
  slug: string;
  category: string | null;
  subcategory: string | null;
  word_count: number | null;
}

// ---------------------------------------------------------------------------
// Category icons
// ---------------------------------------------------------------------------

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  // Hero card categories
  Budget: <DollarSign className="h-4 w-4" />,
  Budgeting: <DollarSign className="h-4 w-4" />,
  "Prime Contracts": <FileText className="h-4 w-4" />,
  Commitments: <ClipboardList className="h-4 w-4" />,
  "Change Events": <Layers className="h-4 w-4" />,
  "Change Orders": <FolderKanban className="h-4 w-4" />,
  Invoicing: <BarChart3 className="h-4 w-4" />,
  // Remaining DB categories
  "Admin Company": <Settings className="h-4 w-4" />,
  "Admin Project": <Shield className="h-4 w-4" />,
  Bidding: <Briefcase className="h-4 w-4" />,
  "Company Directory": <Users className="h-4 w-4" />,
  "Direct Costs": <Receipt className="h-4 w-4" />,
  Drawings: <PenTool className="h-4 w-4" />,
  "ERP Integration": <Workflow className="h-4 w-4" />,
  Equipment: <Package className="h-4 w-4" />,
  Estimating: <Calculator className="h-4 w-4" />,
  Forecasting: <LineChart className="h-4 w-4" />,
  General: <BookOpen className="h-4 w-4" />,
  Schedule: <ClipboardList className="h-4 w-4" />,
  Safety: <HardHat className="h-4 w-4" />,
};

function getCategoryIcon(category: string): React.ReactNode {
  return CATEGORY_ICONS[category] ?? <BookOpen className="h-4 w-4" />;
}

// Hero cards
const HERO_CARDS = [
  {
    title: "Budget",
    description: "Set up budgets, track costs, and manage financial health.",
    icon: <DollarSign className="h-5 w-5" />,
    category: "Budget",
  },
  {
    title: "Prime Contracts",
    description: "Create and manage owner contracts, revisions, and billing.",
    icon: <FileText className="h-5 w-5" />,
    category: "Prime Contracts",
  },
  {
    title: "Commitments",
    description: "Create and manage subcontracts, purchase orders, and more.",
    icon: <ClipboardList className="h-5 w-5" />,
    category: "Commitments",
  },
  {
    title: "Change Events",
    description:
      "Track potential changes, assess cost impact, and link to change orders.",
    icon: <Layers className="h-5 w-5" />,
    category: "Change Events",
  },
  {
    title: "Change Orders",
    description:
      "Handle contract changes, approvals, and cost impact tracking.",
    icon: <FolderKanban className="h-5 w-5" />,
    category: "Change Orders",
  },
  {
    title: "Invoicing",
    description: "Manage payment applications, billing periods, and approvals.",
    icon: <BarChart3 className="h-5 w-5" />,
    category: "Invoicing",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMessageText(
  parts: Array<{ type: string; text?: string }>
): string {
  return parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProcoreDocsPage() {
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [comboOpen, setComboOpen] = useState(false);
  const [articles, setArticles] = useState<Article[]>([]);
  const [search, setSearch] = useState("");
  const [isLoadingArticles, setIsLoadingArticles] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const [chatInput, setChatInput] = useState("");

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/procore-docs/chat" }),
  });
  // Normalizes useChat errors so users see the concrete backend failure reason.
  const chatErrorMessage = useMemo(() => {
    if (!error) return null;
    if (error instanceof Error && error.message.trim()) return error.message;
    return "Chat request failed. Check login/session, Supabase service-role access, and AI provider env vars.";
  }, [error]);

  const isStreaming = status === "streaming" || status === "submitted";
  const searchTerm = search.trim();
  const isSearching = searchTerm.length > 0;
  const showHero = !selectedCategory && !isSearching;

  // Load categories
  useEffect(() => {
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("support_articles")
      .select("category")
      .not("category", "is", null)
      .then(
        ({ data }: { data: { category: string | null }[] | null }) => {
          if (!data) return;
          const unique = [...new Set(data.map((r) => r.category as string))]
            .filter(Boolean)
            .sort();
          setCategories(unique);
        }
      );
  }, []);

  // Load articles
  useEffect(() => {
    if (!selectedCategory && !search.trim()) {
      setArticles([]);
      setIsLoadingArticles(false);
      return;
    }

    let ignore = false;
    const supabase = createClient();
    setIsLoadingArticles(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const base = (supabase as any)
      .from("support_articles")
      .select("id, title, url, slug, category, subcategory, word_count")
      .order("title")
      .limit(100);

    if (search.trim()) {
      void base
        .ilike("title", `%${search.trim()}%`)
        .then(({ data }: { data: Article[] | null }) => {
          if (ignore) return;
          setArticles((data ?? []) as Article[]);
          setIsLoadingArticles(false);
        });
    } else if (selectedCategory) {
      void base
        .eq("category", selectedCategory)
        .then(({ data }: { data: Article[] | null }) => {
          if (ignore) return;
          setArticles((data ?? []) as Article[]);
          setIsLoadingArticles(false);
        });
    }

    return () => {
      ignore = true;
    };
  }, [selectedCategory, search]);

  const handleSendMessage = useCallback(() => {
    const trimmed = chatInput.trim();
    if (!trimmed || isStreaming) return;
    setChatInput("");
    sendMessage({ text: trimmed });
  }, [chatInput, isStreaming, sendMessage]);

  const selectCategory = (cat: string | null) => {
    setSelectedCategory(cat);
    setSearch("");
    setComboOpen(false);
  };

  const groupedArticles = useMemo(() => {
    const groups: Record<string, Article[]> = {};
    for (const article of articles) {
      const key = article.subcategory || "General";
      if (!groups[key]) groups[key] = [];
      groups[key].push(article);
    }
    return groups;
  }, [articles]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <PageShell
      variant="content"
      title="Procore Documentation"
      eyebrow={
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
          <Sparkles className="h-3 w-3" />
          AI-powered documentation
        </span>
      }
      description="Guides and reference for using Procore to manage projects, track costs, and collaborate with your construction teams."
      actions={
        <Button onClick={() => setChatOpen(true)} className="h-9 gap-2">
          <Sparkles />
          Ask AI
        </Button>
      }
    >
      <div>

        {/* ─── Action bar: Search + Category combobox ─── */}
        <div className="mb-8 flex flex-wrap items-center gap-2.5">
          {/* Search */}
          <div className="relative flex-1 min-w-52 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
            <Input
              placeholder="Search documentation..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (e.target.value) setSelectedCategory(null);
              }}
              className="h-9 border-border/50 bg-card pl-9 text-sm shadow-none placeholder:text-muted-foreground/50"
            />
            {search && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground h-6 w-6 p-0"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          {/* Category combobox */}
          <Popover open={comboOpen} onOpenChange={setComboOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={comboOpen}
                className="h-9 w-48 justify-between border-border/50 bg-card text-sm font-normal shadow-none"
              >
                <span
                  className={cn(
                    "truncate",
                    !selectedCategory && "text-muted-foreground/70"
                  )}
                >
                  {selectedCategory ?? "All categories"}
                </span>
                <ChevronsUpDown className="shrink-0 text-muted-foreground/50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-0" align="start">
              <Command>
                <CommandInput placeholder="Filter categories..." />
                <CommandList>
                  <CommandEmpty>No categories found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="all-categories"
                      onSelect={() => selectCategory(null)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-3.5 w-3.5",
                          !selectedCategory ? "opacity-100" : "opacity-0"
                        )}
                      />
                      All categories
                    </CommandItem>
                    {categories.map((cat) => (
                      <CommandItem
                        key={cat}
                        value={cat}
                        onSelect={() => selectCategory(cat)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-3.5 w-3.5",
                            selectedCategory === cat
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        <span className="mr-2 text-muted-foreground/70">
                          {getCategoryIcon(cat)}
                        </span>
                        {cat}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

        </div>

        {/* ─── Content area ─── */}
        {showHero ? (
          <>
            {/* Category quick-link cards */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {HERO_CARDS.map((card) => (
                <Button
                  key={card.title}
                  type="button"
                  variant="ghost"
                  onClick={() => selectCategory(card.category)}
                  className="group relative h-auto rounded-lg bg-card p-6 text-left transition-all hover:bg-muted/60 flex flex-col items-start whitespace-normal"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <IconBadge size="md">{card.icon}</IconBadge>
                    <h3 className="text-sm font-semibold text-foreground">
                      {card.title}
                    </h3>
                  </div>
                  <p className="w-full text-xs text-muted-foreground leading-relaxed">
                    {card.description}
                  </p>
                  <ChevronRight className="absolute right-4 top-6 h-4 w-4 text-muted-foreground/30 transition-all group-hover:text-muted-foreground group-hover:translate-x-0.5" />
                </Button>
              ))}
            </div>

            {/* Tools — remaining categories */}
            {categories.length > HERO_CARDS.length && (
              <div className="mt-12">
                <SectionRuleHeading label="Tools" />
                <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
                  {categories
                    .filter(
                      (cat) =>
                        !HERO_CARDS.some((card) => card.category === cat)
                    )
                    .map((cat) => (
                      <Button
                        key={cat}
                        type="button"
                        variant="ghost"
                        onClick={() => selectCategory(cat)}
                        className="group flex h-auto items-start gap-3 text-left justify-start"
                      >
                        <IconBadge size="sm" className="mt-0.5">{getCategoryIcon(cat)}</IconBadge>
                        <div>
                          <h3 className="text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                            {cat}
                          </h3>
                          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                            Browse {cat.toLowerCase()} documentation and guides.
                          </p>
                        </div>
                      </Button>
                    ))}
                </div>
              </div>
            )}
          </>
        ) : (
          /* ─── Article list ─── */
          <>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selectedCategory && !isSearching && (
                  <IconBadge size="sm">{getCategoryIcon(selectedCategory)}</IconBadge>
                )}
                <SectionHeader
                  title={isSearching ? `Results for "${searchTerm}"` : (selectedCategory ?? "Documentation")}
                  count={articles.length}
                />
              </div>
              {(selectedCategory || isSearching) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedCategory(null);
                    setSearch("");
                  }}
                  className="text-xs text-muted-foreground"
                >
                  Clear
                </Button>
              )}
            </div>

            {isLoadingArticles ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="h-14 animate-pulse rounded-lg bg-muted/30"
                  />
                ))}
              </div>
            ) : articles.length === 0 ? (
              <EmptyState
                icon={<FileText />}
                title="No articles found"
                description={isSearching ? "Try a broader phrase or browse by category." : "Select a category to explore the documentation."}
              />
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedArticles).map(
                  ([group, groupArticles]) => (
                    <div key={group}>
                      {Object.keys(groupedArticles).length > 1 && (
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                          {group}
                        </p>
                      )}
                      <div className="space-y-px overflow-hidden rounded-lg bg-card">
                        {groupArticles.map((article) => (
                          <Link
                            key={article.id}
                            href={`/procore-docs/${article.slug ?? article.id}`}
                            className="group flex items-center justify-between px-4 py-3 transition-colors hover:bg-muted"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-primary" />
                              <div className="min-w-0">
                                <p className="truncate text-sm text-foreground transition-colors group-hover:text-primary">
                                  {article.title}
                                </p>
                                {article.subcategory &&
                                  Object.keys(groupedArticles).length <= 1 && (
                                    <p className="truncate text-[11px] text-muted-foreground/50">
                                      {article.subcategory}
                                    </p>
                                  )}
                              </div>
                            </div>
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/20 transition-all group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── AI Chat Sheet ─── */}
      <Sheet open={chatOpen} onOpenChange={setChatOpen}>
        <SheetContent
          side="right"
          className="flex min-h-0 w-full max-w-xl flex-col p-0 sm:max-w-2xl"
        >
          <SheetHeader className="bg-muted/30 px-5 py-4">
            <div className="flex items-center gap-3">
              <IconBadge size="sm"><Sparkles className="h-4 w-4" /></IconBadge>
              <div>
                <SheetTitle className="text-sm font-semibold">
                  Documentation Assistant
                </SheetTitle>
                <p className="text-xs text-muted-foreground">
                  Ask about Procore workflows and features
                </p>
              </div>
            </div>
          </SheetHeader>

          <Conversation className="min-h-0 px-5 py-4">
            <ConversationContent className="gap-4 p-0 pb-4">
              {messages.length === 0 ? (
                <ConversationEmptyState className="py-12">
                  <IconBadge size="xl" className="mx-auto mb-4 rounded-full">
                    <Sparkles className="h-5 w-5" />
                  </IconBadge>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      How can I help?
                    </p>
                    <p className="mx-auto max-w-xs text-xs leading-relaxed text-muted-foreground">
                      Ask me anything about Procore features, workflows, or best
                      practices.
                    </p>
                  </div>
                  <div className="flex w-full max-w-xs flex-col gap-2">
                    {[
                      "How do I create a budget?",
                      "What are change orders?",
                      "How do commitments work?",
                    ].map((example) => (
                      <Button
                        key={example}
                        type="button"
                        variant="outline"
                        onClick={() => setChatInput(example)}
                        className="h-auto justify-start rounded-md border-border/50 bg-background px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        {example}
                      </Button>
                    ))}
                  </div>
                </ConversationEmptyState>
              ) : (
                messages.map((message) => {
                  const text = getMessageText(message.parts);

                  return (
                    <Message key={message.id} from={message.role}>
                      <MessageContent
                        className={cn(
                          message.role === "user"
                            ? "rounded-xl bg-primary px-4 py-3 text-primary-foreground"
                            : "rounded-none bg-transparent px-0 py-0",
                        )}
                      >
                        {message.role === "assistant" ? (
                          <MessageResponse className="text-sm leading-relaxed text-foreground">
                            {text}
                          </MessageResponse>
                        ) : (
                          <p className="text-sm leading-relaxed">{text}</p>
                        )}
                      </MessageContent>
                    </Message>
                  );
                })
              )}

              {chatErrorMessage && (
                <p className="text-xs text-destructive">{chatErrorMessage}</p>
              )}

              {isStreaming && messages.at(-1)?.role !== "assistant" && (
                <Message from="assistant">
                  <MessageContent className="rounded-xl bg-muted/50 px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:300ms]" />
                    </div>
                  </MessageContent>
                </Message>
              )}
            </ConversationContent>
            <ConversationScrollButton className="bottom-4 z-20" />
          </Conversation>

          {/* Chat input */}
          <div className="bg-muted/20 px-5 py-4">
            <PromptInput
              value={chatInput}
              onValueChange={setChatInput}
              onSubmit={handleSendMessage}
              isLoading={isStreaming}
              disabled={isStreaming}
              className="rounded-xl border-border/50 bg-background p-2"
            >
              <PromptInputTextarea
                value={chatInput}
                placeholder="Ask a question..."
                className="min-h-12 px-2 py-2 text-sm"
              />
              <PromptInputActions className="justify-end">
                <PromptInputSubmit
                  disabled={!chatInput.trim() || isStreaming}
                  status={status}
                  className="h-9 w-9 shrink-0"
                />
              </PromptInputActions>
            </PromptInput>
          </div>
        </SheetContent>
      </Sheet>
    </PageShell>
  );
}
