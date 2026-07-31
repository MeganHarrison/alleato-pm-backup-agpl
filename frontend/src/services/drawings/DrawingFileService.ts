import type {
  SupabaseClient,
  DrawingDownload,
  DrawingError,
  Result,
  FileUploadResult,
} from "./types";
import {
  DRAWING_MAX_UPLOAD_BYTES,
  DRAWING_MAX_UPLOAD_LABEL,
} from "@/lib/drawings/upload-constraints";

/**
 * Service for drawing file operations (upload, download, storage)
 */
export class DrawingFileService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Upload file to Supabase Storage.
   * Returns URL and path for use in revision creation.
   */
  async upload(
    projectId: string,
    drawingId: string,
    file: File,
  ): Promise<Result<FileUploadResult, DrawingError>> {
    try {
      if (file.size > DRAWING_MAX_UPLOAD_BYTES) {
        return {
          data: null,
          error: { type: "FILE_TOO_LARGE", message: `File must be under ${DRAWING_MAX_UPLOAD_LABEL}` },
        };
      }

      const timestamp = Date.now();
      const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const filePath = `${projectId}/drawings/${drawingId}/${timestamp}_${sanitizedFilename}`;

      const { error: uploadError } = await this.supabase.storage
        .from("project-files")
        .upload(filePath, file, { cacheControl: "3600", upsert: false });

      if (uploadError) {
        return {
          data: null,
          error: { type: "STORAGE_ERROR", message: `Failed to upload file: ${uploadError.message}` },
        };
      }

      const { data: urlData } = this.supabase.storage
        .from("project-files")
        .getPublicUrl(filePath);

      return {
        data: { url: urlData.publicUrl, path: filePath },
        error: null,
      };
    } catch (err) {
      return {
        data: null,
        error: {
          type: "UNKNOWN",
          message: err instanceof Error ? err.message : "an unexpected error occurred",
        },
      };
    }
  }

  /**
   * Create a signed URL for downloading a file (valid for 1 hour)
   */
  async getDownloadUrl(filePath: string): Promise<Result<string, DrawingError>> {
    try {
      const { data, error } = await this.supabase.storage
        .from("project-files")
        .createSignedUrl(filePath, 3600);

      if (error) {
        return {
          data: null,
          error: { type: "STORAGE_ERROR", message: `Failed to create download URL: ${error.message}` },
        };
      }

      return { data: data.signedUrl, error: null };
    } catch (err) {
      return {
        data: null,
        error: {
          type: "UNKNOWN",
          message: err instanceof Error ? err.message : "an unexpected error occurred",
        },
      };
    }
  }

  /**
   * Record a download event
   */
  async recordDownload(
    revisionId: string,
    userId: string,
  ): Promise<Result<DrawingDownload, DrawingError>> {
    try {
      const { data, error } = await this.supabase
        .from("drawing_downloads")
        .insert({
          drawing_revision_id: revisionId,
          downloaded_by: userId,
        })
        .select()
        .single();

      if (error) {
        return { data: null, error: { type: "UNKNOWN", message: error.message } };
      }

      return { data, error: null };
    } catch (err) {
      return {
        data: null,
        error: {
          type: "UNKNOWN",
          message: err instanceof Error ? err.message : "an unexpected error occurred",
        },
      };
    }
  }

  /**
   * List all downloads for a revision
   */
  async listDownloads(
    revisionId: string,
  ): Promise<Result<DrawingDownload[], DrawingError>> {
    try {
      const { data, error } = await this.supabase
        .from("drawing_downloads")
        .select("*")
        .eq("drawing_revision_id", revisionId)
        .order("downloaded_at", { ascending: false });

      if (error) {
        return { data: null, error: { type: "UNKNOWN", message: error.message } };
      }

      return { data: data || [], error: null };
    } catch (err) {
      return {
        data: null,
        error: {
          type: "UNKNOWN",
          message: err instanceof Error ? err.message : "an unexpected error occurred",
        },
      };
    }
  }

  /**
   * Remove storage files for given revision file URLs
   */
  async removeFiles(fileUrls: string[]): Promise<void> {
    const filePaths = fileUrls
      .map((fileUrl) => {
        try {
          const url = new URL(fileUrl);
          const pathMatch = url.pathname.match(/project-files\/(.+)$/);
          return pathMatch ? pathMatch[1] : null;
        } catch {
          return null;
        }
      })
      .filter(Boolean) as string[];

    if (filePaths.length > 0) {
      await this.supabase.storage.from("project-files").remove(filePaths);
    }
  }
}
