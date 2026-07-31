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

const baseUrl = process.env.COMMITMENT_API_VERIFY_BASE_URL || "http://localhost:3001";
const projectId = Number(process.env.COMMITMENT_API_VERIFY_PROJECT_ID || "31");
const evidencePath = path.join(
  repoRoot,
  "docs/ops/evidence/2026-07-07-jobplanner-commitment-sov-fk-backfill/financial-api-workflow-verification.json",
);
const tag = `codex-financial-api-${Date.now()}`;

const created = {
  purchaseOrderId: null,
  purchaseOrderSovItemIds: [],
  subcontractId: null,
  subcontractSovItemIds: [],
  changeEventId: null,
  changeEventLineItemId: null,
  primePcoId: null,
  primePccoId: null,
  pccoLineItemIds: [],
  commitmentPcoId: null,
  commitmentChangeOrderId: null,
  commitmentChangeOrderLineIds: [],
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

function getAuthState() {
  const authPath = path.join(repoRoot, "frontend/tests/.auth/user.json");
  if (!fs.existsSync(authPath)) {
    throw new Error(`Missing auth state at ${authPath}. Run Playwright auth setup first.`);
  }

  const auth = JSON.parse(fs.readFileSync(authPath, "utf8"));
  const cookies = auth.cookies || [];
  const cookieHeader = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
  const authCookie = cookies.find(
    (cookie) =>
      cookie.name.includes("auth-token") ||
      (cookie.name.includes("sb-") && cookie.name.includes("-auth")),
  );

  let bearerToken = null;
  if (authCookie) {
    let value = authCookie.value;
    if (value.startsWith("base64-")) value = value.slice(7);
    for (const candidate of [Buffer.from(value, "base64").toString("utf8"), value]) {
      try {
        const parsed = JSON.parse(candidate);
        if (parsed.access_token) {
          bearerToken = parsed.access_token;
          break;
        }
      } catch {
        // Try the next representation.
      }
    }
  }

  if (!cookieHeader && !bearerToken) {
    throw new Error("Auth state did not contain usable cookies or bearer token.");
  }

  return { cookieHeader, bearerToken };
}

const auth = getAuthState();

async function api(method, route, body) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth.cookieHeader) headers.Cookie = auth.cookieHeader;
  if (auth.bearerToken) headers.Authorization = `Bearer ${auth.bearerToken}`;

  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!response.ok) {
    fail(`${method} ${route} returns success`, {
      status: response.status,
      body: text.slice(0, 1200),
    });
  }

  return json;
}

async function updateOne(table, id, values) {
  const { data, error } = await supabase.from(table).update(values).eq("id", id).select("*").single();
  if (error || !data) throw new Error(`${table} update failed: ${error?.message ?? "no row returned"}`);
  return data;
}

async function selectRouteFixtures() {
  const [{ data: company }, { data: pbc }, { data: primeContract }, { data: budgetLine }] =
    await Promise.all([
      supabase
        .from("companies")
        .select("id, name")
        .eq("status", "active")
        .order("created_at", { ascending: true, nullsFirst: false })
        .limit(1)
        .single(),
      supabase
        .from("project_budget_codes")
        .select("id, cost_code_id, cost_type_id, cost_code_types(code)")
        .eq("project_id", projectId)
        .eq("is_active", true)
        .limit(1)
        .single(),
      supabase
        .from("prime_contracts")
        .select("id")
        .eq("project_id", projectId)
        .limit(1)
        .single(),
      supabase
        .from("budget_lines")
        .select("id, project_budget_code_id")
        .eq("project_id", projectId)
        .not("project_budget_code_id", "is", null)
        .limit(1)
        .single(),
    ]);

  if (!company?.id) throw new Error("No active company fixture found.");
  if (!pbc?.id) throw new Error(`No active project_budget_codes fixture found for project ${projectId}.`);
  if (!primeContract?.id) throw new Error(`No prime_contract fixture found for project ${projectId}.`);
  if (!budgetLine?.id) throw new Error(`No budget_lines fixture found for project ${projectId}.`);
  return { company, pbc, primeContract, budgetLine };
}

