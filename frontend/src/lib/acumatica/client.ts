/**
 * Acumatica ERP REST API Client
 *
 * Session-based authentication with automatic re-login on expiry.
 * All entity methods return unwrapped (flat) types — the {"value": ...}
 * envelope is stripped automatically.
 *
 * Usage:
 *   const client = createAcumaticaClient();
 *   await client.login();
 *   const bills = await client.getBills({ $top: 50, $filter: "Status eq 'Open'" });
 *   await client.logout();
 *
 * The client is a singleton — calling createAcumaticaClient() multiple times
 * returns the same instance so sessions are reused across tool calls.
 */

import type {
  AcuLoginBody,
  AcuQueryOptions,
  AcuSessionState,
  AgingBucket,
  AgingSummary,
  CashPositionSummary,
  FlatBill,
  FlatCheck,
  FlatCustomer,
  FlatAccount,
  FlatInvoice,
  FlatJournalTransaction,
  FlatPayment,
  FlatProject,
  FlatProjectBudget,
  FlatProjectTask,
  FlatProjectTransaction,
  FlatPurchaseOrder,
  FlatSubcontract,
  FlatVendor,
  ProjectBudgetSummary,
  RawBill,
  RawCheck,
  RawCustomer,
  RawAccount,
  RawInvoice,
  RawJournalTransaction,
  RawPayment,
  RawProject,
  RawProjectBudget,
  RawProjectTask,
  RawProjectTransaction,
  RawPurchaseOrder,
  RawSubcontract,
  RawVendor,
  VendorSpendSummary,
} from "./types";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL =
  process.env.ACUMATICA_BASE_URL ?? "https://alleatogroup.acumatica.com";
const API_VERSION = "24.200.001";
const ENDPOINT_NAME = "Default";
const ENTITY_BASE = `${BASE_URL}/entity/${ENDPOINT_NAME}/${API_VERSION}`;
const AUTH_LOGIN = `${BASE_URL}/entity/auth/login`;
const AUTH_LOGOUT = `${BASE_URL}/entity/auth/logout`;

const IS_DEV_ENV = process.env.ACUMATICA_ENV === "dev";

function getCredentials() {
  if (IS_DEV_ENV) {
    return {
      username: process.env.ACUMATICA_DEV_USER,
      password: process.env.ACUMATICA_DEV_PASSWORD,
      company: process.env.ACUMATICA_DEV_COMPANY ?? "Developer",
    };
  }
  return {
    username: process.env.ACCOUNTING_USER,
    password: process.env.ACCOUNTING_PASSWORD,
    company: process.env.ACUMATICA_COMPANY ?? "Alleato Group",
  };
}

/** Session TTL — Acumatica defaults to ~20 min. We refresh early at 15 min. */
const SESSION_TTL_MS = 15 * 60 * 1000;

// ---------------------------------------------------------------------------
// Unwrap utility
// ---------------------------------------------------------------------------

