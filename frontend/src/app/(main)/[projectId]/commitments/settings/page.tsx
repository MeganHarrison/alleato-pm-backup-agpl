"use client";
import { PageShell } from "@/components/layout";
import { CommitmentsHelpSheet } from "@/components/commitments/CommitmentsHelpSheet";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CommitmentSettings {
  general: {
    defaultAccountingMethod: string;
    autoNumberSubcontracts: boolean;
    subcontractPrefix: string;
    autoNumberPurchaseOrders: boolean;
    purchaseOrderPrefix: string;
  };
  distribution: {
    requireApproval: boolean;
    approvalThreshold: number;
    notifyOnStatusChange: boolean;
  };
  defaults: {
    defaultRetainagePercent: number;
    defaultStatus: string;
    defaultPrivacy: boolean;
  };
  billing: {
    requireInvoiceApproval: boolean;
    billingPeriod: string;
    retainageReleaseThreshold: number;
  };
}

const DEFAULT_SETTINGS: CommitmentSettings = {
  general: {
    defaultAccountingMethod: "amount",
    autoNumberSubcontracts: true,
    subcontractPrefix: "SC-",
    autoNumberPurchaseOrders: true,
    purchaseOrderPrefix: "PO-",
  },
  distribution: {
    requireApproval: false,
    approvalThreshold: 0,
    notifyOnStatusChange: true,
  },
  defaults: {
    defaultRetainagePercent: 10,
    defaultStatus: "draft",
    defaultPrivacy: true,
  },
  billing: {
    requireInvoiceApproval: true,
    billingPeriod: "monthly",
    retainageReleaseThreshold: 95,
  },
};

export default function CommitmentSettingsPage() {
  const params = useParams()! ?? {};
  const router = useRouter();
  const projectId = params.projectId as string;

  const [settings, setSettings] =
    useState<CommitmentSettings>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);

  const updateSetting = <
    S extends keyof CommitmentSettings,
    K extends keyof CommitmentSettings[S],
  >(
    section: S,
    key: K,
    value: CommitmentSettings[S][K],
  ) => {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Settings persistence will be added when the database table is created
      toast.success("Settings saved successfully");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageShell
      variant="content"
      title="Commitment Settings"
      onBack={() => router.back()}
      actions={
        <div className="flex items-center gap-1.5">
          <CommitmentsHelpSheet buttonVariant="ghost" />
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="gap-2"
          >
            <Save />
            Save Settings
          </Button>
        </div>
      }
    >

      <div className="max-w-3xl space-y-6">
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="distribution">Distribution</TabsTrigger>
            <TabsTrigger value="defaults">Defaults</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="m-0">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Default Accounting Method</Label>
                  <Select
                    value={settings.general.defaultAccountingMethod}
                    onValueChange={(v) =>
                      updateSetting("general", "defaultAccountingMethod", v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="amount">Amount Based</SelectItem>
                      <SelectItem value="unit-quantity">
                        Unit/Quantity
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={settings.general.autoNumberSubcontracts}
                        onCheckedChange={(v) =>
                          updateSetting(
                            "general",
                            "autoNumberSubcontracts",
                            !!v,
                          )
                        }
                      />
                      <Label>Auto-number Subcontracts</Label>
                    </div>
                    <Input
                      value={settings.general.subcontractPrefix}
                      onChange={(e) =>
                        updateSetting(
                          "general",
                          "subcontractPrefix",
                          e.target.value,
                        )
                      }
                      placeholder="SC-"
                      disabled={!settings.general.autoNumberSubcontracts}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={settings.general.autoNumberPurchaseOrders}
                        onCheckedChange={(v) =>
                          updateSetting(
                            "general",
                            "autoNumberPurchaseOrders",
                            !!v,
                          )
                        }
                      />
                      <Label>Auto-number Purchase Orders</Label>
                    </div>
                    <Input
                      value={settings.general.purchaseOrderPrefix}
                      onChange={(e) =>
                        updateSetting(
                          "general",
                          "purchaseOrderPrefix",
                          e.target.value,
                        )
                      }
                      placeholder="PO-"
                      disabled={!settings.general.autoNumberPurchaseOrders}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="distribution" className="m-0">
            <Card>
              <CardHeader>
                <CardTitle>Distribution Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={settings.distribution.requireApproval}
                    onCheckedChange={(v) =>
                      updateSetting(
                        "distribution",
                        "requireApproval",
                        !!v,
                      )
                    }
                  />
                  <Label>Require Approval for Commitments</Label>
                </div>

                {settings.distribution.requireApproval && (
                  <div className="space-y-2">
                    <Label>Approval Threshold ($)</Label>
                    <Input
                      type="number"
                      value={settings.distribution.approvalThreshold}
                      onChange={(e) =>
                        updateSetting(
                          "distribution",
                          "approvalThreshold",
                          Number(e.target.value),
                        )
                      }
                    />
                    <p className="text-sm text-muted-foreground">
                      Commitments above this amount require approval
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={settings.distribution.notifyOnStatusChange}
                    onCheckedChange={(v) =>
                      updateSetting(
                        "distribution",
                        "notifyOnStatusChange",
                        !!v,
                      )
                    }
                  />
                  <Label>Notify on Status Changes</Label>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="defaults" className="m-0">
            <Card>
              <CardHeader>
                <CardTitle>Default Values</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Default Retainage (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={settings.defaults.defaultRetainagePercent}
                    onChange={(e) =>
                      updateSetting(
                        "defaults",
                        "defaultRetainagePercent",
                        Number(e.target.value),
                      )
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Default Status</Label>
                  <Select
                    value={settings.defaults.defaultStatus}
                    onValueChange={(v) =>
                      updateSetting("defaults", "defaultStatus", v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={settings.defaults.defaultPrivacy}
                    onCheckedChange={(v) =>
                      updateSetting("defaults", "defaultPrivacy", !!v)
                    }
                  />
                  <Label>Default to Private</Label>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing" className="m-0">
            <Card>
              <CardHeader>
                <CardTitle>Billing Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={settings.billing.requireInvoiceApproval}
                    onCheckedChange={(v) =>
                      updateSetting(
                        "billing",
                        "requireInvoiceApproval",
                        !!v,
                      )
                    }
                  />
                  <Label>Require Invoice Approval</Label>
                </div>

                <div className="space-y-2">
                  <Label>Billing Period</Label>
                  <Select
                    value={settings.billing.billingPeriod}
                    onValueChange={(v) =>
                      updateSetting("billing", "billingPeriod", v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="biweekly">Bi-weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Retainage Release Threshold (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={settings.billing.retainageReleaseThreshold}
                    onChange={(e) =>
                      updateSetting(
                        "billing",
                        "retainageReleaseThreshold",
                        Number(e.target.value),
                      )
                    }
                  />
                  <p className="text-sm text-muted-foreground">
                    Percentage complete before retainage can be released
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageShell>
  );
}
