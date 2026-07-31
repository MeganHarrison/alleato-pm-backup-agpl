"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { MoneyField } from "@/components/forms";
import {
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterConfig,
} from "@/components/tables/unified";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/unified-modal";
import {
  buildCrmDealColumns,
  crmDealColumnConfig,
  crmDealDefaultColumns,
} from "@/features/crm/deal-table-config";
import { buildCrmWorkspaceTabs } from "@/features/crm/crm-workspace-tabs";
import { CRM_WORKSPACE_TABLE_LAYOUT } from "@/features/crm/crm-workspace-layout";
import { useCrmWorkspace } from "@/hooks/use-crm";

function buildDealFilters(ownerNames: string[]): FilterConfig[] {
  return [
    {
      id: "status",
      label: "Status",
      type: "select",
      options: [
        { value: "open", label: "Open" },
        { value: "won", label: "Won" },
        { value: "lost", label: "Lost" },
      ],
    },
    {
      id: "owner",
      label: "Owner",
      type: "select",
      options: Array.from(new Set(ownerNames)).map((owner) => ({
        value: owner,
        label: owner,
      })),
    },
  ];
}

export function CrmDealsReview() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    accounts,
    leads,
    deals,
    stages,
    archivedDealIds,
    addDeal,
    isLoading,
    error,
  } = useCrmWorkspace();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [relationshipValue, setRelationshipValue] = React.useState("");
  const [value, setValue] = React.useState(0);
  const [expectedClose, setExpectedClose] = React.useState("");
  const tableState = useUnifiedTableState({
    entityKey: "crm-deals-local",
    pathname,
    router,
    searchParams,
    defaults: {
      view: "table",
      allowedViews: ["table", "card"],
      page: 1,
      perPage: 25,
      visibleColumns: crmDealDefaultColumns,
      filters: {},
      sortBy: "expected_close",
      sortDirection: "asc",
    },
  });

  const items = React.useMemo(() => {
    const query = tableState.debouncedSearch.toLowerCase().trim();
    return deals.filter((deal) => {
      if (archivedDealIds.includes(deal.id)) return false;
      const matchesQuery =
        !query ||
        [deal.name, deal.companyName, deal.owner.name, deal.source]
          .join(" ")
          .toLowerCase()
          .includes(query);
      return (
        matchesQuery &&
        (!tableState.activeFilters.status ||
          deal.status === tableState.activeFilters.status) &&
        (!tableState.activeFilters.owner ||
          deal.owner.name === tableState.activeFilters.owner)
      );
    });
  }, [
    archivedDealIds,
    deals,
    tableState.activeFilters,
    tableState.debouncedSearch,
  ]);

  const createDeal = async () => {
    if (
      !name.trim() ||
      !relationshipValue ||
      !Number.isFinite(value) ||
      value <= 0
    ) {
      toast.error("Enter a deal name, relationship, and positive value.");
      return;
    }
    if (expectedClose && !/^\d{4}-\d{2}-\d{2}$/.test(expectedClose)) {
      toast.error("Expected close must use YYYY-MM-DD.");
      return;
    }
    const [targetType, targetId] = relationshipValue.split(":") as [
      "account" | "lead",
      string,
    ];
    const target =
      targetType === "account"
        ? accounts
            .filter((account) => account.companyId === targetId)
            .map((account) => ({
              type: "account" as const,
              id: account.companyId,
              name: account.name,
              owner: account.owner,
            }))[0]
        : leads
            .filter((lead) => lead.id === targetId)
            .map((lead) => ({
              type: "lead" as const,
              id: lead.id,
              name: lead.prospectCompanyName,
              owner: lead.owner,
            }))[0];
    if (!target) {
      toast.error("The selected CRM relationship was not found.");
      return;
    }
    try {
      const deal = await addDeal({
        name: name.trim(),
        target,
        valueEstimate: value,
        expectedCloseDate: expectedClose || null,
      });
      setOpen(false);
      setName("");
      setValue(0);
      setExpectedClose("");
      toast.success("Deal created");
      router.push(`/crm/deals/${deal.id}`);
    } catch (error) {
      toast.error("Deal could not be created", {
        description:
          error instanceof Error ? error.message : "Refresh and try again.",
      });
    }
  };

  return (
    <>
      <UnifiedTablePage
        header={{
          title: "Deals",
          description: error
            ? `CRM could not be loaded: ${error.message}`
            : "Relationship opportunities and project conversion",
          actions: (
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" />
              New deal
            </Button>
          ),
        }}
        tabs={buildCrmWorkspaceTabs(pathname)}
        layout={CRM_WORKSPACE_TABLE_LAYOUT}
        toolbar={{
          totalItems: deals.length,
          filteredItems: items.length,
          searchValue: tableState.searchInput,
          onSearchChange: tableState.setSearchInput,
          searchPlaceholder:
            "Search deals, relationships, owners, or source...",
          currentView: tableState.currentView,
          onViewChange: tableState.setCurrentView,
          enabledViews: ["table", "card"],
          viewSwitcherDisplay: "icons",
          filters: buildDealFilters(deals.map((deal) => deal.owner.name)),
          activeFilters: tableState.activeFilters,
          onFilterChange: tableState.setActiveFilters,
          onClearFilters: () => tableState.setActiveFilters({}),
          columns: crmDealColumnConfig,
          visibleColumns: tableState.visibleColumns,
          onColumnVisibilityChange: tableState.setVisibleColumns,
        }}
        data={{ items, isLoading }}
        table={{
          columns: buildCrmDealColumns(stages),
          getRowId: (deal) => deal.id,
          onRowClick: (deal) => router.push(`/crm/deals/${deal.id}`),
          onView: (deal) => router.push(`/crm/deals/${deal.id}`),
          stickyHeader: true,
        }}
        views={{
          card: (deal) => (
            <article className="space-y-3 rounded-md border border-border p-4">
              <div>
                <p className="font-semibold">{deal.name}</p>
                <p className="text-sm text-muted-foreground">
                  {deal.companyName}
                </p>
              </div>
              <div className="flex justify-between text-sm">
                <span>{deal.owner.name}</span>
                <span className="tabular-nums">{deal.probability}%</span>
              </div>
            </article>
          ),
        }}
        emptyState={{
          title: "No deals",
          description: "Create the first opportunity.",
          filteredDescription: "No deals match the current search and filters.",
          isFiltered:
            Boolean(tableState.debouncedSearch) ||
            Object.values(tableState.activeFilters).some(Boolean),
        }}
      />
      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>New deal</ModalTitle>
            <ModalDescription>
              Creates an opportunity in the shared Alleato CRM.
            </ModalDescription>
          </ModalHeader>
          <div className="space-y-4">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Opportunity name"
            />
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
            <MoneyField
              label="Deal value"
              inline
              value={value || undefined}
              onChange={(nextValue) => setValue(nextValue ?? 0)}
              clearZeroOnFocus
            />
            <Input
              value={expectedClose}
              onChange={(event) => setExpectedClose(event.target.value)}
              placeholder="Expected close (YYYY-MM-DD)"
              aria-label="Expected close date"
            />
          </div>
          <ModalFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createDeal}>Create deal</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
