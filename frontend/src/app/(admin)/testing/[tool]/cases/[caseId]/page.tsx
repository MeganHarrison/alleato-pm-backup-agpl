"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageShell } from "@/components/layout";
import { apiFetch } from "@/lib/api-client";
import type { TestCase } from "../../../_components/types";

// Read-only test case detail. Typography-first — no cards, hairline
// dividers separate sections.
export default function CaseDetailPage() {
  const params = useParams<{ tool: string; caseId: string }>()!;
  const router = useRouter();
  const [testCase, setTestCase] = useState<TestCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // We don't have a dedicated GET-by-id endpoint, so we pull from the
    // suite's cases endpoint and find the match. Cheap on small suites.
    apiFetch<{ grouped: Record<string, TestCase[]> }>(
      `/api/testing/suites/${params.tool}/cases?suiteType=smoke`,
    )
      .then(async (smokeRes) => {
        const all = [
          ...Object.values(smokeRes.grouped ?? {}).flat(),
        ] as TestCase[];
        let match = all.find((c) => c.id === params.caseId);
        if (!match) {
          const featureRes = await apiFetch<{
            grouped: Record<string, TestCase[]>;
          }>(
            `/api/testing/suites/${params.tool}/cases?suiteType=feature`,
          );
          const featureAll = Object.values(
            featureRes.grouped ?? {},
          ).flat() as TestCase[];
          match = featureAll.find((c) => c.id === params.caseId);
        }
        if (!match) {
          setError("Case not found.");
        } else {
          setTestCase(match);
        }
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Unable to load case."),
      )
      .finally(() => setLoading(false));
  }, [params.tool, params.caseId]);

  return (
    <PageShell
      variant="content"
      title={testCase?.test_name ?? "Case"}
      description={testCase ? `${testCase.test_number} · ${testCase.category}` : undefined}
      onBack={() => router.push(`/testing/${params.tool}`)}
      backLabel="Back to tool"
    >
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && (
        <p className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {testCase && (
        <div className="space-y-8">
          {testCase.context_note && (
            <Section title="Context">
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {testCase.context_note}
              </p>
            </Section>
          )}
          {testCase.setup_steps && (
            <Section title="Setup">
              <p className="whitespace-pre-line text-sm leading-relaxed">
                {testCase.setup_steps}
              </p>
            </Section>
          )}
          {testCase.steps && (
            <Section title="Steps">
              <p className="whitespace-pre-line text-sm leading-relaxed">
                {testCase.steps}
              </p>
            </Section>
          )}
          {testCase.expected_result && (
            <Section title="Expected result">
              <p className="whitespace-pre-line text-sm leading-relaxed">
                {testCase.expected_result}
              </p>
            </Section>
          )}
        </div>
      )}
    </PageShell>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2 border-t border-border pt-6 first:border-t-0 first:pt-0">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}
