"use client";

import { ArrowUpRight, Copy, Download, MoreVertical, Trash2 } from "lucide-react";

import { Inline } from "@/components/layout/inline";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PrimeContractPcoHeaderActionsProps {
  canDelete: boolean;
  canEdit: boolean;
  canPromote: boolean;
  onCopyId: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onExport: () => void;
  onPromote: () => void;
}

export function PrimeContractPcoHeaderActions({
  canDelete,
  canEdit,
  canPromote,
  onCopyId,
  onDelete,
  onEdit,
  onExport,
  onPromote,
}: PrimeContractPcoHeaderActionsProps) {
  return (
    <Inline gap="sm">
      {canEdit ? (
        <Button size="sm" variant="outline" onClick={onEdit}>
          Edit
        </Button>
      ) : null}
      {canPromote ? (
        <Button size="sm" onClick={onPromote}>
          <ArrowUpRight className="mr-1 h-4 w-4" />
          Promote to PCCO
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="More actions">
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onExport}>
            <Download className="mr-2 h-4 w-4" />
            Export as CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onCopyId}>
            <Copy className="mr-2 h-4 w-4" />
            Copy ID
          </DropdownMenuItem>
          {canDelete ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </Inline>
  );
}