async function readSovRows(table, commitmentColumn, commitmentId) {
  const { data, error } = await supabase
    .from(table)
    .select("id, budget_code, project_budget_code_id, amount")
    .eq(commitmentColumn, commitmentId)
    .order("line_number", { ascending: true });
  if (error) throw new Error(`${table} readback failed: ${error.message}`);
  return data || [];
}

async function cleanup() {
  await deleteIn("pcco_line_items", "id", created.pccoLineItemIds);
  await deleteIn("commitment_change_order_lines", "id", created.commitmentChangeOrderLineIds);
  await deleteIn("pco_line_items", "id", created.pcoLineItemIds);
  await deleteIn("change_event_pco_links", "id", created.pcoLinkIds);
  if (created.primePcoId) {
    await deleteWhere("prime_contract_pcos", (query) => query.eq("id", created.primePcoId));
  }
  if (created.commitmentPcoId) {
    await deleteWhere("commitment_pcos", (query) => query.eq("id", created.commitmentPcoId));
  }
  if (created.primePccoId) {
    await deleteWhere("prime_contract_change_orders", (query) => query.eq("id", created.primePccoId));
  }
  if (created.commitmentChangeOrderId) {
    await deleteWhere("contract_change_orders", (query) => query.eq("id", created.commitmentChangeOrderId));
  }
  if (created.changeEventLineItemId) {
    await deleteWhere("change_event_line_items", (query) => query.eq("id", created.changeEventLineItemId));
  }
  if (created.changeEventId) {
    await deleteWhere("change_event_history", (query) => query.eq("change_event_id", created.changeEventId));
    await deleteWhere("change_events", (query) => query.eq("id", created.changeEventId));
  }
  if (created.purchaseOrderId) {
    await deleteWhere("purchase_order_sov_items", (query) => query.eq("purchase_order_id", created.purchaseOrderId));
    await deleteWhere("purchase_orders", (query) => query.eq("id", created.purchaseOrderId));
  }
  if (created.subcontractId) {
    await deleteWhere("subcontract_sov_items", (query) => query.eq("subcontract_id", created.subcontractId));
    await deleteWhere("subcontracts", (query) => query.eq("id", created.subcontractId));
  }
}

async function deleteWhere(table, buildQuery) {
  const { error } = await buildQuery(supabase.from(table).delete());
  if (error) throw new Error(`${table} cleanup failed: ${error.message}`);
}

async function deleteIn(table, column, values) {
  const ids = values.filter(Boolean);
  if (ids.length === 0) return;
  await deleteWhere(table, (query) => query.in(column, ids));
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
    purchaseOrders: await countRows("purchase_orders", "id", [created.purchaseOrderId]),
    purchaseOrderSovItems: await countRows("purchase_order_sov_items", "id", created.purchaseOrderSovItemIds),
    subcontracts: await countRows("subcontracts", "id", [created.subcontractId]),
    subcontractSovItems: await countRows("subcontract_sov_items", "id", created.subcontractSovItemIds),
    changeEvents: await countRows("change_events", "id", [created.changeEventId]),
    changeEventLineItems: await countRows("change_event_line_items", "id", [created.changeEventLineItemId]),
    pcoLinks: await countRows("change_event_pco_links", "id", created.pcoLinkIds),
    pcoLineItems: await countRows("pco_line_items", "id", created.pcoLineItemIds),
    primePcos: await countRows("prime_contract_pcos", "id", [created.primePcoId]),
    primeChangeOrders: await countRows("prime_contract_change_orders", "id", [created.primePccoId]),
    pccoLineItems: await countRows("pcco_line_items", "id", created.pccoLineItemIds),
    commitmentPcos: await countRows("commitment_pcos", "id", [created.commitmentPcoId]),
    commitmentChangeOrders: await countRows("contract_change_orders", "id", [created.commitmentChangeOrderId]),
    commitmentChangeOrderLines: await countRows(
      "commitment_change_order_lines",
      "id",
      created.commitmentChangeOrderLineIds,
    ),
  };
}

