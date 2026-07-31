"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/layout";
import { BudgetLineItemTable } from "@/components/budget/BudgetLineItemTable";
import { createClient } from "@/lib/supabase/client";
import { apiFetch, ApiError } from "@/lib/api-client";
import { CreateBudgetCodeModal } from "./components";
import {
  type BudgetLineItem,
  createEmptyLineItem,
  formatCostCodeLabel,
  type ProjectCostCode,
} from "./types";

export default function BudgetSetupPage() {
  const router = useRouter();
  const params = useParams()!;
  const projectId = params.projectId as string;

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [projectCostCodes, setProjectCostCodes] = useState<ProjectCostCode[]>(
    [],
  );
  const [lineItems, setLineItems] = useState<BudgetLineItem[]>([
    createEmptyLineItem(),
  ]);
  const [pendingRowId, setPendingRowId] = useState<string | null>(null);
  const [showCreateCodeModal, setShowCreateCodeModal] = useState(false);

  // Load active project cost codes
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingData(true);
        const supabase = createClient();

        const { data, error } = await supabase
          .from("project_budget_codes")
          .select(
            `
            id,
            cost_code_id,
            cost_type_id,
            is_active,
            cost_codes!inner (
              id,
              title,
              division_title
            ),
            cost_code_types (
              id,
              code,
              description
            )
          `,
          )
          .eq("project_id", parseInt(projectId, 10))
          .eq("is_active", true)
          .order("cost_code_id", { ascending: true });

        if (error) throw error;

        const validCostCodes =
          (data as unknown as ProjectCostCode[])?.filter(
            (cc) => cc.cost_type_id,
          ) || [];
        setProjectCostCodes(validCostCodes);
      } catch (error) {
        toast.error("Failed to load project cost codes");
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, [projectId]);

  const refreshProjectCostCodes = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("project_budget_codes")
      .select(
        `
        id,
        cost_code_id,
        cost_type_id,
        is_active,
        cost_codes!inner ( id, title, division_title ),
        cost_code_types ( id, code, description )
      `,
      )
      .eq("project_id", parseInt(projectId, 10))
      .eq("is_active", true)
      .order("cost_code_id", { ascending: true });

    if (data) {
      const validCostCodes =
        (data as unknown as ProjectCostCode[])?.filter(
          (cc) => cc.cost_type_id,
        ) || [];
      setProjectCostCodes(validCostCodes);
      return validCostCodes;
    }
    return [];
  }, [projectId]);

  const handleAddRow = useCallback(() => {
    const newItem = createEmptyLineItem();
    setLineItems((prev) => [...prev, newItem]);
    // Focus the budget code selector of the new row after render
    setTimeout(() => {
      const newRowButton = document.querySelector(
        `[data-row-id="${newItem.id}"] button`,
      ) as HTMLButtonElement | null;
      newRowButton?.focus();
    }, 0);
  }, []);

  const handleRemoveRow = (id: string) => {
    if (lineItems.length === 1) {
      toast.error("At least one line item is required");
      return;
    }
    setLineItems(lineItems.filter((item) => item.id !== id));
  };

  const handleBudgetCodeSelect = (rowId: string, costCode: ProjectCostCode) => {
    const label = formatCostCodeLabel(costCode);

    setLineItems(
      lineItems.map((item) =>
        item.id === rowId
          ? {
              ...item,
              projectCostCodeId: costCode.id,
              costCodeLabel: label,
              qty: item.qty || "1",
            }
          : item,
      ),
    );
  };

  const handleFieldChange = (
    id: string,
    field: keyof BudgetLineItem,
    value: string,
  ) => {
    setLineItems(
      lineItems.map((item) => {
        if (item.id !== id) return item;

        const updated = { ...item, [field]: value };

        // Auto-calculate amount when qty or unitCost changes
        if (field === "qty" || field === "unitCost") {
          const qty = parseFloat(field === "qty" ? value : item.qty) || 0;
          const unitCost =
            parseFloat(field === "unitCost" ? value : item.unitCost) || 0;
          updated.amount = (qty * unitCost).toFixed(2);
        }

        return updated;
      }),
    );
  };

  const handleCreateBudgetCodeSuccess = async (budgetCodeId: string) => {
    const refreshedCodes = await refreshProjectCostCodes();

    // Auto-populate the pending row with the newly created budget code
    if (pendingRowId && budgetCodeId) {
      const newCode = refreshedCodes.find((cc) => cc.id === budgetCodeId);
      if (newCode) {
        handleBudgetCodeSelect(pendingRowId, newCode);
      }
    }

    setPendingRowId(null);
    toast.success("Budget code created successfully");
  };

  const handleSubmit = async () => {
    // Validate that all rows have a budget code selected
    const invalidRows = lineItems.filter((item) => !item.projectCostCodeId);
    if (invalidRows.length > 0) {
      toast.error("Please select a budget code for all line items");
      return;
    }

    // Validate that all selected cost codes have a cost type
    const missingCostType = lineItems.filter((item) => {
      const costCode = projectCostCodes.find(
        (cc) => cc.id === item.projectCostCodeId,
      );
      return !costCode?.cost_type_id;
    });
    if (missingCostType.length > 0) {
      toast.error("All selected budget codes must have a cost type");
      return;
    }

    try {
      setLoading(true);

      const formattedLineItems = lineItems.map((item) => {
        const costCode = projectCostCodes.find(
          (cc) => cc.id === item.projectCostCodeId,
        );
        return {
          costCodeId: costCode?.cost_code_id || "",
          costType: costCode?.cost_type_id ?? null,
          amount: item.amount || "0",
          description: null,
          qty: item.qty || null,
          uom: item.uom || null,
          unitCost: item.unitCost || null,
        };
      });

      await apiFetch(`/api/projects/${projectId}/budget`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineItems: formattedLineItems }),
      });

      toast.success(`Successfully created ${lineItems.length} budget line(s)`);
      router.push(`/${projectId}/budget`);
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? `Failed to create budget lines: ${error.message}`
          : error instanceof Error
            ? `Failed to create budget lines: ${error.message}`
            : "Failed to create budget lines",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell
      variant="form"
      title="Add Budget Line Items"
      onBack={() => router.push(`/${projectId}/budget`)}
      backLabel="Back to Budget"
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/${projectId}/budget`)}
            className="gap-2 sm:hidden"
          >
            <ArrowLeft />
            Back
          </Button>
          <div className="hidden sm:flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleAddRow}>
              <Plus />
              Add Row
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={loading || lineItems.length === 0}
            >
              {loading
                ? "Creating..."
                : `Create ${lineItems.length} Line Item${lineItems.length !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </div>
      }
    >
        <BudgetLineItemTable
          lineItems={lineItems}
          projectCostCodes={projectCostCodes}
          loadingData={loadingData}
          onBudgetCodeSelect={handleBudgetCodeSelect}
          onFieldChange={handleFieldChange}
          onRemoveRow={handleRemoveRow}
          onCreateNew={(rowId) => {
            setPendingRowId(rowId);
            setShowCreateCodeModal(true);
          }}
          onAddRow={handleAddRow}
          onSubmit={handleSubmit}
          loading={loading}
        />

        {/* Create Budget Code Modal */}
        <CreateBudgetCodeModal
          open={showCreateCodeModal}
          onOpenChange={setShowCreateCodeModal}
          projectId={projectId}
          onSuccess={handleCreateBudgetCodeSuccess}
        />
    </PageShell>
  );
}
