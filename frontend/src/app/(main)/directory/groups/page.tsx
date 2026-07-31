"use client";

import * as React from "react";
import type { ReactElement } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Edit,
  Plus,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import {
  CellBadge,
  CellText,
  TableDateValue,
  UnifiedTablePage,
  useUnifiedTableState,
  type CellColorMap,
  type ColumnConfig,
  type TableColumn,
} from "@/components/tables/unified";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/unified-modal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useDistributionGroups,
  useCreateGroup,
  useUpdateGroup,
  useDeleteGroup,
} from "@/hooks/use-distribution-groups";
import { getDirectoryTabs } from "@/config/directory-tabs";
import type { DistributionGroupWithMembers } from "@/services/distributionGroupService";

// ─── Types ───────────────────────────────────────────────────────────────────

type GroupRow = DistributionGroupWithMembers;

// ─── Color maps ──────────────────────────────────────────────────────────────

const STATUS_COLORS: CellColorMap = {
  active: "bg-success/10 text-success",
  inactive: "bg-muted text-muted-foreground",
};

// ─── Column config ────────────────────────────────────────────────────────────

const groupColumns: ColumnConfig[] = [
  { id: "name", label: "Group Name", alwaysVisible: true },
  { id: "description", label: "Description", defaultVisible: true },
  { id: "member_count", label: "Members", defaultVisible: true },
  { id: "status", label: "Status", defaultVisible: true },
  { id: "created_at", label: "Created", defaultVisible: true },
];

const groupDefaultVisibleColumns = groupColumns
  .filter((col) => col.defaultVisible !== false)
  .map((col) => col.id);

function buildGroupTableColumns(
  onEdit: (group: GroupRow) => void,
  onDelete: (group: GroupRow) => void,
): TableColumn<GroupRow>[] {
  const colMap = Object.fromEntries(groupColumns.map((c) => [c.id, c]));
  const col = (id: string) => colMap[id];

  return [
    {
      ...col("name"),
      render: (item) => (
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-3.5 w-3.5 text-primary" />
          </div>
          <CellText value={item.name} className="font-medium" />
        </div>
      ),
      sortValue: (item) => item.name,
    },
    {
      ...col("description"),
      render: (item) => <CellText value={item.description} emptyLabel="-" />,
      sortValue: (item) => item.description || "",
    },
    {
      ...col("member_count"),
      render: (item) => {
        const count = item.member_count ?? 0;
        return (
          <span className={count > 0 ? "text-foreground" : "text-muted-foreground"}>
            {count} member{count !== 1 ? "s" : ""}
          </span>
        );
      },
      sortValue: (item) => item.member_count ?? 0,
    },
    {
      ...col("status"),
      render: (item) => <CellBadge value={item.status} colorMap={STATUS_COLORS} emptyLabel="-" />,
      sortValue: (item) => item.status || "",
    },
    {
      ...col("created_at"),
      render: (item) => <TableDateValue value={item.created_at} emptyLabel="-" />,
      sortValue: (item) => (item.created_at ? new Date(item.created_at).getTime() : 0),
    },
    {
      id: "actions",
      label: "",
      render: (item) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-7 w-7 p-0" aria-label="Row actions">
              <span className="sr-only">Open menu</span>
              <span className="text-muted-foreground">•••</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(item)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Group
            </DropdownMenuItem>
            <DropdownMenuItem>
              <UserPlus className="mr-2 h-4 w-4" />
              Add Members
            </DropdownMenuItem>
            <DropdownMenuItem>
              <UserMinus className="mr-2 h-4 w-4" />
              Manage Members
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => onDelete(item)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Group
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      sortValue: () => "",
    },
  ];
}

// ─── Side panel ───────────────────────────────────────────────────────────────

