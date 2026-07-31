"use client";

/**
 * =============================================================================
 * TASK CONTEXT MENU COMPONENT
 * =============================================================================
 *
 * Context menu for task operations in the scheduling module.
 * Supports:
 * - Right-click context menu trigger
 * - Task CRUD actions
 * - Hierarchy manipulation (indent/outdent)
 * - Copy/paste operations
 * - Milestone conversion
 * - Deadline management
 * - Keyboard shortcuts
 */

import { useCallback, useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Pencil,
  Trash2,
  Copy,
  Scissors,
  ClipboardPaste,
  ArrowRight,
  ArrowLeft,
  Flag,
  Calendar,
  Eye,
  Download,
  Upload,
  CheckSquare,
  MoreVertical,
  ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScheduleTask, ScheduleContextAction } from "@/types/scheduling";
import {
  RelatedActionItemsList,
  RelatedActionItemsSummary,
  type RelatedScheduleActionItem,
} from "@/components/scheduling/related-action-items";

// =============================================================================
// TYPES
// =============================================================================

interface Position {
  x: number;
  y: number;
}

interface TaskContextMenuProps {
  task: ScheduleTask | null;
  selectedCount?: number;
  position: Position | null;
  onClose: () => void;
  onAction: (action: ScheduleContextAction, task: ScheduleTask | null) => void;
  canIndent?: boolean;
  canOutdent?: boolean;
  hasCopiedTask?: boolean;
  relatedActionItems?: RelatedScheduleActionItem[];
}

interface ContextMenuAction {
  key: ScheduleContextAction;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  variant?: "default" | "destructive";
  disabled?: boolean;
  dividerAfter?: boolean;
}

// =============================================================================
// CONTEXT MENU WRAPPER
// =============================================================================

/**
 * Wrapper component that handles right-click to show context menu
 */
interface TaskContextMenuWrapperProps {
  children: React.ReactNode;
  task: ScheduleTask;
  onAction: (action: ScheduleContextAction, task: ScheduleTask) => void;
  canIndent?: boolean;
  canOutdent?: boolean;
  hasCopiedTask?: boolean;
}

export function TaskContextMenuWrapper({
  children,
  task,
  onAction,
  canIndent = true,
  canOutdent = true,
  hasCopiedTask = false,
}: TaskContextMenuWrapperProps) {
  const [position, setPosition] = useState<Position | null>(null);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setPosition({ x: e.clientX, y: e.clientY });
    },
    []
  );

  const handleClose = useCallback(() => {
    setPosition(null);
  }, []);

  const handleAction = useCallback(
    (action: ScheduleContextAction) => {
      onAction(action, task);
      handleClose();
    },
    [onAction, task, handleClose]
  );

  return (
    <div onContextMenu={handleContextMenu}>
      {children}
      {position && (
        <TaskContextMenu
          task={task}
          position={position}
          onClose={handleClose}
          onAction={(action) => handleAction(action)}
          canIndent={canIndent}
          canOutdent={canOutdent}
          hasCopiedTask={hasCopiedTask}
        />
      )}
    </div>
  );
}

// =============================================================================
// MAIN CONTEXT MENU COMPONENT
// =============================================================================

