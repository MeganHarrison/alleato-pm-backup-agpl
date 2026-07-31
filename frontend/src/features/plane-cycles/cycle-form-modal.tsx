/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Adapted from makeplane/plane apps/web/core/components/cycles/form.tsx and
 * modal.tsx at commit 39856932cd6b9bd17eab0920506d628190b47af2.
 */

"use client";

import { useEffect, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlaneDialogContent } from "@/features/plane-work-items/plane-overlay";
import type { ScheduleTaskWithHierarchy } from "@/types/scheduling";

export type CycleFormValue = {
  name: string;
  startDate: string | null;
  finishDate: string | null;
};

export function CycleFormModal({
  cycle,
  open,
  submitting,
  error,
  onOpenChange,
  onSubmit,
}: {
  cycle: ScheduleTaskWithHierarchy | null;
  open: boolean;
  submitting: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (value: CycleFormValue) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [finishDate, setFinishDate] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(cycle?.name ?? "");
    setStartDate(cycle?.start_date ?? "");
    setFinishDate(cycle?.finish_date ?? "");
  }, [cycle, open]);

  const dateError =
    startDate && finishDate && startDate > finishDate
      ? "Start date must be on or before end date."
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <PlaneDialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{cycle ? "Edit cycle" : "Create cycle"}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim() || dateError) return;
            void onSubmit({
              name: name.trim(),
              startDate: startDate || null,
              finishDate: finishDate || null,
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="cycle-name">Name</Label>
            <Input
              id="cycle-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={255}
              autoFocus
              placeholder="Cycle name"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cycle-start">Start date</Label>
              <Input
                id="cycle-start"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cycle-finish">End date</Label>
              <Input
                id="cycle-finish"
                type="date"
                value={finishDate}
                onChange={(event) => setFinishDate(event.target.value)}
              />
            </div>
          </div>
          {(dateError || error) && (
            <Alert variant="destructive">
              <AlertDescription>{dateError ?? error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !name.trim() || Boolean(dateError)}
            >
              {submitting ? "Saving" : cycle ? "Save changes" : "Create cycle"}
            </Button>
          </DialogFooter>
        </form>
      </PlaneDialogContent>
    </Dialog>
  );
}
