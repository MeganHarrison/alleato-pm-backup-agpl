"use client";

import * as React from "react";
import type { ReactElement } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Mail, Plus } from "lucide-react";
import { toast } from "sonner";

import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";
import { apiFetch } from "@/lib/api-client";
import type {
  EmailImportanceFeedbackState,
  EmailImportanceSignal,
} from "@/lib/ai/email-importance-feedback-types";
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
import { Button } from "@/components/ui/button";
import {
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterValue,
} from "@/components/tables/unified";
import {
  isOutlookSourced,
  useAllEmails,
  useDeleteEmail,
  useEmails,
  type EmailSource,
  type ProjectEmail,
} from "@/hooks/use-emails";
import {
  buildEmailTableColumns,
  buildEmailVisibleColumns,
  buildEmailFilters,
  emailColumns,
  globalEmailColumns,
  renderEmailCard,
  renderEmailList,
  renderEmailRowActions,
} from "@/features/emails/emails-table-config";
import { EmailComposeDialog } from "@/features/emails/email-compose-dialog";
import { EmailImportanceFeedbackDialog } from "@/features/emails/email-importance-feedback-dialog";
import { MarkAsJunkDialog } from "@/features/emails/mark-as-junk-dialog";
import {
  EmailReadingPanel,
  EmailTrainingFeedbackPanel,
  ProjectEmailsWorkspace,
} from "@/features/emails/project-emails-workspace";
import {
  EmailViewSwitcher,
  type EmailViewMode,
} from "@/features/emails/email-view-switcher";
import {
  AiReviewPanel,
  AI_REVIEW_PANEL_ENABLED,
} from "@/features/emails/ai-review-panel";
import { EmailFilterPopover } from "@/features/emails/email-filter-popover";
import {
  buildMailboxWorkflowTabs,
  countMailboxEmailsByWorkflow,
  matchesMailboxWorkflowFilter,
  normalizeMailboxWorkflowFilter,
} from "@/features/emails/mailbox-workflow-tabs";
import {
  chunkImportanceFeedbackEmailIds,
  EMAIL_IMPORTANCE_DEFAULT_FILTER,
  getEmailsRefreshInterval,
  matchesEmailImportanceVisibility,
  normalizeEmailImportanceVisibilityFilter,
  reconcileSelectedEmail,
} from "./emails-client.helpers";
import { EmailAttachmentsClient } from "../email-attachments/email-attachments-client";

const EMAIL_STATUS_OPTIONS = [
  { value: "Draft", label: "Draft" },
  { value: "Sent", label: "Sent" },
  { value: "Received", label: "Received" },
  { value: "Failed", label: "Failed" },
];

const EMPTY_FILTERS: Record<string, FilterValue> = {
  status: undefined,
  project_id: undefined,
  from: undefined,
  to: undefined,
  has_attachments: undefined,
  is_starred: undefined,
  importance: undefined,
  sent_at_from: undefined,
  sent_at_to: undefined,
};

type FilterState = Record<string, FilterValue>;

interface EmailClientTab {
  label: string;
  href: string;
  count?: number;
  isActive?: boolean;
  testId?: string;
  countTestId?: string;
  compact?: boolean;
}

interface EmailsClientProps {
  embedded?: boolean;
  navigationTabs?: EmailClientTab[];
  projectId?: number;
  mailboxUserId?: string;
  scope?: "project" | "global";
  source?: EmailSource;
}

