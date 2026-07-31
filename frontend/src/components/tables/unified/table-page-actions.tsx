"use client";

import * as React from "react";
import type { ReactNode } from "react";
import { ChevronDown, MoreVertical, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * The primary add affordance: a bare plus icon, no filled box, no inline label.
 * Same on every breakpoint. The label is exposed via `aria-label` + tooltip so
 * the control stays discoverable and accessible without visual weight.
 */
const ADD_BUTTON_CLASSNAME =
  "h-10 w-10 shrink-0 text-primary hover:bg-primary/10 hover:text-primary sm:h-9 sm:w-9";

export interface TablePageActionItem {
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  destructive?: boolean;
}

export interface TablePageActionsProps {
  /**
   * Add action(s). When 1 entry → renders a single plus-icon button.
   * When >1 entries → the plus opens a dropdown of the options.
   * The plus is a bare icon (no filled box, no inline label) on every breakpoint.
   */
  addOptions?: TablePageActionItem[];
  /**
   * Accessible label for the add control (aria-label + hover tooltip). Used for
   * the multi-option button; the single-option button uses its own item label.
   * Default: "Add".
   */
  addLabel?: string;
  /**
   * Items shown in the vertical 3-dot "More" menu. When omitted the menu is hidden.
   * Use this for secondary table actions (Import, Export, Bulk delete, etc).
   */
  moreOptions?: TablePageActionItem[];
  className?: string;
}

function renderItem(item: TablePageActionItem, key: string): ReactNode {
  return (
    <DropdownMenuItem
      key={key}
      disabled={item.disabled}
      onClick={item.onClick}
      className={cn(item.destructive && "text-destructive focus:text-destructive")}
    >
      {item.icon ? <span className="mr-2 flex h-4 w-4 items-center justify-center">{item.icon}</span> : null}
      {item.label}
    </DropdownMenuItem>
  );
}

/**
 * Standard table-page header actions: a bare plus-icon Add button and an
 * optional vertical 3-dot menu for secondary actions.
 *
 * Use this in `UnifiedTablePage`'s `header.actions` slot on EVERY table page so
 * the primary-action styling lives in one place.
 *
 * @example
 * <UnifiedTablePage
 *   header={{
 *     title: "Companies",
 *     actions: (
 *       <TablePageActions
 *         addOptions={[
 *           { label: "Add New Company", icon: <Building2 />, onClick: handleAdd },
 *           { label: "Import from CSV", icon: <FileSpreadsheet />, onClick: handleImport },
 *         ]}
 *         moreOptions={[
 *           { label: "Sync from ERP", icon: <RefreshCw />, onClick: handleSync },
 *         ]}
 *       />
 *     ),
 *   }}
 * />
 */
export function TablePageActions({
  addOptions,
  addLabel = "Add",
  moreOptions,
  className,
}: TablePageActionsProps): React.ReactElement | null {
  const hasAdd = Array.isArray(addOptions) && addOptions.length > 0;
  const hasMore = Array.isArray(moreOptions) && moreOptions.length > 0;
  if (!hasAdd && !hasMore) return null;

  const singleAdd = hasAdd && addOptions!.length === 1 ? addOptions![0] : null;

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {hasAdd && (
        singleAdd ? (
          // Single add: one bare plus icon, identical on every breakpoint.
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className={ADD_BUTTON_CLASSNAME}
                  onClick={singleAdd.onClick}
                  aria-label={singleAdd.label}
                  disabled={singleAdd.disabled}
                >
                  <Plus />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{singleAdd.label}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          // Multiple add options: the plus opens a menu (chevron hints the menu).
          <DropdownMenu>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className={ADD_BUTTON_CLASSNAME}
                      aria-label={addLabel}
                    >
                      <Plus />
                      <ChevronDown className="!h-3 !w-3 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>{addLabel}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DropdownMenuContent align="end" className="w-56">
              {addOptions!.map((item, index) => renderItem(item, `add-${index}`))}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      )}

      {hasMore && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-10 w-10 shrink-0 sm:h-9 sm:w-9"
              aria-label="More actions"
            >
              <MoreVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {moreOptions!.map((item, index) => {
              if (item.label === "---") {
                return <DropdownMenuSeparator key={`sep-${index}`} />;
              }
              return renderItem(item, `more-${index}`);
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
