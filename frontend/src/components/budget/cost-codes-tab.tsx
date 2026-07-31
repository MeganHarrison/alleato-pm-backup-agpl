"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronDown,
  ChevronRight,
  Search,
  X,
  Check,
  Loader2,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import {
  useMasterCostCodes,
  useCostCodeTypes,
  useProjectCostCodes,
  useProjectBudgetAmounts,
  useBulkSyncCostCodes,
  type CostCode,
  type CostCodeType,
} from "@/hooks/use-project-cost-codes";

// =============================================================================
// Types
// =============================================================================

interface CostCodesTabProps {
  projectId: string;
  onSave?: () => void;
}

/** A cost_code_id + cost_type_id composite key for tracking selections */
type SelectionKey = `${string}::${string}`;

const makeKey = (costCodeId: string, costTypeId: string): SelectionKey =>
  `${costCodeId}::${costTypeId}`;

/** Cost types to exclude from the UI (only E, L, M, R, S, X are valid) */
const EXCLUDED_TYPE_CODES = new Set(["O", "Other", "OH", "Overhead", "P", "Profit"]);

/** Format a number as currency display */
const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);

// =============================================================================
// Sub-components
// =============================================================================

/** Currency input field for budget amounts */
function CurrencyInput({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (val: number) => void;
  disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [displayValue, setDisplayValue] = useState(value > 0 ? String(value) : "");

  useEffect(() => {
    if (!focused) {
      setDisplayValue(value > 0 ? String(value) : "");
    }
  }, [value, focused]);

  return (
    <div className="relative">
      <DollarSign className="absolute left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
      <Input
        type="text"
        inputMode="decimal"
        value={focused ? displayValue : (value > 0 ? formatCurrency(value).replace("$", "") : "")}
        placeholder=""
        disabled={disabled}
        onFocus={() => {
          setFocused(true);
          setDisplayValue(value > 0 ? String(value) : "");
        }}
        onBlur={() => {
          setFocused(false);
          const parsed = parseFloat(displayValue.replace(/,/g, ""));
          if (!isNaN(parsed) && parsed >= 0) {
            onChange(parsed);
          } else if (displayValue === "") {
            onChange(0);
          }
        }}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9.,]/g, "");
          setDisplayValue(raw);
        }}
        className="h-7 w-28 pl-5 pr-1.5 text-xs text-right tabular-nums"
      />
    </div>
  );
}

