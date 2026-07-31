"use client";

/**
 * RelatedItemsPanel
 *
 * Displays all linked entities for a given source entity, grouped by target type.
 * Supports adding new links via a dialog and removing existing links with an X button.
 *
 * Usage:
 *   <RelatedItemsPanel
 *     entityType="rfi"
 *     entityId={rfi.id}
 *     projectId={projectId}
 *   />
 *
 * Design rules followed:
 *   - Uses SectionCard as the outer wrapper (no hand-rolled cards)
 *   - Uses EmptyState for the empty case
 *   - Uses StatusBadge for link_type display
 *   - Uses Button from @/components/ds (never raw <button>)
 *   - Semantic color tokens only — no hex, no gray-*
 */

import * as React from "react";
import {
  Check,
  ChevronsUpDown,
  ArrowRight,
  Link as LinkIcon,
  Loader2,
  X,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/unified-modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionCard } from "@/components/ds/section-card";
import { EmptyState } from "@/components/ds/empty-state";
import { StatusBadge } from "@/components/ds/status-badge";

import {
  useRelatedItems,
  useAddRelatedItem,
  useRemoveRelatedItem,
  useEntitySearch,
} from "@/hooks/use-related-items";
import {
  ENTITY_LABEL,
  LINKABLE_TARGETS,
  LINK_TYPES,
  type EntityType,
  type LinkType,
} from "@/lib/entity-links/table-map";
import { getEntityDetailPath } from "./entity-paths";

// ── Props ─────────────────────────────────────────────────────────────────────

interface RelatedItemsPanelProps {
  entityType: EntityType;
  entityId: string;
  projectId: number;
  /**
   * Render without the SectionCard wrapper — a plain section with an uppercase
   * label, for embedding inside an existing panel (e.g. a detail sidebar) where
   * a nested bordered card would look like a card-in-a-card.
   */
  flat?: boolean;
}

// ── Add Link Dialog ───────────────────────────────────────────────────────────

