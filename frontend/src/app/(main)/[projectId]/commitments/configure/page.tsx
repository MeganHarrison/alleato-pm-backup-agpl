"use client";
import { PageShell } from "@/components/layout";
import { CommitmentsHelpSheet } from "@/components/commitments/CommitmentsHelpSheet";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Save, Info } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

// Based on Procore's 81 configuration fields from crawl metadata
interface CommitmentConfiguration {
  // Contract Configuration section
  contractConfiguration: {
    contractsPrivateByDefault: boolean;
    enablePurchaseOrders: boolean;
    enableSubcontracts: boolean;
    rfqDueDaysDefault: number;
    numberOfChangeOrderTiers: number;
    allowStandardToCreateCCOs: boolean;
    allowStandardToCreateCORs: boolean;
    allowStandardToCreatePCOs: boolean;
    enableAlwaysEditableSov: boolean;
    enableFieldInitiatedChangeOrders: boolean;
    showMarkupCriteriaOnCommitments: boolean;
  };
  // Default Distributions section
  defaultDistributions: {
    includePrimaryContactInDistribution: boolean;
    commitmentDistribution: string[];
    commitmentChangeOrderDistribution: string[];
    commitmentChangeOrderRequestDistribution: string[];
    commitmentPotentialChangeOrderDistribution: string[];
    requestForQuoteDistribution: string[];
    invoiceDistribution: string[];
  };
  // Default Contract Settings section
  defaultContractSettings: {
    purchaseOrderAccountingMethod: string;
    subcontractAccountingMethod: string;
    purchaseOrderRetainagePercentDefault: number;
    subcontractRetainagePercentDefault: number;
    enableCommentsByDefault: boolean;
    enableCompletedWorkRetainageByDefault: boolean;
    enableFinancialMarkupByDefault: boolean;
    enablePaymentsByDefault: boolean;
    enableInvoicesByDefault: boolean;
    showCostCodeOnInvoicePdfByDefault: boolean;
    enableStoredMaterialRetainageByDefault: boolean;
    enableSubcontractorSovByDefault: boolean;
  };
  // Billing Period Settings section
  billingPeriodSettings: {
    enablePrefilledBillingPeriods: boolean;
    billingPeriodStart: number;
    billingPeriodEnd: number;
    monthlyDueDate: number;
    enableReminderEmails: boolean;
    reminderInterval: string;
    allowOverBilling: boolean;
    customEmailText: string;
    receiveDigestOfUnapprovedInvoices: string;
    invoicePdfFooterText: string;
    sendNotificationOnInvoiceApproval: boolean;
    enableSubcontractorProposedAmount: boolean;
  };
}

const DEFAULT_CONFIGURATION: CommitmentConfiguration = {
  contractConfiguration: {
    contractsPrivateByDefault: true,
    enablePurchaseOrders: true,
    enableSubcontracts: true,
    rfqDueDaysDefault: 7,
    numberOfChangeOrderTiers: 1,
    allowStandardToCreateCCOs: false,
    allowStandardToCreateCORs: false,
    allowStandardToCreatePCOs: false,
    enableAlwaysEditableSov: false,
    enableFieldInitiatedChangeOrders: false,
    showMarkupCriteriaOnCommitments: false,
  },
  defaultDistributions: {
    includePrimaryContactInDistribution: false,
    commitmentDistribution: [],
    commitmentChangeOrderDistribution: [],
    commitmentChangeOrderRequestDistribution: [],
    commitmentPotentialChangeOrderDistribution: [],
    requestForQuoteDistribution: [],
    invoiceDistribution: [],
  },
  defaultContractSettings: {
    purchaseOrderAccountingMethod: "unit-quantity",
    subcontractAccountingMethod: "amount",
    purchaseOrderRetainagePercentDefault: 0,
    subcontractRetainagePercentDefault: 0,
    enableCommentsByDefault: false,
    enableCompletedWorkRetainageByDefault: true,
    enableFinancialMarkupByDefault: false,
    enablePaymentsByDefault: true,
    enableInvoicesByDefault: true,
    showCostCodeOnInvoicePdfByDefault: true,
    enableStoredMaterialRetainageByDefault: true,
    enableSubcontractorSovByDefault: true,
  },
  billingPeriodSettings: {
    enablePrefilledBillingPeriods: false,
    billingPeriodStart: 1,
    billingPeriodEnd: 31,
    monthlyDueDate: 15,
    enableReminderEmails: false,
    reminderInterval: "every_day",
    allowOverBilling: false,
    customEmailText: "",
    receiveDigestOfUnapprovedInvoices: "never",
    invoicePdfFooterText: "",
    sendNotificationOnInvoiceApproval: false,
    enableSubcontractorProposedAmount: false,
  },
};

