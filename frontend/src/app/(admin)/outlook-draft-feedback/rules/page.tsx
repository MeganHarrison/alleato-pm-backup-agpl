"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ListFilter, Plus } from "lucide-react";

import {
  UnifiedTablePage,
  useUnifiedTableState,
  type TableColumn,
} from "@/components/tables/unified";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  INBOX_RULE_ACTION_LABELS,
  INBOX_RULE_FIELD_LABELS,
  INBOX_RULE_OPERATOR_LABELS,
} from "@/lib/email-assistant/inbox-rules";
import {
  useDeleteInboxRule,
  useInboxRules,
  useToggleInboxRule,
  type InboxRuleDto,
} from "@/hooks/use-inbox-rules";
import { InboxRuleDialog } from "@/features/emails/inbox-rule-dialog";

function actionSummary(rule: InboxRuleDto): string {
  const base = INBOX_RULE_ACTION_LABELS[rule.action];
  return rule.actionValue ? `${base} ${rule.actionValue}` : base;
}

export default function OutlookInboxRulesPage() {
  const router = useRouter();
  const pathname = usePathname()!;
  const searchParams = useSearchParams();

  const { data: rules = [], isLoading, error } = useInboxRules();
  const deleteRule = useDeleteInboxRule();
  const toggleRule = useToggleInboxRule();

  const [createOpen, setCreateOpen] = React.useState(false);
  const [editRule, setEditRule] = React.useState<InboxRuleDto | null>(null);

  const tableState = useUnifiedTableState({
    entityKey: "outlook-inbox-rules",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table", "list"],
      page: 1,
      perPage: 25,
      search: "",
      sortBy: "created",
      sortDirection: "desc",
      visibleColumns: ["condition", "action", "enabled", "created"],
      filters: {},
    },
  });

  const filtered = React.useMemo(() => {
    const query = tableState.debouncedSearch.trim().toLowerCase();
    if (!query) return rules;
    return rules.filter((rule) =>
      [
        rule.value,
        rule.name ?? "",
        INBOX_RULE_FIELD_LABELS[rule.field],
        actionSummary(rule),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [rules, tableState.debouncedSearch]);

  const columns: TableColumn<InboxRuleDto>[] = React.useMemo(
    () => [
      {
        id: "condition",
        label: "When",
        alwaysVisible: true,
        sortable: true,
        sortValue: (rule) => rule.value.toLowerCase(),
        csvValue: (rule) =>
          `${INBOX_RULE_FIELD_LABELS[rule.field]} ${INBOX_RULE_OPERATOR_LABELS[rule.operator]} ${rule.value}`,
        render: (rule) => (
          <span className="text-sm text-foreground">
            <span className="font-medium">{INBOX_RULE_FIELD_LABELS[rule.field]}</span>{" "}
            <span className="text-muted-foreground">
              {INBOX_RULE_OPERATOR_LABELS[rule.operator]}
            </span>{" "}
            <span className="font-medium">&ldquo;{rule.value}&rdquo;</span>
          </span>
        ),
      },
      {
        id: "action",
        label: "Then",
        defaultVisible: true,
        sortable: true,
        sortValue: (rule) => rule.action,
        csvValue: (rule) => actionSummary(rule),
        render: (rule) => (
          <span className="text-sm text-foreground">{actionSummary(rule)}</span>
        ),
      },
      {
        id: "enabled",
        label: "Enabled",
        defaultVisible: true,
        width: 90,
        csvValue: (rule) => (rule.enabled ? "yes" : "no"),
        render: (rule) => (
          <Switch
            checked={rule.enabled}
            disabled={toggleRule.isPending}
            onCheckedChange={(next) =>
              toggleRule.mutate({ id: rule.id, enabled: next })
            }
            aria-label={rule.enabled ? "Disable rule" : "Enable rule"}
          />
        ),
      },
      {
        id: "created",
        label: "Created",
        defaultVisible: true,
        sortable: true,
        sortValue: (rule) => rule.createdAt,
        csvValue: (rule) => rule.createdAt,
        render: (rule) => (
          <span className="text-xs text-muted-foreground">
            {new Date(rule.createdAt).toLocaleDateString()}
            {rule.createdByEmail ? ` · ${rule.createdByEmail}` : ""}
          </span>
        ),
      },
    ],
    [toggleRule],
  );

  return (
    <>
      <UnifiedTablePage
        header={{
          title: "Inbox rules",
          description:
            "Gmail/Outlook-style filters that train the assistant for Brandon's mailbox. Applied automatically as mail arrives.",
          actions: (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New rule
            </Button>
          ),
        }}
        toolbar={{
          totalItems: rules.length,
          filteredItems: filtered.length,
          searchValue: tableState.searchInput,
          onSearchChange: tableState.setSearchInput,
          searchPlaceholder: "Search rules...",
          currentView: tableState.currentView,
          onViewChange: tableState.setCurrentView,
        }}
        data={{ items: filtered, isLoading, error: error ?? undefined }}
        table={{
          columns,
          getRowId: (rule) => rule.id,
          onEdit: (rule) => setEditRule(rule),
          onDelete: (rule) => deleteRule.mutateAsync(rule.id),
        }}
        emptyState={{
          title: "No inbox rules yet",
          description:
            "Create a rule to always flag mail from a sender as important, keep newsletters out of the inbox, or set a priority automatically.",
          filteredDescription: "No rules match your search.",
          isFiltered: Boolean(tableState.debouncedSearch),
          action: (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New rule
            </Button>
          ),
        }}
        layout={{ fullBleedTable: true }}
      />

      <InboxRuleDialog open={createOpen} onOpenChange={setCreateOpen} />
      <InboxRuleDialog
        open={editRule !== null}
        onOpenChange={(open) => {
          if (!open) setEditRule(null);
        }}
        rule={editRule}
      />
    </>
  );
}
