"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PhotoSummary {
  id: number;
  project_id: number;
  title: string;
  description: string | null;
  album: string | null;
  file_name: string;
  file_url: string;
  file_size: number | null;
  content_type: string | null;
  width: number | null;
  height: number | null;
  date_taken: string | null;
  location: string | null;
  trade: string | null;
  tags: string[] | null;
  is_private: boolean | null;
  starred: boolean | null;
  uploaded_by: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface CreatePhotoInput {
  title: string;
  description?: string | null;
  album?: string | null;
  file_name: string;
  file_url: string;
  file_size?: number | null;
  content_type?: string | null;
  width?: number | null;
  height?: number | null;
  date_taken?: string | null;
  location?: string | null;
  trade?: string | null;
  tags?: string[] | null;
  is_private?: boolean | null;
  starred?: boolean | null;
}

export type UpdatePhotoInput = Partial<CreatePhotoInput>;

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const photoKeys = {
  all: (projectId: number) => ["photos", projectId] as const,
  list: (projectId: number, album?: string) =>
    ["photos", projectId, "list", album] as const,
  detail: (projectId: number, photoId: number) =>
    ["photos", projectId, "detail", photoId] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function usePhotos(
  projectId: number,
  album?: string,
  options?: { starred?: boolean; deleted?: boolean },
) {
  return useQuery({
    queryKey: [...photoKeys.list(projectId, album), options],
    queryFn: ({ signal }): Promise<PhotoSummary[]> => {
      const params = new URLSearchParams();
      if (album) params.set("album", album);
      if (options?.starred) params.set("starred", "true");
      if (options?.deleted) params.set("deleted", "true");
      return apiFetch<PhotoSummary[]>(
        `/api/projects/${projectId}/photos?${params.toString()}`,
        { signal },
      );
    },
    enabled: Boolean(projectId),
  });
}

export function usePhoto(
  projectId: number,
  photoId: number,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: photoKeys.detail(projectId, photoId),
    queryFn: ({ signal }): Promise<PhotoSummary> =>
      apiFetch<PhotoSummary>(
        `/api/projects/${projectId}/photos/${photoId}`,
        { signal },
      ),
    enabled: Boolean(projectId) && Boolean(photoId) && (options?.enabled ?? true),
  });
}

export function useCreatePhoto(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePhotoInput): Promise<PhotoSummary> =>
      apiFetch<PhotoSummary>(`/api/projects/${projectId}/photos`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: photoKeys.all(projectId) });
      toast.success("Photo uploaded");
    },
    onError: (err: Error) => {
      toast.error("Could not upload photo", { description: err.message });
    },
  });
}

export function useUpdatePhoto(projectId: number, photoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePhotoInput): Promise<PhotoSummary> =>
      apiFetch<PhotoSummary>(
        `/api/projects/${projectId}/photos/${photoId}`,
        {
          method: "PUT",
          body: JSON.stringify(input),
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: photoKeys.all(projectId) });
      toast.success("Photo updated");
    },
    onError: (err: Error) => {
      toast.error("Could not update photo", { description: err.message });
    },
  });
}

export interface UploadPhotosOptions {
  files: File[];
  album?: string;
  is_private?: boolean;
}

/**
 * Upload one or more image files directly (no form required).
 * Files are uploaded to Supabase storage and photo records are created
 * automatically with a title derived from the filename.
 */
export function useUploadPhotos(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: File[] | UploadPhotosOptions): Promise<PhotoSummary[]> => {
      // Accept plain File[] for backward-compat (drag-and-drop path)
      const files = Array.isArray(input) ? input : input.files;
      const album = Array.isArray(input) ? undefined : input.album;
      const is_private = Array.isArray(input) ? undefined : input.is_private;

      const formData = new FormData();
      for (const file of files) {
        formData.append("files", file);
      }
      if (album) formData.append("album", album);
      if (is_private) formData.append("is_private", "true");

      const result = await apiFetch<{ photos: PhotoSummary[] }>(
        `/api/projects/${projectId}/photos/upload`,
        {
          method: "POST",
          body: formData,
        },
      );
      return result.photos;
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: photoKeys.all(projectId) });
      const count = Array.isArray(input) ? input.length : input.files.length;
      toast.success(count === 1 ? "Photo uploaded" : `${count} photos uploaded`);
    },
    onError: (err: Error) => {
      toast.error("Could not upload photos", { description: err.message });
    },
  });
}

export function useDeletePhoto(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (photoId: number): Promise<unknown> =>
      apiFetch(
        `/api/projects/${projectId}/photos/${photoId}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: photoKeys.all(projectId) });
      toast.success("Photo deleted");
    },
    onError: (err: Error) => {
      toast.error("Could not delete photo", { description: err.message });
    },
  });
}

export function useRestorePhoto(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (photoId: number): Promise<unknown> =>
      apiFetch(
        `/api/projects/${projectId}/photos/${photoId}/restore`,
        { method: "PATCH" },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: photoKeys.all(projectId) });
      toast.success("Photo restored");
    },
    onError: (err: Error) => {
      toast.error("Could not restore photo", { description: err.message });
    },
  });
}

export function useDeletePhotoPermanently(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (photoId: number): Promise<unknown> =>
      apiFetch(
        `/api/projects/${projectId}/photos/${photoId}?permanent=true`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: photoKeys.all(projectId) });
      toast.success("Photo permanently deleted");
    },
    onError: (err: Error) => {
      toast.error("Could not delete photo", { description: err.message });
    },
  });
}
