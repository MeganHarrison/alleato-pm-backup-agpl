"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  Calculator,
  DollarSign,
  FileSpreadsheet,
  Upload,
  Download,
  Wand2,
} from "lucide-react";
import { StepComponentProps } from "./project-setup-wizard";
import type { Database } from "@/types/database.types";
import { isDevelopment, fakeData } from "@/lib/dev-autofill";

type BudgetItem = Database["public"]["Tables"]["budget_lines"]["Row"];
type CostCode = Database["public"]["Tables"]["cost_codes"]["Row"];
type ProjectCostCode =
  Database["public"]["Tables"]["project_budget_codes"]["Row"];
type CostCodeType = Database["public"]["Tables"]["cost_code_types"]["Row"];

interface SimpleBudgetItem {
  project_id: number;
  cost_code_id: string | null;
  cost_code?: CostCode;
  cost_code_type?: CostCodeType;
  description: string;
  amount: number;
  quantity: number | null;
  unit_price: number | null;
  unit_of_measure: string | null;
  status: string;
}

interface BudgetSummary {
  totalBudget: number;
  totalByType: Record<string, number>;
  itemCount: number;
}

export function BudgetSetup({ projectId, onNext, onSkip }: StepComponentProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [projectCostCodes, setProjectCostCodes] = useState<any[]>([]);
  const [budgetItems, setBudgetItems] = useState<SimpleBudgetItem[]>([]);
  const [costCodeTypes, setCostCodeTypes] = useState<CostCodeType[]>([]);
  const [activeTab, setActiveTab] = useState("manual");

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load all cost code types for the dropdown
      const { data: types, error: typesError } = await supabase
        .from("cost_code_types")
        .select("*")
        .order("code");

      if (typesError) throw typesError;
      setCostCodeTypes(types || []);

      // Load project budget codes with details
      const { data: costCodes, error: codesError } = await supabase
        .from("project_budget_codes")
        .select(
          `
          *,
          cost_code:cost_codes(*),
          cost_type:cost_code_types(*)
        `,
        )
        .eq("project_id", Number(projectId))
        .eq("is_active", true)
        .order("cost_code_id");

      if (codesError) throw codesError;

      setProjectCostCodes(costCodes || []);

      // For initial setup, we'll always start with empty budget items based on cost codes
      // Initialize budget items from project cost codes
      const initialItems: SimpleBudgetItem[] = (costCodes || []).map((pcc) => {
        // Format description as "title.type" (e.g., "Vice President.Labor")
        const title = pcc.cost_code?.title || "";
        const typeDesc = pcc.cost_type?.description || "";
        const description = title && typeDesc ? `${title}.${typeDesc}` : title;

        return {
          project_id: parseInt(projectId),
          cost_code_id: String(pcc.cost_code_id),
          cost_code: pcc.cost_code,
          cost_code_type: pcc.cost_type,
          description,
          amount: 0,
          quantity: null,
          unit_price: null,
          unit_of_measure: null,
          status: "draft",
        } as SimpleBudgetItem;
      });
      setBudgetItems(initialItems as unknown as SimpleBudgetItem[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const updateBudgetItem = (index: number, field: string, value: any) => {
    const updatedItems = [...budgetItems];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value,
    };

    // If cost code type is changed, update the description to "title.type"
    if (field === "cost_code_type") {
      const newType = costCodeTypes.find((t) => t.id === value);
      const title = updatedItems[index].cost_code?.title || "";
      const typeDesc = newType?.description || "";
      updatedItems[index].description =
        title && typeDesc ? `${title}.${typeDesc}` : title;
      updatedItems[index].cost_code_type = newType;
    }

    // Calculate amount if quantity and unit_price are provided
    if (field === "quantity" || field === "unit_price") {
      const quantity =
        field === "quantity" ? value : updatedItems[index].quantity;
      const unitPrice =
        field === "unit_price" ? value : updatedItems[index].unit_price;

      if (quantity && unitPrice) {
        updatedItems[index].amount = quantity * unitPrice;
      }
    }

    setBudgetItems(updatedItems);
  };

  // Auto-fill all budget items with random test data
  const autoFillBudgetItems = () => {
    if (!isDevelopment) return;

    const units = ["EA", "SF", "LF", "HR", "LS", "CY", "TON"];
    const filledItems = budgetItems.map((item) => {
      const quantity = fakeData.amount(10, 500);
      const unitPrice = fakeData.amount(50, 2000);
      return {
        ...item,
        quantity,
        unit_of_measure: units[Math.floor(Math.random() * units.length)],
        unit_price: unitPrice,
        amount: quantity * unitPrice,
      };
    });
    setBudgetItems(filledItems);
  };

  const calculateSummary = (): BudgetSummary => {
    const totalBudget = budgetItems.reduce(
      (sum, item) => sum + (item.amount || 0),
      0,
    );
    const totalByType: Record<string, number> = {};

    budgetItems.forEach((item) => {
      const typeCode = item.cost_code_type?.code || "Other";
      totalByType[typeCode] = (totalByType[typeCode] || 0) + (item.amount || 0);
    });

    return {
      totalBudget,
      totalByType,
      itemCount: budgetItems.filter((item) => item.amount > 0).length,
    };
  };

  const saveBudget = async () => {
    try {
      setSaving(true);
      setError(null);

      // Filter out items with no amount (all items have cost codes from project_budget_codes)
      const itemsToSave = budgetItems.filter(
        (item) => item.amount > 0 && item.cost_code_id,
      );

      if (itemsToSave.length === 0) {
        setError("Please enter at least one budget item with an amount");
        return;
      }

      // Use the budget API endpoint which properly creates project_budget_codes and budget_lines
      // This ensures data is in the correct tables for the mv_budget_rollup view
      const response = await fetch(`/api/projects/${projectId}/budget`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineItems: itemsToSave.map((item) => ({
            costCodeId: item.cost_code_id,
            costType: item.cost_code_type?.id || null,
            qty: item.quantity?.toString() || null,
            uom: item.unit_of_measure || null,
            unitCost: item.unit_price?.toString() || null,
            amount: item.amount.toString(),
            description: item.description || null,
          })),
        }),
      });

      if (!response.ok) {
        let errorMessage = "Failed to create budget items";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (error) {
          reportNonCriticalFailure({
            area: "project-setup-budget",
            operation: "parse-create-budget-error",
            error,
            userVisibleFallback:
              "Budget creation failed, but the response did not include a readable error body.",
            metadata: { projectId },
          });
        }
        throw new Error(errorMessage);
      }

      // API endpoint now handles updating project budget totals atomically
      onNext();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to save budget";
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const exportBudgetTemplate = () => {
    // Create CSV content
    const headers = [
      "Cost Code",
      "Description",
      "Quantity",
      "Unit",
      "Unit Price",
      "Total Amount",
    ];
    const rows = budgetItems.map((item) => [
      item.cost_code?.id || "",
      item.description || "",
      item.quantity || "",
      item.unit_of_measure || "",
      item.unit_price || "",
      item.amount || "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    // Download file
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `budget-template-project-${projectId}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">Loading budget data...</div>
      </div>
    );
  }

  const summary = calculateSummary();

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <p className="text-muted-foreground">
          Set up your initial project budget. You can enter amounts manually or
          import from a spreadsheet.
        </p>

        {/* Budget Summary */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            {/* eslint-disable-next-line design-system/no-raw-heading */}
            <h4 className="font-medium flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Budget Summary
            </h4>
            <div className="text-2xl font-bold">
              ${summary.totalBudget.toLocaleString()}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {Object.entries(summary.totalByType).map(([type, amount]) => (
              <div key={type} className="flex items-center justify-between">
                <span className="text-muted-foreground">{type}:</span>
                <span className="font-medium">${amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-2 w-[400px]">
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
            <TabsTrigger value="import" disabled>
              Import CSV
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-4">
            <div className="flex justify-between gap-2">
              {isDevelopment && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={autoFillBudgetItems}
                  className="gap-2 bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-300"
                  title="Development only: Fill all budget items with test data"
                >
                  <Wand2 className="h-4 w-4" />
                  Auto-Fill All
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={exportBudgetTemplate}
              >
                <Download />
                Export Template
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">Cost Code</TableHead>
                    <TableHead className="w-32">Cost Code Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-24">Quantity</TableHead>
                    <TableHead className="w-20">Unit</TableHead>
                    <TableHead className="w-32">Unit Price</TableHead>
                    <TableHead className="w-32">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {budgetItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <span className="text-sm font-medium">
                          {item.cost_code
                            ? `${item.cost_code.id} ${item.cost_code.title}`
                            : "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={item.cost_code_type?.id || ""}
                          onValueChange={(value) =>
                            updateBudgetItem(index, "cost_code_type", value)
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue>
                              {item.cost_code_type ? (
                                <div className="flex items-center gap-1">
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {item.cost_code_type.code}
                                  </Badge>
                                  <span className="text-xs">
                                    {item.cost_code_type.description}
                                  </span>
                                </div>
                              ) : (
                                "Select type"
                              )}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {costCodeTypes.map((type) => (
                              <SelectItem key={type.id} value={type.id}>
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {type.code}
                                  </Badge>
                                  <span className="text-sm">
                                    {type.description}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.description || ""}
                          onChange={(e) =>
                            updateBudgetItem(
                              index,
                              "description",
                              e.target.value,
                            )
                          }
                          placeholder="Auto-filled from cost code"
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.quantity || ""}
                          onChange={(e) =>
                            updateBudgetItem(
                              index,
                              "quantity",
                              parseFloat(e.target.value) || null,
                            )
                          }
                          placeholder=""
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.unit_of_measure || ""}
                          onChange={(e) =>
                            updateBudgetItem(
                              index,
                              "unit_of_measure",
                              e.target.value,
                            )
                          }
                          placeholder="EA"
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="relative">
                          <DollarSign className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="number"
                            value={item.unit_price || ""}
                            onChange={(e) =>
                              updateBudgetItem(
                                index,
                                "unit_price",
                                parseFloat(e.target.value) || null,
                              )
                            }
                            placeholder=""
                            className="h-8 pl-7"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="relative">
                          <DollarSign className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="number"
                            value={item.amount || ""}
                            onChange={(e) =>
                              updateBudgetItem(
                                index,
                                "amount",
                                parseFloat(e.target.value) || 0,
                              )
                            }
                            placeholder=""
                            className="h-8 pl-7 font-medium"
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="import">
            <Card className="p-6 text-center">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">
                Import functionality coming soon. For now, please use manual
                entry.
              </p>
              <Button variant="outline" disabled>
                <Upload />
                Upload CSV
              </Button>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between">
        <Button variant="ghost" onClick={onSkip} disabled={saving}>
          Skip for now
        </Button>
        <Button
          onClick={saveBudget}
          disabled={saving || summary.totalBudget === 0}
        >
          {saving ? "Saving..." : "Continue"}
        </Button>
      </div>
    </div>
  );
}
