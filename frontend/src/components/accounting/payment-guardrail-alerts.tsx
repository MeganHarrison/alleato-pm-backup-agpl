import { SectionRuleHeading } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import type { FinancialGuardrailAlert } from "@/lib/accounting/aging-calculator";
import { cn } from "@/lib/utils";

export function PaymentGuardrailAlerts({
  alerts,
  className,
  emptyMessage = "No duplicate payment patterns detected in the last 90 days.",
  maxAlerts = 8,
  title = "Payment Guardrails",
}: {
  alerts: FinancialGuardrailAlert[];
  className?: string;
  emptyMessage?: string;
  maxAlerts?: number;
  title?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <SectionRuleHeading
        label={title}
        className="mb-0"
        actions={
          <Badge variant={alerts.length > 0 ? "destructive" : "secondary"}>
            {alerts.length > 0 ? `${alerts.length} flagged` : "No flags"}
          </Badge>
        }
      />

      {alerts.length === 0 ? (
        <p className="text-xs leading-5 text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="space-y-2">
          {alerts.slice(0, maxAlerts).map((alert) => (
            <div
              key={alert.id}
              className={cn(
                "rounded-lg px-3 py-2.5 text-xs",
                alert.severity === "high"
                  ? "bg-destructive/8 border-l-[3px] border-destructive"
                  : "bg-warning/8 border-l-[3px] border-warning",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="font-medium text-foreground">{alert.title}</span>
                <Badge
                  variant={alert.severity === "high" ? "destructive" : "outline"}
                  className="shrink-0"
                >
                  {alert.severity}
                </Badge>
              </div>
              <p className="mt-1 leading-5 text-muted-foreground">{alert.description}</p>
              <p className="mt-1 leading-5 text-muted-foreground">
                Refs: {alert.references.join(", ")}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
