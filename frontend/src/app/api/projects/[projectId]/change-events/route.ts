/**
 * ============================================================================
 * CHANGE EVENTS API ROUTE (Collection-Level)
 * ============================================================================
 *
 * RESTful API endpoints for Change Events CRUD operations
 *
 * GET /api/projects/[id]/change-events - List change events with filters/pagination
 * POST /api/projects/[id]/change-events - Create new change event
 *
 * Schema Reference: change_events table
 * - id: uuid (PK)
 * - project_id: number (FK to projects)
 * - number: string (auto-generated, format: "001", "002", etc.)
 * - title: string
 * - type: string (Owner Change, Design Change, Allowance, etc.)
 * - status: string (Open, Closed, Void)
 * - scope: string (TBD, In Scope, Out of Scope, Allowance)
 * - origin: string (Internal, RFI, Field)
 * - reason: string
 * - description: string
 * - expecting_revenue: boolean
 * - line_item_revenue_source: string
 * - prime_contract_id: number (FK to prime_contracts)
 * - created_by: uuid (FK to users)
 * - updated_by: uuid (FK to users)
 * - deleted_at: timestamp
 *
 * Relations:
 * - change_event_line_items (one-to-many)
 * - change_event_documents + document_metadata (Pattern C attachments)
 * - change_event_history (one-to-many)
 */

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, createClientWithToken, getApiRouteUser } from '@/lib/supabase/server'
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from 'next/server'
import { createChangeEventSchema, changeEventQuerySchema } from './validation'
import type { Database } from '@/types/database.types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { apiErrorResponse } from "@/lib/api-error";
import { requirePermission } from "@/lib/permissions-guard";
import { logger } from "@/lib/logger";
import {
  DEFAULT_LINE_ITEM_REVENUE_SOURCE,
  computeLineItemRevenueRom,
} from "@/lib/change-events/financial-summary";

/**
 * Helper to get the appropriate Supabase client based on auth method
 * If Bearer token in Authorization header, use token-based client
 * Otherwise, use cookie-based client
 */
async function getSupabaseClient(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    return { client: createClientWithToken(token) as RouteSupabaseClient, token }
  }
  return { client: await createClient() as RouteSupabaseClient, token: null }
}

interface RouteParams {
  params: Promise<{ projectId: string }>
}

type ChangeEvent = Database['public']['Tables']['change_events']['Row']

interface ChangeEventWithTotals extends ChangeEvent {
  rom: string
  total: string
  cost_rom: string
  lineItemsCount: number
  prime_pco: string | null
  prime_pco_title: string | null
  rfq_title: string | null
  commitment: string | null
  commitment_id: string | null
  commitment_title: string | null
}

type ChangeEventLineItemAggregateRow = {
  change_event_id: string | null
  revenue_rom: number | null
  cost_rom: number | null
  non_committed_cost: number | null
  contract_id: string | null
  commitment_id: string | null
  commitment_type: string | null
}

type PrimeContractSummaryRow = {
  id: string
  contract_number: string | null
  title: string | null
}

type CommitmentSummaryRow = {
  id: string
  contract_number: string | null
  title: string | null
}

type ChangeEventRfqSummaryRow = {
  change_event_id: string | null
  title: string | null
  created_at: string | null
}

type RouteSupabaseClient = SupabaseClient<Database>

// Validate UUID-like identifiers before sending them to strict FK filters.
function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

/**
 * Generate next change event number for project
 * Format: "001", "002", "003", etc.
 */
async function generateChangeEventNumber(
  supabase: RouteSupabaseClient,
  projectId: number
): Promise<string> {
  // Get ALL change event numbers (including soft-deleted) to avoid unique constraint
  // violations — the unique constraint covers all rows, not just active ones.
  const { data: existing } = await supabase
    .from('change_events')
    .select('number')
    .eq('project_id', projectId)

  let maxNumber = 0
  for (const row of existing ?? []) {
    if (!row?.number) continue
    // Use the trailing integer to handle "CE-001", "001", "9", etc.
    const match = String(row.number).match(/(\d+)\s*$/)
    if (match) {
      const n = parseInt(match[1], 10)
      if (Number.isFinite(n) && n > maxNumber) maxNumber = n
    }
  }

  const nextNumber = maxNumber + 1

  // Format as 3-digit padded number
  return nextNumber.toString().padStart(3, '0')
}

