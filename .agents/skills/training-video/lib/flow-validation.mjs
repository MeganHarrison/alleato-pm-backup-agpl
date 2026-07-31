import fs from "node:fs";
import path from "node:path";

const ACTION_FIELDS = [
  "caption",
  "goto",
  "click",
  "type",
  "date",
  "upload",
  "zoom",
  "pause",
  "expectText",
  "expectTexts",
  "expectVisible",
];

function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
  );
}

export function resolveFlowAssetPath(flowPath, assetPath) {
  return path.isAbsolute(assetPath)
    ? assetPath
    : path.resolve(path.dirname(flowPath), assetPath);
}

export function validateFlow(flow, flowPath) {
  const errors = [];

  if (!flow || typeof flow !== "object" || Array.isArray(flow)) {
    throw new Error("Training-video flow must be a JSON object.");
  }
  if (!Array.isArray(flow.steps) || flow.steps.length === 0) {
    errors.push("steps must contain at least one recorded action");
  }
  if (
    flow.name !== undefined
    && (
      typeof flow.name !== "string"
      || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(flow.name)
    )
  ) {
    errors.push("name must be a safe output basename containing only letters, numbers, underscores, or hyphens");
  }

  for (const [index, step] of (flow.steps ?? []).entries()) {
    const prefix = `steps[${index}]`;
    if (!step || typeof step !== "object" || Array.isArray(step)) {
      errors.push(`${prefix} must be an object`);
      continue;
    }
    if (!ACTION_FIELDS.some((field) => step[field] !== undefined)) {
      errors.push(`${prefix} does not define a supported action`);
    }
    if (step.type) {
      if (typeof step.type.selector !== "string" || typeof step.type.text !== "string") {
        errors.push(`${prefix}.type requires string selector and text values`);
      }
    }
    if (step.date) {
      if (typeof step.date.label !== "string" || typeof step.date.value !== "string") {
        errors.push(`${prefix}.date requires string label and value values`);
      } else if (!isValidIsoDate(step.date.value)) {
        errors.push(`${prefix}.date.value must be a real date in YYYY-MM-DD format`);
      }
    }
    if (step.upload) {
      if (typeof step.upload.selector !== "string" || typeof step.upload.path !== "string") {
        errors.push(`${prefix}.upload requires string selector and path values`);
      } else {
        const assetPath = resolveFlowAssetPath(flowPath, step.upload.path);
        if (!fs.existsSync(assetPath)) {
          errors.push(`${prefix}.upload.path does not exist: ${assetPath}`);
        }
      }
    }
    if (step.expectText !== undefined && typeof step.expectText !== "string") {
      errors.push(`${prefix}.expectText must be a string`);
    }
    if (
      step.expectTexts !== undefined
      && (
        !Array.isArray(step.expectTexts)
        || step.expectTexts.length === 0
        || step.expectTexts.some((value) => typeof value !== "string" || value.length === 0)
      )
    ) {
      errors.push(`${prefix}.expectTexts must be a non-empty array of non-empty strings`);
    }
    if (step.expectVisible !== undefined && typeof step.expectVisible !== "string") {
      errors.push(`${prefix}.expectVisible must be a selector string`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid training-video flow:\n- ${errors.join("\n- ")}`);
  }
  return flow;
}
