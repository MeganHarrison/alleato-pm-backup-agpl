/**
 * =============================================================================
 * DIRECT COST SERVICE LAYER
 * =============================================================================
 *
 * Business logic layer for Direct Costs operations
 * Handles all database interactions, calculations, and business rules
 * Provides type-safe methods for the API layer
 */

import { SupabaseClient } from "@supabase/supabase-js";
import {
  DirectCostCreate,
  DirectCostUpdate,
  DirectCostListParams,
  DirectCostWithLineItems,
  DirectCostSummary,
  CostCodeSummary,
  DirectCostRow,
  DirectCostLineItemRow,
  DirectCostFilter,
  normalizeDirectCostStatus,
} from "@/lib/schemas/direct-costs";

export class DirectCostService {
  constructor(private supabase: SupabaseClient) {}

  // =============================================================================
  // LIST OPERATIONS
  // =============================================================================

  async list(projectId: string | number, params: DirectCostListParams) {
    const {
      page,
      limit,
      sort,
      order,
      status,
      cost_type,
      vendor_id,
      employee_id,
      date_from,
      date_to,
      amount_min,
      amount_max,
      search,
    } = params;

    // Build the main query
    let query = this.supabase
      .from("direct_costs")
      .select(
        `
        *,
        line_items:direct_cost_line_items(*),
        vendor:companies(*)
      `
      )
      .eq("project_id", projectId)
      .eq("is_deleted", false);

    // Apply filters
    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (cost_type && cost_type !== "all") {
      query = query.eq("cost_type", cost_type);
    }

    if (vendor_id) {
      query = query.eq("vendor_id", vendor_id);
    }

    if (employee_id) {
      query = query.eq("employee_id", employee_id);
    }

    if (date_from) {
      query = query.gte("date", date_from.toISOString().split("T")[0]);
    }

    if (date_to) {
      query = query.lte("date", date_to.toISOString().split("T")[0]);
    }

    if (amount_min !== undefined) {
      query = query.gte("total_amount", amount_min);
    }

    if (amount_max !== undefined) {
      query = query.lte("total_amount", amount_max);
    }

    // Apply search across multiple fields
    if (search) {
      query = query.or(
        `description.ilike.%${search}%,invoice_number.ilike.%${search}%`
      );
    }

    // Apply sorting
    const sortField = this.mapSortField(sort);
    query = query.order(sortField, { ascending: order === "asc" });

    // Get total count for pagination (before applying limit/offset)
    const countQuery = this.supabase
      .from("direct_costs")
      .select("*", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("is_deleted", false);

    // Apply same filters to count query
    let filteredCountQuery = countQuery;

    if (status && status !== "all") {
      filteredCountQuery = filteredCountQuery.eq("status", status);
    }

    if (cost_type && cost_type !== "all") {
      filteredCountQuery = filteredCountQuery.eq("cost_type", cost_type);
    }

    if (vendor_id) {
      filteredCountQuery = filteredCountQuery.eq("vendor_id", vendor_id);
    }

    if (employee_id) {
      filteredCountQuery = filteredCountQuery.eq("employee_id", employee_id);
    }

    if (date_from) {
      filteredCountQuery = filteredCountQuery.gte(
        "date",
        date_from.toISOString().split("T")[0]
      );
    }

    if (date_to) {
      filteredCountQuery = filteredCountQuery.lte(
        "date",
        date_to.toISOString().split("T")[0]
      );
    }

    if (amount_min !== undefined) {
      filteredCountQuery = filteredCountQuery.gte("total_amount", amount_min);
    }

    if (amount_max !== undefined) {
      filteredCountQuery = filteredCountQuery.lte("total_amount", amount_max);
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    // Execute both queries
    const [{ data, error }, { count, error: countError }] = await Promise.all([
      query,
      filteredCountQuery,
    ]);

    if (error)
      throw new Error(`Failed to fetch direct costs: ${error.message}`);
    if (countError)
      throw new Error(`Failed to count direct costs: ${countError.message}`);

    return {
      data: data as DirectCostWithLineItems[],
      pagination: {
        current_page: page,
        per_page: limit,
        total_records: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
        has_next_page: (count || 0) > offset + limit,
        has_prev_page: page > 1,
      },
    };
  }

  // =============================================================================
  // INDIVIDUAL OPERATIONS
  // =============================================================================

  async getById(
    projectId: string | number,
    costId: string
  ): Promise<DirectCostWithLineItems | null> {
    const { data, error } = await this.supabase
      .from("direct_costs")
      .select(
        `
        *,
        line_items:direct_cost_line_items(
          *,
          budget_code:project_budget_codes(cost_code_id, description)
        ),
        vendor:companies(*)
      `
      )
      .eq("project_id", projectId)
      .eq("id", costId)
      .eq("is_deleted", false)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null; // Not found
      throw new Error(`Failed to fetch direct cost: ${error.message}`);
    }

    return data as DirectCostWithLineItems;
  }

  async create(
    projectId: string | number,
    data: DirectCostCreate
  ): Promise<DirectCostWithLineItems> {
    // Get current user
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) throw new Error("Authentication required");

    // Calculate total from line items
    const total_amount = this.calculateTotal(
      data.line_items.map((item) => ({
        quantity: item.quantity,
        unit_cost: item.unit_cost,
      }))
    );

    // Start a transaction
    const { data: directCost, error: costError } = await this.supabase
      .from("direct_costs")
      .insert({
        project_id: projectId,
        cost_type: data.cost_type,
        date: data.date.toISOString().split("T")[0],
        vendor_id: data.vendor_id || null,
        employee_id: data.employee_id || null,
        invoice_number: data.invoice_number || null,
        status: normalizeDirectCostStatus(data.status),
        description: data.description || null,
        terms: data.terms || null,
        received_date: data.received_date
          ? data.received_date.toISOString().split("T")[0]
          : null,
        paid_date: data.paid_date
          ? data.paid_date.toISOString().split("T")[0]
          : null,
        total_amount,
        created_by_user_id: user.id,
        updated_by_user_id: user.id,
      })
      .select()
      .single();

    if (costError)
      throw new Error(`Failed to create direct cost: ${costError.message}`);

    // Create line items
    const lineItemsToInsert = data.line_items.map((item, index) => {
      const budgetCodeId = item.budget_code_id;
      if (!budgetCodeId) {
        throw new Error("Budget code is required for each direct cost line item.");
      }

      return {
        direct_cost_id: directCost.id,
        budget_code_id: budgetCodeId,
        description: item.description || null,
        quantity: item.quantity,
        uom: item.uom,
        unit_cost: item.unit_cost,
        line_order: item.line_order || index + 1,
      };
    });

    const { data: lineItems, error: lineItemsError } = await this.supabase
      .from("direct_cost_line_items")
      .insert(lineItemsToInsert)
      .select();

    if (lineItemsError) {
      // Cleanup the direct cost if line items failed
      await this.supabase.from("direct_costs").delete().eq("id", directCost.id);
      throw new Error(`Failed to create line items: ${lineItemsError.message}`);
    }

    // Log audit trail
    await this.logAudit(directCost.id, "CREATE", {}, user.id);

    // Return with line items
    return {
      ...directCost,
      line_items: lineItems,
    } as DirectCostWithLineItems;
  }