export function TaskContextMenu({
  task,
  selectedCount = 1,
  position,
  onClose,
  onAction,
  canIndent = true,
  canOutdent = true,
  hasCopiedTask = false,
  relatedActionItems = [],
}: TaskContextMenuProps) {
  const [isOpen, setIsOpen] = useState(!!position);

  // Update open state when position changes
  useEffect(() => {
    setIsOpen(!!position);
  }, [position]);

  // Handle close
  const handleOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open);
      if (!open) {
        onClose();
      }
    },
    [onClose]
  );

  // Handle action click
  const handleAction = useCallback(
    (action: ScheduleContextAction) => {
      onAction(action, task);
      handleOpenChange(false);
    },
    [onAction, task, handleOpenChange]
  );

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if modifier keys are pressed (except for shortcuts)
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case "Escape":
          handleOpenChange(false);
          break;
        case "Delete":
        case "Backspace":
          if (task) {
            e.preventDefault();
            handleAction("delete_task");
          }
          break;
        case "Enter":
          if (task) {
            e.preventDefault();
            handleAction("edit_task");
          }
          break;
        case "c":
          if ((e.metaKey || e.ctrlKey) && task) {
            e.preventDefault();
            handleAction("copy_task");
          }
          break;
        case "x":
          if ((e.metaKey || e.ctrlKey) && task) {
            e.preventDefault();
            handleAction("cut_task");
          }
          break;
        case "v":
          if ((e.metaKey || e.ctrlKey) && hasCopiedTask) {
            e.preventDefault();
            handleAction("paste_task");
          }
          break;
        case "Tab":
          if (task) {
            e.preventDefault();
            if (e.shiftKey && canOutdent) {
              handleAction("outdent_task");
            } else if (!e.shiftKey && canIndent) {
              handleAction("indent_task");
            }
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, task, handleAction, handleOpenChange, canIndent, canOutdent, hasCopiedTask]);

  if (!position) return null;

  const isBulkSelection = selectedCount > 1;
  const isMilestone = task?.is_milestone ?? false;

  // Build action list
  const actions: ContextMenuAction[] = [
    {
      key: "add_task",
      label: "Add Task Below",
      icon: Plus,
      shortcut: "⌘N",
    },
    {
      key: "edit_task",
      label: "Edit Task",
      icon: Pencil,
      shortcut: "Enter",
      disabled: !task,
    },
    {
      key: "delete_task",
      label: isBulkSelection ? `Delete ${selectedCount} Tasks` : "Delete Task",
      icon: Trash2,
      shortcut: "⌫",
      variant: "destructive",
      disabled: !task,
      dividerAfter: true,
    },
    {
      key: "copy_task",
      label: isBulkSelection ? `Copy ${selectedCount} Tasks` : "Copy Task",
      icon: Copy,
      shortcut: "⌘C",
      disabled: !task,
    },
    {
      key: "cut_task",
      label: isBulkSelection ? `Cut ${selectedCount} Tasks` : "Cut Task",
      icon: Scissors,
      shortcut: "⌘X",
      disabled: !task,
    },
    {
      key: "paste_task",
      label: "Paste Task",
      icon: ClipboardPaste,
      shortcut: "⌘V",
      disabled: !hasCopiedTask,
      dividerAfter: true,
    },
    {
      key: "indent_task",
      label: "Indent",
      icon: ArrowRight,
      shortcut: "Tab",
      disabled: !task || !canIndent,
    },
    {
      key: "outdent_task",
      label: "Outdent",
      icon: ArrowLeft,
      shortcut: "⇧Tab",
      disabled: !task || !canOutdent,
      dividerAfter: true,
    },
    {
      key: "convert_to_milestone",
      label: isMilestone ? "Convert to Task" : "Convert to Milestone",
      icon: Flag,
      disabled: !task,
    },
    {
      key: "set_deadline",
      label: "Set Deadline",
      icon: Calendar,
      disabled: !task,
    },
    {
      key: "scroll_to_task",
      label: "Scroll to Task in Gantt",
      icon: Eye,
      disabled: !task,
      dividerAfter: true,
    },
  ];

  // Add bulk edit option if multiple selected
  if (isBulkSelection) {
    actions.splice(2, 0, {
      key: "bulk_edit_tasks",
      label: `Edit ${selectedCount} Tasks`,
      icon: CheckSquare,
    });
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      {/* Hidden trigger - positioned at click location */}
      <div
        style={{
          position: "fixed",
          left: position.x,
          top: position.y,
          width: 1,
          height: 1,
          pointerEvents: "none",
        }}
      />
      <DropdownMenuContent
        className="w-56"
        style={{
          position: "fixed",
          left: position.x,
          top: position.y,
        }}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {task && (
          <>
            <DropdownMenuLabel className="font-normal">
              <div className="flex items-center gap-2">
                {task.is_milestone && <Flag className="h-3 w-3 text-amber-500" />}
                <span className="font-medium truncate max-w-[180px]">
                  {task.name}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}

        {actions.map((action) => (
          <div key={action.key}>
            <DropdownMenuItem
              onClick={() => handleAction(action.key)}
              disabled={action.disabled}
              className={cn(
                action.variant === "destructive" &&
                  "text-destructive focus:text-destructive"
              )}
            >
              <action.icon className="mr-2 h-4 w-4" />
              <span>{action.label}</span>
              {action.shortcut && (
                <DropdownMenuShortcut>{action.shortcut}</DropdownMenuShortcut>
              )}
            </DropdownMenuItem>
            {action.dividerAfter && <DropdownMenuSeparator />}
          </div>
        ))}

        {task && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <ListChecks className="mr-2 h-4 w-4" />
                <span>Related action items</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {relatedActionItems.length}
                </span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-80 p-0">
                <div className="border-b px-3 py-2">
                  <p className="text-sm font-medium">Related action items</p>
                  <RelatedActionItemsSummary items={relatedActionItems} />
                </div>
                <div className="px-3">
                  <RelatedActionItemsList items={relatedActionItems} compact />
                </div>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        )}

        {/* Import/Export Submenu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <MoreVertical className="mr-2 h-4 w-4" />
            <span>More Actions</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-48">
            <DropdownMenuItem onClick={() => handleAction("import_schedule")}>
              <Upload className="mr-2 h-4 w-4" />
              <span>Import Schedule</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAction("export_schedule")}>
              <Download className="mr-2 h-4 w-4" />
              <span>Export Schedule</span>
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// =============================================================================
// HOOK FOR CONTEXT MENU STATE
// =============================================================================

interface UseTaskContextMenuReturn {
  contextMenu: {
    task: ScheduleTask | null;
    position: Position | null;
  };
  openContextMenu: (task: ScheduleTask, position: Position) => void;
  closeContextMenu: () => void;
  handleContextMenuAction: (
    action: ScheduleContextAction,
    task: ScheduleTask | null
  ) => void;
}

export function useTaskContextMenu(
  handlers: Partial<Record<ScheduleContextAction, (task: ScheduleTask | null) => void>>
): UseTaskContextMenuReturn {
  const [contextMenu, setContextMenu] = useState<{
    task: ScheduleTask | null;
    position: Position | null;
  }>({
    task: null,
    position: null,
  });

  const openContextMenu = useCallback((task: ScheduleTask, position: Position) => {
    setContextMenu({ task, position });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu({ task: null, position: null });
  }, []);

  const handleContextMenuAction = useCallback(
    (action: ScheduleContextAction, task: ScheduleTask | null) => {
      const handler = handlers[action];
      if (handler) {
        handler(task);
      }
      closeContextMenu();
    },
    [handlers, closeContextMenu]
  );

  return {
    contextMenu,
    openContextMenu,
    closeContextMenu,
    handleContextMenuAction,
  };
}
