"use client";

import { useEffect, useState } from "react";
import {
  Archive,
  ArrowRight,
  Circle,
  Copy,
  GitBranch,
  Hash,
  PauseCircle,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useConfirm } from "@/hooks/use-confirm";
import { appToast as toast } from "@/lib/toast/app-toast";

import type { DisplayStatus, FeedbackItem } from "../types";
import { toDisplayStatus } from "../helpers";

export function ListItemContextMenu({
  item,
  children,
  onUpdateStatus,
  onSendToGitHub,
  onDelete,
}: {
  item: FeedbackItem;
  children: React.ReactNode;
  onUpdateStatus: (id: string, status: DisplayStatus) => void;
  onSendToGitHub: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [contextPos, setContextPos] = useState<{ x: number; y: number } | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const { confirm: confirmDelete, ConfirmDialog: ListItemConfirmDialog } = useConfirm();

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    setContextPos({ x: e.clientX, y: e.clientY });
  }

  useEffect(() => {
    setIsOpen(Boolean(contextPos));
  }, [contextPos]);

  const displayStatus = toDisplayStatus(item.status);
  const isInReview = displayStatus === "in_review";
  const isVerified = displayStatus === "verified";

  async function handleAction(action: string) {
    setContextPos(null);
    switch (action) {
      case "mark_in_review":
        onUpdateStatus(item.id, "in_review");
        break;
      case "mark_verified":
        onUpdateStatus(item.id, "verified");
        break;
      case "reopen":
        onUpdateStatus(item.id, "open");
        break;
      case "send_to_github":
        onSendToGitHub(item.id);
        break;
      case "view_github":
        if (item.github_issue_url) {
          window.open(item.github_issue_url, "_blank", "noopener,noreferrer");
        }
        break;
      case "open_source":
        window.open(item.page_url, "_blank", "noopener,noreferrer");
        break;
      case "copy_link":
        navigator.clipboard.writeText(
          `${window.location.origin}/feedback-inbox?id=${item.id}`,
        );
        toast.success("Link copied to clipboard");
        break;
      case "copy_id":
        navigator.clipboard.writeText(item.id);
        toast.success("ID copied to clipboard");
        break;
      case "archive":
        onUpdateStatus(item.id, "archived");
        break;
      case "defer":
        onUpdateStatus(item.id, "deferred");
        break;
      case "delete": {
        const ok = await confirmDelete({
          description: "Delete this feedback item? This cannot be undone.",
          variant: "destructive",
          confirmLabel: "Delete",
        });
        if (ok) onDelete(item.id);
        break;
      }
    }
  }

  return (
    <>
      <div onContextMenu={handleContextMenu} className="contents">
        {children}
      </div>

      {contextPos && (
        <DropdownMenu
          open={isOpen}
          onOpenChange={(open) => {
            setIsOpen(open);
            if (!open) {
              setContextPos(null);
            }
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: "fixed",
              left: contextPos.x,
              top: contextPos.y,
              width: 1,
              height: 1,
              pointerEvents: "none",
            }}
          />
          <DropdownMenuContent
            className="w-56"
            style={{
              position: "fixed",
              left: contextPos.x,
              top: contextPos.y,
            }}
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            {!isInReview && !isVerified && (
              <DropdownMenuItem onClick={() => handleAction("mark_in_review")}>
                <ShieldCheck className="h-3.5 w-3.5" />
                Mark In Review
              </DropdownMenuItem>
            )}

            {isInReview && (
              <DropdownMenuItem onClick={() => handleAction("mark_verified")}>
                <ShieldCheck className="h-3.5 w-3.5" />
                Mark Verified
              </DropdownMenuItem>
            )}

            {isVerified && (
              <DropdownMenuItem onClick={() => handleAction("reopen")}>
                <Circle className="h-3.5 w-3.5" />
                Move to Submitted
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={() => handleAction("open_source")}>
              <ArrowRight className="h-3.5 w-3.5" />
              Open submitted page
            </DropdownMenuItem>

            {!item.github_issue_number && (
              <DropdownMenuItem onClick={() => handleAction("send_to_github")}>
                <GitBranch className="h-3.5 w-3.5" />
                Create Issue
              </DropdownMenuItem>
            )}

            {item.github_issue_url && (
              <DropdownMenuItem onClick={() => handleAction("view_github")}>
                <ArrowRight className="h-3.5 w-3.5" />
                View in GitHub
              </DropdownMenuItem>
            )}

            <DropdownMenuItem onClick={() => handleAction("copy_link")}>
              <Copy className="h-3.5 w-3.5" />
              Copy link
            </DropdownMenuItem>

            <DropdownMenuItem onClick={() => handleAction("copy_id")}>
              <Hash className="h-3.5 w-3.5" />
              Copy ID
            </DropdownMenuItem>

            <DropdownMenuItem onClick={() => handleAction("defer")}>
              <PauseCircle className="h-3.5 w-3.5" />
              Defer
            </DropdownMenuItem>

            <DropdownMenuItem onClick={() => handleAction("archive")}>
              <Archive className="h-3.5 w-3.5" />
              Archive
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem variant="destructive" onClick={() => handleAction("delete")}>
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {ListItemConfirmDialog}
    </>
  );
}
