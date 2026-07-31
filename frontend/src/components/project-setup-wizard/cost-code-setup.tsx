"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, X, Upload, AlertCircle } from "lucide-react";
import { StepComponentProps } from "./project-setup-wizard";
import type { Database } from "@/types/database.types";

type CostCode = Database["public"]["Tables"]["cost_codes"]["Row"];
type CostCodeType = Database["public"]["Tables"]["cost_code_types"]["Row"];
type ProjectCostCode =
  Database["public"]["Tables"]["project_budget_codes"]["Row"];

interface CostCodeWithType extends CostCode {
  cost_code_type?: CostCodeType;
  is_active?: boolean;
}

const standardCostCodeTypes: Omit<CostCodeType, "id" | "created_at">[] = [
  { code: "L", description: "Labor", category: "Direct Costs" },
  { code: "M", description: "Materials", category: "Direct Costs" },
  { code: "E", description: "Equipment", category: "Direct Costs" },
  { code: "S", description: "Subcontractor", category: "Direct Costs" },
  { code: "O", description: "Other", category: "Direct Costs" },
  { code: "OH", description: "Overhead", category: "Indirect Costs" },
  { code: "P", description: "Profit", category: "Indirect Costs" },
];

const standardCostCodes: {
  code: string;
  description: string;
  typeCode: string;
}[] = [
  // Site Work
  { code: "02-100", description: "Site Clearing", typeCode: "L" },
  { code: "02-200", description: "Excavation & Grading", typeCode: "E" },
  { code: "02-300", description: "Site Utilities", typeCode: "M" },

  // Concrete
  { code: "03-100", description: "Concrete Forms", typeCode: "L" },
  { code: "03-200", description: "Concrete Reinforcement", typeCode: "M" },
  { code: "03-300", description: "Cast-in-Place Concrete", typeCode: "M" },

  // Masonry
  { code: "04-100", description: "Masonry Units", typeCode: "M" },
  { code: "04-200", description: "Masonry Accessories", typeCode: "M" },

  // Metals
  { code: "05-100", description: "Structural Steel", typeCode: "M" },
  { code: "05-200", description: "Steel Decking", typeCode: "M" },
  { code: "05-300", description: "Metal Fabrications", typeCode: "M" },

  // Wood & Plastics
  { code: "06-100", description: "Rough Carpentry", typeCode: "L" },
  { code: "06-200", description: "Finish Carpentry", typeCode: "L" },

  // Thermal & Moisture Protection
  { code: "07-100", description: "Waterproofing", typeCode: "M" },
  { code: "07-200", description: "Insulation", typeCode: "M" },
  { code: "07-300", description: "Roofing", typeCode: "S" },

  // Doors & Windows
  { code: "08-100", description: "Doors & Frames", typeCode: "M" },
  { code: "08-200", description: "Windows", typeCode: "M" },
  { code: "08-300", description: "Glazing", typeCode: "M" },

  // Finishes
  { code: "09-100", description: "Drywall", typeCode: "S" },
  { code: "09-200", description: "Painting", typeCode: "S" },
  { code: "09-300", description: "Flooring", typeCode: "S" },
  { code: "09-400", description: "Tile", typeCode: "S" },

  // Mechanical
  { code: "15-100", description: "Plumbing", typeCode: "S" },
  { code: "15-200", description: "HVAC", typeCode: "S" },
  { code: "15-300", description: "Fire Protection", typeCode: "S" },

  // Electrical
  { code: "16-100", description: "Electrical", typeCode: "S" },
  { code: "16-200", description: "Communications", typeCode: "S" },
];

