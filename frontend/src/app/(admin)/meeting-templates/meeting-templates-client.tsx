"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";

import {
  UnifiedTablePage,
  useUnifiedTableState,
  type TableColumn,
} from "@/components/tables/unified";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Modal,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/unified-modal";
import {
  useAdminMeetingTemplateList,
  useCreateMeetingTemplate,
  useDeleteMeetingTemplate,
  type AdminMeetingTemplateListItem,
} from "@/hooks/use-meeting-templates";

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const DEFAULT_VISIBLE_COLUMNS = ["name", "category_count", "item_count", "updated_at"];

const COLUMNS: TableColumn<AdminMeetingTemplateListItem>[] = [
  {
    id: "name",
    label: "Name",
    alwaysVisible: true,
    render: (item) => <span className="font-medium text-foreground">{item.name}</span>,
    csvValue: (item) => item.name,
    sortable: true,
    sortValue: (item) => item.name,
  },
  {
    id: "category_count",
    label: "Categories",
    defaultVisible: true,
    render: (item) => <span className="tabular-nums text-foreground">{item.category_count}</span>,
    csvValue: (item) => String(item.category_count),
    sortable: true,
    sortValue: (item) => item.category_count,
  },
  {
    id: "item_count",
    label: "Items",
    defaultVisible: true,
    render: (item) => <span className="tabular-nums text-foreground">{item.item_count}</span>,
    csvValue: (item) => String(item.item_count),
    sortable: true,
    sortValue: (item) => item.item_count,
  },
  {
    id: "updated_at",
    label: "Updated",
    defaultVisible: true,
    render: (item) => (
      <span className="text-sm text-muted-foreground">{formatUpdatedAt(item.updated_at)}</span>
    ),
    csvValue: (item) => item.updated_at,
    sortable: true,
    sortValue: (item) => item.updated_at,
  },
];

export function MeetingTemplatesClient() {
  const pathname = usePathname()!;
  const router = useRouter();
  const searchParams = useSearchParams()!;

  const { data, isLoading, isFetching, error } = useAdminMeetingTemplateList();
  const createTemplate = useCreateMeetingTemplate();
  const deleteTemplate = useDeleteMeetingTemplate();

  const templates = data?.templates ?? [];

  const tableState = useUnifiedTableState({
    entityKey: "meeting-templates",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 25,
      search: "",
      sortBy: "name",
      sortDirection: "asc",
      visibleColumns: DEFAULT_VISIBLE_COLUMNS,
      filters: {},
    },
  });

  const searchTerm = tableState.debouncedSearch.trim().toLowerCase();
  const filteredTemplates = searchTerm
    ? templates.filter((template) => template.name.toLowerCase().includes(searchTerm))
    : templates;

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newOverview, setNewOverview] = useState("");
  const [newIsPrivate, setNewIsPrivate] = useState(false);

  const resetCreateForm = useCallback(() => {
    setNewName("");
    setNewOverview("");
    setNewIsPrivate(false);
  }, []);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    const created = await createTemplate.mutateAsync({
      name: newName.trim(),
      overview: newOverview.trim() || undefined,
      is_private: newIsPrivate,
      categories: [],
    });
    setCreateOpen(false);
    resetCreateForm();
    router.push(`/meeting-templates/${created.id}`);
  }, [newName, newOverview, newIsPrivate, createTemplate, resetCreateForm, router]);

  return (
    <>
      <UnifiedTablePage
        header={{
          title: "Meeting Templates",
          description: "Reusable agenda templates for creating project meetings.",
          actions: (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Template
            </Button>
          ),
        }}
        toolbar={{
          totalItems: templates.length,
          filteredItems: filteredTemplates.length,
          searchValue: tableState.searchInput,
          onSearchChange: tableState.setSearchInput,
          searchPlaceholder: "Search meeting templates...",
          currentView: tableState.currentView,
          onViewChange: tableState.setCurrentView,
        }}
        data={{
          items: filteredTemplates,
          isLoading,
          isFetching,
          error: error as Error | null,
        }}
        table={{
          columns: COLUMNS,
          getRowId: (item) => item.id,
          onRowClick: (item) => router.push(`/meeting-templates/${item.id}`),
          onDelete: (item) => deleteTemplate.mutateAsync(item.id),
        }}
        emptyState={{
          title: "No meeting templates yet",
          description: "Create a template to standardize agendas for recurring meeting types.",
          filteredDescription: "No templates match your search.",
          isFiltered: Boolean(searchTerm),
          action: (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Template
            </Button>
          ),
        }}
      />

      <Modal
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetCreateForm();
        }}
      >
        <ModalContent>
          <ModalHeader>
            <ModalTitle>New Meeting Template</ModalTitle>
          </ModalHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="template-name">Name</Label>
              <Input
                id="template-name"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="Weekly OAC Meeting"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-overview">Overview</Label>
              <Textarea
                id="template-overview"
                value={newOverview}
                onChange={(event) => setNewOverview(event.target.value)}
                placeholder="Optional description of when to use this template."
                rows={3}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="template-private">Private</Label>
              <Switch
                id="template-private"
                checked={newIsPrivate}
                onCheckedChange={setNewIsPrivate}
              />
            </div>
          </div>
          <ModalFooter>
            <Button variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={!newName.trim() || createTemplate.isPending}
            >
              {createTemplate.isPending ? "Creating…" : "Create"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
