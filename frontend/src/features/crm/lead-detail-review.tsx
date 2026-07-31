"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";

import { DateField, MoneyField } from "@/components/forms";
import {
  DetailField,
  DetailFieldGrid,
  EmptyState,
  ErrorState,
} from "@/components/ds";
import {
  DetailLayout,
  DetailPanel,
  PageShell,
  SectionRuleHeading,
} from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildCrmWorkspaceTabs } from "@/features/crm/crm-workspace-tabs";
import { useCrmWorkspace } from "@/hooks/use-crm";
import type { CrmActivity, CrmAiArtifact, CrmLead } from "@/lib/crm/types";

function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function CrmLeadDetailReview({ leadId }: { leadId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    accounts,
    leads,
    deals,
    activities,
    followUps,
    addDeal,
    addActivity,
    addFollowUp,
    convertLead,
    updateLead,
    researchLead,
    getLeadResearch,
    decideLeadResearch,
    getLeadPhoto,
    uploadLeadPhoto,
    updateFollowUpStatus,
    isLoading,
    error,
    refresh,
  } = useCrmWorkspace();
  const lead = leads.find((candidate) => candidate.id === leadId) ?? null;
  const [dealName, setDealName] = React.useState("");
  const [dealValue, setDealValue] = React.useState<number | undefined>();
  const [activityType, setActivityType] =
    React.useState<CrmActivity["activityType"]>("call");
  const [activitySubject, setActivitySubject] = React.useState("");
  const [followUpTitle, setFollowUpTitle] = React.useState("");
  const [followUpDueDate, setFollowUpDueDate] = React.useState("");
  const [companyId, setCompanyId] = React.useState("");
  const [pendingAction, setPendingAction] = React.useState<string | null>(null);
  const [profile, setProfile] = React.useState({
    fullName: "",
    prospectCompanyName: "",
    jobTitle: "",
    email: "",
    phone: "",
    websiteUrl: "",
    linkedinUrl: "",
    facebookUrl: "",
    xUrl: "",
  });
  const [research, setResearch] = React.useState<CrmAiArtifact[]>([]);
  const [photoUrl, setPhotoUrl] = React.useState<string | null>(null);
  const [researchLoadError, setResearchLoadError] = React.useState<
    string | null
  >(null);
  const [photoLoadError, setPhotoLoadError] = React.useState<string | null>(
    null,
  );
  const initializedProfileLeadId = React.useRef<string | null>(null);

  const syncProfile = React.useCallback((nextLead: CrmLead) => {
    initializedProfileLeadId.current = nextLead.id;
    setProfile({
      fullName: nextLead.fullName,
      prospectCompanyName: nextLead.prospectCompanyName,
      jobTitle: nextLead.jobTitle ?? "",
      email: nextLead.email ?? "",
      phone: nextLead.phone ?? "",
      websiteUrl: nextLead.websiteUrl ?? "",
      linkedinUrl: nextLead.linkedinUrl ?? "",
      facebookUrl: nextLead.facebookUrl ?? "",
      xUrl: nextLead.xUrl ?? "",
    });
  }, []);

  React.useEffect(() => {
    if (!lead || initializedProfileLeadId.current === lead.id) return;
    syncProfile(lead);
  }, [lead, syncProfile]);

  const loadResearch = React.useCallback(async () => {
    setResearchLoadError(null);
    try {
      setResearch(await getLeadResearch(leadId));
    } catch (caught) {
      setResearchLoadError(
        caught instanceof Error ? caught.message : "Refresh and try again.",
      );
    }
  }, [getLeadResearch, leadId]);

  const loadPhoto = React.useCallback(async () => {
    setPhotoLoadError(null);
    try {
      setPhotoUrl(await getLeadPhoto(leadId));
    } catch (caught) {
      setPhotoLoadError(
        caught instanceof Error ? caught.message : "Refresh and try again.",
      );
    }
  }, [getLeadPhoto, leadId]);

  React.useEffect(() => {
    void loadResearch();
  }, [loadResearch]);

  React.useEffect(() => {
    void loadPhoto();
  }, [loadPhoto]);

  if (isLoading) {
    return (
      <PageShell
        variant="detail"
        title="Loading lead"
        onBack={() => router.push("/crm")}
        tabs={buildCrmWorkspaceTabs(pathname)}
      >
        <p className="py-16 text-center text-sm text-muted-foreground">
          Loading CRM relationship...
        </p>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell
        variant="detail"
        title="Lead could not load"
        onBack={() => router.push("/crm")}
        tabs={buildCrmWorkspaceTabs(pathname)}
      >
        <ErrorState error={error} onRetry={() => void refresh()} />
      </PageShell>
    );
  }

  if (!lead) {
    return (
      <PageShell
        variant="detail"
        title="Lead not found"
        onBack={() => router.push("/crm")}
        tabs={buildCrmWorkspaceTabs(pathname)}
      >
        <EmptyState
          title="Lead not found"
          description="Return to Relationships and choose an available lead."
        />
      </PageShell>
    );
  }

  const leadDeals = deals.filter((deal) => deal.leadId === lead.id);
  const leadActivities = activities.filter(
    (activity) => activity.leadId === lead.id,
  );
  const leadFollowUps = followUps.filter(
    (followUp) => followUp.leadId === lead.id,
  );
  const acceptedOutlookEmails = leadActivities.filter(
    (activity) =>
      activity.activityType === "email" &&
      activity.recordOrigin === "auto" &&
      activity.sourceSystem === "outlook",
  );

  return (
    <PageShell
      variant="detail"
      title={lead.fullName}
      description="CRM-native lead · no Acumatica company required"
      onBack={() => router.push("/crm")}
      tabs={buildCrmWorkspaceTabs(pathname)}
    >
      <DetailLayout>
        <DetailPanel>
          <SectionRuleHeading label="Lead details" />
          <div className="mb-5 flex flex-wrap items-center gap-4">
            <Avatar className="size-16">
              {photoUrl ? (
                <AvatarImage src={photoUrl} alt={`${lead.fullName} profile`} />
              ) : null}
              <AvatarFallback>
                {lead.fullName
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <label className="inline-flex cursor-pointer items-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent">
                Upload photo
                <Input
                  className="sr-only"
                  type="file"
                  disabled={pendingAction !== null}
                  accept="image/jpeg,image/png,image/webp"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    setPendingAction("photo");
                    try {
                      setPhotoUrl(await uploadLeadPhoto(lead.id, file));
                      toast.success("Lead photo saved");
                    } catch (caught) {
                      toast.error("Photo could not be saved", {
                        description:
                          caught instanceof Error ? caught.message : undefined,
                      });
                    } finally {
                      setPendingAction(null);
                      event.target.value = "";
                    }
                  }}
                />
              </label>
              <p className="mt-1 text-xs text-muted-foreground">
                JPG, PNG, or WebP up to 2 MB.
              </p>
              {photoLoadError ? (
                <div className="mt-2 text-sm text-destructive">
                  <p role="alert">{photoLoadError}</p>
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0"
                    onClick={() => void loadPhoto()}
                  >
                    Retry photo
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
          <DetailFieldGrid>
            <DetailField label="Owner" value={lead.owner.name} />
            <DetailField label="Primary contact" value={lead.fullName} />
            <DetailField label="Company" value={lead.prospectCompanyName} />
            <DetailField label="Title" value={lead.jobTitle ?? undefined} />
            <DetailField label="Email" value={lead.email ?? undefined} />
            <DetailField label="Phone" value={lead.phone ?? undefined} />
          </DetailFieldGrid>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <Input
              aria-label="Lead full name"
              value={profile.fullName}
              onChange={(event) =>
                setProfile((value) => ({
                  ...value,
                  fullName: event.target.value,
                }))
              }
              placeholder="Full name"
            />
            <Input
              aria-label="Prospect company"
              value={profile.prospectCompanyName}
              onChange={(event) =>
                setProfile((value) => ({
                  ...value,
                  prospectCompanyName: event.target.value,
                }))
              }
              placeholder="Prospect company"
            />
            <Input
              aria-label="Job title"
              value={profile.jobTitle}
              onChange={(event) =>
                setProfile((value) => ({
                  ...value,
                  jobTitle: event.target.value,
                }))
              }
              placeholder="Job title"
            />
            <Input
              aria-label="Lead email"
              type="email"
              value={profile.email}
              onChange={(event) =>
                setProfile((value) => ({ ...value, email: event.target.value }))
              }
              placeholder="Email"
            />
            <Input
              aria-label="Lead phone"
              value={profile.phone}
              onChange={(event) =>
                setProfile((value) => ({ ...value, phone: event.target.value }))
              }
              placeholder="Phone"
            />
            <Input
              aria-label="Company website"
              value={profile.websiteUrl}
              onChange={(event) =>
                setProfile((value) => ({
                  ...value,
                  websiteUrl: event.target.value,
                }))
              }
              placeholder="Company website"
            />
            <Input
              aria-label="LinkedIn URL"
              value={profile.linkedinUrl}
              onChange={(event) =>
                setProfile((value) => ({
                  ...value,
                  linkedinUrl: event.target.value,
                }))
              }
              placeholder="LinkedIn URL"
            />
            <Input
              aria-label="Facebook URL"
              value={profile.facebookUrl}
              onChange={(event) =>
                setProfile((value) => ({
                  ...value,
                  facebookUrl: event.target.value,
                }))
              }
              placeholder="Facebook URL"
            />
            <Input
              aria-label="X URL"
              value={profile.xUrl}
              onChange={(event) =>
                setProfile((value) => ({ ...value, xUrl: event.target.value }))
              }
              placeholder="X URL"
            />
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              variant="outline"
              disabled={
                pendingAction !== null ||
                !profile.fullName.trim() ||
                !profile.prospectCompanyName.trim()
              }
              onClick={async () => {
                setPendingAction("profile");
                try {
                  await updateLead(lead.id, profile);
                  toast.success("Lead profile saved");
                } catch (caught) {
                  toast.error("Lead profile could not be saved", {
                    description:
                      caught instanceof Error
                        ? caught.message
                        : "Refresh and try again.",
                  });
                } finally {
                  setPendingAction(null);
                }
              }}
            >
              {pendingAction === "profile" ? "Saving..." : "Save profile"}
            </Button>
          </div>
        </DetailPanel>

        <DetailPanel>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <SectionRuleHeading label="AI-assisted public research" />
              <p className="text-sm text-muted-foreground">
                AI creates a source-cited draft only. Nothing changes until you
                approve it.
              </p>
            </div>
            <Button
              variant="outline"
              disabled={pendingAction !== null}
              onClick={async () => {
                setPendingAction("research");
                try {
                  const artifact = await researchLead(lead.id);
                  setResearch((value) => [artifact, ...value]);
                  toast.success("Research draft ready for review");
                } catch (caught) {
                  toast.error("Research could not be completed", {
                    description:
                      caught instanceof Error
                        ? caught.message
                        : "The AI provider is unavailable.",
                  });
                } finally {
                  setPendingAction(null);
                }
              }}
            >
              {pendingAction === "research"
                ? "Researching..."
                : "Research public web"}
            </Button>
          </div>
          {researchLoadError ? (
            <div className="mt-4 rounded-md border border-destructive/30 p-3 text-sm text-destructive">
              <p role="alert">{researchLoadError}</p>
              <Button
                type="button"
                variant="link"
                className="h-auto p-0"
                onClick={() => void loadResearch()}
              >
                Retry research history
              </Button>
            </div>
          ) : research.length ? (
            <div className="mt-4 space-y-4">
              {research.map((artifact) => (
                <article
                  key={artifact.id}
                  className="rounded-md border border-border p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{artifact.title}</p>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      {artifact.reviewStatus}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                    {artifact.content}
                  </p>
                  {Object.keys(artifact.suggestions ?? {}).length ? (
                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      {Object.entries(artifact.suggestions).map(
                        ([key, value]) => (
                          <div key={key}>
                            <p className="text-xs uppercase text-muted-foreground">
                              {key.replaceAll("_", " ")}
                            </p>
                            <p>{value}</p>
                          </div>
                        ),
                      )}
                    </div>
                  ) : null}
                  <ul className="mt-3 space-y-1 text-sm">
                    {artifact.citations.map((citation, index) => {
                      const url = safeHttpsUrl(citation.url);
                      if (!url) return null;
                      return (
                        <li key={`${artifact.id}:${index}`}>
                          <a
                            className="text-primary underline underline-offset-2"
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {String(citation.title ?? url)}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                  {artifact.reviewStatus === "draft" ? (
                    <div className="mt-4 flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        disabled={pendingAction !== null}
                        onClick={async () => {
                          setPendingAction(`reject:${artifact.id}`);
                          try {
                            await decideLeadResearch(
                              lead.id,
                              artifact.id,
                              "reject",
                            );
                            setResearch(await getLeadResearch(lead.id));
                            toast.success("Research draft rejected");
                          } catch (caught) {
                            toast.error("Draft could not be rejected", {
                              description:
                                caught instanceof Error
                                  ? caught.message
                                  : undefined,
                            });
                          } finally {
                            setPendingAction(null);
                          }
                        }}
                      >
                        Reject
                      </Button>
                      <Button
                        disabled={pendingAction !== null}
                        onClick={async () => {
                          setPendingAction(`apply:${artifact.id}`);
                          try {
                            const result = await decideLeadResearch(
                              lead.id,
                              artifact.id,
                              "apply",
                            );
                            const refreshedLead = result.workspace.leads.find(
                              (candidate) => candidate.id === lead.id,
                            );
                            if (refreshedLead) syncProfile(refreshedLead);
                            setResearch(await getLeadResearch(lead.id));
                            toast.success("Approved research applied");
                          } catch (caught) {
                            toast.error("Draft could not be applied", {
                              description:
                                caught instanceof Error
                                  ? caught.message
                                  : undefined,
                            });
                          } finally {
                            setPendingAction(null);
                          }
                        }}
                      >
                        Approve and apply
                      </Button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              No research drafts yet.
            </p>
          )}
        </DetailPanel>

        <DetailPanel>
          <SectionRuleHeading label="Company conversion" />
          {lead.convertedCompanyId ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                This lead is linked to an approved company. Its deals,
                activities, and tasks now use that company relationship.
              </p>
              <Button
                variant="outline"
                onClick={() =>
                  router.push(`/crm/companies/${lead.convertedCompanyId}`)
                }
              >
                Open company
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Keep this as a standalone lead until the organization becomes an
                approved company. Linking is explicit and never creates an
                Acumatica record.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Select value={companyId} onValueChange={setCompanyId}>
                  <SelectTrigger
                    aria-label="Approved company"
                    className="sm:max-w-md"
                  >
                    <SelectValue placeholder="Choose approved company" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts
                      .filter((account) => account.owner.id === lead.owner.id)
                      .map((account) => (
                        <SelectItem
                          key={account.companyId}
                          value={account.companyId}
                        >
                          {account.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  disabled={!companyId || pendingAction !== null}
                  aria-busy={pendingAction === "convert"}
                  onClick={async () => {
                    setPendingAction("convert");
                    try {
                      await convertLead(lead.id, companyId);
                      toast.success("Lead linked to company");
                    } catch (error) {
                      toast.error("Lead could not be linked", {
                        description:
                          error instanceof Error
                            ? error.message
                            : "Refresh and try again.",
                      });
                    } finally {
                      setPendingAction(null);
                    }
                  }}
                >
                  {pendingAction === "convert"
                    ? "Linking..."
                    : "Link and convert"}
                </Button>
              </div>
            </>
          )}
        </DetailPanel>

        {!lead.convertedCompanyId ? (
          <>
            <DetailPanel>
              <SectionRuleHeading label="Deal flow" />
              {leadDeals.length ? (
                <ul className="divide-y divide-border">
                  {leadDeals.map((deal) => (
                    <li
                      key={deal.id}
                      className="flex items-center justify-between gap-4 py-3 text-sm"
                    >
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto p-0 font-medium"
                        onClick={() => router.push(`/crm/deals/${deal.id}`)}
                      >
                        {deal.name}
                      </Button>
                      <span className="text-muted-foreground">
                        {deal.status}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No deal is required to keep this lead in the CRM.
                </p>
              )}
              <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_180px_auto]">
                <Input
                  aria-label="Deal name"
                  value={dealName}
                  onChange={(event) => setDealName(event.target.value)}
                  placeholder="Opportunity name"
                  maxLength={300}
                />
                <MoneyField
                  label="Deal value"
                  inline
                  value={dealValue}
                  onChange={setDealValue}
                  placeholder="Value"
                />
                <Button
                  variant="outline"
                  disabled={pendingAction !== null}
                  aria-busy={pendingAction === "deal"}
                  onClick={async () => {
                    const value = dealValue ?? 0;
                    if (
                      !dealName.trim() ||
                      !Number.isFinite(value) ||
                      value <= 0
                    ) {
                      toast.error("Enter a deal name and positive value.");
                      return;
                    }
                    setPendingAction("deal");
                    try {
                      const deal = await addDeal({
                        name: dealName.trim(),
                        target: {
                          type: "lead",
                          id: lead.id,
                          name: lead.prospectCompanyName,
                          owner: lead.owner,
                        },
                        valueEstimate: value,
                        expectedCloseDate: null,
                      });
                      toast.success("Deal created");
                      router.push(`/crm/deals/${deal.id}`);
                    } catch (error) {
                      toast.error("Deal could not be created", {
                        description:
                          error instanceof Error
                            ? error.message
                            : "Refresh and try again.",
                      });
                    } finally {
                      setPendingAction(null);
                    }
                  }}
                >
                  {pendingAction === "deal" ? "Creating..." : "Create deal"}
                </Button>
              </div>
            </DetailPanel>

            <DetailPanel>
              <SectionRuleHeading label="Activity" />
              <div className="mb-4 rounded-md bg-muted/40 p-3">
                <p className="text-sm font-medium">
                  Accepted Outlook email history
                </p>
                {acceptedOutlookEmails.length ? (
                  <ul className="mt-2 space-y-2 text-sm">
                    {acceptedOutlookEmails.map((activity) => (
                      <li
                        key={activity.id}
                        className="flex flex-wrap justify-between gap-2"
                      >
                        <span>{activity.subject}</span>
                        <span className="text-muted-foreground">
                          {format(new Date(activity.occurredAt), "MMM d, yyyy")}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">
                    No accepted Outlook emails are linked to this lead yet.
                    Pending or private messages are never shown here.
                  </p>
                )}
              </div>
              {leadActivities.length ? (
                <ul className="divide-y divide-border">
                  {leadActivities.map((activity) => (
                    <li key={activity.id} className="py-3 text-sm">
                      <span className="font-medium">{activity.subject}</span>
                      <span className="ml-2 text-muted-foreground">
                        {activity.activityType}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-4 grid gap-2 sm:grid-cols-[160px_1fr_auto]">
                <Select
                  value={activityType}
                  onValueChange={(value) =>
                    setActivityType(value as CrmActivity["activityType"])
                  }
                >
                  <SelectTrigger aria-label="Activity type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["call", "email", "meeting", "note"].map((value) => (
                      <SelectItem key={value} value={value}>
                        {value[0].toUpperCase() + value.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  aria-label="Activity subject"
                  value={activitySubject}
                  onChange={(event) => setActivitySubject(event.target.value)}
                  placeholder="Call outcome, email, meeting, or note"
                  maxLength={300}
                />
                <Button
                  variant="outline"
                  disabled={pendingAction !== null}
                  aria-busy={pendingAction === "activity"}
                  onClick={async () => {
                    if (!activitySubject.trim()) {
                      toast.error("Enter an activity subject.");
                      return;
                    }
                    setPendingAction("activity");
                    try {
                      await addActivity({
                        companyId: null,
                        leadId: lead.id,
                        companyName: lead.prospectCompanyName,
                        dealId: null,
                        activityType,
                        subject: activitySubject.trim(),
                        visibilityScope: "standard",
                      });
                      setActivitySubject("");
                      toast.success("Activity recorded");
                    } catch (error) {
                      toast.error("Activity could not be recorded", {
                        description:
                          error instanceof Error
                            ? error.message
                            : "Refresh and try again.",
                      });
                    } finally {
                      setPendingAction(null);
                    }
                  }}
                >
                  {pendingAction === "activity" ? "Recording..." : "Record"}
                </Button>
              </div>
            </DetailPanel>

            <DetailPanel>
              <SectionRuleHeading label="Follow-up tasks" />
              {leadFollowUps.length ? (
                <ul className="divide-y divide-border">
                  {leadFollowUps.map((followUp) => (
                    <li
                      key={followUp.id}
                      className="flex items-center justify-between gap-4 py-3 text-sm"
                    >
                      <span>{followUp.title}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          {followUp.dueDate}
                        </span>
                        {followUp.status !== "done" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={pendingAction !== null}
                            onClick={async () => {
                              setPendingAction(`follow-up:${followUp.id}`);
                              try {
                                await updateFollowUpStatus(followUp.id, "done");
                                toast.success("Follow-up completed");
                              } catch (error) {
                                toast.error(
                                  "Follow-up could not be completed",
                                  {
                                    description:
                                      error instanceof Error
                                        ? error.message
                                        : "Refresh and try again.",
                                  },
                                );
                              } finally {
                                setPendingAction(null);
                              }
                            }}
                          >
                            Complete
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Lead follow-ups appear in the existing Tasks workspace.
                </p>
              )}
              <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_180px_auto]">
                <Input
                  aria-label="Follow-up title"
                  value={followUpTitle}
                  onChange={(event) => setFollowUpTitle(event.target.value)}
                  placeholder="Call, email, or next step"
                  maxLength={300}
                />
                <DateField
                  label="Follow-up due date"
                  hideLabel
                  value={
                    followUpDueDate
                      ? new Date(`${followUpDueDate}T12:00:00`)
                      : undefined
                  }
                  onChange={(date) =>
                    setFollowUpDueDate(date ? format(date, "yyyy-MM-dd") : "")
                  }
                />
                <Button
                  variant="outline"
                  disabled={pendingAction !== null}
                  aria-busy={pendingAction === "task"}
                  onClick={async () => {
                    if (!followUpTitle.trim() || !followUpDueDate) {
                      toast.error("Enter a follow-up and due date.");
                      return;
                    }
                    setPendingAction("task");
                    try {
                      await addFollowUp({
                        companyId: null,
                        leadId: lead.id,
                        dealId: null,
                        title: followUpTitle.trim(),
                        dueDate: followUpDueDate,
                        assignee: lead.owner.name,
                        priority: "high",
                      });
                      setFollowUpTitle("");
                      setFollowUpDueDate("");
                      toast.success("Follow-up added to Tasks");
                    } catch (error) {
                      toast.error("Follow-up could not be created", {
                        description:
                          error instanceof Error
                            ? error.message
                            : "Refresh and try again.",
                      });
                    } finally {
                      setPendingAction(null);
                    }
                  }}
                >
                  {pendingAction === "task" ? "Adding..." : "Add task"}
                </Button>
              </div>
            </DetailPanel>
          </>
        ) : null}
      </DetailLayout>
    </PageShell>
  );
}
