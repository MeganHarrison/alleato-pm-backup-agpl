"use client";

import * as React from "react";
import { Settings, Plus, Copy, Pencil, Trash2, Star } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

import { apiFetch, ApiError } from "@/lib/api-client";
import type { BudgetViewDefinition } from "@/types/budget-views";
import { BudgetViewsModal } from "./BudgetViewsModal";

interface BudgetViewsManagerProps {
  projectId: string;
  currentViewId?: string;
  onViewChange: (viewId: string) => void;
}

export function BudgetViewsManager({
  projectId,
  currentViewId,
  onViewChange,
}: BudgetViewsManagerProps) {
  const [views, setViews] = React.useState<BudgetViewDefinition[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalMode, setModalMode] = React.useState<"create" | "edit">("create");
  const [selectedView, setSelectedView] =
    React.useState<BudgetViewDefinition | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [viewToDelete, setViewToDelete] =
    React.useState<BudgetViewDefinition | null>(null);

  // Fetch views
  const fetchViews = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ views: BudgetViewDefinition[] }>(
        `/api/projects/${projectId}/budget/views`,
        { signal: AbortSignal.timeout(5000) },
      );
      setViews(data.views || []);

      // If no current view is selected, select the default one
      if (!currentViewId && data.views.length > 0) {
        const defaultView = data.views.find(
          (v: BudgetViewDefinition) => v.is_default,
        );
        if (defaultView) {
          onViewChange(defaultView.id);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load budget views";
      toast.error(message);
      console.error("Budget views error:", error);
    } finally {
      setLoading(false);
    }
  }, [projectId, currentViewId, onViewChange]);

  React.useEffect(() => {
    fetchViews();
  }, [fetchViews]);

  const handleCreateView = () => {
    setModalMode("create");
    setSelectedView(null);
    setModalOpen(true);
  };

  const handleEditView = (view: BudgetViewDefinition) => {
    if (view.is_system) {
      toast.error("Cannot edit system views");
      return;
    }
    setModalMode("edit");
    setSelectedView(view);
    setModalOpen(true);
  };

  const handleCloneView = async (view: BudgetViewDefinition) => {
    try {
      await apiFetch(`/api/projects/${projectId}/budget/views/${view.id}/clone`, {
        method: "POST",
        body: JSON.stringify({ new_name: `${view.name} (Copy)`, new_description: view.description }),
      });
      toast.success("View cloned successfully");
      fetchViews();
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? `Failed to clone view: ${error.message}`
          : error instanceof Error
            ? `Failed to clone view: ${error.message}`
            : "Failed to clone view",
      );
    }
  };

  const handleDeleteView = (view: BudgetViewDefinition) => {
    if (view.is_system) {
      toast.error("Cannot delete system views");
      return;
    }
    setViewToDelete(view);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!viewToDelete) return;

    try {
      await apiFetch(`/api/projects/${projectId}/budget/views/${viewToDelete.id}`, { method: "DELETE" });
      toast.success("View deleted successfully");

      // If we deleted the current view, switch to default
      if (currentViewId === viewToDelete.id) {
        const defaultView = views.find(
          (v) => v.is_default && v.id !== viewToDelete.id,
        );
        if (defaultView) {
          onViewChange(defaultView.id);
        }
      }

      fetchViews();
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? `Failed to delete view: ${error.message}`
          : error instanceof Error
            ? `Failed to delete view: ${error.message}`
            : "Failed to delete view",
      );
    } finally {
      setDeleteDialogOpen(false);
      setViewToDelete(null);
    }
  };

  const handleSetDefault = async (view: BudgetViewDefinition) => {
    if (view.is_default) return;

    try {
      await apiFetch(`/api/projects/${projectId}/budget/views/${view.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_default: true }),
      });
      toast.success("Default view updated");
      fetchViews();
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? `Failed to set default view: ${error.message}`
          : error instanceof Error
            ? `Failed to set default view: ${error.message}`
            : "Failed to set default view",
      );
    }
  };

  const currentView = views.find((v) => v.id === currentViewId);

  if (loading) {
    return (
      <Button variant="outline" disabled>
        <Settings />
        Loading...
      </Button>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <Settings />
            {currentView?.name || "Select View"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[300px]">
          <div className="px-2 py-1.5 text-sm font-semibold">Budget Views</div>
          <DropdownMenuSeparator />

          {views.map((view) => (
            <div key={view.id} className="flex items-center">
              <DropdownMenuItem
                className="flex-1"
                onClick={() => onViewChange(view.id)}
              >
                <div className="flex items-center gap-2">
                  {view.is_default && <Star className="h-3 w-3 fill-current" />}
                  <span
                    className={currentViewId === view.id ? "font-medium" : ""}
                  >
                    {view.name}
                  </span>
                </div>
              </DropdownMenuItem>
              {!view.is_system && (
                <div className="flex items-center gap-1 pr-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditView(view);
                    }}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloneView(view);
                    }}
                  >
                    <Copy />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteView(view);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          ))}

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleCreateView}>
            <Plus className="w-4 h-4 mr-2" />
            Create New View
          </DropdownMenuItem>

          {currentView && !currentView.is_default && !currentView.is_system && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleSetDefault(currentView)}>
                <Star className="w-4 h-4 mr-2" />
                Set as Default
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <BudgetViewsModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        projectId={projectId}
        view={selectedView}
        mode={modalMode}
        onSuccess={fetchViews}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Budget View</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{viewToDelete?.name}&quot;?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
