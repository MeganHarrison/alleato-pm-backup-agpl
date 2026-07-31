"use client";

import * as React from "react";
import { Copy, ArrowRight, MoreVertical, Pencil, Share2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface ContextAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
  separator?: boolean;
}

interface TableRowContextMenuProps {
  actions: ContextAction[];
  className?: string;
}

/**
 * TableRowContextMenu — a vertical-dots overflow menu for table row actions.
 *
 * Pattern used throughout the app: never put a pencil/edit icon directly
 * in a row. Always gate row actions behind a MoreVertical trigger.
 *
 * Usage:
 *   <TableRowContextMenu
 *     actions={[
 *       { label: "Edit", icon: <Edit2 />, onClick: () => {} },
 *       { label: "Delete", icon: <Trash2 />, onClick: () => {}, destructive: true },
 *     ]}
 *   />
 */
export function TableRowContextMenu({ actions, className }: TableRowContextMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="h-7 w-7 text-muted-foreground opacity-0 group-hover/row:opacity-100 data-[state=open]:opacity-100"
          aria-label="Row actions"
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {actions.map((action, i) => (
          <React.Fragment key={action.label}>
            {action.separator && i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              onClick={action.onClick}
              className={action.destructive ? "text-destructive focus:text-destructive" : undefined}
            >
              {action.icon}
              {action.label}
            </DropdownMenuItem>
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { Copy, ArrowRight, Pencil, Share2, Trash2 };
