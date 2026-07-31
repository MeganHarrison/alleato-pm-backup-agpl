"use client";

/**
 * agenda-section
 *
 * Self-contained agenda/minutes UI for a single meeting: categories with
 * drag-reorder, agenda items (drag-reorder within + across categories),
 * a client-side status filter, and expand/collapse-all. Consumed by the
 * meeting detail page (owned on another branch) — this component owns no
 * page-level layout and fetches nothing for the meeting itself; it only
 * reads `detail` (passed in) and calls the category/item mutation hooks
 * from `@/hooks/use-meetings`.
 *
 * Numbers (`agenda_number`, e.g. "1.1") are always server-computed
 * (`loadMeetingDetail` → `numberAgenda`) and never recomputed locally —
 * after any reorder the optimistic update in the hooks recomputes
 * `position` only; the authoritative numbers arrive on refetch.
 */

import { GripVertical, MoreVertical, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import {
  Sortable,
  SortableContent,
  SortableItem,
  SortableItemHandle,
} from "@/components/ui/sortable";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { SectionRuleHeading, SectionAction } from "@/components/layout";
import {
  useCreateCategory,
  useCreateItem,
  useDeleteCategory,
  useReorderCategories,
  useReorderItems,
  useUpdateCategory,
  type MeetingDetail,
  type MeetingDetailCategory,
  type MeetingDetailItem,
} from "@/hooks/use-meetings";
import { AgendaItemRow } from "./agenda-item-row";

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "closed", label: "Closed" },
] as const;

type StatusFilterValue = (typeof STATUS_FILTER_OPTIONS)[number]["value"];
const ACTION_ITEM_STATUSES = new Set(["open", "in_progress"]);

export interface AgendaSectionProps {
  projectId: number;
  meetingId: string;
  detail: MeetingDetail;
  mode: "agenda" | "minutes";
}

