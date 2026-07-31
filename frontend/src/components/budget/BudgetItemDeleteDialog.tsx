"use client";

import * as React from "react";
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

interface BudgetItemDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  itemDescription?: string;
  isDeleting?: boolean;
}

/**
 * BudgetItemDeleteDialog - Reusable confirmation dialog for budget item deletion
 *
 * Provides a standard confirmation dialog that can be used throughout the budget
 * components to confirm deletion of individual or multiple budget items.
 */
export function BudgetItemDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  title = "Delete Budget Line Item",
  description,
  itemDescription = "this budget line item",
  isDeleting = false,
}: BudgetItemDeleteDialogProps) {
  const defaultDescription = `Are you sure you want to delete ${itemDescription}? This action cannot be undone.`;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description || defaultDescription}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-destructive hover:bg-destructive/90 focus:ring-destructive"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}