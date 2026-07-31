/**
 * Job Planner read client (server-only).
 *
 * Auth: tenant-level `ApiKey` header (no JWT). Reads JOBPLANNER_API_KEY.
 * Job Planner sits behind Cloudflare, which rejects default server user-agents
 * with `error code: 1010`; we send a browser User-Agent to pass.
 *
 * This module is pure I/O — no reconciliation logic lives here.
 */

import "server-only";

const API_V1 = "https://api.jobplanner.com";
const API_V2 = "https://api-v2.jobplanner.com";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

export type JpExternalObject = {
  status: number | null;
  error: string | null;
  rejectReason: string | null;
  externalId: string | null;
  externalModel: string | null;
  lastSync: string | null;
  pushedOn: string | null;
  data?: Record<string, number> | null;
} | null;

export type JpProject = {
  projectId: number;
  projectName: string;
  state?: string | null;
  status?: string | null;
};

export type JpBudgetLine = {
  id: number;
  costCodeId: number | null;
  costTypeId: number | null;
  description: string | null;
  modifiedOn: string | null;
  directCostValues?: Record<string, { amount?: number }> | null;
  externalObject: JpExternalObject;
};

export type JpBudget = {
  projectId: number;
  contractAmount: number;
  originalContractValue: number;
  revisedBudget: number;
  budgetedCost: number;
  committedCosts: number;
  actualCosts: number;
  billedToDate: number;
  budgetProfit: number;
  lineItems: JpBudgetLine[];
  externalObject: JpExternalObject;
};

export type JpChangeOrder = {
  id: number;
  number: number | string;
  totalAmount: number;
  description: string | null;
  createdOn: string | null;
  externalObject: JpExternalObject;
};

export type JpCostCode = {
  id: number;
  code: string;
  name: string;
  division: string | null;
};

export type JpCostType = {
  id: number;
  /** Single-letter code: L=Labor, E=Equipment, M=Material, S=Subcontract, X=Expense. */
  code: string;
  name: string;
};

function apiKey(): string {
  const key = process.env.JOBPLANNER_API_KEY?.trim();
  if (!key) {
    throw new Error("JOBPLANNER_API_KEY is not set");
  }
  return key;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { ApiKey: apiKey(), "User-Agent": USER_AGENT, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const path = url.replace(API_V1, "").replace(API_V2, "");
    throw new Error(`Job Planner ${res.status} on ${path}`);
  }
  return res.json() as Promise<T>;
}

export function listProjects(): Promise<JpProject[]> {
  return getJson<JpProject[]>(`${API_V1}/projects`);
}

export function getBudget(projectId: number): Promise<JpBudget> {
  return getJson<JpBudget>(`${API_V2}/projects/${projectId}/budgets`);
}

export function getCommitmentChangeOrders(projectId: number): Promise<JpChangeOrder[]> {
  return getJson<JpChangeOrder[]>(`${API_V2}/projects/${projectId}/commitmentchangeorders`);
}

export function getPrimeContractChangeOrders(projectId: number): Promise<JpChangeOrder[]> {
  return getJson<JpChangeOrder[]>(`${API_V2}/projects/${projectId}/primecontractchangeorders`);
}

export function getCostCodes(projectId: number): Promise<JpCostCode[]> {
  return getJson<JpCostCode[]>(`${API_V2}/projects/${projectId}/costcodes`);
}

export function getCostTypes(projectId: number): Promise<JpCostType[]> {
  return getJson<JpCostType[]>(`${API_V2}/projects/${projectId}/costtypes`);
}
