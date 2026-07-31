"use client";

import { useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";

import {
  Badge,
  Button,
  InfoAlert,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusText,
} from "@/components/ds";
import { SectionRuleHeading } from "@/components/layout";
import { apiFetch } from "@/lib/api-client";
import type { RecruitingWorkspaceResponse } from "@/lib/recruiting/production-contracts";

type Props = {
  resumes: RecruitingWorkspaceResponse["unassignedResumes"];
  requisitions: RecruitingWorkspaceResponse["requisitions"];
  canWrite: boolean;
  testMode: boolean;
  onAssign: (candidateId: string, requisitionId: string) => Promise<boolean>;
  onReload: () => Promise<boolean>;
};

type BatchResult = {
  fileName: string;
  status: "uploaded" | "failed";
  message: string;
};

export function RecruitingResumeInbox({
  resumes,
  requisitions,
  canWrite,
  testMode,
  onAssign,
  onReload,
}: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [positionByCandidate, setPositionByCandidate] = useState<
    Record<string, string>
  >({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const batchRetryKey = useRef<string | null>(null);

  async function uploadBatch() {
    if (!files.length) return;
    setBusy(true);
    setResult(null);
    setBatchResults([]);
    try {
      const retryKey = batchRetryKey.current ?? crypto.randomUUID();
      batchRetryKey.current = retryKey;
      const formData = new FormData();
      for (const file of files) formData.append("resumes", file);
      const response = await apiFetch<{
        uploaded: number;
        failed: number;
        results: BatchResult[];
      }>("/api/recruiting/intake-batch-uat", {
        method: "POST",
        headers: {
          "x-recruiting-batch-idempotency-key": retryKey,
        },
        body: formData,
      });
      setResult(
        `${response.uploaded} resume${response.uploaded === 1 ? "" : "s"} added; ${response.failed} failed.`,
      );
      setBatchResults(response.results);
      setFiles([]);
      batchRetryKey.current = null;
      await onReload();
    } catch (error) {
      setResult(
        error instanceof Error ? error.message : "The batch upload failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  const openPositions = requisitions.filter(
    (requisition) =>
      requisition.status === "open" && !requisition.isConfidential,
  );

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <SectionRuleHeading
            label="Add resumes in a batch"
            className="mb-0 pb-1"
          />
          <p className="text-sm text-muted-foreground">
            Select up to 10 PDF files. They stay unassigned until a recruiter
            chooses a position.
          </p>
        </div>
        {testMode ? (
          <InfoAlert>
            Testing accepts renamed copies of the approved synthetic resume
            only. Real applicant files remain blocked until malware scanning is
            configured.
          </InfoAlert>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="w-full max-w-xl space-y-2">
            <Label htmlFor="resume-batch">Resume PDFs</Label>
            <Input
              id="resume-batch"
              type="file"
              accept="application/pdf,.pdf"
              multiple
              disabled={!canWrite || !testMode || busy}
              onChange={(event) => {
                setFiles(Array.from(event.target.files ?? []).slice(0, 10));
                setResult(null);
                setBatchResults([]);
                batchRetryKey.current = crypto.randomUUID();
              }}
            />
          </div>
          <Button
            type="button"
            disabled={!files.length || busy || !canWrite || !testMode}
            onClick={() => void uploadBatch()}
          >
            {busy ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <FileUp aria-hidden="true" />
            )}
            Upload {files.length || ""}
          </Button>
        </div>
        {files.length ? (
          <p className="text-xs text-muted-foreground">
            {files.map((file) => file.name).join(", ")}
          </p>
        ) : null}
        {result ? <StatusText status={result} /> : null}
        {batchResults.length ? (
          <ul
            className="divide-y divide-border rounded-md border border-border"
            aria-label="Resume upload results"
          >
            {batchResults.map((item, index) => (
              <li
                key={`${item.fileName}:${index}`}
                className="flex flex-col gap-1 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="font-medium">{item.fileName}</span>
                <span
                  className={
                    item.status === "uploaded"
                      ? "text-success-foreground"
                      : "text-destructive"
                  }
                >
                  {item.message}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <SectionRuleHeading
              label="Unassigned resumes"
              className="mb-0 pb-1"
            />
            <p className="text-sm text-muted-foreground">
              Review each original file, then route it to an open position.
            </p>
          </div>
          <Badge variant="secondary">{resumes.length}</Badge>
        </div>
        {resumes.length ? (
          <div className="divide-y divide-border border-y border-border">
            {resumes.map((resume) => (
              <div
                key={resume.candidateId}
                className="grid gap-3 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,24rem)_auto] lg:items-center"
              >
                <div className="min-w-0">
                  <p className="font-medium">{resume.candidateName}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {resume.originalFileName}
                  </p>
                </div>
                <Select
                  value={positionByCandidate[resume.candidateId]}
                  onValueChange={(requisitionId) =>
                    setPositionByCandidate((current) => ({
                      ...current,
                      [resume.candidateId]: requisitionId,
                    }))
                  }
                >
                  <SelectTrigger aria-label={`Position for ${resume.candidateName}`}>
                    <SelectValue placeholder="Choose an open position" />
                  </SelectTrigger>
                  <SelectContent>
                    {openPositions.map((requisition) => (
                      <SelectItem key={requisition.id} value={requisition.id}>
                        {requisition.requisitionNumber} - {requisition.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button asChild variant="outline">
                    <a
                      href={`/api/recruiting/resumes?documentId=${encodeURIComponent(resume.documentId)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open resume
                    </a>
                  </Button>
                  <Button
                    type="button"
                    disabled={
                      busy ||
                      !canWrite ||
                      !positionByCandidate[resume.candidateId]
                    }
                    onClick={async () => {
                      setBusy(true);
                      await onAssign(
                        resume.candidateId,
                        positionByCandidate[resume.candidateId]!,
                      );
                      setBusy(false);
                    }}
                  >
                    Assign
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <StatusText status="No resumes are waiting for assignment." />
        )}
      </section>
    </div>
  );
}
