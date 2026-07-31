/**
 * =============================================================================
 * ESTIMATE SERVICE LAYER
 * =============================================================================
 *
 * Business logic layer for Estimates & Quantity Takeoff operations.
 * Handles all database interactions, calculations, and business rules.
 * Provides type-safe methods for the API layer.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import {
  EstimateCreate,
  EstimateUpdate,
  EstimateListParams,
  EstimateWithLineItems,
  EstimateRow,
  EstimateLineItemRow,
  EstimateAlternateRow,
  EstimateAllowanceRow,
  DivisionTotal,
  EstimateLineItem,
  EstimateAlternate,
  EstimateAllowance,
  CompanyEstimateRow,
  EstimateTypeStat,
  EstimateType,
  EstimateTypes,
  calculateLineItemCosts,
} from "@/lib/schemas/estimates";
import {
  buildEstimateV2DetailStarterRows,
  buildEstimateV2GcStarterRows,
} from "@/lib/estimates/template";

type CompanyEstimateQueryRow = Pick<
  EstimateRow,
  | "estimate_id"
  | "project_id"
  | "estimate_type"
  | "title"
  | "estimate_number"
  | "revision"
  | "status"
  | "estimate_date"
  | "location"
  | "estimator"
  | "updated_at"
  | "created_at"
> & {
  projects:
    | {
        name: string | null;
        project_number: string | null;
      }
    | {
        name: string | null;
        project_number: string | null;
      }[]
    | null;
};

type EstimateMutationInput = Partial<Pick<EstimateRow, "estimate_type">>;

export class EstimateService {
  constructor(private supabase: SupabaseClient) {}

  // =============================================================================
  // LIST OPERATIONS
  // =============================================================================

  async list(projectId: number, params: EstimateListParams) {
    const { page, limit, sort, order, status, search } = params;

    // Build base data query
    let query = this.supabase
      .from("estimates")
      .select("*")
      .eq("project_id", projectId)
      .eq("is_deleted", false);

    // Build base count query
    let countQuery = this.supabase
      .from("estimates")
      .select("*", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("is_deleted", false);

    // Apply status filter
    if (status && status !== "all") {
      query = query.eq("status", status);
      countQuery = countQuery.eq("status", status);
    }

    // Apply search across title, estimate_number, estimator, and location
    if (search) {
      const searchFilter = `title.ilike.%${search}%,estimate_number.ilike.%${search}%,estimator.ilike.%${search}%,location.ilike.%${search}%`;
      query = query.or(searchFilter);
      countQuery = countQuery.or(searchFilter);
    }

    // Apply sorting
    const sortField = this.mapSortField(sort);
    query = query.order(sortField, { ascending: order === "asc" });

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    // Execute both queries in parallel
    const [{ data, error }, { count, error: countError }] = await Promise.all([
      query,
      countQuery,
    ]);

    if (error) throw new Error(`Failed to fetch estimates: ${error.message}`);
    if (countError)
      throw new Error(`Failed to count estimates: ${countError.message}`);

    return {
      data: data as EstimateRow[],
      pagination: {
        current_page: page,
        per_page: limit,
        total_records: count ?? 0,
        total_pages: Math.ceil((count ?? 0) / limit),
        has_next_page: (count ?? 0) > offset + limit,
        has_prev_page: page > 1,
      },
    };
  }

  // =============================================================================
  // COMPANY-LEVEL LIST (cross-project)
  // =============================================================================

  async listAll(estimateType?: string | null): Promise<CompanyEstimateRow[]> {
    let query = this.supabase
      .from("estimates")
      .select("estimate_id, project_id, estimate_type, title, estimate_number, revision, status, estimate_date, location, estimator, updated_at, created_at, projects(name, project_number)")
      .eq("is_deleted", false)
      .order("updated_at", { ascending: false });

    if (estimateType && estimateType !== "all") {
      query = query.eq("estimate_type", estimateType);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Failed to fetch company estimates: ${error.message}`);

    return ((data ?? []) as unknown as CompanyEstimateQueryRow[]).map((row) => ({
      estimate_id: row.estimate_id,
      project_id: row.project_id,
      estimate_type: row.estimate_type ?? null,
      title: row.title,
      estimate_number: row.estimate_number ?? null,
      revision: row.revision,
      status: row.status,
      estimate_date: row.estimate_date ?? null,
      location: row.location ?? null,
      estimator: row.estimator ?? null,
      updated_at: row.updated_at,
      created_at: row.created_at,
      project_name: (Array.isArray(row.projects)
        ? row.projects[0]
        : row.projects)?.name ?? null,
      project_number: (Array.isArray(row.projects)
        ? row.projects[0]
        : row.projects)?.project_number ?? null,
    }));
  }

  async getTypeStats(): Promise<EstimateTypeStat[]> {
    const { data, error } = await this.supabase
      .from("estimates")
      .select("estimate_type, status")
      .eq("is_deleted", false);

    if (error) throw new Error(`Failed to fetch estimate stats: ${error.message}`);

    // Aggregate in memory
    const statsMap = new Map<string, EstimateTypeStat>();

    for (const type of [...EstimateTypes, null] as (typeof EstimateTypes[number] | null)[]) {
      const key = type ?? "__null__";
      statsMap.set(key, {
        type,
        total: 0,
        pending_review: 0,
        draft: 0,
        approved: 0,
        rejected: 0,
      });
    }

    for (const row of (data ?? [])) {
      const key = row.estimate_type ?? "__null__";
      if (!statsMap.has(key)) {
        statsMap.set(key, {
          type: row.estimate_type as EstimateType | null,
          total: 0,
          pending_review: 0,
          draft: 0,
          approved: 0,
          rejected: 0,
        });
      }
      const stat = statsMap.get(key)!;
      stat.total += 1;
      if (row.status === "pending_review") stat.pending_review += 1;
      else if (row.status === "draft") stat.draft += 1;
      else if (row.status === "approved") stat.approved += 1;
      else if (row.status === "rejected") stat.rejected += 1;
    }

    return Array.from(statsMap.values()).filter(
      (s) => s.total > 0 || (s.type !== null && EstimateTypes.includes(s.type))
    );
  }

  // =============================================================================
  // INDIVIDUAL OPERATIONS
  // =============================================================================

  async getById(estimateId: number): Promise<EstimateWithLineItems | null> {
    const [
      { data: estimate, error: estimateError },
      { data: lineItems, error: lineItemsError },
      { data: alternates, error: alternatesError },
      { data: allowances, error: allowancesError },
      { data: divisionTotals, error: divisionError },
    ] = await Promise.all([
      this.supabase
        .from("estimates")
        .select("*")
        .eq("estimate_id", estimateId)
        .eq("is_deleted", false)
        .single(),
      this.supabase
        .from("estimate_line_items")
        .select("*")
        .eq("estimate_id", estimateId)
        .order("sort_order", { ascending: true }),
      this.supabase
        .from("estimate_alternates")
        .select("*")
        .eq("estimate_id", estimateId)
        .order("sort_order", { ascending: true }),
      this.supabase
        .from("estimate_allowances")
        .select("*")
        .eq("estimate_id", estimateId)
        .order("sort_order", { ascending: true }),
      this.supabase
        .from("v_estimate_division_totals")
        .select("*")
        .eq("estimate_id", estimateId),
    ]);

    if (estimateError) {
      if (estimateError.code === "PGRST116") return null; // Not found
      throw new Error(`Failed to fetch estimate: ${estimateError.message}`);
    }

    if (lineItemsError)
      throw new Error(
        `Failed to fetch estimate line items: ${lineItemsError.message}`
      );
    if (alternatesError)
      throw new Error(
        `Failed to fetch estimate alternates: ${alternatesError.message}`
      );
    if (allowancesError)
      throw new Error(
        `Failed to fetch estimate allowances: ${allowancesError.message}`
      );
    if (divisionError)
      throw new Error(
        `Failed to fetch division totals: ${divisionError.message}`
      );

    return {
      ...estimate,
      line_items: (lineItems ?? []) as EstimateLineItemRow[],
      alternates: (alternates ?? []) as EstimateAlternateRow[],
      allowances: (allowances ?? []) as EstimateAllowanceRow[],
      division_totals: (divisionTotals ?? []) as DivisionTotal[],
    } as EstimateWithLineItems;
  }

  async create(
    projectId: number,
    data: EstimateCreate,
    userId?: string
  ): Promise<EstimateRow> {
    const insertPayload: Record<string, unknown> = {
      project_id: projectId,
      title: data.title,
      estimate_number: data.estimate_number ?? null,
      revision: data.revision ?? 1,
      status: data.status ?? "draft",
      estimate_type: data.estimate_type ?? null,
      estimate_date: data.estimate_date
        ? new Date(data.estimate_date).toISOString().split("T")[0]
        : null,
      location: data.location ?? null,
      estimator: data.estimator ?? null,
      project_duration_weeks: data.project_duration_weeks ?? null,
      project_duration_months: data.project_duration_months ?? null,
      contingency_amount: data.contingency_amount ?? 0,
      insurance_rate: data.insurance_rate ?? 0.0125,
      fee_rate: data.fee_rate ?? 0.1,
      notes: data.notes ?? null,
    };

    if (userId) {
      insertPayload.created_by = userId;
    }

    const { data: estimate, error } = await this.supabase
      .from("estimates")
      .insert(insertPayload)
      .select()
      .single();

    if (error) throw new Error(`Failed to create estimate: ${error.message}`);

    const estimateRow = estimate as EstimateRow;

    const [gcSeed, detailSeed] = await Promise.all([
      this.supabase
        .from("estimate_gc_items")
        .insert(buildEstimateV2GcStarterRows(estimateRow.estimate_id)),
      this.supabase
        .from("estimate_detail_items")
        .insert(buildEstimateV2DetailStarterRows(estimateRow.estimate_id)),
    ]);

    if (gcSeed.error || detailSeed.error) {
      await Promise.allSettled([
        this.supabase
          .from("estimate_gc_items")
          .delete()
          .eq("estimate_id", estimateRow.estimate_id),
        this.supabase
          .from("estimate_detail_items")
          .delete()
          .eq("estimate_id", estimateRow.estimate_id),
        this.supabase
          .from("estimates")
          .delete()
          .eq("estimate_id", estimateRow.estimate_id),
      ]);

      if (gcSeed.error) {
        throw new Error(
          `Failed to seed estimate GC starter rows: ${gcSeed.error.message}`
        );
      }

      throw new Error(
        `Failed to seed estimate detail starter rows: ${detailSeed.error?.message ?? "Unknown error"}`
      );
    }

    return estimateRow;
  }

  async update(
    estimateId: number,
    data: Partial<EstimateUpdate>
  ): Promise<EstimateRow | null> {
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (data.title !== undefined) updatePayload.title = data.title;
    if (data.estimate_number !== undefined)
      updatePayload.estimate_number = data.estimate_number;
    if (data.revision !== undefined) updatePayload.revision = data.revision;
    if (data.status !== undefined) updatePayload.status = data.status;
    if (data.estimate_date !== undefined) {
      updatePayload.estimate_date = data.estimate_date
        ? new Date(data.estimate_date).toISOString().split("T")[0]
        : null;
    }
    if (data.location !== undefined) updatePayload.location = data.location;
    if (data.estimator !== undefined) updatePayload.estimator = data.estimator;
    if (data.project_duration_weeks !== undefined)
      updatePayload.project_duration_weeks = data.project_duration_weeks;
    if (data.project_duration_months !== undefined)
      updatePayload.project_duration_months = data.project_duration_months;
    if (data.contingency_amount !== undefined)
      updatePayload.contingency_amount = data.contingency_amount;
    if (data.insurance_rate !== undefined)
      updatePayload.insurance_rate = data.insurance_rate;
    if (data.fee_rate !== undefined) updatePayload.fee_rate = data.fee_rate;
    if (data.notes !== undefined) updatePayload.notes = data.notes;
    if ((data as EstimateMutationInput).estimate_type !== undefined)
      updatePayload.estimate_type = (data as EstimateMutationInput).estimate_type;

    const { data: updated, error } = await this.supabase
      .from("estimates")
      .update(updatePayload)
      .eq("estimate_id", estimateId)
      .eq("is_deleted", false)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Failed to update estimate: ${error.message}`);
    }

    return updated as EstimateRow;
  }

  async delete(estimateId: number): Promise<boolean> {
    const { error } = await this.supabase
      .from("estimates")
      .update({
        is_deleted: true,
        updated_at: new Date().toISOString(),
      })
      .eq("estimate_id", estimateId);

    if (error) throw new Error(`Failed to delete estimate: ${error.message}`);

    return true;
  }

  // =============================================================================
  // LINE ITEM OPERATIONS
  // =============================================================================

  async addLineItem(
    estimateId: number,
    lineItem: Omit<EstimateLineItem, "line_item_id">
  ): Promise<EstimateLineItemRow> {
    const computed = calculateLineItemCosts(lineItem);

    const { data, error } = await this.supabase
      .from("estimate_line_items")
      .insert({
        estimate_id: estimateId,
        line_number: lineItem.line_number ?? null,
        division_code: lineItem.division_code,
        description: lineItem.description ?? null,
        length: lineItem.length ?? null,
        width: lineItem.width ?? null,
        depth: lineItem.depth ?? null,
        number_of_each: lineItem.number_of_each ?? null,
        quantity: lineItem.quantity ?? null,
        unit: lineItem.unit ?? null,
        material_unit_price: lineItem.material_unit_price ?? 0,
        material_cost: computed.material_cost,
        labor_crew_size: lineItem.labor_crew_size ?? null,
        labor_hours: lineItem.labor_hours ?? null,
        labor_man_hours: computed.labor_man_hours,
        labor_rate: lineItem.labor_rate ?? null,
        labor_cost: computed.labor_cost,
        equipment_duration: lineItem.equipment_duration ?? null,
        equipment_unit: lineItem.equipment_unit ?? null,
        equipment_rate: lineItem.equipment_rate ?? null,
        equipment_cost: computed.equipment_cost,
        subcontract_unit_price: lineItem.subcontract_unit_price ?? 0,
        subcontract_cost: computed.subcontract_cost,
        total_cost: computed.total_cost,
        comments: lineItem.comments ?? null,
        comment_type: lineItem.comment_type ?? null,
        vendor_name: lineItem.vendor_name ?? null,
        gc_cost_code: lineItem.gc_cost_code ?? null,
        sort_order: lineItem.sort_order ?? 0,
      })
      .select()
      .single();

    if (error)
      throw new Error(`Failed to add line item: ${error.message}`);

    return data as EstimateLineItemRow;
  }

  async updateLineItem(
    lineItemId: number,
    data: Partial<EstimateLineItem>
  ): Promise<EstimateLineItemRow | null> {
    // Fetch the existing row so we can recompute costs with merged values
    const { data: existing, error: fetchError } = await this.supabase
      .from("estimate_line_items")
      .select("*")
      .eq("line_item_id", lineItemId)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") return null;
      throw new Error(`Failed to fetch line item: ${fetchError.message}`);
    }

    const merged: Partial<EstimateLineItem> = { ...existing, ...data };
    const computed = calculateLineItemCosts(merged);

    const updatePayload: Record<string, unknown> = { ...computed };

    if (data.line_number !== undefined)
      updatePayload.line_number = data.line_number;
    if (data.division_code !== undefined)
      updatePayload.division_code = data.division_code;
    if (data.description !== undefined)
      updatePayload.description = data.description;
    if (data.length !== undefined) updatePayload.length = data.length;
    if (data.width !== undefined) updatePayload.width = data.width;
    if (data.depth !== undefined) updatePayload.depth = data.depth;
    if (data.number_of_each !== undefined)
      updatePayload.number_of_each = data.number_of_each;
    if (data.quantity !== undefined) updatePayload.quantity = data.quantity;
    if (data.unit !== undefined) updatePayload.unit = data.unit;
    if (data.material_unit_price !== undefined)
      updatePayload.material_unit_price = data.material_unit_price;
    if (data.labor_crew_size !== undefined)
      updatePayload.labor_crew_size = data.labor_crew_size;
    if (data.labor_hours !== undefined)
      updatePayload.labor_hours = data.labor_hours;
    if (data.labor_rate !== undefined)
      updatePayload.labor_rate = data.labor_rate;
    if (data.equipment_duration !== undefined)
      updatePayload.equipment_duration = data.equipment_duration;
    if (data.equipment_unit !== undefined)
      updatePayload.equipment_unit = data.equipment_unit;
    if (data.equipment_rate !== undefined)
      updatePayload.equipment_rate = data.equipment_rate;
    if (data.subcontract_unit_price !== undefined)
      updatePayload.subcontract_unit_price = data.subcontract_unit_price;
    if (data.comments !== undefined) updatePayload.comments = data.comments;
    if (data.comment_type !== undefined)
      updatePayload.comment_type = data.comment_type;
    if (data.vendor_name !== undefined)
      updatePayload.vendor_name = data.vendor_name;
    if (data.gc_cost_code !== undefined)
      updatePayload.gc_cost_code = data.gc_cost_code;
    if (data.sort_order !== undefined)
      updatePayload.sort_order = data.sort_order;

    const { data: updated, error } = await this.supabase
      .from("estimate_line_items")
      .update(updatePayload)
      .eq("line_item_id", lineItemId)
      .select()
      .single();

    if (error)
      throw new Error(`Failed to update line item: ${error.message}`);

    return updated as EstimateLineItemRow;
  }

  async deleteLineItem(lineItemId: number): Promise<boolean> {
    const { error } = await this.supabase
      .from("estimate_line_items")
      .delete()
      .eq("line_item_id", lineItemId);

    if (error)
      throw new Error(`Failed to delete line item: ${error.message}`);

    return true;
  }

  async bulkAddLineItems(
    estimateId: number,
    lineItems: Array<Omit<EstimateLineItem, "line_item_id">>
  ): Promise<EstimateLineItemRow[]> {
    const rows = lineItems.map((item, index) => {
      const computed = calculateLineItemCosts(item);
      return {
        estimate_id: estimateId,
        line_number: item.line_number ?? index + 1,
        division_code: item.division_code,
        description: item.description ?? null,
        length: item.length ?? null,
        width: item.width ?? null,
        depth: item.depth ?? null,
        number_of_each: item.number_of_each ?? null,
        quantity: item.quantity ?? null,
        unit: item.unit ?? null,
        material_unit_price: item.material_unit_price ?? 0,
        material_cost: computed.material_cost,
        labor_crew_size: item.labor_crew_size ?? null,
        labor_hours: item.labor_hours ?? null,
        labor_man_hours: computed.labor_man_hours,
        labor_rate: item.labor_rate ?? null,
        labor_cost: computed.labor_cost,
        equipment_duration: item.equipment_duration ?? null,
        equipment_unit: item.equipment_unit ?? null,
        equipment_rate: item.equipment_rate ?? null,
        equipment_cost: computed.equipment_cost,
        subcontract_unit_price: item.subcontract_unit_price ?? 0,
        subcontract_cost: computed.subcontract_cost,
        total_cost: computed.total_cost,
        comments: item.comments ?? null,
        comment_type: item.comment_type ?? null,
        vendor_name: item.vendor_name ?? null,
        gc_cost_code: item.gc_cost_code ?? null,
        sort_order: item.sort_order ?? index,
      };
    });

    const { data, error } = await this.supabase
      .from("estimate_line_items")
      .insert(rows)
      .select();

    if (error)
      throw new Error(`Failed to bulk add line items: ${error.message}`);

    return (data ?? []) as EstimateLineItemRow[];
  }

  // =============================================================================
  // DIVISION TOTALS
  // =============================================================================

  async getDivisionTotals(estimateId: number): Promise<DivisionTotal[]> {
    const { data, error } = await this.supabase
      .from("v_estimate_division_totals")
      .select("*")
      .eq("estimate_id", estimateId);

    if (error)
      throw new Error(`Failed to fetch division totals: ${error.message}`);

    return (data ?? []) as DivisionTotal[];
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  private mapSortField(sort: string): string {
    const mapping: Record<string, string> = {
      title: "title",
      estimate_date: "estimate_date",
      status: "status",
      estimator: "estimator",
      revision: "revision",
      created_at: "created_at",
      updated_at: "updated_at",
    };
    return mapping[sort] ?? "updated_at";
  }
}
