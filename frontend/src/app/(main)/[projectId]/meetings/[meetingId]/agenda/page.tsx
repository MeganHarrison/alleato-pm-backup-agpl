"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowRight,
  Calendar,
  Copy,
  Download,
  FileText,
  LinkIcon,
  MapPin,
  MoreVertical,
  Paperclip,
  Trash2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import {
  ContentSectionStack,
  DetailLayout,
  DetailPanel,
  PageShell,
  PageTabs,
  SectionRuleHeading,
} from "@/components/layout";
import {
  ConfirmDeleteDialog,
  EmptyState,
  EntityAttachments,
} from "@/components/ds";
import { DetailPropertyBar, DetailPropertyItem } from "@/components/ui/detail-property-bar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ds/error-state";
import { formatDate } from "@/lib/format";
import { usePeople } from "@/hooks/use-people";
import {
  useCreateFollowUpMeeting,
  useDeleteMeeting,
  useMeetingDetail,
  useSetAttendeeAttendance,
  type MeetingDetail,
} from "@/hooks/use-meetings";
import { apiFetch, apiFetchBlob } from "@/lib/api-client";
import {
  AgendaSection,
  MeetingActionItemsSection,
} from "@/components/domain/meetings/agenda-section";
import { MeetingSummaryPane } from "@/components/domain/meetings/meeting-summary-pane";
import { MeetingTranscriptPane } from "@/components/domain/meetings/meeting-transcript-pane";
import { meetingStatusLabel } from "@/features/meetings/meeting-series-table-config";

type DetailTab = "agenda" | "transcript" | "sources" | "minutes";

const QUICK_LINKS = [
  { label: "Submittals", href: "submittals" },
  { label: "RFIs", href: "rfis" },
  { label: "Change events", href: "change-events" },
  { label: "Change orders", href: "change-orders" },
  { label: "Schedule", href: "schedule" },
  { label: "Drawings", href: "drawings" },
  { label: "Commitments", href: "commitments" },
] as const;

