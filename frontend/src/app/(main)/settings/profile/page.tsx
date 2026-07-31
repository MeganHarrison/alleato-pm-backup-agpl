"use client";

import { useMemo } from "react";

import { PageShell } from "@/components/layout";
import { SectionRuleHeading } from "@/components/layout/spacing";
import { ProfileImageUpload } from "@/components/misc/profile-image-upload";
import { ChangePasswordForm } from "@/components/misc/change-password-form";
import { DetailField, DetailFieldGrid } from "@/components/ds/DetailField";
import { ErrorState } from "@/components/ds/error-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useCurrentUserProfile } from "@/hooks/use-current-user-profile";
import { getBestAvatarUrl } from "@/lib/gravatar";
import { TelegramLinkPanel } from "../integrations/telegram-link-panel";
import { TeamsLinkPanel } from "../integrations/teams-link-panel";

export default function ProfilePage() {
  const { profile, isLoading, error } = useCurrentUserProfile();

  const initials = useMemo(() => {
    const name = profile?.fullName || "";
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }, [profile?.fullName]);

  if (error) {
    return (
      <PageShell variant="content" title="Profile" showHeader={false}>
        <ErrorState title="Couldn't load your profile" description={error} />
      </PageShell>
    );
  }

  return (
    <PageShell variant="content" title="Profile" showHeader={false}>
      {/* Identity header */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <Avatar className="h-14 w-14 shrink-0">
            {profile?.avatarUrl ? (
              <AvatarImage src={profile.avatarUrl} alt={profile.fullName} />
            ) : profile?.email ? (
              <AvatarImage
                src={getBestAvatarUrl(undefined, profile.email)}
                alt={profile.fullName}
              />
            ) : null}
            <AvatarFallback className="text-base">
              {isLoading ? "…" : (initials || "?")}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold text-foreground leading-snug break-words">
                {profile?.fullName || (isLoading ? "Loading…" : "Unknown user")}
              </span>
              <Badge variant={profile?.isAdmin ? "default" : "secondary"} className="shrink-0">
                {profile?.isAdmin ? "Super Admin" : "Member"}
              </Badge>
            </div>
            {(profile?.title || profile?.company) && (
              <p className="text-sm text-muted-foreground truncate">
                {[profile.title, profile.company].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>
        <div className="shrink-0">
          <ProfileImageUpload
            currentImage={profile?.avatarUrl}
            userEmail={profile?.email || ""}
            userName={profile?.fullName || "User"}
          />
        </div>
      </section>

      {/* Account details */}
      <section className="space-y-4">
        <SectionRuleHeading label="Account details" />
        <DetailFieldGrid cols={2}>
          <DetailField label="Email" value={profile?.email} />
          <DetailField label="Phone" value={profile?.phone} />
          <DetailField label="Location" value={profile?.location} />
          <DetailField label="Timezone" value={profile?.timezone} />
          <DetailField label="Region" value={profile?.region} />
          <DetailField label="Role" value={profile?.role} />
        </DetailFieldGrid>
      </section>

      {/* Password */}
      <section className="space-y-4">
        <SectionRuleHeading label="Password" />
        <ChangePasswordForm />
      </section>

      {/* Integrations */}
      <section className="space-y-5">
        <SectionRuleHeading label="Integrations" />
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Telegram</p>
            <TelegramLinkPanel />
          </div>
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Microsoft Teams</p>
            <TeamsLinkPanel />
          </div>
        </div>
      </section>
    </PageShell>
  );
}
