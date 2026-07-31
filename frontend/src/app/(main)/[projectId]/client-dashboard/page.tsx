import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getIsAdmin } from "@/lib/auth/current-user";
import ClientDashboard from "./client-dashboard";

export const metadata: Metadata = {
  title: "Client Dashboard | Alleato PM",
  description: "Project overview and updates for clients",
};

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ClientDashboardPage({ params }: PageProps) {
  const { projectId } = await params;
  const projectIdNum = parseInt(projectId, 10);
  const supabase = await createClient();

  // getCurrentUser() is deduplicated per request via React cache()
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  // Read is_admin from JWT claim (set by custom_access_token_hook) — no DB round-trip.
  const isAdmin = await getIsAdmin();

  if (!isAdmin) {
    // For non-admin users, verify user is a client for this project via membership
    const { data: authLink } = await supabase
      .from("users_auth")
      .select("person_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!authLink) redirect("/access-denied?reason=no-profile");

    const { data: membership } = await supabase
      .from("project_directory_memberships")
      .select("user_type")
      .eq("person_id", authLink.person_id)
      .eq("project_id", projectIdNum)
      .eq("status", "active")
      .maybeSingle();

    if (!membership) redirect("/access-denied?reason=no-project-access");

    // Non-clients go to the regular home page
    if (membership.user_type !== "client") {
      redirect(`/${projectId}/home`);
    }
  }

  // Fetch project details
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectIdNum)
    .single();

  if (!project) redirect("/");

  // Fetch prime contract
  const { data: primeContract } = await supabase
    .from("prime_contracts")
    .select(
      `id, contract_number, title, status, execution_date,
       start_date, substantial_completion_date, final_completion_date,
       contract_amount, revised_contract_amount, percent_complete`
    )
    .eq("project_id", projectIdNum)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Fetch upcoming milestones
  const { data: milestones } = await supabase
    .from("schedule_tasks")
    .select("id, name, start_date, end_date, percent_complete, is_milestone")
    .eq("project_id", projectIdNum)
    .eq("is_milestone", true)
    .order("start_date", { ascending: true })
    .limit(10);

  // Fetch open RFIs
  const { data: rfis } = await supabase
    .from("rfis")
    .select(
      "id, rfi_number, subject, status, priority, date_submitted, date_required"
    )
    .eq("project_id", projectIdNum)
    .in("status", ["open", "pending"])
    .order("date_submitted", { ascending: false })
    .limit(5);

  // Fetch recent documents from document_metadata
  const { data: rawDocuments } = await supabase
    .from("document_metadata")
    .select("id, title, file_name, file_path, source_size, type, created_at, url")
    .eq("project_id", projectIdNum)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(10);

  const documents = (rawDocuments ?? []).map((doc) => ({
    id: doc.id,
    name: doc.title ?? doc.file_name,
    file_url: doc.url ?? null,
    file_size: doc.source_size ?? null,
    file_type: doc.type ?? null,
    uploaded_at: doc.created_at,
  }));

  return (
    <ClientDashboard
      project={project}
      primeContract={primeContract}
      milestones={milestones || []}
      rfis={rfis || []}
      documents={documents || []}
    />
  );
}
