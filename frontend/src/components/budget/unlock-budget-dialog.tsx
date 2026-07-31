"use client";

import { useState, useEffect } from "react";
import { Loader2, AlertTriangle, ShieldCheck, Lock } from "lucide-react";
import { toast } from "sonner";

import {
  BaseSidebar,
  SidebarBody,
  SidebarFooter,
} from "@/components/budget/modals/BaseSidebar";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiFetch, ApiError } from "@/lib/api-client";

interface UnlockBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onUnlockSuccess: () => void;
}

interface ActiveModification {
  id: number | string;
  number: string | null;
  status: string;
}

export function UnlockBudgetDialog({
  open,
  onOpenChange,
  projectId,
  onUnlockSuccess,
}: UnlockBudgetDialogProps) {
  const [unlocking, setUnlocking] = useState(false);
  const [checkingMods, setCheckingMods] = useState(true);
  const [activeMods, setActiveMods] = useState<ActiveModification[]>([]);

  // On dialog open, fetch modifications and filter to non-void to determine
  // whether unlock is allowed. This mirrors the backend guard in
  // /api/projects/[projectId]/budget/lock (DELETE) which returns 409
  // BUDGET_HAS_ACTIVE_MODIFICATIONS when any non-void modification exists.
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setCheckingMods(true);
    setActiveMods([]);

    (async () => {
      try {
        const data = await apiFetch<{ modifications?: ActiveModification[] } | ActiveModification[]>(
          `/api/projects/${projectId}/budget/modifications`,
        );

        const list: ActiveModification[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.modifications)
            ? data.modifications
            : [];

        const active = list.filter((m) => m.status !== "void");
        if (!cancelled) setActiveMods(active);
      } catch (error) {
        // If we can't load modifications, don't silently allow unlock —
        // the backend will still enforce the check, but we should warn.
        if (!cancelled) {
          toast.error("Could not check budget modifications", {
            description:
              error instanceof Error
                ? error.message
                : "Unable to verify whether unlock is allowed.",
          });
        }
      } finally {
        if (!cancelled) setCheckingMods(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  const handleUnlock = async (preserveLineItems: boolean) => {
    setUnlocking(true);

    try {
      const data = await apiFetch<{ deletedCount?: number }>(
        `/api/projects/${projectId}/budget/lock`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preserveLineItems }),
        },
      );

      if (preserveLineItems) {
        toast.success("Budget unlocked successfully", {
          description: "All budget line items have been preserved.",
        });
      } else {
        const deletedCount = data.deletedCount || 0;
        toast.success(
          `Budget unlocked and ${deletedCount} line items deleted`,
          {
            description: "The budget is now editable with a clean slate.",
          },
        );
      }

      onUnlockSuccess();
      onOpenChange(false);
    } catch (error) {
      // Defensive: if a modification was added between open and click,
      // backend returns 409 BUDGET_HAS_ACTIVE_MODIFICATIONS. Refresh the
      // dialog state so the user sees the blocked view.
      if (error instanceof ApiError && error.status === 409) {
        const body = error.body as
          | { modifications?: ActiveModification[]; modificationCount?: number }
          | undefined;
        const mods = Array.isArray(body?.modifications) ? body.modifications : [];
        setActiveMods(mods);
        toast.error("Unlock blocked", {
          description:
            error.message ||
            "Budget modifications must be deleted or voided before unlocking.",
        });
      } else {
        toast.error("Could not unlock budget", {
          description:
            error instanceof Error
              ? error.message
              : "An unexpected error occurred — please try again",
        });
      }
    } finally {
      setUnlocking(false);
    }
  };

  const isBlocked = activeMods.length > 0;

  return (
    <BaseSidebar
      open={open}
      onClose={() => onOpenChange(false)}
      title="Unlock Budget"
      subtitle={
        isBlocked
          ? "Unlock is blocked while active modifications exist"
          : "Choose how to unlock this budget"
      }
      size="md"
    >
      <SidebarBody className="px-4 py-5 sm:px-6">
        {checkingMods ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking budget modifications…
          </div>
        ) : isBlocked ? (
          <BlockedView modifications={activeMods} />
        ) : (
          <UnlockOptions unlocking={unlocking} onUnlock={handleUnlock} />
        )}
      </SidebarBody>

      <SidebarFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={unlocking}
        >
          {isBlocked ? "Close" : "Cancel"}
        </Button>
      </SidebarFooter>
    </BaseSidebar>
  );
}

function BlockedView({ modifications }: { modifications: ActiveModification[] }) {
  const count = modifications.length;
  const noun = count === 1 ? "modification" : "modifications";

  return (
    <div className="space-y-4">
      <Alert variant="destructive">
        <Lock className="h-4 w-4" />
        <AlertDescription>
          <strong>Budget cannot be unlocked.</strong> This budget has {count}{" "}
          active {noun}. Delete or void each {count === 1 ? "one" : noun} from
          the Budget Modifications tab before unlocking the budget.
        </AlertDescription>
      </Alert>

      <div className="rounded-lg bg-muted/40 overflow-hidden">
        <div className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/50">
          Blocking modifications ({count})
        </div>
        <ul className="divide-y divide-border/50">
          {modifications.map((m) => (
            <li
              key={String(m.id)}
              className="flex items-center justify-between px-4 py-3 text-sm"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-muted-foreground">
                  #{m.number ?? m.id}
                </span>
                <span className="text-foreground">
                  Modification {m.number ?? `#${m.id}`}
                </span>
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {m.status}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-muted-foreground">
        Procore parity rule: a locked budget with pending changes must have
        every modification resolved before the lock can be removed.
      </p>
    </div>
  );
}

function UnlockOptions({
  unlocking,
  onUnlock,
}: {
  unlocking: boolean;
  onUnlock: (preserveLineItems: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Warning Alert */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Unlocking the budget will allow changes to budget line items. Choose
          whether to keep or remove existing line items.
        </AlertDescription>
      </Alert>

      {/* Option 1: Preserve Line Items */}
      <div className="rounded-lg bg-muted/40 p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-2 shrink-0">
            <ShieldCheck className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 space-y-1.5">
            <p className="font-medium text-sm text-foreground">Preserve Line Items</p>
            <p className="text-sm text-muted-foreground">
              Keep all existing budget line items. Use this when you need to
              make minor adjustments or add new items without losing current data.
            </p>
          </div>
        </div>
        <Button
          onClick={() => onUnlock(true)}
          disabled={unlocking}
          size="sm"
        >
          {unlocking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Unlock and Preserve
        </Button>
      </div>

      {/* Option 2: Delete All Line Items */}
      <div className="rounded-lg bg-destructive/5 p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-destructive/10 p-2 shrink-0">
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </div>
          <div className="flex-1 space-y-1.5">
            <p className="font-medium text-sm text-foreground">Delete All Line Items</p>
            <p className="text-sm text-muted-foreground">
              Remove all budget line items and start fresh.{" "}
              <span className="font-medium text-foreground">This cannot be undone.</span>
            </p>
          </div>
        </div>
        <Button
          onClick={() => onUnlock(false)}
          disabled={unlocking}
          variant="destructive"
          size="sm"
        >
          {unlocking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Unlock and Delete All
        </Button>
      </div>
    </div>
  );
}
