"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";

import { EmptyState, NumberInput, StatusBadge } from "@/components/ds";
import { DateField } from "@/components/forms/DateField";
import { PageScaffold, SectionRuleHeading } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useCrmWorkspace } from "@/hooks/use-crm";
import { apiFetch } from "@/lib/api-client";
import type {
  CrmAiArtifact,
  CrmDeal,
  CrmOperatingSystem,
  CrmRelationshipIntelligence,
} from "@/lib/crm/types";
import { formatCurrency, formatDate } from "@/lib/format";

import { buildCrmWorkspaceTabs } from "./crm-workspace-tabs";
import { CRM_WORKSPACE_PAGE_VARIANT } from "./crm-workspace-layout";

const EMPTY_OPERATING_SYSTEM: CrmOperatingSystem = {
  connection: {
    personId: "",
    connectionStatus: "consent_required",
    mailConnected: false,
    calendarConnected: false,
    grantedScopes: [],
    privacyMode: "business_only",
    automaticMatchingEnabled: false,
    lastSuccessfulSyncAt: null,
    lastError: null,
    updatedAt: new Date(0).toISOString(),
  },
  forecastSnapshots: [],
  stageRequirements: [],
  salesAssets: [],
  relationshipIntelligence: [],
  aiArtifacts: [],
};

type TargetValue = `company:${string}` | `lead:${string}`;

function targetPayload(target: TargetValue) {
  const [type, id] = target.split(":");
  return type === "company"
    ? { company_id: id, lead_id: null }
    : { company_id: null, lead_id: id };
}

