"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";

export interface DrawingMarkupPin {
  id: string;
  drawing_id: string;
  project_id: number;
  x_pct: number;
  y_pct: number;
  page: number;
  pin_type: "rfi" | "punch_item" | "coordination_issue" | "drawing" | "document" | "photo" | "submittal" | "task";
  entity_id: string | null;
  entity_label: string | null;
  /** Live record summary supplied by the pins API for canvas hover and preview. */
  entity_description?: string | null;
  entity_number: string | null;
  entity_status: string | null;
  color: string | null;
  created_by: string | null;
  created_at: string;
}

export function useDrawingPins(projectId: string, drawingId: string) {
  return useQuery<DrawingMarkupPin[]>({
    queryKey: ["drawing-pins", projectId, drawingId],
    queryFn: async ({ signal }) => {
      const data = await apiFetch<{ pins?: DrawingMarkupPin[] }>(
        `/api/projects/${projectId}/drawings/${drawingId}/pins`,
        { signal },
      );
      return data.pins ?? [];
    },
    enabled: !!projectId && !!drawingId,
  });
}

export interface CreatePinInput {
  x_pct: number;
  y_pct: number;
  page: number;
  pin_type: DrawingMarkupPin["pin_type"];
  entity_id?: string;
  entity_label?: string;
  entity_number?: string;
  entity_status?: string;
  color?: string;
}

export function useCreateDrawingPin(projectId: string, drawingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePinInput) => {
      const data = await apiFetch<{ pin: DrawingMarkupPin }>(
        `/api/projects/${projectId}/drawings/${drawingId}/pins`,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      );
      return data.pin;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drawing-pins", projectId, drawingId] });
    },
    onError: (e: Error) => toast.error("Could not create pin", { description: e.message }),
  });
}

export function useDeleteDrawingPin(projectId: string, drawingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pinId: string) =>
      apiFetch(
        `/api/projects/${projectId}/drawings/${drawingId}/pins/${pinId}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drawing-pins", projectId, drawingId] });
      toast.success("Link removed");
    },
    onError: (e: Error) => toast.error("Could not remove pin", { description: e.message }),
  });
}