  async update(
    projectId: string | number,
    costId: string,
    data: DirectCostUpdate
  ): Promise<DirectCostWithLineItems | null> {
    // Get current user
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) throw new Error("Authentication required");

    // Fetch existing cost for audit trail
    const existing = await this.getById(projectId, costId);
    if (!existing) throw new Error("Direct cost not found");

    const updateData: Partial<DirectCostRow> = {
      updated_by_user_id: user.id,
      updated_at: new Date().toISOString(),
    };

    const changedFields: Record<string, { old: unknown; new: unknown }> = {};

    // Update only provided fields
    if (data.cost_type !== undefined) {
      updateData.cost_type = data.cost_type;
      if (data.cost_type !== existing.cost_type) {
        changedFields.cost_type = {
          old: existing.cost_type,
          new: data.cost_type,
        };
      }
    }

    if (data.date !== undefined) {
      const newDate = data.date.toISOString().split("T")[0];
      updateData.date = newDate;
      const existingDate =
        typeof existing.date === "string"
          ? existing.date
          : existing.date.toISOString().split("T")[0];
      if (newDate !== existingDate) {
        changedFields.date = { old: existingDate, new: newDate };
      }
    }

    if (data.vendor_id !== undefined) {
      updateData.vendor_id = data.vendor_id;
      if (data.vendor_id !== existing.vendor_id) {
        changedFields.vendor_id = {
          old: existing.vendor_id,
          new: data.vendor_id,
        };
      }
    }

