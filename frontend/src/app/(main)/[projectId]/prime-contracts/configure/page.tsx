"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { PageShell } from "@/components/layout";
import { FormSection } from "@/components/forms";
import { ToggleField } from "@/components/forms";
import { apiFetch } from "@/lib/api-client";
import { handleFormError } from "@/lib/handle-form-error";

interface PrimeContractSettings {
  project_id: number;
  co_tier_count: 1 | 2;
  allow_standard_users_create_pcco: boolean;
  allow_standard_users_create_pco: boolean;
  sov_always_editable: boolean;
  show_markup_on_co_pdf: boolean;
  show_markup_on_invoice_pdf: boolean;
  default_distribution_prime_contract: string | null;
  default_distribution_pcco: string | null;
  default_distribution_pco: string | null;
}

export default function PrimeContractsConfigurePage() {
  const params = useParams()!;
  const projectId = params.projectId as string;

  const [settings, setSettings] = useState<PrimeContractSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const data = await apiFetch<PrimeContractSettings>(
          `/api/projects/${projectId}/contracts/settings`,
        );
        setSettings(data);
      } catch (error) {
        handleFormError(error, {
          entity: "prime contract settings",
          action: "load",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [projectId]);

  const handleSave = async () => {
    if (!settings) return;
    try {
      setSaving(true);
      const savedSettings = await apiFetch<PrimeContractSettings>(
        `/api/projects/${projectId}/contracts/settings`,
        {
          method: "PUT",
          body: JSON.stringify(settings),
        },
      );
      setSettings(savedSettings);
      toast.success("Settings saved");
    } catch (error) {
      handleFormError(error, {
        entity: "prime contract settings",
        action: "save",
      });
    } finally {
      setSaving(false);
    }
  };

  const update = <K extends keyof PrimeContractSettings>(
    key: K,
    value: PrimeContractSettings[K],
  ) => setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));

  return (
    <PageShell
      variant="content"
      title="Prime Contracts Settings"
      description="Project-level settings for how prime contracts behave"
      actions={
        <Button size="sm" onClick={handleSave} disabled={saving || loading}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      }
    >
      {loading ? (
        <div className="space-y-6">
          {["workflow", "permissions", "export", "distributions"].map((section) => (
            <div key={section} className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      ) : settings ? (
        <div className="space-y-8">

{/* ───── CHANGE ORDER WORKFLOW ────────────────────────────────────────────────────────── */}
          <FormSection
            title="Change Order Workflow"
            description="Controls how change orders are submitted and approved."
          >
            <div className="space-y-3">
              <Label className="text-sm font-medium">Number of CO Tiers</Label>
              <p className="text-sm text-muted-foreground">
                1-tier: single change order type. 2-tier: PCO → PCCO workflow.
              </p>
              <div className="flex gap-2">
                {([1, 2] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => update("co_tier_count", n)}
                    className={`rounded-sm border px-3 py-1 text-sm transition-colors ${
                      settings.co_tier_count === n
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input hover:bg-muted"
                    }`}
                  >
                    {n === 1 ? "1 Tier" : "2 Tiers"}
                  </button>
                ))}
              </div>
            </div>
          </FormSection>

{/* ───── PERMISSIONS ────────────────────────────────────────────────────────── */}
          <FormSection
            title="Permissions"
            description="Controls what standard-level project members can do."
          >
            <div className="space-y-4">
              <ToggleField
                label="Allow standard users to create PCCOs"
                hint="Project members with standard access can create Prime Contract Change Orders."
                checked={settings.allow_standard_users_create_pcco}
                onCheckedChange={(v) =>
                  update("allow_standard_users_create_pcco", v)
                }
              />
              <ToggleField
                label="Allow standard users to create PCOs"
                hint="Project members with standard access can create Potential Change Orders."
                checked={settings.allow_standard_users_create_pco}
                onCheckedChange={(v) =>
                  update("allow_standard_users_create_pco", v)
                }
              />
              <ToggleField
                label="SOV always editable"
                hint="When enabled, the Schedule of Values can be edited regardless of contract status."
                checked={settings.sov_always_editable}
                onCheckedChange={(v) => update("sov_always_editable", v)}
              />
            </div>
          </FormSection>

{/* ───── PDF EXPORT ────────────────────────────────────────────────────────── */}
          <FormSection
            title="PDF & Export"
            description="Controls what information appears in generated PDFs and CSV exports."
          >
            <div className="space-y-4">
              <ToggleField
                label="Show markup on CO PDF exports"
                hint="Include markup breakdown in change order PDF exports."
                checked={settings.show_markup_on_co_pdf}
                onCheckedChange={(v) => update("show_markup_on_co_pdf", v)}
              />
              <ToggleField
                label="Show markup on invoice PDF/CSV"
                hint="Include markup breakdown in invoice and payment application exports."
                checked={settings.show_markup_on_invoice_pdf}
                onCheckedChange={(v) =>
                  update("show_markup_on_invoice_pdf", v)
                }
              />
            </div>
          </FormSection>

{/* ───── DISTRIBUTIONS ────────────────────────────────────────────────────────── */}
          <FormSection
            title="Default Distributions"
            description="Default email recipients when distributing documents."
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dist-prime">Prime Contract</Label>
                <Input
                  id="dist-prime"
                  placeholder="e.g. pm@company.com, owner@client.com"
                  value={settings.default_distribution_prime_contract ?? ""}
                  onChange={(e) =>
                    update(
                      "default_distribution_prime_contract",
                      e.target.value || null,
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dist-pcco">PCCO (Prime Contract Change Order)</Label>
                <Input
                  id="dist-pcco"
                  placeholder="e.g. pm@company.com, owner@client.com"
                  value={settings.default_distribution_pcco ?? ""}
                  onChange={(e) =>
                    update("default_distribution_pcco", e.target.value || null)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dist-pco">PCO (Potential Change Order)</Label>
                <Input
                  id="dist-pco"
                  placeholder="e.g. pm@company.com, super@company.com"
                  value={settings.default_distribution_pco ?? ""}
                  onChange={(e) =>
                    update("default_distribution_pco", e.target.value || null)
                  }
                />
              </div>
            </div>
          </FormSection>

          <div className="pt-4">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground">Failed to load settings.</p>
      )}
    </PageShell>
  );
}
