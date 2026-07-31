"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus, Folder, Settings } from "lucide-react";
import { toast } from "sonner";
import { DrawingAreaSelector } from "@/components/drawings/DrawingAreaSelector";
import { DrawingAreaCard } from "@/components/drawings/DrawingAreaCard";
import { PageShell } from "@/components/layout";
import { EmptyState } from "@/components/ds";

import { Button } from "@/components/ui/button";
import { useDrawingAreas, useCreateDrawingArea, useUpdateDrawingArea, useDeleteDrawingArea } from "@/hooks/use-drawing-areas";
import { useConfirm } from "@/hooks/use-confirm";
import type { DrawingAreaWithCount, DrawingAreaFormData } from "@/types/drawings.types";

export default function DrawingAreasPage() {
  const params = useParams()! ?? {};
  const router = useRouter();
  const projectId = params.projectId as string;

  const { confirm, ConfirmDialog } = useConfirm();
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [editingArea, setEditingArea] = useState<DrawingAreaWithCount | null>(null);

  const { data: areas, isLoading, error } = useDrawingAreas(projectId);
  const createArea = useCreateDrawingArea(projectId);
  const updateArea = useUpdateDrawingArea(projectId);
  const deleteArea = useDeleteDrawingArea(projectId);

  const handleSelectArea = (areaId: string | null) => {
    setSelectedAreaId(areaId);
    router.push(areaId ? `/${projectId}/drawings?area_id=${areaId}` : `/${projectId}/drawings`);
  };

  const handleCreateArea = async (parentId?: string) => {
    try {
      const newArea = await createArea.mutateAsync({
        name: "New Area",
        description: "",
        parentAreaId: parentId,
        sortOrder: 0,
      });

      toast.success("Drawing area created successfully");
      setSelectedAreaId(newArea.id);
    } catch (error) {
      toast.error("Failed to create drawing area");
      console.error("Error creating area:", error);
    }
  };

  const handleEditArea = (area: DrawingAreaWithCount) => {
    setEditingArea(area);
  };

  const handleSaveArea = async (data: DrawingAreaFormData) => {
    if (!editingArea) return;
    await updateArea.mutateAsync({ areaId: editingArea.id, data });
    toast.success("Drawing area updated");
    setEditingArea(null);
  };

  const handleDeleteArea = async (area: DrawingAreaWithCount) => {
    const ok = await confirm({
      description: `Are you sure you want to delete "${area.name}"? This action cannot be undone.`,
      variant: "destructive",
      confirmLabel: "Delete",
    });
    if (!ok) return;

    try {
      await deleteArea.mutateAsync(area.id);
      toast.success("Drawing area deleted successfully");

      if (selectedAreaId === area.id) {
        setSelectedAreaId(null);
      }
    } catch (error) {
      toast.error("Failed to delete drawing area");
      console.error("Error deleting area:", error);
    }
  };

  if (error) {
    return (
      <PageShell variant="dashboard" title="Drawing Areas">
        <div className="text-center text-destructive p-6">
          Error loading drawing areas: {error instanceof Error ? error.message : "An unexpected error occurred — please try again"}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      variant="dashboard"
      title="Drawing Areas"
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/${projectId}/drawings/areas/settings`)}
          >
            <Settings className="sm:" />
            <span className="hidden xs:inline">Settings</span>
          </Button>

          <Button
            size="sm"
            onClick={() => handleCreateArea()}
            disabled={createArea.isPending}
          >
            <Plus />
            Create Area
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <div className="py-12 text-sm text-muted-foreground">Loading drawing areas...</div>
      ) : areas && areas.length > 0 ? (
        <DrawingAreaSelector
          areas={areas}
          selectedAreaId={selectedAreaId ?? undefined}
          onSelectArea={handleSelectArea}
          onCreateArea={handleCreateArea}
          onEditArea={handleEditArea}
          onDeleteArea={handleDeleteArea}
          isLoading={createArea.isPending || updateArea.isPending || deleteArea.isPending}
        />
      ) : (
        <EmptyState
          icon={<Folder />}
          title="No drawing areas found"
          description="Create your first drawing area to start organizing your project drawings."
          action={<Button onClick={() => handleCreateArea()}><Plus />Create First Area</Button>}
        />
      )}

      {ConfirmDialog}

      {editingArea && (
        <DrawingAreaCard
          area={editingArea}
          isOpen={true}
          onClose={() => setEditingArea(null)}
          onSave={handleSaveArea}
        />
      )}
    </PageShell>
  );
}
