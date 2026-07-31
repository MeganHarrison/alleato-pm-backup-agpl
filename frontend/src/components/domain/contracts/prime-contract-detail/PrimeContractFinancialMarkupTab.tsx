"use client";

import { useState, useMemo, useEffect } from "react";
import {
  MoreVertical,
  Percent,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState, InlineAddButton } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  InlineTable,
  InlineTableHeader,
  InlineTableHeaderRow,
  InlineTableHeaderCell,
  InlineTableBody,
  InlineTableRow,
  InlineTableCell,
} from "@/components/ds/inline-table";
import { apiFetch } from "@/lib/api-client";
import { formatPercent } from "@/lib/format";
import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";
import { SectionRuleHeading } from "@/components/layout/spacing";
import { InfoBox } from "@/components/misc/info-box";
import type { BudgetCode, VerticalMarkup } from "@/app/(main)/[projectId]/prime-contracts/[contractId]/types";

const ALLOWED_MARKUP_TYPES = ["insurance", "bond", "fee", "overhead", "custom"] as const;

const normalizeVerticalMarkupRows = (rows: VerticalMarkup[]): VerticalMarkup[] =>
  rows.map((row) => ({
    ...row,
    markup_type: row.markup_type ?? "",
    percentage: Number.isFinite(Number(row.percentage))
      ? Number(row.percentage)
      : 0,
    compound: Boolean(row.compound),
    calculation_order: Number.isFinite(Number(row.calculation_order))
      ? Number(row.calculation_order)
      : 0,
  }));

const findDuplicateMarkupTypes = (rows: VerticalMarkup[]): string[] => {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const key = (row.markup_type ?? "").trim().toLowerCase();
    if (!key) return;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([key]) => key);
};

const getNextAvailableMarkupType = (rows: VerticalMarkup[]): string | null => {
  const used = new Set(
    rows.map((row) => (row.markup_type ?? "").trim().toLowerCase()),
  );
  for (const type of ALLOWED_MARKUP_TYPES) {
    if (!used.has(type)) return type;
  }
  return null;
};

const toMarkupLabel = (value: string): string =>
  value
    .split("_")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

interface PrimeContractFinancialMarkupTabProps {
  projectId: string;
  budgetCodes: BudgetCode[];
  verticalMarkups: VerticalMarkup[];
  setVerticalMarkups: React.Dispatch<React.SetStateAction<VerticalMarkup[]>>;
  savedVerticalMarkups: VerticalMarkup[];
  setSavedVerticalMarkups: React.Dispatch<React.SetStateAction<VerticalMarkup[]>>;
  markupsLoading: boolean;
  variant?: "full" | "compact";
}

