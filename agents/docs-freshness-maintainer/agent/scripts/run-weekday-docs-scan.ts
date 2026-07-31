import { summarizeDocFindings } from "../lib/docs.js";
import { redactText } from "../lib/redaction.js";
import type { DocFinding, DocReport } from "../lib/result-schema.js";

const LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql";

async function main(): Promise<void> {
  const issueId = requiredEnv(
    "EVE_DOCS_MAINTAINER_LINEAR_ISSUE_ID",
    process.env.EVE_DOCS_MAINTAINER_LINEAR_ISSUE_ID,
  );
  const apiKey = requiredEnv("LINEAR_API_KEY", process.env.LINEAR_API_KEY);

  const report = await summarizeDocFindings({ includeHealthy: false });
  const body = formatReport(report);
  const created = await linearRequest<{
    commentCreate: {
      success: boolean;
      comment: { id: string; body: string; issue: { id: string } };
    };
  }>(
    apiKey,
    `mutation CreateDocsFreshnessComment($input: CommentCreateInput!) {
      commentCreate(input: $input) {
        success
        comment { id body issue { id } }
      }
    }`,
    { input: { issueId, body } },
  );

  const comment = created.commentCreate.comment;
  if (!created.commentCreate.success || !comment?.id) {
    throw new Error(
      "Docs freshness Linear delivery failed: commentCreate did not return a created comment.",
    );
  }

  const readback = await linearRequest<{
    comment: { id: string; body: string; issue: { id: string } } | null;
  }>(
    apiKey,
    `query ReadDocsFreshnessComment($id: String!) {
      comment(id: $id) { id body issue { id } }
    }`,
    { id: comment.id },
  );
  if (
    !readback.comment ||
    readback.comment.body !== body ||
    readback.comment.issue.id !== issueId
  ) {
    throw new Error(
      "Docs freshness Linear delivery failed read-back: the created comment did not match the requested report and issue.",
    );
  }

  console.log(
    JSON.stringify({
      event: "docs_freshness_linear_readback",
      status: report.status,
      issueId,
      commentId: comment.id,
      checkedAt: report.checkedAt,
      findings: report.findings.length,
    }),
  );

  if (report.status === "fail" || report.status === "blocked") {
    throw new Error(
      `Docs freshness scan completed with ${report.status}; the actionable report was delivered to Linear and read back.`,
    );
  }
}

async function linearRequest<T>(
  apiKey: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(LINEAR_GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) {
    throw new Error(
      `Docs freshness Linear delivery failed: HTTP ${response.status}.`,
    );
  }

  const payload = (await response.json()) as {
    data?: T;
    errors?: Array<{ message?: string }>;
  };
  if (payload.errors?.length || !payload.data) {
    const message = payload.errors
      ?.map((error) => error.message || "Unknown GraphQL error")
      .join("; ");
    throw new Error(
      `Docs freshness Linear delivery failed: ${redactText(message || "missing GraphQL data")}.`,
    );
  }
  return payload.data;
}

function formatReport(report: DocReport): string {
  const lines = [
    "## Automated docs freshness scan",
    "",
    `**Status:** ${report.status.toUpperCase()}`,
    `**Checked:** ${report.checkedAt}`,
    "",
    report.summary,
  ];

  for (const finding of report.findings) {
    lines.push("", ...formatFinding(finding));
  }

  lines.push(
    "",
    "_This report is read-only. Generated documentation is never changed without explicit human approval._",
  );
  return redactText(lines.join("\n"), 12000);
}

function formatFinding(finding: DocFinding): string[] {
  const lines = [
    `### ${finding.artifact} — ${finding.status.toUpperCase()}`,
    `- Cause: ${finding.cause}`,
  ];
  if (finding.detectionGap) {
    lines.push(`- Detection gap: ${finding.detectionGap}`);
  }
  if (finding.prevention) {
    lines.push(`- Prevention: ${finding.prevention}`);
  }
  if (finding.ownerFiles.length) {
    lines.push(`- Owner files: ${finding.ownerFiles.map((file) => `\`${file}\``).join(", ")}`);
  }
  for (const nextAction of finding.nextActions) {
    lines.push(`- Next action: ${nextAction}`);
  }
  return lines;
}

function requiredEnv(name: string, value: string | undefined): string {
  if (value) return value;
  throw new Error(`Docs freshness weekday scan blocked: missing ${name}.`);
}

await main();
