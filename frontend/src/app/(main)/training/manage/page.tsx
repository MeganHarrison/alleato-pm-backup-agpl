import Link from "next/link";

import { PageShell } from "@/components/layout";
import { getContentGovernanceExceptions, requireLearningAdminPageAccess } from "@/lib/learning/server";

export default async function TrainingManagementPage() {
  await requireLearningAdminPageAccess();
  const exceptions = await getContentGovernanceExceptions();
  return (
    <PageShell
      variant="detailWide"
      title="Training Management"
      description="Resolve ownership, review, and publication issues that keep knowledge from being trustworthy."
      actions={
        <Link href="/content" className="text-sm font-medium underline underline-offset-4">
          Open Content Studio
        </Link>
      }
    >
      {exceptions.length > 0 ? (
        <div className="divide-y border-y">
          {exceptions.map((item) => (
            <Link
              key={item.contentItemId}
              href={item.href}
              className="grid gap-2 py-5 sm:grid-cols-[minmax(0,1fr)_16rem]"
            >
              <div>
                <h2 className="font-medium">{item.title}</h2>
                <p className="mt-1 text-sm capitalize text-muted-foreground">
                  {item.kind.replaceAll("_", " ")} · {item.lifecycle.replaceAll("_", " ")}
                </p>
              </div>
              <p className="text-sm text-amber-700">{item.exceptions.join(" ")}</p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="border-y py-8 text-sm text-muted-foreground">
          No content governance exceptions need attention.
        </p>
      )}
    </PageShell>
  );
}