export function EmailsClient({
  projectId,
  mailboxUserId,
  navigationTabs,
  scope = "project",
  source = "app",
  embedded = false,
}: EmailsClientProps): ReactElement {
  const router = useRouter();
  const pathname = usePathname()!;
  const searchParams = (useSearchParams() ?? new URLSearchParams()) as NonNullable<ReturnType<typeof useSearchParams>>;
  const isGlobal = scope === "global" || !projectId;
  const isOutlook = source === "outlook";
  const isMailboxReviewMode = Boolean(mailboxUserId);
  const activeTab =
    isOutlook && searchParams.get("tab") === "attachments"
      ? "attachments"
      : "emails";
  // The standalone Outlook-only routes were removed (the source filter on the
  // main Emails page covers them), so links always target the unified surface.
  const emailsHref = isGlobal ? "/emails" : `/${projectId}/emails`;
  const outlookTabs = isOutlook
    ? [
        {
          label: "Outlook Emails",
          href: emailsHref,
          isActive: activeTab === "emails",
        },
        {
          label: "Attachments",
          href: `${emailsHref}?tab=attachments`,
          isActive: activeTab === "attachments",
        },
      ]
    : undefined;
  const title = isMailboxReviewMode
    ? "Feedback inbox"
    : isOutlook
      ? "Outlook Emails"
      : "Emails";
  const description = isOutlook
    ? isGlobal
      ? "All Microsoft Outlook emails synced across projects."
      : "Microsoft Outlook emails synced to this project."
    : isGlobal
      ? "Application and Resend emails across projects."
      : undefined;
  // Outlook emails can be bulk-deleted from our system even though they can't be edited
  const noWriteActions = isGlobal || isOutlook;
  const allowBulkDelete = !isGlobal;
  const initialStatus = searchParams.get("status") ?? "";
  const initialProjectId = searchParams.get("project_id") ?? "";
  const initialFrom = searchParams.get("from") ?? "";
  const initialTo = searchParams.get("to") ?? "";
  const initialHasAttachments = searchParams.get("has_attachments") === "true";
  const initialIsStarred = searchParams.get("is_starred") === "true";
  const initialSentAtFrom = searchParams.get("sent_at_from") ?? "";
  const initialSentAtTo = searchParams.get("sent_at_to") ?? "";
  const initialImportance = normalizeEmailImportanceVisibilityFilter(
    searchParams.get("importance"),
  );
  const initialFilters: FilterState = {
    status: initialStatus || undefined,
    project_id: initialProjectId || undefined,
    from: initialFrom || undefined,
    to: initialTo || undefined,
    has_attachments: initialHasAttachments || undefined,
    is_starred: initialIsStarred || undefined,
    importance:
      initialImportance === EMAIL_IMPORTANCE_DEFAULT_FILTER
        ? undefined
        : initialImportance,
    sent_at_from: initialSentAtFrom || undefined,
    sent_at_to: initialSentAtTo || undefined,
  };

  const tableState = useUnifiedTableState({
    entityKey: isGlobal ? "emails-global" : "emails",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      page: 1,
      perPage: 25,
      search: "",
      sortBy: "sent_at",
      sortDirection: "desc",
      visibleColumns: isGlobal
        ? buildEmailVisibleColumns({
            showProject: true,
            showAssistantReview: isMailboxReviewMode,
          })
        : buildEmailVisibleColumns({
            showProject: false,
            showAssistantReview: false,
          }),
      filters: initialFilters,
    },
  });

  const projectEmailsQuery = useEmails(projectId ?? 0, undefined, source);
  const globalEmailsQuery = useAllEmails(
    undefined,
    isGlobal,
    source,
    mailboxUserId,
    {
      refetchInterval: getEmailsRefreshInterval(isMailboxReviewMode),
    },
  );
  const activeQuery = isGlobal ? globalEmailsQuery : projectEmailsQuery;
  const {
    data: emails = [],
    isLoading,
    error: fetchError,
    refetch: refetchEmails,
  } = activeQuery;
  const deleteEmail = useDeleteEmail(projectId ?? 0);

  // Mail / Table / List view. "mail" is the reading-pane workspace; table/list
  // defer to UnifiedTablePage. Embedded surfaces default to the compact table.
  const viewRaw = searchParams.get("view");
  const emailView: EmailViewMode =
    viewRaw === "mail" || viewRaw === "table" || viewRaw === "list"
      ? viewRaw
      : embedded
        ? "table"
        : "mail";

  const handleSortChange = React.useCallback(
    (sortBy: string, direction: "asc" | "desc") => {
      tableState.setSortBy(sortBy);
      tableState.setSortDirection(direction);
      tableState.setSearchParams({
        sort: sortBy,
        sort_dir: direction,
        page: "1",
      });
      tableState.setPage(1);
    },
    [tableState],
  );

  const handleEmailViewChange = React.useCallback(
    (next: EmailViewMode) => {
      tableState.setSearchParams({ view: next, page: "1" });
      if (next === "table" || next === "list") {
        tableState.setCurrentView(next);
      }
      tableState.setPage(1);
    },
    [tableState],
  );

  const [composeOpen, setComposeOpen] = React.useState(false);
  const [editingEmail, setEditingEmail] = React.useState<ProjectEmail | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [emailToDelete, setEmailToDelete] = React.useState<ProjectEmail | null>(null);
  const [selectedEmail, setSelectedEmail] = React.useState<ProjectEmail | null>(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = React.useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = React.useState(false);
  const [junkDialogOpen, setJunkDialogOpen] = React.useState(false);
  const [emailToMarkAsJunk, setEmailToMarkAsJunk] = React.useState<ProjectEmail | null>(null);
  const [importanceDialogOpen, setImportanceDialogOpen] = React.useState(false);
  const [emailToRateImportance, setEmailToRateImportance] =
    React.useState<ProjectEmail | null>(null);
  const [importanceSignal, setImportanceSignal] =
    React.useState<EmailImportanceSignal | null>(null);
  const [importanceFeedbackByEmailId, setImportanceFeedbackByEmailId] =
    React.useState<Record<string, EmailImportanceFeedbackState>>({});

  // When the page is mounted with source="all" (the unified project Emails
  // view), `emails` already contains both app-composed and Outlook-synced
  // messages. `sourceFilter` narrows the displayed set client-side so the user
  // can switch between All / App / Outlook without a refetch.
  const isMerged = source === "all";
  const [sourceFilter, setSourceFilter] = React.useState<EmailSource>(() => {
    const param = searchParams.get("source");
    return param === "app" || param === "outlook" ? param : "all";
  });

  const handleSourceFilterChange = React.useCallback(
    (next: EmailSource) => {
      setSourceFilter(next);
      tableState.setSearchParams({
        source: next === "all" ? null : next,
        page: "1",
      });
      tableState.setPage(1);
    },
    [tableState],
  );

  // Sync URL status filter
  React.useEffect(() => {
    setSelectedEmail((current) => reconcileSelectedEmail(emails, current));
  }, [emails]);

  React.useEffect(() => {
    const nextImportance = normalizeEmailImportanceVisibilityFilter(
      searchParams.get("importance"),
    );
    const nextFilters: FilterState = {
      status: searchParams.get("status") || undefined,
      project_id: searchParams.get("project_id") || undefined,
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined,
      has_attachments:
        searchParams.get("has_attachments") === "true" ? true : undefined,
      is_starred: searchParams.get("is_starred") === "true" ? true : undefined,
      importance:
        nextImportance === EMAIL_IMPORTANCE_DEFAULT_FILTER
          ? undefined
          : nextImportance,
      sent_at_from: searchParams.get("sent_at_from") || undefined,
      sent_at_to: searchParams.get("sent_at_to") || undefined,
    };

    tableState.setActiveFilters((prev) => {
      const changed = Object.keys(nextFilters).some(
        (key) => prev[key] !== nextFilters[key],
      );
      if (!changed) return prev;
      return nextFilters;
    });
  }, [searchParams, tableState.setActiveFilters]);

  // Set default visible columns
  React.useEffect(() => {
    if (tableState.visibleColumns.length === 0) {
      tableState.setVisibleColumns(
        isGlobal
          ? buildEmailVisibleColumns({
              showProject: true,
              showAssistantReview: isMailboxReviewMode,
            })
          : buildEmailVisibleColumns({
              showProject: false,
              showAssistantReview: false,
            }),
      );
    }
  }, [isGlobal, isMailboxReviewMode, tableState.visibleColumns.length, tableState.setVisibleColumns]);

  // Auto-switch to list view on mobile
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.innerWidth >= 768) return;
    if (tableState.currentView !== "table") return;

    tableState.setCurrentView("list");
    tableState.setSearchParams({ view: "list" });
  }, [tableState.currentView, tableState.setCurrentView, tableState.setSearchParams]);

  const activeFilters = tableState.activeFilters as FilterState;
  const statusFilter = activeFilters.status as string | undefined;
  const projectFilter = activeFilters.project_id as string | undefined;
  const fromFilter = (activeFilters.from as string | undefined)?.trim().toLowerCase();
  const toFilter = (activeFilters.to as string | undefined)?.trim().toLowerCase();
  const hasAttachmentsFilter = activeFilters.has_attachments === true;
  const isStarredFilter = activeFilters.is_starred === true;
  const sentAtFromFilter = activeFilters.sent_at_from as string | undefined;
  const sentAtToFilter = activeFilters.sent_at_to as string | undefined;
  const importanceFilter = normalizeEmailImportanceVisibilityFilter(
    activeFilters.importance as string | undefined,
  );
  const searchTerm = tableState.debouncedSearch.trim().toLowerCase();
  const workflowFilter = normalizeMailboxWorkflowFilter(
    searchParams.get("workflow"),
  );
  const mailboxWorkflowCounts = React.useMemo(
    () => countMailboxEmailsByWorkflow(emails, importanceFeedbackByEmailId),
    [emails, importanceFeedbackByEmailId],
  );
  const mailboxWorkflowTabs = React.useMemo(
    () =>
      isMailboxReviewMode
        ? buildMailboxWorkflowTabs({
            pathname,
            searchParams: new URLSearchParams(searchParams.toString()),
            counts: mailboxWorkflowCounts,
            activeWorkflow: workflowFilter,
          })
        : null,
    [isMailboxReviewMode, mailboxWorkflowCounts, pathname, workflowFilter, searchParams],
  );
  const tabs = mailboxWorkflowTabs ?? navigationTabs ?? outlookTabs;

  const filteredEmails = emails.filter((email) => {
    if (
      isMailboxReviewMode &&
      !matchesMailboxWorkflowFilter(
        email,
        workflowFilter,
        importanceFeedbackByEmailId,
      )
    ) {
      return false;
    }
    if (isMerged && sourceFilter !== "all") {
      const outlook = isOutlookSourced(email);
      if (sourceFilter === "outlook" && !outlook) return false;
      if (sourceFilter === "app" && outlook) return false;
    }
    if (statusFilter && email.status !== statusFilter) return false;
    if (projectFilter && String(email.project_id) !== projectFilter) return false;
    if (fromFilter) {
      const sender =
        `${email.from_name ?? ""} ${email.from_email ?? ""}`.toLowerCase();
      if (!sender.includes(fromFilter)) return false;
    }
    if (toFilter) {
      const recipients = (email.to_list ?? []).join(" ").toLowerCase();
      if (!recipients.includes(toFilter)) return false;
    }
    if (hasAttachmentsFilter && !email.has_attachments) return false;
    if (isStarredFilter && !email.is_starred) return false;
    if (
      !matchesEmailImportanceVisibility(
        email,
        importanceFeedbackByEmailId,
        importanceFilter,
      )
    ) {
      return false;
    }
    if (sentAtFromFilter || sentAtToFilter) {
      const emailDateRaw = email.sent_at || email.received_at || email.created_at;
      if (!emailDateRaw) return false;
      const emailDate = new Date(emailDateRaw);
      if (Number.isNaN(emailDate.getTime())) return false;
      if (sentAtFromFilter) {
        const fromDate = new Date(`${sentAtFromFilter}T00:00:00`);
        if (emailDate < fromDate) return false;
      }
      if (sentAtToFilter) {
        const toDate = new Date(`${sentAtToFilter}T23:59:59.999`);
        if (emailDate > toDate) return false;
      }
    }
    if (!searchTerm) return true;

    const fields = [
      email.subject ?? "",
      email.from_name ?? "",
      email.from_email ?? "",
      email.to_list?.join(" ") ?? "",
      email.body ?? "",
      email.project?.name ?? "",
      email.project?.project_number ?? "",
    ];

    return fields.some((field) => field.toLowerCase().includes(searchTerm));
  });

  const tableColumns = buildEmailTableColumns({
    showProject: isGlobal,
    showAssistantReview: isMailboxReviewMode,
  });
  const sortedEmails = React.useMemo(() => {
    if (!tableState.sortBy) return filteredEmails;
    const sortColumn = tableColumns.find((col) => col.id === tableState.sortBy);
    const getSortValue = sortColumn?.sortValue;
    if (!getSortValue) return filteredEmails;

    const sorted = [...filteredEmails].sort((a, b) => {
      const valueA = getSortValue(a);
      const valueB = getSortValue(b);

      if (valueA == null && valueB == null) return 0;
      if (valueA == null) return tableState.sortDirection === "asc" ? -1 : 1;
      if (valueB == null) return tableState.sortDirection === "asc" ? 1 : -1;

      if (typeof valueA === "number" && typeof valueB === "number") {
        return tableState.sortDirection === "asc" ? valueA - valueB : valueB - valueA;
      }

      const comparison = String(valueA).localeCompare(String(valueB));
      return tableState.sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [filteredEmails, tableColumns, tableState.sortBy, tableState.sortDirection]);

  const totalItems = filteredEmails.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / tableState.perPage));
  const pageStart = (tableState.page - 1) * tableState.perPage;
  const pageEnd = pageStart + tableState.perPage;
  const pagedEmails = React.useMemo(
    () => sortedEmails.slice(pageStart, pageEnd),
    [pageEnd, pageStart, sortedEmails],
  );
  const importanceFeedbackEmailIds = React.useMemo(
    () =>
      Array.from(
        new Set(
          emails.map((email) => String(email.id)),
        ),
      ),
    [emails],
  );

  React.useEffect(() => {
    if (tableState.page > totalPages) {
      tableState.setPage(1);
      tableState.setSearchParams({ page: "1" });
    }
  }, [tableState.page, tableState.setPage, tableState.setSearchParams, totalPages]);

  React.useEffect(() => {
    if (importanceFeedbackEmailIds.length === 0) return;

    const controller = new AbortController();

    // The importance-feedback endpoint takes one `emailId` query param per email.
    // A large mailbox (Brandon's has ~1000) overflows the request URL/header size
    // limit → HTTP 431, silently dropping the training state for the whole inbox.
    // Chunk the ids so every request URL stays well under that limit.
    const batches = chunkImportanceFeedbackEmailIds(importanceFeedbackEmailIds);

    void (async () => {
      try {
        const responses = await Promise.all(
          batches.map((batch) => {
            const params = new URLSearchParams();
            for (const emailId of batch) {
              params.append("emailId", emailId);
            }
            return apiFetch<{
              feedbackByEmailId?: Record<string, EmailImportanceFeedbackState>;
            }>(
              `/api/ai-assistant/email-importance-feedback?${params.toString()}`,
              {
                signal: controller.signal,
              },
            );
          }),
        );

        if (controller.signal.aborted) return;

        const merged = responses.reduce<
          Record<string, EmailImportanceFeedbackState>
        >((accumulator, response) => {
          if (response.feedbackByEmailId) {
            Object.assign(accumulator, response.feedbackByEmailId);
          }
          return accumulator;
        }, {});

        if (Object.keys(merged).length === 0) return;

        setImportanceFeedbackByEmailId((prev) => ({
          ...prev,
          ...merged,
        }));
      } catch (error) {
        if (controller.signal.aborted) return;
        reportNonCriticalFailure({
          area: "emails-client",
          operation: "load-email-importance-feedback",
          error,
          userVisibleFallback:
            "Importance training state could not be loaded for these emails.",
          metadata: {
            emailIds: importanceFeedbackEmailIds.join(","),
            projectId,
            scope,
          },
        });
      }
    })();

    return () => controller.abort();
  }, [importanceFeedbackEmailIds, projectId, scope]);

  const handleFilterChange = (nextFilters: FilterState) => {
    tableState.setActiveFilters(nextFilters);
    tableState.setSearchParams({
      status: typeof nextFilters.status === "string" ? nextFilters.status : null,
      project_id:
        typeof nextFilters.project_id === "string"
          ? nextFilters.project_id
          : null,
      from: typeof nextFilters.from === "string" ? nextFilters.from : null,
      to: typeof nextFilters.to === "string" ? nextFilters.to : null,
      has_attachments: nextFilters.has_attachments === true ? "true" : null,
      is_starred: nextFilters.is_starred === true ? "true" : null,
      importance:
        typeof nextFilters.importance === "string"
          ? nextFilters.importance
          : null,
      sent_at_from:
        typeof nextFilters.sent_at_from === "string"
          ? nextFilters.sent_at_from
          : null,
      sent_at_to:
        typeof nextFilters.sent_at_to === "string"
          ? nextFilters.sent_at_to
          : null,
      page: "1",
    });
    tableState.setPage(1);
  };

  const emailFilters = React.useMemo(() => {
    const projects = Array.from(
      new Map(
        emails
          .filter(
            (email): email is ProjectEmail & {
              project: NonNullable<ProjectEmail["project"]>;
            } => Boolean(email.project),
          )
          .map((email) => [
            email.project_id,
            {
              id: email.project_id,
              label:
                [
                  email.project.project_number?.trim(),
                  email.project.name?.trim(),
                ]
                  .filter(Boolean)
                  .join(" - ") || `Project ${email.project_id}`,
            },
          ]),
      ).values(),
    ).sort((a, b) => a.label.localeCompare(b.label));

    return buildEmailFilters({
      showProject: isGlobal,
      projects,
    });
  }, [emails, isGlobal]);

  const handleOpenEmail = (item: ProjectEmail) => {
    setSelectedEmail(item);
  };

  // Outlook-synced emails are read-only in the project Emails surface. The
  // project edit/delete/task endpoints still write `project_emails`, while live
  // Outlook rows come from `outlook_email_intake`.
  const canEditEmail = React.useCallback(
    (item: ProjectEmail) => !noWriteActions && !isOutlookSourced(item),
    [noWriteActions],
  );
  const canDeleteEmail = React.useCallback(
    (item: ProjectEmail) => !noWriteActions && !isOutlookSourced(item),
    [noWriteActions],
  );

  const handleEdit = (item: ProjectEmail) => {
    if (!canEditEmail(item)) return;
    setEditingEmail(item);
    setComposeOpen(true);
  };

  const handleDeleteIntent = (item: ProjectEmail) => {
    if (!canDeleteEmail(item)) return;
    setEmailToDelete(item);
    setDeleteDialogOpen(true);
  };

  const handleMarkAsJunkIntent = (item: ProjectEmail) => {
    setEmailToMarkAsJunk(item);
    setJunkDialogOpen(true);
  };

  const handleImportanceIntent = (
    item: ProjectEmail,
    signal: EmailImportanceSignal,
  ) => {
    setEmailToRateImportance(item);
    setImportanceSignal(signal);
    setImportanceDialogOpen(true);
  };

  const handleImportanceRecorded = (
    emailId: number,
    feedback: EmailImportanceFeedbackState,
  ) => {
    setImportanceFeedbackByEmailId((prev) => ({
      ...prev,
      [String(emailId)]: feedback,
    }));
    void refetchEmails();
  };

  const handleImportanceCleared = (emailId: number) => {
    setImportanceFeedbackByEmailId((prev) => {
      const next = { ...prev };
      delete next[String(emailId)];
      return next;
    });
  };

  const handleJunkRuleCreated = async (item: ProjectEmail) => {
    // On project views with write access, optimistically delete the email
    // that prompted the rule. On read-only views (Outlook intake, global
    // inbox) we can't delete — the rule only applies to future emails, so
    // we just leave the source email in place and let the next sync clean
    // up any future duplicates.
    if (noWriteActions || !projectId || isOutlookSourced(item)) return;
    try {
      await deleteEmail.mutateAsync(String(item.id));
    } catch (err) {
      reportNonCriticalFailure({
        area: "emails-client",
        operation: "handleJunkRuleCreated",
        error: err,
        userVisibleFallback: "Rule was created but the source email could not be deleted automatically.",
      });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!emailToDelete) return;

    try {
      await deleteEmail.mutateAsync(String(emailToDelete.id));
    } catch (error) {
      reportNonCriticalFailure({
        area: "project-emails",
        operation: "delete-email",
        error,
        userVisibleFallback: "Email deletion failed and the row remains visible.",
        metadata: { projectId, emailId: emailToDelete.id },
      });
    } finally {
      setDeleteDialogOpen(false);
      setEmailToDelete(null);
    }
  };

  const handleBulkDeleteConfirm = async () => {
    const deletableIds = new Set(
      filteredEmails
        .filter(canDeleteEmail)
        .map((email) => String(email.id)),
    );
    const ids = tableState.selectedIds.filter((id) => deletableIds.has(id));
    if (ids.length === 0) return;

    setIsBulkDeleting(true);
    const errors: string[] = [];

    for (const id of ids) {
      try {
        await deleteEmail.mutateAsync(id);
      } catch {
        errors.push(`${id}: Failed to delete`);
      }
    }

    tableState.setSelectedIds([]);

    if (errors.length > 0) {
      toast.error(`${ids.length - errors.length} deleted, ${errors.length} failed`);
    } else {
      toast.success(`${ids.length} email${ids.length === 1 ? "" : "s"} deleted`);
    }

    setIsBulkDeleting(false);
    setBulkDeleteDialogOpen(false);
  };

  const handleExport = () => {
    if (filteredEmails.length === 0) {
      toast.info("No emails to export");
      return;
    }

    const cols = buildEmailTableColumns({ showProject: isGlobal });
    const visibleCols = cols.filter((col) =>
      tableState.visibleColumns.includes(col.id),
    );

    const headers = visibleCols.map((col) => col.label);
    const rows = filteredEmails.map((email) =>
      visibleCols
        .map((col) =>
          col.csvValue ? col.csvValue(email) : String(col.render(email) ?? ""),
        )
        .join(","),
    );

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${isGlobal ? "all" : "project"}-emails-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      tableState.setSelectedIds(pagedEmails.map((item) => String(item.id)));
    } else {
      tableState.setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      tableState.setSelectedIds((prev) => [...prev, id]);
    } else {
      tableState.setSelectedIds((prev) => prev.filter((itemId) => itemId !== id));
    }
  };

  const isFiltered =
    Boolean(tableState.searchInput) ||
    Object.values(activeFilters).some((value) => value !== undefined);

  if (isOutlook && activeTab === "attachments") {
    return (
      <EmailAttachmentsClient
        projectId={projectId}
        scope={isGlobal ? "global" : "project"}
        title={title}
        tabs={tabs}
      />
    );
  }

  if (emailView === "mail") {
    return (
      <>
        <ProjectEmailsWorkspace
          emails={sortedEmails}
          isLoading={isLoading}
          error={fetchError ?? undefined}
          title={title}
          tabs={tabs ?? []}
          searchValue={tableState.searchInput}
          onSearchChange={tableState.setSearchInput}
          statusFilter={statusFilter}
          onStatusFilterChange={(status) => handleFilterChange({ status })}
          showSourceFilter={isMerged}
          sourceFilter={sourceFilter}
          onSourceFilterChange={handleSourceFilterChange}
          canEdit={canEditEmail}
          canCompose={!noWriteActions}
          canDelete={canDeleteEmail}
          sortBy={tableState.sortBy ?? undefined}
          sortDirection={tableState.sortDirection}
          onSortChange={handleSortChange}
          draftFeedbackMode={isMailboxReviewMode}
          onDraftFeedbackSaved={() => {
            void refetchEmails();
          }}
          importanceFeedbackByEmailId={importanceFeedbackByEmailId}
          onImportanceRecorded={handleImportanceRecorded}
          onImportanceCleared={handleImportanceCleared}
          viewSwitcher={
            <EmailViewSwitcher
              value={emailView}
              onChange={handleEmailViewChange}
            />
          }
          filterControl={
            <EmailFilterPopover
              activeFilters={activeFilters}
              onFilterChange={handleFilterChange}
              statusOptions={EMAIL_STATUS_OPTIONS}
              showSourceFilter={isMerged}
              sourceFilter={sourceFilter}
              onSourceFilterChange={handleSourceFilterChange}
            />
          }
          onCompose={() => {
            setEditingEmail(null);
            setComposeOpen(true);
          }}
          onEdit={handleEdit}
          onDelete={handleDeleteIntent}
        />

        {projectId ? (
          <EmailComposeDialog
            open={composeOpen}
            onOpenChange={setComposeOpen}
            projectId={projectId}
            email={editingEmail}
          />
        ) : null}

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Email</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the email{" "}
                <strong>{emailToDelete?.subject}</strong>?
                <br />
                <br />
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteEmail.isPending}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                disabled={deleteEmail.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteEmail.isPending ? "Deleting..." : "Delete Email"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  return (
    <>
      {/* Embedded surfaces (e.g. global Emails tabs) suppress the page header,
          so the view switcher rides in its own bar above the table. */}
      {embedded ? (
        <div className="mb-3 flex items-center justify-end">
          <EmailViewSwitcher
            value={emailView}
            onChange={handleEmailViewChange}
          />
        </div>
      ) : null}
      <UnifiedTablePage
        features={{ enableViews: false }}
        header={{
          title: embedded ? "" : title,
          description: embedded ? undefined : description,
          actions: embedded ? undefined : (
            <div className="flex items-center gap-2">
              <EmailViewSwitcher
                value={emailView}
                onChange={handleEmailViewChange}
              />
              {noWriteActions ? null : (
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingEmail(null);
                    setComposeOpen(true);
                  }}
                  aria-label="Compose new email"
                >
                  <Plus />
                  Compose
                </Button>
              )}
            </div>
          ),
        }}
        tabs={embedded && !navigationTabs ? undefined : tabs}
        layout={{
          fullBleedTable: false,
          containerPadding: !embedded,
        }}
        toolbar={{
          totalItems,
          filteredItems: totalItems,
          selectedCount: tableState.selectedIds.length,
          searchValue: tableState.searchInput,
          onSearchChange: tableState.setSearchInput,
          searchPlaceholder: "Search emails...",
          currentView: emailView === "list" ? "list" : "table",
          onViewChange: (view) => {
            handleEmailViewChange(view === "list" ? "list" : "table");
          },
          filters: emailFilters,
          activeFilters,
          onFilterChange: handleFilterChange,
          onClearFilters: () => handleFilterChange(EMPTY_FILTERS),
          columns: isGlobal ? globalEmailColumns : emailColumns,
          visibleColumns: tableState.visibleColumns,
          onColumnVisibilityChange: tableState.setVisibleColumns,
          onExport: handleExport,
          onBulkDelete: allowBulkDelete && tableState.selectedIds.some((id) =>
            filteredEmails.some(
              (email) => String(email.id) === id && canDeleteEmail(email),
            ),
          )
            ? () => setBulkDeleteDialogOpen(true)
            : undefined,
        }}
        data={{
          items: pagedEmails,
          isLoading,
          error: fetchError ?? undefined,
        }}
        table={{
          columns: tableColumns,
          getRowId: (item) => String(item.id),
          activeRowId: selectedEmail ? String(selectedEmail.id) : null,
          onRowClick: handleOpenEmail,
          rowActions: (item) =>
            renderEmailRowActions(
              item,
              canEditEmail(item) ? handleEdit : null,
              canDeleteEmail(item) ? handleDeleteIntent : null,
              // "Mark as junk" creates a filter rule — it doesn't mutate the
              // email itself, so we expose it even on read-only views
              // (Outlook intake, global inbox) where it's most useful.
              isOutlook ? handleMarkAsJunkIntent : null,
              isOutlook
                ? (email) => handleImportanceIntent(email, "important")
                : null,
              isOutlook
                ? (email) => handleImportanceIntent(email, "not_important")
                : null,
            ),
        }}
        sorting={{
          sortBy: tableState.sortBy,
          sortDirection: tableState.sortDirection,
          onSortChange: handleSortChange,
        }}
        selection={{
          selectedIds: tableState.selectedIds,
          onSelectAll: handleSelectAll,
          onSelectRow: handleSelectRow,
        }}
        views={{
          card: (item) => renderEmailCard(item, handleOpenEmail),
          list: (item) => renderEmailList(item, handleOpenEmail),
        }}
        emptyState={{
          title: "No emails found",
          description: isMailboxReviewMode
            ? "No synced Outlook intake rows are stored for this mailbox yet."
            : isOutlook
            ? "No synced Outlook emails are stored yet."
            : isGlobal
              ? "No application or Resend emails are stored yet."
              : "You have not sent or received any project emails yet.",
          filteredDescription: "Try adjusting your search or filters",
          isFiltered,
          icon: <Mail className="h-10 w-10 text-muted-foreground" />,
          action: noWriteActions ? undefined : (
            <Button
              size="sm"
              onClick={() => {
                setEditingEmail(null);
                setComposeOpen(true);
              }}
            >
              Compose your first email
            </Button>
          ),
        }}
        pagination={{
          page: tableState.page,
          totalPages,
          perPage: tableState.perPage,
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
        sidePanel={
          selectedEmail
            ? {
                content: (
                  mailboxUserId ? (
                    AI_REVIEW_PANEL_ENABLED ? (
                      <AiReviewPanel
                        selectedEmail={selectedEmail}
                        onSaved={() => {
                          void refetchEmails();
                        }}
                        className="h-full"
                      />
                    ) : (
                      <EmailTrainingFeedbackPanel
                        selectedEmail={selectedEmail}
                        onSaved={() => {
                          void refetchEmails();
                        }}
                        className="h-full"
                      />
                    )
                  ) : (
                    <EmailReadingPanel
                      email={selectedEmail}
                      canCompose={!noWriteActions}
                      canEditEmail={canEditEmail(selectedEmail)}
                      canDelete={canDeleteEmail(selectedEmail)}
                      canProjectEmailActions={!isOutlookSourced(selectedEmail)}
                      onCompose={() => {
                        setEditingEmail(null);
                        setComposeOpen(true);
                      }}
                      onEdit={handleEdit}
                      onDelete={handleDeleteIntent}
                      importanceFeedback={
                        importanceFeedbackByEmailId[String(selectedEmail.id)] ?? null
                      }
                      onImportanceRecorded={handleImportanceRecorded}
                      onImportanceCleared={handleImportanceCleared}
                      className="h-full"
                    />
                  )
                ),
                variant: "wide",
                defaultWidth: mailboxUserId ? 720 : 560,
                minWidth: mailboxUserId ? 520 : 440,
                maxWidth: mailboxUserId ? 980 : undefined,
                storageKey: mailboxUserId
                  ? "global-email-feedback-detail"
                  : isGlobal
                    ? "global-email-detail"
                    : "project-email-detail",
                contentClassName: "pl-0 pr-0",
                showCloseButton: false,
                onClose: () => setSelectedEmail(null),
              }
            : undefined
        }
      />

      {projectId ? (
        <EmailComposeDialog
          open={composeOpen}
          onOpenChange={setComposeOpen}
          projectId={projectId}
          email={editingEmail}
        />
      ) : null}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Email</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the email{" "}
              <strong>{emailToDelete?.subject}</strong>?
              <br />
              <br />
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteEmail.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteEmail.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteEmail.isPending ? "Deleting..." : "Delete Email"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {tableState.selectedIds.length} Email
              {tableState.selectedIds.length === 1 ? "" : "s"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>{tableState.selectedIds.length}</strong> selected email
              {tableState.selectedIds.length === 1 ? "" : "s"}?
              <br />
              <br />
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDeleteConfirm}
              disabled={isBulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isBulkDeleting
                ? "Deleting..."
                : `Delete ${tableState.selectedIds.length} Email${tableState.selectedIds.length === 1 ? "" : "s"}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MarkAsJunkDialog
        email={emailToMarkAsJunk}
        open={junkDialogOpen}
        onOpenChange={(open) => {
          setJunkDialogOpen(open);
          if (!open) setEmailToMarkAsJunk(null);
        }}
        onRuleCreated={handleJunkRuleCreated}
      />

      <EmailImportanceFeedbackDialog
        email={emailToRateImportance}
        open={importanceDialogOpen}
        signal={importanceSignal}
        existingFeedback={
          emailToRateImportance
            ? importanceFeedbackByEmailId[String(emailToRateImportance.id)] ?? null
            : null
        }
        onOpenChange={(open) => {
          setImportanceDialogOpen(open);
          if (!open) {
            setEmailToRateImportance(null);
            setImportanceSignal(null);
          }
        }}
        onRecorded={handleImportanceRecorded}
      />
    </>
  );
}
