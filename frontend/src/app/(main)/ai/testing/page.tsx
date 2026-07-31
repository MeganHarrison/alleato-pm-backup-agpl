import { PageShell } from "@/components/layout";
import { EveToolTestingPage } from "@/features/eve-tool-testing/eve-tool-testing-page";
import { buildEveToolTestRows } from "@/features/eve-tool-testing/eve-tool-test-registry";
import { requireDeveloper } from "@/lib/auth/require-developer";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Eve Tool Testing | Alleato",
  description: "Live test coverage for every canonical Eve tool.",
};

export default async function EveToolTestingRoute() {
  await requireDeveloper();
  const rows = buildEveToolTestRows();

  return (
    <PageShell
      variant="table"
      title="Eve Tool Testing"
      description={`${rows.length} canonical Eve tools. Live evidence last recorded July 31, 2026.`}
    >
      <EveToolTestingPage initialRows={rows} />
    </PageShell>
  );
}
