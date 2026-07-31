"use client";

import * as React from "react";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  Download,
  FileText,
  Upload,
  Trash2,
  Pencil,
} from "lucide-react";

import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";
import { PageShell, SectionRuleHeading, DetailPanel, ContentSectionStack } from "@/components/layout";
import { EmptyState } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { toast } from "sonner";

import { SpecificationEditModal, AddRevisionDialog } from "@/components/specifications";
import { useSpecification } from "@/hooks/use-specifications";
import { useSpecificationRevisions, useDeleteRevision, useSetCurrentRevision } from "@/hooks/use-specification-revisions";
import type { SpecificationWithAreas, RevisionListResponse } from "@/types/specifications.types";

export default function SpecificationDetailPage() {
  const params = useParams()!;
  const router = useRouter();
  const projectId = params.projectId as string;
  const sectionId = params.sectionId as string;

  const [editingSpec, setEditingSpec] = useState(false);
  const [deletingRevisionId, setDeletingRevisionId] = useState<string | null>(null);

  const { data: specification, isLoading: specLoading } = useSpecification(projectId, sectionId);
  const { data: revisionsData, isLoading: revisionsLoading } = useSpecificationRevisions(projectId, sectionId);

  const deleteRevisionMutation = useDeleteRevision(projectId, sectionId);
  const setCurrentRevisionMutation = useSetCurrentRevision(projectId, sectionId);

  const handleDeleteRevision = async () => {
    if (!deletingRevisionId) return;

    try {
      await deleteRevisionMutation.mutateAsync(deletingRevisionId);
      setDeletingRevisionId(null);
    } catch (error) {
      reportNonCriticalFailure({
        area: "specifications",
        operation: "delete-revision",
        error,
        userVisibleFallback: "Specification revision was not deleted.",
        metadata: { projectId, sectionId, revisionId: deletingRevisionId },
      });
    }
  };

  const handleSetCurrentRevision = async (revisionId: string) => {
    try {
      await setCurrentRevisionMutation.mutateAsync(revisionId);
      toast.success("Current revision updated");
    } catch (error) {
      reportNonCriticalFailure({
        area: "specifications",
        operation: "set-current-revision",
        error,
        userVisibleFallback: "Current specification revision was not updated.",
        metadata: { projectId, sectionId, revisionId },
      });
    }
  };

  const handleDownload = async (revisionId: string) => {
    try {
      const response = await fetch(
        `/api/projects/${projectId}/specifications/${sectionId}/revisions/${revisionId}/download`
      );

      if (!response.ok) {
        throw new Error("Failed to generate download URL");
      }

      const { url } = await response.json();
      window.open(url, "_blank");
    } catch (error) {
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

  if (specLoading) {
    return (
      <PageShell variant="detail" title="Loading..." onBack={() => router.back()}>
        <p className="text-muted-foreground">Loading...</p>
      </PageShell>
    );
  }

  if (!specification) {
    return (
      <PageShell variant="detail" title="Not Found" onBack={() => router.back()}>
        <p className="text-muted-foreground">Specification not found</p>
        <Button className="mt-4" onClick={() => router.back()}>
          Go Back
        </Button>
      </PageShell>
    );
  }

  const revisions = revisionsData?.revisions ?? [];

  return (
    <PageShell
      variant="detail"
      title={specification.title}
      description={`Section ${specification.section_number}`}
      onBack={() => router.back()}
      actions={
        <div className="flex items-center gap-2">
          <AddRevisionDialog projectId={projectId} sectionId={sectionId}>
            <Button variant="outline">
              <Upload />
              Add Revision
            </Button>
          </AddRevisionDialog>
          <Button variant="outline" onClick={() => setEditingSpec(true)}>
            <Pencil />
            Edit
          </Button>
        </div>
      }
    >
      <ContentSectionStack>
        {/* Specification Details */}
        <DetailPanel>
          <SectionRuleHeading label="Details" />
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Section Number</p>
                <p className="font-mono text-lg">{specification.section_number}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <div className="mt-1">{getStatusBadge(specification.status)}</div>
              </div>
            </div>

            {specification.description && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Description</p>
                <p className="mt-1">{specification.description}</p>
              </div>
            )}

            {specification.areas && specification.areas.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Areas</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {specification.areas.map((area) => (
                    <Badge key={area.id} variant="secondary">
                      {area.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {specification.current_revision && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Current Revision</p>
                <div className="mt-2 flex items-center space-x-4">
                  <span className="text-lg font-medium">
                    Rev {specification.current_revision.revision_number}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(specification.current_revision!.id.toString())}
                  >
                    <Download />
                    Download
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DetailPanel>

        {/* Revision History */}
        <DetailPanel>
          <SectionRuleHeading label="Revision History" />
            {revisionsLoading ? (
              <p className="text-muted-foreground">Loading revisions...</p>
            ) : revisions.length === 0 ? (
              <EmptyState
                title="No revisions yet"
                description="Upload a revision to start tracking changes to this specification section."
              />
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Revision</TableHead>
                      <TableHead>File</TableHead>
                      <TableHead className="w-[120px]">Size</TableHead>
                      <TableHead>Uploaded By</TableHead>
                      <TableHead className="w-[140px]">Uploaded</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead className="w-[140px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revisions.map((revision) => {
                      const isCurrent = revision.id === specification.current_revision_id;
                      return (
                        <TableRow key={revision.id}>
                          <TableCell className="font-medium">
                            Rev {revision.revision_number}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{revision.file_name}</span>
                            </div>
                            {revision.notes && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {revision.notes}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatFileSize(revision.file_size)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {revision.uploader?.email || revision.uploaded_by || "Unknown"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(revision.uploaded_at), {
                              addSuffix: true,
                            })}
                          </TableCell>
                          <TableCell>
                            {isCurrent ? (
                              <Badge>Current</Badge>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSetCurrentRevision(revision.id.toString())}
                              >
                                Set as Current
                              </Button>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownload(revision.id.toString())}
                              >
                                <Download />
                              </Button>
                              {!isCurrent && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeletingRevisionId(revision.id.toString())}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
        </DetailPanel>
      </ContentSectionStack>

      {/* Edit Modal */}
      <SpecificationEditModal
        projectId={projectId}
        specification={specification}
        open={editingSpec}
        onOpenChange={setEditingSpec}
      />

      {/* Delete Revision Dialog */}
      <AlertDialog open={!!deletingRevisionId} onOpenChange={() => setDeletingRevisionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this revision. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRevision}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
