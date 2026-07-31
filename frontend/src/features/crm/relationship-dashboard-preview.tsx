"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Building2, Clock3 } from "lucide-react";
import { toast } from "sonner";

import { ErrorState, StatusBadge } from "@/components/ds";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/page-header-unified";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Modal,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/unified-modal";
import {
  UnifiedTablePage,
  useUnifiedTableState,
  type ColumnConfig,
  type FilterConfig,
  type TableColumn,
} from "@/components/tables/unified";
import { buildCrmWorkspaceTabs } from "@/features/crm/crm-workspace-tabs";
import { CRM_WORKSPACE_TABLE_LAYOUT } from "@/features/crm/crm-workspace-layout";
import { useCrmWorkspace } from "@/hooks/use-crm";
import { formatCurrency } from "@/lib/format";

export type CrmPreviewState =
  | "ready"
  | "loading"
  | "empty"
  | "error"
  | "denied";

type RelationshipHealth = "Attention" | "Watch" | "Healthy";
type LifecycleStage =
  | "Lead"
  | "Prospect"
  | "Qualified"
  | "Active client"
  | "Past client";

export interface CrmPreviewAccount {
  id: string;
  account: string;
  company?: string;
  owner: string;
  lifecycle: LifecycleStage;
  health: RelationshipHealth;
  attentionReason: string;
  lastActivity: string;
  nextFollowUp: string | null;
  isOverdue: boolean;
}

export const CRM_PREVIEW_ACCOUNTS: CrmPreviewAccount[] = [
  {
    id: "preview-northline",
    account: "Northline Distribution",
    owner: "Brandon Clymer",
    lifecycle: "Qualified",
    health: "Attention",
    attentionReason: "Proposal has been open for 12 days without a response.",
    lastActivity: "Proposal review · Jul 15",
    nextFollowUp: "Jul 25",
    isOverdue: true,
  },
  {
    id: "preview-riverview",
    account: "Riverview Health",
    owner: "Mary Rodriguez",
    lifecycle: "Active client",
    health: "Attention",
    attentionReason: "Stakeholder requested a pricing follow-up this week.",
    lastActivity: "Project check-in · Jul 22",
    nextFollowUp: "Jul 29",
    isOverdue: false,
  },
  {
    id: "preview-atlas",
    account: "Atlas Cold Storage",
    owner: "Brandon Clymer",
    lifecycle: "Prospect",
    health: "Watch",
    attentionReason: "No meaningful activity recorded in 31 days.",
    lastActivity: "Introductory call · Jun 26",
    nextFollowUp: "Jul 24",
    isOverdue: true,
  },
  {
    id: "preview-meridian",
    account: "Meridian Packaging",
    owner: "Sarah Kim",
    lifecycle: "Past client",
    health: "Watch",
    attentionReason:
      "Renewal window opens in 18 days; no next meeting scheduled.",
    lastActivity: "Closeout review · Jun 30",
    nextFollowUp: "Aug 4",
    isOverdue: false,
  },
  {
    id: "preview-summit",
    account: "Summit Food Group",
    owner: "Mary Rodriguez",
    lifecycle: "Active client",
    health: "Healthy",
    attentionReason: "Next step confirmed with the client.",
    lastActivity: "Weekly coordination · Jul 26",
    nextFollowUp: "Aug 1",
    isOverdue: false,
  },
  {
    id: "preview-harbor",
    account: "Harbor Point Logistics",
    owner: "Sarah Kim",
    lifecycle: "Qualified",
    health: "Healthy",
    attentionReason: "Decision-maker engaged and follow-up is scheduled.",
    lastActivity: "Scope alignment · Jul 24",
    nextFollowUp: "Jul 31",
    isOverdue: false,
  },
];

const COLUMN_CONFIG: ColumnConfig[] = [
  { id: "account", label: "Account", alwaysVisible: true },
  { id: "attentionReason", label: "Attention reason", defaultVisible: true },
  { id: "nextFollowUp", label: "Next follow-up", defaultVisible: true },
  { id: "owner", label: "Owner", defaultVisible: true },
  { id: "lifecycle", label: "Lifecycle", defaultVisible: true },
  {
    id: "lastActivity",
    label: "Last meaningful activity",
    defaultVisible: true,
  },
  { id: "health", label: "Health", defaultVisible: true },
];

const DEFAULT_VISIBLE_COLUMNS = COLUMN_CONFIG.map((column) => column.id);

