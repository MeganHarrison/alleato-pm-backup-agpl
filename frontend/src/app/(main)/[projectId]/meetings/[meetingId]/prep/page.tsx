"use client";
/* eslint-disable design-system/no-raw-heading */

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  FileText,
  Loader2,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

import { PageShell } from "@/components/layout";
import { EmptyState } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Editor } from "@/components/ai-chat/text-editor";
import { useMeetingDetail } from "@/hooks/use-meetings";
import {
  useMeetingPrep,
  useSaveMeetingPrep,
  useGenerateMeetingPrep,
} from "@/hooks/use-meeting-prep";
import { useConfirm } from "@/hooks/use-confirm";
import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";

export default function MeetingPrepPage() {
  const router = useRouter();
  const params = useParams()!;
  const projectId = params.projectId as string;
  const meetingId = params.meetingId as string;

  const { data: meetingResult, isLoading: meetingLoading } = useMeetingDetail(
    projectId,
    meetingId
  );
  const { data: prepResult, isLoading: prepLoading } = useMeetingPrep(
    projectId,
    meetingId
  );
  const savePrep = useSaveMeetingPrep(projectId, meetingId);
  const generatePrep = useGenerateMeetingPrep(projectId, meetingId);
  const { confirm, ConfirmDialog } = useConfirm();

  const meeting = meetingResult?.meeting;
  const attendees = meetingResult?.attendees ?? [];
  const prep = prepResult?.data;

  const [content, setContent] = useState("");
  const [hasInitialized, setHasInitialized] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize content from existing prep
  useEffect(() => {
    if (!hasInitialized && prep?.content) {
      setContent(prep.content);
      setHasInitialized(true);
    } else if (!hasInitialized && !prepLoading && !prep) {
      setHasInitialized(true);
    }
  }, [prep, prepLoading, hasInitialized]);

  // Auto-save handler with debounce
  const handleSaveContent = useCallback(
    (updatedContent: string, debounce: boolean) => {
      setContent(updatedContent);

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      if (debounce) {
        saveTimeoutRef.current = setTimeout(() => {
          savePrep.mutate(updatedContent);
        }, 1500);
      } else {
        savePrep.mutate(updatedContent);
      }
    },
    [savePrep]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // AI generation handler
  const handleGenerate = async () => {
    if (content) {
      const ok = await confirm({
        description: "This will replace your current meeting prep. Continue?",
        confirmLabel: "Continue",
      });
      if (!ok) return;
    }

    try {
      const result = await generatePrep.mutateAsync();
      if (!result.data?.content) {
        throw new Error("Meeting prep generation returned no content");
      }
      setContent(result.data.content);
    } catch (error) {
      reportNonCriticalFailure({
        area: "meeting-prep",
        operation: "generate-meeting-prep",
        error,
        userVisibleFallback: "Meeting prep was not generated.",
        metadata: { projectId, meetingId },
      });
    }
  };

  if (meetingLoading || prepLoading) {
    return (
      <PageShell variant="content" title="Meeting Prep" onBack={() => router.back()}>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageShell>
    );
  }

  if (!meeting) {
    return (
      <PageShell variant="content" title="Meeting Prep" onBack={() => router.back()}>
        <div className="py-20 text-center text-muted-foreground">
          Meeting not found
        </div>
      </PageShell>
    );
  }

  const formattedDate = meeting.meeting_date
    ? format(new Date(`${meeting.meeting_date}T12:00:00`), "EEEE, MMMM d, yyyy")
    : "Date TBD";

  return (
    <PageShell
      variant="content"
      title={meeting.name}
      description={formattedDate}
      onBack={() => router.back()}
      backLabel="Back to Meetings"
      actions={
        <Button
          onClick={handleGenerate}
          disabled={generatePrep.isPending}
          className="shrink-0"
        >
          {generatePrep.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles />
          )}
          {generatePrep.isPending
            ? "Generating..."
            : content
              ? "Regenerate Prep"
              : "Generate Meeting Prep"}
        </Button>
      }
    >

      {/* Main content */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        {/* Canvas / Editor */}
        <div>
          {generatePrep.isPending ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-4" />
              <p className="text-sm font-medium">
                Analyzing project data and generating meeting prep...
              </p>
              <p className="text-xs mt-1">This may take 15-30 seconds</p>
            </div>
          ) : content ? (
            <div className="rounded-md bg-card p-6">
              <Editor
                content={content}
                onSaveContent={handleSaveContent}
                status="idle"
                isCurrentVersion={true}
                currentVersionIndex={0}
                suggestions={[]}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <EmptyState
                icon={<FileText />}
                title="No meeting prep yet"
                description="Generate an AI-powered meeting prep that analyzes your project data, last meeting insights, and current status — or start writing from scratch."
                action={<Button onClick={handleGenerate} disabled={generatePrep.isPending}><Sparkles />Generate Meeting Prep</Button>}
              />
              <Button
                variant="outline"
                size="sm"
                className="-mt-2"
                onClick={() => {
                  setContent(
                    `# Meeting Prep: ${meeting.name}\n\n## Agenda\n\n- \n\n## Notes\n\n`
                  );
                }}
              >
                Start from Scratch
              </Button>
            </div>
          )}

          {/* Save indicator */}
          {content && (
            <div className="mt-2 text-xs text-muted-foreground">
              {savePrep.isPending
                ? "Saving..."
                : prep?.updated_at
                  ? `Last saved ${format(new Date(prep.updated_at), "h:mm a")}`
                  : "Auto-saves as you type"}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          {/* Meeting Details */}
          <SidebarSection title="Meeting Details">
            <div className="space-y-2 text-sm">
              {attendees.length > 0 && (
                <div>
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-1">
                    Attendees
                  </p>
                  <p>
                    {attendees
                      .map((attendee) =>
                        [attendee.person.first_name, attendee.person.last_name]
                          .filter(Boolean)
                          .join(" "),
                      )
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
              )}
              {meeting.overview && (
                <div>
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-1">
                    Purpose
                  </p>
                  <p>{meeting.overview}</p>
                </div>
              )}
            </div>
          </SidebarSection>

          {/* Quick Links */}
          <SidebarSection title="Project Tools">
            <div className="space-y-1">
              {[
                { label: "Budget", path: "budget" },
                { label: "Change Orders", path: "change-orders" },
                { label: "RFIs", path: "rfis" },
                { label: "Schedule", path: "schedule" },
                { label: "Commitments", path: "commitments" },
              ].map((link) => (
                <Link
                  key={link.path}
                  href={`/${projectId}/${link.path}`}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground py-1 transition-colors"
                >
                  <ArrowRight className="h-3 w-3" />
                  {link.label}
                </Link>
              ))}
            </div>
          </SidebarSection>

          {/* Prep Info */}
          {prep && (
            <SidebarSection title="Prep Info">
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <p>Version {prep.version}</p>
                <p>Generated by: {prep.generated_by}</p>
                {prep.generation_time_ms && (
                  <p>
                    Generation time:{" "}
                    {(prep.generation_time_ms / 1000).toFixed(1)}s
                  </p>
                )}
                {prep.model_used && <p>Model: {prep.model_used}</p>}
              </div>
            </SidebarSection>
          )}
        </aside>
      </div>
      {ConfirmDialog}
    </PageShell>
  );
}

// Sidebar section component
function SidebarSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}
