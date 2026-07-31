"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api-client";
import type { TrainingDocStatus } from "@/lib/training-docs/constants";
import type { TrainingDocWithAssets } from "@/lib/training-docs/types";

export const trainingDocKeys = {
  all: ["training-docs"] as const,
  list: () => ["training-docs", "list"] as const,
};

export function useTrainingDocs() {
  return useQuery({
    queryKey: trainingDocKeys.list(),
    queryFn: async ({ signal }): Promise<TrainingDocWithAssets[]> => {
      const json = await apiFetch<{ docs: TrainingDocWithAssets[] }>(
        "/api/admin/training-docs",
        {
          signal,
        },
      );
      return json.docs;
    },
  });
}

export function useCreateTrainingDoc() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      title: string;
      slug?: string;
      summary?: string | null;
      body_markdown?: string;
      audience?: "internal" | "client" | "subcontractor" | "admin";
      status?: TrainingDocStatus;
      source_route?: string | null;
      app_tool_category?: string | null;
      review_notes?: string | null;
      target_collection?: string;
    }) =>
      apiFetch<{ doc: TrainingDocWithAssets }>("/api/admin/training-docs", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trainingDocKeys.all });
      toast.success("Training doc created");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUpdateTrainingDoc() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      id: string;
      title?: string;
      slug?: string;
      summary?: string | null;
      body_markdown?: string;
      audience?: "internal" | "client" | "subcontractor" | "admin";
      status?: TrainingDocStatus;
      source_route?: string | null;
      app_tool_category?: string | null;
      review_notes?: string | null;
      target_collection?: string;
    }) =>
      apiFetch<{ doc: TrainingDocWithAssets }>(
        `/api/admin/training-docs/${body.id}`,
        {
          method: "PATCH",
          body: JSON.stringify(body),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trainingDocKeys.all });
      toast.success("Training doc saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeleteTrainingDoc() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (docId: string) =>
      apiFetch<{ success: true }>(`/api/admin/training-docs/${docId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trainingDocKeys.all });
      toast.success("Training doc deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUploadTrainingDocAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ docId, file }: { docId: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiFetch(`/api/admin/training-docs/${docId}/assets`, {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trainingDocKeys.all });
      toast.success("Screenshot uploaded");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUpdateTrainingDocAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      assetId,
      caption,
      alt_text,
      step_order,
    }: {
      assetId: string;
      caption?: string | null;
      alt_text?: string | null;
      step_order?: number;
    }) =>
      apiFetch(`/api/admin/training-docs/assets/${assetId}`, {
        method: "PATCH",
        body: JSON.stringify({ caption, alt_text, step_order }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trainingDocKeys.all });
      toast.success("Screenshot details saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeleteTrainingDocAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assetId: string) =>
      apiFetch(`/api/admin/training-docs/assets/${assetId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trainingDocKeys.all });
      toast.success("Screenshot deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function usePublishTrainingDoc() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (docId: string) =>
      apiFetch(`/api/admin/training-docs/${docId}/publish`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trainingDocKeys.all });
      toast.success("Training doc published to the docs site");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useGenerateTrainingDoc() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ docId, route }: { docId: string; route?: string | null }) =>
      apiFetch<{
        doc: TrainingDocWithAssets;
        generated: { route: string; stepCount: number };
      }>(`/api/admin/training-docs/${docId}/generate`, {
        method: "POST",
        body: JSON.stringify({ route }),
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: trainingDocKeys.all });
      toast.success(
        `AI generated ${result.generated.stepCount} screenshot-backed steps`,
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
