"use client";
import Link from "next/link";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  Brain,
  FolderCheck,
  ListTodo,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import {
  UnifiedTablePage,
  type TableColumn,
  type ViewMode,
} from "@/components/tables/unified";

interface Document {
  id: string;
  fireflies_id: string;
  title: string;
  status: string;
  type: string;
  source: string;
  date: string;
  created_at: string;
  pipeline_stage: string;
  raw_pipeline_stage: string | null;
  lifecycle_label: string;
  project_assigned: boolean;
  task_count: number;
  attempt_count: number;
  last_attempt_at: string;
  error_message: string | null;
}

const statusConfig = {
  Synced: {
    label: "Synced",
    color: "bg-muted text-foreground",
    icon: FileText,
  },
  Vectorized: {
    label: "Vectorized",
    color: "bg-muted text-foreground",
    icon: Brain,
  },
  "Project assigned": {
    label: "Project assigned",
    color: "bg-info/10 text-info",
    icon: FolderCheck,
  },
  "Tasks extracted": {
    label: "Tasks extracted",
    color: "bg-success/10 text-success",
    icon: ListTodo,
  },
  Processing: {
    label: "Processing",
    color: "bg-warning/10 text-warning",
    icon: Clock,
  },
  Failed: {
    label: "Failed",
    color: "bg-destructive/10 text-destructive",
    icon: AlertCircle,
  },
  Unknown: {
    label: "Unknown",
    color: "bg-muted text-muted-foreground",
    icon: Clock,
  },
  done: {
    label: "Complete",
    color: "bg-success/10 text-success",
    icon: CheckCircle,
  },
};

