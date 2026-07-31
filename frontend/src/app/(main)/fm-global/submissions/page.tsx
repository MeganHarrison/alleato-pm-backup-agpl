"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import {
  UnifiedTablePage,
  useUnifiedTableState,
} from "@/components/tables/unified";
import {
  buildFmGlobalSubmissionColumns,
  fmGlobalSubmissionDefaultVisibleColumns,
} from "@/features/fm-global-submissions/fm-global-submissions-table-config";
import {
  useDeleteFmGlobalSubmission,
  useFmGlobalSubmissions,
  type FmGlobalSubmissionListItem,
} from "@/hooks/use-fm-global-submissions";

export default function FmGlobalSubmissionsPage() {
  const pathname = usePathname()!;
  const router = useRouter();
  const searchParams =
    (useSearchParams() ?? new URLSearchParams()) as NonNullable<
      ReturnType<typeof useSearchParams>
    >;

  const tableState = useUnifiedTableState({
    entityKey: "fm-global-submissions",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 25,
      search: "",
      sortBy: "created_at",
      sortDirection: "desc",
      visibleColumns: fmGlobalSubmissionDefaultVisibleColumns,
      filters: {},
    },
  });

  const { data: response, isLoading, isFetching, error } =
    useFmGlobalSubmissions();
  const deleteSubmission = useDeleteFmGlobalSubmission();
  const submissions = response?.data ?? [];

  const handleDelete = React.useCallback(
    (item: FmGlobalSubmissionListItem) => {
      const label =
        item.project_details?.project_name ||
        item.contact_info?.email ||
        item.id;
      deleteSubmission.mutate(item.id, {
        onSuccess: () => toast.success(`Deleted submission for ${label}`),
        onError: (err) =>
          toast.error("Could not delete submission", {
            description: err.message,
          }),
      });
    },
    [deleteSubmission],
  );

  const search = tableState.debouncedSearch.toLowerCase().trim();
  const filteredSubmissions = React.useMemo(() => {
    if (!search) return submissions;
    return submissions.filter((item) => {
      const haystack = [
        item.contact_info?.name,
        item.contact_info?.email,
        item.project_details?.project_name,
        item.project_details?.project_location,
        item.user_input?.asrs_type,
        item.user_input?.system_type,
        item.user_input?.commodity_class,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    });
  }, [submissions, search]);

  const columns = React.useMemo(() => buildFmGlobalSubmissionColumns(), []);

  const handleRowClick = (item: FmGlobalSubmissionListItem) => {
    router.push(`/fm-global/submissions/${item.id}`);
  };

  return (
    <UnifiedTablePage
      header={{
        title: "Form Submissions",
        description:
          "ASRS sprinkler design requests submitted through the public FM Global form.",
      }}
      toolbar={{
        totalItems: submissions.length,
        filteredItems: filteredSubmissions.length,
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: "Search by name, email, project, or ASRS type...",
        currentView: tableState.currentView,
        onViewChange: tableState.setCurrentView,
      }}
      data={{
        items: filteredSubmissions,
        isLoading,
        isFetching,
        error:
          error instanceof Error
            ? error
            : error
              ? new Error("Failed to load submissions")
              : undefined,
      }}
      table={{
        columns,
        getRowId: (item) => item.id,
        onRowClick: handleRowClick,
        onDelete: handleDelete,
      }}
      emptyState={{
        title: "No submissions yet",
        description:
          "Submissions from the public FM Global form will appear here.",
        filteredDescription: "No submissions match your search.",
        isFiltered: Boolean(search),
      }}
    />
  );
}
