#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const frontendRequire = createRequire(path.join(repoRoot, "frontend", "package.json"));
const dotenv = frontendRequire("dotenv");
const { createClient } = frontendRequire("@supabase/supabase-js");

dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });
dotenv.config({ path: path.join(repoRoot, ".env.local"), quiet: true });
dotenv.config({ path: path.join(repoRoot, "frontend/.env.local"), quiet: true });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Missing Supabase service env");

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const tag = `codex-financial-flow-${Date.now()}`;
const evidencePath = path.join(
  repoRoot,
  "docs/ops/evidence/2026-07-07-jobplanner-commitment-sov-fk-backfill/financial-workflow-verification.json",
);

const created = {
  projectId: null,
  companyId: null,
  projectBudgetCodeId: null,
  inactiveProjectBudgetCodeId: null,
  wrongProjectId: null,
  wrongProjectBudgetCodeId: null,
  budgetLineId: null,
  primeContractId: null,
  purchaseOrderId: null,
  purchaseOrderSovId: null,
  subcontractId: null,
  subcontractSovId: null,
  changeEventId: null,
  changeEventLineItemId: null,
  primePcoId: null,
  primeChangeOrderId: null,
  commitmentPcoId: null,
  commitmentChangeOrderId: null,
  commitmentChangeOrderLineId: null,
  pcoLineItemIds: [],
  pcoLinkIds: [],
};

const checks = [];

function pass(name, details = {}) {
  checks.push({ name, status: "pass", details });
}

function fail(name, details = {}) {
  checks.push({ name, status: "fail", details });
  throw new Error(`${name}: ${JSON.stringify(details)}`);
}

async function insertOne(table, values) {
  const { data, error } = await supabase.from(table).insert(values).select("*").single();
  if (error || !data) throw new Error(`${table} insert failed: ${error?.message ?? "no row returned"}`);
  return data;
}

async function updateOne(table, id, values) {
  const { data, error } = await supabase.from(table).update(values).eq("id", id).select("*").single();
  if (error || !data) throw new Error(`${table} update failed: ${error?.message ?? "no row returned"}`);
  return data;
}

async function expectRejected(name, fn, pattern) {
  const { error } = await fn();
  if (!error) fail(name, { expected: "rejection", pattern });
  if (pattern && !pattern.test(error.message)) {
    fail(name, { expectedPattern: String(pattern), actual: error.message });
  }
  pass(name, { rejectedWith: error.message });
}

async function selectExistingBudgetParts() {
  const { data: costCode, error: costCodeError } = await supabase
    .from("cost_codes")
    .select("id, title")
    .eq("id", "21-1313")
    .maybeSingle();
  if (costCodeError || !costCode) throw new Error(`Missing cost code 21-1313: ${costCodeError?.message}`);

  const { data: costType, error: costTypeError } = await supabase
    .from("cost_code_types")
    .select("id, code, description")
    .eq("code", "S")
    .maybeSingle();
  if (costTypeError || !costType) throw new Error(`Missing cost type S: ${costTypeError?.message}`);

  return { costCode, costType };
}