    if (data.employee_id !== undefined) {
      updateData.employee_id = data.employee_id;
      if (data.employee_id !== existing.employee_id) {
        changedFields.employee_id = {
          old: existing.employee_id,
          new: data.employee_id,
        };
      }
    }

    if (data.invoice_number !== undefined) {
      updateData.invoice_number = data.invoice_number;
      if (data.invoice_number !== existing.invoice_number) {
        changedFields.invoice_number = {
          old: existing.invoice_number,
          new: data.invoice_number,
        };
      }
    }

    if (data.status !== undefined) {
      const normalizedStatus = normalizeDirectCostStatus(data.status);
      updateData.status = normalizedStatus;
      if (normalizedStatus !== existing.status) {
        changedFields.status = { old: existing.status, new: data.status };
      }
    }

    if (data.description !== undefined) {
      updateData.description = data.description;
      if (data.description !== existing.description) {
        changedFields.description = {
          old: existing.description,
          new: data.description,
        };
      }
    }

    if (data.terms !== undefined) {
      updateData.terms = data.terms;
      if (data.terms !== existing.terms) {
        changedFields.terms = { old: existing.terms, new: data.terms };
      }
    }

    if (data.received_date !== undefined) {
      const newReceived = data.received_date
        ? data.received_date.toISOString().split("T")[0]
        : null;
      updateData.received_date = newReceived;
      const existingReceived =
        existing.received_date instanceof Date
          ? existing.received_date.toISOString().split("T")[0]
          : existing.received_date;
      if (newReceived !== existingReceived) {
        changedFields.received_date = {
          old: existingReceived,
          new: newReceived,
        };
      }
    }

    if (data.paid_date !== undefined) {
      const newPaid = data.paid_date
        ? data.paid_date.toISOString().split("T")[0]
        : null;
      updateData.paid_date = newPaid;
      const existingPaid =
        existing.paid_date instanceof Date
          ? existing.paid_date.toISOString().split("T")[0]
          : existing.paid_date;
      if (newPaid !== existingPaid) {
        changedFields.paid_date = { old: existingPaid, new: newPaid };
      }
    }

    // Update line items if provided
    if (data.line_items !== undefined) {
      // Calculate new total
      updateData.total_amount = this.calculateTotal(
        data.line_items.map((item) => ({
          quantity: item.quantity || 0,
          unit_cost: item.unit_cost || 0,
        }))
      );

      // Delete existing line items and insert new ones
      const { error: deleteError } = await this.supabase
        .from("direct_cost_line_items")
        .delete()
        .eq("direct_cost_id", costId);

      if (deleteError)
        throw new Error(`Failed to update line items: ${deleteError.message}`);

      // Insert new line items
      const lineItemsToInsert = data.line_items.map((item, index) => {
        const budgetCodeId = item.budget_code_id;
        if (!budgetCodeId) {
          throw new Error("Budget code is required for each direct cost line item.");
        }

        return {
        id: item.id, // May be undefined for new items
        direct_cost_id: costId,
        budget_code_id: budgetCodeId,
        description: item.description || null,
        quantity: item.quantity,
        uom: item.uom,
        unit_cost: item.unit_cost,
        line_order: item.line_order || index + 1,
        };
      });

      const { error: insertError } = await this.supabase
        .from("direct_cost_line_items")
        .insert(lineItemsToInsert);

      if (insertError)
        throw new Error(`Failed to update line items: ${insertError.message}`);

      changedFields.line_items = {
        old: existing.line_items,
        new: data.line_items,
      };
    }

    // Update the direct cost
    const { data: updatedCost, error: updateError } = await this.supabase
      .from("direct_costs")
      .update(updateData)
      .eq("id", costId)
      .eq("project_id", projectId)
      .select()
      .single();

    if (updateError)
      throw new Error(`Failed to update direct cost: ${updateError.message}`);

    // Log audit trail
    if (Object.keys(changedFields).length > 0) {
      await this.logAudit(costId, "UPDATE", changedFields, user.id);
    }

