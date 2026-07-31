#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const CONTRACT_VERSION = 1;
const VALID_STATUSES = new Set(["PASS", "FAIL", "BLOCKED", "INCONCLUSIVE", "NOT_RUN"]);
const RISK_LEVELS = new Set(["standard", "high"]);
const EVIDENCE_KEYS = new Set([
  "screenshots",
  "videos",
  "snapshots",
  "actionLog",
  "summary",
  "databaseReadback",
  "reloadProof",
  "negativePath",
  "visualReview",
  "regressionTest",
]);

function issue(message, field) {
  return field ? `${field}: ${message}` : message;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateClaims(manifest) {
  const errors = [];
  if (!Array.isArray(manifest.claims) || manifest.claims.length === 0) {
    return ["claims: must contain at least one observable claim"];
  }
  const ids = new Set();
  manifest.claims.forEach((claim, index) => {
    if (!isObject(claim)) {
      errors.push(`claims[${index}]: expected an object`);
      return;
    }
    if (!nonEmptyString(claim.id)) errors.push(`claims[${index}].id: must be a non-empty string`);
    else if (ids.has(claim.id)) errors.push(`claims[${index}].id: duplicate claim id '${claim.id}'`);
    else ids.add(claim.id);
    if (!nonEmptyString(claim.description)) errors.push(`claims[${index}].description: must be a non-empty string`);
    if (!Array.isArray(claim.evidence) || claim.evidence.length === 0) {
      errors.push(`claims[${index}].evidence: must declare at least one evidence requirement`);
      return;
    }
    claim.evidence.forEach((requirement, evidenceIndex) => {
      if (!isObject(requirement) || !EVIDENCE_KEYS.has(requirement.key)) {
        errors.push(`claims[${index}].evidence[${evidenceIndex}]: unsupported evidence requirement`);
      } else if (!Number.isInteger(requirement.min) || requirement.min < 1) {
        errors.push(`claims[${index}].evidence[${evidenceIndex}].min: must be a positive integer`);
      }
    });
  });
  return errors;
}

export function validateManifest(manifest) {
  const errors = [];

  if (!isObject(manifest)) return ["manifest: expected a JSON object"];
  if (manifest.contractVersion !== CONTRACT_VERSION) {
    errors.push(issue(`contractVersion must be ${CONTRACT_VERSION}`, "contractVersion"));
  }
  for (const field of ["feature", "route"]) {
    if (!nonEmptyString(manifest[field])) errors.push(issue("must be a non-empty string", field));
  }
  if (!nonEmptyString(manifest.taskId)) errors.push(issue("must be a non-empty string", "taskId"));
  if (!RISK_LEVELS.has(manifest.riskLevel)) {
    errors.push(issue("must be 'standard' or 'high'", "riskLevel"));
  }
  if (!Array.isArray(manifest.flows) || manifest.flows.length === 0) {
    errors.push("flows: must contain at least one flow");
  } else {
    manifest.flows.forEach((flow, index) => {
      if (!isObject(flow)) {
        errors.push(`flows[${index}]: expected an object`);
        return;
      }
      if (!nonEmptyString(flow.name)) errors.push(`flows[${index}].name: must be a non-empty string`);
      if (!Array.isArray(flow.steps) || flow.steps.length === 0) {
        errors.push(`flows[${index}].steps: must contain at least one action`);
      }
      if (!nonEmptyString(flow.expectedOutcome)) {
        errors.push(`flows[${index}].expectedOutcome: must describe an observable result`);
      }
    });
  }

  if (!Array.isArray(manifest.requiredEvidence) || manifest.requiredEvidence.length === 0) {
    errors.push("requiredEvidence: must contain at least one evidence key");
  } else {
    for (const key of manifest.requiredEvidence) {
      if (!EVIDENCE_KEYS.has(key)) errors.push(`requiredEvidence: unsupported evidence key '${key}'`);
    }
  }

  const requiresVisualProof = manifest.requiredEvidence?.includes("visualReview");
  if (requiresVisualProof && (!isObject(manifest.visual) || !Array.isArray(manifest.visual.viewports) || manifest.visual.viewports.length === 0)) {
    errors.push("visual.viewports: required when visualReview is declared");
  }

  if (manifest.riskLevel === "high" && (!isObject(manifest.independentReview) || manifest.independentReview.required !== true)) {
    errors.push("independentReview: required with required=true for high-risk verification");
  }

  errors.push(...validateClaims(manifest));

  return errors;
}

function normalizeEvidence(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return [value];
  return [];
}

function evidenceCount(value, rootDir) {
  return normalizeEvidence(value).filter((entry) => {
    if (!nonEmptyString(entry)) return false;
    return fs.existsSync(path.resolve(rootDir, entry));
  }).length;
}

export function validateResult({ manifest, result, rootDir = process.cwd(), expectedTaskId = "" }) {
  const errors = validateManifest(manifest);
  if (!isObject(result)) return [...errors, "result: expected a JSON object"];

  if (result.taskId !== manifest.taskId) errors.push(`taskId: result must match manifest taskId (${manifest.taskId})`);
  if (expectedTaskId && manifest.taskId !== expectedTaskId) errors.push(`taskId: manifest must match expected task ${expectedTaskId}`);

  if (!VALID_STATUSES.has(result.status)) {
    errors.push(`status: must be one of ${[...VALID_STATUSES].join(", ")}`);
  }

  if (result.status !== "PASS") {
    if (!nonEmptyString(result.reason)) {
      errors.push(`reason: required when status is ${result.status}`);
    }
    return errors;
  }

  if (!isObject(result.evidence)) {
    errors.push("evidence: required for PASS results");
  } else {
    for (const key of manifest.requiredEvidence ?? []) {
      if (evidenceCount(result.evidence[key], rootDir) < 1) {
        errors.push(`evidence.${key}: required artifact is missing or does not exist`);
      }
    }
  }

  if (!isObject(result.claims)) {
    errors.push("claims: required for PASS results");
  } else {
    for (const claim of manifest.claims ?? []) {
      const claimResult = result.claims[claim.id];
      if (!isObject(claimResult)) {
        errors.push(`claims.${claim.id}: missing result for declared claim`);
        continue;
      }
      for (const requirement of claim.evidence ?? []) {
        if (evidenceCount(claimResult[requirement.key], rootDir) < requirement.min) {
          errors.push(`claims.${claim.id}.${requirement.key}: requires at least ${requirement.min} existing artifact(s)`);
        }
      }
    }
  }

  if (Array.isArray(result.findings) && result.findings.length > 0) {
    errors.push("findings: PASS cannot contain unresolved findings");
  }
  if (result.observedStatus && result.observedStatus !== "PASS") {
    errors.push(`observedStatus: conflicts with PASS (${result.observedStatus})`);
  }

  const review = result.independentReview;
  if (manifest.riskLevel === "high" && !isObject(review)) {
    errors.push("independentReview: required for high-risk PASS results");
  } else if (isObject(review)) {
    if (!nonEmptyString(review.reviewer)) errors.push("independentReview.reviewer: required");
    if (review.decision !== "APPROVED") errors.push("independentReview.decision: must be APPROVED for PASS results");
    if (!nonEmptyString(review.reviewedAt)) errors.push("independentReview.reviewedAt: required");
    if (!nonEmptyString(review.artifact) || !evidenceCount(review.artifact, rootDir)) {
      errors.push("independentReview.artifact: must point to an existing review artifact");
    }
  }

  return errors;
}

function parseArgs(argv) {
  const options = { manifest: "", result: "", root: process.cwd(), requirePass: false, taskId: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--manifest") options.manifest = argv[++index] ?? "";
    else if (token === "--result") options.result = argv[++index] ?? "";
    else if (token === "--root") options.root = argv[++index] ?? process.cwd();
    else if (token === "--require-pass") options.requirePass = true;
    else if (token === "--task-id") options.taskId = argv[++index] ?? "";
  }
  return options;
}

function readJson(file) {
  const resolved = path.resolve(file);
  if (!fs.existsSync(resolved)) throw new Error(`Input file not found: ${resolved}`);
  try {
    return JSON.parse(fs.readFileSync(resolved, "utf8"));
  } catch (error) {
    throw new Error(`Input file is not valid JSON: ${resolved} (${error.message})`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (!options.manifest || !options.result) {
      throw new Error("Usage: node scripts/verification/verification-contract.mjs --manifest <file> --result <file> [--root <dir>]");
    }
    const manifest = readJson(options.manifest);
    const result = readJson(options.result);
    const errors = validateResult({
      manifest,
      result,
      rootDir: options.root,
      expectedTaskId: options.taskId,
    });
    if (options.requirePass && result.status !== "PASS") {
      errors.push(`status: Required verification contract must be PASS, got ${result.status || "missing"}`);
    }
    if (errors.length > 0) {
      console.error("Verification contract failed:");
      errors.forEach((error) => console.error(`- ${error}`));
      process.exit(1);
    }
    if (result.status !== "PASS") {
      console.log(`Verification contract recorded: ${result.status}`);
    } else {
      console.log("Verification contract passed: PASS is supported by the declared evidence.");
    }
  } catch (error) {
    console.error(`Verification contract could not run: ${error.message}`);
    process.exit(2);
  }
}