export function AgendaSection({ projectId, meetingId, detail, mode }: AgendaSectionProps) {
  const projectIdStr = String(projectId);
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("all");
  const [collapsedCategoryIds, setCollapsedCategoryIds] = useState<Set<string>>(new Set());
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);

  const createCategory = useCreateCategory(projectIdStr, meetingId);
  const reorderCategories = useReorderCategories(projectIdStr, meetingId);
  const reorderItems = useReorderItems(projectIdStr, meetingId);

  const categories = detail.categories;
  const allCollapsed = categories.length > 0 && collapsedCategoryIds.size === categories.length;

  const filteredItemsByCategory = useMemo(() => {
    const map = new Map<string, MeetingDetailItem[]>();
    for (const category of categories) {
      const items =
        statusFilter === "all"
          ? category.items
          : category.items.filter((item) => item.status === statusFilter);
      map.set(category.id, items);
    }
    return map;
  }, [categories, statusFilter]);

  function toggleCategoryCollapsed(categoryId: string) {
    setCollapsedCategoryIds((current) => {
      const next = new Set(current);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }

  function toggleExpandCollapseAll() {
    if (allCollapsed) {
      setCollapsedCategoryIds(new Set());
    } else {
      setCollapsedCategoryIds(new Set(categories.map((category) => category.id)));
    }
  }

  function handleCategoryReorder(orderedCategories: MeetingDetailCategory[]) {
    reorderCategories.mutate(orderedCategories.map((category) => category.id));
  }

  function handleItemReorder(categoryId: string, orderedItems: MeetingDetailItem[]) {
    reorderItems.mutate({
      categoryId,
      orderedIds: orderedItems.map((item) => item.id),
    });
  }

  function handleAddCategory() {
    const name = newCategoryName.trim();
    if (!name) {
      setAddingCategory(false);
      return;
    }
    createCategory.mutate(name, {
      onSuccess: () => {
        setNewCategoryName("");
        setAddingCategory(false);
      },
    });
  }

  return (
    <div className="flex flex-col gap-6" data-testid="agenda-section">
      <div className="flex items-center justify-between gap-3">
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as StatusFilterValue)}
        >
          <SelectTrigger size="sm" className="h-8 w-40 text-xs" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="ghost" size="sm" onClick={toggleExpandCollapseAll} className="h-8 text-xs">
          {allCollapsed ? "Expand All" : "Collapse All"}
        </Button>
      </div>

      <Sortable
        value={categories}
        getItemValue={(category) => category.id}
        orientation="vertical"
        onValueChange={handleCategoryReorder}
      >
        <SortableContent asChild>
          <div className="flex flex-col gap-8">
            {categories.map((category, index) => {
              const items = filteredItemsByCategory.get(category.id) ?? [];
              const isCollapsed = collapsedCategoryIds.has(category.id);

              return (
                <SortableItem key={category.id} value={category.id} asChild>
                  <div data-testid="agenda-category" data-category-id={category.id}>
                    <CategoryHeader
                      index={index}
                      category={category}
                      projectId={projectIdStr}
                      meetingId={meetingId}
                      collapsed={isCollapsed}
                      onToggleCollapsed={() => toggleCategoryCollapsed(category.id)}
                      canDelete={categories.length > 1}
                    />

                    {!isCollapsed ? (
                      <div className="flex flex-col gap-1 pl-1">
                        <Sortable
                          value={items}
                          getItemValue={(item) => item.id}
                          orientation="vertical"
                          onValueChange={(orderedItems) =>
                            handleItemReorder(category.id, orderedItems)
                          }
                        >
                          <SortableContent asChild>
                            <div className="flex flex-col divide-y divide-border/60">
                              {items.map((item) => (
                                <SortableItem key={item.id} value={item.id} asChild>
                                  <AgendaItemRow
                                    projectId={projectId}
                                    meetingId={meetingId}
                                    item={item}
                                    mode={mode}
                                  />
                                </SortableItem>
                              ))}
                            </div>
                          </SortableContent>
                        </Sortable>

                        <QuickAddItemRow
                          projectId={projectIdStr}
                          meetingId={meetingId}
                          categoryId={category.id}
                        />
                      </div>
                    ) : null}
                  </div>
                </SortableItem>
              );
            })}
          </div>
        </SortableContent>
      </Sortable>

      {addingCategory ? (
        <Input
          autoFocus
          disabled={createCategory.isPending}
          value={newCategoryName}
          placeholder="Category name"
          className="h-8 max-w-xs text-sm"
          onChange={(event) => setNewCategoryName(event.target.value)}
          onBlur={handleAddCategory}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !createCategory.isPending) handleAddCategory();
            if (event.key === "Escape") {
              setNewCategoryName("");
              setAddingCategory(false);
            }
          }}
        />
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => setAddingCategory(true)}
          className="w-fit text-muted-foreground hover:text-foreground"
          aria-label="Add category"
        >
          <Plus className="h-3.5 w-3.5" />
          Add category
        </Button>
      )}
    </div>
  );
}

export interface MeetingActionItemsSectionProps {
  projectId: number;
  meetingId: string;
  detail: MeetingDetail;
}

export function MeetingActionItemsSection({
  projectId,
  meetingId,
  detail,
}: MeetingActionItemsSectionProps) {
  const actionItems = useMemo(
    () =>
      detail.categories
        .flatMap((category) => category.items)
        .filter((item) => item.task_count > 0 && ACTION_ITEM_STATUSES.has(item.status)),
    [detail.categories],
  );

  if (actionItems.length === 0) return null;

  return (
    <section className="space-y-3" data-testid="meeting-action-items-section">
      <div className="space-y-1">
        <SectionRuleHeading label="Action items" className="mb-0 pb-0" />
        <p className="text-xs text-muted-foreground">
          Linked tasks from this meeting that need owner follow-up.
        </p>
      </div>

      <Sortable
        value={actionItems}
        getItemValue={(item) => item.id}
        orientation="vertical"
        onValueChange={() => undefined}
      >
        <SortableContent asChild>
          <div className="flex flex-col divide-y divide-border/60">
            {actionItems.map((item) => (
              <SortableItem key={item.id} value={item.id} asChild>
                <AgendaItemRow
                  projectId={projectId}
                  meetingId={meetingId}
                  item={item}
                  mode="agenda"
                />
              </SortableItem>
            ))}
          </div>
        </SortableContent>
      </Sortable>
    </section>
  );
}

