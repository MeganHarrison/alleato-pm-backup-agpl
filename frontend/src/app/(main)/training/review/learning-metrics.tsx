import { SectionRuleHeading } from "@/components/layout";
import type { TrainingDiscoveryMetrics } from "@/lib/training/types";

function humanizeStrategy(strategy: string) {
  return strategy.replaceAll("_", " ");
}

export function LearningMetrics({
  metrics,
}: {
  metrics: TrainingDiscoveryMetrics;
}) {
  const sampleSize =
    typeof metrics.activePolicy.evaluation.sampleSize === "number"
      ? metrics.activePolicy.evaluation.sampleSize
      : 0;
  const evaluationNote =
    typeof metrics.activePolicy.evaluation.note === "string"
      ? metrics.activePolicy.evaluation.note
      : null;

  return (
    <section aria-label="Discovery learning performance" className="pt-8">
      <SectionRuleHeading label="Discovery learning" as="h2" />
      <p className="text-sm text-muted-foreground">
        Policy <strong>{metrics.activePolicy.version}</strong> has processed{" "}
        {metrics.runs} runs and {metrics.candidates} candidates. Administrators
        reviewed {metrics.reviewed}; {metrics.published} were published and{" "}
        {metrics.archived} archived. Current approval rate is{" "}
        {Math.round(metrics.approvalRate * 100)}%, with{" "}
        {Math.round(metrics.activePolicy.explorationRate * 100)}% of query
        selection reserved for exploration.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Policy evaluation currently contains {sampleSize} reviewed decisions.
        {evaluationNote ? ` ${evaluationNote}` : ""}
      </p>

      {metrics.strategyPerformance.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              Approval performance by training search strategy
            </caption>
            <thead className="border-b text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Search strategy
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Reviewed
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Published
                </th>
                <th scope="col" className="py-2 font-medium">
                  Approval rate
                </th>
              </tr>
            </thead>
            <tbody>
              {metrics.strategyPerformance.map((strategy) => (
                <tr key={strategy.strategy} className="border-b last:border-0">
                  <th scope="row" className="py-2 pr-4 font-normal capitalize">
                    {humanizeStrategy(strategy.strategy)}
                  </th>
                  <td className="py-2 pr-4">{strategy.reviewed}</td>
                  <td className="py-2 pr-4">{strategy.published}</td>
                  <td className="py-2">
                    {Math.round(strategy.approval_rate * 100)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Strategy performance will appear after the first structured review.
        </p>
      )}
    </section>
  );
}
