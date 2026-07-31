"use client";

import { useMemo } from "react";
import { Filter, X, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { BoardItem, BoardAssignee } from "./use-product-board";
import type { BoardLabel, BoardItemMeta } from "./use-board-item";
import type { CardViewSettings } from "./card-view-settings";
import type { BoardCaptureTopicKey } from "./topics";
import {
  formatBoardItemTypeLabel,
  getBoardCategory,
  getBoardItemType,
  getBoardTool,
} from "./metadata";

export interface BoardFilters {
  search?: string;
  assigneeId?: string;
  priority?: string;
  labelColor?: string;
  topics?: BoardCaptureTopicKey[];
  tool?: string;
  category?: string;
  type?: string;
}

const PRIORITY_OPTIONS = [
  { value: "high", label: "High" },
  { value: "medium", label: "Med" },
  { value: "low", label: "Low" },
];

const VIEW_TOGGLES: { key: keyof CardViewSettings; label: string }[] = [
  { key: "showCover",        label: "Cover image" },
  { key: "showLinkPreview",  label: "Live link" },
  { key: "showDescription",  label: "Description preview" },
  { key: "showLabels",       label: "Labels" },
  { key: "showAssignee",     label: "Assignee" },
  { key: "showDueDate",      label: "Due date" },
  { key: "showSeverity",     label: "Priority" },
  { key: "showCommentCount", label: "Comment count" },
];

function AssigneeAvatar({ user }: { user: BoardAssignee }) {
  const initials = user.full_name
    ? user.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : user.email[0].toUpperCase();
  return (
    <div
      className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-foreground"
      title={user.full_name ?? user.email}
    >
      {initials}
    </div>
  );
}

interface BoardFilterBarProps {
  items: BoardItem[];
  filters: BoardFilters;
  onChange: (f: BoardFilters) => void;
  cardSettings: CardViewSettings;
  onCardSettingsChange: (patch: Partial<CardViewSettings>) => void;
}

export function BoardFilterBar({
  items,
  filters,
  onChange,
  cardSettings,
  onCardSettingsChange,
}: BoardFilterBarProps) {
  const assignees = useMemo<BoardAssignee[]>(() => {
    const map = new Map<string, BoardAssignee>();
    items.forEach((item) => {
      if (item.assignee_id && item.assignee) {
        map.set(item.assignee_id, item.assignee as BoardAssignee);
      }
    });
    return Array.from(map.values());
  }, [items]);

  const labelColors = useMemo<BoardLabel[]>(() => {
    const map = new Map<string, BoardLabel>();
    items.forEach((item) => {
      const meta = (item.metadata as BoardItemMeta | null) ?? {};
      (meta.labels ?? []).forEach((l) => {
        if (!map.has(l.color)) map.set(l.color, l);
      });
    });
    return Array.from(map.values());
  }, [items]);

  const tools = useMemo(
    () => Array.from(new Set(items.map((item) => getBoardTool(item)).filter((value): value is string => !!value))).sort((a, b) => a.localeCompare(b)),
    [items],
  );
  const categories = useMemo(
    () => Array.from(new Set(items.map((item) => getBoardCategory(item)).filter((value): value is string => !!value))).sort((a, b) => a.localeCompare(b)),
    [items],
  );
  const types = useMemo(
    () => Array.from(new Set(items.map((item) => getBoardItemType(item)).filter((value): value is string => !!value))).sort((a, b) => a.localeCompare(b)),
    [items],
  );

  const hasFilters = !!(
    filters.assigneeId ||
    filters.priority ||
    filters.labelColor ||
    filters.topics?.length ||
    filters.tool ||
    filters.category ||
    filters.type
  );

  function set(patch: Partial<BoardFilters>) {
    onChange({ ...filters, ...patch });
  }
  function clearFilters() {
    onChange({ search: filters.search }); // preserve search when clearing other filters
  }

  function setTextFilter(key: "tool" | "category", value: string) {
    set({ [key]: value || undefined });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8", hasFilters && "text-primary")}
          aria-label="Filters"
        >
          <Filter className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-4">
        <div className="space-y-4">
          {/* Priority */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">Priority</p>
            <div className="flex gap-1">
              {PRIORITY_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  variant="ghost"
                  size="sm"
                  onClick={() => set({ priority: filters.priority === opt.value ? undefined : opt.value })}
                  className={cn(
                    "h-7 flex-1 px-2 text-xs",
                    filters.priority === opt.value ? "bg-muted text-foreground" : "text-muted-foreground"
                  )}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Assignee */}
          {assignees.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">Assignee</p>
              <div className="flex flex-wrap gap-1.5">
                {assignees.map((user) => (
                  <Button
                    key={user.id}
                    variant="ghost"
                    size="icon"
                    onClick={() => set({ assigneeId: filters.assigneeId === user.id ? undefined : user.id })}
                    className={cn(
                      "h-7 w-7 rounded-full p-0",
                      filters.assigneeId === user.id ? "ring-2 ring-primary ring-offset-1" : "opacity-60 hover:opacity-100"
                    )}
                    title={user.full_name ?? user.email}
                  >
                    <AssigneeAvatar user={user} />
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Labels */}
          {labelColors.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">Label</p>
              <div className="flex flex-wrap gap-1.5">
                {labelColors.map((l) => (
                  <Button
                    key={l.color}
                    variant="ghost"
                    size="icon"
                    onClick={() => set({ labelColor: filters.labelColor === l.color ? undefined : l.color })}
                    className={cn(
                      "h-6 w-6 rounded-sm p-0 transition-all",
                      l.color,
                      filters.labelColor === l.color
                        ? "ring-2 ring-foreground ring-offset-1 scale-110"
                        : "opacity-70 hover:opacity-100 hover:scale-110"
                    )}
                    title={l.name || l.color}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">Metadata</p>
            <div className="space-y-2.5">
              <div>
                <Select value={filters.tool ?? "all"} onValueChange={(value) => setTextFilter("tool", value === "all" ? "" : value)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Tool" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All tools</SelectItem>
                    {tools.map((tool) => (
                      <SelectItem key={tool} value={tool}>
                        {tool}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Select value={filters.category ?? "all"} onValueChange={(value) => setTextFilter("category", value === "all" ? "" : value)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Select value={filters.type ?? "all"} onValueChange={(value) => onChange({ ...filters, type: value === "all" ? undefined : value })}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {types.map((type) => (
                      <SelectItem key={type} value={type}>
                        {formatBoardItemTypeLabel(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Clear */}
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 gap-1.5 text-xs text-muted-foreground">
              <X className="h-3.5 w-3.5" />
              Clear filters
            </Button>
          )}

          {/* Divider */}
          <div className="border-t border-border/50 pt-3">
            <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              <SlidersHorizontal className="inline h-3 w-3 mr-1 mb-0.5" />
              Card fields
            </p>
            <div className="space-y-2">
              {VIEW_TOGGLES.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-foreground">{label}</span>
                  <Switch
                    checked={cardSettings[key]}
                    onCheckedChange={(checked) => onCardSettingsChange({ [key]: checked })}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
