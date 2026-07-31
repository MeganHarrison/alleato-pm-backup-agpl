import { NextResponse } from "next/server";

import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { deriveMeetingStatus, selectCarryoverItems } from "@/lib/meetings/domain";
import { loadMeetingDetail } from "@/lib/meetings/server";
import { parseProjectId } from "@/lib/meetings/route-params";
import { createMeetingSchema } from "@/lib/meetings/schemas";

const DEFAULT_CATEGORY_NAME = "Uncategorized Items";

const STATUS_VALUES = ["draft", "awaiting_minutes", "minutes"] as const;
type MeetingStatusFilter = (typeof STATUS_VALUES)[number];

function isMeetingStatusFilter(value: string | null): value is MeetingStatusFilter {
  return value !== null && (STATUS_VALUES as readonly string[]).includes(value);
}

// Postgres unique_violation error code.
const POSTGRES_UNIQUE_VIOLATION = "23505";

// GET: List meetings for a project, grouped by series
export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/meetings#GET",
  async ({ request, params }) => {
    const where = "projects/[projectId]/meetings#GET";
    const { projectId } = await params;
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where,
        message: "Authentication required.",
      });
    }

    const numericProjectId = parseProjectId(projectId, where);
    const supabase = await createClient();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || null;
    const statusFilterRaw = searchParams.get("status");
    const statusFilter = isMeetingStatusFilter(statusFilterRaw) ? statusFilterRaw : null;
    const deletedMode = searchParams.get("deleted") === "only" ? "only" : "exclude";

    let meetingsQuery = supabase
      .from("meetings")
      .select(
        "id, series_id, number, name, meeting_date, location, is_draft, mode, template_id, transcript_document_id",
      )
      .eq("project_id", numericProjectId);

    meetingsQuery =
      deletedMode === "only"
        ? meetingsQuery.not("deleted_at", "is", null)
        : meetingsQuery.is("deleted_at", null);

    const { data: meetingRows, error: meetingsError } = await meetingsQuery;

    if (meetingsError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: `Failed to load meetings: ${meetingsError.message}`,
        details: meetingsError,
      });
    }

    const { data: seriesRows, error: seriesError } = await supabase
      .from("meeting_series")
      .select("id, name")
      .eq("project_id", numericProjectId);

    if (seriesError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: `Failed to load meeting series: ${seriesError.message}`,
        details: seriesError,
      });
    }

    const seriesNameById = new Map(
      (seriesRows ?? []).map((series) => [series.id as string, series.name as string]),
    );

    type MeetingRow = {
      id: string;
      series_id: string;
      number: number;
      name: string;
      meeting_date: string | null;
      location: string | null;
      is_draft: boolean;
      mode: string;
      template_id: string | null;
      transcript_document_id: string | null;
    };

    const meetings = (meetingRows ?? []) as MeetingRow[];
    const meetingIds = meetings.map((meeting) => meeting.id);

    // One batched query for agenda item counts, grouped client-side by meeting_id.
    const agendaItemCountByMeetingId = new Map<string, number>();
    if (meetingIds.length > 0) {
      const { data: itemRows, error: itemsError } = await supabase
        .from("meeting_items")
        .select("meeting_id")
        .in("meeting_id", meetingIds);

      if (itemsError) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where,
          message: `Failed to load agenda item counts: ${itemsError.message}`,
          details: itemsError,
        });
      }

      for (const row of (itemRows ?? []) as Array<{ meeting_id: string }>) {
        agendaItemCountByMeetingId.set(
          row.meeting_id,
          (agendaItemCountByMeetingId.get(row.meeting_id) ?? 0) + 1,
        );
      }
    }

    // One batched query for template names, keyed by template_id.
    const templateNameById = new Map<string, string>();
    const templateIds = Array.from(
      new Set(
        meetings
          .map((meeting) => meeting.template_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    if (templateIds.length > 0) {
      const { data: templateRows, error: templatesError } = await supabase
        .from("meeting_templates")
        .select("id, name")
        .in("id", templateIds);

      if (templatesError) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where,
          message: `Failed to load meeting templates: ${templatesError.message}`,
          details: templatesError,
        });
      }

      for (const row of (templateRows ?? []) as Array<{ id: string; name: string }>) {
        templateNameById.set(row.id, row.name);
      }
    }

    const searchLower = search?.toLowerCase() ?? null;

    type MeetingListItem = {
      id: string;
      number: number;
      name: string;
      meeting_date: string | null;
      location: string | null;
      status: ReturnType<typeof deriveMeetingStatus>;
      agenda_item_count: number;
      template_id: string | null;
      template_name: string | null;
      transcript_document_id: string | null;
    };

    const meetingsBySeriesId = new Map<string, MeetingListItem[]>();

    for (const meeting of meetings) {
      const status = deriveMeetingStatus({
        is_draft: meeting.is_draft,
        mode: meeting.mode as "agenda" | "minutes",
      });

      if (statusFilter && status !== statusFilter) continue;

      const seriesName = seriesNameById.get(meeting.series_id) ?? "";

      if (searchLower) {
        const matchesMeetingName = meeting.name.toLowerCase().includes(searchLower);
        const matchesSeriesName = seriesName.toLowerCase().includes(searchLower);
        if (!matchesMeetingName && !matchesSeriesName) continue;
      }

      const listItem: MeetingListItem = {
        id: meeting.id,
        number: meeting.number,
        name: meeting.name,
        meeting_date: meeting.meeting_date,
        location: meeting.location,
        status,
        agenda_item_count: agendaItemCountByMeetingId.get(meeting.id) ?? 0,
        template_id: meeting.template_id,
        template_name: meeting.template_id
          ? (templateNameById.get(meeting.template_id) ?? null)
          : null,
        transcript_document_id: meeting.transcript_document_id,
      };

      const current = meetingsBySeriesId.get(meeting.series_id) ?? [];
      current.push(listItem);
      meetingsBySeriesId.set(meeting.series_id, current);
    }

    const series = Array.from(meetingsBySeriesId.entries()).map(([seriesId, seriesMeetings]) => {
      const sortedMeetings = [...seriesMeetings].sort((a, b) => b.number - a.number);
      return {
        series_id: seriesId,
        name: seriesNameById.get(seriesId) ?? "",
        meetings: sortedMeetings,
        _mostRecentDate: sortedMeetings.reduce<string | null>((latest, meeting) => {
          if (!meeting.meeting_date) return latest;
          if (!latest) return meeting.meeting_date;
          return meeting.meeting_date > latest ? meeting.meeting_date : latest;
        }, null),
      };
    });

    series.sort((a, b) => {
      if (a._mostRecentDate === b._mostRecentDate) return 0;
      if (a._mostRecentDate === null) return 1;
      if (b._mostRecentDate === null) return -1;
      return b._mostRecentDate.localeCompare(a._mostRecentDate);
    });

    const responseSeries = series.map(({ series_id, name, meetings: seriesMeetings }) => ({
      series_id,
      name,
      meetings: seriesMeetings,
    }));

    return NextResponse.json({ series: responseSeries });
  },
);

