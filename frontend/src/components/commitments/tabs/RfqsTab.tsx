"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, MessageSquare } from "lucide-react";

import { EmptyState } from "@/components/ds/empty-state";
import { StatusBadge } from "@/components/ds/status-badge";
import { Text } from "@/components/ds/text";
import {
  UnifiedTablePage,
  type TableColumn,
  type ViewMode,
} from "@/components/tables/unified";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api-client";
import { formatDate } from "@/lib/table-config/formatters";

interface CommitmentRfq {
  id: string;
  rfq_number: string;
  title: string;
  status: string;
  due_date: string;
  sent_at: string | null;
  response_received_at: string | null;
  created_at: string;
  change_event_id: string;
  change_event_number: string | null;
  change_event_title: string | null;
  response_count: number;
}

interface RfqsTabProps {
  commitmentId: string;
  projectId: number;
}

function formatDateOrDash(value: string | null | undefined): string {
  return value ? formatDate(value) : "—";
}

export function RfqsTab({ commitmentId, projectId }: RfqsTabProps) {
  const [rfqs, setRfqs] = useState<CommitmentRfq[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentView, setCurrentView] = useState<ViewMode>("table");

  useEffect(() => {
    let active = true;

    const fetchRfqs = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const payload = await apiFetch<{ data?: CommitmentRfq[] }>(
          `/api/commitments/${commitmentId}/rfqs`,
        );
        if (!active) return;
        setRfqs(Array.isArray(payload.data) ? payload.data : []);
      } catch (fetchError) {
        if (!active) return;
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to load RFQs",
        );
      } finally {
        if (active) setIsLoading(false);
      }
    };

    fetchRfqs();
    return () => {
      active = false;
    };
  }, [commitmentId]);

  const filteredRfqs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return rfqs;

    return rfqs.filter((rfq) =>
      [
        rfq.rfq_number,
        rfq.title,
        rfq.status,
        rfq.due_date,
        rfq.sent_at,
        rfq.change_event_number,
        rfq.change_event_title,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [rfqs, searchQuery]);

  const columns: Array<TableColumn<CommitmentRfq>> = useMemo(
    () => [
      {
        id: "rfq_number",
        label: "RFQ #",
        alwaysVisible: true,
        sortable: true,
        sortValue: (rfq) => rfq.rfq_number,
        render: (rfq) => (
          <Link
            href={`/${projectId}/change-events/${rfq.change_event_id}`}
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            {rfq.rfq_number}
            <ArrowRight className="h-3 w-3" />
          </Link>
        ),
        csvValue: (rfq) => rfq.rfq_number,
        width: 140,
      },
      {
        id: "title",
        label: "Title",
        defaultVisible: true,
        sortable: true,
        sortValue: (rfq) => rfq.title,
        render: (rfq) => <Text size="sm">{rfq.title}</Text>,
        csvValue: (rfq) => rfq.title,
        width: 260,
      },
      {
        id: "change_event_number",
        label: "Change Event",
        defaultVisible: true,
        sortable: true,
        sortValue: (rfq) => rfq.change_event_number ?? "",
        render: (rfq) => {
          const number = rfq.change_event_number || "—";
          return (
            <Text size="sm" className="text-muted-foreground">
              {number}
            </Text>
          );
        },
        csvValue: (rfq) => rfq.change_event_number ?? "",
        width: 150,
      },
      {
        id: "status",
        label: "Status",
        defaultVisible: true,
        sortable: true,
        sortValue: (rfq) => rfq.status,
        render: (rfq) => <StatusBadge status={rfq.status || "Draft"} />,
        csvValue: (rfq) => rfq.status,
        width: 130,
      },
      {
        id: "due_date",
        label: "Due",
        defaultVisible: true,
        sortable: true,
        sortValue: (rfq) =>
          rfq.due_date ? new Date(rfq.due_date).getTime() : 0,
        render: (rfq) => (
          <Text size="sm">{formatDateOrDash(rfq.due_date)}</Text>
        ),
        csvValue: (rfq) => rfq.due_date ?? "",
        width: 130,
      },
      {
        id: "response_count",
        label: "Responses",
        defaultVisible: true,
        sortable: true,
        sortValue: (rfq) => rfq.response_count,
        render: (rfq) => (
          <Text size="sm" className="tabular-nums">
            {rfq.response_count}
          </Text>
        ),
        csvValue: (rfq) => String(rfq.response_count),
        width: 120,
      },
      {
        id: "sent_at",
        label: "Sent",
        defaultVisible: true,
        sortable: true,
        sortValue: (rfq) => (rfq.sent_at ? new Date(rfq.sent_at).getTime() : 0),
        render: (rfq) => <Text size="sm">{formatDateOrDash(rfq.sent_at)}</Text>,
        csvValue: (rfq) => rfq.sent_at ?? "",
        width: 130,
      },
    ],
    [projectId],
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (error) {
    return <Text tone="destructive">{error}</Text>;
  }

  if (rfqs.length === 0) {
    return (
      <EmptyState
        icon={<MessageSquare className="h-5 w-5 text-muted-foreground" />}
        title="No RFQs"
        description="RFQs tied to this commitment will appear here."
      />
    );
  }

  return (
    <UnifiedTablePage
      header={{
        title: "RFQs",
        description: "Requests for quote tied to this commitment.",
        variant: "compact",
      }}
      toolbar={{
        totalItems: rfqs.length,
        filteredItems: filteredRfqs.length,
        searchValue: searchQuery,
        onSearchChange: setSearchQuery,
        searchPlaceholder: "Search RFQs...",
        currentView,
        onViewChange: (view) => {
          if (view === "table") setCurrentView(view);
        },
        enabledViews: ["table"],
      }}
      data={{ items: filteredRfqs, isLoading: false, error: null }}
      table={{
        columns,
        getRowId: (rfq) => rfq.id,
        density: "compact",
        stickyHeader: true,
      }}
      emptyState={{
        title: "No RFQs",
        description: "RFQs tied to this commitment will appear here.",
        filteredDescription: "No RFQs match your search.",
        isFiltered: Boolean(searchQuery),
      }}
      features={{
        enableViews: false,
        enableColumnToggle: true,
        enableExport: true,
        enablePagination: true,
        enableBulkDelete: false,
        enableRowSelection: false,
      }}
      layout={{
        containerPadding: false,
        toolbarInlineWithHeader: true,
        minWidth: 900,
      }}
    />
  );
}
