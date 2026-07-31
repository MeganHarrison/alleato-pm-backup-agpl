"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";

import { NumberInput } from "@/components/ds";
import { PageScaffold, SectionRuleHeading } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useCrmWorkspace } from "@/hooks/use-crm";
import { buildCrmWorkspaceTabs } from "@/features/crm/crm-workspace-tabs";
import { CRM_WORKSPACE_PAGE_VARIANT } from "@/features/crm/crm-workspace-layout";

export function CrmSettingsReview() {
  const pathname = usePathname();
  const { settings, saveSettings, refresh, error } = useCrmWorkspace();
  const [activeDays, setActiveDays] = React.useState(settings.activeDays);
  const [watchDays, setWatchDays] = React.useState(settings.watchDays);
  const [staleDealDays, setStaleDealDays] = React.useState(
    settings.staleDealDays,
  );
  const [timezone, setTimezone] = React.useState(settings.reportingTimezone);
  const [autoAccept, setAutoAccept] = React.useState(
    settings.autoAcceptEnabled,
  );

  React.useEffect(() => {
    setActiveDays(settings.activeDays);
    setWatchDays(settings.watchDays);
    setStaleDealDays(settings.staleDealDays);
    setTimezone(settings.reportingTimezone);
    setAutoAccept(settings.autoAcceptEnabled);
  }, [settings]);

  const save = async () => {
    if (
      ![activeDays, watchDays, staleDealDays].every(
        (value) => Number.isInteger(value) && value > 0,
      ) ||
      watchDays <= activeDays
    ) {
      toast.error(
        "Watch days must exceed active days, and thresholds must be positive whole numbers.",
      );
      return;
    }
    try {
      await saveSettings({
        ...settings,
        activeDays,
        watchDays,
        staleDealDays,
        reportingTimezone: timezone.trim(),
        autoAcceptEnabled: autoAccept,
      });
      toast.success("CRM settings saved");
    } catch (error) {
      toast.error("CRM settings could not be saved", {
        description:
          error instanceof Error ? error.message : "Refresh and try again.",
      });
    }
  };

  const reloadWorkspace = async () => {
    try {
      await refresh();
      toast.success("CRM workspace reloaded");
    } catch (error) {
      toast.error("CRM workspace could not be reloaded", {
        description:
          error instanceof Error ? error.message : "Refresh and try again.",
      });
    }
  };

  return (
    <PageScaffold
      layout="single"
      variant={CRM_WORKSPACE_PAGE_VARIANT}
      title="CRM settings"
      description={
        error ? `CRM could not be loaded: ${error.message}` : "Shared CRM rules"
      }
      tabs={buildCrmWorkspaceTabs(pathname)}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={reloadWorkspace}>
            Reload
          </Button>
          <Button onClick={save}>Save changes</Button>
        </div>
      }
    >
      <section>
        <SectionRuleHeading label="Relationship health" />
        <div className="grid gap-5 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="crm-active-days">Active through</Label>
            <NumberInput
              id="crm-active-days"
              min={1}
              decimals={0}
              formatOnBlur={false}
              value={activeDays}
              onChange={(event) => setActiveDays(Number(event.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Days since meaningful activity
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="crm-watch-days">Watch through</Label>
            <NumberInput
              id="crm-watch-days"
              min={2}
              decimals={0}
              formatOnBlur={false}
              value={watchDays}
              onChange={(event) => setWatchDays(Number(event.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Stale after this threshold
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="crm-stale-deal-days">Stale deal</Label>
            <NumberInput
              id="crm-stale-deal-days"
              min={1}
              decimals={0}
              formatOnBlur={false}
              value={staleDealDays}
              onChange={(event) => setStaleDealDays(Number(event.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Days without meaningful activity
            </p>
          </div>
        </div>
      </section>
      <section>
        <SectionRuleHeading label="Reporting" />
        <div className="max-w-md space-y-2">
          <Label htmlFor="crm-timezone">Default timezone</Label>
          <Input
            id="crm-timezone"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
          />
        </div>
      </section>
      <section>
        <SectionRuleHeading label="Communication matching" />
        <div className="flex items-center justify-between gap-6 border-b border-border py-3">
          <div>
            <Label htmlFor="crm-auto-accept">Automatic acceptance</Label>
            <p className="text-sm text-muted-foreground">
              Deterministic matches bypass review only after privacy evaluation.
            </p>
          </div>
          <Switch
            id="crm-auto-accept"
            checked={autoAccept}
            onCheckedChange={setAutoAccept}
          />
        </div>
        <div className="flex items-start justify-between gap-6 py-3">
          <div>
            <p className="text-sm font-medium">Meaningful activity</p>
            <p className="text-sm text-muted-foreground">
              Calls, emails, and meetings. Notes do not affect relationship
              health.
            </p>
          </div>
          <span className="text-sm">Call · Email · Meeting</span>
        </div>
      </section>
    </PageScaffold>
  );
}
