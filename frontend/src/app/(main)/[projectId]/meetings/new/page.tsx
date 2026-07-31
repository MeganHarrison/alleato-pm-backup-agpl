"use client";

import { useParams, useRouter } from "next/navigation";

import { FormContainer, PageShell } from "@/components/layout";
import { CreateMeetingForm } from "@/components/domain/meetings/create-meeting-form";

export default function NewMeetingPage() {
  const params = useParams<{ projectId: string }>()!;
  const router = useRouter();
  const projectId = params.projectId ?? "";

  return (
    <PageShell
      variant="form"
      title="Create meeting"
      eyebrow="New meeting"
      onBack={() => router.push(`/${projectId}/meetings`)}
    >
      <FormContainer maxWidth="lg" withCard={false}>
        <CreateMeetingForm projectId={projectId} />
      </FormContainer>
    </PageShell>
  );
}