function buildFilters(accounts: CrmPreviewAccount[]): FilterConfig[] {
  const optionSet = (values: string[]) =>
    Array.from(new Set(values))
      .sort((left, right) => left.localeCompare(right))
      .map((value) => ({ value, label: value }));

  return [
    {
      id: "owner",
      label: "Owner",
      type: "select",
      options: optionSet(accounts.map((account) => account.owner)),
    },
    {
      id: "lifecycle",
      label: "Lifecycle",
      type: "select",
      options: optionSet(accounts.map((account) => account.lifecycle)),
    },
    {
      id: "health",
      label: "Health",
      type: "select",
      options: optionSet(accounts.map((account) => account.health)),
    },
  ];
}

function healthVariant(health: RelationshipHealth) {
  if (health === "Healthy") return "success" as const;
  if (health === "Attention") return "error" as const;
  return "warning" as const;
}

const TABLE_COLUMNS: TableColumn<CrmPreviewAccount>[] = COLUMN_CONFIG.map(
  (column) => {
    switch (column.id) {
      case "account":
        return {
          ...column,
          width: 230,
          sortable: true,
          sortValue: (item) => item.account,
          render: (item) => (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {item.account}
              </p>
              {item.company ? (
                <p className="truncate text-xs text-muted-foreground">
                  {item.company}
                </p>
              ) : null}
            </div>
          ),
        };
      case "attentionReason":
        return {
          ...column,
          width: 360,
          sortable: false,
          render: (item) => (
            <div className="flex min-w-0 max-w-md items-start gap-2 text-sm leading-5">
              {item.health !== "Healthy" ? (
                <AlertTriangle
                  aria-hidden
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning"
                />
              ) : (
                <span aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              )}
              <span
                className="block min-w-0 truncate"
                title={item.attentionReason}
              >
                {item.attentionReason}
              </span>
            </div>
          ),
        };
      case "owner":
        return {
          ...column,
          width: 170,
          sortable: true,
          sortValue: (item) => item.owner,
          render: (item) => (
            <span className="whitespace-nowrap text-sm">{item.owner}</span>
          ),
        };
      case "lifecycle":
        return {
          ...column,
          width: 140,
          sortable: true,
          sortValue: (item) => item.lifecycle,
          render: (item) => (
            <StatusBadge status={item.lifecycle} variant="neutral" />
          ),
        };
      case "lastActivity":
        return {
          ...column,
          width: 210,
          sortable: true,
          sortValue: (item) => item.lastActivity,
          render: (item) => (
            <span className="whitespace-nowrap text-sm text-muted-foreground">
              {item.lastActivity}
            </span>
          ),
        };
      case "nextFollowUp":
        return {
          ...column,
          width: 150,
          sortable: true,
          sortValue: (item) => item.nextFollowUp ?? "",
          render: (item) =>
            item.nextFollowUp ? (
              <span
                className={
                  item.isOverdue
                    ? "inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium text-destructive"
                    : "whitespace-nowrap text-sm"
                }
              >
                {item.isOverdue && (
                  <Clock3 aria-hidden className="h-3.5 w-3.5" />
                )}
                {item.nextFollowUp}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">
                Not scheduled
              </span>
            ),
        };
      default:
        return {
          ...column,
          width: 120,
          sortable: true,
          sortValue: (item) => item.health,
          render: (item) => (
            <StatusBadge
              status={item.health}
              variant={healthVariant(item.health)}
            />
          ),
        };
    }
  },
);

function PreviewStatePage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <PageContainer maxWidth="2xl">
      <PageHeader
        title="CRM relationships"
        description="Shared relationship health, pipeline, and follow-up work"
      />
      <ErrorState title={title} description={description} />
    </PageContainer>
  );
}

