"use client";

import * as React from "react";
import {
  Check,
  ChevronDown,
  MoreVertical,
  Pencil,
  PinIcon,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Modal as Dialog,
  ModalContent as DialogContent,
  ModalFooter as DialogFooter,
  ModalHeader as DialogHeader,
  ModalTitle as DialogTitle,
} from "@/components/ui/unified-modal";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ConfirmDeleteDialog } from "@/components/ds/ConfirmDeleteDialog";
import {
  useCreateSavedTableView,
  useDeleteSavedTableView,
  useSavedTableViews,
  useUpdateSavedTableView,
  type SavedTableView,
  type SavedViewFilterValue,
} from "@/hooks/use-saved-table-views";
import { cn } from "@/lib/utils";

export interface TableViewsMenuCurrentState {
  visible_columns: string[];
  column_order?: string[] | null;
  column_widths?: Record<string, number> | null;
  sort_by: string | null;
  sort_direction: "asc" | "desc";
  filters: Record<string, SavedViewFilterValue>;
}

export interface TableViewsMenuProps {
  scopeKey: string;
  currentState: TableViewsMenuCurrentState;
  activeViewId: string | null;
  onApplyView: (view: SavedTableView) => void;
  /** Called when the user picks "Reset to defaults" — parent should restore default presentation. */
  onResetToDefaults: () => void;
  /** Called whenever a default view should auto-apply (e.g. on first load). */
  onAutoApplyDefault?: (view: SavedTableView) => void;
}

function shallowEqualArray(
  a: readonly string[] | null | undefined,
  b: readonly string[] | null | undefined,
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function shallowEqualFilters(
  a: Record<string, SavedViewFilterValue> | null | undefined,
  b: Record<string, SavedViewFilterValue> | null | undefined,
): boolean {
  const normalize = (
    v: Record<string, SavedViewFilterValue> | null | undefined,
  ): Record<string, SavedViewFilterValue> => {
    if (!v) return {};
    const out: Record<string, SavedViewFilterValue> = {};
    for (const [k, val] of Object.entries(v)) {
      if (val === undefined || val === null || val === "" || (Array.isArray(val) && val.length === 0))
        continue;
      out[k] = val as SavedViewFilterValue;
    }
    return out;
  };
  const na = normalize(a);
  const nb = normalize(b);
  const keysA = Object.keys(na).sort();
  const keysB = Object.keys(nb).sort();
  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i += 1) {
    if (keysA[i] !== keysB[i]) return false;
    const valA = na[keysA[i]];
    const valB = nb[keysB[i]];
    if (Array.isArray(valA) || Array.isArray(valB)) {
      if (!Array.isArray(valA) || !Array.isArray(valB)) return false;
      if (!shallowEqualArray(valA, valB)) return false;
    } else if (valA !== valB) {
      return false;
    }
  }
  return true;
}

function shallowEqualWidths(
  a: Record<string, number> | null | undefined,
  b: Record<string, number> | null | undefined,
): boolean {
  const normalize = (value: Record<string, number> | null | undefined) => {
    if (!value) return {};
    return Object.fromEntries(
      Object.entries(value).filter(
        ([key, width]) =>
          key.length > 0 && Number.isFinite(width) && width > 0,
      ),
    );
  };

  const left = normalize(a);
  const right = normalize(b);
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length) return false;

  for (let index = 0; index < leftKeys.length; index += 1) {
    const key = leftKeys[index];
    if (key !== rightKeys[index]) return false;
    if (left[key] !== right[key]) return false;
  }

  return true;
}

function isStateEqualToView(
  state: TableViewsMenuCurrentState,
  view: SavedTableView,
): boolean {
  if (!shallowEqualArray(state.visible_columns, view.visible_columns)) return false;
  if (!shallowEqualArray(state.column_order ?? null, view.column_order)) return false;
  if (!shallowEqualWidths(state.column_widths, view.column_widths)) return false;
  if ((state.sort_by ?? null) !== view.sort_by) return false;
  if (view.sort_by && state.sort_direction !== view.sort_direction) return false;
  if (!shallowEqualFilters(state.filters, view.filters)) return false;
  return true;
}

