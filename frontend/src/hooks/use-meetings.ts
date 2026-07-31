"use client";

/**
 * React Query hooks for the Procore-style Meetings tool.
 *
 * Covers: the meetings list (grouped by series), full meeting detail
 * (attendees + categories + agenda items), meeting lifecycle mutations
 * (create/update/delete/restore/convert/follow-up/link-transcript), agenda
 * structure mutations (categories + items, including optimistic reorders),
 * and agenda-item task/history reads.
 *
 * `MeetingDetail` is imported type-only from `@/lib/meetings/server` — that
 * module has no `"use client"`/server-only markers and only exports pure
 * functions + Supabase row types, so the type import is erased at compile
 * time and never drags server code into the client bundle.
 */

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api-client";
import type {
  MeetingDetail,
  MeetingDetailCategory,
  MeetingDetailItem,
  PreviousMinutesEntry,
} from "@/lib/meetings/server";
import type {
  CreateItemInput,
  CreateItemTaskInput,
  CreateMeetingInput,
  UpdateItemInput,
  UpdateMeetingInput,
} from "@/lib/meetings/schemas";
import type { Database } from "@/types/database.types";

export type MeetingStatus = "draft" | "awaiting_minutes" | "minutes";

export interface MeetingListItem {
  id: string;
  number: number;
  name: string;
  meeting_date: string | null;
  location: string | null;
  status: MeetingStatus;
  agenda_item_count: number;
  template_id: string | null;
  template_name: string | null;
  transcript_document_id: string | null;
}

export interface MeetingSeries {
  series_id: string;
  name: string;
  meetings: MeetingListItem[];
}

export interface MeetingsListResponse {
  series: MeetingSeries[];
}

export type { MeetingDetail, MeetingDetailCategory, MeetingDetailItem, PreviousMinutesEntry };
export type {
  CreateItemInput,
  CreateItemTaskInput,
  CreateMeetingInput,
  UpdateItemInput,
  UpdateMeetingInput,
};

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];

export interface MeetingSeriesListFilters {
  search?: string;
  status?: MeetingStatus;
  deleted?: "only";
}

export const meetingKeys = {
  all: ["meetings"] as const,
  lists: () => [...meetingKeys.all, "list"] as const,
  list: (projectId: string, filters?: MeetingSeriesListFilters) =>
    [...meetingKeys.lists(), projectId, filters ?? {}] as const,
  details: () => [...meetingKeys.all, "detail"] as const,
  detail: (projectId: string, meetingId: string) =>
    [...meetingKeys.details(), projectId, meetingId] as const,
  itemHistory: (projectId: string, meetingId: string, itemId: string) =>
    [...meetingKeys.detail(projectId, meetingId), "items", itemId, "history"] as const,
};

function buildListQueryString(filters?: MeetingSeriesListFilters): string {
  const params = new URLSearchParams();
  if (filters?.search) params.set("search", filters.search);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.deleted) params.set("deleted", filters.deleted);
  const query = params.toString();
  return query ? `?${query}` : "";
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function useMeetingSeriesList(projectId: string, filters?: MeetingSeriesListFilters) {
  return useQuery<MeetingsListResponse>({
    queryKey: meetingKeys.list(projectId, filters),
    queryFn: async () =>
      apiFetch<MeetingsListResponse>(
        `/api/projects/${projectId}/meetings${buildListQueryString(filters)}`,
      ),
    enabled: Boolean(projectId),
    staleTime: 30_000,
  });
}

export function useMeetingDetail(projectId: string, meetingId: string) {
  return useQuery<MeetingDetail>({
    queryKey: meetingKeys.detail(projectId, meetingId),
    queryFn: async () =>
      apiFetch<MeetingDetail>(`/api/projects/${projectId}/meetings/${meetingId}`),
    enabled: Boolean(projectId) && Boolean(meetingId),
    staleTime: 15_000,
  });
}

