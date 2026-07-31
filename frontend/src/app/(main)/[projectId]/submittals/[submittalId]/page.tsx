import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { notFound } from "next/navigation";
import { SubmittalDetailClient } from "@/features/submittals/submittal-detail-client";
import type { SubmittalDetail } from "@/hooks/use-submittals";
import { listLinkedPatternCDocuments } from "@/lib/documents/pattern-c-attachments";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Props {
  params: Promise<{ projectId: string; submittalId: string }>;
}

type SubmittalDetailBase = Omit<
  SubmittalDetail,
  | "attachments"
  | "responsible_contractor"
  | "responsible_contractor_id"
  | "linked_rfis"
  | "received_from"
>;

type SubmittalDetailRow = SubmittalDetailBase & {
  responsible_contractor_id: string | number | null;
};

export default async function SubmittalDetailPage({ params }: Props) {
  const { projectId, submittalId } = await params;
  const supabase = createServiceClient();

  const { data: project } = await serviceDb.from("projects")
    .select("name")
    .eq("id", parseInt(projectId, 10))
    .single();

  const { data: submittal, error } = await serviceDb.from("submittals")
    .select(
      `*,
       submittal_type:submittal_types(id, name),
       submittal_package:submittal_packages(id, name),
       submittal_workflow_steps(
         id,
         step_order,
         step_type,
         submittal_responses(
           id,
           responder_id,
           response_status,
           comments,
           responded_at
         )
       ),
       submittal_distributions(
         id,
         from_id,
         message,
         distributed_at,
         submittal_distribution_recipients(id, recipient_id)
       ),
       submittal_linked_drawings(
         id,
         drawing_id
       ),
       submittal_history(
         id,
         action,
         actor_id,
         new_status,
         changes,
         metadata,
         occurred_at
       )`,
    )
    .eq("project_id", parseInt(projectId, 10))
    .eq("id", submittalId)
    .order("step_order", { foreignTable: "submittal_workflow_steps", ascending: true })
    .single();

  if (error || !submittal) {
    notFound();
  }

  const attachments = await listLinkedPatternCDocuments({
    supabase,
    serviceClient: supabase,
    entityType: "submittal",
    entityId: submittalId,
  });

  let responsibleContractor: { id: string; name: string } | null = null;
  if (submittal.responsible_contractor_id) {
    const { data: company } = await serviceDb.from("companies")
      .select("id, name")
      .eq("id", submittal.responsible_contractor_id)
      .maybeSingle();

    if (company) {
      responsibleContractor = company;
    }
  }

  let receivedFrom: string | null = null;
  if (submittal.received_from_id) {
    const { data: person } = await serviceDb.from("people")
      .select("first_name, last_name, email")
      .eq("id", submittal.received_from_id)
      .maybeSingle();

    if (person) {
      receivedFrom =
        [person.first_name, person.last_name].filter(Boolean).join(" ").trim() ||
        person.email ||
        null;
    }
  }

  const submittalRow = submittal as SubmittalDetailRow;
  const submittalDetail: SubmittalDetail = {
    ...submittalRow,
    responsible_contractor_id:
      submittalRow.responsible_contractor_id === null
        ? null
        : String(submittalRow.responsible_contractor_id),
    responsible_contractor: responsibleContractor,
    received_from: receivedFrom,
    linked_rfis: [],
    attachments: attachments.map((attachment) => ({
      id: attachment.document_metadata_id,
      file_name: attachment.file_name ?? attachment.title ?? "Attachment",
      file_url: attachment.download_url ?? "",
      file_size: attachment.source_size,
      content_type: attachment.mime_type,
      is_current: true,
      uploaded_by: null,
      created_at: attachment.attached_at,
    })),
  };

  return (
    <SubmittalDetailClient
      submittal={submittalDetail}
      projectId={parseInt(projectId, 10)}
      projectName={project?.name ?? null}
    />
  );
}