export function TableViewsMenu({
  scopeKey,
  currentState,
  activeViewId,
  onApplyView,
  onResetToDefaults,
  onAutoApplyDefault,
}: TableViewsMenuProps): React.ReactElement {
  const { data: views = [], isLoading } = useSavedTableViews(scopeKey);
  const createMutation = useCreateSavedTableView(scopeKey);
  const updateMutation = useUpdateSavedTableView(scopeKey);
  const deleteMutation = useDeleteSavedTableView(scopeKey);

  const [saveDialogOpen, setSaveDialogOpen] = React.useState(false);
  const [newViewName, setNewViewName] = React.useState("");
  const [newViewAsDefault, setNewViewAsDefault] = React.useState(false);

  const [renameDialogOpen, setRenameDialogOpen] = React.useState(false);
  const [renameTarget, setRenameTarget] = React.useState<SavedTableView | null>(
    null,
  );
  const [renameValue, setRenameValue] = React.useState("");

  const [deleteTarget, setDeleteTarget] = React.useState<SavedTableView | null>(
    null,
  );

  const activeView = React.useMemo(
    () => views.find((view) => view.id === activeViewId) ?? null,
    [views, activeViewId],
  );

  const isDirty = React.useMemo(() => {
    if (!activeView) return false;
    return !isStateEqualToView(currentState, activeView);
  }, [activeView, currentState]);

  // Auto-apply default view on first load (only once per mount per scope).
  const autoAppliedRef = React.useRef(false);
  React.useEffect(() => {
    if (autoAppliedRef.current) return;
    if (isLoading) return;
    if (activeViewId) return;
    const defaultView = views.find((v) => v.is_default);
    if (defaultView && onAutoApplyDefault) {
      autoAppliedRef.current = true;
      onAutoApplyDefault(defaultView);
    }
  }, [isLoading, views, activeViewId, onAutoApplyDefault]);

  const triggerLabel = React.useMemo(() => {
    if (activeView) return `${activeView.name}${isDirty ? " •" : ""}`;
    if (isLoading) return "Loading…";
    return "View";
  }, [activeView, isDirty, isLoading]);

  function handleSaveNew() {
    const name = newViewName.trim();
    if (!name) return;
    createMutation.mutate(
      {
        name,
        is_default: newViewAsDefault,
        visible_columns: currentState.visible_columns,
        column_order: currentState.column_order ?? currentState.visible_columns,
        column_widths: currentState.column_widths ?? null,
        sort_by: currentState.sort_by,
        sort_direction: currentState.sort_by ? currentState.sort_direction : null,
        filters: currentState.filters,
      },
      {
        onSuccess: (created) => {
          setSaveDialogOpen(false);
          setNewViewName("");
          setNewViewAsDefault(false);
          onApplyView(created);
        },
      },
    );
  }

  function handleUpdateCurrent() {
    if (!activeView) return;
    updateMutation.mutate({
      viewId: activeView.id,
      input: {
        visible_columns: currentState.visible_columns,
        column_order: currentState.column_order ?? currentState.visible_columns,
        column_widths: currentState.column_widths ?? null,
        sort_by: currentState.sort_by,
        sort_direction: currentState.sort_by ? currentState.sort_direction : null,
        filters: currentState.filters,
      },
    });
  }

  function handleRename() {
    if (!renameTarget) return;
    const name = renameValue.trim();
    if (!name) return;
    updateMutation.mutate(
      { viewId: renameTarget.id, input: { name } },
      {
        onSuccess: () => {
          setRenameDialogOpen(false);
          setRenameTarget(null);
          setRenameValue("");
        },
      },
    );
  }

  function handleDelete() {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  }

  return (
    <>
      <DropdownMenu>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-8 max-w-44 gap-1 px-2 text-xs font-normal",
                    activeView && "text-foreground",
                    !activeView && "text-muted-foreground",
                  )}
                  aria-label="Saved views"
                >
                  <span className="truncate">{triggerLabel}</span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Saved views</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>Saved views</span>
            {activeView ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={onResetToDefaults}
                className="h-auto px-1 py-0 text-[11px] font-normal text-muted-foreground hover:bg-transparent hover:text-foreground"
              >
                Reset
              </Button>
            ) : null}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {views.length === 0 && !isLoading ? (
            <div className="px-2 py-2 text-xs text-muted-foreground">
              No saved views yet.
            </div>
          ) : null}

          {views.map((view) => {
            const isActive = view.id === activeViewId;
            return (
              <div
                key={view.id}
                className={cn(
                  "group flex items-center gap-1 rounded-sm px-1",
                  isActive && "bg-accent/40",
                )}
              >
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onApplyView(view)}
                  className="flex min-h-8 h-auto flex-1 items-center justify-start gap-2 truncate px-1.5 py-1 text-left text-sm font-normal text-foreground hover:bg-accent/30"
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
                    {isActive ? <Check className="h-3.5 w-3.5" /> : null}
                  </span>
                  <span className="truncate">{view.name}</span>
                  {view.is_default ? (
                    <PinIcon className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" />
                  ) : null}
                </Button>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent/40 hover:text-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100">
                    <MoreVertical className="h-3.5 w-3.5" />
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-48">
                    <DropdownMenuItem
                      onSelect={() => {
                        setRenameTarget(view);
                        setRenameValue(view.name);
                        setRenameDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={view.is_default}
                      onSelect={() =>
                        updateMutation.mutate({
                          viewId: view.id,
                          input: { is_default: true },
                        })
                      }
                    >
                      <PinIcon className="h-3.5 w-3.5" />
                      {view.is_default ? "Default view" : "Set as default"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => setDeleteTarget(view)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </div>
            );
          })}

          <DropdownMenuSeparator />
          {activeView && isDirty ? (
            <DropdownMenuItem
              onSelect={handleUpdateCurrent}
              disabled={updateMutation.isPending}
            >
              <Save className="h-3.5 w-3.5" />
              Update &quot;{activeView.name}&quot;
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            onSelect={() => {
              setNewViewName("");
              setNewViewAsDefault(false);
              setSaveDialogOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Save current as new view…
          </DropdownMenuItem>
          {activeView ? (
            <DropdownMenuItem onSelect={onResetToDefaults}>
              <RotateCcw className="h-3.5 w-3.5" />
              Reset to defaults
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Save view</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 px-1 py-1">
            <div className="space-y-1.5">
              <label
                htmlFor="new-view-name"
                className="text-sm font-medium text-foreground"
              >
                Name
              </label>
              <Input
                id="new-view-name"
                value={newViewName}
                onChange={(event) => setNewViewName(event.target.value)}
                placeholder="e.g. Quick view"
                maxLength={80}
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === "Enter" && newViewName.trim()) {
                    event.preventDefault();
                    handleSaveNew();
                  }
                }}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                checked={newViewAsDefault}
                onCheckedChange={(checked) =>
                  setNewViewAsDefault(checked === true)
                }
              />
              Set as default for this table
            </label>
            <p className="text-xs text-muted-foreground">
              This view will save your columns, widths, sort, and filters. You
              can switch back to defaults any time.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSaveDialogOpen(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveNew}
              disabled={!newViewName.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? "Saving…" : "Save view"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rename view</DialogTitle>
          </DialogHeader>
          <div className="px-1 py-1">
            <Input
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              placeholder="View name"
              maxLength={80}
              autoFocus
              onKeyDown={(event) => {
                if (event.key === "Enter" && renameValue.trim()) {
                  event.preventDefault();
                  handleRename();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setRenameDialogOpen(false)}
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleRename}
              disabled={!renameValue.trim() || updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving…" : "Rename"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        itemName={deleteTarget?.name ?? "view"}
        description="This view will be permanently removed. Your table data is not affected."
        onConfirm={handleDelete}
        isDeleting={deleteMutation.isPending}
      />
    </>
  );
}
