"use client";

import { AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { apiFetch } from "@/lib/api-client";
import { handleFormError } from "@/lib/handle-form-error";
import { SectionRuleHeading } from "@/components/layout/spacing";

interface PrimeContractSettings {
  project_id: number;
  co_tier_count: 1 | 2;
  allow_standard_users_create_pcco: boolean;
  allow_standard_users_create_pco: boolean;
  sov_always_editable: boolean;
  enable_completed_work_retainage: boolean;
  enable_stored_materials_retainage: boolean;
  default_retainage_percent: number;
  show_markup_on_co_pdf: boolean;
  show_markup_on_invoice_pdf: boolean;
  default_distribution_prime_contract: string | null;
  default_distribution_pcco: string | null;
  default_distribution_pco: string | null;
}

interface PrimeContractAdvancedSettingsTabProps {
  projectId: string;
  contractId: string;
  advancedSettings: PrimeContractSettings | null;
  setAdvancedSettings: React.Dispatch<React.SetStateAction<PrimeContractSettings | null>>;
  advancedSettingsLoading: boolean;
  advancedSettingsSaving: boolean;
  setAdvancedSettingsSaving: React.Dispatch<React.SetStateAction<boolean>>;
  contractAdvancedDraft: {
    inclusions: string;
    exclusions: string;
    is_private: boolean;
    payment_terms: string;
    billing_schedule: string;
  };
  setContract: React.Dispatch<React.SetStateAction<import("@/app/(main)/[projectId]/prime-contracts/[contractId]/types").Contract | null>>;
  /** Number of existing change orders — used to lock the CO tier selector */
  changeOrderCount?: number;
}

export function PrimeContractAdvancedSettingsTab({
  projectId,
  contractId,
  advancedSettings,
  setAdvancedSettings,
  advancedSettingsLoading,
  advancedSettingsSaving,
  setAdvancedSettingsSaving,
  contractAdvancedDraft,
  setContract,
  changeOrderCount = 0,
}: PrimeContractAdvancedSettingsTabProps) {
  const checkboxRowClassName = "flex items-center gap-3";
  const checkboxLabelClassName = "text-sm font-medium text-foreground leading-5";
  const checkboxMutedLabelClassName = "text-sm text-muted-foreground leading-5";

  const coTierLocked = changeOrderCount > 0;
  const updateAdvancedSetting = <K extends keyof PrimeContractSettings>(
    key: K,
    value: PrimeContractSettings[K],
  ) => {
    setAdvancedSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const saveAdvancedSettings = async () => {
    if (!advancedSettings) {
      toast.error("Project settings not loaded");
      return;
    }

    setAdvancedSettingsSaving(true);
    try {
      const payload = await apiFetch<{
        project_settings: PrimeContractSettings;
        contract: Record<string, unknown>;
      }>(
        `/api/projects/${projectId}/contracts/${contractId}/advanced-settings`,
        {
          method: "PUT",
          body: JSON.stringify({
            project_settings: advancedSettings,
            contract_settings: {
              inclusions: contractAdvancedDraft.inclusions || null,
              exclusions: contractAdvancedDraft.exclusions || null,
              is_private: contractAdvancedDraft.is_private,
              retention_percentage: advancedSettings.default_retainage_percent,
              payment_terms: contractAdvancedDraft.payment_terms || null,
              billing_schedule: contractAdvancedDraft.billing_schedule || null,
            },
          }),
        },
      );

      setAdvancedSettings(payload.project_settings);
      setContract((prev) => (prev ? { ...prev, ...payload.contract } : prev));
      toast.success("Advanced settings saved");
    } catch (error) {
      handleFormError(error, {
        entity: "prime contract advanced settings",
        action: "save",
      });
    } finally {
      setAdvancedSettingsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {advancedSettingsLoading ? (
        <div className="max-w-xl space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : (
        <div className="max-w-xl space-y-6">
          <div>
            <SectionRuleHeading label="Financial Markup" />
            <div className={`mt-4 ${checkboxRowClassName}`}>
              <Checkbox
                id="enable-financial-markups"
                checked={advancedSettings?.show_markup_on_co_pdf ?? true}
                onCheckedChange={(checked) =>
                  updateAdvancedSetting("show_markup_on_co_pdf", !!checked)
                }
              />
              <Label htmlFor="enable-financial-markups" className={checkboxLabelClassName}>
                Enable Financial Markups
              </Label>
            </div>
          </div>

          <div>
            <SectionRuleHeading label="Owner Invoices" />
            <div className="mt-4 space-y-5">
              <div className={checkboxRowClassName}>
                <Checkbox id="enable-owner-invoices" checked disabled />
                <Label htmlFor="enable-owner-invoices" className={checkboxLabelClassName}>
                  Enable Owner Invoices
                </Label>
              </div>
              <div className={checkboxRowClassName}>
                <Checkbox id="approve-sub-invoices" checked={false} disabled />
                <Label htmlFor="approve-sub-invoices" className={checkboxMutedLabelClassName}>
                  Approve Subcontractor Invoices when Owner Approves Owner Invoice
                </Label>
              </div>
            </div>
          </div>

          <div>
            <SectionRuleHeading label="Retainage" />
            <div className="mt-1 flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0 text-muted-foreground hover:bg-transparent"
                    aria-label="Retainage settings info"
                  >
                    <AlertCircle className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-lg text-left">
                  Retainage defaults control how work completed and stored materials are
                  billed on prime contract payment applications.
                </TooltipContent>
              </Tooltip>
              <p className="text-sm text-muted-foreground">
                Configure the default retainage rules used when payment applications are
                populated.
              </p>
            </div>
            <div className="mt-4 space-y-5">
              <div className={checkboxRowClassName}>
                <Checkbox
                  id="enable-completed-work-retainage"
                  checked={advancedSettings?.enable_completed_work_retainage ?? true}
                  onCheckedChange={(checked) =>
                    updateAdvancedSetting("enable_completed_work_retainage", !!checked)
                  }
                />
                <Label
                  htmlFor="enable-completed-work-retainage"
                  className={checkboxLabelClassName}
                >
                  Enable Completed Work Retainage
                </Label>
              </div>
              <div className={checkboxRowClassName}>
                <Checkbox
                  id="enable-stored-materials-retainage"
                  checked={advancedSettings?.enable_stored_materials_retainage ?? false}
                  onCheckedChange={(checked) =>
                    updateAdvancedSetting("enable_stored_materials_retainage", !!checked)
                  }
                />
                <Label
                  htmlFor="enable-stored-materials-retainage"
                  className={checkboxLabelClassName}
                >
                  Enable Stored Materials Retainage
                </Label>
              </div>
              <div className="max-w-xs space-y-2">
                <Label htmlFor="default-retainage-percent" className="text-sm font-medium text-foreground">
                  Default Retainage Percent
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="default-retainage-percent"
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={advancedSettings?.default_retainage_percent ?? 10}
                    onChange={(e) =>
                      updateAdvancedSetting(
                        "default_retainage_percent",
                        Number(e.target.value || 0),
                      )
                    }
                    className="w-28"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <SectionRuleHeading label="PDF Export" />
            <p className="mt-1 text-sm text-muted-foreground">
              Choose what items are displayed on exported invoice PDFs.
            </p>
            <div className={`mt-4 ${checkboxRowClassName}`}>
              <Checkbox
                id="show-budget-code"
                checked={advancedSettings?.show_markup_on_invoice_pdf ?? true}
                onCheckedChange={(checked) =>
                  updateAdvancedSetting("show_markup_on_invoice_pdf", !!checked)
                }
              />
              <Label htmlFor="show-budget-code" className={checkboxLabelClassName}>
                Show Budget Code
              </Label>
            </div>
          </div>

          <div>
            <SectionRuleHeading label="Change Orders" />
            <div className="mt-1 flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0 text-muted-foreground hover:bg-transparent"
                    aria-label="Change orders level of detail info"
                  >
                    <AlertCircle className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-lg text-left">
                  The level of detail that is selected here determines how change orders will
                  be displayed on the detail page of the Invoice when being viewed or printed
                  from Procore. The entry and editing of this information will always occur at
                  the line item level of detail.
                </TooltipContent>
              </Tooltip>
              <p className="text-sm text-muted-foreground">
                Set how change order detail appears on invoice views and printed output.
              </p>
            </div>
            <div className="mt-3 max-w-md space-y-2">
              <Label htmlFor="co-tier-count" className="sr-only">Change order workflow</Label>
              {coTierLocked ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex h-11 w-full cursor-not-allowed items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                      {advancedSettings?.co_tier_count === 2
                        ? "Line Items in each Potential Change Order (PCO)"
                        : "Prime Contract Change Order"}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      The CO tier cannot be changed after change orders have been created.
                      Delete all change orders ({changeOrderCount}) to unlock this setting.
                    </p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Select
                  value={String(advancedSettings?.co_tier_count ?? 1)}
                  onValueChange={(v) =>
                    updateAdvancedSetting("co_tier_count", v === "1" ? 1 : 2)
                  }
                >
                  <SelectTrigger id="co-tier-count">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Prime Contract Change Order</SelectItem>
                    <SelectItem value="2">Line Items in each Potential Change Order (PCO)</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div>
            <SectionRuleHeading label="Payments Received" />
            <div className={`mt-4 ${checkboxRowClassName}`}>
              <Checkbox id="enable-payments" checked disabled />
              <Label htmlFor="enable-payments" className={checkboxLabelClassName}>
                Enable Payments
              </Label>
            </div>
          </div>

          <div className="flex">
            <Button onClick={saveAdvancedSettings} disabled={advancedSettingsSaving || !advancedSettings}>
              {advancedSettingsSaving ? "Saving..." : "Save Advanced Settings"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