    // Return updated cost with details
    return this.getById(projectId, costId);
  }

  async delete(projectId: string | number, costId: string): Promise<boolean> {
    // Get current user
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) throw new Error("Authentication required");

    // Soft delete
    const { error } = await this.supabase
      .from("direct_costs")
      .update({
        is_deleted: true,
        updated_by_user_id: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", costId)
      .eq("project_id", projectId);

    if (error)
      throw new Error(`Failed to delete direct cost: ${error.message}`);

    // Log audit trail
    await this.logAudit(costId, "DELETE", {}, user.id);

    return true;
  }

  // =============================================================================
  // SUMMARY OPERATIONS
  // =============================================================================

  async getSummary(projectId: string | number): Promise<DirectCostSummary> {
    // Get aggregated data
    const { data: costs, error } = await this.supabase
      .from("direct_costs")
      .select("total_amount, status, cost_type, created_at")
      .eq("project_id", projectId)
      .eq("is_deleted", false);

    if (error) throw new Error(`Failed to fetch summary: ${error.message}`);
    if (!costs) return this.emptySummary();

    // Calculate totals by status
    const totals = costs.reduce(
      (acc, cost) => {
        acc.total_amount += cost.total_amount;

        switch (cost.status) {
          case "Draft":
            acc.draft_amount += cost.total_amount;
            break;
          case "Approved":
            acc.approved_amount += cost.total_amount;
            break;
          case "Paid":
            acc.paid_amount += cost.total_amount;
            break;
          case "Rejected":
            acc.rejected_amount += cost.total_amount;
            break;
        }

        return acc;
      },
      {
        total_amount: 0,
        approved_amount: 0,
        paid_amount: 0,
        draft_amount: 0,
        rejected_amount: 0,
      }
    );

    // Count by status and type
    const count_by_status = this.groupByField(costs, "status");
    const count_by_cost_type = this.groupByField(costs, "cost_type");

    // Get recent activity
    const { data: recentCosts } = await this.supabase
      .from("direct_costs")
      .select("*, vendor:companies(*)")
      .eq("project_id", projectId)
      .eq("is_deleted", false)
      .order("updated_at", { ascending: false })
      .limit(5);

    // Generate monthly trend
    const monthly_trend = this.calculateMonthlyTrend(costs);

    return {
      ...totals,
      count_by_status,
      count_by_cost_type,
      recent_activity: (recentCosts || []) as DirectCostWithLineItems[],
      monthly_trend,
    };
  }

  async getSummaryByCostCode(
    projectId: string | number,
    params: DirectCostListParams
  ): Promise<{ data: CostCodeSummary[]; pagination: unknown }> {
    const { page, limit } = params;

    const { data, error } = await this.supabase
      .from("direct_costs")
      .select(
        `
        cost_type,
        line_items:direct_cost_line_items(
          budget_code_id,
          line_total,
          budget_code:project_budget_codes(cost_code_id, description)
        )
      `
      )
      .eq("project_id", projectId)
      .eq("is_deleted", false);

    if (error)
      throw new Error(`Failed to fetch cost code summary: ${error.message}`);

    const summaryMap = new Map<string, CostCodeSummary>();

    for (const cost of data || []) {
      for (const lineItem of cost.line_items || []) {
        if (!lineItem.budget_code_id) continue;

        const budgetCode = Array.isArray(lineItem.budget_code)
          ? lineItem.budget_code[0]
          : lineItem.budget_code;

        const existing: CostCodeSummary = summaryMap.get(lineItem.budget_code_id) ?? {
          budget_code_id: lineItem.budget_code_id,
          budget_code: budgetCode?.cost_code_id || lineItem.budget_code_id,
          budget_description: budgetCode?.description || "",
          total_amount: 0,
          item_count: 0,
          cost_types: [],
        };

        const amount = lineItem.line_total || 0;
        existing.total_amount += amount;
        existing.item_count += 1;

        const costTypeEntry = existing.cost_types.find(
          (entry) => entry.cost_type === cost.cost_type
        );

        if (costTypeEntry) {
          costTypeEntry.amount += amount;
          costTypeEntry.count += 1;
        } else {
          existing.cost_types.push({
            cost_type: cost.cost_type,
            amount,
            count: 1,
          });
        }

        summaryMap.set(lineItem.budget_code_id, existing);
      }
    }

    const summaryRows = Array.from(summaryMap.values()).sort((a, b) =>
      a.budget_code.localeCompare(b.budget_code)
    );

    const totalAmount =
      summaryRows.reduce((sum, item) => sum + (item.total_amount || 0), 0) || 0;

    const summaryWithPercentages: CostCodeSummary[] = summaryRows.map((item) => ({
      ...item,
      percentage_of_total:
        totalAmount > 0 ? ((item.total_amount || 0) / totalAmount) * 100 : 0,
    }));

    // Apply pagination
    const offset = (page - 1) * limit;
    const paginatedData = summaryWithPercentages.slice(offset, offset + limit);

    return {
      data: paginatedData,
      pagination: {
        current_page: page,
        per_page: limit,
        total_records: summaryWithPercentages.length,
        total_pages: Math.ceil(summaryWithPercentages.length / limit),
      },
    };
  }

  // =============================================================================
  // BULK OPERATIONS
  // =============================================================================

  async bulkStatusUpdate(
    projectId: string | number,
    ids: string[],
    status: DirectCostRow["status"],
    reason?: string
  ): Promise<{
    success: string[];
    failed: Array<{ id: string; error: string }>;
  }> {
    // Get current user
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) throw new Error("Authentication required");

    const success: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    // Process each ID individually to track success/failure
    for (const id of ids) {
      try {
        const { error } = await this.supabase
          .from("direct_costs")
          .update({
            status,
            updated_by_user_id: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .eq("project_id", projectId)
          .eq("is_deleted", false);

        if (error) {
          failed.push({ id, error: error.message });
        } else {
          success.push(id);
          // Log audit trail
          await this.logAudit(
            id,
            "BULK_STATUS_UPDATE",
            { status, reason },
            user.id
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "an unexpected error occurred";
        failed.push({ id, error: message });
      }
    }

    return { success, failed };
  }

  async bulkDelete(
    projectId: string | number,
    ids: string[],
    reason?: string
  ): Promise<{
    success: string[];
    failed: Array<{ id: string; error: string }>;
  }> {
    // Get current user
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) throw new Error("Authentication required");

    const success: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    // Process each ID individually to track success/failure
    for (const id of ids) {
      try {
        const { error } = await this.supabase
          .from("direct_costs")
          .update({
            is_deleted: true,
            updated_by_user_id: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .eq("project_id", projectId)
          .eq("is_deleted", false);

        if (error) {
          failed.push({ id, error: error.message });
        } else {
          success.push(id);
          // Log audit trail
          await this.logAudit(id, "BULK_DELETE", { reason }, user.id);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "an unexpected error occurred";
        failed.push({ id, error: message });
      }
    }

    return { success, failed };
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  private calculateTotal(
    lineItems: Array<{ quantity: number; unit_cost: number }>
  ): number {
    return lineItems.reduce(
      (sum, item) => sum + item.quantity * item.unit_cost,
      0
    );
  }

  private mapSortField(sort: string): string {
    const mapping: Record<string, string> = {
      date: "date",
      amount: "total_amount",
      status: "status",
      vendor: "vendor_name",
      cost_type: "cost_type",
      created_at: "created_at",
    };
    return mapping[sort] || "date";
  }

  private groupByField(
    items: Array<{ [key: string]: unknown }>,
    field: string
  ): Record<string, number> {
    return items.reduce<Record<string, number>>((acc, item) => {
      // Safely extract and convert the field value to string
      const fieldValue = item[field];
      const value = fieldValue != null ? String(fieldValue) : "undefined";

      // Ensure the accumulator properly tracks counts
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
  }

  private calculateMonthlyTrend(
    costs: Array<{ total_amount: number; status: string; created_at: string }>
  ) {
    const months: Record<
      string,
      { total: number; approved: number; paid: number }
    > = {};

    costs.forEach((cost) => {
      const month = new Date(cost.created_at).toISOString().slice(0, 7); // YYYY-MM

      if (!months[month]) {
        months[month] = { total: 0, approved: 0, paid: 0 };
      }

      months[month].total += cost.total_amount;

      if (cost.status === "Approved") {
        months[month].approved += cost.total_amount;
      }

      if (cost.status === "Paid") {
        months[month].paid += cost.total_amount;
      }
    });

    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12) // Last 12 months
      .map(([month, data]) => ({ month, ...data }));
  }

  private emptySummary(): DirectCostSummary {
    return {
      total_amount: 0,
      approved_amount: 0,
      paid_amount: 0,
      draft_amount: 0,
      rejected_amount: 0,
      count_by_status: {} as Record<string, number>,
      count_by_cost_type: {} as Record<string, number>,
      recent_activity: [],
      monthly_trend: [],
    };
  }

  private async logAudit(
    directCostId: string,
    action: string,
    changedFields: Record<string, unknown>,
    userId: string
  ): Promise<void> {
    void directCostId;
    void action;
    void changedFields;
    void userId;
  }
}
