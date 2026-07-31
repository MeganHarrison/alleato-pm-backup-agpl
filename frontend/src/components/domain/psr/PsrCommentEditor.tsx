"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api-client";

interface PsrCommentEditorProps {
  projectId: string;
  month: string;
  section: string;
  initialBody?: string;
  placeholder?: string;
}

export function PsrCommentEditor({
  projectId,
  month,
  section,
  initialBody = "",
  placeholder = "Add notes for this section…",
}: PsrCommentEditorProps) {
  const [body, setBody] = useState(initialBody);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await apiFetch(`/api/projects/${projectId}/psr/comments`, {
        method: "POST",
        body: JSON.stringify({ month, section, body }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save comment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          setSaved(false);
        }}
        placeholder={placeholder}
        rows={3}
        className="resize-none text-sm"
      />
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save Notes"}
        </Button>
        {saved && (
          <span className="text-xs text-muted-foreground">Saved ✓</span>
        )}
        {error && (
          <span className="text-xs text-destructive">{error}</span>
        )}
      </div>
    </div>
  );
}
