"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ds";
import { toast } from "sonner";
import { FileText } from "lucide-react";
import { apiFetch } from "@/lib/api-client";

interface BudgetChange {
  id: string;
  number: string | null;
  title: string;
  status: string;
}

interface AddToBudgetChangeDialogProps {
  open: boolean;
  onClose: () => void;
  selectedChangeEventIds: string[];
  projectId: number;
  onSuccess: () => void;
}

type ActionMode = "create_new" | "link_existing";

export function AddToBudgetChangeDialog({
  open,
  onClose,
  selectedChangeEventIds,
  projectId,
  onSuccess,
}: AddToBudgetChangeDialogProps) {
  const [actionMode, setActionMode] = useState<ActionMode>("create_new");

  // Create new state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Link existing state
  const [budgetChanges, setBudgetChanges] = useState<BudgetChange[]>([]);
  const [isLoadingBudgetChanges, setIsLoadingBudgetChanges] = useState(false);
  const [selectedBudgetChangeId, setSelectedBudgetChangeId] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const count = selectedChangeEventIds.length;

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setActionMode("create_new");
      setTitle("");
      setDescription("");
      setBudgetChanges([]);
      setSelectedBudgetChangeId("");
      return;
    }
  }, [open]);

  // Fetch existing budget changes when switching to link mode
  useEffect(() => {
    if (!open || actionMode !== "link_existing") return;

    const fetchBudgetChanges = async () => {
      setIsLoadingBudgetChanges(true);
      try {
        const result = await apiFetch<{ data?: unknown[] }>(
          `/api/projects/${projectId}/budget-changes`,
        );
        const items = Array.isArray(result)
          ? result
          : (result as { data?: unknown[] }).data ?? [];
        setBudgetChanges(
          (items as Record<string, unknown>[]).map((bc) => ({
            id: String(bc.id),
            number: bc.number != null ? String(bc.number) : null,
            title: String(bc.title ?? ""),
            status: String(bc.status ?? "Draft"),
          })),
        );
      } catch (err) {
        toast.error("Could not load budget changes.");
        setBudgetChanges([]);
      } finally {
        setIsLoadingBudgetChanges(false);
      }
    };

    void fetchBudgetChanges();
  }, [open, actionMode, projectId]);

  const handleSubmit = async () => {
    if (actionMode === "create_new") {
      if (!title.trim()) {
        toast.error("Title is required.");
        return;
      }
    } else {
      if (!selectedBudgetChangeId) {
        toast.error("Select a budget change to link to.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (actionMode === "create_new") {
        await apiFetch(`/api/projects/${projectId}/budget-changes`, {
          method: "POST",
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || undefined,
            changeEventId: selectedChangeEventIds[0],
          }),
        });
        toast.success("Budget change created successfully");
      } else {
        // Link to existing: POST to link the CE to the selected budget change
        await apiFetch(`/api/projects/${projectId}/budget-changes`, {
          method: "POST",
          body: JSON.stringify({
            title: budgetChanges.find((bc) => bc.id === selectedBudgetChangeId)?.title ?? "",
            changeEventId: selectedChangeEventIds[0],
          }),
        });
        const bc = budgetChanges.find((b) => b.id === selectedBudgetChangeId);
        toast.success(`Linked to Budget Change ${bc?.number ?? selectedBudgetChangeId}`);
      }

      onSuccess();
      onClose();
    } catch (err) {
      toast.error("Failed to process budget change");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  const isSubmitDisabled =
    isSubmitting ||
    (actionMode === "create_new"
      ? !title.trim()
      : !selectedBudgetChangeId || isLoadingBudgetChanges);

  const submitLabel = () => {
    if (isSubmitting) return "Processing...";
    if (actionMode === "link_existing") return "Link Budget Change";
    return "Create Budget Change";
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add to Budget Change</DialogTitle>
          <DialogDescription>
            {`Add ${count === 1 ? "1 change event" : `${count} change events`} to a budget change.`}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-4">
          {/* Mode toggle */}
          <RadioGroup
            value={actionMode}
            onValueChange={(v) => {
              setActionMode(v as ActionMode);
              setSelectedBudgetChangeId("");
            }}
            className="flex gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="create_new" id="bc-mode-create" />
              <Label
                htmlFor="bc-mode-create"
                className="cursor-pointer text-sm font-normal"
              >
                Create new Budget Change
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="link_existing" id="bc-mode-link" />
              <Label
                htmlFor="bc-mode-link"
                className="cursor-pointer text-sm font-normal"
              >
                Link to existing Budget Change
              </Label>
            </div>
          </RadioGroup>

          {/* Create new form */}
          {actionMode === "create_new" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Adding {count === 1 ? "1 change event" : `${count} change events`} to a new budget change.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="bc-title" className="text-sm">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="bc-title"
                  placeholder="Budget change title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bc-description" className="text-sm">
                  Description
                </Label>
                <Textarea
                  id="bc-description"
                  placeholder="Optional description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isSubmitting}
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Link to existing */}
          {actionMode === "link_existing" && (
            <div className="space-y-2">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Select Budget Change
              </p>
              {isLoadingBudgetChanges ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : budgetChanges.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No budget changes found for this project. Switch to &ldquo;Create new Budget Change&rdquo; to create one.
                  </p>
                </div>
              ) : (
                <RadioGroup
                  value={selectedBudgetChangeId}
                  onValueChange={setSelectedBudgetChangeId}
                  className="space-y-1 max-h-48 overflow-y-auto pr-1"
                >
                  {budgetChanges.map((bc) => (
                    <div
                      key={bc.id}
                      className="flex items-center gap-3 rounded-md border border-border px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedBudgetChangeId(bc.id)}
                    >
                      <RadioGroupItem value={bc.id} id={`bc-${bc.id}`} />
                      <Label
                        htmlFor={`bc-${bc.id}`}
                        className="flex-1 cursor-pointer text-sm leading-snug"
                      >
                        {bc.number ? (
                          <span className="font-medium">#{bc.number}</span>
                        ) : null}
                        {bc.number ? ` — ${bc.title}` : bc.title}
                      </Label>
                      <StatusBadge status={bc.status} />
                    </div>
                  ))}
                </RadioGroup>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitDisabled}>
            {submitLabel()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
