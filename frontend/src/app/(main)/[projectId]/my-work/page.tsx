import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { PageShell } from "@/components/layout";
import { EmptyState, InfoAlert } from "@/components/ds";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  FileText,
  CheckCircle,
  MessageCircle,
  Package,
  ChevronRight,
  Clock,
} from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface SovSubmission {
  id: string;
  status: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  invite_sent_at: string | null;
  commitment: {
    id: string;
    contract_number: string | null;
    title: string | null;
    contract_company_id: string | null;
    invoice_contact_ids: string[] | null;
    is_private: boolean | null;
    non_admin_user_ids: string[] | null;
    allow_non_admin_view_sov_items: boolean | null;
  } | null;
}

interface OpenRfi {
  id: string;
  number: number;
  subject: string;
  status: string;
  created_at: string;
  responsible_contractor: string | null;
}

interface OpenSubmittal {
  id: string;
  submittal_number: string;
  title: string;
  status: string | null;
  final_due_date: string | null;
  responsible_contractor_id: string | null;
  submitter_company: string | null;
}

const SOV_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft — Not submitted", color: "text-muted-foreground" },
  submitted: { label: "Submitted — Awaiting review", color: "text-primary" },
  under_review: { label: "Under Review — Awaiting review", color: "text-primary" },
  approved: { label: "Approved", color: "text-success" },
  rejected: { label: "Rejected — Revision required", color: "text-destructive" },
  revise_resubmit: { label: "Revision requested", color: "text-warning" },
};

function StatusPill({ status }: { status: string }) {
  const { label, color } = SOV_STATUS_LABELS[status] ?? { label: status, color: "text-muted-foreground" };
  return <span className={`text-sm font-medium ${color}`}>{label}</span>;
}

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-card p-6">
      <div className="mb-4 flex items-center gap-2.5">
        <Icon className="h-4 w-4 text-primary" strokeWidth={1.5} />
        <span className="text-sm font-semibold text-foreground">{title}</span>
      </div>
      {children}
    </div>
  );
}

