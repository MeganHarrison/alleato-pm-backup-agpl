"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Loader2,
  FolderOpen,
  Building2,
  FileQuestion,
  FileCheck,
  GitPullRequestArrow,
  FileSignature,
  Handshake,
  PencilRuler,
  ListChecks,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, ModalContent, ModalTitle } from "@/components/ui/unified-modal";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useOptionalProject } from "@/contexts/project-context";
import { useGlobalSearch } from "@/hooks/use-global-search";
import type {
  GlobalSearchResult,
  SearchEntityKind,
} from "@/lib/search/global-search-config";
import {
  coreTools,
  projectManagementTools,
  financialManagementTools,
  companyWideHeaderTools,
  buildToolUrl,
  type NavigationTool,
} from "@/lib/navigation-config";

const KIND_ICON: Record<SearchEntityKind, LucideIcon> = {
  project: FolderOpen,
  company: Building2,
  rfi: FileQuestion,
  submittal: FileCheck,
  change_event: GitPullRequestArrow,
  prime_contract: FileSignature,
  commitment: Handshake,
  drawing: PencilRuler,
  punch_item: ListChecks,
};

/** Flat, de-duplicated tool list used for the "Go to" navigation section. */
const NAV_TOOLS: NavigationTool[] = (() => {
  const seen = new Set<string>();
  const all = [
    ...companyWideHeaderTools,
    ...coreTools,
    ...projectManagementTools,
    ...financialManagementTools,
  ];
  return all.filter((tool) => {
    // Drop role-restricted tools — this component can't evaluate those grants,
    // so surfacing them would offer links the user can't use. Module-gated
    // tools stay (most users with a project have read access).
    if (
      tool.adminOnly ||
      tool.developerOnly ||
      tool.ownerOnly ||
      tool.subcontractorOnly
    ) {
      return false;
    }
    const key = `${tool.name}:${tool.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
})();

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}

interface NavMatch {
  key: string;
  name: string;
  url: string;
  icon?: LucideIcon;
}

function matchNavTools(
  term: string,
  projectId: number | null,
  limit: number,
): NavMatch[] {
  const trimmed = term.trim().toLowerCase();
  if (trimmed.length < 1) return [];
  const matches: NavMatch[] = [];
  for (const tool of NAV_TOOLS) {
    if (!tool.name.toLowerCase().includes(trimmed)) continue;
    // Skip project-scoped tools when no project is active — the link would
    // resolve to a broken company-level path.
    if (tool.requiresProject && projectId === null) continue;
    matches.push({
      key: `${tool.name}:${tool.path}`,
      name: tool.name,
      url: buildToolUrl(tool.path, projectId, tool.requiresProject ?? true),
      icon: tool.icon,
    });
    if (matches.length >= limit) break;
  }
  return matches;
}

/** Groups flat remote results by their `groupLabel`, preserving arrival order. */
function groupResults(
  results: GlobalSearchResult[],
): { label: string; items: GlobalSearchResult[] }[] {
  const groups: { label: string; items: GlobalSearchResult[] }[] = [];
  const byLabel = new Map<string, GlobalSearchResult[]>();
  for (const result of results) {
    const existing = byLabel.get(result.groupLabel);
    if (existing) {
      existing.push(result);
    } else {
      const items = [result];
      byLabel.set(result.groupLabel, items);
      groups.push({ label: result.groupLabel, items });
    }
  }
  return groups;
}

/**
 * Site-wide search command palette. Renders a header trigger button and a
 * ⌘K / Ctrl+K dialog that searches projects, companies, and (when a project is
 * active) its RFIs, submittals, change events, contracts, drawings, and more —
 * plus quick navigation to any tool.
 */
export function GlobalSearch() {
  const router = useRouter();
  const project = useOptionalProject();
  const projectId = project?.projectId ?? null;

  const [open, setOpen] = React.useState(false);
  const [term, setTerm] = React.useState("");
  const debouncedTerm = useDebouncedValue(term, 200);

  const { results, isLoading, isError, enabled } = useGlobalSearch(
    open ? debouncedTerm : "",
    projectId,
  );

  const navMatches = React.useMemo(
    () => matchNavTools(term, projectId, 6),
    [term, projectId],
  );
  const remoteGroups = React.useMemo(() => groupResults(results), [results]);

  // ⌘K / Ctrl+K opens the palette from anywhere.
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Clear the query shortly after closing so the next open starts fresh.
  React.useEffect(() => {
    if (!open) {
      const handle = setTimeout(() => setTerm(""), 150);
      return () => clearTimeout(handle);
    }
  }, [open]);

  const handleSelect = React.useCallback(
    (url: string) => {
      setOpen(false);
      router.push(url);
    },
    [router],
  );

  const hasQuery = term.trim().length >= 1;
  const showNoResults =
    enabled &&
    !isLoading &&
    !isError &&
    remoteGroups.length === 0 &&
    navMatches.length === 0;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        aria-label="Search"
        className={cn(
          "h-8 justify-start gap-2 border-border/60 bg-background px-2.5 font-normal text-muted-foreground hover:text-foreground",
          "w-8 md:w-44 md:px-2.5 lg:w-56",
        )}
      >
        <Search className="h-4 w-4 shrink-0" strokeWidth={1.6} />
        <span className="hidden truncate text-xs md:inline">Search…</span>
        <CommandShortcut className="ml-auto hidden text-[10px] md:inline">
          ⌘K
        </CommandShortcut>
      </Button>

      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent
          size="xl"
          hideCloseButton
          className="gap-0 overflow-hidden p-0"
        >
          <ModalTitle className="sr-only">Site-wide search</ModalTitle>
          <Command shouldFilter={false} className="rounded-lg">
            <CommandInput
              value={term}
              onValueChange={setTerm}
              placeholder="Search projects, contacts, RFIs, drawings…"
            />
            <CommandList className="max-h-96">
              {!hasQuery && (
                <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                  Type to search across projects, companies, and{" "}
                  {projectId
                    ? "this project's records"
                    : "select a project to search its records"}
                  .
                </div>
              )}

              {hasQuery && showNoResults && (
                <CommandEmpty>No results found.</CommandEmpty>
              )}

              {hasQuery && enabled && isError && (
                <div className="px-4 py-6 text-center text-xs text-destructive">
                  Search is temporarily unavailable. Please try again.
                </div>
              )}

              {navMatches.length > 0 && (
                <CommandGroup heading="Go to">
                  {navMatches.map((match) => {
                    const Icon = match.icon ?? ArrowRight;
                    return (
                      <CommandItem
                        key={match.key}
                        value={`nav:${match.key}`}
                        onSelect={() => handleSelect(match.url)}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{match.name}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}

              {isLoading && (
                <div className="flex items-center gap-2 px-4 py-4 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Searching…
                </div>
              )}

              {remoteGroups.map((group, index) => {
                const showSeparator = index > 0 || navMatches.length > 0;
                return (
                  <React.Fragment key={group.label}>
                    {showSeparator && <CommandSeparator />}
                    <CommandGroup heading={group.label}>
                      {group.items.map((item) => {
                        const Icon = KIND_ICON[item.kind] ?? ArrowRight;
                        return (
                          <CommandItem
                            key={`${item.kind}:${item.id}`}
                            value={`${item.kind}:${item.id}`}
                            onSelect={() => handleSelect(item.url)}
                          >
                            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <div className="flex min-w-0 flex-col">
                              <span className="truncate">{item.title}</span>
                              {item.subtitle && (
                                <span className="truncate text-[11px] text-muted-foreground">
                                  {item.subtitle}
                                </span>
                              )}
                            </div>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </React.Fragment>
                );
              })}
            </CommandList>
          </Command>
        </ModalContent>
      </Modal>
    </>
  );
}
