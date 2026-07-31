"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ScheduleBaseline } from "@/lib/scheduling/schedule-baselines";
import type { ScheduleRevisionControlItem } from "./schedule-revision-controls";

type Props = {
  baselines: ScheduleBaseline[];
  revisions: ScheduleRevisionControlItem[];
  canManage: boolean;
  disabled?: boolean;
  onCapture: (input: { name: string; revisionId: string; activate: boolean }) => void | Promise<void>;
  onActivate: (baselineId: string) => void | Promise<void>;
};

export function ScheduleBaselineDialog({
  baselines,
  revisions,
  canManage,
  disabled = false,
  onCapture,
  onActivate,
}: Props) {
  const approvedRevisions = useMemo(
    () => revisions.filter((revision) => revision.status === "published" || revision.status === "superseded"),
    [revisions],
  );
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [revisionId, setRevisionId] = useState(approvedRevisions[0]?.id ?? "");

  useEffect(() => {
    if (!approvedRevisions.some((revision) => revision.id === revisionId)) {
      setRevisionId(approvedRevisions[0]?.id ?? "");
    }
  }, [approvedRevisions, revisionId]);

  const capture = () => {
    const baselineName = name.trim();
    if (!baselineName || !revisionId) return;
    void onCapture({ name: baselineName, revisionId, activate: true });
    setName("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">Plan history</Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Plan history</DialogTitle>
          <DialogDescription>
            Name an approved revision as the comparison plan. Historical task values remain in its immutable revision snapshot.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="space-y-3">
            {baselines.length === 0 ? (
              <p className="text-sm text-muted-foreground">No named baselines yet.</p>
            ) : baselines.map((baseline) => (
              <div key={baseline.id} className="flex items-center justify-between gap-3 border-b py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{baseline.name}</p>
                  <p className="text-xs text-muted-foreground">{baseline.is_active ? "Active comparison" : "Saved plan"}</p>
                </div>
                {canManage && !baseline.is_active && (
                  <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => void onActivate(baseline.id)}>
                    Set active
                  </Button>
                )}
              </div>
            ))}
          </div>

          {canManage && (
            <div className="space-y-3 border-t pt-4">
              <p className="text-sm font-medium">Capture named baseline</p>
              <div className="space-y-2">
                <Label htmlFor="schedule-baseline-name">Baseline name</Label>
                <Input
                  id="schedule-baseline-name"
                  value={name}
                  maxLength={80}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Owner baseline"
                  disabled={disabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule-baseline-revision">Approved revision</Label>
                <Select value={revisionId} onValueChange={setRevisionId} disabled={disabled || approvedRevisions.length === 0}>
                  <SelectTrigger id="schedule-baseline-revision" aria-label="Approved revision">
                    <SelectValue placeholder="Publish a revision first" />
                  </SelectTrigger>
                  <SelectContent>
                    {approvedRevisions.map((revision) => (
                      <SelectItem key={revision.id} value={revision.id}>
                        Revision {revision.revision_number} ({revision.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Close</Button>
          {canManage && (
            <Button type="button" disabled={disabled || !name.trim() || !revisionId} onClick={capture}>
              Capture baseline
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
