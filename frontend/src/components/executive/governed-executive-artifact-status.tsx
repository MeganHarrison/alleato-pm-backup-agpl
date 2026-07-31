import type { GovernedExecutiveArtifact } from "@/lib/executive/governed-executive-artifact";

export function GovernedExecutiveArtifactStatus({ artifact }: { artifact: GovernedExecutiveArtifact }) {
  const isBlocked = artifact.integrity === "blocked";
  const openAttention = artifact.executive?.attention.filter((item) => !["resolved", "dismissed"].includes(item.lifecycle)).length ?? 0;
  const openConflicts = artifact.executive?.conflicts.filter((item) => item.status === "open").length ?? 0;
  return (
    <section aria-label="Governed executive artifact status" className="border-t border-border pt-5 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div>
          <p className="font-medium text-foreground">{isBlocked ? "Executive artifact integrity failure" : artifact.integrity === "limited" ? "Executive artifact is limited" : "Governed executive artifact"}</p>
          <p className="mt-1 text-muted-foreground">Version {artifact.id} · issued {new Date(artifact.issuedAt).toLocaleString()}</p>
        </div>
        <p className="text-muted-foreground">{openAttention} open attention · {openConflicts} open conflicts · {artifact.delivery.deliveredCount} delivery receipts</p>
      </div>
      {artifact.failures.length ? (
        <div className="mt-3 space-y-1 text-destructive" role="alert">
          {artifact.failures.map((failure) => <p key={failure}>{failure}</p>)}
          <p className="text-muted-foreground">Recovery: restore the named canonical source or resolve the stale critical input, then issue the next packet version.</p>
        </div>
      ) : null}
    </section>
  );
}
