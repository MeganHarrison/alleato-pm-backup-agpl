import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { PageShell } from "@/components/layout";
import { EmptyState } from "@/components/ds";
import { Button } from "@/components/ui/button";
import {
  createOperationalServiceClient,
  type AppRequestLogRow,
  type DeveloperCommitLogRow,
} from "@/lib/observability/service";

export const dynamic = "force-dynamic";

type RequestLogRow = AppRequestLogRow;
type CommitLogRow = DeveloperCommitLogRow;

function formatDate(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncateMiddle(value: string, maxLength = 18): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, 8)}...${value.slice(-7)}`;
}

function actorName(row: CommitLogRow): string {
  return (
    row.pushed_by_name ??
    row.pushed_by_username ??
    row.pushed_by_email ??
    "unknown pusher"
  );
}

function commitAuthor(row: CommitLogRow): string {
  const name = row.commit_author_name ?? row.commit_committer_name;
  const email = row.commit_author_email ?? row.commit_committer_email;
  if (name && email) return `${name} <${email}>`;
  return name ?? email ?? "unknown author";
}

function StatusText({ status }: { status: number | null }) {
  if (!status) return <span className="text-muted-foreground">pending</span>;
  const tone =
    status >= 500
      ? "text-destructive"
      : status >= 400
        ? "text-warning"
        : "text-foreground";
  return <span className={tone}>{status}</span>;
}

function EmptyRows({ label }: { label: string }) {
  return <EmptyState title="No rows" description={label} className="py-10" />;
}

function RequestLogTable({ rows }: { rows: RequestLogRow[] }) {
  if (rows.length === 0) {
    return <EmptyRows label="No request rows have been recorded yet." />;
  }

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">Method</th>
              <th className="px-3 py-2 font-medium">Path</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Duration</th>
              <th className="px-3 py-2 font-medium">User</th>
              <th className="px-3 py-2 font-medium">Request ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-2 text-muted-foreground">
                  {formatDate(row.created_at)}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-foreground">
                  {row.method}
                </td>
                <td className="max-w-sm px-3 py-2 font-mono text-xs text-foreground">
                  <span
                    title={`${row.path}${row.query_string ? `?${row.query_string}` : ""}`}
                  >
                    {row.path}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  <StatusText status={row.status_code} />
                </td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                  {row.duration_ms === null ? "n/a" : `${row.duration_ms}ms`}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {row.user_email ?? "anonymous"}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                  {truncateMiddle(row.request_id, 22)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <div key={row.id} className="space-y-2 rounded-lg bg-muted/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-mono text-sm text-foreground">
                  {row.path}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(row.created_at)}
                </p>
              </div>
              <p className="font-mono text-xs text-foreground">{row.method}</p>
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              <div>
                <p className="text-muted-foreground">Status</p>
                <p className="font-mono">
                  <StatusText status={row.status_code} />
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Duration</p>
                <p className="font-mono text-foreground">
                  {row.duration_ms === null ? "n/a" : `${row.duration_ms}ms`}
                </p>
              </div>
              <div className="min-w-full">
                <p className="text-muted-foreground">User</p>
                <p className="truncate text-foreground">
                  {row.user_email ?? "anonymous"}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function CommitLogTable({ rows }: { rows: CommitLogRow[] }) {
  if (rows.length === 0) {
    return <EmptyRows label="No GitHub push commits have been recorded yet." />;
  }

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Pushed</th>
              <th className="px-3 py-2 font-medium">Branch</th>
              <th className="px-3 py-2 font-medium">Commit</th>
              <th className="px-3 py-2 font-medium">Message</th>
              <th className="px-3 py-2 font-medium">Author</th>
              <th className="px-3 py-2 font-medium">Pusher</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-2 text-muted-foreground">
                  {formatDate(row.pushed_at)}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-foreground">
                  {row.branch}
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  {row.commit_url ? (
                    <a
                      className="text-primary hover:underline"
                      href={row.commit_url}
                    >
                      {truncateMiddle(row.commit_sha)}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">
                      {truncateMiddle(row.commit_sha)}
                    </span>
                  )}
                </td>
                <td className="max-w-sm px-3 py-2 text-foreground">
                  <span title={row.commit_message ?? ""}>
                    {(row.commit_message ?? "").split("\n")[0] || "No message"}
                  </span>
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {commitAuthor(row)}
                </td>
                <td className="px-3 py-2 text-foreground">{actorName(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <div key={row.id} className="space-y-2 rounded-lg bg-muted/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {(row.commit_message ?? "").split("\n")[0] || "No message"}
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  {truncateMiddle(row.commit_sha)}
                </p>
              </div>
              <p className="font-mono text-xs text-foreground">{row.branch}</p>
            </div>
            <div className="grid gap-2 text-xs">
              <p className="text-muted-foreground">
                Author:{" "}
                <span className="text-foreground">{commitAuthor(row)}</span>
              </p>
              <p className="text-muted-foreground">
                Pusher:{" "}
                <span className="text-foreground">{actorName(row)}</span>
              </p>
              <p className="text-muted-foreground">
                Pushed:{" "}
                <span className="text-foreground">
                  {formatDate(row.pushed_at)}
                </span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default async function ObservabilityPage() {
  const supabase = createOperationalServiceClient();
  const [requestResult, commitResult] = await Promise.all([
    supabase
      .from("app_request_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("developer_commit_log")
      .select("*")
      .order("received_at", { ascending: false })
      .limit(200),
  ]);

  const loadErrors = [
    requestResult.error?.message,
    commitResult.error?.message,
  ].filter(Boolean);

  return (
    <PageShell
      variant="table"
      title="Operational Logs"
      eyebrow="Admin"
      actions={
        <Button asChild variant="outline" size="sm">
          <Link href="/observability" aria-label="Refresh operational logs">
            <RefreshCw className="h-3.5 w-3.5" />
          </Link>
        </Button>
      }
      contentClassName="space-y-8"
    >
      {loadErrors.length > 0 ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Operational log read failed: {loadErrors.join("; ")}
        </div>
      ) : null}

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">Requests</h2>
          <p className="text-sm text-muted-foreground">
            Latest 200 matched app requests captured by middleware.
          </p>
        </div>
        <RequestLogTable rows={requestResult.data ?? []} />
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">
            Pushed Commits
          </h2>
          <p className="text-sm text-muted-foreground">
            Latest 200 commits received from the GitHub push webhook.
          </p>
        </div>
        <CommitLogTable rows={commitResult.data ?? []} />
      </section>
    </PageShell>
  );
}