async function run() {
  const { costCode, costType } = await selectExistingBudgetParts();

  const project = await insertOne("projects", {
    name: `Codex financial workflow ${tag}`,
    project_number: `CF-${Date.now()}`,
    access: "internal",
    created_via: "automation",
    creation_request_id: null,
    creation_run_id: `verify-financial-workflows:${tag}:primary`,
  });
  created.projectId = project.id;
  pass("create project", { projectId: project.id });

  const company = await insertOne("companies", {
    name: `Codex Workflow Vendor ${tag}`,
    is_vendor: true,
    status: "active",
  });
  created.companyId = company.id;
  pass("create contract company", { companyId: company.id });

  const projectBudgetCode = await insertOne("project_budget_codes", {
    project_id: project.id,
    cost_code_id: costCode.id,
    cost_type_id: costType.id,
    description: `${costCode.title} - ${costType.description}`,
    description_mode: "concatenated",
    is_active: true,
  });
  created.projectBudgetCodeId = projectBudgetCode.id;
  pass("create canonical project budget code", {
    projectBudgetCodeId: projectBudgetCode.id,
    costCodeId: costCode.id,
    costTypeCode: costType.code,
  });

  const inactiveProjectBudgetCode = await insertOne("project_budget_codes", {
    project_id: project.id,
    cost_code_id: "21-4000",
    cost_type_id: costType.id,
    description: "Inactive guardrail test budget code",
    description_mode: "concatenated",
    is_active: false,
  });
  created.inactiveProjectBudgetCodeId = inactiveProjectBudgetCode.id;
  pass("create inactive project budget code for guardrail test", {
    inactiveProjectBudgetCodeId: inactiveProjectBudgetCode.id,
  });

  const wrongProject = await insertOne("projects", {
    name: `Codex wrong-project guardrail ${tag}`,
    project_number: `CF-WRONG-${Date.now()}`,
    access: "internal",
    created_via: "automation",
    creation_request_id: null,
    creation_run_id: `verify-financial-workflows:${tag}:wrong-project`,
  });
  created.wrongProjectId = wrongProject.id;

  const wrongProjectBudgetCode = await insertOne("project_budget_codes", {
    project_id: wrongProject.id,
    cost_code_id: costCode.id,
    cost_type_id: costType.id,
    description: `${costCode.title} - ${costType.description}`,
    description_mode: "concatenated",
    is_active: true,
  });
  created.wrongProjectBudgetCodeId = wrongProjectBudgetCode.id;
  pass("create wrong-project budget code for guardrail test", {
    wrongProjectId: wrongProject.id,
    wrongProjectBudgetCodeId: wrongProjectBudgetCode.id,
  });

  const budgetLine = await insertOne("budget_lines", {
    project_id: project.id,
    cost_code_id: costCode.id,
    cost_type_id: costType.id,
    project_budget_code_id: projectBudgetCode.id,
    description: `${costCode.title} - ${costType.description}`,
    original_amount: 100000,
  });
  created.budgetLineId = budgetLine.id;
  pass("create budget line for change management", { budgetLineId: budgetLine.id });

  const primeContract = await insertOne("prime_contracts", {
    project_id: project.id,
    contract_number: `PC-${tag}`,
    title: `Prime Contract ${tag}`,
    status: "draft",
    original_contract_value: 100000,
    revised_contract_value: 100000,
    contract_company_id: company.id,
  });
  created.primeContractId = primeContract.id;
  pass("create prime contract", { primeContractId: primeContract.id });

  const purchaseOrder = await insertOne("purchase_orders", {
    project_id: project.id,
    contract_number: `PO-${tag}`,
    title: `Purchase Order ${tag}`,
    status: "Draft",
    contract_company_id: company.id,
    prime_contract_id: primeContract.id,
  });
  created.purchaseOrderId = purchaseOrder.id;
  pass("create purchase order", { purchaseOrderId: purchaseOrder.id });

  await expectRejected(
    "purchase order SOV rejects nonzero text-only budget code",
    () =>
      supabase.from("purchase_order_sov_items").insert({
        purchase_order_id: purchaseOrder.id,
        line_number: 1,
        budget_code: costCode.id,
        description: "Rejected text-only PO SOV line",
        amount: 100,
      }),
    /project_budget_code_id/i,
  );

  await expectRejected(
    "purchase order SOV rejects inactive project budget code",
    () =>
      supabase.from("purchase_order_sov_items").insert({
        purchase_order_id: purchaseOrder.id,
        line_number: 2,
        budget_code: "21-4000",
        project_budget_code_id: inactiveProjectBudgetCode.id,
        description: "Rejected inactive PO SOV line",
        amount: 100,
      }),
    /inactive/i,
  );

  await expectRejected(
    "purchase order SOV rejects wrong-project budget code",
    () =>
      supabase.from("purchase_order_sov_items").insert({
        purchase_order_id: purchaseOrder.id,
        line_number: 3,
        budget_code: costCode.id,
        project_budget_code_id: wrongProjectBudgetCode.id,
        description: "Rejected wrong-project PO SOV line",
        amount: 100,
      }),
    /does not match/i,
  );

  const poSov = await insertOne("purchase_order_sov_items", {
    purchase_order_id: purchaseOrder.id,
    line_number: 1,
    budget_code: costCode.id,
    project_budget_code_id: projectBudgetCode.id,
    description: "Verified FK-backed PO SOV line",
    quantity: 1,
    uom: "EA",
    unit_cost: 100,
    amount: 100,
  });
  created.purchaseOrderSovId = poSov.id;
  pass("create FK-backed purchase order SOV", { poSovId: poSov.id });

  const subcontract = await insertOne("subcontracts", {
    project_id: project.id,
    contract_number: `SC-${tag}`,
    title: `Subcontract ${tag}`,
    status: "Draft",
    contract_company_id: company.id,
    prime_contract_id: primeContract.id,
  });
  created.subcontractId = subcontract.id;
  pass("create subcontract", { subcontractId: subcontract.id });

  await expectRejected(
    "subcontract SOV rejects nonzero text-only budget code",
    () =>
      supabase.from("subcontract_sov_items").insert({
        subcontract_id: subcontract.id,
        line_number: 1,
        budget_code: costCode.id,
        description: "Rejected text-only subcontract SOV line",
        amount: 200,
      }),
    /project_budget_code_id/i,
  );

  await expectRejected(
    "subcontract SOV rejects inactive project budget code",
    () =>
      supabase.from("subcontract_sov_items").insert({
        subcontract_id: subcontract.id,
        line_number: 2,
        budget_code: "21-4000",
        project_budget_code_id: inactiveProjectBudgetCode.id,
        description: "Rejected inactive subcontract SOV line",
        amount: 200,
      }),
    /inactive/i,
  );

  await expectRejected(
    "subcontract SOV rejects wrong-project budget code",
    () =>
      supabase.from("subcontract_sov_items").insert({
        subcontract_id: subcontract.id,
        line_number: 3,
        budget_code: costCode.id,
        project_budget_code_id: wrongProjectBudgetCode.id,
        description: "Rejected wrong-project subcontract SOV line",
        amount: 200,
      }),
    /does not match/i,
  );

  const subcontractSov = await insertOne("subcontract_sov_items", {
    subcontract_id: subcontract.id,
    line_number: 1,
    budget_code: costCode.id,
    project_budget_code_id: projectBudgetCode.id,
    description: "Verified FK-backed subcontract SOV line",
    quantity: 1,
    unit_of_measure: "EA",
    unit_cost: 200,
    amount: 200,
  });
  created.subcontractSovId = subcontractSov.id;
  pass("create FK-backed subcontract SOV", { subcontractSovId: subcontractSov.id });

  const changeEvent = await insertOne("change_events", {
    project_id: project.id,
    number: `CE-${tag}`,
    title: `Change Event ${tag}`,
    type: "TBD",
    scope: "TBD",
    status: "Open",
    expecting_revenue: true,
    prime_contract_id: primeContract.id,
    sent_to_prime_pco: true,
    sent_to_commitment_pco: true,
  });
  created.changeEventId = changeEvent.id;
  pass("create change event", { changeEventId: changeEvent.id });

  const changeEventLineItem = await insertOne("change_event_line_items", {
    change_event_id: changeEvent.id,
    budget_code_id: budgetLine.id,
    budget_line_id: budgetLine.id,
    description: "Verified change event line",
    quantity: 1,
    unit_of_measure: "EA",
    unit_cost: 300,
    revenue_rom: 300,
    cost_rom: 200,
    commitment_id: subcontract.id,
    commitment_type: "subcontract",
    commitment_line_item_id: subcontractSov.id,
  });
  created.changeEventLineItemId = changeEventLineItem.id;
  pass("create change event line with budget FK", { changeEventLineItemId: changeEventLineItem.id });

  const primePco = await insertOne("prime_contract_pcos", {
    project_id: project.id,
    prime_contract_id: primeContract.id,
    pco_number: `PPCO-${tag}`,
    title: `Prime PCO ${tag}`,
    status: "pending",
    total_amount: 300,
  });
  created.primePcoId = primePco.id;
  const primePcoLink = await insertOne("change_event_pco_links", {
    change_event_id: changeEvent.id,
    pco_id: primePco.id,
    pco_type: "prime",
  });
  created.pcoLinkIds.push(primePcoLink.id);
  const primePcoLineItem = await insertOne("pco_line_items", {
    pco_id: primePco.id,
    pco_type: "prime",
    change_event_id: changeEvent.id,
    change_event_line_item_id: changeEventLineItem.id,
    budget_code_id: budgetLine.id,
    description: "Verified prime PCO line",
    amount: 300,
  });
  created.pcoLineItemIds.push(primePcoLineItem.id);
  pass("create prime potential change order", { primePcoId: primePco.id });

  const primeChangeOrder = await insertOne("prime_contract_change_orders", {
    contract_id: primeContract.id,
    prime_contract_id: primeContract.id,
    project_id: project.id,
    pcco_number: `PCCO-${tag}`,
    title: `Prime Change Order ${tag}`,
    status: "pending",
    total_amount: 300,
  });
  created.primeChangeOrderId = primeChangeOrder.id;
  await updateOne("prime_contract_pcos", primePco.id, {
    promoted_to_co_id: primeChangeOrder.id,
    promoted_at: new Date().toISOString(),
  });
  pass("create prime change order and link PCO promotion", {
    primeChangeOrderId: primeChangeOrder.id,
  });

  const commitmentPco = await insertOne("commitment_pcos", {
    project_id: project.id,
    commitment_id: subcontract.id,
    commitment_type: "subcontract",
    pco_number: `CPCO-${tag}`,
    title: `Commitment PCO ${tag}`,
    status: "approved",
    total_amount: 200,
    contract_company: company.name,
  });
  created.commitmentPcoId = commitmentPco.id;
  const commitmentPcoLink = await insertOne("change_event_pco_links", {
    change_event_id: changeEvent.id,
    pco_id: commitmentPco.id,
    pco_type: "commitment",
  });
  created.pcoLinkIds.push(commitmentPcoLink.id);
  const commitmentPcoLineItem = await insertOne("pco_line_items", {
    pco_id: commitmentPco.id,
    pco_type: "commitment",
    change_event_id: changeEvent.id,
    change_event_line_item_id: changeEventLineItem.id,
    budget_code_id: budgetLine.id,
    description: "Verified commitment PCO line",
    amount: 200,
  });
  created.pcoLineItemIds.push(commitmentPcoLineItem.id);
  pass("create commitment potential change order", { commitmentPcoId: commitmentPco.id });

  const commitmentChangeOrder = await insertOne("contract_change_orders", {
    contract_id: subcontract.id,
    contract_type: "subcontract",
    project_id: project.id,
    change_order_number: `CCO-${tag}`,
    title: `Commitment Change Order ${tag}`,
    description: "Verified official commitment change order",
    amount: 200,
    status: "pending",
    contract_company: company.name,
  });
  created.commitmentChangeOrderId = commitmentChangeOrder.id;
  await updateOne("commitment_pcos", commitmentPco.id, {
    promoted_to_co_id: commitmentChangeOrder.id,
    promoted_at: new Date().toISOString(),
  });
  const commitmentChangeOrderLine = await insertOne("commitment_change_order_lines", {
    commitment_change_order_id: commitmentChangeOrder.id,
    budget_line_id: budgetLine.id,
    cost_code_id: costCode.id,
    cost_type_id: costType.id,
    description: "Verified commitment change order line",
    amount: 200,
  });
  created.commitmentChangeOrderLineId = commitmentChangeOrderLine.id;
  pass("create commitment change order and line", {
    commitmentChangeOrderId: commitmentChangeOrder.id,
  });

  const { data: poReadback, error: poReadbackError } = await supabase
    .from("purchase_order_sov_items")
    .select("id, project_budget_code_id, budget_code, project_budget_codes(cost_code_id, cost_code_types(code))")
    .eq("id", poSov.id)
    .single();
  if (poReadbackError || poReadback.project_budget_code_id !== projectBudgetCode.id) {
    fail("purchase order SOV readback uses FK", { error: poReadbackError?.message, poReadback });
  }
  pass("purchase order SOV readback uses FK", { poReadback });

  const { data: subcontractReadback, error: subcontractReadbackError } = await supabase
    .from("subcontract_sov_items")
    .select("id, project_budget_code_id, budget_code, project_budget_codes(cost_code_id, cost_code_types(code))")
    .eq("id", subcontractSov.id)
    .single();
  if (subcontractReadbackError || subcontractReadback.project_budget_code_id !== projectBudgetCode.id) {
    fail("subcontract SOV readback uses FK", { error: subcontractReadbackError?.message, subcontractReadback });
  }
  pass("subcontract SOV readback uses FK", { subcontractReadback });

  return {
    status: "pass",
    tag,
    created,
    checks,
  };
}

