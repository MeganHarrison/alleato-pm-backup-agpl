"use client";

import { useId } from "react";
import { useFormStatus } from "react-dom";
import { sendExecutiveBriefingEmailAction } from "@/app/(main)/actions/executive-briefing-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function PendingSendButton() {
  const { pending } = useFormStatus();

  return (
    <Button size="sm" type="submit" disabled={pending}>
      {pending ? "Sending..." : "Send email"}
    </Button>
  );
}

export function ExecutiveBriefEmailForm({
  draftId,
  defaultRecipients,
  defaultSubject,
}: {
  draftId: string;
  defaultRecipients: string;
  defaultSubject: string;
}) {
  const recipientsId = useId();
  const subjectId = useId();
  const noteId = useId();

  return (
    <form action={sendExecutiveBriefingEmailAction} className="space-y-3">
      <input type="hidden" name="draftId" value={draftId} />

      <div className="space-y-1">
        <label
          htmlFor={recipientsId}
          className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
        >
          Recipients
        </label>
        <Input
          id={recipientsId}
          name="recipients"
          type="text"
          defaultValue={defaultRecipients}
          placeholder="brandon@company.com, ops@company.com"
        />
      </div>

      <div className="space-y-1">
        <label
          htmlFor={subjectId}
          className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
        >
          Subject
        </label>
        <Input id={subjectId} name="subject" type="text" defaultValue={defaultSubject} />
      </div>

      <div className="space-y-1">
        <label
          htmlFor={noteId}
          className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
        >
          Optional note
        </label>
        <Textarea
          id={noteId}
          name="introNote"
          placeholder="Add a short note before the brief."
          rows={3}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Sends through the shared Alleato email pipeline and logs to `email_events`.
        </p>
        <PendingSendButton />
      </div>
    </form>
  );
}
