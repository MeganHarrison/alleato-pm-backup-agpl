"use client";

import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ChatLayout } from "@/components/chat/chat-layout";
import { PageShell } from "@/components/layout";

export default function TeamChatPage(): ReactElement {
  const [username, setUsername] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const discussionId = searchParams.get("discussion");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser()
      .then(async ({ data: { user } }) => {
        if (!user) {
          setUsername("User");
          return;
        }
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("full_name, email")
          .eq("id", user.id)
          .maybeSingle();
        setUsername(profile?.full_name ?? profile?.email ?? user.email ?? "User");
      })
      .catch(() => {
        setUsername("User");
      });
  }, []);

  if (!username) return <div className="h-svh w-full" />;

  return (
    <PageShell
      variant="table"
      title="Team Chat"
      showHeader={false}
      fillHeight
      className="h-svh"
      containerPaddingClassName="px-0 pt-0 pb-0"
      contentClassName="pt-0 pb-0"
    >
      <div className="h-full w-full overflow-hidden">
        <ChatLayout username={username} initialDiscussionId={discussionId} />
      </div>
    </PageShell>
  );
}
