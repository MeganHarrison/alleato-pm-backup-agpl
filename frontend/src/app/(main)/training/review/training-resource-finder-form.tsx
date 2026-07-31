"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TrainingRole, TrainingTopic } from "@/lib/training/types";

import { findTrainingResources } from "./finder-action";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="self-end" disabled={pending}>
      {pending ? "Finding resources…" : "Find resources"}
    </Button>
  );
}

export function TrainingResourceFinderForm({
  roles,
  topics,
}: {
  roles: TrainingRole[];
  topics: TrainingTopic[];
}) {
  if (roles.length === 0 || topics.length === 0) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Resource discovery is unavailable because active training roles or
        topics could not be loaded.
      </p>
    );
  }

  return (
    <form
      action={findTrainingResources}
      className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
    >
      <div className="space-y-2">
        <Label htmlFor="finder-role">Role</Label>
        <Select name="roleSlug" defaultValue={roles[0].slug} required>
          <SelectTrigger id="finder-role" aria-label="Training role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roles.map((role) => (
              <SelectItem key={role.id} value={role.slug}>
                {role.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="finder-topic">Topic</Label>
        <Select name="topicSlug" defaultValue={topics[0].slug} required>
          <SelectTrigger id="finder-topic" aria-label="Training topic">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {topics.map((topic) => (
              <SelectItem key={topic.id} value={topic.slug}>
                {topic.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <SubmitButton />
    </form>
  );
}