async function deleteWhere(table, buildQuery) {
  const query = buildQuery(supabase.from(table).delete());
  const { error } = await query;
  if (error) throw new Error(`${table} cleanup failed: ${error.message}`);
}

async function deleteIn(table, column, values) {
  const ids = values.filter(Boolean);
  if (ids.length === 0) return;
  await deleteWhere(table, (query) => query.in(column, ids));
}

async function cleanup() {
  if (!created.projectId) return;
  await deleteIn("commitment_change_order_lines", "id", [created.commitmentChangeOrderLineId]);
  await deleteIn("pco_line_items", "id", created.pcoLineItemIds);
  await deleteIn("change_event_pco_links", "id", created.pcoLinkIds);
  await deleteIn("commitment_pcos", "id", [created.commitmentPcoId]);
  await deleteIn("prime_contract_pcos", "id", [created.primePcoId]);
  await deleteIn("contract_change_orders", "id", [created.commitmentChangeOrderId]);
  await deleteIn("prime_contract_change_orders", "id", [created.primeChangeOrderId]);
  await deleteIn("change_event_line_items", "id", [created.changeEventLineItemId]);
  await deleteIn("change_events", "id", [created.changeEventId]);
  await deleteIn("purchase_order_sov_items", "id", [created.purchaseOrderSovId]);
  await deleteIn("subcontract_sov_items", "id", [created.subcontractSovId]);
  await deleteIn("purchase_orders", "id", [created.purchaseOrderId]);
  await deleteIn("subcontracts", "id", [created.subcontractId]);
  await deleteIn("prime_contracts", "id", [created.primeContractId]);
  await deleteIn("budget_lines", "id", [created.budgetLineId]);
  await deleteIn("project_budget_codes", "id", [
    created.projectBudgetCodeId,
    created.inactiveProjectBudgetCodeId,
    created.wrongProjectBudgetCodeId,
  ]);
  await deleteIn("companies", "id", [created.companyId]);
  await deleteIn("projects", "id", [created.projectId, created.wrongProjectId]);
}

