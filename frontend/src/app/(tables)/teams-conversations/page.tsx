import type { Metadata } from "next";
import { Suspense } from "react";

import { TeamsInboxClient } from "@/features/teams/teams-inbox-client";

export const metadata: Metadata = {
  title: "Teams Messages",
};

export const dynamic = "force-dynamic";

export default function TeamsConversationsPage() {
  return (
    <Suspense>
      <TeamsInboxClient />
    </Suspense>
  );
}