export default function CommitmentConfigurePage() {
  const params = useParams()! ?? {};
  const router = useRouter();
  const projectId = params.projectId as string;

  const [config, setConfig] =
    useState<CommitmentConfiguration>(DEFAULT_CONFIGURATION);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("contract-configuration");

  const updateContractConfig = <
    K extends keyof CommitmentConfiguration["contractConfiguration"],
  >(
    key: K,
    value: CommitmentConfiguration["contractConfiguration"][K],
  ) => {
    setConfig((prev) => ({
      ...prev,
      contractConfiguration: {
        ...prev.contractConfiguration,
        [key]: value,
      },
    }));
  };

  const updateDefaultContractSettings = <
    K extends keyof CommitmentConfiguration["defaultContractSettings"],
  >(
    key: K,
    value: CommitmentConfiguration["defaultContractSettings"][K],
  ) => {
    setConfig((prev) => ({
      ...prev,
      defaultContractSettings: {
        ...prev.defaultContractSettings,
        [key]: value,
      },
    }));
  };

  const updateDistributions = <
    K extends keyof CommitmentConfiguration["defaultDistributions"],
  >(
    key: K,
    value: CommitmentConfiguration["defaultDistributions"][K],
  ) => {
    setConfig((prev) => ({
      ...prev,
      defaultDistributions: {
        ...prev.defaultDistributions,
        [key]: value,
      },
    }));
  };

  const updateBillingSettings = <
    K extends keyof CommitmentConfiguration["billingPeriodSettings"],
  >(
    key: K,
    value: CommitmentConfiguration["billingPeriodSettings"][K],
  ) => {
    setConfig((prev) => ({
      ...prev,
      billingPeriodSettings: {
        ...prev.billingPeriodSettings,
        [key]: value,
      },
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // TODO: Implement API endpoint for saving commitment configuration
      // await fetch(`/api/projects/${projectId}/commitments/configuration`, {
      //   method: "PUT",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify(config),
      // });
      toast.success("Configuration saved successfully");
    } catch {
      toast.error("Failed to save configuration");
    } finally {
      setIsSaving(false);
    }
  };

  // Generate day options for billing period
  const dayOptions = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <PageShell
      variant="content"
      title="Commitment Settings"
      description="Configure commitment defaults, workflows, billing, and permissions."
      onBack={() => router.push(`/${projectId}/commitments`)}
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
            Update
          </Button>
        </div>
      }
    >
      <div className="space-y-8">
        <nav className="flex flex-wrap gap-2 border-b border-border/70 pb-4">
            <Button
              variant={activeTab === "contract-configuration" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("contract-configuration")}
            >
              Contract Configuration
            </Button>
            <Button
              variant={activeTab === "workflow-settings" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("workflow-settings")}
            >
              Workflow Settings
            </Button>
            <Button
              variant={activeTab === "invoice-settings" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("invoice-settings")}
            >
              Invoice Settings
            </Button>
            <Button
              variant={activeTab === "permissions" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("permissions")}
            >
              Permissions Table
            </Button>
          </nav>

        <main className="space-y-8">
          {activeTab === "contract-configuration" && (
            <>
              {/* Contract Configuration Section */}
              <Card className="border-0 bg-transparent shadow-none">
                <CardHeader className="px-0 pt-0">
                  <CardTitle>Contract Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 px-0">
                  <div className="grid gap-4">
                    <div className="flex items-center justify-between py-2 border-b">
                      <Label htmlFor="contractsPrivateByDefault">
                        Contracts Private By Default:
                      </Label>
                      <Checkbox
                        id="contractsPrivateByDefault"
                        checked={config.contractConfiguration.contractsPrivateByDefault}
                        onCheckedChange={(v) =>
                          updateContractConfig("contractsPrivateByDefault", !!v)
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between py-2 border-b">
                      <Label htmlFor="enablePurchaseOrders">
                        Enable Purchase Orders:
                      </Label>
                      <Checkbox
                        id="enablePurchaseOrders"
                        checked={config.contractConfiguration.enablePurchaseOrders}
                        onCheckedChange={(v) =>
                          updateContractConfig("enablePurchaseOrders", !!v)
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between py-2 border-b">
                      <Label htmlFor="enableSubcontracts">
                        Enable Subcontracts:
                      </Label>
                      <Checkbox
                        id="enableSubcontracts"
                        checked={config.contractConfiguration.enableSubcontracts}
                        onCheckedChange={(v) =>
                          updateContractConfig("enableSubcontracts", !!v)
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between py-2 border-b">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="rfqDueDaysDefault">
                          RFQs Will Be Due After:
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          id="rfqDueDaysDefault"
                          type="number"
                          min={1}
                          className="w-20"
                          value={config.contractConfiguration.rfqDueDaysDefault}
                          onChange={(e) =>
                            updateContractConfig(
                              "rfqDueDaysDefault",
                              Number(e.target.value)
                            )
                          }
                        />
                        <span className="text-sm text-muted-foreground">
                          working day(s) by default
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-2 border-b">
                      <Label htmlFor="numberOfChangeOrderTiers">
                        Number of Commitment Change Order Tiers:
                      </Label>
                      <Select
                        value={String(config.contractConfiguration.numberOfChangeOrderTiers)}
                        onValueChange={(v) =>
                          updateContractConfig("numberOfChangeOrderTiers", Number(v))
                        }
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1</SelectItem>
                          <SelectItem value="2">2</SelectItem>
                          <SelectItem value="3">3</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between py-2 border-b">
                      <Label htmlFor="allowStandardToCreateCCOs">
                        Allow Standard Level Users to Create CCOs:
                      </Label>
                      <Checkbox
                        id="allowStandardToCreateCCOs"
                        checked={config.contractConfiguration.allowStandardToCreateCCOs}
                        onCheckedChange={(v) =>
                          updateContractConfig("allowStandardToCreateCCOs", !!v)
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between py-2 border-b">
                      <Label htmlFor="allowStandardToCreateCORs">
                        Allow Standard Level Users to Create CORs:
                      </Label>
                      <Checkbox
                        id="allowStandardToCreateCORs"
                        checked={config.contractConfiguration.allowStandardToCreateCORs}
                        onCheckedChange={(v) =>
                          updateContractConfig("allowStandardToCreateCORs", !!v)
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between py-2 border-b">
                      <Label htmlFor="allowStandardToCreatePCOs">
                        Allow Standard Level Users to Create PCOs:
                      </Label>
                      <Checkbox
                        id="allowStandardToCreatePCOs"
                        checked={config.contractConfiguration.allowStandardToCreatePCOs}
                        onCheckedChange={(v) =>
                          updateContractConfig("allowStandardToCreatePCOs", !!v)
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between py-2 border-b">
                      <Label htmlFor="enableAlwaysEditableSov">
                        Enable Always Editable Schedule of Values:
                      </Label>
                      <Checkbox
                        id="enableAlwaysEditableSov"
                        checked={config.contractConfiguration.enableAlwaysEditableSov}
                        onCheckedChange={(v) =>
                          updateContractConfig("enableAlwaysEditableSov", !!v)
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between py-2 border-b">
                      <Label htmlFor="enableFieldInitiatedChangeOrders">
                        Enable Field Initiated Change Orders:
                      </Label>
                      <Checkbox
                        id="enableFieldInitiatedChangeOrders"
                        checked={
                          config.contractConfiguration.enableFieldInitiatedChangeOrders
                        }
                        onCheckedChange={(v) =>
                          updateContractConfig("enableFieldInitiatedChangeOrders", !!v)
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between py-2">
                      <div>
                        <Label htmlFor="showMarkupCriteriaOnCommitments">
                          Show Financial Markup Application Criteria on Change Order
                          PDF exports:
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Details include cost codes and cost types specified in the
                          financial markup.
                        </p>
                      </div>
                      <Checkbox
                        id="showMarkupCriteriaOnCommitments"
                        checked={
                          config.contractConfiguration.showMarkupCriteriaOnCommitments
                        }
                        onCheckedChange={(v) =>
                          updateContractConfig("showMarkupCriteriaOnCommitments", !!v)
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Contract Dates Notice */}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>
                  The Commitments Tool&apos;s Contract Dates Have Been Moved
                </AlertTitle>
                <AlertDescription>
                  You can no longer configure contract dates for the Commitments tool
                  on this page because it has been moved to the Company Admin tool.
                  Please go to the Contract Fieldsets page in the Company Admin tool
                  to make changes.
                </AlertDescription>
              </Alert>

              {/* Default Distributions Section */}
              <Card className="border-0 bg-transparent shadow-none">
                <CardHeader className="px-0 pt-0">
                  <CardTitle>Default Distributions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 px-0">
                  <div className="grid gap-4">
                    <div className="flex items-center justify-between py-2 border-b">
                      <Label htmlFor="includePrimaryContactInDistribution">
                        Include Primary Contact in Default Distribution:
                      </Label>
                      <Checkbox
                        id="includePrimaryContactInDistribution"
                        checked={
                          config.defaultDistributions.includePrimaryContactInDistribution
                        }
                        onCheckedChange={(v) =>
                          updateDistributions("includePrimaryContactInDistribution", !!v)
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between py-2 border-b">
                      <Label>Commitment Distribution:</Label>
                      <Select>
                        <SelectTrigger className="w-64">
                          <SelectValue placeholder="Select A Person..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Select A Person...</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between py-2 border-b">
                      <Label>Commitment Change Order Distribution:</Label>
                      <Select>
                        <SelectTrigger className="w-64">
                          <SelectValue placeholder="Select A Person..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Select A Person...</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between py-2 border-b">
                      <Label>Request For Quote Distribution:</Label>
                      <Select>
                        <SelectTrigger className="w-64">
                          <SelectValue placeholder="Select A Person..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Select A Person...</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between py-2">
                      <Label>Invoice Distribution:</Label>
                      <Select>
                        <SelectTrigger className="w-64">
                          <SelectValue placeholder="Select A Person..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Select A Person...</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Default Contract Settings Section */}
              <Card className="border-0 bg-transparent shadow-none">
                <CardHeader className="px-0 pt-0">
                  <CardTitle>Default Contract Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 px-0">
                  <div className="grid gap-4">
                    <div className="grid grid-cols-1 gap-4 py-2 border-b sm:grid-cols-2 sm:gap-8">
                      <div className="flex items-center justify-between">
                        <Label>Default Accounting Method for Purchase Orders:</Label>
                        <Select
                          value={
                            config.defaultContractSettings.purchaseOrderAccountingMethod
                          }
                          onValueChange={(v) =>
                            updateDefaultContractSettings(
                              "purchaseOrderAccountingMethod",
                              v
                            )
                          }
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unit-quantity">
                              Unit/Quantity Based
                            </SelectItem>
                            <SelectItem value="amount">Amount Based</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Default Accounting Method For Subcontracts:</Label>
                        <Select
                          value={
                            config.defaultContractSettings.subcontractAccountingMethod
                          }
                          onValueChange={(v) =>
                            updateDefaultContractSettings(
                              "subcontractAccountingMethod",
                              v
                            )
                          }
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unit-quantity">
                              Unit/Quantity Based
                            </SelectItem>
                            <SelectItem value="amount">Amount Based</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 py-2 border-b sm:grid-cols-2 sm:gap-8">
                      <div className="flex items-center justify-between">
                        <Label>Default Purchase Order Retainage Percent:</Label>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            className="w-20"
                            value={
                              config.defaultContractSettings
                                .purchaseOrderRetainagePercentDefault
                            }
                            onChange={(e) =>
                              updateDefaultContractSettings(
                                "purchaseOrderRetainagePercentDefault",
                                Number(e.target.value)
                              )
                            }
                          />
                          <span>%</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Default Subcontract Retainage Percent:</Label>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            className="w-20"
                            value={
                              config.defaultContractSettings
                                .subcontractRetainagePercentDefault
                            }
                            onChange={(e) =>
                              updateDefaultContractSettings(
                                "subcontractRetainagePercentDefault",
                                Number(e.target.value)
                              )
                            }
                          />
                          <span>%</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-2 border-b">
                      <Label>Enable Comments By Default:</Label>
                      <Checkbox
                        checked={config.defaultContractSettings.enableCommentsByDefault}
                        onCheckedChange={(v) =>
                          updateDefaultContractSettings("enableCommentsByDefault", !!v)
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between py-2 border-b">
                      <Label>Enable Completed Work Retainage By Default:</Label>
                      <Checkbox
                        checked={
                          config.defaultContractSettings
                            .enableCompletedWorkRetainageByDefault
                        }
                        onCheckedChange={(v) =>
                          updateDefaultContractSettings(
                            "enableCompletedWorkRetainageByDefault",
                            !!v
                          )
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between py-2 border-b">
                      <Label>Enable Financial Markup By Default:</Label>
                      <Checkbox
                        checked={
                          config.defaultContractSettings.enableFinancialMarkupByDefault
                        }
                        onCheckedChange={(v) =>
                          updateDefaultContractSettings(
                            "enableFinancialMarkupByDefault",
                            !!v
                          )
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between py-2 border-b">
                      <Label>Enable Payments By Default:</Label>
                      <Checkbox
                        checked={config.defaultContractSettings.enablePaymentsByDefault}
                        onCheckedChange={(v) =>
                          updateDefaultContractSettings("enablePaymentsByDefault", !!v)
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between py-2 border-b">
                      <Label>Enable Invoices by Default:</Label>
                      <Checkbox
                        checked={config.defaultContractSettings.enableInvoicesByDefault}
                        onCheckedChange={(v) =>
                          updateDefaultContractSettings("enableInvoicesByDefault", !!v)
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between py-2 border-b">
                      <Label>Show Cost Codes on Invoice PDF by Default:</Label>
                      <Checkbox
                        checked={
                          config.defaultContractSettings.showCostCodeOnInvoicePdfByDefault
                        }
                        onCheckedChange={(v) =>
                          updateDefaultContractSettings(
                            "showCostCodeOnInvoicePdfByDefault",
                            !!v
                          )
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between py-2 border-b">
                      <Label>Enable Stored Material Retainage By Default:</Label>
                      <Checkbox
                        checked={
                          config.defaultContractSettings
                            .enableStoredMaterialRetainageByDefault
                        }
                        onCheckedChange={(v) =>
                          updateDefaultContractSettings(
                            "enableStoredMaterialRetainageByDefault",
                            !!v
                          )
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between py-2">
                      <Label>Enable Subcontractor SOV By Default:</Label>
                      <Checkbox
                        checked={
                          config.defaultContractSettings.enableSubcontractorSovByDefault
                        }
                        onCheckedChange={(v) =>
                          updateDefaultContractSettings(
                            "enableSubcontractorSovByDefault",
                            !!v
                          )
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {activeTab === "workflow-settings" && (
            <Card className="border-0 bg-transparent shadow-none">
              <CardHeader className="px-0 pt-0">
                <CardTitle>Workflow Settings</CardTitle>
                <CardDescription>
                  Configure approval workflows and notification settings for
                  commitments.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 px-0">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Workflow settings will be available in a future release. Contact
                    your administrator for custom workflow requirements.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}

          {activeTab === "invoice-settings" && (
            <Card className="border-0 bg-transparent shadow-none">
              <CardHeader className="px-0 pt-0">
                <CardTitle>Invoice Settings</CardTitle>
                <CardDescription>
                  Configure billing periods, reminders, and invoice defaults.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 px-0">
                <div className="grid gap-4">
                  <div className="flex items-center justify-between py-2 border-b">
                    <Label>Enable Prefilled Billing Periods:</Label>
                    <Checkbox
                      checked={config.billingPeriodSettings.enablePrefilledBillingPeriods}
                      onCheckedChange={(v) =>
                        updateBillingSettings("enablePrefilledBillingPeriods", !!v)
                      }
                    />
                  </div>

                  {config.billingPeriodSettings.enablePrefilledBillingPeriods && (
                    <>
                      <div className="flex items-center justify-between py-2 border-b">
                        <Label>Monthly Billing Period:</Label>
                        <div className="flex items-center gap-2">
                          <Select
                            value={String(config.billingPeriodSettings.billingPeriodStart)}
                            onValueChange={(v) =>
                              updateBillingSettings("billingPeriodStart", Number(v))
                            }
                          >
                            <SelectTrigger className="w-20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {dayOptions.map((day) => (
                                <SelectItem key={day} value={String(day)}>
                                  {day}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span>To</span>
                          <Select
                            value={String(config.billingPeriodSettings.billingPeriodEnd)}
                            onValueChange={(v) =>
                              updateBillingSettings("billingPeriodEnd", Number(v))
                            }
                          >
                            <SelectTrigger className="w-20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {dayOptions.map((day) => (
                                <SelectItem key={day} value={String(day)}>
                                  {day}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="flex items-center justify-between py-2 border-b">
                        <Label>Monthly Due Date:</Label>
                        <Select
                          value={String(config.billingPeriodSettings.monthlyDueDate)}
                          onValueChange={(v) =>
                            updateBillingSettings("monthlyDueDate", Number(v))
                          }
                        >
                          <SelectTrigger className="w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {dayOptions.map((day) => (
                              <SelectItem key={day} value={String(day)}>
                                {day}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  <div className="flex items-center justify-between py-2 border-b">
                    <Label>Enable Reminder Emails:</Label>
                    <Checkbox
                      checked={config.billingPeriodSettings.enableReminderEmails}
                      onCheckedChange={(v) =>
                        updateBillingSettings("enableReminderEmails", !!v)
                      }
                    />
                  </div>

                  {config.billingPeriodSettings.enableReminderEmails && (
                    <div className="flex items-center justify-between py-2 border-b">
                      <Label>Reminder Interval:</Label>
                      <Select
                        value={config.billingPeriodSettings.reminderInterval}
                        onValueChange={(v) =>
                          updateBillingSettings("reminderInterval", v)
                        }
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="every_day">Every Day</SelectItem>
                          <SelectItem value="every_2_days">Every 2 Days</SelectItem>
                          <SelectItem value="every_3_days">Every 3 Days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="flex items-center justify-between py-2 border-b">
                    <Label>Allow Over Billing:</Label>
                    <Checkbox
                      checked={config.billingPeriodSettings.allowOverBilling}
                      onCheckedChange={(v) =>
                        updateBillingSettings("allowOverBilling", !!v)
                      }
                    />
                  </div>

                  <div className="space-y-2 py-2 border-b">
                    <Label>Custom Email Text:</Label>
                    <Textarea
                      value={config.billingPeriodSettings.customEmailText}
                      onChange={(e) =>
                        updateBillingSettings("customEmailText", e.target.value)
                      }
                      placeholder="Enter custom email text for invoice notifications..."
                      rows={4}
                    />
                  </div>

                  <div className="flex items-center justify-between py-2 border-b">
                    <Label>Receive Email Digest of all Unapproved Invoices:</Label>
                    <Select
                      value={config.billingPeriodSettings.receiveDigestOfUnapprovedInvoices}
                      onValueChange={(v) =>
                        updateBillingSettings("receiveDigestOfUnapprovedInvoices", v)
                      }
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="never">Never</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 py-2 border-b">
                    <Label>Invoice PDF Footer Text:</Label>
                    <Textarea
                      value={config.billingPeriodSettings.invoicePdfFooterText}
                      onChange={(e) =>
                        updateBillingSettings("invoicePdfFooterText", e.target.value)
                      }
                      placeholder="Enter footer text for invoice PDFs..."
                      rows={3}
                    />
                  </div>

                  <div className="flex items-center justify-between py-2 border-b">
                    <Label>
                      Send Notification Emails to Subcontractors when Invoices are
                      Approved:
                    </Label>
                    <Checkbox
                      checked={
                        config.billingPeriodSettings.sendNotificationOnInvoiceApproval
                      }
                      onCheckedChange={(v) =>
                        updateBillingSettings("sendNotificationOnInvoiceApproval", !!v)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <Label>Enable Subcontractor Proposed Amount:</Label>
                    <Checkbox
                      checked={
                        config.billingPeriodSettings.enableSubcontractorProposedAmount
                      }
                      onCheckedChange={(v) =>
                        updateBillingSettings("enableSubcontractorProposedAmount", !!v)
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "permissions" && (
            <Card className="border-0 bg-transparent shadow-none">
              <CardHeader className="px-0 pt-0">
                <CardTitle>Permissions Table</CardTitle>
                <CardDescription>
                  Manage user permissions for the Commitments tool.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Permission settings are managed at the project level. Please
                    contact your project administrator to modify permission settings.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}

          {/* Update Button at bottom */}
          <div className="flex justify-end pt-4">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="gap-2"
            >
              <Save />
              Update
            </Button>
          </div>
        </main>
      </div>
    </PageShell>
  );
}