/** A single division group in the "All" tab — collapsible with cost type checkbox columns */
function AllDivisionGroup({
  divisionTitle,
  codes,
  costTypes,
  selectedSet,
  amounts,
  onToggleCode,
  onToggleDivision,
  onAmountChange,
}: {
  divisionTitle: string;
  codes: CostCode[];
  costTypes: CostCodeType[];
  selectedSet: Set<SelectionKey>;
  amounts: Map<SelectionKey, number>;
  onToggleCode: (costCodeId: string, costTypeId: string) => void;
  onToggleDivision: (codes: CostCode[], select: boolean) => void;
  onAmountChange: (costCodeId: string, costTypeId: string, amount: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  // Count how many codes have at least one type selected
  const selectedCount = codes.filter((c) =>
    costTypes.some((ct) => selectedSet.has(makeKey(c.id, ct.id))),
  ).length;

  return (
    <div>
      <div
        role="row"
        className="flex items-center gap-2 py-2.5 px-3 hover:bg-muted/50 rounded-md cursor-pointer select-none"
        onClick={() => setExpanded((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded((prev) => !prev);
          }
        }}
        tabIndex={0}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <Checkbox
          checked={
            selectedCount === codes.length && codes.length > 0
              ? true
              : selectedCount > 0
                ? "indeterminate"
                : false
          }
          onCheckedChange={(checked) => {
            onToggleDivision(codes, !!checked);
          }}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select all in ${divisionTitle}`}
        />
        <span className="text-sm font-medium text-foreground flex-1">
          {divisionTitle}
        </span>
        <span className="text-xs text-muted-foreground">
          {selectedCount}/{codes.length}
        </span>
      </div>

      {expanded && (
        <div className="ml-6 pl-4 border-l border-border pb-2 overflow-x-auto">
          {/* Column headers for cost types */}
          <div className="flex min-w-max items-center gap-4 py-2 px-2 border-b border-border mb-0">
            <div className="w-64 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Cost Code
            </div>
            {costTypes.map((ct) => (
              <div
                key={ct.id}
                className="w-20 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide"
                title={ct.description}
              >
                {ct.code === "R" ? "Revenue" : ct.description}
              </div>
            ))}
            <div className="w-28 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Amount
            </div>
          </div>

          {/* Cost code rows with horizontal borders */}
          {codes.map((code) => {
            const hasAnyType = costTypes.some((ct) =>
              selectedSet.has(makeKey(code.id, ct.id)),
            );

            return (
              <div
                key={code.id}
                className={`flex min-w-max items-center gap-4 py-1.5 px-2 border-b border-border ${
                  hasAnyType ? "bg-primary/5" : ""
                }`}
              >
                <div className="w-64 text-sm truncate">
                  <span className="font-medium text-foreground">{code.title || code.id}</span>
                  {code.title && (
                    <span className="text-muted-foreground"> — {code.id}</span>
                  )}
                </div>
                {costTypes.map((ct) => {
                  const key = makeKey(code.id, ct.id);
                  const isSelected = selectedSet.has(key);
                  return (
                    <div key={ct.id} className="w-20 flex justify-center">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggleCode(code.id, ct.id)}
                        aria-label={`${code.id} - ${ct.description}`}
                      />
                    </div>
                  );
                })}
                <div className="w-28">
                  {hasAnyType ? (
                    <CurrencyInput
                      value={(() => {
                        // Show the amount for the first selected type
                        for (const ct of costTypes) {
                          const key = makeKey(code.id, ct.id);
                          if (selectedSet.has(key)) {
                            return amounts.get(key) || 0;
                          }
                        }
                        return 0;
                      })()}
                      onChange={(val) => {
                        // Set amount for all selected types on this code
                        for (const ct of costTypes) {
                          const key = makeKey(code.id, ct.id);
                          if (selectedSet.has(key)) {
                            onAmountChange(code.id, ct.id, val);
                          }
                        }
                      }}
                    />
                  ) : (
                    <div className="h-7" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** The "Selected" overview tab — read-only view of what's been chosen */
function SelectedOverviewTab({
  masterCodes,
  costTypes,
  selectedSet,
  amounts,
}: {
  masterCodes: CostCode[];
  costTypes: CostCodeType[];
  selectedSet: Set<SelectionKey>;
  amounts: Map<SelectionKey, number>;
}) {
  const [expandedDivisions, setExpandedDivisions] = useState<Set<string>>(
    new Set(),
  );

  // Build a map: cost_code_id -> list of cost type codes selected
  const codeToTypes = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const key of selectedSet) {
      const [codeId, typeId] = key.split("::") as [string, string];
      const typeDef = costTypes.find((t) => t.id === typeId);
      if (!map.has(codeId)) map.set(codeId, []);
      map.get(codeId)!.push(typeDef?.code || typeId);
    }
    return map;
  }, [selectedSet, costTypes]);

  // Group selected codes by division
  const selectedCodes = masterCodes.filter((c) => codeToTypes.has(c.id));
  const grouped = useMemo(() => {
    const groups: Record<string, CostCode[]> = {};
    for (const code of selectedCodes) {
      const div = code.division_title || "No Division";
      if (!groups[div]) groups[div] = [];
      groups[div].push(code);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [selectedCodes]);

  // Calculate total budget amount
  const totalAmount = useMemo(() => {
    let total = 0;
    for (const [, val] of amounts) {
      total += val;
    }
    return total;
  }, [amounts]);

  const toggleDivision = (division: string) => {
    setExpandedDivisions((prev) => {
      const next = new Set(prev);
      if (next.has(division)) {
        next.delete(division);
      } else {
        next.add(division);
      }
      return next;
    });
  };

  if (selectedSet.size === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p className="text-base font-medium">No cost codes selected</p>
        <p className="text-sm mt-1">
          Use the All tab to select cost codes and assign cost types for this
          project.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {codeToTypes.size} cost code{codeToTypes.size !== 1 ? "s" : ""} selected
          across {grouped.length} division{grouped.length !== 1 ? "s" : ""}.
        </p>
        {totalAmount > 0 && (
          <p className="text-sm font-medium text-foreground">
            Total: {formatCurrency(totalAmount)}
          </p>
        )}
      </div>
      <div className="space-y-1">
        {grouped.map(([division, codes]) => {
          const isExpanded = expandedDivisions.has(division);
          return (
            <div key={division}>
              <Button
                type="button"
                variant="ghost"
                className="w-full justify-start gap-2 rounded-md bg-muted/50 px-2 py-1.5 text-left hover:bg-muted/80"
                onClick={() => toggleDivision(division)}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className="text-sm font-medium text-foreground flex-1">
                  {division}
                </span>
                <span className="text-xs text-muted-foreground font-normal">
                  {codes.length} code{codes.length !== 1 ? "s" : ""}
                </span>
              </Button>
              {isExpanded && (
                <div className="mt-1 space-y-0">
                  {codes.map((code) => {
                    const types = codeToTypes.get(code.id) || [];
                    // Get the amount for this code (from first selected type)
                    let codeAmount = 0;
                    for (const key of selectedSet) {
                      const [codeId] = key.split("::") as [string, string];
                      if (codeId === code.id) {
                        codeAmount = amounts.get(key) || 0;
                        if (codeAmount > 0) break;
                      }
                    }
                    return (
                      <div
                        key={code.id}
                        className="flex items-center justify-between py-1.5 px-3 text-sm border-b border-border last:border-b-0"
                      >
                        <span>
                          <span className="font-medium text-foreground">
                            {code.title || code.id}
                          </span>
                          {code.title && (
                            <span className="text-muted-foreground">
                              {" "}
                              — {code.id}
                            </span>
                          )}
                        </span>
                        <div className="flex items-center gap-2">
                          {codeAmount > 0 && (
                            <span className="text-xs font-medium tabular-nums text-foreground">
                              {formatCurrency(codeAmount)}
                            </span>
                          )}
                          {types.sort().map((t) => (
                            <Badge
                              key={t}
                              variant="secondary"
                              className="text-xs px-1.5 py-0"
                            >
                              {t}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function CostCodesTab({ projectId, onSave }: CostCodesTabProps) {
  const { data: masterCodes, isLoading: loadingCodes } = useMasterCostCodes();
  const { data: rawCostTypes, isLoading: loadingTypes } = useCostCodeTypes();
  const { data: projectCodes, isLoading: loadingProject } =
    useProjectCostCodes(projectId);
  const { data: existingAmounts } = useProjectBudgetAmounts(projectId);
  const bulkSync = useBulkSyncCostCodes(projectId);

  // Filter out "Other" cost type
  const costTypes = useMemo(
    () =>
      (rawCostTypes || []).filter(
        (ct) =>
          !EXCLUDED_TYPE_CODES.has(ct.code) &&
          !EXCLUDED_TYPE_CODES.has(ct.description),
      ),
    [rawCostTypes],
  );

  // Track selections as composite keys: "costCodeId::costTypeId"
  const [selectedSet, setSelectedSet] = useState<Set<SelectionKey>>(new Set());
  // Track budget amounts per selection key
  const [amounts, setAmounts] = useState<Map<SelectionKey, number>>(new Map());
  // Track what was last saved to detect changes
  const [savedSet, setSavedSet] = useState<Set<SelectionKey>>(new Set());
  const [savedAmounts, setSavedAmounts] = useState<Map<SelectionKey, number>>(new Map());
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("selected");
  const [isSaving, setIsSaving] = useState(false);

  // Initialize selections and amounts from server data
  useEffect(() => {
    if (!projectCodes) return;
    const keys = new Set<SelectionKey>(
      projectCodes
        .filter((pc) => pc.cost_type_id)
        .map((pc) => makeKey(pc.cost_code_id, pc.cost_type_id!)),
    );
    setSelectedSet(keys);
    setSavedSet(new Set(keys));

    if (existingAmounts) {
      const amountMap = new Map<SelectionKey, number>();
      for (const row of existingAmounts) {
        if (row.cost_type_id && row.original_amount > 0) {
          amountMap.set(makeKey(row.cost_code_id, row.cost_type_id), row.original_amount);
        }
      }
      setAmounts(amountMap);
      setSavedAmounts(new Map(amountMap));
    }
  }, [projectCodes, existingAmounts]);

  const toggleCode = useCallback((costCodeId: string, costTypeId: string) => {
    setSelectedSet((prev) => {
      const next = new Set(prev);
      const key = makeKey(costCodeId, costTypeId);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // Toggle all cost types for all codes in a division
  const toggleDivision = useCallback(
    (codes: CostCode[], select: boolean) => {
      if (!costTypes.length) return;
      setSelectedSet((prev) => {
        const next = new Set(prev);
        for (const code of codes) {
          for (const ct of costTypes) {
            const key = makeKey(code.id, ct.id);
            if (select) {
              next.add(key);
            } else {
              next.delete(key);
            }
          }
        }
        return next;
      });
    },
    [costTypes],
  );

  const handleAmountChange = useCallback(
    (costCodeId: string, costTypeId: string, amount: number) => {
      setAmounts((prev) => {
        const next = new Map(prev);
        next.set(makeKey(costCodeId, costTypeId), amount);
        return next;
      });
    },
    [],
  );

  // Check if there are unsaved changes
  const hasChanges = useMemo(() => {
    if (selectedSet.size !== savedSet.size) return true;
    for (const key of selectedSet) {
      if (!savedSet.has(key)) return true;
    }
    // Check if any amounts changed
    for (const [key, val] of amounts) {
      if ((savedAmounts.get(key) || 0) !== val) return true;
    }
    return false;
  }, [selectedSet, savedSet, amounts, savedAmounts]);

  // Save all changes — syncs per cost type via existing API, then creates budget lines
  const handleSave = useCallback(async () => {
    if (!masterCodes || !costTypes.length) return;

    setIsSaving(true);

    try {
      // Determine which cost types have selection changes
      const changedTypes = costTypes.filter((ct) => {
        for (const code of masterCodes) {
          const key = makeKey(code.id, ct.id);
          if (selectedSet.has(key) !== savedSet.has(key)) return true;
        }
        return false;
      });

      // Sync each changed type
      for (const ct of changedTypes) {
        const costCodeIds: string[] = [];
        for (const code of masterCodes) {
          if (selectedSet.has(makeKey(code.id, ct.id))) {
            costCodeIds.push(code.id);
          }
        }
        await bulkSync.mutateAsync({ costTypeId: ct.id, costCodeIds });
      }

      // Create budget lines for any codes with amounts entered
      const budgetLineItems: {
        costCodeId: string;
        costTypeId: string;
        amount: number;
      }[] = [];

      for (const [key, amount] of amounts) {
        if (amount > 0 && selectedSet.has(key)) {
          const [costCodeId, costTypeId] = key.split("::") as [string, string];
          // Only create if this is new or amount changed
          if (!savedSet.has(key) || (savedAmounts.get(key) || 0) !== amount) {
            budgetLineItems.push({ costCodeId, costTypeId, amount });
          }
        }
      }

      if (budgetLineItems.length > 0) {
        await apiFetch(`/api/projects/${projectId}/budget`, {
          method: "POST",
          body: JSON.stringify({
            lineItems: budgetLineItems.map((item) => ({
              costCodeId: item.costCodeId,
              costType: item.costTypeId,
              amount: String(item.amount),
            })),
          }),
        });
      }

      // Update saved state
      setSavedSet(new Set(selectedSet));
      setSavedAmounts(new Map(amounts));

      const totalChanges = changedTypes.length + budgetLineItems.length;
      if (totalChanges > 0) {
        toast.success(
          budgetLineItems.length > 0
            ? `Cost codes saved — ${budgetLineItems.length} budget line${budgetLineItems.length !== 1 ? "s" : ""} created`
            : "Cost codes saved successfully",
        );
      }

      // Notify parent so the budget tab can refetch
      onSave?.();
    } catch (err) {
      if (err instanceof Error) {
        toast.error(err.message);
      }
    } finally {
      setIsSaving(false);
    }
  }, [masterCodes, costTypes, selectedSet, savedSet, amounts, savedAmounts, bulkSync, projectId, onSave]);

  // Group master codes by division
  const grouped = useMemo(() => {
    if (!masterCodes) return [];
    const groups: Record<string, CostCode[]> = {};
    for (const code of masterCodes) {
      const div = code.division_title || "No Division";
      if (!groups[div]) groups[div] = [];
      groups[div].push(code);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [masterCodes]);

  // Filter by search
  const filtered = useMemo(() => {
    if (!searchQuery) return grouped;
    const q = searchQuery.toLowerCase();
    return grouped
      .map(([division, codes]) => {
        const matchesDivision = division.toLowerCase().includes(q);
        if (matchesDivision) return [division, codes] as [string, CostCode[]];
        const matchedCodes = codes.filter(
          (c) =>
            c.id.toLowerCase().includes(q) ||
            c.title?.toLowerCase().includes(q),
        );
        return [division, matchedCodes] as [string, CostCode[]];
      })
      .filter(([, codes]) => codes.length > 0);
  }, [grouped, searchQuery]);

  // Count of unique codes selected (have at least one type)

  const isLoading = loadingCodes || loadingTypes || loadingProject;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!masterCodes || !costTypes.length) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Failed to load cost code data
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {/* eslint-disable-next-line design-system/no-raw-heading */}
          <h2 className="text-lg font-semibold text-foreground">
            Project Cost Codes
          </h2>
          <p className="text-sm text-muted-foreground">
            Select cost codes and assign cost types for this project&apos;s
            budget
          </p>
        </div>
        <div className="flex flex-1 items-center gap-3 sm:flex-none">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search codes or divisions…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-8"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1.5 h-7 w-7 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {/* Save */}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                Saving…
              </>
            ) : hasChanges ? (
              "Save Changes"
            ) : (
              <>
                <Check className="h-3.5 w-3.5 mr-1.5" />
                Saved
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="selected">Selected</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        {/* Selected tab */}
        <TabsContent value="selected" className="mt-4">
          <SelectedOverviewTab
            masterCodes={masterCodes}
            costTypes={costTypes}
            selectedSet={selectedSet}
            amounts={amounts}
          />
        </TabsContent>

        {/* All tab — table format with cost type columns */}
        <TabsContent value="all" className="mt-4">
          <div className="space-y-0.5">
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No cost codes found matching your search
              </div>
            ) : (
              filtered.map(([division, codes]) => (
                <AllDivisionGroup
                  key={division}
                  divisionTitle={division}
                  codes={codes}
                  costTypes={costTypes}
                  selectedSet={selectedSet}
                  amounts={amounts}
                  onToggleCode={toggleCode}
                  onToggleDivision={toggleDivision}
                  onAmountChange={handleAmountChange}
                />
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
