"use client";

import * as React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";
import {
  FileText,
  MoreVertical,
  Pencil,
  Trash2,
  Download,
  Eye,
} from "lucide-react";

import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";
import { DataTable } from "@/components/tables/DataTable";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Badge } from "@/components/ui/badge";

import { useDeleteSpecification } from "@/hooks/use-specifications";
import type { SpecificationWithRevision } from "@/types/specifications.types";
import { toast } from "sonner";
import { EmptyState } from "@/components/ds";

interface SpecificationListTableProps {
  projectId: string;
  specifications: SpecificationWithRevision[];
  onEdit?: (specification: SpecificationWithRevision) => void;
}

export function SpecificationListTable({
  projectId,
  specifications,
  onEdit,
}: SpecificationListTableProps) {
  const router = useRouter();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const deleteMutation = useDeleteSpecification(projectId);

  const handleView = (sectionId: number) => {
    router.push(`/${projectId}/specifications/${sectionId}`);
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      await deleteMutation.mutateAsync(deleteId);
      setDeleteId(null);
    } catch (error) {
      reportNonCriticalFailure({
        area: "specification-list-table",
        operation: "delete-specification",
        error,
        userVisibleFallback: "Specification was not deleted.",
        metadata: { projectId, sectionId: deleteId },
      });
    }
  };

  const handleDownload = async (specId: number, revisionId: number) => {
    try {
      const response = await fetch(
        `/api/projects/${projectId}/specifications/${specId}/revisions/${revisionId}/download`
      );

      if (!response.ok) {
        throw new Error("Failed to generate download URL");
      }

      const { url } = await response.json();
      window.open(url, "_blank");
    } catch {
      toast.error("Failed to download file");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default">Active</Badge>;
      case "archived":
        return <Badge variant="secondary">Archived</Badge>;
      case "superseded":
        return <Badge variant="outline">Superseded</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const columns = React.useMemo<ColumnDef<SpecificationWithRevision>[]>(
    () => [
      {
        accessorKey: "section_number",
        header: "Section #",
        cell: ({ row }) => (
          <span className="font-mono font-medium">{row.original.section_number}</span>
        ),
      },
      {
        accessorKey: "title",
        header: "Title",
        cell: ({ row }) => {
          const spec = row.original;
          return (
            <div>
              <div className="flex items-center space-x-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{spec.title}</span>
              </div>
              {spec.description && (
                <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                  {spec.description}
                </p>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => getStatusBadge(row.original.status),
      },
      {
        id: "revision",
        header: "Revision",
        cell: ({ row }) => {
          const revision = row.original.current_revision;
          return revision ? (
            <span className="text-sm">Rev {revision.revision_number}</span>
          ) : (
            <span className="text-sm text-muted-foreground">No revisions</span>
          );
        },
      },
      {
        id: "file_size",
        header: "File Size",
        cell: ({ row }) => {
          const revision = row.original.current_revision;
          return revision ? (
            <span className="text-sm">{formatFileSize(revision.file_size)}</span>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          );
        },
      },
      {
        id: "updated_at",
        header: "Last Updated",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDistanceToNow(new Date(row.original.updated_at || row.original.created_at), {
              addSuffix: true,
            })}
          </span>
        ),
      },
      {
        id: "areas",
        header: "Areas",
        cell: ({ row }) =>
          row.original.area_count > 0 ? (
            <Badge variant="secondary" className="text-xs">
              {row.original.area_count}
            </Badge>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const spec = row.original;
          return (
            <div onClick={(event) => event.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreVertical />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => handleView(spec.id)}>
                    <Eye className="mr-2 h-4 w-4" />
                    View Details
                  </DropdownMenuItem>
                  {spec.current_revision && (
                    <DropdownMenuItem
                      onClick={() => handleDownload(spec.id, spec.current_revision!.id)}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  {onEdit && (
                    <DropdownMenuItem onClick={() => onEdit(spec)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit Metadata
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() => setDeleteId(spec.id.toString())}
                    className="text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [onEdit],
  );

  if (specifications.length === 0) {
    return (
      <EmptyState
        icon={<FileText />}
        title="No specifications"
        description="Get started by uploading a new specification document."
      />
    );
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={specifications}
        showToolbar={false}
        showPagination={false}
        onRowClick={(spec) => handleView(spec.id)}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this specification and all its revisions.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