export default async function MyWorkPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const numericProjectId = parseInt(projectId, 10);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const serviceClient = createServiceClient();

  // Resolve person_id for the current user
  const { data: authLink } = await serviceDb.from("users_auth")
    .select("person_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!authLink) redirect("/access-denied?reason=no-profile");

  const personId = authLink.person_id;

  // Verify membership and confirm subcontractor role
  const { data: membership } = await serviceDb.from("project_directory_memberships")
    .select("user_type, permission_template_id")
    .eq("person_id", personId)
    .eq("project_id", numericProjectId)
    .eq("status", "active")
    .maybeSingle();

  // Non-subcontractors can access this page too (e.g. PM previewing) — just show a redirect hint
  const isSubcontractor = membership?.user_type === "subcontractor";

  // Resolve company_id for this person so we can filter commitments
  const { data: person } = await serviceDb.from("people")
    .select("id, company_id, first_name")
    .eq("id", personId)
    .maybeSingle();

  const companyId = person?.company_id ?? null;

  // Resolve the viewer's company name so RFIs/submittals can be scoped to their
  // company. RFIs store the responsible party as a company *name* (not an id);
  // submittals expose responsible_contractor_id (company id) and submitter_company
  // (name) — so we match on either. Names can contain commas/parens, so scoping
  // is applied in JS below rather than via a PostgREST .or() string.
  let companyName: string | null = null;
  if (companyId) {
    const { data: company } = await serviceDb.from("companies")
      .select("name")
      .eq("id", companyId)
      .maybeSingle();
    companyName = company?.name ?? null;
  }
  const normalizedCompanyName = companyName?.trim().toLowerCase() ?? null;
  const companyOwnsName = (value: string | null | undefined) =>
    !!normalizedCompanyName && (value ?? "").trim().toLowerCase() === normalizedCompanyName;

  // Fetch all data in parallel
  const [sovResult, rfisResult, submittalsResult, projectResult] = await Promise.all([
    // SOV submissions for commitments assigned to this subcontractor.
    serviceDb.from("subcontractor_sov_submissions")
      .select(`
        id,
        status,
        submitted_at,
        reviewed_at,
        invite_sent_at,
        commitment:subcontracts (
          id,
          contract_number,
          title,
          contract_company_id,
          invoice_contact_ids,
          is_private,
          non_admin_user_ids,
          allow_non_admin_view_sov_items
        )
      `)
      .eq("project_id", numericProjectId)
      .order("created_at", { ascending: false }),

    // Open RFIs on this project (scoped to the viewer's company in JS below)
    serviceDb.from("rfis")
      .select("id, number, subject, status, created_at, responsible_contractor")
      .eq("project_id", numericProjectId)
      .not("status", "in", '("closed","draft")')
      .order("created_at", { ascending: false })
      .limit(200),

    // Submittals pending action (scoped to the viewer's company in JS below)
    serviceDb.from("submittals")
      .select("id, submittal_number, title, status, final_due_date, responsible_contractor_id, submitter_company")
      .eq("project_id", numericProjectId)
      .not("status", "in", '("approved","void")')
      .order("final_due_date", { ascending: true })
      .limit(200),

    // Project name
    serviceDb.from("projects")
      .select("name")
      .eq("id", numericProjectId)
      .maybeSingle(),
  ]);

  if (sovResult.error) {
    throw new Error(`Failed to load subcontractor SOV assignments: ${sovResult.error.message}`);
  }
  if (rfisResult.error) {
    throw new Error(`Failed to load subcontractor RFI assignments: ${rfisResult.error.message}`);
  }
  if (submittalsResult.error) {
    throw new Error(`Failed to load subcontractor submittal assignments: ${submittalsResult.error.message}`);
  }
  if (projectResult.error) {
    throw new Error(`Failed to load project name: ${projectResult.error.message}`);
  }

  const allSovSubmissions = (sovResult.data ?? []) as unknown as SovSubmission[];
  const sovSubmissions = allSovSubmissions.filter((sov) => {
    const commitment = sov.commitment;
    if (!commitment) return false;

    const isInvoiceContact = (commitment.invoice_contact_ids || []).includes(personId);
    const hasExplicitSovAccess =
      (commitment.non_admin_user_ids || []).includes(personId) &&
      commitment.allow_non_admin_view_sov_items === true;
    const isCompanyCommitment = !!companyId && commitment.contract_company_id === companyId;

    if (commitment.is_private) {
      return isInvoiceContact && hasExplicitSovAccess;
    }

    return isInvoiceContact || hasExplicitSovAccess || isCompanyCommitment;
  });
  // Company-scope: a subcontractor must only see RFIs/submittals involving their
  // own company — never the whole project's. Match RFIs by responsible-contractor
  // name, submittals by responsible_contractor_id (company id) or submitter_company
  // (name). With no resolved company, nothing is theirs → show none.
  const openRfis = ((rfisResult.data ?? []) as OpenRfi[])
    .filter((rfi) => companyOwnsName(rfi.responsible_contractor))
    .slice(0, 10);
  const openSubmittals = ((submittalsResult.data ?? []) as OpenSubmittal[])
    .filter(
      (sub) =>
        (!!companyId && sub.responsible_contractor_id === companyId) ||
        companyOwnsName(sub.submitter_company),
    )
    .slice(0, 10);
  const projectName = projectResult.data?.name ?? `Project #${projectId}`;

  const hasPendingSov = sovSubmissions.some(
    (s) => s.status === "draft" || s.status === "revise_resubmit",
  );
  const hasApprovedSov = sovSubmissions.some((s) => s.status === "approved");

  return (
    <PageShell variant="dashboard" title="My Work">
      {/* Greeting */}
      <div className="mb-6">
        <p className="text-sm text-muted-foreground">
          {projectName} — here&apos;s what needs your attention
        </p>
      </div>

      {/* Attention banner for pending SOV */}
      {hasPendingSov && (
        <InfoAlert variant="warning" className="mb-6">
          You have a Schedule of Values that hasn&apos;t been submitted yet.
        </InfoAlert>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* SOV Section */}
        <SectionCard icon={FileText} title="Schedule of Values">
          {sovSubmissions.length === 0 ? (
            <EmptyState
              icon={<FileText />}
              title="No schedule of values found"
              description="No schedule of values has been assigned to your company on this project."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {sovSubmissions.map((sov) => {
                const commitment = sov.commitment;
                const href = commitment
                  ? `/${projectId}/commitments/${commitment.id}?tab=subcontractor-sov`
                  : `/${projectId}/commitments`;
                return (
                  <Link
                    key={sov.id}
                    href={href}
                    className="group flex items-start justify-between gap-4 rounded-lg p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {commitment?.contract_number
                          ? `#${commitment.contract_number}`
                          : "Subcontract"}{" "}
                        {commitment?.title && (
                          <span className="font-normal text-muted-foreground">
                            — {commitment.title}
                          </span>
                        )}
                      </p>
                      <StatusPill status={sov.status} />
                      {sov.invite_sent_at && sov.status === "draft" && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Invited{" "}
                          {new Date(sov.invite_sent_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                );
              })}
              {isSubcontractor && hasApprovedSov && (
                <div className="pt-1">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/${projectId}/invoicing/subcontractor/new`}>
                      Submit an Invoice
                    </Link>
                  </Button>
                </div>
              )}
              {isSubcontractor && !hasApprovedSov && (
                <p className="pt-1 text-xs text-muted-foreground">
                  Invoice submission opens after your Schedule of Values is approved.
                </p>
              )}
            </div>
          )}
        </SectionCard>

        {/* RFIs Section */}
        <SectionCard icon={MessageCircle} title="Open RFIs">
          {openRfis.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open RFIs assigned to your company.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {openRfis.map((rfi) => (
                <Link
                  key={rfi.id}
                  href={`/${projectId}/rfis/${rfi.id}`}
                  className="group flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">
                      RFI #{rfi.number}{" "}
                      <span className="text-muted-foreground">— {rfi.subject}</span>
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              ))}
              <div className="pt-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/${projectId}/rfis/new`}>Submit an RFI</Link>
                </Button>
              </div>
            </div>
          )}
        </SectionCard>

        {/* Submittals Section */}
        <SectionCard icon={Package} title="Submittals">
          {openSubmittals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open submittals assigned to your company.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {openSubmittals.map((sub) => (
                <Link
                  key={sub.id}
                  href={`/${projectId}/submittals/${sub.id}`}
                  className="group flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">
                      {sub.submittal_number ? `#${sub.submittal_number}` : "Submittal"}{" "}
                      {sub.title && (
                        <span className="text-muted-foreground">— {sub.title}</span>
                      )}
                    </p>
                    {sub.final_due_date && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Due{" "}
                        {new Date(sub.final_due_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Quick Links */}
        <SectionCard icon={CheckCircle} title="Quick Links">
          <div className="flex flex-col gap-2">
            <Link
              href={`/${projectId}/documents`}
              className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-muted/50"
            >
              Project Documents
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link
              href={`/${projectId}/rfis`}
              className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-muted/50"
            >
              All RFIs
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link
              href={`/${projectId}/submittals`}
              className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-muted/50"
            >
              All Submittals
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </div>
        </SectionCard>
      </div>
    </PageShell>
  );
}
