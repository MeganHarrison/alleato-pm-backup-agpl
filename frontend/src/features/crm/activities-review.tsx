"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/unified-modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterConfig,
} from "@/components/tables/unified";
import { useCrmWorkspace } from "@/hooks/use-crm";
import type { CrmActivity } from "@/lib/crm/types";
import {
  crmActivityColumnConfig,
  crmActivityColumns,
  crmActivityDefaultColumns,
} from "@/features/crm/activity-table-config";
import { buildCrmWorkspaceTabs } from "@/features/crm/crm-workspace-tabs";
import { CRM_WORKSPACE_TABLE_LAYOUT } from "@/features/crm/crm-workspace-layout";

const ACTIVITY_FILTERS: FilterConfig[] = [
  {
    id: "type",
    label: "Type",
    type: "select",
    options: ["call", "email", "meeting", "note"].map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
    })),
  },
  {
    id: "visibility",
    label: "Visibility",
    type: "select",
    options: [
      { value: "standard", label: "Standard" },
      { value: "restricted", label: "Restricted" },
      { value: "private_source", label: "Private source" },
    ],
  },
];

export function CrmActivitiesReview() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    accounts,
    leads,
    activities,
    addActivity,
    updateActivity,
    removeActivity,
    isLoading,
    error,
  } = useCrmWorkspace();
  const [open, setOpen] = React.useState(false);
  const [relationshipValue, setRelationshipValue] = React.useState("");
  const [activityType, setActivityType] =
    React.useState<CrmActivity["activityType"]>("call");
  const [subject, setSubject] = React.useState("");
  const [editingActivity, setEditingActivity] =
    React.useState<CrmActivity | null>(null);
  const [editSubject, setEditSubject] = React.useState("");
  const [editType, setEditType] =
    React.useState<CrmActivity["activityType"]>("call");

  const tableState = useUnifiedTableState({
    entityKey: "crm-activity-local-review",
    pathname,
    router,
    searchParams,
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 25,
      visibleColumns: crmActivityDefaultColumns,
      filters: {},
      sortBy: "occurred",
      sortDirection: "desc",
    },
  });

  const items = React.useMemo(() => {
    const query = tableState.debouncedSearch.trim().toLowerCase();
    return activities.filter((activity) => {
      const matchesQuery =
        !query ||
        [activity.subject, activity.companyName, activity.createdBy]
          .join(" ")
          .toLowerCase()
          .includes(query);
      const matchesType =
        !tableState.activeFilters.type ||
        activity.activityType === tableState.activeFilters.type;
      const matchesVisibility =
        !tableState.activeFilters.visibility ||
        activity.visibilityScope === tableState.activeFilters.visibility;
      return matchesQuery && matchesType && matchesVisibility;
    });
  }, [
    activities,
    tableState.activeFilters.type,
    tableState.activeFilters.visibility,
    tableState.debouncedSearch,
  ]);

  const logActivity = async () => {
    const [targetType, targetId] = relationshipValue.split(":");
    const relationshipName =
      targetType === "account"
        ? accounts.find((candidate) => candidate.companyId === targetId)?.name
        : leads.find((candidate) => candidate.id === targetId)
            ?.prospectCompanyName;
    if (!relationshipName || !subject.trim()) {
      toast.error("Choose a relationship and enter a subject.");
      return;
    }
    try {
      await addActivity({
        companyId: targetType === "account" ? targetId : null,
        leadId: targetType === "lead" ? targetId : null,
        companyName: relationshipName,
        dealId: null,
        activityType,
        subject: subject.trim(),
        visibilityScope: "standard",
      });
      setSubject("");
      setOpen(false);
      toast.success("Activity recorded");
    } catch (error) {
      toast.error("Activity could not be recorded", {
        description:
          error instanceof Error ? error.message : "Refresh and try again.",
      });
    }
  };

  return (
    <>
      <UnifiedTablePage
        header={{
          title: "Activity",
          description: error
            ? `CRM could not be loaded: ${error.message}`
            : "Accepted communications and manual relationship history",
          actions: (
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" />
              Log activity
            </Button>
          ),
        }}
        tabs={buildCrmWorkspaceTabs(pathname)}
        layout={CRM_WORKSPACE_TABLE_LAYOUT}
        toolbar={{
          totalItems: activities.length,
          filteredItems: items.length,
          searchValue: tableState.searchInput,
          onSearchChange: tableState.setSearchInput,
          searchPlaceholder: "Search activity or relationships...",
          currentView: tableState.currentView,
          onViewChange: tableState.setCurrentView,
          enabledViews: ["table"],
          filters: ACTIVITY_FILTERS,
          activeFilters: tableState.activeFilters,
          onFilterChange: tableState.setActiveFilters,
          onClearFilters: () => tableState.setActiveFilters({}),
          columns: crmActivityColumnConfig,
          visibleColumns: tableState.visibleColumns,
          onColumnVisibilityChange: tableState.setVisibleColumns,
        }}
        data={{ items, isLoading }}
        table={{
          columns: crmActivityColumns,
          getRowId: (activity) => activity.id,
          stickyHeader: true,
          rowActions: (activity) =>
            activity.recordOrigin === "manual" ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditingActivity(activity);
                  setEditSubject(activity.subject);
                  setEditType(activity.activityType);
                }}
              >
                Edit
              </Button>
            ) : null,
        }}
        emptyState={{
          title: "No activity",
          description: "Record the first call, email, meeting, or note.",
          filteredDescription:
            "No activity matches the current search and filters.",
          isFiltered:
            Boolean(tableState.debouncedSearch) ||
            Object.values(tableState.activeFilters).some(Boolean),
          action: (
            <Button size="sm" onClick={() => setOpen(true)}>
              Log activity
            </Button>
          ),
        }}
      />
      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Log activity</ModalTitle>
            <ModalDescription>
              Saves to the shared CRM relationship history.
            </ModalDescription>
          </ModalHeader>
          <div className="space-y-4">
            <Select
              value={relationshipValue}
              onValueChange={setRelationshipValue}
            >
              <SelectTrigger aria-label="Relationship">
                <SelectValue placeholder="Choose account or lead" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem
                    key={`account:${account.companyId}`}
                    value={`account:${account.companyId}`}
                  >
                    {account.name} · Account
                  </SelectItem>
                ))}
                {leads
                  .filter((lead) => lead.status !== "converted")
                  .map((lead) => (
                    <SelectItem
                      key={`lead:${lead.id}`}
                      value={`lead:${lead.id}`}
                    >
                      {lead.fullName} · {lead.prospectCompanyName}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Select
              value={activityType}
              onValueChange={(value) =>
                setActivityType(value as CrmActivity["activityType"])
              }
            >
              <SelectTrigger aria-label="Activity type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["call", "email", "meeting", "note"].map((value) => (
                  <SelectItem key={value} value={value}>
                    {value[0].toUpperCase() + value.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="What happened?"
              maxLength={300}
            />
          </div>
          <ModalFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={logActivity}>Log activity</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <Modal
        open={editingActivity !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setEditingActivity(null);
        }}
      >
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Edit activity</ModalTitle>
            <ModalDescription>
              Update or delete this manual relationship activity.
            </ModalDescription>
          </ModalHeader>
          <div className="space-y-4">
            <Select
              value={editType}
              onValueChange={(value) =>
                setEditType(value as CrmActivity["activityType"])
              }
            >
              <SelectTrigger aria-label="Edit activity type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["call", "email", "meeting", "note"].map((value) => (
                  <SelectItem key={value} value={value}>
                    {value[0].toUpperCase() + value.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={editSubject}
              onChange={(event) => setEditSubject(event.target.value)}
              placeholder="Activity subject"
              maxLength={300}
            />
          </div>
          <ModalFooter className="justify-between">
            <Button
              variant="destructive"
              onClick={async () => {
                if (!editingActivity) return;
                try {
                  await removeActivity(editingActivity.id);
                  setEditingActivity(null);
                  toast.success("Activity deleted");
                } catch (error) {
                  toast.error("Activity could not be deleted", {
                    description:
                      error instanceof Error
                        ? error.message
                        : "Refresh and try again.",
                  });
                }
              }}
            >
              Delete
            </Button>
            <Button
              onClick={async () => {
                if (!editingActivity) return;
                try {
                  await updateActivity(editingActivity.id, {
                    subject: editSubject,
                    activityType: editType,
                  });
                  setEditingActivity(null);
                  toast.success("Activity updated");
                } catch (error) {
                  toast.error("Activity could not be updated", {
                    description:
                      error instanceof Error
                        ? error.message
                        : "Enter a subject and try again.",
                  });
                }
              }}
            >
              Save activity
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