export function PrimeContractFinancialMarkupTab({
  projectId,
  budgetCodes,
  verticalMarkups,
  setVerticalMarkups,
  savedVerticalMarkups,
  setSavedVerticalMarkups,
  markupsLoading,
  variant = "full",
}: PrimeContractFinancialMarkupTabProps) {
  const [isSavingMarkupTable, setIsSavingMarkupTable] = useState(false);
  const [isSubmittingMarkup, setIsSubmittingMarkup] = useState(false);
  const [deletingMarkupId, setDeletingMarkupId] = useState<string | null>(null);
  const [markupMapsToById, setMarkupMapsToById] = useState<Record<string, string>>({});
  const [savedMarkupMapsToById, setSavedMarkupMapsToById] = useState<Record<string, string>>({});
  const [markupDisplayById, setMarkupDisplayById] = useState<Record<string, "horizontal" | "vertical">>({});
  const [savedMarkupDisplayById, setSavedMarkupDisplayById] = useState<Record<string, "horizontal" | "vertical">>({});
  const [editingMarkupRowIds, setEditingMarkupRowIds] = useState<Record<string, boolean>>({});

  // Persisted preferences are saved only when the table is saved, matching the primary save flow.
  useEffect(() => {
    if (!projectId) return;
    const storageKey = `prime-contract-markup-maps:${projectId}`;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, string>;
      if (parsed && typeof parsed === "object") {
        setMarkupMapsToById(parsed);
        setSavedMarkupMapsToById(parsed);
      }
    } catch (error) {
      reportNonCriticalFailure({
        area: "prime-contract-financial-markup",
        operation: "load-markup-maps-preference",
        error,
        userVisibleFallback: "Saved markup mapping preferences could not be restored.",
        metadata: { projectId },
      });
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    const storageKey = `prime-contract-markup-display:${projectId}`;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, "horizontal" | "vertical">;
      if (parsed && typeof parsed === "object") {
        setMarkupDisplayById(parsed);
        setSavedMarkupDisplayById(parsed);
      }
    } catch (error) {
      reportNonCriticalFailure({
        area: "prime-contract-financial-markup",
        operation: "load-markup-display-preference",
        error,
        userVisibleFallback: "Saved markup display preferences could not be restored.",
        metadata: { projectId },
      });
    }
  }, [projectId]);

  // Save local-only markup preferences once the explicit table save succeeds.
  const persistMarkupPreferences = (
    nextMapsToById: Record<string, string>,
    nextDisplayById: Record<string, "horizontal" | "vertical">,
  ) => {
    if (!projectId) return;
    try {
      localStorage.setItem(
        `prime-contract-markup-maps:${projectId}`,
        JSON.stringify(nextMapsToById),
      );
      localStorage.setItem(
        `prime-contract-markup-display:${projectId}`,
        JSON.stringify(nextDisplayById),
      );
    } catch (error) {
      reportNonCriticalFailure({
        area: "prime-contract-financial-markup",
        operation: "save-markup-preferences",
        error,
        userVisibleFallback: "Markup preferences were not saved locally.",
        metadata: { projectId },
      });
    }
  };

  const hasUnsavedMarkupChanges = useMemo(() => {
    const normalize = (
      rows: VerticalMarkup[],
      mapsToById: Record<string, string>,
      displayById: Record<string, "horizontal" | "vertical">,
    ) =>
      [...rows]
        .sort((a, b) => a.calculation_order - b.calculation_order)
        .map((row) => ({
          id: row.id,
          markup_type: row.markup_type.trim(),
          percentage: Number(row.percentage),
          compound: Boolean(row.compound),
          maps_to_budget_code_id:
            mapsToById[row.id] ?? row.maps_to_budget_code_id ?? "all",
          display_in: displayById[row.id] ?? "vertical",
        }));
    return (
      JSON.stringify(normalize(verticalMarkups, markupMapsToById, markupDisplayById)) !==
      JSON.stringify(
        normalize(
          savedVerticalMarkups,
          savedMarkupMapsToById,
          savedMarkupDisplayById,
        ),
      )
    );
  }, [
    markupDisplayById,
    markupMapsToById,
    savedMarkupDisplayById,
    savedMarkupMapsToById,
    savedVerticalMarkups,
    verticalMarkups,
  ]);

  const sortedMarkups = useMemo(
    () => [...verticalMarkups].sort((a, b) => a.calculation_order - b.calculation_order),
    [verticalMarkups],
  );

  const handleDeleteMarkup = async (markupId: string) => {
    setDeletingMarkupId(markupId);
    try {
      await apiFetch(
        `/api/projects/${projectId}/vertical-markup?markupId=${markupId}`,
        { method: "DELETE" },
      );
      const nextMapsToById = Object.fromEntries(
        Object.entries(markupMapsToById).filter(([key]) => key !== markupId),
      );
      const nextDisplayById = Object.fromEntries(
        Object.entries(markupDisplayById).filter(([key]) => key !== markupId),
      ) as Record<string, "horizontal" | "vertical">;

      setVerticalMarkups((prev) => prev.filter((m) => m.id !== markupId));
      setSavedVerticalMarkups((prev) => prev.filter((m) => m.id !== markupId));
      setMarkupMapsToById(nextMapsToById);
      setSavedMarkupMapsToById(nextMapsToById);
      setMarkupDisplayById(nextDisplayById);
      setSavedMarkupDisplayById(nextDisplayById);
      setEditingMarkupRowIds((prev) => {
        const next = { ...prev };
        delete next[markupId];
        return next;
      });
      persistMarkupPreferences(nextMapsToById, nextDisplayById);
      toast.success("Markup deleted");
    } catch (err) {
      console.error("Failed to delete markup:", err);
      toast.error("Failed to delete markup. Please try again.");
    } finally {
      setDeletingMarkupId(null);
    }
  };

  const handleAddMarkupInline = async () => {
    setIsSubmittingMarkup(true);
    const nextMarkupType = getNextAvailableMarkupType(verticalMarkups);
    if (!nextMarkupType) {
      setIsSubmittingMarkup(false);
      toast.error("All available markup types are already added.");
      return;
    }
    try {
      const data = await apiFetch<{ data: VerticalMarkup }>(`/api/projects/${projectId}/vertical-markup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          markup_type: nextMarkupType,
          percentage: 0,
          compound: false,
        }),
      });
      const newMarkup: VerticalMarkup = data.data;
      setVerticalMarkups((prev) => [...prev, newMarkup]);
      setSavedVerticalMarkups((prev) => [...prev, newMarkup]);
      setEditingMarkupRowIds((prev) => ({ ...prev, [newMarkup.id]: true }));
      toast.success("Markup row added");
    } catch (err) {
      console.error("Failed to add markup:", err);
      toast.error("Failed to add markup. Please try again.");
    } finally {
      setIsSubmittingMarkup(false);
    }
  };

  const handleStartMarkupRowEdit = (markup: VerticalMarkup) => {
    setEditingMarkupRowIds((prev) => ({ ...prev, [markup.id]: true }));
  };

  // Exit edit mode while keeping draft changes; the top-level Save Changes button commits them.
  const handleFinishMarkupRowEdit = (markupId: string) => {
    setEditingMarkupRowIds((prev) => {
      const next = { ...prev };
      delete next[markupId];
      return next;
    });
  };

  // Apply an inline row edit to the working draft so the top-level save is the only commit step.
  const handleMarkupFieldChange = <K extends keyof Pick<VerticalMarkup, "markup_type" | "percentage" | "compound">>(
    markupId: string,
    field: K,
    value: VerticalMarkup[K],
  ) => {
    setVerticalMarkups((prev) =>
      prev.map((row) =>
        row.id === markupId
          ? {
              ...row,
              [field]: value,
            }
          : row,
      ),
    );
  };

  const handleSaveMarkupTable = async () => {
    const markupsToPersist = [...verticalMarkups]
      .sort((a, b) => a.calculation_order - b.calculation_order)
      .map((markup, index) => ({
        ...markup,
        markup_type: markup.markup_type.trim(),
        percentage: Number(markup.percentage),
        calculation_order: index + 1,
        maps_to_budget_code_id:
          markupMapsToById[markup.id] && markupMapsToById[markup.id] !== "all"
            ? markupMapsToById[markup.id]
            : null,
      }));

    if (markupsToPersist.some((markup) => !markup.markup_type)) {
      toast.error("Each markup row needs a name");
      return;
    }

    const duplicateMarkupTypes = findDuplicateMarkupTypes(markupsToPersist);
    if (duplicateMarkupTypes.length > 0) {
      toast.error(
        `Markup names must be unique. Duplicate: ${duplicateMarkupTypes
          .map((name) => `"${name}"`)
          .join(", ")}`,
      );
      return;
    }

    if (
      markupsToPersist.some(
        (markup) =>
          Number.isNaN(markup.percentage) ||
          markup.percentage < 0 ||
          markup.percentage > 100,
      )
    ) {
      toast.error("Percentages must be between 0 and 100");
      return;
    }

    setIsSavingMarkupTable(true);
    try {
      const data = await apiFetch<{ markups?: VerticalMarkup[] }>(`/api/projects/${projectId}/vertical-markup`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markups: markupsToPersist }),
      });
      const updatedMarkups: VerticalMarkup[] = normalizeVerticalMarkupRows(
        data.markups || [],
      );
      setVerticalMarkups(updatedMarkups);
      setSavedVerticalMarkups(updatedMarkups);
      setSavedMarkupMapsToById({ ...markupMapsToById });
      setSavedMarkupDisplayById({ ...markupDisplayById });
      setEditingMarkupRowIds({});
      persistMarkupPreferences(markupMapsToById, markupDisplayById);
      toast.success("Markup changes saved");
    } catch (err) {
      console.error("Failed to save markup table:", err);
      toast.error("Failed to save markup changes. Please try again.");
    } finally {
      setIsSavingMarkupTable(false);
    }
  };

  // Shared field renderers — consumed by both the mobile card view and the desktop table view.
  // Keeping field logic here once ensures both layouts stay in sync automatically.
  const renderMarkupTypeField = (markup: VerticalMarkup, isEditing: boolean) =>
    isEditing ? (
      <Select
        value={markup.markup_type}
        onValueChange={(v) => handleMarkupFieldChange(markup.id, "markup_type", v)}
      >
        <SelectTrigger size="sm" className="w-full text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ALLOWED_MARKUP_TYPES.map((type) => (
            <SelectItem key={type} value={type} className="capitalize">
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    ) : (
      <span className="text-sm capitalize text-foreground">{markup.markup_type}</span>
    );

  const renderDisplayInField = (
    markup: VerticalMarkup,
    isEditing: boolean,
    displayIn: "horizontal" | "vertical",
  ) =>
    isEditing ? (
      <Select
        value={displayIn}
        onValueChange={(v) =>
          setMarkupDisplayById((prev) => ({
            ...prev,
            [markup.id]: v as "horizontal" | "vertical",
          }))
        }
      >
        <SelectTrigger size="sm" className="w-full text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="horizontal">Horizontal</SelectItem>
          <SelectItem value="vertical">Vertical</SelectItem>
        </SelectContent>
      </Select>
    ) : (
      <span className="text-sm capitalize text-foreground">{displayIn}</span>
    );

  const renderMapsToField = (
    markup: VerticalMarkup,
    isEditing: boolean,
    mapsTo: string,
    mapsToLabel: string,
  ) =>
    isEditing ? (
      <Select
        value={mapsTo}
        onValueChange={(v) =>
          setMarkupMapsToById((prev) => ({ ...prev, [markup.id]: v }))
        }
      >
        <SelectTrigger size="sm" className="w-full text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Budget Codes</SelectItem>
          {budgetCodes.map((code) => (
            <SelectItem key={code.id} value={code.id}>
              {code.fullLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    ) : (
      <span className="text-sm text-foreground">{mapsToLabel}</span>
    );

  const renderPercentageField = (markup: VerticalMarkup, isEditing: boolean) =>
    isEditing ? (
      <Input
        type="number"
        min="0"
        max="100"
        step="0.001"
        value={String(markup.percentage)}
        onChange={(e) =>
          handleMarkupFieldChange(markup.id, "percentage", Number(e.target.value || 0))
        }
        className="h-8 text-right"
      />
    ) : (
      <span className="text-sm text-foreground">{formatPercent(markup.percentage, 2)}</span>
    );

  const renderCalcTypeField = (markup: VerticalMarkup, isEditing: boolean) =>
    isEditing ? (
      <Select
        value={markup.compound ? "compound" : "basic"}
        onValueChange={(v) =>
          handleMarkupFieldChange(markup.id, "compound", v === "compound")
        }
      >
        <SelectTrigger size="sm" className="w-full text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="basic">Basic Calculation</SelectItem>
          <SelectItem value="compound">Compounds All Above</SelectItem>
        </SelectContent>
      </Select>
    ) : (
      <span className="text-sm text-foreground">
        {markup.compound ? "Compounds All Above" : "Basic Calculation"}
      </span>
    );

  const renderActionsMenu = (markup: VerticalMarkup, isEditing: boolean) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Open actions for ${markup.markup_type}`}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {isEditing ? (
          <DropdownMenuItem onClick={() => handleFinishMarkupRowEdit(markup.id)}>
            Done editing
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => handleStartMarkupRowEdit(markup)}>
            Edit
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => handleDeleteMarkup(markup.id)}
          disabled={deletingMarkupId === markup.id}
        >
          {deletingMarkupId === markup.id ? "Deleting..." : "Delete"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className={variant === "compact" ? "space-y-4" : "space-y-6"}>
      {variant === "compact" ? (
        <div className="flex items-center justify-between gap-4">
          <SectionRuleHeading label="Financial Markup" className="mb-0" />
          <div className="flex shrink-0 items-center gap-3">
            {hasUnsavedMarkupChanges ? (
              <Button
                size="sm"
                onClick={handleSaveMarkupTable}
                disabled={isSavingMarkupTable}
              >
                {isSavingMarkupTable ? "Saving..." : "Save Changes"}
              </Button>
            ) : null}
            <InlineAddButton
              onClick={handleAddMarkupInline}
              disabled={isSubmittingMarkup}
            >
              {isSubmittingMarkup ? "Adding..." : "Add Markup"}
            </InlineAddButton>
          </div>
        </div>
      ) : (
        <SectionRuleHeading label="Financial Markup" />
      )}
      {variant === "full" ? (
        <>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Add percentage-based markups (e.g., tax, overhead, profit, insurance) to contract values.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <InfoBox
              icon={<Percent className="h-4 w-4 text-muted-foreground" />}
              title="Vertical Markup"
              className="p-4"
            >
              <div className="space-y-2 text-sm leading-6 text-muted-foreground">
                <p>
                  Adds markup as a separate calculation layer. Rules run top to bottom, so row order directly changes results.
                </p>
                <p>
                  Use <span className="font-medium text-foreground">Maps To</span> to target all budget codes or one code.
                </p>
                <p>
                  <span className="font-medium text-foreground">Calculation Type:</span> Basic uses the base amount. Compound includes prior markup rows above it.
                </p>
              </div>
            </InfoBox>
            <InfoBox
              icon={<Percent className="h-4 w-4 text-muted-foreground" />}
              title="Horizontal Markup"
              className="p-4"
            >
              <div className="space-y-2 text-sm leading-6 text-muted-foreground">
                <p>
                  Pushes markup into line-item values instead of presenting a separate markup row in outputs.
                </p>
                <p>
                  Use horizontal display when markup should be distributed across scoped costs for reporting.
                </p>
                <p>
                  Keep display type consistent across related rules to avoid mixed output behavior.
                </p>
              </div>
            </InfoBox>
          </div>
        </>
      ) : null}

        {markupsLoading ? (
          <p className="py-10 text-sm text-muted-foreground">Loading markup settings...</p>
        ) : verticalMarkups.length === 0 ? (
          <EmptyState
            icon={<Percent />}
            title="No financial markups configured"
            description="Add your first markup to define fees, overhead, insurance, or profit calculations."
            action={variant === "full" ? (
              <InlineAddButton
                onClick={handleAddMarkupInline}
                disabled={isSubmittingMarkup}
              >
                {isSubmittingMarkup ? "Adding..." : "Add Markup"}
              </InlineAddButton>
            ) : undefined}
          />
        ) : (
          <>
            {variant === "full" ? (
              <div className="flex flex-col gap-3 border-y border-border/60 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center justify-between text-xs text-muted-foreground sm:gap-6">
                  <span>{sortedMarkups.length} markup rule{sortedMarkups.length === 1 ? "" : "s"}</span>
                  <span>Applied in top-to-bottom calculation order</span>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                  {hasUnsavedMarkupChanges ? (
                    <Button
                      size="sm"
                      onClick={handleSaveMarkupTable}
                      disabled={isSavingMarkupTable}
                      className="w-full sm:w-auto"
                    >
                      {isSavingMarkupTable ? "Saving..." : "Save Changes"}
                    </Button>
                  ) : null}
                  <InlineAddButton
                    onClick={handleAddMarkupInline}
                    disabled={isSubmittingMarkup}
                  >
                    {isSubmittingMarkup ? "Adding..." : "Add Markup"}
                  </InlineAddButton>
                </div>
              </div>
            ) : null}

            {/* Mobile card view */}
            <div className="space-y-3 md:hidden">
              {sortedMarkups.map((markup, index) => {
                const isEditingRow = Boolean(editingMarkupRowIds[markup.id]);
                const displayIn = markupDisplayById[markup.id] ?? "vertical";
                const mapsTo = markupMapsToById[markup.id] ?? "all";
                const mapsToLabel =
                  mapsTo === "all"
                    ? "All Budget Codes"
                    : budgetCodes.find((code) => code.id === mapsTo)?.fullLabel ?? "All Budget Codes";

                return (
                  <div key={markup.id} className="space-y-3 rounded-md border border-border/60 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Markup {index + 1}</p>
                        {isEditingRow ? renderMarkupTypeField(markup, isEditingRow) : (
                          <span className="text-sm text-foreground">{toMarkupLabel(markup.markup_type)}</span>
                        )}
                      </div>
                      {renderActionsMenu(markup, isEditingRow)}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Display In</p>
                        {renderDisplayInField(markup, isEditingRow, displayIn)}
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Percent</p>
                        {renderPercentageField(markup, isEditingRow)}
                      </div>
                      <div className="col-span-2 space-y-1">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Maps To</p>
                        {renderMapsToField(markup, isEditingRow, mapsTo, mapsToLabel)}
                      </div>
                      <div className="col-span-2 space-y-1">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Calculation Type</p>
                        {renderCalcTypeField(markup, isEditingRow)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop table view */}
            <div className="hidden md:block">
              <InlineTable variant="edit">
                <InlineTableHeader>
                  <InlineTableHeaderRow>
                    <InlineTableHeaderCell align="right">#</InlineTableHeaderCell>
                    <InlineTableHeaderCell>Markup Name</InlineTableHeaderCell>
                    <InlineTableHeaderCell>Display In</InlineTableHeaderCell>
                    <InlineTableHeaderCell>Maps To</InlineTableHeaderCell>
                    <InlineTableHeaderCell align="right" className="w-24">%</InlineTableHeaderCell>
                    <InlineTableHeaderCell>Calculation Type</InlineTableHeaderCell>
                    <InlineTableHeaderCell align="right">Actions</InlineTableHeaderCell>
                  </InlineTableHeaderRow>
                </InlineTableHeader>
                <InlineTableBody className="[&_tr:last-child]:border-b-0">
                  {sortedMarkups.map((markup, index) => {
                    const isEditingRow = Boolean(editingMarkupRowIds[markup.id]);
                    const displayIn = markupDisplayById[markup.id] ?? "vertical";
                    const mapsTo = markupMapsToById[markup.id] ?? "all";
                    const mapsToLabel =
                      mapsTo === "all"
                        ? "All Budget Codes"
                        : budgetCodes.find((code) => code.id === mapsTo)?.fullLabel ?? "All Budget Codes";

                    return (
                      <InlineTableRow key={markup.id}>
                        <InlineTableCell align="right">{index + 1}</InlineTableCell>
                        <InlineTableCell>
                          {isEditingRow ? renderMarkupTypeField(markup, isEditingRow) : (
                            <span className="text-sm text-foreground">{toMarkupLabel(markup.markup_type)}</span>
                          )}
                        </InlineTableCell>
                        <InlineTableCell>{renderDisplayInField(markup, isEditingRow, displayIn)}</InlineTableCell>
                        <InlineTableCell>{renderMapsToField(markup, isEditingRow, mapsTo, mapsToLabel)}</InlineTableCell>
                        <InlineTableCell align="right" numeric>{renderPercentageField(markup, isEditingRow)}</InlineTableCell>
                        <InlineTableCell>{renderCalcTypeField(markup, isEditingRow)}</InlineTableCell>
                        <InlineTableCell align="right">{renderActionsMenu(markup, isEditingRow)}</InlineTableCell>
                      </InlineTableRow>
                    );
                  })}
                </InlineTableBody>
              </InlineTable>
            </div>
          </>
        )}
    </div>
  );
}