export function useItemHistory(
  projectId: string,
  meetingId: string,
  itemId: string,
  options?: { enabled?: boolean },
) {
  return useQuery<{ history: PreviousMinutesEntry[] }>({
    queryKey: meetingKeys.itemHistory(projectId, meetingId, itemId),
    queryFn: async () =>
      apiFetch<{ history: PreviousMinutesEntry[] }>(
        `/api/projects/${projectId}/meetings/${meetingId}/items/${itemId}/history`,
      ),
    enabled: Boolean(projectId) && Boolean(meetingId) && Boolean(itemId) && (options?.enabled ?? true),
  });
}

// ---------------------------------------------------------------------------
// Meeting lifecycle mutations
// ---------------------------------------------------------------------------

function invalidateMeetingDetail(
  queryClient: QueryClient,
  projectId: string,
  meetingId: string,
) {
  queryClient.invalidateQueries({ queryKey: meetingKeys.detail(projectId, meetingId) });
}

function invalidateMeetingList(queryClient: QueryClient, projectId: string) {
  queryClient.invalidateQueries({ queryKey: meetingKeys.lists() });
  void projectId;
}

export function useCreateMeeting(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateMeetingInput) =>
      apiFetch<MeetingDetail>(`/api/projects/${projectId}/meetings`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      invalidateMeetingList(queryClient, projectId);
      toast.success("Meeting created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateMeeting(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ meetingId, data }: { meetingId: string; data: UpdateMeetingInput }) =>
      apiFetch<MeetingDetail>(`/api/projects/${projectId}/meetings/${meetingId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      invalidateMeetingList(queryClient, projectId);
      invalidateMeetingDetail(queryClient, projectId, variables.meetingId);
      toast.success("Meeting updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteMeeting(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (meetingId: string) =>
      apiFetch(`/api/projects/${projectId}/meetings/${meetingId}`, { method: "DELETE" }),
    onSuccess: (_, meetingId) => {
      invalidateMeetingList(queryClient, projectId);
      invalidateMeetingDetail(queryClient, projectId, meetingId);
      toast.success("Meeting deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useRestoreMeeting(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (meetingId: string) =>
      apiFetch<MeetingDetail>(`/api/projects/${projectId}/meetings/${meetingId}/restore`, {
        method: "POST",
      }),
    onSuccess: (_, meetingId) => {
      invalidateMeetingList(queryClient, projectId);
      invalidateMeetingDetail(queryClient, projectId, meetingId);
      toast.success("Meeting restored successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useConvertMeeting(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ meetingId, mode }: { meetingId: string; mode: "agenda" | "minutes" }) =>
      apiFetch<MeetingDetail>(`/api/projects/${projectId}/meetings/${meetingId}/convert`, {
        method: "POST",
        body: JSON.stringify({ mode }),
      }),
    onSuccess: (_, variables) => {
      invalidateMeetingList(queryClient, projectId);
      invalidateMeetingDetail(queryClient, projectId, variables.meetingId);
      toast.success(
        variables.mode === "minutes" ? "Meeting converted to minutes" : "Meeting reverted to agenda",
      );
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useCreateFollowUpMeeting(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      meetingId,
      meeting_date,
      carry_open_items,
    }: {
      meetingId: string;
      meeting_date?: string;
      carry_open_items: boolean;
    }) =>
      apiFetch<MeetingDetail>(`/api/projects/${projectId}/meetings/${meetingId}/follow-up`, {
        method: "POST",
        body: JSON.stringify({ meeting_date, carry_open_items }),
      }),
    onSuccess: () => {
      invalidateMeetingList(queryClient, projectId);
      toast.success("Follow-up meeting created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useLinkTranscript(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      meetingId,
      documentMetadataId,
    }: {
      meetingId: string;
      documentMetadataId: string | null;
    }) =>
      apiFetch<MeetingDetail>(`/api/projects/${projectId}/meetings/${meetingId}/link-transcript`, {
        method: "POST",
        body: JSON.stringify({ document_metadata_id: documentMetadataId }),
      }),
    onSuccess: (_, variables) => {
      invalidateMeetingList(queryClient, projectId);
      invalidateMeetingDetail(queryClient, projectId, variables.meetingId);
      toast.success("Transcript link updated");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// ---------------------------------------------------------------------------
// Category mutations
// ---------------------------------------------------------------------------

export function useCreateCategory(projectId: string, meetingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) =>
      apiFetch<MeetingDetailCategory>(
        `/api/projects/${projectId}/meetings/${meetingId}/categories`,
        { method: "POST", body: JSON.stringify({ name }) },
      ),
    onSuccess: () => {
      invalidateMeetingDetail(queryClient, projectId, meetingId);
      toast.success("Category created");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateCategory(projectId: string, meetingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ categoryId, name }: { categoryId: string; name: string }) =>
      apiFetch<MeetingDetailCategory>(
        `/api/projects/${projectId}/meetings/${meetingId}/categories/${categoryId}`,
        { method: "PATCH", body: JSON.stringify({ name }) },
      ),
    onSuccess: () => {
      invalidateMeetingDetail(queryClient, projectId, meetingId);
      toast.success("Category renamed");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteCategory(projectId: string, meetingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (categoryId: string) =>
      apiFetch<{ success: boolean; moved_item_count: number }>(
        `/api/projects/${projectId}/meetings/${meetingId}/categories/${categoryId}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      invalidateMeetingDetail(queryClient, projectId, meetingId);
      toast.success("Category deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

/**
 * useReorderCategories
 * Sends the full ordered category id list. Optimistically reorders the
 * `categories` array in the cached MeetingDetail (recomputing `position` to
 * match the new order) before the request resolves; rolls back to the
 * snapshot on error; always refetches on settle so the server-derived
 * agenda numbering stays authoritative.
 */
export function useReorderCategories(projectId: string, meetingId: string) {
  const queryClient = useQueryClient();
  const detailKey = meetingKeys.detail(projectId, meetingId);

  return useMutation({
    mutationFn: async (orderedIds: string[]) =>
      apiFetch<{ categories: MeetingDetailCategory[] }>(
        `/api/projects/${projectId}/meetings/${meetingId}/categories`,
        { method: "PATCH", body: JSON.stringify({ ordered_ids: orderedIds }) },
      ),
    onMutate: async (orderedIds: string[]) => {
      await queryClient.cancelQueries({ queryKey: detailKey });
      const previousDetail = queryClient.getQueryData<MeetingDetail>(detailKey);

      if (previousDetail) {
        const categoryById = new Map(
          previousDetail.categories.map((category) => [category.id, category]),
        );
        const reorderedCategories = orderedIds
          .map((id, index) => {
            const category = categoryById.get(id);
            return category ? { ...category, position: index } : null;
          })
          .filter((category): category is MeetingDetailCategory => category !== null);

        queryClient.setQueryData<MeetingDetail>(detailKey, {
          ...previousDetail,
          categories: reorderedCategories,
        });
      }

      return { previousDetail };
    },
    onError: (error: Error, _orderedIds, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(detailKey, context.previousDetail);
      }
      toast.error(error.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: detailKey });
    },
  });
}

// ---------------------------------------------------------------------------
// Item mutations
// ---------------------------------------------------------------------------

export function useCreateItem(projectId: string, meetingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateItemInput) =>
      apiFetch<MeetingDetailItem>(`/api/projects/${projectId}/meetings/${meetingId}/items`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      invalidateMeetingDetail(queryClient, projectId, meetingId);
      toast.success("Agenda item created");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateItem(projectId: string, meetingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, data }: { itemId: string; data: UpdateItemInput }) =>
      apiFetch<MeetingDetailItem>(
        `/api/projects/${projectId}/meetings/${meetingId}/items/${itemId}`,
        { method: "PATCH", body: JSON.stringify(data) },
      ),
    onSuccess: () => {
      invalidateMeetingDetail(queryClient, projectId, meetingId);
      toast.success("Agenda item updated");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteItem(projectId: string, meetingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string) =>
      apiFetch<{ success: boolean; id: string }>(
        `/api/projects/${projectId}/meetings/${meetingId}/items/${itemId}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      invalidateMeetingDetail(queryClient, projectId, meetingId);
      toast.success("Agenda item deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

/**
 * useReorderItems
 * Moves/reorders items into a target category. The API takes the target
 * category id plus the full ordered item id list for that category. This
 * optimistically:
 *   - removes the moved items from every category's `items` array,
 *   - reinserts them (in the given order, with recomputed `position`) into
 *     the target category,
 * before the request resolves; rolls back to the snapshot on error; always
 * refetches on settle so server-derived agenda numbering stays authoritative.
 */
export function useReorderItems(projectId: string, meetingId: string) {
  const queryClient = useQueryClient();
  const detailKey = meetingKeys.detail(projectId, meetingId);

  return useMutation({
    mutationFn: async ({
      categoryId,
      orderedIds,
    }: {
      categoryId: string;
      orderedIds: string[];
    }) =>
      apiFetch<{ items: MeetingDetailItem[] }>(
        `/api/projects/${projectId}/meetings/${meetingId}/items`,
        {
          method: "PATCH",
          body: JSON.stringify({ category_id: categoryId, ordered_ids: orderedIds }),
        },
      ),
    onMutate: async ({ categoryId, orderedIds }) => {
      await queryClient.cancelQueries({ queryKey: detailKey });
      const previousDetail = queryClient.getQueryData<MeetingDetail>(detailKey);

      if (previousDetail) {
        const itemById = new Map<string, MeetingDetailItem>();
        for (const category of previousDetail.categories) {
          for (const item of category.items) {
            itemById.set(item.id, item);
          }
        }

        const movedIds = new Set(orderedIds);
        const reorderedTargetItems = orderedIds
          .map((id, index) => {
            const item = itemById.get(id);
            return item ? { ...item, category_id: categoryId, position: index } : null;
          })
          .filter((item): item is MeetingDetailItem => item !== null);

        const reorderedCategories = previousDetail.categories.map((category) => {
          const remainingItems = category.items.filter((item) => !movedIds.has(item.id));
          if (category.id === categoryId) {
            return { ...category, items: reorderedTargetItems };
          }
          return { ...category, items: remainingItems };
        });

        queryClient.setQueryData<MeetingDetail>(detailKey, {
          ...previousDetail,
          categories: reorderedCategories,
        });
      }

      return { previousDetail };
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(detailKey, context.previousDetail);
      }
      toast.error(error.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: detailKey });
    },
  });
}

// ---------------------------------------------------------------------------
// Attendee mutations
// ---------------------------------------------------------------------------

export function useSetAttendeeAttendance(projectId: string, meetingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      personId,
      attended,
    }: {
      personId: string;
      attended: boolean | null;
    }) =>
      apiFetch(`/api/projects/${projectId}/meetings/${meetingId}/attendees`, {
        method: "PATCH",
        body: JSON.stringify({ person_id: personId, attended }),
      }),
    onSuccess: () => {
      invalidateMeetingDetail(queryClient, projectId, meetingId);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// ---------------------------------------------------------------------------
// Item task mutations
// ---------------------------------------------------------------------------

export function useCreateItemTask(projectId: string, meetingId: string) {
  const queryClient = useQueryClient();
  const detailKey = meetingKeys.detail(projectId, meetingId);

  return useMutation({
    mutationFn: async ({ itemId, data }: { itemId: string; data: CreateItemTaskInput }) =>
      apiFetch<TaskRow>(
        `/api/projects/${projectId}/meetings/${meetingId}/items/${itemId}/tasks`,
        { method: "POST", body: JSON.stringify(data) },
      ),
    onSuccess: (_task, variables) => {
      queryClient.setQueryData<MeetingDetail>(detailKey, (current) => {
        if (!current) return current;
        return {
          ...current,
          categories: current.categories.map((category) => ({
            ...category,
            items: category.items.map((item) =>
              item.id === variables.itemId
                ? { ...item, task_count: item.task_count + 1 }
                : item,
            ),
          })),
        };
      });
      queryClient.invalidateQueries({ queryKey: detailKey });
      toast.success("Task created from agenda item");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