interface AddLinkDialogProps {
  entityType: EntityType;
  entityId: string;
  projectId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function AddLinkDialog({
  entityType,
  entityId,
  projectId,
  open,
  onOpenChange,
}: AddLinkDialogProps) {
  const [targetType, setTargetType] = React.useState<EntityType | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [selectedTitle, setSelectedTitle] = React.useState<string>("");
  const [linkType, setLinkType] = React.useState<LinkType>("related");
  const [note, setNote] = React.useState("");

  const availableTargets = LINKABLE_TARGETS[entityType] ?? [];

  const { data: searchResults, isFetching: isSearching } = useEntitySearch(
    targetType,
    projectId,
    searchQuery,
  );

  const addMutation = useAddRelatedItem(entityType, entityId, projectId);

  function resetForm() {
    setTargetType(null);
    setSearchQuery("");
    setSearchOpen(false);
    setSelectedId(null);
    setSelectedTitle("");
    setLinkType("related");
    setNote("");
  }

  async function handleAdd() {
    if (!targetType || !selectedId) return;
    try {
      await addMutation.mutateAsync({
        sourceType: entityType,
        sourceId: entityId,
        targetType,
        targetId: selectedId,
        projectId,
        linkType,
        note: note.trim() || undefined,
      });
      toast.success(`Linked ${ENTITY_LABEL[targetType]}: ${selectedTitle}`);
      resetForm();
      onOpenChange(false);
    } catch (err) {
      toast.error("Failed to add link");
    }
  }

  return (
    <Modal open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <ModalContent size="sm">
        <ModalHeader>
          <ModalTitle>Add Related Item</ModalTitle>
        </ModalHeader>

        <div className="space-y-4 pt-2">
          {/* Target type picker */}
          <div className="space-y-1.5">
            <Label>Item Type</Label>
            <Select
              value={targetType ?? ""}
              onValueChange={(v) => {
                setTargetType(v as EntityType);
                setSelectedId(null);
                setSelectedTitle("");
                setSearchQuery("");
                setSearchOpen(false);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select item type…" />
              </SelectTrigger>
              <SelectContent>
                {availableTargets.map((t) => (
                  <SelectItem key={t} value={t}>
                    {ENTITY_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Search */}
          {targetType && (
            <div className="space-y-1.5">
              <Label>Search {ENTITY_LABEL[targetType]}s</Label>
              <Popover
                open={searchOpen}
                onOpenChange={(open) => {
                  setSearchOpen(open);
                  if (!open) setSearchQuery("");
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={searchOpen}
                    className="h-11 w-full justify-between px-3 text-sm font-normal"
                  >
                    <span className={selectedTitle ? "truncate" : "truncate text-muted-foreground"}>
                      {selectedTitle || `Search ${ENTITY_LABEL[targetType]}s...`}
                    </span>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[var(--radix-popover-trigger-width)] p-0"
                  align="start"
                  sideOffset={4}
                >
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder={`Search ${ENTITY_LABEL[targetType]}s...`}
                      value={searchQuery}
                      onValueChange={(value) => {
                        setSearchQuery(value);
                        if (selectedId) {
                          setSelectedId(null);
                          setSelectedTitle("");
                        }
                      }}
                    />
                    <CommandList className="max-h-56">
                      {isSearching ? (
                        <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Searching…
                        </div>
                      ) : searchQuery.trim() ? (
                        <>
                          <CommandEmpty>No {ENTITY_LABEL[targetType].toLowerCase()} found.</CommandEmpty>
                          <CommandGroup>
                            {(searchResults ?? []).map((result) => (
                              <CommandItem
                                key={result.id}
                                value={result.title}
                                onSelect={() => {
                                  setSelectedId(result.id);
                                  setSelectedTitle(result.title);
                                  setSearchOpen(false);
                                  setSearchQuery("");
                                }}
                                className="cursor-pointer"
                              >
                                <Check
                                  className={
                                    selectedId === result.id
                                      ? "mr-2 h-4 w-4 opacity-100"
                                      : "mr-2 h-4 w-4 opacity-0"
                                  }
                                />
                                <span className="truncate">{result.title}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </>
                      ) : (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          Start typing to search.
                        </div>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Link type */}
          <div className="space-y-1.5">
            <Label>Link Type</Label>
            <Select value={linkType} onValueChange={(v) => setLinkType(v as LinkType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LINK_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <Label>Note (optional)</Label>
            <Input
              placeholder="Add a note about this link…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              variant="outline"
              onClick={() => { resetForm(); onOpenChange(false); }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={!selectedId || addMutation.isPending}
            >
              {addMutation.isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Linking…
                </>
              ) : (
                "Add Link"
              )}
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function RelatedItemsPanel({
  entityType,
  entityId,
  projectId,
  flat = false,
}: RelatedItemsPanelProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const { data: groups = [], isLoading, error } = useRelatedItems(
    entityType,
    entityId,
    projectId,
  );

  const removeMutation = useRemoveRelatedItem(entityType, entityId, projectId);

  const totalCount = groups.reduce((sum, g) => sum + g.items.length, 0);

  async function handleRemove(linkId: string, tableName: string, title: string) {
    try {
      await removeMutation.mutateAsync({ linkId, tableName });
      toast.success(`Removed link to "${title}"`);
    } catch (err) {
      toast.error("Failed to remove link");
    }
  }

  const hasLinkableTargets = (LINKABLE_TARGETS[entityType] ?? []).length > 0;

  // Header action shared by both the flat and card layouts.
  const addLinkButton = hasLinkableTargets ? (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-xs"
      onClick={() => setDialogOpen(true)}
    >
      <LinkIcon className="mr-1 h-3.5 w-3.5" />
      Add Link
    </Button>
  ) : undefined;

  const body = (
    <>
        {isLoading ? (
          <div className="space-y-2 animate-pulse py-2">
            <div className="h-4 bg-muted rounded w-2/3" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive py-2">
            Failed to load related items. Please refresh.
          </p>
        ) : groups.length === 0 ? (
          // Embedded (flat) usage: render nothing when empty — the section
          // collapses to just its label + "Add Link" selector, so it reads as a
          // compact field rather than a large empty block. The standalone card
          // variant keeps the full EmptyState.
          flat ? null : (
            <EmptyState
              icon={<LinkIcon />}
              title="No related items"
              description="Link RFIs, drawings, submittals, and other items to track connections."
              action={
                hasLinkableTargets ? (
                  <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
                    <LinkIcon className="mr-1.5 h-4 w-4" />
                    Add First Link
                  </Button>
                ) : undefined
              }
            />
          )
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.targetType}>
                {/* Group header */}
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  {group.label} ({group.items.length})
                </p>

                {/* Items */}
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const detailPath = getEntityDetailPath(
                      item.targetType,
                      projectId,
                      String(item.targetId),
                    );
                    return (
                      <div
                        key={item.linkId}
                        className="grid grid-cols-[1fr_auto] items-start rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors group"
                      >
                        {/* Title + link type */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {detailPath ? (
                              <Link
                                href={detailPath}
                                className="text-sm font-medium text-foreground hover:text-primary hover:underline truncate"
                              >
                                {item.targetTitle}
                              </Link>
                            ) : (
                              <span className="text-sm font-medium text-foreground truncate">
                                {item.targetTitle}
                              </span>
                            )}
                            <StatusBadge status={item.linkType} />
                          </div>
                          {item.note && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {item.note}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          {detailPath && (
                            <Link href={detailPath} target="_blank" rel="noopener noreferrer">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                aria-label={`Open ${item.targetTitle} in new tab`}
                              >
                                <ArrowRight className="h-3.5 w-3.5" />
                              </Button>
                            </Link>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            aria-label={`Remove link to ${item.targetTitle}`}
                            disabled={removeMutation.isPending}
                            onClick={() =>
                              handleRemove(item.linkId, item.tableName, item.targetTitle)
                            }
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
    </>
  );

  return (
    <>
      {flat ? (
        <div>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {`Related Items${totalCount > 0 ? ` (${totalCount})` : ""}`}
            </p>
            {addLinkButton}
          </div>
          {(isLoading || error || totalCount > 0) && (
            <div className="mt-3">{body}</div>
          )}
        </div>
      ) : (
        <SectionCard
          title={`Related Items${totalCount > 0 ? ` (${totalCount})` : ""}`}
          headerActions={addLinkButton}
          defaultOpen
          hideCollapse={false}
        >
          {body}
        </SectionCard>
      )}

      {hasLinkableTargets && (
        <AddLinkDialog
          entityType={entityType}
          entityId={entityId}
          projectId={projectId}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      )}
    </>
  );
}