/**
 * Recursively strips the Acumatica `{"value": ...}` envelope from a raw
 * API response. Handles nested objects, arrays, and null/undefined.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function unwrap<T>(raw: unknown): T {
  if (raw === null || raw === undefined) return raw as T;

  // If it's an array, unwrap each element
  if (Array.isArray(raw)) {
    return raw.map((item) => unwrap(item)) as T;
  }

  // If it looks like a value wrapper: { value: X }
  if (
    isPlainObject(raw) &&
    "value" in raw &&
    Object.keys(raw).length === 1
  ) {
    return raw.value as T;
  }

  // If it's an object, recursively unwrap all properties
  if (isPlainObject(raw)) {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(raw)) {
      // Skip internal Acumatica metadata fields
      if (key === "id" || key === "rowNumber" || key === "note" || key === "custom" || key === "files") {
        result[key] = val;
        continue;
      }
      result[key] = unwrap(val);
    }
    return result as T;
  }

  return raw as T;
}

// ---------------------------------------------------------------------------
// The Client
// ---------------------------------------------------------------------------

class AcumaticaClient {
  private session: AcuSessionState | null = null;
  private loginPromise: Promise<void> | null = null;

  // -----------------------------------------------------------------------
  // Auth
  // -----------------------------------------------------------------------

  async login(): Promise<void> {
    // If already logging in from another call, wait for that
    if (this.loginPromise) {
      await this.loginPromise;
      return;
    }

    // If session is still valid, skip
    if (this.session && Date.now() - this.session.loginAt < this.session.ttlMs) {
      return;
    }

    this.loginPromise = this._doLogin();
    try {
      await this.loginPromise;
    } finally {
      this.loginPromise = null;
    }
  }

  private async _doLogin(): Promise<void> {
    const { username, password, company } = getCredentials();

    if (!username || !password) {
      const envPrefix = IS_DEV_ENV ? "ACUMATICA_DEV_USER / ACUMATICA_DEV_PASSWORD" : "ACCOUNTING_USER / ACCOUNTING_PASSWORD";
      throw new Error(`Acumatica credentials not set. Required env vars: ${envPrefix}`);
    }

    const body: AcuLoginBody = {
      name: username,
      password: password,
      company,
    };

    const res = await fetch(AUTH_LOGIN, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });

    if (res.status !== 204) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Acumatica login failed (HTTP ${res.status}): ${text}`,
      );
    }

    // Extract cookies from Set-Cookie headers
    const setCookieHeaders = res.headers.getSetCookie?.() ?? [];
    const cookies = setCookieHeaders
      .map((h) => h.split(";")[0])
      .join("; ");

    if (!cookies) {
      throw new Error("Acumatica login succeeded but no cookies were returned");
    }

    this.session = {
      cookies,
      loginAt: Date.now(),
      ttlMs: SESSION_TTL_MS,
    };
  }

  async logout(): Promise<void> {
    if (!this.session) return;

    try {
      await fetch(AUTH_LOGOUT, {
        method: "POST",
        headers: { Cookie: this.session.cookies },
      });
    } catch (error) {
      console.warn(JSON.stringify({
        event: "acumatica_logout_failed",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      }));
    } finally {
      this.session = null;
    }
  }

  /** Ensure session is active, re-login if expired. */
  private async ensureSession(): Promise<string> {
    if (
      !this.session ||
      Date.now() - this.session.loginAt >= this.session.ttlMs
    ) {
      this.session = null; // Force fresh login
      await this.login();
    }
    return this.session!.cookies;
  }

  // -----------------------------------------------------------------------
  // Generic Entity Fetcher
  // -----------------------------------------------------------------------

  /**
   * Fetch records from an Acumatica entity endpoint.
   *
   * @param entityName - e.g. "Bill", "Invoice", "Vendor"
   * @param options - OData query parameters
   * @returns Array of raw (unwrapped) records
   */
  async fetchEntity<TRaw, TFlat>(
    entityName: string,
    options: AcuQueryOptions = {},
  ): Promise<TFlat[]> {
    const cookies = await this.ensureSession();

    const url = new URL(`${ENTITY_BASE}/${entityName}`);

    if (options.$top) url.searchParams.set("$top", String(options.$top));
    if (options.$skip) url.searchParams.set("$skip", String(options.$skip));
    if (options.$expand) url.searchParams.set("$expand", options.$expand);
    if (options.$select) url.searchParams.set("$select", options.$select);

    // Build filter
    let filter = options.$filter ?? "";
    if (options.modifiedAfter) {
      const iso =
        options.modifiedAfter instanceof Date
          ? options.modifiedAfter.toISOString()
          : options.modifiedAfter;
      const clause = `LastModifiedDateTime gt datetimeoffset'${iso}'`;
      filter = filter ? `(${filter}) and ${clause}` : clause;
    }
    if (filter) url.searchParams.set("$filter", filter);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Cookie: cookies,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(60_000),
    });

    if (res.status === 401 || res.status === 403) {
      // Session expired or no access — try re-login once
      this.session = null;
      const freshCookies = await this.ensureSession();
      const retryRes = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Cookie: freshCookies,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(60_000),
      });

      if (!retryRes.ok) {
        const text = await retryRes.text().catch(() => "");
        throw new Error(
          `Acumatica ${entityName} fetch failed after re-login (HTTP ${retryRes.status}): ${text}`,
        );
      }

      const raw = (await retryRes.json()) as TRaw[];
      return raw.map((r) => unwrap<TFlat>(r));
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Acumatica ${entityName} fetch failed (HTTP ${res.status}): ${text}`,
      );
    }

    const raw = (await res.json()) as TRaw[];
    return raw.map((r) => unwrap<TFlat>(r));
  }

  // -----------------------------------------------------------------------
  // Generic Entity Upserter (Write)
  // -----------------------------------------------------------------------

  /**
   * Upsert (create/update) a record in an Acumatica entity endpoint.
   *
   * Acumatica's REST entity API typically accepts PUT for idempotent upserts.
   * Payload shape must match the target entity's contract.
   */
  async upsertEntity<TResponse = Record<string, unknown>>(
    entityName: string,
    payload: Record<string, unknown>,
  ): Promise<TResponse> {
    const performRequest = async (cookies: string) =>
      fetch(`${ENTITY_BASE}/${entityName}`, {
        method: "PUT",
        headers: {
          Cookie: cookies,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

    let cookies = await this.ensureSession();
    let res = await performRequest(cookies);

    if (res.status === 401 || res.status === 403) {
      this.session = null;
      cookies = await this.ensureSession();
      res = await performRequest(cookies);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Acumatica ${entityName} upsert failed (HTTP ${res.status}): ${text}`,
      );
    }

    const text = await res.text();
    if (!text) return {} as TResponse;

    return unwrap<TResponse>(JSON.parse(text));
  }

  // -----------------------------------------------------------------------
  // Typed Entity Methods
  // -----------------------------------------------------------------------

  async getVendors(options: AcuQueryOptions = {}): Promise<FlatVendor[]> {
    return this.fetchEntity<RawVendor, FlatVendor>("Vendor", {
      $top: 200,
      ...options,
    });
  }

  async getBills(options: AcuQueryOptions = {}): Promise<FlatBill[]> {
    return this.fetchEntity<RawBill, FlatBill>("Bill", {
      $top: 200,
      ...options,
    });
  }

  async getInvoices(options: AcuQueryOptions = {}): Promise<FlatInvoice[]> {
    return this.fetchEntity<RawInvoice, FlatInvoice>("Invoice", {
      $top: 200,
      ...options,
    });
  }

  async getPayments(options: AcuQueryOptions = {}): Promise<FlatPayment[]> {
    return this.fetchEntity<RawPayment, FlatPayment>("Payment", {
      $top: 200,
      ...options,
    });
  }

  async getChecks(options: AcuQueryOptions = {}): Promise<FlatCheck[]> {
    return this.fetchEntity<RawCheck, FlatCheck>("Check", {
      $top: 200,
      ...options,
    });
  }

  async getProjectTransactions(
    options: AcuQueryOptions = {},
  ): Promise<FlatProjectTransaction[]> {
    return this.fetchEntity<RawProjectTransaction, FlatProjectTransaction>(
      "ProjectTransaction",
      { $top: 500, $expand: "Details", ...options },
    );
  }

  async getJournalTransactions(
    options: AcuQueryOptions = {},
  ): Promise<FlatJournalTransaction[]> {
    return this.fetchEntity<RawJournalTransaction, FlatJournalTransaction>(
      "JournalTransaction",
      { $top: 100, ...options },
    );
  }

  async getAccounts(options: AcuQueryOptions = {}): Promise<FlatAccount[]> {
    return this.fetchEntity<RawAccount, FlatAccount>("Account", {
      $top: 500,
      ...options,
    });
  }

  async getCustomers(options: AcuQueryOptions = {}): Promise<FlatCustomer[]> {
    return this.fetchEntity<RawCustomer, FlatCustomer>("Customer", {
      $top: 200,
      ...options,
    });
  }

  async getPurchaseOrders(
    options: AcuQueryOptions = {},
  ): Promise<FlatPurchaseOrder[]> {
    return this.fetchEntity<RawPurchaseOrder, FlatPurchaseOrder>(
      "PurchaseOrder",
      { $top: 200, ...options },
    );
  }

  async getSubcontracts(
    options: AcuQueryOptions = {},
  ): Promise<FlatSubcontract[]> {
    return this.fetchEntity<RawSubcontract, FlatSubcontract>("Subcontract", {
      $top: 200,
      ...options,
    });
  }

  // -----------------------------------------------------------------------
  // Typed Entity Upsert Methods
  // -----------------------------------------------------------------------

  async upsertPurchaseOrder(
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.upsertEntity("PurchaseOrder", payload);
  }

  async upsertSubcontract(
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.upsertEntity("Subcontract", payload);
  }

  async upsertChangeOrder(
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.upsertEntity("ChangeOrder", payload);
  }

  async upsertInvoice(
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.upsertEntity("Invoice", payload);
  }

  async upsertBill(
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.upsertEntity("Bill", payload);
  }

  async upsertProject(
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.upsertEntity("Project", payload);
  }

  // -----------------------------------------------------------------------
  // Project Entity Methods
  // -----------------------------------------------------------------------

  async getProjects(options: AcuQueryOptions = {}): Promise<FlatProject[]> {
    return this.fetchEntity<RawProject, FlatProject>("Project", {
      $top: 200,
      ...options,
    });
  }

  async getProjectBudgetLines(
    options: AcuQueryOptions = {},
  ): Promise<FlatProjectBudget[]> {
    return this.fetchEntity<RawProjectBudget, FlatProjectBudget>(
      "ProjectBudget",
      { $top: 500, ...options },
    );
  }

  async getProjectTasks(
    options: AcuQueryOptions = {},
  ): Promise<FlatProjectTask[]> {
    return this.fetchEntity<RawProjectTask, FlatProjectTask>("ProjectTask", {
      $top: 200,
      ...options,
    });
  }

  /**
   * Get a comprehensive project budget summary for a specific project.
   * Fetches the project header + all budget lines and computes totals.
   *
   * @param projectId — Acumatica Project ID (e.g. "25108")
   */
  async getProjectBudgetSummary(
    projectId: string,
  ): Promise<ProjectBudgetSummary> {
    const [projects, budgetLines] = await Promise.all([
      this.getProjects({
        $filter: `ProjectID eq '${projectId}'`,
        $top: 1,
      }),
      this.getProjectBudgetLines({
        $filter: `ProjectID eq '${projectId}'`,
        $top: 500,
      }),
    ]);

    const project = projects[0];
    if (!project) {
      throw new Error(`Project '${projectId}' not found in Acumatica`);
    }

    // Split by type
    const income = budgetLines.filter((l) => l.Type === "Income");
    const expense = budgetLines.filter((l) => l.Type === "Expense");

    // Compute totals from expense lines (where budgets and actuals live)
    const totals = {
      originalBudget: expense.reduce(
        (s, l) => s + (l.OriginalBudgetedAmount ?? 0),
        0,
      ),
      revisedBudget: expense.reduce(
        (s, l) => s + (l.RevisedBudgetedAmount ?? 0),
        0,
      ),
      budgetChangeOrders: expense.reduce(
        (s, l) => s + (l.BudgetedCOAmount ?? 0),
        0,
      ),
      actualCosts: expense.reduce((s, l) => s + (l.ActualAmount ?? 0), 0),
      committedCosts: expense.reduce(
        (s, l) => s + (l.RevisedCommittedAmount ?? 0),
        0,
      ),
      costToComplete: expense.reduce(
        (s, l) => s + (l.CostToComplete ?? 0),
        0,
      ),
      costAtCompletion: expense.reduce(
        (s, l) => s + (l.CostAtCompletion ?? 0),
        0,
      ),
      variance: expense.reduce((s, l) => s + (l.VarianceAmount ?? 0), 0),
      income: project.Income ?? 0,
      expenses: project.Expenses ?? 0,
    };

    return {
      projectId,
      projectDescription: project.Description,
      projectStatus: project.Status,
      customer: project.Customer,
      asOf: new Date().toISOString(),
      totals,
      linesByType: { income, expense },
      lineCount: budgetLines.length,
    };
  }

  /**
   * List all projects with basic financial info.
   * Useful for portfolio overview from the ERP side.
   */
  async getProjectList(
    statusFilter?: string,
  ): Promise<
    {
      projectId: string;
      description: string;
      status: string;
      customer?: string;
      income: number;
      expenses: number;
      netPosition: number;
    }[]
  > {
    const projects = await this.getProjects({
      $top: 200,
      ...(statusFilter
        ? { $filter: `Status eq '${statusFilter}'` }
        : { $filter: "Status ne 'In Planning'" }),
    });

    // Safe numeric extraction — some projects may have nested structures
    const num = (v: unknown): number => {
      if (typeof v === "number") return v;
      if (typeof v === "string") return parseFloat(v) || 0;
      if (v && typeof v === "object" && "value" in v)
        return num((v as { value: unknown }).value);
      return 0;
    };

    return projects
      .filter((p) => p.ProjectID !== "X") // Exclude internal default project
      .map((p) => ({
        projectId: p.ProjectID,
        description: p.Description,
        status: p.Status,
        customer: p.Customer,
        income: num(p.Income),
        expenses: num(p.Expenses),
        netPosition: num(p.Income) - num(p.Expenses),
      }))
      .sort((a, b) => b.expenses - a.expenses);
  }

  // -----------------------------------------------------------------------
  // Aggregation / Summary Methods
  // -----------------------------------------------------------------------

  /**
   * Compute AP Aging — groups outstanding bills by days past due.
   */
  async getAPAging(): Promise<AgingSummary> {
    // Note: "Balance gt 0" filter causes Acumatica 500 error (Type conversion not supported).
    // We filter in-memory instead.
    const bills = await this.getBills({
      $top: 500,
      $select: "ReferenceNbr,DueDate,Balance,Vendor,Status",
    });

    const now = new Date();
    const buckets: AgingBucket[] = [
      { label: "Current", totalBalance: 0, count: 0 },
      { label: "1-30 Days", totalBalance: 0, count: 0 },
      { label: "31-60 Days", totalBalance: 0, count: 0 },
      { label: "61-90 Days", totalBalance: 0, count: 0 },
      { label: "90+ Days", totalBalance: 0, count: 0 },
    ];

    for (const bill of bills) {
      const balance = bill.Balance ?? 0;
      if (balance <= 0) continue;

      const dueDate = bill.DueDate ? new Date(bill.DueDate) : now;
      const daysOverdue = Math.floor(
        (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      let bucket: AgingBucket;
      if (daysOverdue <= 0) bucket = buckets[0];
      else if (daysOverdue <= 30) bucket = buckets[1];
      else if (daysOverdue <= 60) bucket = buckets[2];
      else if (daysOverdue <= 90) bucket = buckets[3];
      else bucket = buckets[4];

      bucket.totalBalance += balance;
      bucket.count += 1;
    }

    const totalBalance = buckets.reduce((s, b) => s + b.totalBalance, 0);

    return {
      asOf: now.toISOString(),
      buckets,
      totalBalance,
    };
  }

  /**
   * Compute AR Aging — groups outstanding invoices by days past due.
   */
  async getARAging(): Promise<AgingSummary> {
    // Note: "Balance gt 0" filter causes Acumatica 500 error (Type conversion not supported).
    // We filter in-memory instead.
    const invoices = await this.getInvoices({
      $top: 500,
      $select: "ReferenceNbr,DueDate,Balance,Customer,CustomerName,Status",
    });

    const now = new Date();
    const buckets: AgingBucket[] = [
      { label: "Current", totalBalance: 0, count: 0 },
      { label: "1-30 Days", totalBalance: 0, count: 0 },
      { label: "31-60 Days", totalBalance: 0, count: 0 },
      { label: "61-90 Days", totalBalance: 0, count: 0 },
      { label: "90+ Days", totalBalance: 0, count: 0 },
    ];

    for (const inv of invoices) {
      const balance = inv.Balance ?? 0;
      if (balance <= 0) continue;

      const dueDate = inv.DueDate ? new Date(inv.DueDate) : now;
      const daysOverdue = Math.floor(
        (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      let bucket: AgingBucket;
      if (daysOverdue <= 0) bucket = buckets[0];
      else if (daysOverdue <= 30) bucket = buckets[1];
      else if (daysOverdue <= 60) bucket = buckets[2];
      else if (daysOverdue <= 90) bucket = buckets[3];
      else bucket = buckets[4];

      bucket.totalBalance += balance;
      bucket.count += 1;
    }

    const totalBalance = buckets.reduce((s, b) => s + b.totalBalance, 0);

    return {
      asOf: now.toISOString(),
      buckets,
      totalBalance,
    };
  }

  /**
   * Compute cash position — net of AR payments received vs AP checks issued
   * over a rolling window (default 90 days).
   */
  async getCashPosition(windowDays = 90): Promise<CashPositionSummary> {
    const since = new Date();
    since.setDate(since.getDate() - windowDays);
    const sinceISO = since.toISOString().split("T")[0];

    // Note: OData date filters can cause Acumatica 500 errors on some versions.
    // Fetch all and filter in-memory for reliability.
    const [payments, checks] = await Promise.all([
      this.getPayments({
        $top: 500,
        $select: "ReferenceNbr,Date,PaymentAmount,Status",
      }),
      this.getChecks({
        $top: 500,
        $select: "ReferenceNbr,Date,PaymentAmount,Status",
      }),
    ]);

    const sinceDate = since.getTime();
    const recentPayments = payments.filter(
      (p) => p.Date && new Date(p.Date).getTime() >= sinceDate,
    );
    const recentChecks = checks.filter(
      (c) => c.Date && new Date(c.Date).getTime() >= sinceDate,
    );

    const totalInflows = recentPayments.reduce(
      (s, p) => s + (p.PaymentAmount ?? 0),
      0,
    );
    const totalOutflows = recentChecks.reduce(
      (s, c) => s + (c.PaymentAmount ?? 0),
      0,
    );

    return {
      asOf: new Date().toISOString(),
      totalInflows,
      totalOutflows,
      netCashFlow: totalInflows - totalOutflows,
      windowDays,
    };
  }

  /**
   * Get spend summary for a specific vendor or top N vendors.
   */
  async getVendorSpend(vendorId?: string): Promise<VendorSpendSummary[]> {
    const bills = await this.getBills({
      $top: 500,
      ...(vendorId ? { $filter: `Vendor eq '${vendorId}'` } : {}),
    });

    // Group by vendor
    const byVendor = new Map<string, FlatBill[]>();
    for (const bill of bills) {
      const vid = bill.Vendor ?? "UNKNOWN";
      const arr = byVendor.get(vid) ?? [];
      arr.push(bill);
      byVendor.set(vid, arr);
    }

    const summaries: VendorSpendSummary[] = [];
    for (const [vid, vendorBills] of byVendor) {
      const totalInvoiced = vendorBills.reduce(
        (s, b) => s + (b.Amount ?? 0),
        0,
      );
      const totalOutstanding = vendorBills.reduce(
        (s, b) => s + (b.Balance ?? 0),
        0,
      );

      summaries.push({
        vendorId: vid,
        vendorName: vid, // We'll enrich this if we have vendor names
        asOf: new Date().toISOString(),
        totalInvoiced,
        totalOutstanding,
        totalPaid: totalInvoiced - totalOutstanding,
        billCount: vendorBills.length,
        bills: vendorBills,
      });
    }

    // Sort by total invoiced descending
    summaries.sort((a, b) => b.totalInvoiced - a.totalInvoiced);

    return vendorId ? summaries : summaries.slice(0, 20);
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _instance: AcumaticaClient | null = null;

/**
 * Get (or create) the singleton Acumatica client.
 * Reuses the same session across tool calls within a server process.
 */
export function createAcumaticaClient(): AcumaticaClient {
  if (!_instance) {
    _instance = new AcumaticaClient();
  }
  return _instance;
}

export { AcumaticaClient };
