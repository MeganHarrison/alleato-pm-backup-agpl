"use client";

import { useEffect, useState, useMemo, memo } from "react";
import { Mail, Paperclip } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { EmptyState } from "@/components/ds/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ds/text";
import { DataTable } from "@/components/tables/DataTable";
import { apiFetch, ApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/table-config/formatters";

interface ProjectEmail {
  id: number;
  subject: string;
  from_email: string | null;
  from_name: string | null;
  body: string | null;
  status: string;
  sent_at: string | null;
  received_at: string | null;
  has_attachments: boolean | null;
  to_list: string[] | null;
  created_at: string | null;
}

interface EmailsTabProps {
  commitmentId: string;
  projectId: number;
}

function stripHtml(html: string | null): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export const EmailsTab = memo(function EmailsTab({
  commitmentId,
  projectId: _projectId,
}: EmailsTabProps) {
  const [emails, setEmails] = useState<ProjectEmail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEmails = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const payload = await apiFetch<{
          data: ProjectEmail[];
          meta: { total_count: number };
        }>(`/api/commitments/${commitmentId}/emails`);
        setEmails(payload.data ?? []);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          setEmails([]);
          return;
        }
        setError(
          err instanceof Error ? err.message : "Failed to load emails",
        );
      } finally {
        setIsLoading(false);
      }
    };

    void fetchEmails();
  }, [commitmentId]);

  const columns: ColumnDef<ProjectEmail>[] = useMemo(
    () => [
      {
        accessorKey: "subject",
        header: "Subject",
        cell: ({ row }) => (
          <Text size="sm" weight="medium" className="max-w-60 truncate">
            {row.original.subject || "—"}
          </Text>
        ),
      },
      {
        id: "from",
        header: "From",
        cell: ({ row }) => {
          const { from_name, from_email } = row.original;
          return (
            <div className="min-w-0">
              {from_name && (
                <Text size="sm" weight="medium" className="truncate">
                  {from_name}
                </Text>
              )}
              {from_email && (
                <Text size="xs" tone="muted" className="truncate">
                  {from_email}
                </Text>
              )}
              {!from_name && !from_email && (
                <Text size="sm" tone="muted">—</Text>
              )}
            </div>
          );
        },
        size: 180,
      },
      {
        id: "preview",
        header: "Preview",
        cell: ({ row }) => {
          const snippet = stripHtml(row.original.body).slice(0, 100);
          return (
            <Text size="sm" tone="muted" className="max-w-72 truncate">
              {snippet || "—"}
            </Text>
          );
        },
      },
      {
        id: "date",
        header: "Date",
        cell: ({ row }) => {
          const date = row.original.sent_at ?? row.original.received_at ?? row.original.created_at;
          return (
            <Text size="sm" tone="muted" className="whitespace-nowrap">
              {date ? formatDate(date) : "—"}
            </Text>
          );
        },
        size: 120,
      },
      {
        id: "attachments",
        header: "",
        cell: ({ row }) =>
          row.original.has_attachments ? (
            <Paperclip className="h-3.5 w-3.5 text-muted-foreground" aria-label="Has attachments" />
          ) : null,
        size: 40,
      },
    ],
    [],
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
    return (
      <Text tone="destructive" size="sm">
        {error}
      </Text>
    );
  }

  if (emails.length === 0) {
    return (
      <EmptyState
        icon={<Mail className="h-8 w-8" />}
        title="No emails linked"
        description="Emails sent or received in relation to this commitment will appear here once email tracking is configured."
      />
    );
  }

  return (
    <DataTable
      columns={columns}
      data={emails}
      showToolbar={false}
      showPagination={emails.length > 10}
    />
  );
});

EmailsTab.displayName = "EmailsTab";
