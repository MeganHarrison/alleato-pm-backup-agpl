"use client";

import * as React from "react";

import { Button, Input } from "@/components/ds";

type SchemaExplorerOwnerCellProps = {
  ownerName: string | null;
  tableName: string;
  onSave: (ownerName: string) => Promise<void>;
  onEditingChange: (isEditing: boolean) => void;
};

export function SchemaExplorerOwnerCell({
  ownerName,
  tableName,
  onSave,
  onEditingChange,
}: SchemaExplorerOwnerCellProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(ownerName ?? "");
  const [isSaving, setIsSaving] = React.useState(false);
  const isSavingRef = React.useRef(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setDraft(ownerName ?? "");
  }, [ownerName]);

  React.useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  const stopEditing = () => {
    onEditingChange(false);
    setIsEditing(false);
  };

  const save = async () => {
    if (isSavingRef.current) return;
    const nextOwner = draft.trim();
    if (nextOwner === (ownerName ?? "")) {
      stopEditing();
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    try {
      await onSave(nextOwner);
      stopEditing();
    } catch {
      // The page reports the specific API error. Keep the draft in place so an
      // operator can correct it without re-entering the value.
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const cancel = () => {
    setDraft(ownerName ?? "");
    stopEditing();
  };

  if (isEditing) {
    return (
      <div className="min-w-44" onClick={(event) => event.stopPropagation()}>
        <Input
          ref={inputRef}
          value={draft}
          maxLength={160}
          disabled={isSaving}
          aria-label={`Owner for ${tableName}`}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => void save()}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              cancel();
            }
            if (event.key === "Enter") {
              event.preventDefault();
              void save();
            }
          }}
        />
        <div className="mt-2 flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => void save()}
            disabled={isSaving}
          >
            Save
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={cancel}
            disabled={isSaving}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={(event) => {
        event.stopPropagation();
        onEditingChange(true);
        setIsEditing(true);
      }}
      className="h-auto min-h-8 justify-start px-0 py-0 text-left text-sm hover:bg-transparent hover:text-primary"
      aria-label={`Edit owner for ${tableName}`}
    >
      {ownerName ?? "Unassigned"}
    </Button>
  );
}

type SchemaExplorerReviewCellProps = {
  lastReviewedAt: string | null;
  tableName: string;
  onReview: () => Promise<void>;
};

function formatReviewDate(lastReviewedAt: string | null) {
  if (!lastReviewedAt) return "Mark reviewed";
  const date = new Date(lastReviewedAt);
  if (Number.isNaN(date.getTime())) return "Review date unavailable";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function SchemaExplorerReviewCell({
  lastReviewedAt,
  tableName,
  onReview,
}: SchemaExplorerReviewCellProps) {
  const [isSaving, setIsSaving] = React.useState(false);

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={isSaving}
      onClick={(event) => {
        event.stopPropagation();
        setIsSaving(true);
        void onReview()
          .catch(() => undefined)
          .finally(() => setIsSaving(false));
      }}
      className="h-auto min-h-8 justify-start px-0 py-0 text-left text-sm hover:bg-transparent hover:text-primary"
      aria-label={`Mark ${tableName} reviewed`}
      title="Mark reviewed today"
    >
      {formatReviewDate(lastReviewedAt)}
    </Button>
  );
}
