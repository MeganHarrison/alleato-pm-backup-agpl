import type { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types";
import type {
  SpecificationSection,
  SpecificationSectionInsert,
  SpecificationSectionUpdate,
  SpecificationWithRevision,
  SpecificationWithAreas,
  SpecificationFilters,
  SpecificationListResponse,
  UploadSpecificationData,
  UpdateSpecificationData,
  SpecificationError,
  Result,
} from "../types/specifications.types";
import { sanitizeFilename } from "../lib/schemas/specification-schemas";

type Tables = Database["public"]["Tables"];
type SpecificationRevision = Tables["specification_section_revisions"]["Row"];
type SpecificationArea = Tables["specification_areas"]["Row"];

function extractProjectFilesPath(fileUrl: string): string | null {
  if (!fileUrl) return null;

  // Handle values already stored as storage path.
  if (fileUrl.startsWith("project-files/")) {
    return fileUrl.replace(/^project-files\//, "");
  }
  if (!fileUrl.startsWith("http://") && !fileUrl.startsWith("https://")) {
    return fileUrl;
  }

  // Handle public and signed Supabase storage URLs.
  const decoded = decodeURIComponent(fileUrl);
  const match =
    decoded.match(/\/object\/(?:public|sign)\/project-files\/([^?]+)/) ||
    decoded.match(/\/project-files\/([^?]+)/);

  return match?.[1] ?? null;
}

/**
 * Service class for specification document management
 * Handles CRUD operations for specification sections with revision tracking
 * CRITICAL: project_id is INTEGER (matches projects.id type)
 */
export class SpecificationService {
  constructor(private supabase: ReturnType<typeof createClient<Database>>) {}

  /**
   * Get paginated list of specifications for a project with optional filters
   * Returns specifications with current revision details and counts
   */
  async list(
    projectId: string,
    filters: SpecificationFilters = {},
  ): Promise<Result<SpecificationListResponse, SpecificationError>> {
    const {
      search,
      area_id,
      status,
      uploaded_after,
      uploaded_before,
      page = 1,
      page_size = 50,
    } = filters;

    const projectIdNum = Number.parseInt(projectId, 10);
    const offset = (page - 1) * page_size;

    try {
      // Base query with current revision join
      let query = this.supabase
        .from("specification_sections")
        .select(
          `
          *,
          current_revision:specification_section_revisions!fk_sections_current_revision(*),
          area_count:specification_area_sections(count),
          subscriber_count:specification_subscribers(count)
        `,
          { count: "exact" },
        )
        .eq("project_id", projectIdNum);

      // Apply filters
      if (status) {
        query = query.eq("status", status);
      }

      if (area_id) {
        // Filter by specifications linked to this area
        // First get section IDs for this area
        const { data: areaSections } = await this.supabase
          .from("specification_area_sections")
          .select("section_id")
          .eq("area_id", area_id);

        const sectionIds = (areaSections || []).map((as) => as.section_id);

        if (sectionIds.length > 0) {
          query = query.in("id", sectionIds);
        } else {
          // No sections in this area, return empty result
          return {
            data: {
              specifications: [],
              total_count: 0,
              page,
              page_size,
              has_next_page: false,
              has_previous_page: false,
            },
            error: null,
          };
        }
      }

      if (uploaded_after) {
        query = query.gte("created_at", uploaded_after);
      }

      if (uploaded_before) {
        query = query.lte("created_at", uploaded_before);
      }

      // Full-text search on section_number, title, description
      if (search) {
        query = query.or(
          `section_number.ilike.%${search}%,title.ilike.%${search}%,description.ilike.%${search}%`,
        );
      }

      // Apply pagination
      query = query
        .order("section_number", { ascending: true })
        .range(offset, offset + page_size - 1);

      const { data, error, count } = await query;

      if (error) {
        return {
          data: null,
          error: { type: "UNKNOWN", message: error.message },
        };
      }

      // Transform data to include counts
      const specifications: SpecificationWithRevision[] = (data || []).map(
        (spec: any) => ({
          ...spec,
          area_count: spec.area_count?.[0]?.count || 0,
          subscriber_count: spec.subscriber_count?.[0]?.count || 0,
        }),
      );

      return {
        data: {
          specifications,
          total_count: count || 0,
          page,
          page_size,
          has_next_page: offset + page_size < (count || 0),
          has_previous_page: page > 1,
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
   * Get a single specification by ID with full details
   * Includes current revision, assigned areas, and subscriber count
   */
  async getById(
    projectId: string,
    sectionId: string,
  ): Promise<Result<SpecificationWithAreas, SpecificationError>> {
    const projectIdNum = Number.parseInt(projectId, 10);
    const sectionIdNum = Number.parseInt(sectionId, 10);

    try {
      const { data, error } = await this.supabase
        .from("specification_sections")
        .select(
          `
          *,
          current_revision:specification_section_revisions!fk_sections_current_revision(*),
          areas:specification_area_sections(
            area:specification_areas(*)
          )
        `,
        )
        .eq("project_id", projectIdNum)
        .eq("id", sectionIdNum)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
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
          error: { type: "UNKNOWN", message: error.message },
        };
      }

      // Transform joined areas data
      const transformedAreas = (data.areas || [])
        .map((a: any) => a.area)
        .filter(Boolean) as SpecificationArea[];

      const specification: SpecificationWithAreas = {
        ...data,
        areas: transformedAreas,
        current_revision: data.current_revision || null,
      };

      return { data: specification, error: null };
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
   * Create a new specification section with initial file upload
   * Handles both specification metadata and file storage
   * CRITICAL: Uses database function for transaction-safe revision creation
   */
  async create(
    projectId: string,
    data: UploadSpecificationData,
    uploadedBy: string,
  ): Promise<Result<SpecificationSection, SpecificationError>> {
    const projectIdNum = Number.parseInt(projectId, 10);

    try {
      // 1. Validate file size and type (already validated by schema, but double-check)
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

      // 2. Check for duplicate section number
      const { data: existing } = await this.supabase
        .from("specification_sections")
        .select("id")
        .eq("project_id", projectIdNum)
        .eq("section_number", data.section_number)
        .single();

      if (existing) {
        return {
          data: null,
          error: {
            type: "DUPLICATE_SECTION_NUMBER",
            message: `Section number ${data.section_number} already exists for this project`,
          },
        };
      }

      // 3. Upload file to Supabase Storage
      const sanitizedFilename = sanitizeFilename(data.file.name);
      const filePath = `${projectId}/specifications/${Date.now()}_${sanitizedFilename}`;

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

      // 4. Get public URL for the uploaded file
      const { data: urlData } = this.supabase.storage
        .from("project-files")
        .getPublicUrl(filePath);

      const fileUrl = urlData.publicUrl;

      // 5. Create specification section
      const sectionInsert: SpecificationSectionInsert = {
        project_id: projectIdNum,
        section_number: data.section_number,
        title: data.title,
        description: data.description,
        status: "active",
        created_by: uploadedBy,
        updated_by: uploadedBy,
      };

      const { data: section, error: sectionError } = await this.supabase
        .from("specification_sections")
        .insert(sectionInsert)
        .select()
        .single();

      if (sectionError) {
        // Clean up uploaded file if section creation fails
        await this.supabase.storage.from("project-files").remove([filePath]);
        return {
          data: null,
          error: { type: "UNKNOWN", message: sectionError.message },
        };
      }

      // 6. Create initial revision using database function (transaction-safe)
      const { data: revision, error: revisionError } = await this.supabase.rpc(
        "create_specification_revision",
        {
          p_section_id: section.id,
          p_file_url: fileUrl,
          p_file_name: data.file.name,
          p_file_size: data.file.size,
          p_file_type: data.file.type || "application/octet-stream",
          p_uploaded_by: uploadedBy,
          p_notes: data.notes,
        },
      );

      if (revisionError) {
        // Clean up created section and file
        await this.supabase
          .from("specification_sections")
          .delete()
          .eq("id", section.id);
        await this.supabase.storage.from("project-files").remove([filePath]);
        return {
          data: null,
          error: { type: "UNKNOWN", message: revisionError.message },
        };
      }

      // 7. Link to areas if provided
      if (data.area_ids && data.area_ids.length > 0) {
        const areaLinks = data.area_ids.map((area_id) => ({
          area_id,
          section_id: section.id,
        }));

        await this.supabase
          .from("specification_area_sections")
          .insert(areaLinks);
      }

      // 8. Add subscribers if provided
      if (data.subscriber_ids && data.subscriber_ids.length > 0) {
        const subscribers = data.subscriber_ids.map((user_id) => ({
          section_id: section.id,
          user_id,
        }));

        await this.supabase.from("specification_subscribers").insert(subscribers);
      }

      return { data: section, error: null };
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
   * Update specification section metadata (not file)
   * For file updates, use SpecificationRevisionService.addRevision()
   */
  async update(
    projectId: string,
    sectionId: string,
    data: UpdateSpecificationData,
    updatedBy: string,
  ): Promise<Result<SpecificationSection, SpecificationError>> {
    const projectIdNum = Number.parseInt(projectId, 10);
    const sectionIdNum = Number.parseInt(sectionId, 10);

    try {
      // Check for duplicate section number if changing it
      if (data.section_number) {
        const { data: existing } = await this.supabase
          .from("specification_sections")
          .select("id")
          .eq("project_id", projectIdNum)
          .eq("section_number", data.section_number)
          .neq("id", sectionIdNum)
          .single();

        if (existing) {
          return {
            data: null,
            error: {
              type: "DUPLICATE_SECTION_NUMBER",
              message: `Section number ${data.section_number} already exists for this project`,
            },
          };
        }
      }

      const updateData: SpecificationSectionUpdate = {
        ...data,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      };

      const { data: updated, error } = await this.supabase
        .from("specification_sections")
        .update(updateData)
        .eq("id", sectionIdNum)
        .eq("project_id", projectIdNum)
        .select()
        .single();

      if (error) {
        if (error.code === "PGRST116") {
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
          error: { type: "UNKNOWN", message: error.message },
        };
      }

      return { data: updated, error: null };
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
   * Delete a specification section and all associated data
   * Cascading deletes handled by database foreign keys
   * CRITICAL: Files in storage are NOT automatically deleted
   */
  async delete(
    projectId: string,
    sectionId: string,
  ): Promise<Result<void, SpecificationError>> {
    const projectIdNum = Number.parseInt(projectId, 10);
    const sectionIdNum = Number.parseInt(sectionId, 10);

    try {
      // Get all revision file URLs before deleting (for storage cleanup)
      const { data: revisions } = await this.supabase
        .from("specification_section_revisions")
        .select("file_url")
        .eq("section_id", sectionIdNum);

      // Delete the section (cascades to revisions, area links, subscribers)
      const { error } = await this.supabase
        .from("specification_sections")
        .delete()
        .eq("id", sectionIdNum)
        .eq("project_id", projectIdNum);

      if (error) {
        return {
          data: null,
          error: { type: "UNKNOWN", message: error.message },
        };
      }

      // Clean up storage files
      if (revisions && revisions.length > 0) {
        const filePaths = revisions
          .map((r) => extractProjectFilesPath(r.file_url))
          .filter(Boolean) as string[];

        if (filePaths.length > 0) {
          await this.supabase.storage.from("project-files").remove(filePaths);
        }
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
   * Search specifications using full-text search
   * Searches across section_number, title, and description
   */
  async search(
    projectId: string,
    searchQuery: string,
    page = 1,
    page_size = 50,
  ): Promise<Result<SpecificationListResponse, SpecificationError>> {
    return this.list(projectId, {
      search: searchQuery,
      page,
      page_size,
    });
  }

  /**
   * Link specification to an area
   */
  async linkToArea(
    sectionId: string,
    areaId: number,
  ): Promise<Result<void, SpecificationError>> {
    const sectionIdNum = Number.parseInt(sectionId, 10);

    try {
      const { error } = await this.supabase
        .from("specification_area_sections")
        .insert({
          section_id: sectionIdNum,
          area_id: areaId,
        });

      if (error) {
        // Check if already linked (unique constraint violation)
        if (error.code === "23505") {
          return { data: null, error: null }; // Already linked, not an error
        }
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
   * Unlink specification from an area
   */
  async unlinkFromArea(
    sectionId: string,
    areaId: number,
  ): Promise<Result<void, SpecificationError>> {
    const sectionIdNum = Number.parseInt(sectionId, 10);

    try {
      const { error } = await this.supabase
        .from("specification_area_sections")
        .delete()
        .eq("section_id", sectionIdNum)
        .eq("area_id", areaId);

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
}
