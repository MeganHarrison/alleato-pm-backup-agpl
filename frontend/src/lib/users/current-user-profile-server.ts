import { GuardrailError } from "@/lib/guardrails/errors";
import type { createServiceClient } from "@/lib/supabase/service";

export type CurrentUserProfilePayload = {
  id: string;
  personId: string | null;
  fullName: string;
  email: string;
  avatarUrl?: string;
  company?: string;
  title?: string;
  role?: string;
  phone?: string;
  profileCompleteness: number;
  isAdmin: boolean;
  isDeveloper: boolean;
  onboardingCompletedAt: string | null;
};

type CurrentUserProfileRow = {
  is_admin: boolean | null;
  is_developer: boolean | null;
  full_name: string | null;
  role: string | null;
  onboarding_completed_at: string | null;
};

export function resolveCurrentUserAvatarUrl(
  directoryAvatarUrl: string | null | undefined,
  userMetadata?: Record<string, unknown>,
): string | undefined {
  if (directoryAvatarUrl?.trim()) return directoryAvatarUrl.trim();

  for (const key of ["avatar_url", "picture"]) {
    const candidate = userMetadata?.[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return undefined;
}

const joinName = (firstName?: string | null, lastName?: string | null) =>
  [firstName, lastName].map((part) => part?.trim()).filter(Boolean).join(" ");

function calculateProfileCompleteness(profile: {
  company?: string;
  title?: string;
  role?: string;
  phone?: string;
}) {
  const trackedFields = ["company", "title", "role", "phone"] as const;
  const completedFields = trackedFields.filter((field) => Boolean(profile[field]));
  const baseScore = Math.round((completedFields.length / trackedFields.length) * 100);
  return Math.min(100, Math.max(35, baseScore + 40));
}

export async function loadCurrentUserProfilePayload({
  serviceClient,
  user,
  personId,
  profileData,
  where,
}: {
  serviceClient: ReturnType<typeof createServiceClient>;
  user: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown>;
  };
  personId?: string | null;
  profileData?: CurrentUserProfileRow | null;
  where: string;
}): Promise<CurrentUserProfilePayload> {
  const personQuery = serviceClient
    .from("people")
    .select(
      "id, first_name, last_name, profile_photo_url, company, job_title, phone_mobile, phone_business",
    );
  const profilePromise =
    profileData === undefined
      ? serviceClient
          .from("user_profiles")
          .select("is_admin, is_developer, full_name, role, onboarding_completed_at")
          .eq("id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: profileData, error: null });

  const [
    { data: profileRow, error: profileError },
    { data: personData, error: personError },
  ] = await Promise.all([
    profilePromise,
    (personId
      ? personQuery.eq("id", personId)
      : personQuery.eq("auth_user_id", user.id)
    ).maybeSingle(),
  ]);

  const loadError = profileError ?? personError;
  if (loadError) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where,
      message: `Failed to load current user profile: ${loadError.message}`,
    });
  }

  const directoryFullName = joinName(personData?.first_name, personData?.last_name);
  const profile = {
    id: user.id,
    fullName:
      directoryFullName ||
      profileRow?.full_name ||
      user.email?.split("@")[0] ||
      "Your profile",
    email: user.email || "-",
    avatarUrl: resolveCurrentUserAvatarUrl(
      personData?.profile_photo_url,
      user.user_metadata,
    ),
    company: personData?.company || undefined,
    title: personData?.job_title || undefined,
    role: profileRow?.role || undefined,
    phone: personData?.phone_mobile || personData?.phone_business || undefined,
    isAdmin: profileRow?.is_admin === true || profileRow?.is_developer === true,
    isDeveloper: profileRow?.is_developer === true,
    onboardingCompletedAt: profileRow?.onboarding_completed_at ?? null,
  };

  return {
    ...profile,
    personId: personData?.id ?? personId ?? null,
    profileCompleteness: calculateProfileCompleteness(profile),
  };
}