async function countRows(table, column, values) {
  const ids = values.filter(Boolean);
  if (ids.length === 0) return 0;
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .in(column, ids);
  if (error) throw new Error(`${table} cleanup readback failed: ${error.message}`);
  return count ?? 0;
}

async function readCleanupCounts() {
  return {
    projects: await countRows("projects", "id", [created.projectId, created.wrongProjectId]),
    companies: await countRows("companies", "id", [created.companyId]),
    projectBudgetCodes: await countRows("project_budget_codes", "id", [
      created.projectBudgetCodeId,
      created.inactiveProjectBudgetCodeId,
      created.wrongProjectBudgetCodeId,
    ]),
    budgetLines: await countRows("budget_lines", "id", [created.budgetLineId]),
    primeContracts: await countRows("prime_contracts", "id", [created.primeContractId]),
    purchaseOrders: await countRows("purchase_orders", "id", [created.purchaseOrderId]),
    purchaseOrderSovItems: await countRows("purchase_order_sov_items", "id", [created.purchaseOrderSovId]),
    subcontracts: await countRows("subcontracts", "id", [created.subcontractId]),
    subcontractSovItems: await countRows("subcontract_sov_items", "id", [created.subcontractSovId]),
    changeEvents: await countRows("change_events", "id", [created.changeEventId]),
    changeEventLineItems: await countRows("change_event_line_items", "id", [created.changeEventLineItemId]),
    pcoLinks: await countRows("change_event_pco_links", "id", created.pcoLinkIds),
    pcoLineItems: await countRows("pco_line_items", "id", created.pcoLineItemIds),
    primePcos: await countRows("prime_contract_pcos", "id", [created.primePcoId]),
    primeChangeOrders: await countRows("prime_contract_change_orders", "id", [created.primeChangeOrderId]),
    commitmentPcos: await countRows("commitment_pcos", "id", [created.commitmentPcoId]),
    commitmentChangeOrders: await countRows("contract_change_orders", "id", [created.commitmentChangeOrderId]),
    commitmentChangeOrderLines: await countRows("commitment_change_order_lines", "id", [
      created.commitmentChangeOrderLineId,
    ]),
  };
}

