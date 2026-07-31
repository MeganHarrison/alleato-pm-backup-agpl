"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";
import Link from "next/link";

import {
  Button,
  Checkbox,
  InfoAlert,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ds";
import { apiFetch } from "@/lib/api-client";

type Position = {
  id: string;
  label: string;
};

type SubmissionResult = {
  candidateId: string;
  applicationId: string;
  requisitionId: string;
  candidateName: string;
  expiresAt: string;
  resumeStatus: "quarantined";
};

function createIdempotencyKey() {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error("Secure browser identifiers are unavailable.");
  }
  return globalThis.crypto.randomUUID();
}

export function RecruitingIntakeUatForm({
  positions,
}: {
  positions: Position[];
}) {
  const [submitting, setSubmitting] = useState(false);
  const [consented, setConsented] = useState(false);
  const [requisitionId, setRequisitionId] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(createIdempotencyKey);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmissionResult | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!consented) {
      setError("Confirm consent before submitting the test application.");
      return;
    }
    if (!requisitionId) {
      setError("Select an open position before submitting.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setResult(null);

    let body: Omit<SubmissionResult, "requisitionId">;
    try {
      body = await apiFetch<Omit<SubmissionResult, "requisitionId">>(
        "/api/recruiting/intake-uat",
        {
          method: "POST",
          body: new FormData(form),
        },
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The test application could not be submitted.",
      );
      setSubmitting(false);
      return;
    }

    setResult({ ...body, requisitionId });
    form.reset();
    setConsented(false);
    setRequisitionId("");
    setIdempotencyKey(createIdempotencyKey());
    setSubmitting(false);
  }

  async function handleDeleteTestData() {
    if (!result) return;
    setDeleting(true);
    setError(null);
    try {
      await apiFetch(
        `/api/recruiting/intake-uat?candidateId=${encodeURIComponent(result.candidateId)}`,
        { method: "DELETE" },
      );
      setResult(null);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The UAT record could not be deleted.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <InfoAlert>
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium">Synthetic test information only</p>
            <p className="mt-1 text-sm">
              Use the fixed test identity, an Alleato +uat email alias, and the
              provided synthetic resume. The resume is stored in a dedicated
              private quarantine bucket and is automatically eligible for purge
              after 24 hours.
            </p>
          </div>
        </div>
      </InfoAlert>

      {result ? (
        <div
          className="rounded-lg border border-success/40 bg-success/10 p-5"
          role="status"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2
              className="mt-0.5 size-5 shrink-0 text-success"
              aria-hidden="true"
            />
            <div>
              <p className="font-semibold">Test application received</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {result.candidateName} is ready in the Applicant Tracker
                pipeline. The resume upload succeeded and remains quarantined
                as expected. It expires{" "}
                {new Date(result.expiresAt).toLocaleString()}.
              </p>
              <Button asChild className="mt-3">
                <Link
                  href={`/recruiting?requisitionId=${encodeURIComponent(result.requisitionId)}&applicationId=${encodeURIComponent(result.applicationId)}&tab=pipeline`}
                >
                  Open candidate in pipeline
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="mt-3 ml-2"
                disabled={deleting}
                onClick={handleDeleteTestData}
              >
                {deleting ? "Deleting…" : "Delete this test data now"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="uat-first-name">First name</Label>
            <Input
              id="uat-first-name"
              name="firstName"
              required
              maxLength={100}
              placeholder="Test"
              defaultValue="Test"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="uat-last-name">Last name</Label>
            <Input
              id="uat-last-name"
              name="lastName"
              required
              maxLength={100}
              placeholder="Candidate"
              defaultValue="Candidate"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="uat-email">Test email</Label>
            <Input
              id="uat-email"
              name="email"
              type="email"
              required
              maxLength={320}
              placeholder="jazmin+uat-001@alleatogroup.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="uat-phone">Phone (optional)</Label>
            <Input
              id="uat-phone"
              name="phone"
              type="tel"
              maxLength={40}
              placeholder="317-555-0100 through 317-555-0199"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="uat-position">Position</Label>
          <Select value={requisitionId} onValueChange={setRequisitionId}>
            <SelectTrigger id="uat-position">
              <SelectValue placeholder="Select an open position" />
            </SelectTrigger>
            <SelectContent>
              {positions.map((position) => (
                <SelectItem key={position.id} value={position.id}>
                  {position.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" name="requisitionId" value={requisitionId} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="uat-resume">Synthetic resume</Label>
          <p className="text-sm">
            <a
              href="/recruiting/synthetic-test-resume.pdf"
              download
              className="font-medium text-primary underline underline-offset-4"
            >
              Download the approved synthetic test resume
            </a>
            , then upload that same file below.
          </p>
          <Input
            id="uat-resume"
            name="resume"
            type="file"
            aria-required="true"
            accept=".pdf,application/pdf"
          />
          <p className="text-xs text-muted-foreground">
            Approved synthetic PDF fixture only, up to 4 MB.
          </p>
        </div>
        <input
          type="hidden"
          name="idempotencyKey"
          value={idempotencyKey}
        />

        <div className="hidden" aria-hidden="true">
          <Label htmlFor="uat-website">Website</Label>
          <Input
            id="uat-website"
            name="website"
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        <div className="flex items-start gap-3">
          <Checkbox
            id="uat-consent"
            name="consent"
            value="true"
            checked={consented}
            onCheckedChange={(checked) => setConsented(checked === true)}
          />
          <Label htmlFor="uat-consent" className="font-normal leading-5">
            I consent to creating this synthetic recruiting record for UAT and
            understand it expires after 24 hours. This is not permission to send
            recruiting communications.
          </Label>
        </div>

        {error ? (
          <InfoAlert variant="error" role="alert">
            {error}
          </InfoAlert>
        ) : null}

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-4" aria-hidden="true" />
            Authenticated recruiters only
          </div>
          <Button type="submit" disabled={submitting || positions.length === 0}>
            {submitting ? "Submitting…" : "Submit test application"}
          </Button>
        </div>
      </form>
    </div>
  );
}
