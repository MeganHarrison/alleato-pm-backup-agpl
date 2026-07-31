import "server-only";

import { z } from "zod";
import type {
  AsrsEstimatorCitation,
  AsrsEstimatorRequest,
  AsrsEstimatorRequirement,
  AsrsEstimatorResponse,
} from "./asrs-estimator";
import {
  asrsEstimatorResponseSchema,
  getAsrsPendingRequirements,
} from "./asrs-estimator";
import { requestAsrsJson } from "./asrs-rest.server";

const OWNER = "ASRS estimator";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function requiredString(value: Record<string, unknown>, key: string): string {
  const candidate = value[key];
  if (typeof candidate !== "string" || candidate.length === 0) {
    throw new Error(
      `${OWNER} is unavailable: ASRS response is missing ${key}.`,
    );
  }
  return candidate;
}

function requiredNumber(value: Record<string, unknown>, key: string): number {
  const candidate = value[key];
  if (typeof candidate !== "number" || !Number.isFinite(candidate)) {
    throw new Error(
      `${OWNER} is unavailable: ASRS response is missing ${key}.`,
    );
  }
  return candidate;
}

function formatNumber(value: number): string {
  return Number.isInteger(value)
    ? value.toString()
    : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function parseCitations(
  value: unknown,
  ruleKey: unknown,
): AsrsEstimatorCitation[] {
  if (!Array.isArray(value)) return [];
  if (typeof ruleKey !== "string" || ruleKey.length === 0) return [];
  const seen = new Set<string>();
  return value.flatMap((citation) => {
    if (
      !isRecord(citation) ||
      typeof citation.citation_label !== "string" ||
      (citation.source_type !== "table" && citation.source_type !== "figure") ||
      typeof citation.source_id !== "string" ||
      !z.string().uuid().safeParse(citation.source_id).success ||
      typeof citation.identifier !== "string" ||
      citation.identifier.length === 0 ||
      typeof citation.page_number !== "number" ||
      !Number.isInteger(citation.page_number) ||
      citation.page_number < 1 ||
      typeof citation.review_event_id !== "string" ||
      !z.string().uuid().safeParse(citation.review_event_id).success
    )
      return [];
    const key = `${citation.source_type}:${citation.source_id}:${citation.review_event_id}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [
      {
        label: citation.citation_label,
        pageNumber: citation.page_number,
        sourceType: citation.source_type,
        sourceId: citation.source_id,
        sourceIdentifier: citation.identifier,
        ruleKey,
        reviewEventId: citation.review_event_id,
        href:
          citation.source_type === "table"
            ? `/asrs/tables/${citation.source_id}`
            : `/asrs/figures/${citation.source_id}`,
      },
    ];
  });
}

function addAppliedRequirement(
  requirements: AsrsEstimatorRequirement[],
  raw: Record<string, unknown>,
  id: string,
  label: string,
  value: string,
): void {
  const citations = parseCitations(raw.citations, raw.rule_key);
  if (citations.length === 0) {
    requirements.push(
      pendingRequirement(
        id,
        label,
        "Pending review. This evaluator result is missing reviewed source provenance and cannot be presented as a verified FMDS requirement.",
      ),
    );
    return;
  }
  requirements.push({
    id,
    label,
    status: "verified",
    value,
    citations,
  });
}

function buildRpcInputs(
  request: AsrsEstimatorRequest,
): Record<string, unknown> {
  const inputs: Record<string, unknown> = {
    hose_demand: {
      ceiling_sprinkler_type: request.ceilingSprinklerType,
      design_sprinkler_count: request.designSprinklerCount,
    },
  };
  const flue = request.transverseFlue;
  if (!flue) return inputs;

  const transverseFlue: Record<string, unknown> = {};
  const mappings: Array<[keyof typeof flue, string]> = [
    ["openWidthsIn", "open_widths_in"],
    ["horizontalUniformlyOpenPercent", "horizontal_uniformly_open_percent"],
    ["objectWidthIn", "object_width_in"],
    ["objectAngleDegrees", "object_angle_degrees"],
    ["netWidthIn", "net_width_in"],
    ["nominalHorizontalDistanceFt", "nominal_horizontal_distance_ft"],
    ["actualNetWidthIn", "actual_net_width_in"],
    ["verticallyAligned", "vertically_aligned"],
    ["unobstructedFullHeight", "unobstructed_full_height"],
    ["grossWidthBetweenUprightsIn", "gross_width_between_uprights_in"],
    ["netWidthBetweenUprightsIn", "net_width_between_uprights_in"],
    [
      "affectedFlueHorizontalDistanceFt",
      "affected_flue_horizontal_distance_ft",
    ],
  ];
  for (const [source, target] of mappings) {
    if (flue[source] !== undefined) transverseFlue[target] = flue[source];
  }
  if (Object.keys(transverseFlue).length > 0)
    inputs.transverse_flue = transverseFlue;
  return inputs;
}

function pendingRequirement(
  id: string,
  label: string,
  value: string,
): AsrsEstimatorRequirement {
  return { id, label, status: "pending_review", value, citations: [] };
}

function normalizeEvaluation(
  rawValue: unknown,
  requestedRevisionId: string,
): AsrsEstimatorResponse {
  if (!isRecord(rawValue)) {
    throw new Error(
      `${OWNER} is unavailable: ASRS returned an invalid evaluation.`,
    );
  }
  const evaluatedRevisionId = requiredString(rawValue, "revision_id");
  if (evaluatedRevisionId !== requestedRevisionId) {
    throw new Error(
      `${OWNER} is unavailable: evaluator returned a different corpus revision.`,
    );
  }
  const revisionStatus = requiredString(rawValue, "revision_status");
  if (
    !["staging", "active", "superseded", "rejected"].includes(revisionStatus)
  ) {
    throw new Error(
      `${OWNER} is unavailable: ASRS returned an unsupported revision status.`,
    );
  }

  const requirements: AsrsEstimatorRequirement[] = [];
  const hose = rawValue.hose_demand;
  if (isRecord(hose) && hose.status === "applied") {
    const count = requiredNumber(hose, "design_sprinkler_count");
    const gpm = requiredNumber(hose, "hose_demand_gpm");
    const lpm = requiredNumber(hose, "hose_demand_lpm");
    const duration = requiredNumber(hose, "water_supply_duration_min");
    addAppliedRequirement(
      requirements,
      hose,
      "hose-demand",
      "Hose demand and water supply",
      `${formatNumber(count)} design sprinklers require ${formatNumber(gpm)} gpm (${formatNumber(lpm)} L/min) for ${formatNumber(duration)} minutes.`,
    );
  }

  const netWidth = rawValue.net_width;
  if (isRecord(netWidth) && netWidth.status === "applied") {
    addAppliedRequirement(
      requirements,
      netWidth,
      "net-width",
      "Net transverse flue-space width",
      `${formatNumber(requiredNumber(netWidth, "net_transverse_flue_space_width_in"))} in. total open width.`,
    );
  }

  const obstruction = rawValue.obstruction;
  if (isRecord(obstruction) && obstruction.status === "applied") {
    const ignored = obstruction.ignore_object_in_net_width_calculation === true;
    addAppliedRequirement(
      requirements,
      obstruction,
      "obstruction",
      "Obstruction treatment",
      ignored
        ? "Ignore the object when calculating net transverse flue-space width."
        : "Include the object when calculating net transverse flue-space width.",
    );
  }

  const qualifying = rawValue.qualifying_transverse_flue_space;
  if (isRecord(qualifying) && qualifying.status === "applied") {
    const threshold = requiredNumber(qualifying, "qualifying_threshold_in");
    addAppliedRequirement(
      requirements,
      qualifying,
      "qualifying-flue",
      "Qualifying transverse flue space",
      qualifying.qualifies === true
        ? `Qualifies at the reviewed ${formatNumber(threshold)} in. minimum boundary.`
        : `Does not qualify because net width is below ${formatNumber(threshold)} in.`,
    );
  }

  const minimumWidth = rawValue.minimum_width;
  if (isRecord(minimumWidth) && minimumWidth.status === "applied") {
    addAppliedRequirement(
      requirements,
      minimumWidth,
      "minimum-width",
      "Minimum transverse flue-space width",
      `${formatNumber(requiredNumber(minimumWidth, "recommended_min_net_width_in"))} in. (${formatNumber(requiredNumber(minimumWidth, "recommended_min_net_width_mm"))} mm) at ${formatNumber(requiredNumber(minimumWidth, "nominal_horizontal_distance_ft"))} ft.`,
    );
  } else if (isRecord(minimumWidth) && minimumWidth.status === "escalated") {
    addAppliedRequirement(
      requirements,
      minimumWidth,
      "minimum-width-escalation",
      "More than 10 ft (3.0 m)",
      "In-rack sprinklers are required. See Section 2.2.1.5 to determine if vertical barriers are required.",
    );
  } else if (
    isRecord(minimumWidth) &&
    minimumWidth.status === "unsupported_input"
  ) {
    requirements.push(
      pendingRequirement(
        "minimum-width-unsupported",
        "Minimum transverse flue-space width",
        typeof minimumWidth.reason === "string"
          ? minimumWidth.reason
          : "This distance is not covered by a reviewed lookup row and will not be interpolated.",
      ),
    );
  }

  const adequacy = rawValue.adequacy;
  if (isRecord(adequacy) && adequacy.status === "applied") {
    const adequate = adequacy.transverse_flue_spaces_adequate === true;
    const spacing =
      typeof adequacy.maximum_vertical_distance_between_in_rack_sprinklers_ft_if_noncompliant ===
      "number"
        ? adequacy.maximum_vertical_distance_between_in_rack_sprinklers_ft_if_noncompliant
        : null;
    addAppliedRequirement(
      requirements,
      adequacy,
      "flue-adequacy",
      "Transverse flue-space adequacy",
      adequate
        ? "The entered flue spaces meet the reviewed width, alignment, and full-height clearance requirements."
        : `The entered flue spaces do not meet all reviewed requirements. In-rack sprinklers are required${spacing === null ? "." : ` with no more than ${formatNumber(spacing)} ft vertically between levels.`}`,
    );
  }

  const barrier = rawValue.vertical_barrier;
  if (isRecord(barrier) && barrier.status === "applied") {
    const triggered = barrier.batch1_condition_triggered === true;
    const spacing =
      typeof barrier.maximum_spacing_ft_if_triggered === "number"
        ? barrier.maximum_spacing_ft_if_triggered
        : null;
    addAppliedRequirement(
      requirements,
      barrier,
      "vertical-barrier",
      "Vertical barriers",
      triggered
        ? `Vertical barriers are recommended at no more than ${formatNumber(spacing ?? 12)} ft spacing for this reviewed condition.`
        : "The reviewed vertical-barrier condition is not triggered by the entered measurements.",
    );
  }

  requirements.push(...getAsrsPendingRequirements());

  return asrsEstimatorResponseSchema.parse({
    corpus: {
      coverage: requiredString(rawValue, "coverage"),
      documentCode: requiredString(rawValue, "document_code"),
      revisionId: evaluatedRevisionId,
      revisionLabel: requiredString(rawValue, "revision_label"),
      revisionStatus:
        revisionStatus as AsrsEstimatorResponse["corpus"]["revisionStatus"],
    },
    requirements,
  });
}

export async function evaluateAsrsConfiguration(
  request: AsrsEstimatorRequest,
  options: { revisionId?: string } = {},
): Promise<AsrsEstimatorResponse> {
  const requestedRevisionId = options.revisionId
    ? z.string().uuid().parse(options.revisionId)
    : null;
  const revisions = await requestAsrsJson(
    requestedRevisionId
      ? `fmds_corpus_revisions?select=id&id=eq.${requestedRevisionId}&document_code=eq.FMDS0834&status=in.(staging,active)&limit=1`
      : "fmds_corpus_revisions?select=id&document_code=eq.FMDS0834&status=in.(staging,active)&order=publication_date.desc,created_at.desc&limit=1",
    OWNER,
  );
  const revision = Array.isArray(revisions) ? revisions[0] : null;
  if (!isRecord(revision) || typeof revision.id !== "string") {
    throw new Error(
      `${OWNER} is unavailable: no eligible FMDS0834 corpus revision was found.`,
    );
  }
  if (requestedRevisionId && revision.id !== requestedRevisionId) {
    throw new Error(
      `${OWNER} is unavailable: the requested corpus revision could not be pinned.`,
    );
  }

  const evaluation = await requestAsrsJson(
    "rpc/evaluate_fmds_batch1_rules_scoped",
    OWNER,
    {
      method: "POST",
      body: {
        requested_revision_id: revision.id,
        requested_inputs: buildRpcInputs(request),
      },
    },
  );
  return normalizeEvaluation(evaluation, revision.id);
}