export default function MeetingAgendaPage() {
  const params = useParams()! ?? {};
  const router = useRouter();
  const projectId = params.projectId as string;
  const meetingId = params.meetingId as string;

  const [activeTab, setActiveTab] = useState<DetailTab>("agenda");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addAttendeeId, setAddAttendeeId] = useState<string>("");

  const { data: detail, isLoading, isError, error, refetch } = useMeetingDetail(
    projectId,
    meetingId,
  );
  const deleteMeeting = useDeleteMeeting(projectId);
  const createFollowUp = useCreateFollowUpMeeting(projectId);
  const setAttendeeAttendance = useSetAttendeeAttendance(projectId, meetingId);
  const { people } = usePeople();

  const attendeePersonIds = useMemo(
    () => new Set((detail?.attendees ?? []).map((attendee) => attendee.person_id)),
    [detail?.attendees],
  );
  const addableAttendees = useMemo(
    () => people.filter((person) => !attendeePersonIds.has(person.id)),
    [attendeePersonIds, people],
  );

  const handleCreateFollowUp = () => {
    createFollowUp.mutate(
      { meetingId, carry_open_items: true },
      {
        onSuccess: (created) => {
          router.push(`/${projectId}/meetings/${created.meeting.id}/agenda`);
        },
      },
    );
  };

  const handleDelete = async () => {
    await deleteMeeting.mutateAsync(meetingId);
    setDeleteDialogOpen(false);
    router.push(`/${projectId}/meetings`);
  };

  const handleAddAttendee = async () => {
    if (!addAttendeeId || !detail) return;
    const nextIds = [...attendeePersonIds, addAttendeeId];
    await apiFetch(`/api/projects/${projectId}/meetings/${meetingId}`, {
      method: "PATCH",
      body: JSON.stringify({ attendee_person_ids: nextIds }),
    });
    setAddAttendeeId("");
    refetch();
  };

  const handleRemoveAttendee = async (personId: string) => {
    if (!detail) return;
    const nextIds = [...attendeePersonIds].filter((id) => id !== personId);
    await apiFetch(`/api/projects/${projectId}/meetings/${meetingId}`, {
      method: "PATCH",
      body: JSON.stringify({ attendee_person_ids: nextIds }),
    });
    refetch();
  };

  const handleExportPdf = async () => {
    if (!detail) return;
    try {
      toast.loading("Generating PDF...", { id: "meeting-pdf-export" });
      const blob = await apiFetchBlob(`/api/projects/${projectId}/meetings/${meetingId}/pdf`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `meeting-${detail.meeting.number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded", { id: "meeting-pdf-export" });
    } catch {
      toast.error("Failed to generate PDF", { id: "meeting-pdf-export" });
    }
  };

  if (isLoading) {
    return (
      <PageShell
        variant="detail"
        title="Loading meeting..."
        onBack={() => router.push(`/${projectId}/meetings`)}
      >
        <Skeleton className="h-96" />
      </PageShell>
    );
  }

  if (isError || !detail) {
    return (
      <PageShell
        variant="detail"
        title="Meeting"
        onBack={() => router.push(`/${projectId}/meetings`)}
      >
        <ErrorState title="Couldn't load meeting" error={error} onRetry={() => refetch()} />
      </PageShell>
    );
  }

  const { meeting } = detail;
  const hasTranscript = Boolean(meeting.transcript_document_id);
  const hasMinutes = meeting.mode === "minutes" || meeting.status === "minutes";
  const statusLabel = meetingStatusLabel[meeting.status];
  const seriesLabel = meeting.series_name
    ? `${meeting.series_name} #${meeting.number}`
    : `Meeting #${meeting.number}`;

  return (
    <PageShell
      variant="detail"
      eyebrow={`${statusLabel} · ${seriesLabel}`}
      title={meeting.name}
      onBack={() => router.push(`/${projectId}/meetings`)}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPdf}>
            <Download className="h-4 w-4" />
            Export
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More actions">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleCreateFollowUp} disabled={createFollowUp.isPending}>
                <Copy className="h-4 w-4" />
                Create follow-up
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
    >
      <PageTabs
        variant="inline"
        tabs={[
          { label: "Agenda", href: "agenda", isActive: activeTab === "agenda" },
          { label: "Transcript", href: "transcript", isActive: activeTab === "transcript" },
          { label: "Sources", href: "sources", isActive: activeTab === "sources" },
          { label: "Minutes", href: "minutes", isActive: activeTab === "minutes" },
        ]}
        onTabClick={(href) => setActiveTab(href as DetailTab)}
      />

      <DetailPropertyBar className="mb-6 pb-0">
        {meeting.meeting_date ? (
          <DetailPropertyItem icon={Calendar}>
            {formatDate(meeting.meeting_date)}
            {meeting.start_time ? ` · ${meeting.start_time}` : ""}
          </DetailPropertyItem>
        ) : (
          <DetailPropertyItem icon={Calendar} muted>
            Set date
          </DetailPropertyItem>
        )}
        {meeting.location ? (
          <DetailPropertyItem icon={MapPin}>{meeting.location}</DetailPropertyItem>
        ) : null}
        {meeting.meeting_link ? (
          <DetailPropertyItem icon={LinkIcon} href={meeting.meeting_link} external>
            Meeting link
          </DetailPropertyItem>
        ) : null}
        {hasTranscript ? (
          <DetailPropertyItem icon={FileText}>Transcript linked</DetailPropertyItem>
        ) : (
          <DetailPropertyItem icon={FileText} muted>
            No transcript
          </DetailPropertyItem>
        )}
      </DetailPropertyBar>

      <ContentSectionStack className="pt-1">
        {activeTab === "agenda" ? (
          <DetailLayout
            sidebarAt="lg"
            sidebar={
              <MeetingCommandRail
                projectId={projectId}
                detail={detail}
                addableAttendees={addableAttendees}
                addAttendeeId={addAttendeeId}
                onAddAttendeeIdChange={setAddAttendeeId}
                onAddAttendee={handleAddAttendee}
                onRemoveAttendee={handleRemoveAttendee}
                onSetAttendance={(personId, attended) =>
                  setAttendeeAttendance.mutate({ personId, attended })
                }
                onShowSources={() => setActiveTab("sources")}
              />
            }
          >
            <section className="space-y-4">
              <div className="space-y-1">
                <SectionRuleHeading label="Agenda" className="mb-0 pb-0" />
                <p className="text-xs text-muted-foreground">
                  Inline rows are the primary surface. Prior history stays quiet until opened.
                </p>
              </div>

              <AgendaSection
                projectId={Number(projectId)}
                meetingId={meetingId}
                detail={detail}
                mode="agenda"
              />
            </section>

            <MeetingActionItemsSection
              projectId={Number(projectId)}
              meetingId={meetingId}
              detail={detail}
            />
          </DetailLayout>
        ) : null}

        {activeTab === "transcript" ? (
          hasTranscript ? (
            <MeetingTranscriptPane
              transcriptDocumentId={meeting.transcript_document_id}
              meetingId={meetingId}
              meetingTitle={meeting.name}
              projectId={Number(projectId)}
            />
          ) : (
            <EmptyState
              icon={<FileText />}
              title="No transcript linked"
              description="Link a transcript from Sources when one is available."
            />
          )
        ) : null}

        {activeTab === "sources" ? (
          <DetailPanel className="space-y-8">
            <section>
              <SectionRuleHeading label="Attachments" />
              <EntityAttachments
                entityType="meeting"
                entityId={meeting.id}
                projectId={projectId}
                showLabel={false}
              />
            </section>

            <MeetingSummaryPane
              projectId={projectId}
              meetingId={meetingId}
              hasTranscript={hasTranscript}
            />
          </DetailPanel>
        ) : null}

        {activeTab === "minutes" ? (
          hasMinutes ? (
            <AgendaSection
              projectId={Number(projectId)}
              meetingId={meetingId}
              detail={detail}
              mode="minutes"
            />
          ) : (
            <EmptyState
              icon={<FileText />}
              title="Minutes not available yet"
              description="Meeting minutes will populate after the meeting has been completed."
            />
          )
        ) : null}
      </ContentSectionStack>

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        itemName={meeting.name}
        onConfirm={handleDelete}
        isDeleting={deleteMeeting.isPending}
      />
    </PageShell>
  );
}

function MeetingCommandRail({
  projectId,
  detail,
  addableAttendees,
  addAttendeeId,
  onAddAttendeeIdChange,
  onAddAttendee,
  onRemoveAttendee,
  onSetAttendance,
  onShowSources,
}: {
  projectId: string;
  detail: MeetingDetail;
  addableAttendees: Array<{ id: string; first_name: string | null; last_name: string | null; email: string | null }>;
  addAttendeeId: string;
  onAddAttendeeIdChange: (value: string) => void;
  onAddAttendee: () => void;
  onRemoveAttendee: (personId: string) => void;
  onSetAttendance: (personId: string, attended: boolean | null) => void;
  onShowSources: () => void;
}) {
  const decisions = detail.categories
    .flatMap((category) => category.items)
    .filter((item) => item.status === "closed" || Boolean(item.official_minutes))
    .slice(0, 3);

  return (
    <>
      <section>
        <SectionRuleHeading
          label="Attendees"
          actions={
            addableAttendees.length > 0 ? (
              <Select value={addAttendeeId} onValueChange={onAddAttendeeIdChange}>
                <SelectTrigger className="h-7 w-auto border-none px-1 text-xs shadow-none">
                  <SelectValue placeholder={<UserPlus className="h-3.5 w-3.5" />} />
                </SelectTrigger>
                <SelectContent>
                  {addableAttendees.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {[person.first_name, person.last_name].filter(Boolean).join(" ") || person.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : undefined
          }
        />
        {addAttendeeId ? (
          <div className="mb-3 flex items-center gap-2">
            <Button size="xs" onClick={onAddAttendee}>
              Add
            </Button>
            <Button size="xs" variant="ghost" onClick={() => onAddAttendeeIdChange("")}>
              Cancel
            </Button>
          </div>
        ) : null}
        {detail.attendees.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attendees.</p>
        ) : (
          <ul className="space-y-2">
            {detail.attendees.map((attendee) => (
              <li
                key={attendee.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Checkbox
                    checked={attendee.attended === true}
                    aria-label={`Mark ${attendee.person.first_name} ${attendee.person.last_name} attended`}
                    onCheckedChange={(checked) =>
                      onSetAttendance(attendee.person_id, checked === true)
                    }
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {attendee.person.first_name} {attendee.person.last_name}
                    </p>
                    {attendee.person.company_name ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {attendee.person.company_name}
                      </p>
                    ) : null}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-xs" aria-label="Attendee actions">
                      <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => onRemoveAttendee(attendee.person_id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionRuleHeading label="Decisions today" />
        {decisions.length > 0 ? (
          <ul className="space-y-2">
            {decisions.map((item) => (
              <li key={item.id} className="flex gap-2 text-sm">
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {item.agenda_number}
                </span>
                <span className="min-w-0 text-muted-foreground">{item.title}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No decisions captured yet"
            description="Decisions made during the meeting will appear here."
            className="py-6"
          />
        )}
      </section>

      <section>
        <SectionRuleHeading label="Parking lot" />
        <EmptyState
          title="No parking lot items"
          description="Items deferred to a later discussion will appear here."
          className="py-6"
        />
      </section>

      <section>
        <SectionRuleHeading label="Sources" />
        <div className="space-y-2 text-sm">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onShowSources}
            className="h-7 w-full justify-between px-1 text-left text-muted-foreground hover:text-foreground"
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <Paperclip className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Attachments</span>
            </span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0" />
          </Button>
          <span className="flex items-center gap-2 text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            {detail.meeting.transcript_document_id ? "Transcript linked" : "No transcript"}
          </span>
        </div>
      </section>

      <section>
        <SectionRuleHeading label="Quick links" />
        <nav className="grid grid-cols-1 gap-1 text-sm" aria-label="Meeting quick links">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              href={`/${projectId}/${link.href}`}
              className="flex items-center justify-between rounded-md px-1 py-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            >
              {link.label}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ))}
        </nav>
      </section>
    </>
  );
}
