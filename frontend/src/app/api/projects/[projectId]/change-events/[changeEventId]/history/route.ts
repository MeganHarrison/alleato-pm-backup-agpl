import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from '@/lib/supabase/server';
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from 'next/server';
import { apiErrorResponse } from "@/lib/api-error";
import { logger } from "@/lib/logger";
import {
  formatHistoryFieldName,
  formatHistoryFieldValue,
  generateHistoryDescription,
  resolveUserEmails,
  mapChangedBy,
} from "@/lib/change-events/history-formatters";

interface RouteParams {
  params: Promise<{
    projectId: string;
    changeEventId: string;
  }>;
}

/**
 * GET /api/projects/[id]/change-events/[changeEventId]/history
 * Returns the audit history for a change event
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/change-events/[changeEventId]/history#GET",
  async ({ request, params }) => {

    const { projectId, changeEventId } = await params;
    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/change-events/[changeEventId]/history#GET", message: "Authentication required." });
    }
    const { searchParams } = new URL(request.url);

    // Verify change event exists
    const { data: changeEvent, error: eventError } = await supabase
      .from('change_events')
      .select('id')
      .eq('project_id', parseInt(projectId, 10))
      .eq('id', changeEventId)
      .single();

    if (eventError || !changeEvent) {
      return NextResponse.json(
        { error: 'Change event not found' },
        { status: 404 }
      );
    }

    // Parse query params
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Get history entries with user details
    const { data: historyEntries, error, count } = await supabase
      .from('change_event_history')
      .select(
        `
        *
        `,
        { count: 'exact' }
      )
      .eq('change_event_id', changeEventId)
      .order('changed_at', { ascending: false })
      .range(from, to);

    if (error) {
      return apiErrorResponse(error);
    }

    // Resolve user emails for changed_by UUIDs
    const uniqueUserIds = [
      ...new Set(
        (historyEntries || [])
          .map((e) => e.changed_by)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    let userEmailById: Record<string, string> = {};
    try {
      const serviceSupabase = createServiceClient();
      userEmailById = await resolveUserEmails(
        uniqueUserIds,
        (id) => serviceSupabase.auth.admin.getUserById(id),
        "change-events/history#GET",
      );
    } catch (err) {
      logger.error({ msg: "[change-events/history#GET] Service client unavailable, skipping email enrichment:", error: err instanceof Error ? err.message : String(err) });
    }

    // Format history entries
    const formattedHistory = (historyEntries || []).map(entry => {
      return {
        id: entry.id,
        changeEventId: entry.change_event_id,
        action: entry.change_type,
        fieldName: formatHistoryFieldName(entry.field_name),
        oldValue: formatHistoryFieldValue(entry.field_name, entry.old_value),
        newValue: formatHistoryFieldValue(entry.field_name, entry.new_value),
        changedBy: mapChangedBy(entry.changed_by, userEmailById),
        changedAt: entry.changed_at,
        description: generateHistoryDescription(entry),
      };
    });

    // Calculate pagination
    const totalPages = count ? Math.ceil(count / limit) : 0;

    return NextResponse.json({
      data: formattedHistory,
      pagination: {
        currentPage: page,
        pageSize: limit,
        totalRecords: count || 0,
        totalPages,
      },
      _links: {
        self: `/api/projects/${projectId}/change-events/${changeEventId}/history?page=${page}&limit=${limit}`,
        first: `/api/projects/${projectId}/change-events/${changeEventId}/history?page=1&limit=${limit}`,
        last: `/api/projects/${projectId}/change-events/${changeEventId}/history?page=${totalPages}&limit=${limit}`,
        changeEvent: `/api/projects/${projectId}/change-events/${changeEventId}`,
        ...(page > 1 && {
          prev: `/api/projects/${projectId}/change-events/${changeEventId}/history?page=${page - 1}&limit=${limit}`,
        }),
        ...(page < totalPages && {
          next: `/api/projects/${projectId}/change-events/${changeEventId}/history?page=${page + 1}&limit=${limit}`,
        }),
      },
    });
    },
);
