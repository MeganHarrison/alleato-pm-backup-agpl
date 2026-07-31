"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { toast } from "sonner";

import {
  saveSiteLeadChecklistForDate,
  type DailyLogStatus,
} from "@/app/(main)/actions/daily-log-actions";
import { SiteLeadChecklistFields } from "@/components/daily-log/SiteLeadChecklistFields";
import { InfoAlert } from "@/components/ds/InfoAlert";
import { PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createEmptySiteManagementChecklist,
  getSiteManagementChecklistSummary,
  validateSiteManagementChecklist,
  type SiteManagementChecklistEntry,
  type SiteManagementChecklistState,
} from "@/lib/daily-log/site-management-checklist";

export function SiteLeadChecklistClient({
  projectId,
  initialDate,
  initialChecklist,
  linkedDailyLogStatus,
}: {
  projectId: number;
  initialDate: string;
  initialChecklist: SiteManagementChecklistState;
  linkedDailyLogStatus: DailyLogStatus | null;
}) {
  const router = useRouter();
  const [logDate, setLogDate] = React.useState(initialDate);
  const [checklist, setChecklist] = React.useState<SiteManagementChecklistState>(
    initialChecklist ?? createEmptySiteManagementChecklist(),
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    setLogDate(initialDate);
  }, [initialDate]);

  React.useEffect(() => {
    setChecklist(initialChecklist);
  }, [initialChecklist]);

  const checklistSummary = React.useMemo(
    () => getSiteManagementChecklistSummary(checklist),
    [checklist],
  );

  const updateChecklistEntry = React.useCallback(
    (itemId: string, patch: Partial<SiteManagementChecklistEntry>) => {
      setChecklist((current) => ({
        ...current,
        [itemId]: {
          ...current[itemId],
          ...patch,
        },
      }));
    },
    [],
  );

  const handleDateChange = (nextDate: string) => {
    setLogDate(nextDate);
    const search = new URLSearchParams();
    if (nextDate) {
      search.set("date", nextDate);
    }
    router.replace(`/${projectId}/daily-log/site-lead-checklist?${search.toString()}`);
  };

  const handleSubmit = async () => {
    if (!logDate) {
      toast.error("Checklist date is required.");
      return;
    }

    const checklistErrors = validateSiteManagementChecklist(checklist);
    if (checklistErrors.length > 0) {
      toast.error(`Add a follow-up note for each failed checklist item: ${checklistErrors[0]}`);
      return;
    }

    setIsSubmitting(true);
    const result = await saveSiteLeadChecklistForDate({
      projectId,
      logDate,
      siteManagementChecklist: checklist,
    });
    setIsSubmitting(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Site lead checklist saved");
    router.refresh();
  };

  return (
    <PageShell
      variant="form"
      title="Site Lead Checklist"
      onBack={() => router.push(`/${projectId}/daily-log`)}
      backLabel="Back to Daily Log"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => router.push(`/${projectId}/daily-log`)}
          >
            Cancel
          </Button>
          <Button size="sm" type="button" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Checklist"}
          </Button>
        </div>
      }
    >
      <section className="space-y-4">
        <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)] md:items-end">
          <div className="space-y-1.5">
            <label
              htmlFor="site-lead-checklist-date"
              className="text-[11px] font-medium text-muted-foreground"
            >
              Date
            </label>
            <Input
              id="site-lead-checklist-date"
              type="date"
              value={logDate}
              onChange={(event) => handleDateChange(event.target.value)}
            />
          </div>
          <InfoAlert
            variant="info"
            icon={<ClipboardList className="mt-px h-3.5 w-3.5 shrink-0" />}
            className="items-center py-2 text-xs"
          >
            {checklistSummary.answered}/{checklistSummary.total} items answered
            {checklistSummary.failures > 0
              ? ` • ${checklistSummary.failures} require follow-up notes`
              : linkedDailyLogStatus
                ? ` • linked daily log status: ${linkedDailyLogStatus}`
                : " • creates a linked daily-log row for this date only if one does not already exist"}
          </InfoAlert>
        </div>
      </section>

      <section className="space-y-4">
        <SiteLeadChecklistFields
          checklist={checklist}
          onChangeEntry={updateChecklistEntry}
        />
      </section>
    </PageShell>
  );
}
