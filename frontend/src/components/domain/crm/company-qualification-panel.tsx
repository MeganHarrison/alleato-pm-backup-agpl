"use client";

import * as React from "react";
import type { ReactElement } from "react";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api-client";
import { handleFormError } from "@/lib/handle-form-error";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";

// Sidebar vetting checklist for a company. Completing all three items enables
// "Mark verified vendor", which flips companies.lifecycle_stage to 'active' —
// the company row itself never moves (shared-identity CRM, 2026-07-23).

interface QualificationRow {
  id: string;
  company_id: string;
  w9_received_at: string | null;
  insurance_certificate_received_at: string | null;
  insurance_expires_at: string | null;
  license_verified_at: string | null;
  qualified_at: string | null;
  notes: string | null;
}

interface CompanyQualificationPanelProps {
  companyId: string;
  lifecycleStage: string;
  onVerified: () => void | Promise<void>;
}

const CHECKLIST: Array<{
  key: "w9_received_at" | "insurance_certificate_received_at" | "license_verified_at";
  label: string;
}> = [
  { key: "w9_received_at", label: "W-9 received" },
  { key: "insurance_certificate_received_at", label: "Insurance certificate" },
  { key: "license_verified_at", label: "License verified" },
];

export function CompanyQualificationPanel({
  companyId,
  lifecycleStage,
  onVerified,
}: CompanyQualificationPanelProps): ReactElement | null {
  const [qualification, setQualification] = React.useState<QualificationRow | null>(null);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [savingKey, setSavingKey] = React.useState<string | null>(null);
  const [isVerifying, setIsVerifying] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const payload = await apiFetch<{ data: QualificationRow | null }>(
        `/api/crm/companies/${companyId}/qualification`,
        { cache: "no-store" },
      );
      setQualification(payload.data);
    } catch (loadError) {
      // Non-fatal — the panel simply stays in its unloaded state.
      console.error("[CompanyQualification] Failed to load qualification:", loadError);
    } finally {
      setIsLoaded(true);
    }
  }, [companyId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const isVerifiedCompany = lifecycleStage === "active";

  // Verified companies without any vetting record: render nothing.
  if (!isLoaded || (isVerifiedCompany && !qualification)) {
    return null;
  }

  const complete = CHECKLIST.every((item) => qualification?.[item.key]);

  const handleMarkItem = async (key: (typeof CHECKLIST)[number]["key"]) => {
    setSavingKey(key);
    try {
      const payload = await apiFetch<{ data: QualificationRow }>(
        `/api/crm/companies/${companyId}/qualification`,
        {
          method: "PATCH",
          body: JSON.stringify({ [key]: new Date().toISOString().slice(0, 10) }),
        },
      );
      setQualification(payload.data);
    } catch (saveError) {
      handleFormError(saveError, { entity: "qualification", action: "update" });
    } finally {
      setSavingKey(null);
    }
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      await apiFetch(`/api/crm/companies/${companyId}/qualification`, { method: "POST" });
      toast.success("Marked as verified vendor");
      await load();
      await onVerified();
    } catch (verifyError) {
      handleFormError(verifyError, { entity: "company", action: "update" });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <section className="rounded-lg bg-muted/25 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        Qualification
      </p>
      <div className="mt-4 space-y-3 text-sm">
        {CHECKLIST.map((item) => {
          const completedAt = qualification?.[item.key] ?? null;
          return (
            <div key={item.key} className="flex items-center justify-between gap-4">
              <p className="shrink-0 text-muted-foreground">{item.label}</p>
              {completedAt ? (
                <p className="text-right font-medium text-foreground tabular-nums">
                  {formatDate(completedAt)}
                </p>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  disabled={savingKey === item.key}
                  onClick={() => void handleMarkItem(item.key)}
                >
                  {savingKey === item.key ? "Saving…" : "Mark received"}
                </Button>
              )}
            </div>
          );
        })}
        {qualification?.insurance_expires_at ? (
          <div className="flex items-center justify-between gap-4">
            <p className="shrink-0 text-muted-foreground">Insurance expires</p>
            <p className="text-right font-medium text-foreground tabular-nums">
              {formatDate(qualification.insurance_expires_at)}
            </p>
          </div>
        ) : null}
        {isVerifiedCompany && qualification?.qualified_at ? (
          <div className="flex items-center justify-between gap-4">
            <p className="shrink-0 text-muted-foreground">Verified</p>
            <p className="text-right font-medium text-foreground tabular-nums">
              {formatDate(qualification.qualified_at)}
            </p>
          </div>
        ) : null}
      </div>
      {!isVerifiedCompany ? (
        <div className="mt-4 space-y-2">
          <Button
            size="sm"
            className="w-full"
            disabled={!complete || isVerifying}
            onClick={() => void handleVerify()}
          >
            {isVerifying ? "Verifying…" : "Mark verified vendor"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Enabled when all items are complete. The company then appears in vendor
            dropdowns and the verified directory — nothing moves or is re-entered.
          </p>
        </div>
      ) : null}
    </section>
  );
}
