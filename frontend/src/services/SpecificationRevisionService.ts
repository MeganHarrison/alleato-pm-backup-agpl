import type { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types";
import type {
  SpecificationRevision,
  RevisionWithUploader,
  RevisionListResponse,
  UploadRevisionData,
  SpecificationError,
  Result,
} from "../types/specifications.types";
import { sanitizeFilename } from "../lib/schemas/specification-schemas";

type Tables = Database["public"]["Tables"];
type SpecificationSection = Tables["specification_sections"]["Row"];

function extractProjectFilesPath(fileUrl: string): string | null {
  if (!fileUrl) return null;

  if (fileUrl.startsWith("project-files/")) {
    return fileUrl.replace(/^project-files\//, "");
  }
  if (!fileUrl.startsWith("http://") && !fileUrl.startsWith("https://")) {
    return fileUrl;
  }

  const decoded = decodeURIComponent(fileUrl);
  const match =
    decoded.match(/\/object\/(?:public|sign)\/project-files\/([^?]+)/) ||
    decoded.match(/\/project-files\/([^?]+)/);

  return match?.[1] ?? null;
}

/**
 * Service class for specification section revision management
 * Handles version history with file uploads and revision tracking
 * CRITICAL: Uses database function for transaction-safe revision numbering
 */
export class SpecificationRevisionService {
  constructor(private supabase: ReturnType<typeof createClient<Database>>) {}

  /**
   * Get all revisions for a specification section
   * Returns revisions with uploader details, ordered by revision number (newest first)
   */
  async listRevisions(
    projectId: string,
    sectionId: string,
  ): Promise<Result<RevisionListResponse, SpecificationError>> {
    const projectIdNum = Number.parseInt(projectId, 10);
    const sectionIdNum = Number.parseInt(sectionId, 10);

    try {
      // Verify section exists and belongs to project
      const { data: section, error: sectionError } = await this.supabase
        .from("specification_sections")
        .select("*")
        .eq("id", sectionIdNum)
        .eq("project_id", projectIdNum)
        .single();

      if (sectionError) {
        if (sectionError.code === "PGRST116") {
          return {
            data: null,
            error: {
              type: "NOT_FOUND",
              message: `Specification section with ID ${sectionId} not found`,
            },
          };
        }
        return {
          data: null,
          error: { type: "UNKNOWN", message: sectionError.message },
        };
      }

      // Get revisions (uploaded_by is UUID, not a relation in generated types)
      const { data: revisions, error: revisionsError } = await this.supabase
        .from("specification_section_revisions")
        .select("*")
        .eq("section_id", sectionIdNum)
        .order("revision_number", { ascending: false });

      if (revisionsError) {
        return {
          data: null,
          error: { type: "UNKNOWN", message: revisionsError.message },
        };
      }

      // Transform to include uploader details (uploaded_by is just UUID)
      const revisionsWithUploader: RevisionWithUploader[] = (
        revisions || []
      ).map((rev) => ({
        ...rev,
        uploader: {
          id: rev.uploaded_by,
          email: "Unknown", // Future: fetch from auth.users if needed
          full_name: "Unknown User",
        },
      }));

      return {
        data: {
          revisions: revisionsWithUploader,
          total_count: revisions?.length || 0,
          section,
        },
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
   * Get a specific revision by ID
   */
  async getRevision(
    revisionId: string,
  ): Promise<Result<RevisionWithUploader, SpecificationError>> {
    const revisionIdNum = Number.parseInt(revisionId, 10);

    try {
      const { data, error } = await this.supabase
        .from("specification_section_revisions")
        .select("*")
        .eq("id", revisionIdNum)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return {
            data: null,
            error: {
              type: "NOT_FOUND",
              message: `Revision with ID ${revisionId} not found`,
            },
          };
        }
        return {
          data: null,
          error: { type: "UNKNOWN", message: error.message },
        };
      }

      const revision: RevisionWithUploader = {
        ...data,
        uploader: {
          id: data.uploaded_by,
          email: "Unknown", // Future: fetch from auth.users if needed
          full_name: "Unknown User",
        },
      };

      return { data: revision, error: null };
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
   * Add a new revision to an existing specification section
   * CRITICAL: Uses database function for transaction-safe revision numbering
   * Optionally notifies subscribers of the update
   */
  async addRevision(
    projectId: string,
    sectionId: string,
    data: UploadRevisionData,
    uploadedBy: string,
  ): Promise<Result<SpecificationRevision, SpecificationError>> {
    const projectIdNum = Number.parseInt(projectId, 10);
    const sectionIdNum = Number.parseInt(sectionId, 10);

    try {
      // 1. Validate file
      if (data.file.size > 50 * 1024 * 1024) {
        return {
          data: null,
          error: {
            type: "FILE_TOO_LARGE",
            message: "File must be under 50MB",
            max_size_mb: 50,
          },
        };
      }

      // 2. Verify section exists
      const { data: section, error: sectionError } = await this.supabase
        .from("specification_sections")
        .select("id")
        .eq("id", sectionIdNum)
        .eq("project_id", projectIdNum)
        .single();

      if (sectionError) {
        if (sectionError.code === "PGRST116") {
          return {
            data: null,
            error: {
              type: "NOT_FOUND",
              message: `Specification section with ID ${sectionId} not found`,
            },
          };
        }
        return {
          data: null,
          error: { type: "UNKNOWN", message: sectionError.message },
        };
      }

      // 3. Upload file to Supabase Storage
      const sanitizedFilename = sanitizeFilename(data.file.name);
      const filePath = `${projectId}/specifications/${sectionId}/rev_${Date.now()}_${sanitizedFilename}`;

      const { data: uploadData, error: uploadError } =
        await this.supabase.storage
          .from("project-files")
          .upload(filePath, data.file, {
            cacheControl: "3600",
            upsert: false,
          });

      if (uploadError) {
        return {
          data: null,
          error: {
            type: "STORAGE_ERROR",
            message: `Failed to upload file: ${uploadError.message}`,
          },
        };
      }

      // 4. Get public URL
      const { data: urlData } = this.supabase.storage
        .from("project-files")
        .getPublicUrl(filePath);

      const fileUrl = urlData.publicUrl;

      // 5. Create revision using database function (transaction-safe)
      const { data: revision, error: revisionError } = await this.supabase.rpc(
        "create_specification_revision",
        {
          p_section_id: sectionIdNum,
          p_file_url: fileUrl,
          p_file_name: data.file.name,
          p_file_size: data.file.size,
          p_file_type: data.file.type || "application/octet-stream",
          p_uploaded_by: uploadedBy,
          p_notes: data.notes,
        },
      );

      if (revisionError) {
        // Clean up uploaded file if revision creation fails
        await this.supabase.storage.from("project-files").remove([filePath]);
        return {
          data: null,
          error: { type: "UNKNOWN", message: revisionError.message },
        };
      }

      // 6. Notify subscribers if requested
      if (data.notify_subscribers) {
        await this.notifySubscribers(sectionIdNum, revision.id);
      }

      return { data: revision, error: null };
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
   * Set a specific revision as the current revision
   * Updates the specification section's current_revision_id
   */
  async setCurrentRevision(
    projectId: string,
    sectionId: string,
    revisionId: string,
  ): Promise<Result<void, SpecificationError>> {
    const projectIdNum = Number.parseInt(projectId, 10);
    const sectionIdNum = Number.parseInt(sectionId, 10);
    const revisionIdNum = Number.parseInt(revisionId, 10);

    try {
      // Verify revision belongs to this section
      const { data: revision, error: revisionError } = await this.supabase
        .from("specification_section_revisions")
        .select("section_id")
        .eq("id", revisionIdNum)
        .single();

      if (revisionError || revision?.section_id !== sectionIdNum) {
        return {
          data: null,
          error: {
            type: "REVISION_CONFLICT",
            message: "Revision does not belong to this specification section",
          },
        };
      }

      // Update current revision
      const { error } = await this.supabase
        .from("specification_sections")
        .update({ current_revision_id: revisionIdNum })
        .eq("id", sectionIdNum)
        .eq("project_id", projectIdNum);

      if (error) {
        return {
          data: null,
          error: { type: "UNKNOWN", message: error.message },
        };
      }

      return { data: null, error: null };
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
   * Delete a revision (but not the current one)
   * CRITICAL: Prevents deletion of current revision to maintain integrity
   */
  async deleteRevision(
    projectId: string,
    sectionId: string,
    revisionId: string,
  ): Promise<Result<void, SpecificationError>> {
    const projectIdNum = Number.parseInt(projectId, 10);
    const sectionIdNum = Number.parseInt(sectionId, 10);
    const revisionIdNum = Number.parseInt(revisionId, 10);

    try {
      // Check if this is the current revision
      const { data: section } = await this.supabase
        .from("specification_sections")
        .select("current_revision_id")
        .eq("id", sectionIdNum)
        .eq("project_id", projectIdNum)
        .single();

      if (section?.current_revision_id === revisionIdNum) {
        return {
          data: null,
          error: {
            type: "REVISION_CONFLICT",
            message:
              "Cannot delete the current revision. Set a different revision as current first.",
          },
        };
      }

      // Get file URL before deleting
      const { data: revision } = await this.supabase
        .from("specification_section_revisions")
        .select("file_url")
        .eq("id", revisionIdNum)
        .eq("section_id", sectionIdNum)
        .single();

      if (!revision) {
        return {
          data: null,
          error: {
            type: "NOT_FOUND",
            message: `Revision with ID ${revisionId} not found`,
          },
        };
      }

      // Delete revision
      const { error } = await this.supabase
        .from("specification_section_revisions")
        .delete()
        .eq("id", revisionIdNum)
        .eq("section_id", sectionIdNum);

      if (error) {
        return {
          data: null,
          error: { type: "UNKNOWN", message: error.message },
        };
      }

      // Clean up storage file
      const storagePath = extractProjectFilesPath(revision.file_url);
      if (storagePath) {
        await this.supabase.storage
          .from("project-files")
          .remove([storagePath]);
      }

      return { data: null, error: null };
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
   * Get download URL for a revision file
   * Returns signed URL with 1-hour expiration
   */
  async getDownloadUrl(
    revisionId: string,
  ): Promise<Result<string, SpecificationError>> {
    const revisionIdNum = Number.parseInt(revisionId, 10);

    try {
      const { data: revision, error } = await this.supabase
        .from("specification_section_revisions")
        .select("file_url")
        .eq("id", revisionIdNum)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return {
            data: null,
            error: {
              type: "NOT_FOUND",
              message: `Revision with ID ${revisionId} not found`,
            },
          };
        }
        return {
          data: null,
          error: { type: "UNKNOWN", message: error.message },
        };
      }

      const storagePath = extractProjectFilesPath(revision.file_url);
      if (!storagePath) {
        return {
          data: null,
          error: {
            type: "STORAGE_ERROR",
            message: "Invalid file URL format",
          },
        };
      }

      // Create signed URL (1 hour expiration)
      const { data: signedUrlData, error: signedUrlError } =
        await this.supabase.storage
          .from("project-files")
          .createSignedUrl(storagePath, 3600);

      if (signedUrlError) {
        return {
          data: null,
          error: {
            type: "STORAGE_ERROR",
            message: signedUrlError.message,
          },
        };
      }

      return { data: signedUrlData.signedUrl, error: null };
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
   * Notify subscribers about a new revision
   * (Future: Integrate with notification system)
   */
  private async notifySubscribers(
    sectionId: number,
    revisionId: number,
  ): Promise<void> {
    // Get subscribers
    const { data: subscribers } = await this.supabase
      .from("specification_subscribers")
      .select("user_id")
      .eq("section_id", sectionId);

    if (!subscribers || subscribers.length === 0) return;

    // Future: Send notifications via notification service
    // For now, this is a placeholder for the notification integration
    // TODO: Send notifications via notification service
    // Placeholder for notification integration
  }
}
