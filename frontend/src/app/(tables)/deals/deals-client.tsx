"use client";

import * as React from "react";
import type { ReactElement } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { toast } from "sonner";

import { format } from "date-fns";

import { apiFetch } from "@/lib/api-client";
import { handleFormError } from "@/lib/handle-form-error";
import { cn } from "@/lib/utils";
import {
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterValue,
} from "@/components/tables/unified";
import type { FilterConfig } from "@/components/tables/unified";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateField } from "@/components/forms/DateField";
import { MoneyField } from "@/components/forms/MoneyField";
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  buildPipelineTableColumns,
  formatDealValue,
  personName,
  pipelineColumns,
  pipelineDefaultVisibleColumns,
  type DealListItem,
} from "@/features/crm/pipeline-table-config";

// Deals table — the pipeline's default (and only) view. Deals FK to the shared
// identity tables; prospects and verified companies both can carry deals.

interface StageOption {
  id: string;
  name: string;
  sort_order: number;
  is_terminal: boolean;
  outcome: "won" | "lost" | null;
}

interface CompanyOption {
  id: string;
  name: string;
  lifecycle_stage?: string | null;
}

interface EmployeeOption {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

type DealFilterState = Record<string, FilterValue>;

const EMPTY_FILTERS: DealFilterState = {
  stage: undefined,
  status: undefined,
  owner: undefined,
};

interface CompanyComboboxProps {
  companies: CompanyOption[];
  value: string | null;
  onChange: (companyId: string) => void;
}

function CompanyCombobox({ companies, value, onChange }: CompanyComboboxProps): ReactElement {
  const [open, setOpen] = React.useState(false);
  const selected = companies.find((company) => company.id === value) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selected ? selected.name : "Select company…"}
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search companies…" />
          <CommandList>
            <CommandEmpty>No company found.</CommandEmpty>
            <CommandGroup>
              {companies.map((company) => (
                <CommandItem
                  key={company.id}
                  value={company.name}
                  onSelect={() => {
                    onChange(company.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "h-4 w-4",
                      value === company.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{company.name}</span>
                  {company.lifecycle_stage && company.lifecycle_stage !== "active" ? (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {company.lifecycle_stage}
                    </span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface DealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: DealListItem | null;
  stages: StageOption[];
  companies: CompanyOption[];
  employees: EmployeeOption[];
  onSaved: () => void;
}

function DealDialog({
  open,
  onOpenChange,
  deal,
  stages,
  companies,
  employees,
  onSaved,
}: DealDialogProps): ReactElement {
  const [name, setName] = React.useState("");
  const [companyId, setCompanyId] = React.useState<string | null>(null);
  const [stageId, setStageId] = React.useState<string | null>(null);
  const [value, setValue] = React.useState<number | undefined>(undefined);
  const [expectedClose, setExpectedClose] = React.useState<Date | undefined>(undefined);
  const [ownerId, setOwnerId] = React.useState<string | null>(null);
  const [leadSource, setLeadSource] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName(deal?.name ?? "");
    setCompanyId(deal?.company?.id ?? null);
    setStageId(deal?.stage?.id ?? stages[0]?.id ?? null);
    setValue(deal?.value ?? undefined);
    setExpectedClose(
      deal?.expected_close_date ? new Date(`${deal.expected_close_date}T12:00:00`) : undefined,
    );
    setOwnerId(deal?.owner?.id ?? null);
    setLeadSource(deal?.lead_source ?? "");
  }, [open, deal, stages]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Deal name is required");
      return;
    }
    if (!companyId) {
      toast.error("Company is required");
      return;
    }
    if (!stageId) {
      toast.error("Stage is required");
      return;
    }

    const stage = stages.find((candidate) => candidate.id === stageId) ?? null;

    const payload = {
      name: name.trim(),
      company_id: companyId,
      stage_id: stageId,
      status: stage?.outcome ?? "open",
      value: value ?? null,
      expected_close_date: expectedClose ? format(expectedClose, "yyyy-MM-dd") : null,
      owner_id: ownerId,
      lead_source: leadSource.trim() || null,
    };

    setIsSaving(true);
    try {
      if (deal) {
        await apiFetch(`/api/crm/deals/${deal.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Deal updated");
      } else {
        const { status: _status, ...createPayload } = payload;
        await apiFetch("/api/crm/deals", {
          method: "POST",
          body: JSON.stringify(createPayload),
        });
        toast.success("Deal created");
      }
      onOpenChange(false);
      onSaved();
    } catch (submitError) {
      handleFormError(submitError, { entity: "deal", action: deal ? "update" : "create" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="sm:max-w-lg">
        <ModalHeader>
          <ModalTitle>{deal ? "Edit deal" : "New deal"}</ModalTitle>
          <ModalDescription>
            {deal
              ? "Update the opportunity."
              : "Track an opportunity for any company — prospect or verified."}
          </ModalDescription>
        </ModalHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="deal-name">Deal name</Label>
            <Input
              id="deal-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Kokomo warehouse — steel package"
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label>Company</Label>
            <CompanyCombobox companies={companies} value={companyId} onChange={setCompanyId} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Stage</Label>
              <Select value={stageId ?? undefined} onValueChange={setStageId}>
                <SelectTrigger>
                  <SelectValue placeholder="Stage" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <MoneyField
              label="Value"
              value={value}
              onChange={setValue}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <DateField
              label="Expected close"
              value={expectedClose}
              onChange={setExpectedClose}
            />
            <div className="grid gap-2">
              <Label>Owner</Label>
              <Select
                value={ownerId ?? undefined}
                onValueChange={(next) => setOwnerId(next)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {personName(employee)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="deal-source">Lead source</Label>
            <Input
              id="deal-source"
              value={leadSource}
              onChange={(event) => setLeadSource(event.target.value)}
              placeholder="Referral, cold outreach, bid list…"
            />
          </div>
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? "Saving…" : deal ? "Save changes" : "Create deal"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export function DealsClient(): ReactElement {
  const pathname = usePathname()! ?? "";
  const router = useRouter();
  const searchParams = (useSearchParams() ?? new URLSearchParams()) as NonNullable<
    ReturnType<typeof useSearchParams>
  >;

  const initialFilters: DealFilterState = {
    stage: searchParams.get("stage") || undefined,
    status: searchParams.get("status") || undefined,
    owner: searchParams.get("owner") || undefined,
  };

  const tableState = useUnifiedTableState({
    entityKey: "crm-pipeline",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 50,
      search: "",
      sortBy: "created_at",
      sortDirection: "desc",
      visibleColumns: pipelineDefaultVisibleColumns,
      filters: initialFilters,
    },
  });

  const [deals, setDeals] = React.useState<DealListItem[]>([]);
  const [stages, setStages] = React.useState<StageOption[]>([]);
  const [companies, setCompanies] = React.useState<CompanyOption[]>([]);
  const [employees, setEmployees] = React.useState<EmployeeOption[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const [dialogDeal, setDialogDeal] = React.useState<DealListItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  const fetchDeals = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const payload = await apiFetch<{ data: DealListItem[] }>("/api/crm/deals");
      setDeals(payload.data);
      setError(null);
    } catch (fetchError) {
      setError(fetchError as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [stagesPayload, companiesPayload, peoplePayload] = await Promise.all([
          apiFetch<{ data: StageOption[] }>("/api/crm/stages"),
          // NOTE: /api/companies returns a raw array, not { data }.
          apiFetch<CompanyOption[]>("/api/companies"),
          apiFetch<{ people?: EmployeeOption[]; data?: EmployeeOption[] }>(
            "/api/people?type=employee&per_page=500",
          ),
        ]);
        if (cancelled) return;
        setStages(stagesPayload.data ?? []);
        setCompanies(Array.isArray(companiesPayload) ? companiesPayload : []);
        setEmployees(peoplePayload.people ?? peoplePayload.data ?? []);
      } catch (dropdownError) {
        // Dropdown data is non-fatal; dialogs surface their own errors.
        console.error("[Deals] Failed to load dropdown data:", dropdownError);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    const nextStage = searchParams.get("stage") || undefined;
    const nextStatus = searchParams.get("status") || undefined;
    const nextOwner = searchParams.get("owner") || undefined;
    tableState.setActiveFilters((prev) => {
      if (prev.stage === nextStage && prev.status === nextStatus && prev.owner === nextOwner) {
        return prev;
      }
      return { stage: nextStage, status: nextStatus, owner: nextOwner };
    });
  }, [searchParams, tableState.setActiveFilters]);

  const activeFilters = tableState.activeFilters as DealFilterState;

  const filters: FilterConfig[] = React.useMemo(() => {
    const owners = Array.from(
      new Set(deals.map((deal) => personName(deal.owner)).filter(Boolean)),
    ).sort();
    return [
      {
        id: "stage",
        label: "Stage",
        type: "select",
        options: stages.map((stage) => ({ value: stage.name, label: stage.name })),
      },
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
        options: owners.map((owner) => ({ value: owner, label: owner })),
      },
    ];
  }, [deals, stages]);

  const filteredDeals = React.useMemo(() => {
    const search = tableState.debouncedSearch.trim().toLowerCase();
    const stageFilter = typeof activeFilters.stage === "string" ? activeFilters.stage : "";
    const statusFilter = typeof activeFilters.status === "string" ? activeFilters.status : "";
    const ownerFilter = typeof activeFilters.owner === "string" ? activeFilters.owner : "";

    return deals.filter((deal) => {
      if (stageFilter && deal.stage?.name !== stageFilter) return false;
      if (statusFilter && deal.status !== statusFilter) return false;
      if (ownerFilter && personName(deal.owner) !== ownerFilter) return false;
      if (!search) return true;
      return (
        deal.name.toLowerCase().includes(search) ||
        (deal.company?.name ?? "").toLowerCase().includes(search) ||
        personName(deal.owner).toLowerCase().includes(search)
      );
    });
  }, [deals, activeFilters, tableState.debouncedSearch]);

  const openDeals = React.useMemo(
    () => deals.filter((deal) => deal.status === "open"),
    [deals],
  );
  const pipelineValue = React.useMemo(
    () => openDeals.reduce((sum, deal) => sum + (deal.value ?? 0), 0),
    [openDeals],
  );

  const tableColumns = React.useMemo(() => buildPipelineTableColumns(), []);
  const isFiltered =
    Boolean(tableState.searchInput) ||
    Boolean(activeFilters.stage) ||
    Boolean(activeFilters.status) ||
    Boolean(activeFilters.owner);
  const totalPages = Math.max(1, Math.ceil(filteredDeals.length / tableState.perPage));
  const currentPage = Math.min(tableState.page, totalPages);

  const handleDelete = React.useCallback(
    async (deal: DealListItem) => {
      try {
        await apiFetch(`/api/crm/deals/${deal.id}`, { method: "DELETE" });
        toast.success("Deal deleted");
        setDeals((prev) => prev.filter((candidate) => candidate.id !== deal.id));
      } catch (deleteError) {
        handleFormError(deleteError, { entity: "deal", action: "delete" });
      }
    },
    [],
  );

  const handleFilterChange = (nextFilters: DealFilterState) => {
    tableState.setActiveFilters(nextFilters);
    tableState.setSearchParams({
      stage: typeof nextFilters.stage === "string" ? nextFilters.stage : null,
      status: typeof nextFilters.status === "string" ? nextFilters.status : null,
      owner: typeof nextFilters.owner === "string" ? nextFilters.owner : null,
      page: "1",
    });
    tableState.setPage(1);
  };

  // Deliberately not `notation: "compact"` — Node and browsers format compact
  // currency differently, which caused a hydration mismatch on this line.
  const valueLabel = formatDealValue(pipelineValue) || "$0";

  return (
    <>
      <UnifiedTablePage
        header={{
          title: "Deals",
          description: `${openDeals.length} open deals · ${valueLabel} pipeline value`,
          actions: (
            <Button
              onClick={() => {
                setDialogDeal(null);
                setIsDialogOpen(true);
              }}
            >
              <Plus />
              New deal
            </Button>
          ),
        }}
        toolbar={{
          totalItems: deals.length,
          filteredItems: filteredDeals.length,
          searchValue: tableState.searchInput,
          onSearchChange: tableState.setSearchInput,
          searchPlaceholder: "Search deals, companies, owners...",
          currentView: tableState.currentView,
          onViewChange: tableState.setCurrentView,
          enabledViews: ["table"],
          filters,
          activeFilters,
          onFilterChange: handleFilterChange,
          onClearFilters: () => handleFilterChange(EMPTY_FILTERS),
          columns: pipelineColumns,
          visibleColumns: tableState.visibleColumns,
          onColumnVisibilityChange: tableState.setVisibleColumns,
        }}
        data={{
          items: filteredDeals,
          isLoading,
          isFetching: false,
          error: error ?? undefined,
        }}
        table={{
          columns: tableColumns,
          getRowId: (item) => item.id,
          onRowClick: (item) => {
            if (item.company) {
              router.push(`/directory/companies/${item.company.id}`);
            }
          },
          onEdit: (item) => {
            setDialogDeal(item);
            setIsDialogOpen(true);
          },
          onDelete: handleDelete,
        }}
        sorting={{
          sortBy: tableState.sortBy,
          sortDirection: tableState.sortDirection,
          onSortChange: (sortBy, direction) => {
            tableState.setSortBy(sortBy);
            tableState.setSortDirection(direction);
            tableState.setSearchParams({ sort: sortBy, sort_dir: direction });
          },
        }}
        emptyState={{
          title: "No deals yet",
          description: "Create a deal to start tracking the pipeline.",
          filteredDescription: "Try adjusting your search or filters.",
          isFiltered,
          action: (
            <Button
              size="sm"
              onClick={() => {
                setDialogDeal(null);
                setIsDialogOpen(true);
              }}
            >
              New deal
            </Button>
          ),
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
        layout={{
          fullBleedTable: true,
          removeTableFrame: true,
        }}
      />
      <DealDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        deal={dialogDeal}
        stages={stages}
        companies={companies}
        employees={employees}
        onSaved={fetchDeals}
      />
    </>
  );
}
