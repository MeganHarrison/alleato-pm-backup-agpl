/**
 * Public, no-login RFI response page.
 *
 * Reached via the magic link in an RFI email: /respond/rfi/<token>. The token
 * (not a Supabase session) authorizes the visitor to view the RFI question and
 * submit a response. All reads use the service-role client AFTER the token is
 * validated — see middleware bypass for `/respond/`.
 */

import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { resolveRfiResponseToken } from "@/lib/rfi/response-tokens";
import { RfiRespondForm } from "./respond-form";

export const dynamic = "force-dynamic";

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">{children}</div>
    </main>
  );
}

export default async function RfiRespondPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createServiceClient();

  const resolved = await resolveRfiResponseToken(supabase, token);

  if (!resolved) {
    return (
      <PublicShell>
        <div className="rounded-xl bg-muted/50 p-8 text-center">
          <h1 className="text-lg font-semibold text-foreground">
            This response link is no longer valid
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The link may have expired or been replaced. Please check for a newer
            RFI email, or contact the project team for an updated link.
          </p>
        </div>
      </PublicShell>
    );
  }

  const { data: rfi } = await serviceDb.from("rfis")
    .select("id, number, subject, question, due_date, status, project_id")
    .eq("id", resolved.rfiId)
    .maybeSingle();

  if (!rfi) {
    return (
      <PublicShell>
        <div className="rounded-xl bg-muted/50 p-8 text-center">
          <h1 className="text-lg font-semibold text-foreground">RFI not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This RFI may have been removed. Contact the project team for help.
          </p>
        </div>
      </PublicShell>
    );
  }

  const [{ data: project }, { data: responses }] = await Promise.all([
    serviceDb.from("projects").select("name").eq("id", rfi.project_id).maybeSingle(),
    serviceDb.from("rfi_responses")
      .select("id, responder_name, body, created_at, is_official")
      .eq("rfi_id", rfi.id)
      .order("created_at", { ascending: true }),
  ]);

  const isClosed = rfi.status === "closed" || rfi.status === "closed-draft";
  const dueDate = formatDate(rfi.due_date);

  return (
    <PublicShell>
      <div className="rounded-xl bg-muted/50 p-6 sm:p-8">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
          {project?.name ?? "Project"} · RFI #{rfi.number}
        </p>
        <h1 className="mt-1 text-xl font-semibold text-foreground">
          {rfi.subject}
        </h1>
        {dueDate ? (
          <p className="mt-1 text-sm text-muted-foreground">Response requested by {dueDate}</p>
        ) : null}

        {rfi.question ? (
          <div className="mt-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Question
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
              {rfi.question}
            </p>
          </div>
        ) : null}

        {responses && responses.length > 0 ? (
          <div className="mt-6 space-y-3 border-t border-border pt-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Responses
            </p>
            {responses.map((r) => (
              <div key={r.id} className="rounded-md bg-muted/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {r.responder_name ?? "Response"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(r.created_at)}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                  {r.body}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-6 border-t border-border pt-5">
          {isClosed ? (
            <p className="text-sm text-muted-foreground">
              This RFI is closed and is no longer accepting responses.
            </p>
          ) : (
            <RfiRespondForm
              token={resolved.token}
              responderName={resolved.recipientName ?? resolved.recipientEmail}
            />
          )}
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Responding as {resolved.recipientEmail}. No account or login required.
      </p>
    </PublicShell>
  );
}