async function run() {
  const fixtures = await selectRouteFixtures();
  pass("select real route fixtures", {
    projectId,
    companyId: fixtures.company.id,
    projectBudgetCodeId: fixtures.pbc.id,
    primeContractId: fixtures.primeContract.id,
    budgetLineId: fixtures.budgetLine.id,
  });

  const poResponse = await api("POST", `/api/projects/${projectId}/purchase-orders`, {
    contractNumber: `PO-${tag}`,
    title: `API route purchase order ${tag}`,
    status: "Draft",
    executed: false,
    accountingMethod: "unit-quantity",
    contractCompanyId: fixtures.company.id,
    description: "Created by route verifier",
    dates: {},
    privacy: { isPrivate: true, allowNonAdminViewSovItems: false },
    sov: [
      {
        lineNumber: 1,
        budgetCode: fixtures.pbc.cost_code_id,
        projectBudgetCodeId: fixtures.pbc.id,
        description: "Route verified PO SOV line",
        quantity: 2,
        uom: "EA",
        unitCost: 125,
        amount: 250,
      },
    ],
  });
  created.purchaseOrderId = poResponse?.data?.id || poResponse?.id;
  if (!created.purchaseOrderId) fail("purchase order route returns id", { poResponse });
  pass("create purchase order via API route", { purchaseOrderId: created.purchaseOrderId });

  const poSovRows = await readSovRows("purchase_order_sov_items", "purchase_order_id", created.purchaseOrderId);
  created.purchaseOrderSovItemIds = poSovRows.map((row) => row.id);
  if (poSovRows.length !== 1 || poSovRows[0].project_budget_code_id !== fixtures.pbc.id) {
    fail("purchase order API SOV stores project_budget_code_id", { poSovRows });
  }
  pass("purchase order API SOV FK readback", { sovItemId: poSovRows[0].id });

  const subResponse = await api("POST", `/api/projects/${projectId}/subcontracts`, {
    contractNumber: `SC-${tag}`,
    title: `API route subcontract ${tag}`,
    status: "Draft",
    contractCompanyId: fixtures.company.id,
    executed: false,
    accountingMethod: "amount_based",
    defaultRetainagePercent: 0,
    description: "Created by route verifier",
    dates: {},
    privacy: { isPrivate: true, allowNonAdminViewSovItems: false },
    sov: [
      {
        lineNumber: 1,
        budgetCode: fixtures.pbc.cost_code_id,
        projectBudgetCodeId: fixtures.pbc.id,
        description: "Route verified subcontract SOV line",
        amount: 500,
      },
    ],
  });
  created.subcontractId = subResponse?.data?.id || subResponse?.id;
  if (!created.subcontractId) fail("subcontract route returns id", { subResponse });
  pass("create subcontract via API route", { subcontractId: created.subcontractId });

  const subcontractSovRows = await readSovRows("subcontract_sov_items", "subcontract_id", created.subcontractId);
  created.subcontractSovItemIds = subcontractSovRows.map((row) => row.id);
  if (subcontractSovRows.length !== 1 || subcontractSovRows[0].project_budget_code_id !== fixtures.pbc.id) {
    fail("subcontract API SOV stores project_budget_code_id", { subcontractSovRows });
  }
  pass("subcontract API SOV FK readback", { sovItemId: subcontractSovRows[0].id });

  const ceResponse = await api("POST", `/api/projects/${projectId}/change-events`, {
    title: `API route change event ${tag}`,
    type: "Owner Change",
    scope: "Out of Scope",
    reason: "Client Request",
    origin: "Internal",
    expectingRevenue: true,
    lineItemRevenueSource: "Enter manually",
    primeContractId: fixtures.primeContract.id,
    description: "Created by route verifier",
  });
  created.changeEventId = ceResponse?.id;
  if (!created.changeEventId) fail("change event route returns id", { ceResponse });
  pass("create change event via API route", { changeEventId: created.changeEventId });

  const ceLineResponse = await api(
    "POST",
    `/api/projects/${projectId}/change-events/${created.changeEventId}/line-items`,
    {
      budgetCodeId: fixtures.budgetLine.id,
      description: "API route change event line",
      vendorId: fixtures.company.id,
      contractId: fixtures.primeContract.id,
      quantity: 1,
      unitCost: 750,
      revenueRom: 900,
      costRom: 750,
      sortOrder: 0,
    },
  );
  created.changeEventLineItemId = ceLineResponse?.id;
  if (!created.changeEventLineItemId) fail("change event line route returns id", { ceLineResponse });
  const { data: ceLineReadback, error: ceLineReadbackError } = await supabase
    .from("change_event_line_items")
    .select("id, budget_code_id, change_event_id")
    .eq("id", created.changeEventLineItemId)
    .single();
  if (
    ceLineReadbackError ||
    ceLineReadback?.budget_code_id !== fixtures.budgetLine.id ||
    ceLineReadback?.change_event_id !== created.changeEventId
  ) {
    fail("change event line item persists budget linkage", {
      error: ceLineReadbackError?.message,
      ceLineReadback,
    });
  }
  pass("create change event line item via API route", {
    changeEventLineItemId: created.changeEventLineItemId,
    budgetLineId: ceLineReadback.budget_code_id,
  });

  const primePco = await api("POST", `/api/projects/${projectId}/change-events/add-to-pco`, {
    change_event_ids: [created.changeEventId],
    pco_type: "prime",
    create_new: {
      title: `API route prime PCO ${tag}`,
      prime_contract_id: fixtures.primeContract.id,
      status: "pending",
      description: "Created by route verifier",
      schedule_impact: 0,
    },
  });
  created.primePcoId = primePco?.pco?.id;
  if (!created.primePcoId) fail("add-to-pco prime route returns PCO id", { primePco });
  if ((primePco.line_items?.length ?? 0) !== 1 || (primePco.linked_change_events?.length ?? 0) !== 1) {
    fail("add-to-pco prime route creates one link and one line item", {
      lineItems: primePco.line_items?.length ?? 0,
      links: primePco.linked_change_events?.length ?? 0,
    });
  }
  created.pcoLineItemIds.push(...(primePco.line_items || []).map((row) => row.id));
  const { data: primeLinks } = await supabase
    .from("change_event_pco_links")
    .select("id")
    .eq("pco_id", created.primePcoId)
    .eq("pco_type", "prime");
  created.pcoLinkIds.push(...(primeLinks || []).map((row) => row.id));
  if ((primeLinks || []).length !== 1 || created.pcoLineItemIds.filter(Boolean).length < 1) {
    fail("prime PCO link and line item DB readback", {
      linkCount: (primeLinks || []).length,
      lineItemIds: created.pcoLineItemIds,
    });
  }
  pass("create prime PCO and line items via add-to-pco route", {
    primePcoId: created.primePcoId,
    lineItems: primePco.line_items?.length ?? 0,
    links: primePco.linked_change_events?.length ?? 0,
  });

  const primePromote = await api(
    "POST",
    `/api/projects/${projectId}/prime-contract-pcos/${created.primePcoId}/promote`,
    {},
  );
  created.primePccoId = primePromote?.pcco_id;
  if (!created.primePccoId) fail("prime PCO promote route returns PCCO id", { primePromote });
  const { data: pccoLines } = await supabase
    .from("pcco_line_items")
    .select("id")
    .eq("pcco_id", created.primePccoId);
  created.pccoLineItemIds = (pccoLines || []).map((row) => row.id);
  if (created.pccoLineItemIds.length !== 1) {
    fail("prime PCO promotion copies line items", {
      pccoId: created.primePccoId,
      copiedLineItems: created.pccoLineItemIds.length,
    });
  }
  pass("promote prime PCO to change order via API route", {
    pccoId: created.primePccoId,
    copiedLineItems: created.pccoLineItemIds.length,
  });

  const commitmentPco = await api("POST", `/api/projects/${projectId}/change-events/add-to-pco`, {
    change_event_ids: [created.changeEventId],
    pco_type: "commitment",
    create_new: {
      title: `API route commitment PCO ${tag}`,
      commitment_id: created.subcontractId,
      commitment_type: "subcontract",
      description: "Created by route verifier",
      schedule_impact: 0,
    },
  });
  created.commitmentPcoId = commitmentPco?.pco?.id;
  if (!created.commitmentPcoId) {
    fail("add-to-pco commitment route returns PCO id", { commitmentPco });
  }
  if ((commitmentPco.line_items?.length ?? 0) !== 1 || (commitmentPco.linked_change_events?.length ?? 0) !== 1) {
    fail("add-to-pco commitment route creates one link and one line item", {
      lineItems: commitmentPco.line_items?.length ?? 0,
      links: commitmentPco.linked_change_events?.length ?? 0,
    });
  }
  created.pcoLineItemIds.push(...(commitmentPco.line_items || []).map((row) => row.id));
  const { data: commitmentLinks } = await supabase
    .from("change_event_pco_links")
    .select("id")
    .eq("pco_id", created.commitmentPcoId)
    .eq("pco_type", "commitment");
  created.pcoLinkIds.push(...(commitmentLinks || []).map((row) => row.id));
  if ((commitmentLinks || []).length !== 1) {
    fail("commitment PCO link DB readback", {
      linkCount: (commitmentLinks || []).length,
    });
  }
  await updateOne("commitment_pcos", created.commitmentPcoId, { status: "pending" });
  pass("create commitment PCO and line items via add-to-pco route", {
    commitmentPcoId: created.commitmentPcoId,
    lineItems: commitmentPco.line_items?.length ?? 0,
    links: commitmentPco.linked_change_events?.length ?? 0,
  });

  const commitmentPromote = await api(
    "POST",
    `/api/projects/${projectId}/commitment-pcos/${created.commitmentPcoId}/promote`,
    {},
  );
  created.commitmentChangeOrderId = commitmentPromote?.change_order?.id;
  if (!created.commitmentChangeOrderId) {
    fail("commitment PCO promote route returns change order id", { commitmentPromote });
  }
  const { data: commitmentCoLines } = await supabase
    .from("commitment_change_order_lines")
    .select("id")
    .eq("commitment_change_order_id", created.commitmentChangeOrderId);
  created.commitmentChangeOrderLineIds = (commitmentCoLines || []).map((row) => row.id);
  if (created.commitmentChangeOrderLineIds.length !== 1) {
    fail("commitment PCO promotion copies line items", {
      commitmentChangeOrderId: created.commitmentChangeOrderId,
      copiedLineItems: created.commitmentChangeOrderLineIds.length,
    });
  }
  pass("promote commitment PCO to change order via API route", {
    commitmentChangeOrderId: created.commitmentChangeOrderId,
    copiedLineItems: created.commitmentChangeOrderLineIds.length,
  });
}

let status = "pass";
let errorMessage = null;

try {
  await run();
} catch (error) {
  status = "fail";
  errorMessage = error instanceof Error ? error.message : String(error);
} finally {
  try {
    await cleanup();
    const cleanupReadback = await readCleanupCounts();
    const leftoverCount = Object.values(cleanupReadback).reduce((sum, count) => sum + count, 0);
    if (leftoverCount !== 0) {
      throw new Error(`cleanup readback found ${leftoverCount} leftover rows`);
    }
    pass("cleanup route verifier records", {
      purchaseOrderId: created.purchaseOrderId,
      subcontractId: created.subcontractId,
      changeEventId: created.changeEventId,
      cleanupReadback,
    });
  } catch (cleanupError) {
    status = "fail";
    errorMessage = `cleanup failed: ${
      cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
    }`;
    checks.push({ name: "cleanup route verifier records", status: "fail", details: { error: errorMessage } });
  }

  const evidence = {
    status,
    tag,
    baseUrl,
    projectId,
    checks,
    created,
    error: errorMessage,
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  if (status === "fail") {
    console.error(JSON.stringify({ status, evidencePath, error: errorMessage }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ status, evidencePath, checks: checks.length }, null, 2));
}