interface CategoryHeaderProps {
  index: number;
  category: MeetingDetailCategory;
  projectId: string;
  meetingId: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  canDelete: boolean;
}

function CategoryHeader({
  index,
  category,
  projectId,
  meetingId,
  collapsed,
  onToggleCollapsed,
  canDelete,
}: CategoryHeaderProps) {
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(category.name);
  const updateCategory = useUpdateCategory(projectId, meetingId);
  const deleteCategory = useDeleteCategory(projectId, meetingId);
  const createItem = useCreateItem(projectId, meetingId);

  function commitRename() {
    const trimmed = nameDraft.trim();
    setRenaming(false);
    if (!trimmed || trimmed === category.name) {
      setNameDraft(category.name);
      return;
    }
    updateCategory.mutate({ categoryId: category.id, name: trimmed });
  }

  function handleDelete() {
    if (!canDelete) return;
    deleteCategory.mutate(category.id);
  }

  function handleAddItem() {
    createItem.mutate({ category_id: category.id, title: "New item" });
  }

  return (
    <SectionRuleHeading
      label={
        <span className="flex items-center gap-2">
          <SortableItemHandle
            className="text-muted-foreground hover:text-foreground"
            aria-label={`Reorder ${category.name}`}
          >
            <GripVertical className="h-4 w-4" />
          </SortableItemHandle>
          {renaming ? (
            <span>
              {index + 1}.{" "}
              <Input
                autoFocus
                disabled={updateCategory.isPending}
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                onBlur={commitRename}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !updateCategory.isPending) commitRename();
                  if (event.key === "Escape") {
                    setNameDraft(category.name);
                    setRenaming(false);
                  }
                }}
                className="inline-flex h-6 w-48 text-xs"
              />
            </span>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={onToggleCollapsed}
              onDoubleClick={(event) => {
                event.stopPropagation();
                setRenaming(true);
              }}
              className="h-auto p-0 text-left font-normal hover:bg-transparent"
              aria-label={collapsed ? `Expand ${category.name}` : `Collapse ${category.name}`}
            >
              {index + 1}. {category.name}
            </Button>
          )}
        </span>
      }
      actions={
        <span className="flex items-center gap-1">
          <SectionAction
            onClick={handleAddItem}
            disabled={createItem.isPending}
            aria-label={`Add item to ${category.name}`}
          >
            <Plus className="h-4 w-4" />
          </SectionAction>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SectionAction aria-label={`${category.name} actions`}>
                <MoreVertical className="h-4 w-4" />
              </SectionAction>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setRenaming(true)}>Rename</DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={handleDelete} disabled={!canDelete}>
                Delete category
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      }
    />
  );
}

interface QuickAddItemRowProps {
  projectId: string;
  meetingId: string;
  categoryId: string;
}

function QuickAddItemRow({ projectId, meetingId, categoryId }: QuickAddItemRowProps) {
  const [titleDraft, setTitleDraft] = useState("");
  const createItem = useCreateItem(projectId, meetingId);

  function handleAdd() {
    const title = titleDraft.trim();
    if (!title) return;
    createItem.mutate(
      { category_id: categoryId, title },
      { onSuccess: () => setTitleDraft("") },
    );
  }

  return (
    <Input
      value={titleDraft}
      placeholder="Add item…"
      disabled={createItem.isPending}
      className="ml-14 h-7 max-w-sm text-xs"
      onChange={(event) => setTitleDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !createItem.isPending) handleAdd();
      }}
      onBlur={handleAdd}
    />
  );
}