export default function DocumentPipelinePage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [currentView, setCurrentView] = useState<ViewMode>("table");

  const fetchDocuments = async () => {
    try {
      setLoadError(null);
      const data = await apiFetch<{ documents: Document[] }>(
        "/api/documents/status?type=meeting&source=fireflies",
      );
      setDocuments(data.documents);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Document status could not be loaded.";
      setLoadError(new Error(message));
      toast.error("Could not load document status", {
        description: message,
      });
    }
  };

  const loadData = async () => {
    setLoading(true);
    await fetchDocuments();
    setLoading(false);
  };

  const refreshData = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
    toast.success("Document status updated");
  };

  useEffect(() => {
    loadData();
  }, []);

  const getStatusBadge = (lifecycleLabel: string) => {
    const config =
      statusConfig[lifecycleLabel as keyof typeof statusConfig] ||
      statusConfig.Unknown;
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const lifecycleSummary = useMemo(() => {
    const total = documents.length;
    const failed = documents.filter((doc) => doc.pipeline_stage === "failed").length;
    const processing = documents.filter((doc) => doc.pipeline_stage === "processing").length;
    const vectorized = documents.filter((doc) => ["done", "processing"].includes(doc.raw_pipeline_stage ?? "") || doc.lifecycle_label === "Tasks extracted" || doc.lifecycle_label === "Project assigned" || doc.lifecycle_label === "Vectorized").length;
    const projectAssigned = documents.filter((doc) => doc.project_assigned).length;
    const tasksExtracted = documents.filter((doc) => doc.task_count > 0).length;

    return {
      total,
      failed,
      processing,
      vectorized,
      projectAssigned,
      tasksExtracted,
    };
  }, [documents]);

  const documentColumns = useMemo<TableColumn<Document>[]>(
    () => [
      {
        id: "title",
        label: "Title",
        alwaysVisible: true,
        sortable: true,
        render: (doc) => (
          <span
            className="block truncate text-sm font-medium text-foreground"
            title={doc.title}
          >
            {doc.title}
          </span>
        ),
        sortValue: (doc) => doc.title,
        csvValue: (doc) => doc.title,
        width: 280,
      },
      {
        id: "type",
        label: "Type",
        sortable: true,
        render: (doc) => <Badge variant="outline">{doc.type}</Badge>,
        sortValue: (doc) => doc.type,
        csvValue: (doc) => doc.type,
        width: 120,
      },
      {
        id: "lifecycle",
        label: "Lifecycle",
        sortable: true,
        render: (doc) => getStatusBadge(doc.lifecycle_label),
        sortValue: (doc) => doc.lifecycle_label,
        csvValue: (doc) => doc.lifecycle_label,
        width: 170,
      },
      {
        id: "project_assigned",
        label: "Project",
        sortable: true,
        render: (doc) => (
          <span className="text-sm text-muted-foreground">
            {doc.project_assigned ? "Assigned" : "Unassigned"}
          </span>
        ),
        sortValue: (doc) => (doc.project_assigned ? 1 : 0),
        csvValue: (doc) => (doc.project_assigned ? "Assigned" : "Unassigned"),
        width: 130,
      },
      {
        id: "task_count",
        label: "Tasks",
        sortable: true,
        render: (doc) => (
          <span className="text-sm tabular-nums text-muted-foreground">
            {doc.task_count}
          </span>
        ),
        sortValue: (doc) => doc.task_count,
        csvValue: (doc) => String(doc.task_count),
        width: 90,
      },
      {
        id: "pipeline_stage",
        label: "Backend stage",
        sortable: true,
        render: (doc) => (
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            {doc.raw_pipeline_stage ?? doc.pipeline_stage}
          </code>
        ),
        sortValue: (doc) => doc.raw_pipeline_stage ?? doc.pipeline_stage,
        csvValue: (doc) => doc.raw_pipeline_stage ?? doc.pipeline_stage,
        width: 150,
      },
      {
        id: "attempt_count",
        label: "Attempts",
        sortable: true,
        render: (doc) => (
          <span className="text-sm tabular-nums text-muted-foreground">
            {doc.attempt_count}
          </span>
        ),
        sortValue: (doc) => doc.attempt_count,
        csvValue: (doc) => String(doc.attempt_count),
        width: 100,
      },
      {
        id: "last_updated",
        label: "Last Updated",
        sortable: true,
        render: (doc) => (
          <span className="text-sm text-muted-foreground">
            {doc.last_attempt_at
              ? format(new Date(doc.last_attempt_at), "MMM d, h:mm a")
              : format(new Date(doc.created_at), "MMM d, h:mm a")}
          </span>
        ),
        sortValue: (doc) =>
          new Date(doc.last_attempt_at || doc.created_at).getTime(),
        csvValue: (doc) =>
          doc.last_attempt_at
            ? format(new Date(doc.last_attempt_at), "yyyy-MM-dd HH:mm")
            : format(new Date(doc.created_at), "yyyy-MM-dd HH:mm"),
        width: 150,
      },
      {
        id: "error",
        label: "Error",
        render: (doc) =>
          doc.error_message ? (
            <div
              className="flex min-w-0 items-center gap-1 text-destructive"
              title={doc.error_message}
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="truncate text-xs">{doc.error_message}</span>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">-</span>
          ),
        csvValue: (doc) => doc.error_message ?? "",
        width: 220,
      },
    ],
    [],
  );

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return documents;
    return documents.filter((doc) =>
      [
        doc.title,
        doc.fireflies_id,
        doc.status,
        doc.type,
        doc.source,
        doc.pipeline_stage,
        doc.lifecycle_label,
        doc.error_message,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [documents, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <UnifiedTablePage
      header={{
        title: "Document Pipeline",
        description:
          "Fireflies processing state by outcome — synced, vectorized, project assigned, and tasks extracted.",
        actions: (
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/task-training">Review extracted tasks</Link>
          </Button>
        ),
      }}
      toolbar={{
        totalItems: documents.length,
        filteredItems: filteredDocuments.length,
        searchValue: search,
        onSearchChange: setSearch,
        searchPlaceholder: "Search documents...",
        currentView,
        onViewChange: (view) => {
          if (view === "table") setCurrentView(view);
        },
        enabledViews: ["table"],
        customActions: (
          <Button
            onClick={refreshData}
            variant="outline"
            size="sm"
            disabled={refreshing}
          >
            <RefreshCw className={refreshing ? "animate-spin" : undefined} />
            Refresh
          </Button>
        ),
      }}
      data={{
        items: filteredDocuments,
        isLoading: loading,
        error: loadError,
      }}
      table={{
        columns: documentColumns,
        getRowId: (doc) => doc.id,
        density: "compact",
        stickyHeader: true,
      }}
      features={{
        enableViews: false,
        enableColumnToggle: true,
        enableExport: true,
        enablePagination: true,
        enableBulkDelete: false,
        enableRowSelection: false,
      }}
      emptyState={{
        title: "No documents found",
        description: "Documents will appear here after ingestion starts.",
        filteredDescription: "No documents match your search.",
        isFiltered: Boolean(search),
      }}
    />
  );
}