function GroupPreviewPane({
  group,
  groups,
  onSelectGroup,
  onClose,
}: {
  group: GroupRow | null;
  groups: GroupRow[];
  onSelectGroup: (id: string) => void;
  onClose: () => void;
}): ReactElement {
  const currentIndex = group ? groups.findIndex((g) => g.id === group.id) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < groups.length - 1;

  if (!group) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        <p>Select a group to preview details.</p>
      </div>
    );
  }

  const memberCount = group.member_count ?? 0;

  return (
    <div className="flex flex-col h-full">
      {/* Panel header — h-11 matches table header height */}
      <div className="flex items-center justify-between gap-1 px-4 h-11">
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-5 w-5"
            disabled={!hasPrev}
            onClick={() => hasPrev && onSelectGroup(groups[currentIndex - 1].id)}
            aria-label="Previous group"
          >
            <ChevronLeft />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-5 w-5"
            disabled={!hasNext}
            onClick={() => hasNext && onSelectGroup(groups[currentIndex + 1].id)}
            aria-label="Next group"
          >
            <ChevronRight />
          </Button>
          <span className="text-xs text-muted-foreground ml-1">
            {currentIndex + 1} of {groups.length}
          </span>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-5 w-5"
          onClick={onClose}
          aria-label="Close panel"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Group header */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              {/* eslint-disable-next-line design-system/no-raw-heading */}
              <h3 className="text-sm font-semibold leading-tight truncate">{group.name}</h3>
              {group.status && (
                <div className="mt-1.5">
                  <CellBadge value={group.status} colorMap={STATUS_COLORS} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        {group.description && (
          <div className="px-5 pb-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
              Description
            </p>
            <p className="text-sm text-foreground">{group.description}</p>
          </div>
        )}

        {/* Stats */}
        <div className="px-5 pb-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
            Overview
          </p>
          <div className="rounded-md bg-background p-3 w-fit min-w-20">
            <p className="text-lg font-semibold">{memberCount}</p>
            <p className="text-xs text-muted-foreground">
              Member{memberCount !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Details */}
        {group.created_at && (
          <div className="px-5 pb-5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
              Details
            </p>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Created</dt>
                <dd>
                  <TableDateValue value={group.created_at} />
                </dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DistributionGroupsPage(): ReactElement {
  const pathname = usePathname()! ?? "";
  const router = useRouter();
  const searchParams = (useSearchParams() ?? new URLSearchParams()) as NonNullable<ReturnType<typeof useSearchParams>>;

  // Project selector
  const [projectId, setProjectId] = React.useState("1");

  // Dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [editingGroup, setEditingGroup] = React.useState<GroupRow | null>(null);
  const [deletingGroup, setDeletingGroup] = React.useState<GroupRow | null>(null);
  const [newGroupName, setNewGroupName] = React.useState("");
  const [newGroupDescription, setNewGroupDescription] = React.useState("");

  // Data hooks
  const { groups, isLoading, error, refetch } = useDistributionGroups(projectId);
  const createMutation = useCreateGroup(projectId);
  const updateMutation = useUpdateGroup(projectId);
  const deleteMutation = useDeleteGroup(projectId);

  // ─── CRUD handlers (unchanged) ──────────────────────────────────────────────

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    await createMutation.mutateAsync({
      name: newGroupName.trim(),
      description: newGroupDescription.trim() || undefined,
    });
    setNewGroupName("");
    setNewGroupDescription("");
    setIsAddDialogOpen(false);
    refetch();
  };

  const handleUpdateGroup = async () => {
    if (!editingGroup || !newGroupName.trim()) return;
    await updateMutation.mutateAsync({
      groupId: editingGroup.id,
      data: {
        name: newGroupName.trim(),
        description: newGroupDescription.trim() || undefined,
      },
    });
    setNewGroupName("");
    setNewGroupDescription("");
    setEditingGroup(null);
    refetch();
  };

  const handleDeleteGroup = async () => {
    if (!deletingGroup) return;
    await deleteMutation.mutateAsync(deletingGroup.id);
    setDeletingGroup(null);
    refetch();
  };

  const openEditDialog = React.useCallback((group: GroupRow) => {
    setNewGroupName(group.name);
    setNewGroupDescription(group.description || "");
    setEditingGroup(group);
  }, []);

  // ─── Table state ─────────────────────────────────────────────────────────────

  const tableState = useUnifiedTableState({
    entityKey: "directory-groups",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 50,
      search: "",
      sortBy: "name",
      sortDirection: "asc",
      visibleColumns: groupDefaultVisibleColumns,
      filters: {},
    },
  });

  const tableColumns = React.useMemo(
    () => buildGroupTableColumns(openEditDialog, setDeletingGroup),
    [openEditDialog],
  );

  // ─── Side panel selection ────────────────────────────────────────────────────

  const selectedGroupId = searchParams.get("detail");
  const selectedGroup =
    selectedGroupId ? groups.find((g) => g.id === selectedGroupId) ?? null : null;
  const activeGroupId = selectedGroup?.id ?? null;

  // ─── Keyboard nav ────────────────────────────────────────────────────────────

  const handleTableKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
    visibleItems: GroupRow[],
  ) => {
    const target = event.target as HTMLElement | null;
    if (target && ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].includes(target.tagName)) {
      return;
    }
    if (visibleItems.length === 0) return;

    const currentIndex = visibleItems.findIndex((g) => g.id === activeGroupId);
    const hasSelection = currentIndex >= 0;
    const fallbackIndex = hasSelection ? currentIndex : 0;

    if (event.key === "ArrowDown" || event.key === "j") {
      event.preventDefault();
      const nextIndex = hasSelection ? Math.min(visibleItems.length - 1, fallbackIndex + 1) : 0;
      tableState.setSearchParams({ detail: visibleItems[nextIndex].id });
      return;
    }
    if (event.key === "ArrowUp" || event.key === "k") {
      event.preventDefault();
      const nextIndex = hasSelection ? Math.max(0, fallbackIndex - 1) : 0;
      tableState.setSearchParams({ detail: visibleItems[nextIndex].id });
    }
  };

  const tabs = getDirectoryTabs(pathname);
  const isFiltered = Boolean(tableState.searchInput);
  const totalPages = Math.max(1, Math.ceil(groups.length / tableState.perPage));
  const currentPage = Math.min(tableState.page, totalPages);

  return (
    <>
      <UnifiedTablePage
        header={{
          title: "Distribution Groups",
          description:
            "Manage companies, clients, contacts, users, and employees across your organization",
          actions: (
            <div className="flex items-center gap-3">
              {/* Project selector */}
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Goodwill Bart</SelectItem>
                  {/* TODO: Load projects dynamically from API */}
                </SelectContent>
              </Select>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus />
                Add Distribution Group
              </Button>
            </div>
          ),
        }}
        tabs={tabs}
        toolbar={{
          totalItems: groups.length,
          filteredItems: groups.length,
          searchValue: tableState.searchInput,
          onSearchChange: tableState.setSearchInput,
          searchPlaceholder: "Search groups...",
          currentView: tableState.currentView,
          onViewChange: (view) => {
            tableState.setCurrentView(view);
            tableState.setSearchParams({ view });
          },
          enabledViews: ["table"],
          filters: [],
          activeFilters: tableState.activeFilters,
          onFilterChange: tableState.setActiveFilters,
          onClearFilters: () => tableState.setActiveFilters({}),
          columns: groupColumns,
          visibleColumns: tableState.visibleColumns,
          onColumnVisibilityChange: tableState.setVisibleColumns,
        }}
        data={{
          items: groups,
          isLoading,
          isFetching: false,
          error: error ?? undefined,
        }}
        table={{
          columns: tableColumns,
          getRowId: (item) => item.id,
          activeRowId: activeGroupId,
          onTableKeyDown: handleTableKeyDown,
          onRowClick: (item) => tableState.setSearchParams({ detail: item.id }),
        }}
        sidePanel={{
          content: (
            <GroupPreviewPane
              group={selectedGroup}
              groups={groups}
              onSelectGroup={(id) => tableState.setSearchParams({ detail: id })}
              onClose={() => tableState.setSearchParams({ detail: null })}
            />
          ),
        }}
        sorting={{
          sortBy: tableState.sortBy,
          sortDirection: tableState.sortDirection,
          onSortChange: (sortBy, direction) => {
            tableState.setSortBy(sortBy);
            tableState.setSortDirection(direction);
            tableState.setSearchParams({
              sort: sortBy,
              sort_dir: direction,
              page: "1",
            });
            tableState.setPage(1);
          },
        }}
        emptyState={{
          title: "No distribution groups found",
          description:
            "Create distribution groups to easily send communications to multiple users at once.",
          filteredDescription: "Try adjusting your search.",
          isFiltered,
        }}
        pagination={{
          page: currentPage,
          totalPages,
          perPage: tableState.perPage,
          clientSide: true,
          onPageChange: (nextPage) => {
            tableState.setPage(nextPage);
            tableState.setSearchParams({ page: String(nextPage) });
          },
          onPerPageChange: (nextPerPage) => {
            const parsed = Number(nextPerPage);
            if (!Number.isFinite(parsed) || parsed <= 0) return;
            tableState.setPerPage(parsed);
            tableState.setSearchParams({ per_page: String(parsed), page: "1" });
            tableState.setPage(1);
          },
        }}
        features={{
          enableExport: false,
          enableBulkDelete: false,
        }}
        layout={{
          fullBleedTable: true,
          removeTableFrame: true,
        }}
      />

      {/* Add Group Dialog */}
      <Modal open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Add Distribution Group</ModalTitle>
            <ModalDescription>
              Create a new distribution group for mass communication.
            </ModalDescription>
          </ModalHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Group Name *</Label>
              <Input
                id="name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Enter group name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newGroupDescription}
                onChange={(e) => setNewGroupDescription(e.target.value)}
                placeholder="Enter description (optional)"
                rows={3}
              />
            </div>
          </div>
          <ModalFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateGroup}
              disabled={!newGroupName.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? "Creating..." : "Create Group"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit Group Dialog */}
      <Modal
        open={!!editingGroup}
        onOpenChange={(open) => !open && setEditingGroup(null)}
      >
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Edit Distribution Group</ModalTitle>
            <ModalDescription>Update the group name and description.</ModalDescription>
          </ModalHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Group Name *</Label>
              <Input
                id="edit-name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Enter group name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={newGroupDescription}
                onChange={(e) => setNewGroupDescription(e.target.value)}
                placeholder="Enter description (optional)"
                rows={3}
              />
            </div>
          </div>
          <ModalFooter>
            <Button variant="outline" onClick={() => setEditingGroup(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateGroup}
              disabled={!newGroupName.trim() || updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletingGroup}
        onOpenChange={(open) => !open && setDeletingGroup(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Distribution Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingGroup?.name}"? This action cannot be
              undone. All members will be removed from this group.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGroup}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Group"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
