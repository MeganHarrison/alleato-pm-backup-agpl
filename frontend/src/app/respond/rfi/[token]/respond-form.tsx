"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, ApiError } from "@/lib/api-client";

interface RfiRespondFormProps {
  token: string;
  responderName: string;
}

/**
 * No-login response composer. Posts to the public endpoint authorized by the
 * token. On success it shows a confirmation (the page is re-fetched on the next
 * visit; we don't optimistically render to keep this dependency-free).
 */
export function RfiRespondForm({ token, responderName }: RfiRespondFormProps) {
  const [body, setBody] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "submitting" | "done">("idle");
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) {
      setSubmitError("Please enter a response before submitting.");
      return;
    }
    setStatus("submitting");
    setSubmitError(null);
    try {
      await apiFetch(`/api/respond/rfi/${token}`, {
        method: "POST",
        body: JSON.stringify({ body: trimmed }),
      });
      setStatus("done");
      setBody("");
    } catch (err) {
      setSubmitError(
        err instanceof ApiError
          ? err.message
          : "Could not reach the server. Please check your connection and try again.",
      );
      setStatus("idle");
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-md bg-primary/10 p-4 text-center">
        <p className="text-sm font-medium text-foreground">Response submitted</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Thank you. The project team has been notified. You can close this page.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label
          htmlFor="rfi-response"
          className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Your response
        </label>
        <Textarea
          id="rfi-response"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Type your answer to this RFI…"
          rows={6}
          className="mt-1"
          disabled={status === "submitting"}
        />
      </div>

      {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">Submitting as {responderName}</span>
        <Button type="submit" disabled={status === "submitting"}>
          {status === "submitting" ? "Submitting…" : "Submit response"}
        </Button>
      </div>
    </form>
  );
}
