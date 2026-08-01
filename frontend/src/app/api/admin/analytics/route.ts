import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { requireAdmin } from "@/app/api/admin/_shared";
import { serviceDb } from "@/lib/supabase/service-db";
import { createServiceClient } from "@/lib/supabase/service";
import { GuardrailError } from "@/lib/guardrails/errors";
import { buildRecentLogins } from "./recent-logins";

export const dynamic = "force-dynamic";

const WHERE = "api.admin.analytics#GET";

export const GET = withApiGuardrails(WHERE, async () => {
  await requireAdmin(WHERE);

  const [
    usersResult,
    appSessionsResult,
    learningProgressResult,
    learningContentResult,
  ] = await Promise.all([
    // Profiles enrich every engagement row with a name and email. Consumed only
    // as an id-keyed lookup, so no ordering is needed.
    serviceDb.from("user_profiles")
      .select("id, email, full_name, is_admin"),

    serviceDb.from("app_usage_sessions")
      .select("user_id, started_at, last_seen_at, entry_surface")
      .order("last_seen_at", { ascending: false })
      .limit(500),

    serviceDb.from("learning_content_progress")
      .select("content_item_id, learner_id, highest_checkpoint, completed_at, last_viewed_at, watch_seconds")
      .order("last_viewed_at", { ascending: false })
      .limit(500),

    serviceDb.from("knowledge_content_item")
      .select("id, title, source_type")
      .eq("content_kind", "video")
      .limit(500),
  ]);

  const { data: authPage, error: authError } = await createServiceClient().auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (authError) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: WHERE,
      message: "Supabase Auth could not provide recent sign-in activity.",
      details: authError.message,
    });
  }

  const users = usersResult.data ?? [];
  const appSessions = appSessionsResult.data ?? [];
  const learningProgress = learningProgressResult.data ?? [];
  const learningContent = learningContentResult.data ?? [];
  const recentLogins = buildRecentLogins(authPage.users, users, 100);

  const sourceErrors = [
    usersResult.error,
    appSessionsResult.error,
    learningProgressResult.error,
    learningContentResult.error,
  ].filter(Boolean);
  if (sourceErrors.length) {
    throw new GuardrailError({
      code: "DATABASE_ERROR",
      where: WHERE,
      message: "Engagement reporting could not read its required data source.",
      details: sourceErrors.map((error) => error?.message),
    });
  }

  const profileById = new Map(users.map((user) => [user.id, user]));
  const contentById = new Map(learningContent.map((content) => [content.id, content]));
  const latestSessionByUser = new Map<string, (typeof appSessions)[number]>();
  for (const session of appSessions) {
    if (!latestSessionByUser.has(session.user_id)) latestSessionByUser.set(session.user_id, session);
  }
  const recentAppUsage = [...latestSessionByUser.entries()].slice(0, 100).map(([userId, session]) => ({
    userId,
    fullName: profileById.get(userId)?.full_name ?? null,
    email: profileById.get(userId)?.email ?? null,
    lastSeenAt: session.last_seen_at,
    entrySurface: session.entry_surface,
  }));
  const recentLearning = learningProgress.map((progress) => ({
    userId: progress.learner_id,
    fullName: profileById.get(progress.learner_id)?.full_name ?? null,
    email: profileById.get(progress.learner_id)?.email ?? null,
    title: contentById.get(progress.content_item_id)?.title ?? "Unavailable lesson",
    lastViewedAt: progress.last_viewed_at,
    checkpoint: progress.highest_checkpoint,
    completedAt: progress.completed_at,
    watchSeconds: progress.watch_seconds,
  }));

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    engagement: {
      recentLogins,
      recentAppUsage,
      recentLearning,
    },
  });
});
