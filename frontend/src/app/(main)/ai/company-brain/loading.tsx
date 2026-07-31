import { PageShell } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { aiDashboardPageShellProps } from "../../ai-dashboard/page-shell-config";

export default function CompanyBrainLoading() {
  return (
    <PageShell {...aiDashboardPageShellProps}>
      <div aria-label="Loading Company Brain" className="space-y-8 px-6 py-8">
        <div className="space-y-3">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-12 w-72 max-w-full" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
        <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-3 bg-card p-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-16" />
            </div>
          ))}
        </div>
        <div className="min-h-96 border-y border-border bg-card p-6">
          <div className="grid h-full grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="space-y-8">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