export function CostCodeSetup({
  projectId,
  onNext,
  onSkip,
}: StepComponentProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [costCodeTypes, setCostCodeTypes] = useState<CostCodeType[]>([]);
  const [costCodes, setCostCodes] = useState<CostCodeWithType[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newCode, setNewCode] = useState({
    code: "",
    description: "",
    typeCode: "",
  });

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load cost code types
      const { data: types, error: typesError } = await supabase
        .from("cost_code_types")
        .select("*")
        .order("code");

      if (typesError) throw typesError;

      // Load all cost codes
      const { data: codes, error: codesError } = await supabase
        .from("cost_codes")
        .select("*")
        .order("id");

      if (codesError) throw codesError;

      // Load project-specific cost codes
      const { data: projectCodes, error: projectCodesError } = await supabase
        .from("project_budget_codes")
        .select("*")
        .eq("project_id", Number(projectId));

      if (projectCodesError) throw projectCodesError;

      setCostCodeTypes(types || []);

      // Merge cost codes with their types and active status
      const mergedCodes = (codes || []).map((code) => {
        const projectCode = projectCodes?.find(
          (pc) => pc.cost_code_id === code.id,
        );
        const type = types?.find(
          (t) =>
            projectCode?.cost_type_id === t.id ||
            code.id.startsWith(t.code + "-"),
        );

        return {
          ...code,
          cost_code_type: type,
          is_active: projectCode?.is_active ?? false,
        };
      });

      setCostCodes(mergedCodes);

      // Set initially selected codes
      const selected = new Set(
        projectCodes
          ?.filter((pc) => pc.is_active)
          .map((pc) => pc.cost_code_id)
          .filter((id): id is string => id !== null) || [],
      );
      setSelectedCodes(selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const importStandardCodes = async () => {
    try {
      setSaving(true);
      setError(null);

      // First, ensure all cost code types exist
      const typesToInsert = standardCostCodeTypes.filter(
        (type) => !costCodeTypes.find((t) => t.code === type.code),
      );

      if (typesToInsert.length > 0) {
        const { error } = await supabase
          .from("cost_code_types")
          .insert(typesToInsert)
          .select();

        if (error && error.code !== "23505") {
          throw error;
        }
      }

      // Reload types after insertion
      const { data: updatedTypes, error: typesError } = await supabase
        .from("cost_code_types")
        .select("*");

      if (typesError) throw typesError;

      setCostCodeTypes(updatedTypes || []);

      // Insert standard cost codes in batches
      const codesToInsert = standardCostCodes
        .filter((stdCode) => !costCodes.find((c) => c.id === stdCode.code))
        .map((stdCode) => ({
          id: stdCode.code,
          description: stdCode.description,
          status: "active",
        }));

      if (codesToInsert.length > 0) {
        const { error } = await supabase
          .from("cost_codes")
          .insert(codesToInsert as any)
          .select();

        if (error && error.code !== "23505") {
          throw error;
        }
      }

      await loadData();

      // After importing, select all the newly imported codes
      const importedCodeIds = standardCostCodes.map((c) => c.code);
      setSelectedCodes(new Set(importedCodeIds));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to import standard codes",
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleCostCode = (codeId: string) => {
    const newSelected = new Set(selectedCodes);
    if (newSelected.has(codeId)) {
      newSelected.delete(codeId);
    } else {
      newSelected.add(codeId);
    }
    setSelectedCodes(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedCodes.size === costCodes.length) {
      // If all are selected, deselect all
      setSelectedCodes(new Set());
    } else {
      // Otherwise, select all
      setSelectedCodes(new Set(costCodes.map((c) => c.id)));
    }
  };

  const addCustomCode = async () => {
    try {
      setSaving(true);
      setError(null);

      if (!newCode.code || !newCode.description || !newCode.typeCode) {
        setError("Please fill in all fields");
        return;
      }

      // Insert the new cost code
      const { error: codeError } = await supabase.from("cost_codes").insert({
        id: newCode.code,
        title: newCode.description,
        division_id: "general",
        status: "active",
      } as any);

      if (codeError) throw codeError;

      await loadData();
      setShowAddDialog(false);
      setNewCode({ code: "", description: "", typeCode: "" });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to add custom code",
      );
    } finally {
      setSaving(false);
    }
  };

  const saveProjectCostCodes = async () => {
    try {
      setSaving(true);
      setError(null);

      // Delete existing project budget codes
      const { error: deleteError } = await supabase
        .from("project_budget_codes")
        .delete()
        .eq("project_id", Number(projectId));

      if (deleteError) throw deleteError;

      // Insert selected cost codes
      const projectCostCodes = Array.from(selectedCodes).map((codeId) => {
        const code = costCodes.find((c) => c.id === codeId);
        let typeId =
          code?.cost_code_type?.id ||
          costCodeTypes.find((t) => codeId.startsWith(t.code + "-"))?.id;

        // CRITICAL: If we still don't have a type, use "Other" as fallback
        // Every project budget code MUST have a cost_type_id
        if (!typeId) {
          const otherType = costCodeTypes.find((t) => t.code === "O");
          if (!otherType) {
            throw new Error(
              `Cost code ${codeId} has no type and "Other" type not found. Please ensure cost code types are configured.`,
            );
          }
          typeId = otherType.id;
        }

        return {
          project_id: projectId,
          cost_code_id: codeId,
          cost_type_id: typeId,
          description: code?.title || codeId,
          is_active: true,
        };
      });

      if (projectCostCodes.length > 0) {
        const { error: insertError } = await supabase
          .from("project_budget_codes")
          .insert(projectCostCodes as any);

        if (insertError) throw insertError;
      }

      onNext();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save cost codes",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">Loading cost codes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">
            Select the cost codes you want to use for this project. You can
            import standard codes or add custom ones.
          </p>
          <Button
            onClick={importStandardCodes}
            variant="outline"
            disabled={saving}
          >
            <Upload />
            Import Standard Codes
          </Button>
        </div>

        {/* Cost Codes Table */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={
                      costCodes.length > 0 &&
                      selectedCodes.size === costCodes.length
                    }
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead className="w-32">Code</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {costCodes.map((code) => (
                <TableRow key={code.id}>
                  <TableCell>
                    <Switch
                      checked={selectedCodes.has(code.id)}
                      onCheckedChange={() => toggleCostCode(code.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{code.id}</TableCell>
                  <TableCell>{code.title}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* Add Custom Code Button */}
        <div className="flex justify-center">
          <Button
            onClick={() => setShowAddDialog(true)}
            variant="outline"
            disabled={saving}
          >
            <Plus />
            Add Custom Code
          </Button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between">
        <Button variant="ghost" onClick={onSkip} disabled={saving}>
          Skip for now
        </Button>
        <Button
          onClick={saveProjectCostCodes}
          disabled={saving || selectedCodes.size === 0}
        >
          {saving ? "Saving..." : "Continue"}
        </Button>
      </div>

      {/* Add Custom Code Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Cost Code</DialogTitle>
            <DialogDescription>
              Create a custom cost code for your project
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="code">Code</Label>
                <Input
                  id="code"
                  value={newCode.code}
                  onChange={(e) =>
                    setNewCode({ ...newCode, code: e.target.value })
                  }
                  placeholder="e.g., 17-100"
                />
              </div>
              <div>
                <Label htmlFor="type">Type</Label>
                <select
                  id="type"
                  className="w-full rounded-md border border-input bg-background px-4 py-2"
                  value={newCode.typeCode}
                  onChange={(e) =>
                    setNewCode({ ...newCode, typeCode: e.target.value })
                  }
                >
                  <option value="">Select type</option>
                  {costCodeTypes.map((type) => (
                    <option key={type.id} value={type.code}>
                      {type.code} - {type.description}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={newCode.description}
                onChange={(e) =>
                  setNewCode({ ...newCode, description: e.target.value })
                }
                placeholder="e.g., Solar Panel Installation"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={addCustomCode} disabled={saving}>
              {saving ? "Adding..." : "Add Code"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
