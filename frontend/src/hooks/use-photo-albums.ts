"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import type { Database } from "@/types/database.types";

type PhotoAlbum = Database["public"]["Tables"]["photo_albums"]["Row"];

const albumKeys = {
  all: (projectId: number) => ["photo-albums", projectId] as const,
};

export function usePhotoAlbums(projectId: number) {
  return useQuery({
    queryKey: albumKeys.all(projectId),
    queryFn: async (): Promise<PhotoAlbum[]> =>
      apiFetch<PhotoAlbum[]>(`/api/projects/${projectId}/photo-albums`),
    enabled: Boolean(projectId),
  });
}

export function useCreatePhotoAlbum(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; description?: string | null }): Promise<PhotoAlbum> =>
      apiFetch<PhotoAlbum>(`/api/projects/${projectId}/photo-albums`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: albumKeys.all(projectId) });
      toast.success("Album created");
    },
    onError: (err: Error) => {
      toast.error("Could not create album", { description: err.message });
    },
  });
}

export function useRenamePhotoAlbum(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ albumId, name }: { albumId: string; name: string }): Promise<PhotoAlbum> =>
      apiFetch<PhotoAlbum>(`/api/projects/${projectId}/photo-albums/${albumId}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: albumKeys.all(projectId) });
      toast.success("Album renamed");
    },
    onError: (err: Error) => {
      toast.error("Could not rename album", { description: err.message });
    },
  });
}

export function useDeletePhotoAlbum(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (albumId: string): Promise<void> => {
      await apiFetch(`/api/projects/${projectId}/photo-albums/${albumId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: albumKeys.all(projectId) });
      toast.success("Album deleted");
    },
    onError: (err: Error) => {
      toast.error("Could not delete album", { description: err.message });
    },
  });
}
