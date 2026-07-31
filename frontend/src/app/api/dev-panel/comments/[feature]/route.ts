import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";

import { createClient, getApiRouteUser } from "@/lib/supabase/server";

export const GET = withApiGuardrails<{ feature: string }>(
  "dev-panel/comments/[feature]#GET",
  async ({ request, params }) => {
  const { feature } = await params;

  if (!/^[\w-]+$/.test(feature)) {
    return NextResponse.json({ error: "Invalid feature" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dev_panel_comments")
    .select("*")
    .eq("feature", feature)
    .is("parent_id", null) // top-level only; replies fetched client-side
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ feature, comments: data ?? [] });
  },
);

export const POST = withApiGuardrails<{ feature: string }>(
  "dev-panel/comments/[feature]#POST",
  async ({ request, params }) => {
  const { feature } = await params;

  if (!/^[\w-]+$/.test(feature)) {
    return NextResponse.json({ error: "Invalid feature" }, { status: 400 });
  }

  const body = await request.json() as {
    content: string;
    author_name: string;
    author_email?: string;
    page_url?: string;
    parent_id?: string;
    mentions?: string[];
  };

  if (!body.content?.trim() || !body.author_name?.trim()) {
    return NextResponse.json({ error: "content and author_name required" }, { status: 400 });
  }

  // Extract @mentions from content
  const mentionMatches = body.content.match(/@[\w-]+/g) ?? [];
  const mentions = [...new Set([...(body.mentions ?? []), ...mentionMatches])];

  const supabase = await createClient();
  const user = await getApiRouteUser();

  const { data, error } = await supabase
    .from("dev_panel_comments")
    .insert({
      feature,
      content: body.content.trim(),
      author_name: body.author_name.trim(),
      author_email: body.author_email,
      author_id: user?.id ?? null,
      page_url: body.page_url ?? null,
      parent_id: body.parent_id ?? null,
      mentions,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ comment: data }, { status: 201 });
  },
);
