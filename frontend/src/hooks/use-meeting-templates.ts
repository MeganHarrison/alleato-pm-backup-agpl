"use client";

/**
 * React Query hooks for meeting templates.
 *
 *   - useMeetingTemplateOptions: name+id dropdown source for the create-meeting
 *     flow (GET /api/meeting-templates — any authenticated user).
 *   - Admin CRUD hooks: full nested template management (GET/POST/PATCH/DELETE
 *     /api/admin/meeting-templates — admin-only, enforced server-side).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api-client";
import type { CreateTemplateInput } from "@/lib/meetings/template-schemas";

export interface MeetingTemplateOption {
  id: string;
  name: string;
}

export interface AdminMeetingTemplateListItem {
  id: string;
  name: string;
  overview: string | null;
  is_private: boolean;
  updated_at: string;
  category_count: number;
  item_count: number;
}

export interface AdminMeetingTemplateItem {
  id: string;
  position: number;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high" | null;
}

export interface AdminMeetingTemplateCategory {
  id: string;
  name: string;
  position: number;
  items: AdminMeetingTemplateItem[];
}

export interface AdminMeetingTemplateDetail {
  id: string;
  name: string;
  overview: string | null;
  is_private: boolean;
  categories: AdminMeetingTemplateCategory[];
}

export const meetingTemplateKeys = {
  all: ["meeting-templates"] as const,
  options: () => [...meetingTemplateKeys.all, "options"] as const,
  admin: {
    all: ["admin", "meeting-templates"] as const,
    lists: () => [...meetingTemplateKeys.admin.all, "list"] as const,
    details: () => [...meetingTemplateKeys.admin.all, "detail"] as const,
    detail: (templateId: string) => [...meetingTemplateKeys.admin.details(), templateId] as const,
  },
};

// ---------------------------------------------------------------------------
// Dropdown (any authenticated user)
// ---------------------------------------------------------------------------

export function useMeetingTemplateOptions() {
  return useQuery<{ templates: MeetingTemplateOption[] }>({
    queryKey: meetingTemplateKeys.options(),
    queryFn: async () => apiFetch<{ templates: MeetingTemplateOption[] }>("/api/meeting-templates"),
    staleTime: 60_000,
    select: (data) => data,
  });
}

// ---------------------------------------------------------------------------
// Admin CRUD
// ---------------------------------------------------------------------------

export function useAdminMeetingTemplateList() {
  return useQuery<{ templates: AdminMeetingTemplateListItem[] }>({
    queryKey: meetingTemplateKeys.admin.lists(),
    queryFn: async () =>
      apiFetch<{ templates: AdminMeetingTemplateListItem[] }>("/api/admin/meeting-templates"),
    staleTime: 30_000,
  });
}

export function useAdminMeetingTemplateDetail(templateId: string) {
  return useQuery<AdminMeetingTemplateDetail>({
    queryKey: meetingTemplateKeys.admin.detail(templateId),
    queryFn: async () =>
      apiFetch<AdminMeetingTemplateDetail>(`/api/admin/meeting-templates/${templateId}`),
    enabled: Boolean(templateId),
  });
}

export function useCreateMeetingTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTemplateInput) =>
      apiFetch<AdminMeetingTemplateDetail>("/api/admin/meeting-templates", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: meetingTemplateKeys.admin.lists() });
      queryClient.invalidateQueries({ queryKey: meetingTemplateKeys.options() });
      toast.success("Meeting template created");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateMeetingTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      templateId,
      data,
    }: {
      templateId: string;
      data: CreateTemplateInput;
    }) =>
      apiFetch<AdminMeetingTemplateDetail>(`/api/admin/meeting-templates/${templateId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: meetingTemplateKeys.admin.lists() });
      queryClient.invalidateQueries({
        queryKey: meetingTemplateKeys.admin.detail(variables.templateId),
      });
      queryClient.invalidateQueries({ queryKey: meetingTemplateKeys.options() });
      toast.success("Meeting template updated");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteMeetingTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateId: string) =>
      apiFetch<{ success: boolean }>(`/api/admin/meeting-templates/${templateId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: meetingTemplateKeys.admin.lists() });
      queryClient.invalidateQueries({ queryKey: meetingTemplateKeys.options() });
      toast.success("Meeting template deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
