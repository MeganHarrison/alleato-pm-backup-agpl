"use client";

import * as React from "react";
import { Send, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useAuthUsers, type AuthUser } from "@/hooks/use-auth-users";
import { useDistributeSubmittal } from "@/hooks/use-submittals";

interface SubmittalDistributeDialogProps {
  projectId: number;
  submittalId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function RecipientChip({
  user,
  onRemove,
}: {
  user: AuthUser;
  onRemove: (id: string) => void;
}) {
  const name =
    `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || user.email;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
      {name}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => onRemove(user.id)}
        className="ml-0.5 h-4 w-4 rounded-full p-0 hover:bg-primary/20"
        aria-label={`Remove ${name}`}
      >
        <X className="h-2.5 w-2.5" />
      </Button>
    </span>
  );
}

export function SubmittalDistributeDialog({
  projectId,
  submittalId,
  open,
  onOpenChange,
}: SubmittalDistributeDialogProps) {
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [message, setMessage] = React.useState("");
  const [search, setSearch] = React.useState("");

  const { users, isLoading } = useAuthUsers(String(projectId));
  const distributeMutation = useDistributeSubmittal(projectId, submittalId);

  // Reset state when dialog closes
  React.useEffect(() => {
    if (!open) {
      setSelectedIds([]);
      setMessage("");
      setSearch("");
    }
  }, [open]);

  const selectedUsers = React.useMemo(
    () => users.filter((u) => selectedIds.includes(u.id)),
    [users, selectedIds],
  );

  const availableUsers = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (selectedIds.includes(u.id)) return false;
      if (!q) return true;
      const name = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim().toLowerCase();
      return name.includes(q) || u.email.toLowerCase().includes(q);
    });
  }, [users, selectedIds, search]);

  function toggleRecipient(userId: string) {
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  }

  function removeRecipient(userId: string) {
    setSelectedIds((prev) => prev.filter((id) => id !== userId));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedIds.length === 0) return;
    await distributeMutation.mutateAsync({
      recipient_ids: selectedIds,
      message: message.trim() || null,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Distribute Submittal</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          {/* Selected recipients chips */}
          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedUsers.map((u) => (
                <RecipientChip key={u.id} user={u} onRemove={removeRecipient} />
              ))}
            </div>
          )}

          {/* Recipient search + list */}
          <div className="space-y-1.5">
            <Label className="text-xs">
              Recipients <span className="text-destructive">*</span>
            </Label>
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people..."
              className="h-8 text-xs"
            />
            <ScrollArea className="h-40 rounded-md border border-input">
              {isLoading ? (
                <p className="py-4 text-center text-xs text-muted-foreground">Loading…</p>
              ) : availableUsers.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  {users.length === 0 ? "No users found." : "All users already selected."}
                </p>
              ) : (
                <div className="p-1">
                  {availableUsers.map((u) => {
                    const name =
                      `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || u.email;
                    return (
                      <Button
                        key={u.id}
                        type="button"
                        variant="ghost"
                        onClick={() => toggleRecipient(u.id)}
                        className="w-full justify-start rounded px-3 py-2 h-auto text-xs"
                      >
                        <span className="font-medium text-foreground">{name}</span>
                        <span className="ml-2 text-muted-foreground">{u.email}</span>
                      </Button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Optional message */}
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="distribute-message">
              Message (optional)
            </Label>
            <Textarea
              id="distribute-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a message for recipients…"
              rows={3}
              className="text-xs resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={selectedIds.length === 0 || distributeMutation.isPending}
            >
              <Send className="mr-1.5 h-3.5 w-3.5" />
              Distribute
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