function titleCase(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function crmDealControlValues(deal: CrmDeal) {
  return {
    forecastCategory: deal.forecastCategory ?? ("pipeline" as const),
    pursuitType: deal.pursuitType ?? ("negotiated" as const),
    bidDueDate: deal.bidDueDate?.slice(0, 10) ?? "",
    qualificationScore: deal.qualificationScore ?? 50,
    winLossNotes: deal.winLossNotes ?? "",
  };
}

export function parseBuildingConnectedCsv(csv: string) {
  if (csv.length > 50_000) {
    throw new Error("CSV intake is limited to 50,000 characters.");
  }

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (quoted && character === '"' && csv[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && csv[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
    if (cell.length > 500) {
      throw new Error("Each CSV field is limited to 500 characters.");
    }
  }
  if (quoted) throw new Error("The CSV contains an unclosed quoted field.");
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.some((candidate) => candidate.length > 20)) {
    throw new Error("CSV intake is limited to 20 columns.");
  }
  if (rows.length === 0)
    return { header: [] as string[], dataRows: [] as string[][] };

  const [first, ...remaining] = rows;
  const knownHeaders = new Set([
    "company",
    "company_name",
    "contact",
    "contact_name",
    "trade",
    "email",
  ]);
  const hasHeader = first.some((value) =>
    knownHeaders.has(value.trim().toLowerCase().replace(/\W+/g, "_")),
  );
  const header = hasHeader ? first : ["company", "contact", "trade", "email"];
  const dataRows = hasHeader ? remaining : rows;
  if (dataRows.length > 100) {
    throw new Error(
      "CSV intake is limited to 100 subcontractor rows at a time.",
    );
  }
  return { header, dataRows };
}

export function CrmGrowthWorkspace() {
  const pathname = usePathname();
  const crm = useCrmWorkspace();
  const [operating, setOperating] = React.useState(EMPTY_OPERATING_SYSTEM);
  const [loading, setLoading] = React.useState(true);
  const [operationError, setOperationError] = React.useState<string | null>(
    null,
  );
  const [privacyMode, setPrivacyMode] =
    React.useState<CrmOperatingSystem["connection"]["privacyMode"]>(
      "business_only",
    );
  const [automaticMatching, setAutomaticMatching] = React.useState(false);

  const [selectedDealId, setSelectedDealId] = React.useState("");
  const [forecastCategory, setForecastCategory] = React.useState<
    "pipeline" | "best_case" | "commit" | "omitted"
  >("pipeline");
  const [pursuitType, setPursuitType] = React.useState<
    "negotiated" | "invited_bid" | "public_bid" | "service" | "other"
  >("negotiated");
  const [bidDueDate, setBidDueDate] = React.useState("");
  const [qualificationScore, setQualificationScore] = React.useState(50);
  const [winLossNotes, setWinLossNotes] = React.useState("");

  const [requirementStageId, setRequirementStageId] = React.useState("");
  const [requirementLabel, setRequirementLabel] = React.useState("");
  const [requirementKey, setRequirementKey] = React.useState("");
  const [requirementGuidance, setRequirementGuidance] = React.useState("");

  const [assetType, setAssetType] = React.useState<
    "cadence" | "playbook" | "email_template" | "meeting_template"
  >("cadence");
  const [assetName, setAssetName] = React.useState("");
  const [assetDescription, setAssetDescription] = React.useState("");
  const [assetSteps, setAssetSteps] = React.useState("");

  const firstTarget = crm.accounts[0]
    ? (`company:${crm.accounts[0].companyId}` as TargetValue)
    : crm.leads[0]
      ? (`lead:${crm.leads[0].id}` as TargetValue)
      : null;
  const [intelligenceTarget, setIntelligenceTarget] = React.useState<
    TargetValue | ""
  >("");
  const [intelligenceType, setIntelligenceType] =
    React.useState<CrmRelationshipIntelligence["intelligenceType"]>(
      "account_plan",
    );
  const [intelligenceTitle, setIntelligenceTitle] = React.useState("");
  const [intelligenceDetails, setIntelligenceDetails] = React.useState("");
  const [buildingConnectedCsv, setBuildingConnectedCsv] = React.useState("");

  const [assistantDealId, setAssistantDealId] = React.useState("");
  const [assistantType, setAssistantType] =
    React.useState<CrmAiArtifact["artifactType"]>("meeting_prep");
  const [assistantPrompt, setAssistantPrompt] = React.useState("");

  const loadOperatingSystem = React.useCallback(async () => {
    setLoading(true);
    setOperationError(null);
    try {
      const result = await apiFetch<{ data: CrmOperatingSystem }>(
        "/api/crm/operating-system/workspace",
        { cache: "no-store" },
      );
      setOperating(result.data);
      setPrivacyMode(result.data.connection.privacyMode);
      setAutomaticMatching(result.data.connection.automaticMatchingEnabled);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "CRM growth tools could not be loaded.";
      setOperationError(message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadOperatingSystem().catch(() => undefined);
  }, [loadOperatingSystem]);

  React.useEffect(() => {
    if (!intelligenceTarget && firstTarget) {
      setIntelligenceTarget(firstTarget);
    }
    if (!selectedDealId && crm.deals[0]) setSelectedDealId(crm.deals[0].id);
    if (!assistantDealId && crm.deals[0]) setAssistantDealId(crm.deals[0].id);
    if (!requirementStageId && crm.stages[0]) {
      setRequirementStageId(crm.stages[0].id);
    }
  }, [
    assistantDealId,
    crm.deals,
    crm.stages,
    firstTarget,
    intelligenceTarget,
    requirementStageId,
    selectedDealId,
  ]);

  React.useEffect(() => {
    const deal = crm.deals.find((candidate) => candidate.id === selectedDealId);
    if (!deal) return;
    const values = crmDealControlValues(deal);
    setForecastCategory(values.forecastCategory);
    setPursuitType(values.pursuitType);
    setBidDueDate(values.bidDueDate);
    setQualificationScore(values.qualificationScore);
    setWinLossNotes(values.winLossNotes);
  }, [crm.deals, selectedDealId]);

  const execute = React.useCallback(
    async (
      body: Record<string, unknown>,
      success: string,
    ): Promise<boolean> => {
      try {
        await apiFetch("/api/crm/operating-system/workspace", {
          method: "POST",
          body: JSON.stringify(body),
        });
      } catch (error) {
        toast.error("CRM operation failed", {
          description:
            error instanceof Error ? error.message : "Refresh and try again.",
        });
        return false;
      }
      toast.success(success);
      try {
        await Promise.all([loadOperatingSystem(), crm.refresh()]);
      } catch {
        toast.warning("Saved, but the latest data could not be reloaded.", {
          description: "Use Refresh to load the committed change.",
        });
      }
      return true;
    },
    [crm, loadOperatingSystem],
  );

  const saveDealControls = async () => {
    if (!selectedDealId) return;
    await execute(
      {
        operation: "save_deal_controls",
        deal_id: selectedDealId,
        forecast_category: forecastCategory,
        pursuit_type: pursuitType,
        bid_due_date: bidDueDate
          ? new Date(`${bidDueDate}T17:00:00`).toISOString()
          : null,
        qualification_score: qualificationScore,
        win_loss_notes: winLossNotes.trim() || null,
      },
      "Deal controls saved",
    );
  };

  const saveSalesAsset = async () => {
    const steps = assetSteps
      .split("\n")
      .map((title, index) => ({
        day: index * 2,
        type: "task",
        title: title.trim(),
      }))
      .filter((step) => step.title);
    if (!assetName.trim() || steps.length === 0) {
      toast.error("Name the asset and add at least one step.");
      return;
    }
    const saved = await execute(
      {
        operation: "save_sales_asset",
        asset_type: assetType,
        name: assetName.trim(),
        description: assetDescription.trim() || null,
        steps,
        submit_for_review: true,
      },
      "Sales asset submitted for review",
    );
    if (!saved) return;
    setAssetName("");
    setAssetDescription("");
    setAssetSteps("");
  };

  const saveIntelligence = async () => {
    if (!intelligenceTarget || !intelligenceTitle.trim()) {
      toast.error("Choose a relationship and enter a title.");
      return;
    }
    const saved = await execute(
      {
        operation: "save_relationship_intelligence",
        ...targetPayload(intelligenceTarget),
        intelligence_type: intelligenceType,
        title: intelligenceTitle.trim(),
        status:
          intelligenceType === "duplicate_candidate"
            ? "needs_review"
            : "active",
        details: { notes: intelligenceDetails.trim() },
        source_system: "manual",
        source_reference: null,
      },
      "Relationship intelligence saved",
    );
    if (!saved) return;
    setIntelligenceTitle("");
    setIntelligenceDetails("");
  };

  const importBuildingConnected = async () => {
    if (!intelligenceTarget) {
      toast.error("Choose the relationship receiving this import.");
      return;
    }
    try {
      const { header, dataRows } =
        parseBuildingConnectedCsv(buildingConnectedCsv);
      if (dataRows.length === 0) {
        toast.error("Paste at least one CSV data row.");
        return;
      }
      const saved = await execute(
        {
          operation: "save_relationship_intelligence_batch",
          ...targetPayload(intelligenceTarget),
          records: dataRows.map((row) => ({
            title: row[0] || "BuildingConnected subcontractor",
            details: Object.fromEntries(
              header.map((key, index) => [
                key.toLowerCase().replace(/\W+/g, "_"),
                row[index] ?? "",
              ]),
            ),
            source_reference: "manual CSV paste",
          })),
        },
        `${dataRows.length} subcontractor rows queued for review`,
      );
      if (!saved) return;
      setBuildingConnectedCsv("");
    } catch (error) {
      toast.error("BuildingConnected CSV could not be queued", {
        description:
          error instanceof Error ? error.message : "Check the CSV and retry.",
      });
    }
  };

  const saveAssistantDraft = async () => {
    const deal = crm.deals.find(
      (candidate) => candidate.id === assistantDealId,
    );
    if (!deal) {
      toast.error("Choose a deal for the assistant.");
      return;
    }
    const relatedActivities = crm.activities
      .filter((activity) => activity.dealId === deal.id)
      .slice(0, 5);
    const relatedTasks = crm.followUps
      .filter((task) => task.dealId === deal.id)
      .slice(0, 5);
    const content = [
      `${deal.name} is ${formatCurrency(deal.valueEstimate)} at ${deal.probability}% probability.`,
      `Forecast category: ${titleCase(deal.forecastCategory ?? "pipeline")}. Expected close: ${
        deal.expectedCloseDate ? formatDate(deal.expectedCloseDate) : "not set"
      }.`,
      relatedActivities.length
        ? `Recent evidence: ${relatedActivities.map((item) => item.subject).join("; ")}.`
        : "No linked communication evidence is available.",
      relatedTasks.length
        ? `Open actions: ${relatedTasks.map((item) => `${item.title} (${item.dueDate})`).join("; ")}.`
        : "No next action is scheduled; create one in CRM Actions.",
      assistantPrompt.trim()
        ? `Requested focus: ${assistantPrompt.trim()}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    const citations = [
      {
        type: "deal",
        id: deal.id,
        label: deal.name,
        href: `/crm/deals/${deal.id}`,
      },
      ...relatedActivities.map((activity) => ({
        type: "activity",
        id: activity.id,
        label: activity.subject,
        href: "/crm/activities",
      })),
      ...relatedTasks.map((task) => ({
        type: "task",
        id: task.id,
        label: task.title,
        href: "/crm/tasks",
      })),
    ];
    await execute(
      {
        operation: "save_ai_artifact",
        artifact_type: assistantType,
        company_id: deal.companyId,
        lead_id: deal.leadId ?? null,
        deal_id: deal.id,
        title: `${titleCase(assistantType)} - ${deal.name}`,
        content,
        citations,
        explanation:
          "Generated only from CRM records visible to the signed-in user. Review is required before applying tasks or using a follow-up draft.",
      },
      "Assistant draft saved for review",
    );
  };

  const selectedDeal = crm.deals.find((deal) => deal.id === selectedDealId);
  const latestSnapshots = operating.forecastSnapshots.slice(0, 8);
  const pendingAssets = operating.salesAssets.filter(
    (asset) => asset.approvalStatus === "pending_review",
  );

  return (
    <PageScaffold
      layout="single"
      variant={CRM_WORKSPACE_PAGE_VARIANT}
      title="CRM growth workspace"
      description="Microsoft readiness, forecasts, repeatable selling, construction relationships, and governed AI"
      tabs={buildCrmWorkspaceTabs(pathname)}
      actions={
        <Button variant="outline" onClick={() => void loadOperatingSystem()}>
          Refresh
        </Button>
      }
    >
      {operationError ? (
        <EmptyState
          title="Growth tools could not be loaded"
          description={`${operationError} Reload after the database release is complete.`}
        />
      ) : null}

      <section>
        <SectionRuleHeading label="Microsoft 365 connection" />
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="border-y border-border py-5">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge
                status={titleCase(operating.connection.connectionStatus)}
              />
              <span className="text-sm text-muted-foreground">
                Mail {operating.connection.mailConnected ? "connected" : "off"}{" "}
                · Calendar{" "}
                {operating.connection.calendarConnected ? "connected" : "off"}
              </span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {operating.connection.lastError ??
                "Connection healthy. Sync status is separate from imported activity."}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              CRM never treats existing Outlook activity as proof that your
              mailbox is connected.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Privacy mode</Label>
              <Select
                value={privacyMode}
                onValueChange={(value) =>
                  setPrivacyMode(
                    value as CrmOperatingSystem["connection"]["privacyMode"],
                  )
                }
              >
                <SelectTrigger aria-label="Microsoft privacy mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="business_only">Business only</SelectItem>
                  <SelectItem value="selected_folders">
                    Selected folders
                  </SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-4 border-b border-border py-2">
              <div>
                <Label htmlFor="crm-automatic-matching">
                  Automatic matching
                </Label>
                <p className="text-xs text-muted-foreground">
                  Enabled only after a healthy connection.
                </p>
              </div>
              <Switch
                id="crm-automatic-matching"
                checked={automaticMatching}
                disabled={operating.connection.connectionStatus !== "connected"}
                onCheckedChange={setAutomaticMatching}
              />
            </div>
            <Button
              className="sm:col-span-2 sm:justify-self-start"
              onClick={() =>
                void execute(
                  {
                    operation: "save_connection_preferences",
                    privacy_mode: privacyMode,
                    automatic_matching_enabled: automaticMatching,
                  },
                  "Microsoft privacy preferences saved",
                )
              }
            >
              Save privacy preferences
            </Button>
          </div>
        </div>
      </section>

      <section>
        <SectionRuleHeading label="Forecast and pursuit controls" />
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Deal</Label>
              <Select value={selectedDealId} onValueChange={setSelectedDealId}>
                <SelectTrigger aria-label="Forecast deal">
                  <SelectValue placeholder="Choose a deal" />
                </SelectTrigger>
                <SelectContent>
                  {crm.deals.map((deal) => (
                    <SelectItem key={deal.id} value={deal.id}>
                      {deal.name} · {formatCurrency(deal.valueEstimate)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Forecast category</Label>
              <Select
                value={forecastCategory}
                onValueChange={(value) =>
                  setForecastCategory(
                    value as "pipeline" | "best_case" | "commit" | "omitted",
                  )
                }
              >
                <SelectTrigger aria-label="Forecast category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["pipeline", "best_case", "commit", "omitted"].map(
                    (value) => (
                      <SelectItem key={value} value={value}>
                        {titleCase(value)}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Pursuit type</Label>
              <Select
                value={pursuitType}
                onValueChange={(value) =>
                  setPursuitType(
                    value as
                      | "negotiated"
                      | "invited_bid"
                      | "public_bid"
                      | "service"
                      | "other",
                  )
                }
              >
                <SelectTrigger aria-label="Pursuit type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "negotiated",
                    "invited_bid",
                    "public_bid",
                    "service",
                    "other",
                  ].map((value) => (
                    <SelectItem key={value} value={value}>
                      {titleCase(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DateField
              label="Bid due date"
              value={
                bidDueDate ? new Date(`${bidDueDate}T12:00:00`) : undefined
              }
              onChange={(date) =>
                setBidDueDate(date ? date.toISOString().slice(0, 10) : "")
              }
              fullWidth
            />
            <div className="space-y-2">
              <Label htmlFor="crm-qualification-score">
                Qualification score
              </Label>
              <NumberInput
                id="crm-qualification-score"
                min={0}
                max={100}
                decimals={0}
                value={qualificationScore}
                onChange={(event) =>
                  setQualificationScore(Number(event.target.value))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="crm-win-loss-notes">Win/loss learning</Label>
              <Textarea
                id="crm-win-loss-notes"
                placeholder="Decision criteria, competitive context, outcome, and lesson learned"
                value={winLossNotes}
                onChange={(event) => setWinLossNotes(event.target.value)}
              />
            </div>
            <Button
              disabled={!selectedDeal}
              onClick={() => void saveDealControls()}
            >
              Save deal controls
            </Button>
          </div>
          <div>
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-medium">Weekly snapshots</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  void execute(
                    { operation: "capture_forecast" },
                    "Weekly forecast captured",
                  )
                }
              >
                Capture now
              </Button>
            </div>
            {latestSnapshots.length ? (
              <ul className="mt-3 divide-y divide-border border-y border-border">
                {latestSnapshots.map((snapshot) => (
                  <li
                    key={snapshot.id}
                    className="flex items-center justify-between gap-4 py-3 text-sm"
                  >
                    <span>
                      <span className="font-medium">
                        {titleCase(snapshot.category)}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        Week of {formatDate(snapshot.snapshotWeek)} ·{" "}
                        {snapshot.dealCount} deals
                      </span>
                    </span>
                    <span>{formatCurrency(snapshot.totalValue)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No weekly snapshot yet"
                description="Capture the current pipeline to create the management baseline."
              />
            )}
          </div>
        </div>
      </section>

      <section>
        <SectionRuleHeading label="Stage exit criteria" />
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <ul className="divide-y divide-border border-y border-border">
            {operating.stageRequirements.map((requirement) => (
              <li key={requirement.id} className="py-3 text-sm">
                <span className="font-medium">{requirement.label}</span>
                <span className="block text-xs text-muted-foreground">
                  {crm.stages.find((stage) => stage.id === requirement.stageId)
                    ?.name ?? "Archived stage"}{" "}
                  · {requirement.guidance ?? requirement.requirementKey}
                </span>
              </li>
            ))}
          </ul>
          <div className="grid gap-3">
            <Select
              value={requirementStageId}
              onValueChange={setRequirementStageId}
            >
              <SelectTrigger aria-label="Requirement stage">
                <SelectValue placeholder="Choose stage" />
              </SelectTrigger>
              <SelectContent>
                {crm.stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              aria-label="Requirement label"
              placeholder="Requirement label"
              value={requirementLabel}
              onChange={(event) => setRequirementLabel(event.target.value)}
            />
            <Input
              aria-label="Requirement key"
              placeholder="requirement_key"
              value={requirementKey}
              onChange={(event) =>
                setRequirementKey(
                  event.target.value.toLowerCase().replace(/\W+/g, "_"),
                )
              }
            />
            <Input
              aria-label="Requirement guidance"
              placeholder="Guidance shown to the deal owner"
              value={requirementGuidance}
              onChange={(event) => setRequirementGuidance(event.target.value)}
            />
            <Button
              onClick={() =>
                void execute(
                  {
                    operation: "save_stage_requirement",
                    stage_id: requirementStageId,
                    label: requirementLabel,
                    requirement_key: requirementKey,
                    guidance: requirementGuidance || null,
                    is_required: true,
                  },
                  "Stage requirement saved",
                )
              }
            >
              Add requirement
            </Button>
          </div>
        </div>
      </section>

      <section>
        <SectionRuleHeading label="Cadences, playbooks, and approved templates" />
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="grid gap-3">
            <Select
              value={assetType}
              onValueChange={(value) => setAssetType(value as typeof assetType)}
            >
              <SelectTrigger aria-label="Sales asset type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  "cadence",
                  "playbook",
                  "email_template",
                  "meeting_template",
                ].map((value) => (
                  <SelectItem key={value} value={value}>
                    {titleCase(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              aria-label="Sales asset name"
              placeholder="Asset name"
              value={assetName}
              onChange={(event) => setAssetName(event.target.value)}
            />
            <Input
              aria-label="Sales asset description"
              placeholder="Purpose and expected outcome"
              value={assetDescription}
              onChange={(event) => setAssetDescription(event.target.value)}
            />
            <Textarea
              aria-label="Sales asset steps"
              placeholder={
                "One task or template section per line\nCall decision maker\nSend capability summary\nSchedule follow-up"
              }
              value={assetSteps}
              onChange={(event) => setAssetSteps(event.target.value)}
            />
            <Button onClick={() => void saveSalesAsset()}>
              Submit for approval
            </Button>
          </div>
          <div className="space-y-3">
            {operating.salesAssets.map((asset) => (
              <div
                key={asset.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3"
              >
                <span>
                  <span className="text-sm font-medium">{asset.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {titleCase(asset.assetType)} · {asset.steps.length} steps
                  </span>
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={titleCase(asset.approvalStatus)} />
                  {asset.approvalStatus === "pending_review" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void execute(
                          {
                            operation: "review_sales_asset",
                            asset_id: asset.id,
                            decision: "approved",
                          },
                          "Sales asset approved",
                        )
                      }
                    >
                      Approve
                    </Button>
                  ) : null}
                  {asset.approvalStatus === "approved" && selectedDealId ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        !["cadence", "playbook"].includes(asset.assetType)
                      }
                      onClick={() =>
                        void execute(
                          {
                            operation: "apply_sales_asset",
                            asset_id: asset.id,
                            deal_id: selectedDealId,
                          },
                          "Approved asset added to CRM Actions",
                        )
                      }
                    >
                      Add to Actions
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
            {pendingAssets.length ? (
              <p className="text-xs text-muted-foreground">
                {pendingAssets.length} asset
                {pendingAssets.length === 1 ? "" : "s"} awaiting administrator
                review.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section>
        <SectionRuleHeading label="Construction relationship intelligence" />
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="grid gap-3">
            <Select
              value={intelligenceTarget}
              onValueChange={(value) =>
                setIntelligenceTarget(value as TargetValue)
              }
            >
              <SelectTrigger aria-label="Relationship intelligence target">
                <SelectValue placeholder="Choose account or CRM lead" />
              </SelectTrigger>
              <SelectContent>
                {crm.accounts.map((account) => (
                  <SelectItem
                    key={account.companyId}
                    value={`company:${account.companyId}`}
                  >
                    {account.name}
                  </SelectItem>
                ))}
                {crm.leads.map((lead) => (
                  <SelectItem key={lead.id} value={`lead:${lead.id}`}>
                    {lead.fullName} · {lead.prospectCompanyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={intelligenceType}
              onValueChange={(value) =>
                setIntelligenceType(
                  value as CrmRelationshipIntelligence["intelligenceType"],
                )
              }
            >
              <SelectTrigger aria-label="Relationship intelligence type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  "account_plan",
                  "stakeholder",
                  "company_hierarchy",
                  "duplicate_candidate",
                  "subcontractor_qualification",
                  "partner_performance",
                  "pursuit_outcome",
                ].map((value) => (
                  <SelectItem key={value} value={value}>
                    {titleCase(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              aria-label="Relationship intelligence title"
              placeholder="Stakeholder, account plan, partner, or qualification title"
              value={intelligenceTitle}
              onChange={(event) => setIntelligenceTitle(event.target.value)}
            />
            <Textarea
              aria-label="Relationship intelligence details"
              placeholder="Roles, influence, trades, coverage, performance, qualification, or relationship notes"
              value={intelligenceDetails}
              onChange={(event) => setIntelligenceDetails(event.target.value)}
            />
            <Button onClick={() => void saveIntelligence()}>
              Save intelligence
            </Button>
          </div>
          <div className="space-y-3">
            <Label htmlFor="crm-buildingconnected-csv">
              Optional BuildingConnected CSV intake
            </Label>
            <Textarea
              id="crm-buildingconnected-csv"
              placeholder={
                "company,contact,trade,email\nABC Electric,Sam Smith,Electrical,sam@example.com"
              }
              value={buildingConnectedCsv}
              onChange={(event) => setBuildingConnectedCsv(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Rows enter duplicate review. This does not require a
              BuildingConnected API and does not create Acumatica companies.
            </p>
            <Button
              variant="outline"
              onClick={() => void importBuildingConnected()}
            >
              Queue CSV for review
            </Button>
          </div>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {operating.relationshipIntelligence.slice(0, 8).map((record) => (
            <div
              key={record.id}
              className="border-b border-border py-3 text-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{record.title}</span>
                <StatusBadge status={titleCase(record.status)} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {titleCase(record.intelligenceType)} ·{" "}
                {titleCase(record.sourceSystem)}
              </p>
              {record.status === "needs_review" ? (
                <Button
                  className="mt-2"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void execute(
                      {
                        operation: "review_relationship_intelligence",
                        record_id: record.id,
                        decision: "approved",
                      },
                      "Relationship record approved",
                    )
                  }
                >
                  Approve
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionRuleHeading label="Governed CRM assistant" />
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="grid gap-3">
            <Select value={assistantDealId} onValueChange={setAssistantDealId}>
              <SelectTrigger aria-label="Assistant deal">
                <SelectValue placeholder="Choose a deal" />
              </SelectTrigger>
              <SelectContent>
                {crm.deals.map((deal) => (
                  <SelectItem key={deal.id} value={deal.id}>
                    {deal.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={assistantType}
              onValueChange={(value) =>
                setAssistantType(value as CrmAiArtifact["artifactType"])
              }
            >
              <SelectTrigger aria-label="Assistant output type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  "deal_summary",
                  "account_summary",
                  "meeting_prep",
                  "task_extraction",
                  "follow_up_draft",
                  "next_best_action",
                  "natural_language_answer",
                ].map((value) => (
                  <SelectItem key={value} value={value}>
                    {titleCase(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              aria-label="Assistant request"
              placeholder="Ask a CRM question or give the meeting/draft focus"
              value={assistantPrompt}
              onChange={(event) => setAssistantPrompt(event.target.value)}
            />
            <Button onClick={() => void saveAssistantDraft()}>
              Create cited draft
            </Button>
            <p className="text-xs text-muted-foreground">
              Output is evidence-backed, permission-aware, and review-only. It
              cannot send email or change a deal by itself.
            </p>
          </div>
          <div className="space-y-4">
            {operating.aiArtifacts.length ? (
              operating.aiArtifacts.slice(0, 6).map((artifact) => (
                <article
                  key={artifact.id}
                  className="border-b border-border pb-4 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-medium">{artifact.title}</p>
                    <StatusBadge status={titleCase(artifact.reviewStatus)} />
                  </div>
                  <p className="mt-2 whitespace-pre-line text-muted-foreground">
                    {artifact.content}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {artifact.citations.length} cited CRM records ·{" "}
                    {artifact.explanation}
                  </p>
                  {artifact.reviewStatus === "draft" ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void execute(
                            {
                              operation: "review_ai_artifact",
                              artifact_id: artifact.id,
                              decision:
                                artifact.artifactType === "task_extraction"
                                  ? "applied"
                                  : "approved",
                            },
                            artifact.artifactType === "task_extraction"
                              ? "Suggested task added to CRM Actions"
                              : "Assistant draft approved",
                          )
                        }
                      >
                        {artifact.artifactType === "task_extraction"
                          ? "Approve and add task"
                          : "Approve"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void execute(
                            {
                              operation: "review_ai_artifact",
                              artifact_id: artifact.id,
                              decision: "rejected",
                            },
                            "Assistant draft rejected",
                          )
                        }
                      >
                        Reject
                      </Button>
                    </div>
                  ) : null}
                </article>
              ))
            ) : loading ? (
              <p className="text-sm text-muted-foreground">
                Loading assistant drafts…
              </p>
            ) : (
              <EmptyState
                title="No assistant drafts"
                description="Create a cited summary, meeting prep, task suggestion, follow-up draft, next action, or CRM answer."
              />
            )}
          </div>
        </div>
      </section>
    </PageScaffold>
  );
}
