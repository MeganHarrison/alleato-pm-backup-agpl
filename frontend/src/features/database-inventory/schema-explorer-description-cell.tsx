"use client";

import * as React from "react";

import { Button, Textarea } from "@/components/ds";

type SchemaExplorerDescriptionCellProps = {
  description: string;
  tableName: string;
  onSave: (description: string) => Promise<string>;
  onEditingChange: (isEditing: boolean) => void;
};

export function SchemaExplorerDescriptionCell({
  description,
  tableName,
  onSave,
  onEditingChange,
}: SchemaExplorerDescriptionCellProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(description);
  const [isSaving, setIsSaving] = React.useState(false);
  const isSavingRef = React.useRef(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    setDraft(description);
  }, [description]);

  React.useEffect(() => {
    if (isEditing) textareaRef.current?.focus();
  }, [isEditing]);

  const beginEditing = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setDraft(description);
    onEditingChange(true);
    setIsEditing(true);
  };

  const cancel = () => {
    setDraft(description);
    onEditingChange(false);
    setIsEditing(false);
  };

  const save = async () => {
    if (isSavingRef.current) return;
    const nextDescription = draft.trim();
    if (nextDescription === description) {
      onEditingChange(false);
      setIsEditing(false);
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    try {
      await onSave(nextDescription);
      onEditingChange(false);
      setIsEditing(false);
    } catch {
      setDraft(description);
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  if (isEditing) {
    return (
      <div className="min-w-72" onClick={(event) => event.stopPropagation()}>
        <Textarea
          ref={textareaRef}
          aria-label={`Description for ${tableName}`}
          value={draft}
          maxLength={2000}
          rows={3}
          disabled={isSaving}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => void save()}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              cancel();
            }
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void save();
            }
          }}
          className="min-h-20 resize-y text-sm"
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
      onClick={beginEditing}
      className="h-auto max-w-md justify-start whitespace-normal px-0 py-0 text-left text-sm leading-5 hover:bg-transparent hover:text-primary"
      aria-label={`Edit description for ${tableName}`}
    >
      <span className="line-clamp-3">{description}</span>
    </Button>
  );
}
