import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageShell } from "@/components/layout";
import { getCurrentUser } from "@/lib/auth/current-user";

import { IntelligenceVisionContent } from "./intelligence-vision-content";

export const metadata: Metadata = {
  title: "Alleato Intelligence — The Vision",
  description:
    "A visual brief on the Alleato intelligence layer: how operational data becomes intelligence the business can act on — what is live today, what is being built, and where it goes next.",
};

export const dynamic = "force-dynamic";

export default async function IntelligenceVisionPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/login");
  }

  return (
    <PageShell
      variant="dashboard"
      eyebrow="For the team · big picture"
      title="Alleato Intelligence — The Vision"
      description="How AI is woven through the life of a project — from chasing the work to closing it out — built like a building, floor by floor. What's live today, what's framing up, and where it all goes."
    >
      <IntelligenceVisionContent />
    </PageShell>
  );
}