export function CrmRelationshipDashboardPreview({
  accounts: accountsOverride,
  state = "ready",
}: {
  accounts?: CrmPreviewAccount[];
  state?: CrmPreviewState;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const localCrm = useCrmWorkspace();
  const [leadDialogOpen, setLeadDialogOpen] = React.useState(false);
  const [leadOrganizationName, setLeadOrganizationName] = React.useState("");
  const [leadContactName, setLeadContactName] = React.useState("");
  const [leadContactEmail, setLeadContactEmail] = React.useState("");
  const [leadContactPhone, setLeadContactPhone] = React.useState("");
  const [isCreatingLead, setIsCreatingLead] = React.useState(false);
  const accounts = React.useMemo(
    () =>
      accountsOverride ?? [
        ...localCrm.accounts
          .filter(
            (account) =>
              !localCrm.archivedAccountIds.includes(account.companyId),
          )
          .map((account) => {
            const lifecycleMap: Record<string, LifecycleStage> = {
              lead: "Lead",
              prospect: "Qualified",
              active_client: "Active client",
              past_client: "Past client",
              dormant: "Past client",
            };
            const healthMap: Record<string, RelationshipHealth> = {
              active: "Healthy",
              watch: "Watch",
              stale: "Attention",
              unknown: "Watch",
            };
            const nextFollowUp = account.nextFollowUpAt
              ? new Date(
                  `${account.nextFollowUpAt}T12:00:00`,
                ).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              : null;
            return {
              id: `account:${account.companyId}`,
              account: account.name,
              owner: account.owner.name,
              lifecycle: lifecycleMap[account.lifecycleStage],
              health: healthMap[account.healthStatus],
              attentionReason: account.healthReason,
              lastActivity: account.lastMeaningfulActivityAt
                ? new Date(account.lastMeaningfulActivityAt).toLocaleDateString(
                    "en-US",
                    { month: "short", day: "numeric" },
                  )
                : "No meaningful activity",
              nextFollowUp,
              isOverdue: Boolean(
                account.nextFollowUpAt &&
                account.nextFollowUpAt < new Date().toISOString().slice(0, 10),
              ),
            };
          }),
        ...localCrm.leads
          .filter((lead) => lead.status !== "converted")
          .map((lead) => {
            const healthMap: Record<string, RelationshipHealth> = {
              active: "Healthy",
              watch: "Watch",
              stale: "Attention",
              unknown: "Watch",
            };
            const nextFollowUp = lead.nextFollowUpAt
              ? new Date(`${lead.nextFollowUpAt}T12:00:00`).toLocaleDateString(
                  "en-US",
                  { month: "short", day: "numeric" },
                )
              : null;
            return {
              id: `lead:${lead.id}`,
              account: lead.fullName,
              company: lead.prospectCompanyName,
              owner: lead.owner.name,
              lifecycle: (lead.status === "qualified"
                ? "Qualified"
                : "Lead") as LifecycleStage,
              health: healthMap[lead.healthStatus],
              attentionReason: lead.healthReason,
              lastActivity: lead.lastMeaningfulActivityAt
                ? new Date(lead.lastMeaningfulActivityAt).toLocaleDateString(
                    "en-US",
                    { month: "short", day: "numeric" },
                  )
                : "No meaningful activity",
              nextFollowUp,
              isOverdue: Boolean(
                lead.nextFollowUpAt &&
                lead.nextFollowUpAt < new Date().toISOString().slice(0, 10),
              ),
            };
          }),
      ],
    [
      accountsOverride,
      localCrm.accounts,
      localCrm.archivedAccountIds,
      localCrm.leads,
    ],
  );
  const tableState = useUnifiedTableState({
    entityKey: "crm-relationship-preview",
    pathname,
    router,
    searchParams,
    defaults: {
      view: "table",
      allowedViews: ["table", "card"],
      page: 1,
      perPage: 25,
      visibleColumns: DEFAULT_VISIBLE_COLUMNS,
      filters: {},
      sortBy: "health",
      sortDirection: "asc",
    },
  });

  const filteredAccounts = React.useMemo(() => {
    if (state === "empty") return [];

    const query = tableState.debouncedSearch.trim().toLocaleLowerCase();
    return accounts.filter((account) => {
      const matchesSearch =
        !query ||
        [
          account.account,
          account.company,
          account.owner,
          account.attentionReason,
          account.lifecycle,
          account.health,
        ]
          .filter((value): value is string => Boolean(value))
          .some((value) => value.toLocaleLowerCase().includes(query));
      const matchesOwner =
        !tableState.activeFilters.owner ||
        account.owner === tableState.activeFilters.owner;
      const matchesLifecycle =
        !tableState.activeFilters.lifecycle ||
        account.lifecycle === tableState.activeFilters.lifecycle;
      const matchesHealth =
        !tableState.activeFilters.health ||
        account.health === tableState.activeFilters.health;

      return matchesSearch && matchesOwner && matchesLifecycle && matchesHealth;
    });
  }, [
    accounts,
    state,
    tableState.activeFilters.health,
    tableState.activeFilters.lifecycle,
    tableState.activeFilters.owner,
    tableState.debouncedSearch,
  ]);

  const createLead = async () => {
    if (!leadOrganizationName.trim()) {
      toast.error("Enter the prospect organization name.");
      return;
    }
    if (!leadContactName.trim()) {
      toast.error("Enter the lead's full name.");
      return;
    }

    setIsCreatingLead(true);
    try {
      await localCrm.createLead({
        fullName: leadContactName.trim(),
        prospectCompanyName: leadOrganizationName.trim(),
        email: leadContactEmail.trim(),
        phone: leadContactPhone.trim(),
      });
      setLeadDialogOpen(false);
      setLeadOrganizationName("");
      setLeadContactName("");
      setLeadContactEmail("");
      setLeadContactPhone("");
      toast.success("Lead added");
    } catch (error) {
      toast.error("Lead could not be added", {
        description:
          error instanceof Error
            ? error.message
            : "Refresh the CRM workspace and try again.",
      });
    } finally {
      setIsCreatingLead(false);
    }
  };

  if (state === "error") {
    return (
      <PreviewStatePage
        title="CRM preview could not load"
        description="Reload the CRM workspace. Partial results are not displayed."
      />
    );
  }

  if (state === "denied") {
    return (
      <PreviewStatePage
        title="CRM access is not available"
        description="Your CRM visibility scope could not be confirmed for this preview."
      />
    );
  }

  if (localCrm.error && accountsOverride === undefined) {
    return (
      <PreviewStatePage
        title="CRM could not load"
        description={`${localCrm.error.message} Reload after correcting the connection or permission issue.`}
      />
    );
  }

  return (
    <UnifiedTablePage
      header={{
        title: "CRM relationships",
        description: "Shared relationship health, pipeline, and follow-up work",
        actions:
          accountsOverride === undefined ? (
            <div className="flex items-center gap-2">
              {localCrm.archivedAccountIds.length ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await Promise.all(
                        localCrm.archivedAccountIds.map(
                          localCrm.restoreAccount,
                        ),
                      );
                      toast.success("Archived relationships restored");
                    } catch (error) {
                      toast.error("Relationships could not be restored", {
                        description:
                          error instanceof Error
                            ? error.message
                            : "Refresh and try again.",
                      });
                    }
                  }}
                >
                  Restore archived ({localCrm.archivedAccountIds.length})
                </Button>
              ) : null}
              <Button size="sm" onClick={() => setLeadDialogOpen(true)}>
                Add lead
              </Button>
              <Modal
                open={leadDialogOpen}
                onOpenChange={(open) => {
                  setLeadDialogOpen(open);
                  if (!open) {
                    setLeadOrganizationName("");
                    setLeadContactName("");
                    setLeadContactEmail("");
                    setLeadContactPhone("");
                  }
                }}
              >
                <ModalContent size="sm" aria-describedby={undefined}>
                  <ModalHeader>
                    <ModalTitle>Add lead</ModalTitle>
                  </ModalHeader>
                  <form
                    className="space-y-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void createLead();
                    }}
                  >
                    <label
                      htmlFor="crm-lead-organization"
                      className="block text-sm font-medium text-foreground"
                    >
                      Organization name
                    </label>
                    <Input
                      id="crm-lead-organization"
                      aria-label="Organization name"
                      value={leadOrganizationName}
                      onChange={(event) =>
                        setLeadOrganizationName(event.target.value)
                      }
                      placeholder="Prospect organization"
                      maxLength={300}
                      autoFocus
                    />
                    <Input
                      aria-label="Primary contact"
                      required
                      value={leadContactName}
                      onChange={(event) =>
                        setLeadContactName(event.target.value)
                      }
                      placeholder="Primary contact *"
                      maxLength={200}
                    />
                    <Input
                      aria-label="Email"
                      type="email"
                      value={leadContactEmail}
                      onChange={(event) =>
                        setLeadContactEmail(event.target.value)
                      }
                      placeholder="Email (optional)"
                      maxLength={320}
                    />
                    <Input
                      aria-label="Phone"
                      type="tel"
                      value={leadContactPhone}
                      onChange={(event) =>
                        setLeadContactPhone(event.target.value)
                      }
                      placeholder="Phone (optional)"
                      maxLength={50}
                    />
                    <p className="text-sm text-muted-foreground">
                      This creates a CRM prospect only. It does not create an
                      Acumatica company.
                    </p>
                    <ModalFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setLeadDialogOpen(false)}
                        disabled={isCreatingLead}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={
                          !leadOrganizationName.trim() ||
                          !leadContactName.trim() ||
                          isCreatingLead
                        }
                      >
                        {isCreatingLead ? "Creating..." : "Create lead"}
                      </Button>
                    </ModalFooter>
                  </form>
                </ModalContent>
              </Modal>
            </div>
          ) : undefined,
      }}
      tabs={buildCrmWorkspaceTabs(pathname)}
      toolbar={{
        totalItems: accounts.length,
        filteredItems: filteredAccounts.length,
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: "Search accounts, owners, or reasons...",
        currentView: tableState.currentView,
        onViewChange: tableState.setCurrentView,
        enabledViews: ["table", "card"],
        viewSwitcherDisplay: "icons",
        filters: buildFilters(accounts),
        activeFilters: tableState.activeFilters,
        onFilterChange: tableState.setActiveFilters,
        onClearFilters: () => tableState.setActiveFilters({}),
        columns: COLUMN_CONFIG,
        visibleColumns: tableState.visibleColumns,
        onColumnVisibilityChange: tableState.setVisibleColumns,
      }}
      data={{
        items: filteredAccounts,
        isLoading: state === "loading" || localCrm.isLoading,
      }}
      table={{
        columns: TABLE_COLUMNS,
        getRowId: (item) => item.id,
        onRowClick:
          accountsOverride === undefined
            ? (item) => {
                if (item.id.startsWith("account:")) {
                  router.push(`/crm/companies/${item.id.slice(8)}`);
                } else if (item.id.startsWith("lead:")) {
                  router.push(
                    `/crm/leads?leadId=${encodeURIComponent(item.id.slice(5))}`,
                  );
                }
              }
            : undefined,
        rowActions:
          accountsOverride === undefined
            ? (item) =>
                item.id.startsWith("account:") ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      const reason = window.prompt(
                        `Why are you archiving ${item.account}?`,
                      );
                      if (reason === null) return;
                      try {
                        await localCrm.archiveAccount(item.id.slice(8), reason);
                        toast.success("Relationship archived");
                      } catch (error) {
                        toast.error("Relationship could not be archived", {
                          description:
                            error instanceof Error
                              ? error.message
                              : reason.trim()
                                ? "Archive this account's open deals first."
                                : "Enter an archive reason.",
                        });
                      }
                    }}
                  >
                    Archive
                  </Button>
                ) : null
            : undefined,
        stickyHeader: true,
      }}
      views={{
        card: (item) => (
          <article
            className={
              accountsOverride === undefined
                ? "cursor-pointer space-y-3 rounded-md border border-border bg-background p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                : "space-y-3 rounded-md border border-border bg-background p-4"
            }
            role={accountsOverride === undefined ? "link" : undefined}
            tabIndex={accountsOverride === undefined ? 0 : undefined}
            onClick={() => {
              if (accountsOverride !== undefined) return;
              router.push(
                item.id.startsWith("account:")
                  ? `/crm/companies/${item.id.slice(8)}`
                  : `/crm/leads?leadId=${encodeURIComponent(item.id.slice(5))}`,
              );
            }}
            onKeyDown={(event) => {
              if (
                accountsOverride !== undefined ||
                (event.key !== "Enter" && event.key !== " ")
              ) {
                return;
              }
              event.preventDefault();
              router.push(
                item.id.startsWith("account:")
                  ? `/crm/companies/${item.id.slice(8)}`
                  : `/crm/leads?leadId=${encodeURIComponent(item.id.slice(5))}`,
              );
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{item.account}</p>
                <p className="text-xs text-muted-foreground">
                  {item.company ?? item.owner}
                </p>
              </div>
              <StatusBadge
                status={item.health}
                variant={healthVariant(item.health)}
              />
            </div>
            <p className="text-sm leading-5">{item.attentionReason}</p>
            <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
              <span>{item.lastActivity}</span>
              <span className={item.isOverdue ? "text-destructive" : undefined}>
                {item.nextFollowUp ?? "No next step"}
              </span>
            </div>
          </article>
        ),
      }}
      emptyState={{
        title:
          state === "empty" || accounts.length === 0
            ? "No relationship records yet"
            : "No relationships match this view",
        description:
          state === "empty" || accounts.length === 0
            ? "No CRM relationships have been added yet."
            : "Try changing the search or clearing a filter.",
        filteredDescription: "Try changing the search or clearing a filter.",
        isFiltered:
          Boolean(tableState.debouncedSearch) ||
          Object.values(tableState.activeFilters).some(Boolean),
        icon: <Building2 aria-hidden className="h-5 w-5" />,
      }}
      layout={{
        ...CRM_WORKSPACE_TABLE_LAYOUT,
        minWidth: 1240,
        removeTableFrame: true,
      }}
      features={{
        enablePagination: false,
        enableSearch: true,
        enableViews: true,
        enableFilters: true,
        enableColumnToggle: true,
        enableExport: false,
        enableBulkDelete: false,
        enableRowSelection: false,
        enableRowActions: accountsOverride === undefined,
        enableColumnReorder: true,
        enableRowReorder: false,
        enableColumnPinning: true,
        enableInlineEditing: false,
      }}
    />
  );
}