/**
 * GET /api/projects/[id]/change-events
 * Returns paginated list of change events for a project
 *
 * Query Parameters:
 * - page (default: 1): Page number
 * - limit (default: 25): Items per page
 * - status: Filter by status (Open, Closed, Void)
 * - type: Filter by type (Owner Change, Design Change, etc.)
 * - scope: Filter by scope (TBD, In Scope, Out of Scope, Allowance)
 * - search: Search number/title/description
 * - sort: Sort field (createdAt, updatedAt, number, title)
 * - order: Sort order (asc, desc)
 * - includeDeleted: Include soft-deleted records (default: false)
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/change-events#GET",
  async ({ request, params }) => {
  
    const { projectId } = await params
    const { client: supabase } = await getSupabaseClient(request)
    const authHeader = request.headers.get("authorization")
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null
    const user = token
      ? (await supabase.auth.getUser(token)).data.user
      : await getApiRouteUser()
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/change-events#GET",
        message: "Authentication required.",
      })
    }
    const { searchParams } = new URL(request.url)

    // Parse and validate query parameters
    const queryParams = changeEventQuerySchema.parse(
      Object.fromEntries(searchParams.entries())
    )

    const projectIdNum = parseInt(projectId, 10)

    // ── Tab pre-queries (lightweight) ──────────────────────────────────────
    // When a tab filter is requested, we need to resolve which CE IDs belong
    // to that tab so we can apply an IN filter on the main paginated query.
    // We also compute tab counts for the response meta in one pass.
    let tabFilterIds: string[] | null = null
    const tabSummary = { lineItems: 0, noLineItems: 0, rfqs: 0, recycleBin: 0 }

    if (queryParams.tab) {
      // 1. Fetch all CE IDs for the project (active and deleted)
      const { data: projectCEs } = await supabase
        .from('change_events')
        .select('id, deleted_at')
        .eq('project_id', projectIdNum)

      const activeCEIds: string[] = (projectCEs || [])
        .filter((r: { id: string; deleted_at: string | null }) => !r.deleted_at)
        .map((r: { id: string }) => r.id)

      tabSummary.recycleBin = (projectCEs || []).filter(
        (r: { deleted_at: string | null }) => r.deleted_at
      ).length

      // 2. CE IDs that have at least one line item
      const idsWithItemsSet = new Set<string>()
      if (activeCEIds.length > 0) {
        const { data: ceWithItems } = await supabase
          .from('change_event_line_items')
          .select('change_event_id')
          .in('change_event_id', activeCEIds)

        for (const row of ceWithItems || []) {
          idsWithItemsSet.add(String(row.change_event_id))
        }
      }

      tabSummary.lineItems = idsWithItemsSet.size
      tabSummary.noLineItems = activeCEIds.length - idsWithItemsSet.size

      // 3. CE IDs that have an RFQ
      const idsWithRfqSet = new Set<string>()
      if (activeCEIds.length > 0) {
        const { data: ceWithRfqs } = await supabase
          .from('change_event_rfqs')
          .select('change_event_id')
          .in('change_event_id', activeCEIds)

        for (const row of ceWithRfqs || []) {
          idsWithRfqSet.add(String(row.change_event_id))
        }
      }

      tabSummary.rfqs = idsWithRfqSet.size

      // 4. Resolve tab filter IDs
      if (queryParams.tab === 'line_items') {
        tabFilterIds = activeCEIds.filter((id) => idsWithItemsSet.has(id))
      } else if (queryParams.tab === 'no_line_items') {
        tabFilterIds = activeCEIds.filter((id) => !idsWithItemsSet.has(id))
      } else if (queryParams.tab === 'rfqs') {
        tabFilterIds = activeCEIds.filter((id) => idsWithRfqSet.has(id))
      }
      // all does not need an ID filter; recycle_bin is handled via deleted_at below.
    }

    // ── Build base query ────────────────────────────────────────────────────
    let query = supabase
      .from('change_events')
      .select(
        `
        *,
        change_event_line_items(count)
      `,
        { count: 'exact' }
      )
      .eq('project_id', projectIdNum)

    // Apply filters
    if (queryParams.tab === 'recycle_bin') {
      // Recycle bin shows only deleted records
      query = query.not('deleted_at', 'is', null)
    } else if (!queryParams.includeDeleted) {
      query = query.is('deleted_at', null)
    }

    // Apply tab ID filter for line_items / no_line_items / rfqs
    if (tabFilterIds !== null) {
      if (tabFilterIds.length === 0) {
        // No records match — short-circuit
        return NextResponse.json({
          data: [],
          meta: { page: queryParams.page, limit: queryParams.limit, total: 0, totalPages: 0, tabSummary },
        })
      }
      query = query.in('id', tabFilterIds)
    }

    if (queryParams.status) {
      query = query.eq('status', queryParams.status)
    }

    if (queryParams.type) {
      query = query.eq('type', queryParams.type)
    }

    if (queryParams.scope) {
      query = query.eq('scope', queryParams.scope)
    }

    if (queryParams.search) {
      query = query.or(
        `number.ilike.%${queryParams.search}%,title.ilike.%${queryParams.search}%,description.ilike.%${queryParams.search}%`
      )
    }

    // Apply sorting
    const sortColumn =
      queryParams.sort === 'number'
        ? 'number'
        : queryParams.sort === 'createdAt'
          ? 'created_at'
          : queryParams.sort === 'updatedAt'
            ? 'updated_at'
            : queryParams.sort

    query = query.order(sortColumn, { ascending: queryParams.order === 'asc' })

    // Apply pagination
    const from = (queryParams.page - 1) * queryParams.limit
    const to = from + queryParams.limit - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {
      return apiErrorResponse(error);
    }

    const events = data || []
    const eventIds = events.map((event: ChangeEvent) => event.id)

    // Per-event revenue settings drive how each line item's revenue rolls up
    // (an unset revenue source defaults to match-cost — see
    // computeLineItemRevenueRom). Keyed by change_event_id.
    const eventRevenueSettings = new Map<
      string,
      { expectingRevenue: boolean; revenueSource: string | null }
    >()
    for (const event of events as ChangeEvent[]) {
      eventRevenueSettings.set(String(event.id), {
        expectingRevenue: event.expecting_revenue !== false,
        revenueSource: event.line_item_revenue_source ?? null,
      })
    }

    // Batch fetch line-item level parity data for all rows on page.
    const { data: allLineItems } = eventIds.length
      ? await supabase
          .from('change_event_line_items')
          .select('change_event_id, revenue_rom, cost_rom, non_committed_cost, contract_id, commitment_id, commitment_type')
          .in('change_event_id', eventIds)
      : { data: [] as ChangeEventLineItemAggregateRow[] }

    const lineItemMap = new Map<
      string,
      {
        rom: number
        total: number
        costRom: number
        // Sum of cost_rom for line items actually assigned to a commitment —
        // the dollar amount that flows into the linked subcontract/PO, as
        // opposed to `contractNumber`/`title` which only label it.
        committedCost: number
        count: number
        contractId: string | null
        commitmentId: string | null
        commitmentType: string | null
      }
    >()

    for (const item of (allLineItems || []) as ChangeEventLineItemAggregateRow[]) {
      const key = String(item.change_event_id)
      const existing = lineItemMap.get(key) || {
        rom: 0,
        total: 0,
        costRom: 0,
        committedCost: 0,
        count: 0,
        contractId: null,
        commitmentId: null,
        commitmentType: null,
      }
      const revenueSettings = eventRevenueSettings.get(key)
      existing.rom += computeLineItemRevenueRom({
        expectingRevenue: revenueSettings?.expectingRevenue ?? true,
        revenueSource: revenueSettings?.revenueSource,
        costRom: item.cost_rom,
        revenueRom: item.revenue_rom,
      })
      existing.costRom += item.cost_rom || 0
      existing.total += (item.cost_rom || 0) + (item.non_committed_cost || 0)
      existing.count += 1
      if (item.commitment_id) {
        existing.committedCost += item.cost_rom || 0
      }
      if (!existing.contractId && item.contract_id) {
        existing.contractId = item.contract_id
      }
      if (!existing.commitmentId && item.commitment_id) {
        existing.commitmentId = item.commitment_id
        existing.commitmentType = item.commitment_type
      }
      lineItemMap.set(key, existing)
    }

    const rawContractIds = Array.from(
      new Set(
        Array.from(lineItemMap.values())
          .map((entry) => entry.contractId)
          .filter((id): id is string => id !== null)
      )
    )
    const contractIds = rawContractIds.filter(isUuid)
    const droppedContractIds = rawContractIds.length - contractIds.length

    if (droppedContractIds > 0) {
      logger.warn({ msg: `[change-events GET] Ignored ${droppedContractIds} invalid contract_id value(s) while aggregating commitments for project ${projectId}.` })
    }

    const { data: contracts, error: contractsError } = contractIds.length
      ? await supabase
          .from('prime_contracts')
          .select('id, contract_number, title')
          .in('id', contractIds)
      : { data: [] as PrimeContractSummaryRow[], error: null }

    if (contractsError) {
      return apiErrorResponse(contractsError)
    }

    const contractMap = new Map<
      string,
      { contractNumber: string | null; title: string | null }
    >()
    for (const contract of (contracts || []) as PrimeContractSummaryRow[]) {
      contractMap.set(contract.id, {
        contractNumber: contract.contract_number || null,
        title: contract.title || null,
      })
    }

    const rawCommitmentIds = Array.from(
      new Set(
        Array.from(lineItemMap.values())
          .map((entry) => entry.commitmentId)
          .filter((id): id is string => id !== null)
      )
    )
    const commitmentIds = rawCommitmentIds.filter(isUuid)
    const droppedCommitmentIds = rawCommitmentIds.length - commitmentIds.length

    if (droppedCommitmentIds > 0) {
      logger.warn({ msg: `[change-events GET] Ignored ${droppedCommitmentIds} invalid commitment_id value(s) while building list rows for project ${projectId}.` })
    }

    const commitmentMap = new Map<
      string,
      { contractNumber: string | null; title: string | null }
    >()

    if (commitmentIds.length > 0) {
      const serviceSupabase = createServiceClient()
      const [{ data: subcontracts, error: subcontractsError }, { data: purchaseOrders, error: purchaseOrdersError }] =
        await Promise.all([
          serviceSupabase
            .from('subcontracts')
            .select('id, contract_number, title')
            .in('id', commitmentIds),
          serviceSupabase
            .from('purchase_orders')
            .select('id, contract_number, title')
            .in('id', commitmentIds),
        ])

      if (subcontractsError) {
        return apiErrorResponse(subcontractsError)
      }

      if (purchaseOrdersError) {
        return apiErrorResponse(purchaseOrdersError)
      }

      for (const commitment of (subcontracts || []) as CommitmentSummaryRow[]) {
        commitmentMap.set(commitment.id, {
          contractNumber: commitment.contract_number || null,
          title: commitment.title || null,
        })
      }

      for (const commitment of (purchaseOrders || []) as CommitmentSummaryRow[]) {
        commitmentMap.set(commitment.id, {
          contractNumber: commitment.contract_number || null,
          title: commitment.title || null,
        })
      }
    }

    const unresolvedCommitmentCount = commitmentIds.filter((id) => !commitmentMap.has(id)).length
    if (unresolvedCommitmentCount > 0) {
      logger.warn({ msg: `[change-events GET] Could not resolve ${unresolvedCommitmentCount} assigned commitment_id value(s) while building list rows for project ${projectId}.` })
    }

    const { data: rfqs } = eventIds.length
      ? await supabase
          .from('change_event_rfqs')
          .select('change_event_id, title, created_at')
          .in('change_event_id', eventIds)
          .order('created_at', { ascending: false })
      : { data: [] as ChangeEventRfqSummaryRow[] }

    const rfqMap = new Map<string, string>()
    for (const rfq of (rfqs || []) as ChangeEventRfqSummaryRow[]) {
      const key = String(rfq.change_event_id)
      if (!rfqMap.has(key)) {
        rfqMap.set(key, rfq.title || '')
      }
    }

    // Batch-fetch prime PCO links from change_event_pco_links, then join
    // with prime_contract_pcos to get number + title. Two queries beat a
    // polymorphic join since pco_id has no FK the PostgREST can follow.
    const { data: rawPcoLinks } = eventIds.length
      ? await supabase
          .from('change_event_pco_links')
          .select('change_event_id, pco_id')
          .in('change_event_id', eventIds)
          .eq('pco_type', 'prime')
      : { data: [] as Array<{ change_event_id: string; pco_id: string }> }

    const rawPrimePcoIds = [...new Set((rawPcoLinks ?? []).map((l: unknown) => (l as { pco_id?: string }).pco_id))]
    const primePcoIds = rawPrimePcoIds.filter((value): value is string => typeof value === "string" && isUuid(value))
    const droppedPrimePcoIds = rawPrimePcoIds.length - primePcoIds.length

    if (droppedPrimePcoIds > 0) {
      logger.warn({ msg: `[change-events GET] Ignored ${droppedPrimePcoIds} invalid prime PCO id value(s) while building list rows for project ${projectId}.` })
    }

    const { data: primePcosData, error: primePcosError } = primePcoIds.length
      ? await supabase
          .from('prime_contract_pcos')
          .select('id, pco_number, title')
          .in('id', primePcoIds)
      : { data: [] as Array<{ id: string; pco_number: string | null; title: string | null }>, error: null }

    if (primePcosError) {
      return apiErrorResponse(primePcosError)
    }

    const pcoById: Map<string, { pco_number: string | null; title: string | null }> = new Map(
      (primePcosData ?? []).map((p: { id: string; pco_number: string | null; title: string | null }) => [p.id, p]),
    )
    const pcoMap = new Map<string, { number: string | null; title: string | null }>()
    for (const link of (rawPcoLinks ?? []) as Array<{ change_event_id: string; pco_id: string }>) {
      const key = String(link.change_event_id)
      if (!pcoMap.has(key)) {
        const pco = pcoById.get(link.pco_id)
        pcoMap.set(key, {
          number: pco?.pco_number ?? null,
          title: pco?.title ?? null,
        })
      }
    }

    const changeEventsWithTotals: ChangeEventWithTotals[] = events.map(
      (event: ChangeEvent & { change_event_line_items?: { count: number }[] }) => {
        const lineItemAgg = lineItemMap.get(String(event.id))
        const contractInfo =
          lineItemAgg?.contractId ? contractMap.get(lineItemAgg.contractId) : undefined
        const commitmentInfo =
          lineItemAgg?.commitmentId ? commitmentMap.get(lineItemAgg.commitmentId) : undefined

        const baseRevenueRom = lineItemAgg?.rom || 0
        const baseCostRom = lineItemAgg?.costRom || 0
        const baseNonCommitted = lineItemAgg ? lineItemAgg.total - lineItemAgg.costRom : 0
        // Project vertical markup (contractor fee, insurance, etc.) is a
        // Prime PCO conversion concern — surfaced explicitly in the "Add to
        // Prime PCO" preview, not baked silently into the list's ROM figures.
        const total = baseCostRom + baseNonCommitted

        return {
          ...event,
          rom: baseRevenueRom.toFixed(2),
          total: total.toFixed(2),
          cost_rom: baseCostRom.toFixed(2),
          lineItemsCount: lineItemAgg?.count ?? event.change_event_line_items?.[0]?.count ?? 0,
          prime_pco: pcoMap.get(String(event.id))?.number ?? null,
          prime_pco_title: pcoMap.get(String(event.id))?.title ?? null,
          rfq_title: rfqMap.get(String(event.id)) || null,
          // Dollar amount tied to the linked commitment (not the contract
          // number — that's `commitment_title`'s fallback via commitmentInfo).
          commitment: (lineItemAgg?.committedCost ?? 0).toFixed(2),
          commitment_id: lineItemAgg?.commitmentId ?? null,
          commitment_title: commitmentInfo?.title ?? contractInfo?.title ?? null,
        }
      }
    )

    // Format response with pagination
    const totalPages = count ? Math.ceil(count / queryParams.limit) : 0

    const response = {
      data: changeEventsWithTotals,
      meta: {
        page: queryParams.page,
        limit: queryParams.limit,
        total: count || 0,
        totalPages,
        ...(queryParams.tab ? { tabSummary } : {}),
      },
    }

    return NextResponse.json(response)
    },
);

/**
 * POST /api/projects/[id]/change-events
 * Creates a new change event
 *
 * Request Body:
 * - title (required): string
 * - type (required): string (Owner Change, Design Change, etc.)
 * - scope (required): string (TBD, In Scope, Out of Scope, Allowance)
 * - expectingRevenue (default: true): boolean
 * - reason: string
 * - origin: string (Internal, RFI, Field)
 * - lineItemRevenueSource: string
 * - primeContractId: number
 * - description: string
 *
 * Updated: 2026-01-10 - Fixed authentication for Playwright tests
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/change-events#POST",
  async ({ request, params }) => {
  
    const { projectId } = await params
    const projectIdNum = parseInt(projectId, 10);
    const guard = await requirePermission(projectIdNum, "change_orders", "write");
    if (guard.denied) return guard.response;

    const { client: supabase, token } = await getSupabaseClient(request)
    const body = await request.json()

    // Get current user. With an explicit bearer token (e.g. Playwright) validate
    // it directly; otherwise decode the cookie JWT in-process — no Supabase Auth
    // network call, so it can't trip the parallel-refresh session-revocation race.
    const user = token
      ? (await supabase.auth.getUser(token)).data.user
      : await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/change-events#POST",
        message: "Unauthorized change event creation request.",
        status: 401,
        severity: "medium",
      });
    }

    // Validate request body
    const parseResult = createChangeEventSchema.safeParse(body);
    if (!parseResult.success) {
      const FIELD_LABELS: Record<string, string> = {
        type: "Type",
        title: "Title",
        scope: "Scope",
      };
      const fields = [...new Set(
        parseResult.error.issues
          .map((issue) => issue.path[0])
          .filter((f): f is string => typeof f === "string"),
      )];
      const readableFields = fields.map((f) => FIELD_LABELS[f] ?? f);
      const message =
        readableFields.length > 0
          ? `${readableFields.join(", ")} ${readableFields.length === 1 ? "is" : "are"} required.`
          : "Invalid request data.";
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "projects/[projectId]/change-events#POST",
        message,
      });
    }
    const {
      title,
      type,
      status,
      reason,
      scope,
      origin,
      expectingRevenue,
      lineItemRevenueSource,
      primeContractId,
      description,
    } = parseResult.data;

    const originId = typeof body.originId === "string" ? body.originId : null;

    // Generate change event number
    const eventNumber = await generateChangeEventNumber(
      supabase,
      parseInt(projectId, 10)
    )

    // Look up person via users_auth bridge (for foreign key constraint)
    const { data: authLink } = await supabase
      .from('users_auth')
      .select('person_id')
      .eq('auth_user_id', user.id)
      .single()
    const userExists = authLink ? { id: authLink.person_id } : null

    // Map the validated data to database schema
    const dbData: Database['public']['Tables']['change_events']['Insert'] = {
      project_id: parseInt(projectId, 10),
      number: eventNumber,
      title,
      type,
      reason: reason || null,
      scope,
      status: status || "Open",
      origin: origin || 'Internal',
      origin_id: originId,
      expecting_revenue: expectingRevenue,
      // When revenue is expected but no source was chosen, persist Procore's
      // default ("Match Revenue to Latest Cost") so revenue mirrors cost and
      // rolls up (rather than silently staying $0). No revenue expected → null.
      line_item_revenue_source:
        lineItemRevenueSource ||
        (expectingRevenue === false ? null : DEFAULT_LINE_ITEM_REVENUE_SOURCE),
      prime_contract_id: primeContractId != null ? String(primeContractId) : null,
      description: description || null,
      created_at: new Date().toISOString(),
      // Only set created_by if user exists in profiles table
      created_by: userExists ? user.id : null,
    }

    // Create the change event
    const { data, error } = await supabase
      .from('change_events')
      .insert(dbData)
      .select()
      .single()

    if (error) {
      return apiErrorResponse(error);
    }

    // Create audit log entry
    if (userExists) {
      await supabase.from('change_event_history').insert({
        change_event_id: data.id,
        field_name: 'status',
        old_value: null,
        new_value: status || "Open",
        changed_by: user.id,
        change_type: 'CREATE',
      })
    }

    // Format response
    const response = {
      id: data.id,
      number: data.number,
      title: data.title,
      type: data.type,
      reason: data.reason,
      scope: data.scope,
      status: data.status,
      origin: data.origin,
      expectingRevenue: data.expecting_revenue,
      lineItemRevenueSource: data.line_item_revenue_source,
      primeContractId: data.prime_contract_id,
      description: data.description,
      createdAt: data.created_at,
      createdBy: userExists
        ? {
            id: user.id,
            email: user.email,
          }
        : null,
      _links: {
        self: `/api/projects/${projectId}/change-events/${data.id}`,
        lineItems: `/api/projects/${projectId}/change-events/${data.id}/line-items`,
        attachments: `/api/projects/${projectId}/change-events/${data.id}/attachments`,
      },
    }

    return NextResponse.json(response, { status: 201 })
    },
);