// POST: Create a new meeting (upserts series, numbers meeting, seeds default
// category, copies template categories/items when template_id is provided).
export const POST = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/meetings#POST",
  async ({ request, params }) => {
    const where = "projects/[projectId]/meetings#POST";
    const { projectId } = await params;
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where,
        message: "Authentication required.",
      });
    }

    // Captured after the null check so the hoisted insertMeeting function
    // declaration below sees a non-nullable id (narrowing doesn't propagate
    // into function declarations).
    const createdByUserId = user.id;

    const numericProjectId = parseProjectId(projectId, where);
    const payload = await parseJsonBody(request, createMeetingSchema, where);
    const supabase = await createClient();

    const seriesName = payload.series_name?.trim() || payload.name.trim();

    // 1. Upsert meeting_series by (project_id, name)
    const { data: existingSeries, error: existingSeriesError } = await supabase
      .from("meeting_series")
      .select("id, name")
      .eq("project_id", numericProjectId)
      .eq("name", seriesName)
      .maybeSingle();

    if (existingSeriesError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: `Failed to look up meeting series: ${existingSeriesError.message}`,
        details: existingSeriesError,
      });
    }

    let seriesId: string;
    if (existingSeries) {
      seriesId = existingSeries.id;
    } else {
      const { data: newSeries, error: newSeriesError } = await supabase
        .from("meeting_series")
        .insert({ project_id: numericProjectId, name: seriesName })
        .select("id")
        .single();

      if (newSeriesError || !newSeries) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where,
          message: `Failed to create meeting series: ${newSeriesError?.message ?? "Unknown insert failure"}`,
          details: newSeriesError,
        });
      }
      seriesId = newSeries.id;
    }

    // 2 & 3. number = max(number) + 1 within the series, then insert the meeting.
    // A concurrent double-submit can compute the same next number and race on the
    // unique(series_id, number) constraint. On that specific conflict, re-read the
    // max and retry the insert exactly once before giving up.
    async function computeNextNumber(): Promise<number> {
      const { data: maxNumberRows, error: maxNumberError } = await supabase
        .from("meetings")
        .select("number")
        .eq("series_id", seriesId)
        .order("number", { ascending: false })
        .limit(1);

      if (maxNumberError) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where,
          message: `Failed to compute next meeting number: ${maxNumberError.message}`,
          details: maxNumberError,
        });
      }

      return ((maxNumberRows ?? [])[0]?.number ?? 0) + 1;
    }

    async function insertMeeting(number: number) {
      return supabase
        .from("meetings")
        .insert({
          project_id: numericProjectId,
          series_id: seriesId,
          number,
          name: payload.name,
          meeting_date: payload.meeting_date ?? null,
          timezone: payload.timezone,
          start_time: payload.start_time ?? null,
          end_time: payload.end_time ?? null,
          location: payload.location ?? null,
          meeting_link: payload.meeting_link ?? null,
          is_private: payload.is_private ?? false,
          is_draft: payload.is_draft ?? false,
          overview: payload.overview ?? null,
          template_id: payload.template_id ?? null,
          created_by: createdByUserId,
        })
        .select("*")
        .single();
    }

    let nextNumber = await computeNextNumber();
    let { data: newMeeting, error: newMeetingError } = await insertMeeting(nextNumber);

    if (newMeetingError?.code === POSTGRES_UNIQUE_VIOLATION) {
      // Another meeting was created in this series between our max-number read
      // and our insert. Re-read the max and retry exactly once.
      nextNumber = await computeNextNumber();
      ({ data: newMeeting, error: newMeetingError } = await insertMeeting(nextNumber));

      if (newMeetingError?.code === POSTGRES_UNIQUE_VIOLATION) {
        throw new GuardrailError({
          code: "PRECONDITION_FAILED",
          where,
          message:
            "Meeting number conflict — another meeting was created in this series at the same time; please retry",
          details: newMeetingError,
        });
      }
    }

    if (newMeetingError || !newMeeting) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: `Failed to create meeting: ${newMeetingError?.message ?? "Unknown insert failure"}`,
        details: newMeetingError,
      });
    }

    const meetingId = newMeeting.id as string;

    // 4-6. Attendees, default category, and (optional) template copy. If any of
    // these post-insert steps fail, the meeting row would otherwise be left
    // behind as an orphaned stub. Best-effort delete it before rethrowing the
    // original error (never delete the series — it may be shared).
    try {
      // 4. Insert attendees
      const attendeePersonIds = payload.attendee_person_ids ?? [];
      if (attendeePersonIds.length > 0) {
        const { error: attendeesError } = await supabase.from("meeting_attendees").insert(
          attendeePersonIds.map((personId) => ({
            meeting_id: meetingId,
            person_id: personId,
          })),
        );

        if (attendeesError) {
          throw new GuardrailError({
            code: "INTERNAL_ERROR",
            where,
            message: `Failed to add meeting attendees: ${attendeesError.message}`,
            details: attendeesError,
          });
        }
      }

      // 5. Insert default category
      const { error: defaultCategoryError } = await supabase.from("meeting_categories").insert({
        meeting_id: meetingId,
        name: DEFAULT_CATEGORY_NAME,
        position: 0,
      });

      if (defaultCategoryError) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where,
          message: `Failed to create default meeting category: ${defaultCategoryError.message}`,
          details: defaultCategoryError,
        });
      }

      // 6. If a template was selected, copy its categories + items
      if (payload.template_id) {
        const { data: templateCategories, error: templateCategoriesError } = await supabase
          .from("meeting_template_categories")
          .select("id, name, position")
          .eq("template_id", payload.template_id)
          .order("position", { ascending: true });

        if (templateCategoriesError) {
          throw new GuardrailError({
            code: "INTERNAL_ERROR",
            where,
            message: `Failed to load template categories: ${templateCategoriesError.message}`,
            details: templateCategoriesError,
          });
        }

        const categories = (templateCategories ?? []) as Array<{
          id: string;
          name: string;
          position: number;
        }>;

        if (categories.length > 0) {
          const templateCategoryIds = categories.map((category) => category.id);

          const { data: templateItems, error: templateItemsError } = await supabase
            .from("meeting_template_items")
            .select("id, template_category_id, title, description, priority, position")
            .in("template_category_id", templateCategoryIds)
            .order("position", { ascending: true });

          if (templateItemsError) {
            throw new GuardrailError({
              code: "INTERNAL_ERROR",
              where,
              message: `Failed to load template items: ${templateItemsError.message}`,
              details: templateItemsError,
            });
          }

          const itemsByTemplateCategoryId = new Map<
            string,
            Array<{ title: string; description: string | null; priority: string | null; position: number }>
          >();
          for (const item of (templateItems ?? []) as Array<{
            template_category_id: string;
            title: string;
            description: string | null;
            priority: string | null;
            position: number;
          }>) {
            const current = itemsByTemplateCategoryId.get(item.template_category_id) ?? [];
            current.push({
              title: item.title,
              description: item.description,
              priority: item.priority,
              position: item.position,
            });
            itemsByTemplateCategoryId.set(item.template_category_id, current);
          }

          // Copied categories start after the default category (position 0).
          for (const [index, templateCategory] of categories.entries()) {
            const { data: newCategory, error: newCategoryError } = await supabase
              .from("meeting_categories")
              .insert({
                meeting_id: meetingId,
                name: templateCategory.name,
                position: index + 1,
              })
              .select("id")
              .single();

            if (newCategoryError || !newCategory) {
              throw new GuardrailError({
                code: "INTERNAL_ERROR",
                where,
                message: `Failed to copy template category: ${newCategoryError?.message ?? "Unknown insert failure"}`,
                details: newCategoryError,
              });
            }

            const items = itemsByTemplateCategoryId.get(templateCategory.id) ?? [];
            if (items.length > 0) {
              const { error: copiedItemsError } = await supabase.from("meeting_items").insert(
                items.map((item) => ({
                  meeting_id: meetingId,
                  category_id: newCategory.id,
                  title: item.title,
                  description: item.description,
                  priority: item.priority,
                  position: item.position,
                  origin_meeting_id: meetingId,
                  status: "open",
                })),
              );

              if (copiedItemsError) {
                throw new GuardrailError({
                  code: "INTERNAL_ERROR",
                  where,
                  message: `Failed to copy template items: ${copiedItemsError.message}`,
                  details: copiedItemsError,
                });
              }
            }
          }
        }
      }
      // 7. Carry forward from a prior meeting (recurring-meeting behavior):
      // copy the source meeting's open/in-progress agenda items and its
      // attendees into this new meeting. Skips silently when the source is
      // missing or in another project — creation must not fail because a
      // carry-forward source went away.
      if (payload.carry_from_meeting_id) {
        const { data: sourceMeeting } = await supabase
          .from("meetings")
          .select("id")
          .eq("id", payload.carry_from_meeting_id)
          .eq("project_id", numericProjectId)
          .is("deleted_at", null)
          .maybeSingle();

        if (sourceMeeting) {
          const [
            sourceCategoriesResult,
            sourceItemsResult,
            sourceAttendeesResult,
            newCategoriesResult,
          ] = await Promise.all([
            supabase
              .from("meeting_categories")
              .select("id, name")
              .eq("meeting_id", payload.carry_from_meeting_id),
            supabase
              .from("meeting_items")
              .select("*")
              .eq("meeting_id", payload.carry_from_meeting_id)
              .order("position", { ascending: true }),
            supabase
              .from("meeting_attendees")
              .select("person_id, is_required")
              .eq("meeting_id", payload.carry_from_meeting_id),
            supabase
              .from("meeting_categories")
              .select("id, name, position")
              .eq("meeting_id", meetingId),
          ]);

          const carrySourceError =
            sourceCategoriesResult.error ??
            sourceItemsResult.error ??
            sourceAttendeesResult.error ??
            newCategoriesResult.error;
          if (carrySourceError) {
            throw new GuardrailError({
              code: "INTERNAL_ERROR",
              where,
              message: `Failed to load carry-forward source: ${carrySourceError.message}`,
              details: carrySourceError,
            });
          }

          const sourceCategoryNameById = new Map(
            ((sourceCategoriesResult.data ?? []) as Array<{ id: string; name: string }>).map(
              (category) => [category.id, category.name],
            ),
          );

          // Match carried items into the new meeting's section of the same name;
          // create any missing section on demand (after existing ones).
          const newCategoryIdByName = new Map<string, string>();
          let nextCategoryPosition = 0;
          for (const category of (newCategoriesResult.data ?? []) as Array<{
            id: string;
            name: string;
            position: number;
          }>) {
            newCategoryIdByName.set(category.name, category.id);
            nextCategoryPosition = Math.max(nextCategoryPosition, category.position + 1);
          }

          const sourceItems = (sourceItemsResult.data ?? []) as Array<{
            id: string;
            category_id: string;
            title: string;
            description: string | null;
            assignee_person_id: string | null;
            due_date: string | null;
            status: string;
            priority: string | null;
            position: number;
            origin_meeting_id: string | null;
          }>;
          const carryoverIds = new Set(
            selectCarryoverItems(sourceItems.map((item) => ({ id: item.id, status: item.status }))),
          );
          const carryoverItems = sourceItems.filter((item) => carryoverIds.has(item.id));

          for (const item of carryoverItems) {
            const categoryName =
              sourceCategoryNameById.get(item.category_id) ?? DEFAULT_CATEGORY_NAME;
            if (!newCategoryIdByName.has(categoryName)) {
              const { data: createdCategory, error: createdCategoryError } = await supabase
                .from("meeting_categories")
                .insert({ meeting_id: meetingId, name: categoryName, position: nextCategoryPosition })
                .select("id")
                .single();
              if (createdCategoryError || !createdCategory) {
                throw new GuardrailError({
                  code: "INTERNAL_ERROR",
                  where,
                  message: `Failed to create carried-forward category: ${createdCategoryError?.message ?? "Unknown insert failure"}`,
                  details: createdCategoryError,
                });
              }
              newCategoryIdByName.set(categoryName, createdCategory.id as string);
              nextCategoryPosition += 1;
            }
          }

          const carryRows = carryoverItems.map((item) => {
            const categoryName =
              sourceCategoryNameById.get(item.category_id) ?? DEFAULT_CATEGORY_NAME;
            return {
              meeting_id: meetingId,
              category_id: newCategoryIdByName.get(categoryName)!,
              title: item.title,
              description: item.description,
              assignee_person_id: item.assignee_person_id,
              due_date: item.due_date,
              status: item.status,
              priority: item.priority,
              position: item.position,
              carried_from_item_id: item.id,
              origin_meeting_id: item.origin_meeting_id ?? payload.carry_from_meeting_id,
              official_minutes: null,
            };
          });

          if (carryRows.length > 0) {
            const { error: carryItemsError } = await supabase
              .from("meeting_items")
              .insert(carryRows);
            if (carryItemsError) {
              throw new GuardrailError({
                code: "INTERNAL_ERROR",
                where,
                message: `Failed to carry forward agenda items: ${carryItemsError.message}`,
                details: carryItemsError,
              });
            }
          }

          // Carry attendees not already added from the form payload (step 4).
          const formAttendeeIds = new Set(payload.attendee_person_ids ?? []);
          const carryAttendees = (
            (sourceAttendeesResult.data ?? []) as Array<{
              person_id: string;
              is_required: boolean | null;
            }>
          ).filter((attendee) => !formAttendeeIds.has(attendee.person_id));
          if (carryAttendees.length > 0) {
            const { error: carryAttendeesError } = await supabase.from("meeting_attendees").insert(
              carryAttendees.map((attendee) => ({
                meeting_id: meetingId,
                person_id: attendee.person_id,
                is_required: attendee.is_required ?? undefined,
              })),
            );
            if (carryAttendeesError) {
              throw new GuardrailError({
                code: "INTERNAL_ERROR",
                where,
                message: `Failed to carry forward attendees: ${carryAttendeesError.message}`,
                details: carryAttendeesError,
              });
            }
          }
        }
      }
    } catch (postInsertError) {
      try {
        await supabase.from("meetings").delete().eq("id", meetingId);
      } catch (cleanupError) {
        // Best-effort only — the original error is what matters to the caller.
        console.error(
          `[${where}] Failed to clean up orphaned meeting ${meetingId} after partial create failure:`,
          cleanupError,
        );
      }
      throw postInsertError;
    }

    // 7. Return the full MeetingDetail
    const detail = await loadMeetingDetail(supabase, numericProjectId, meetingId);

    if (!detail) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: "Meeting was created but could not be reloaded.",
      });
    }

    return NextResponse.json(detail, { status: 201 });
  },
);