let report;
try {
  report = await run();
} catch (error) {
  report = {
    status: "fail",
    tag,
    created,
    checks,
    error: error instanceof Error ? error.message : String(error),
    failedAt: new Date().toISOString(),
  };
  process.exitCode = 1;
} finally {
  try {
    await cleanup();
    const cleanupReadback = await readCleanupCounts();
    const leftoverCount = Object.values(cleanupReadback).reduce((sum, count) => sum + count, 0);
    if (leftoverCount !== 0) {
      throw new Error(`cleanup readback found ${leftoverCount} leftover rows`);
    }
    pass("cleanup verifier records", { cleanupReadback });
    report = {
      ...(report ?? { status: "pass", tag, created }),
      status: report?.status === "fail" ? "fail" : "pass",
      checks,
      cleanupReadback,
      completedAt: new Date().toISOString(),
    };
  } catch (cleanupError) {
    const message = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
    checks.push({ name: "cleanup verifier records", status: "fail", details: { error: message } });
    report = {
      ...(report ?? { tag, created }),
      status: "fail",
      checks,
      error: message,
      failedAt: new Date().toISOString(),
    };
    process.exitCode = 1;
  } finally {
    fs.writeFileSync(evidencePath, `${JSON.stringify(report, null, 2)}\n`);
    const output = JSON.stringify(report, null, 2);
    if (report.status === "fail") {
      console.error(output);
    } else {
      console.log(output);
    }
  }
}
