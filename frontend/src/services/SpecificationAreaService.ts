import type { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types";
import type {
  SpecificationArea,
  SpecificationAreaInsert,
  SpecificationAreaUpdate,
  AreaWithSectionCount,
  SpecificationAreaData,
  SpecificationError,
  Result,
} from "../types/specifications.types";

/**
 * Service class for specification area management
 * Handles organization/categorization of specifications within projects
 * CRITICAL: project_id is INTEGER (matches projects.id type)
 */
export class SpecificationAreaService {
  constructor(private supabase: ReturnType<typeof createClient<Database>>) {}

  /**
   * Get all areas for a project with section counts
   * Returns areas ordered by sort_order
   */
  async listAreas(
    projectId: string,
  ): Promise<Result<AreaWithSectionCount[], SpecificationError>> {
    const projectIdNum = Number.parseInt(projectId, 10);

    try {
      const { data, error } = await this.supabase
        .from("specification_areas")
        .select(
          `
          *,
          section_count:specification_area_sections(count)
        `,
        )
        .eq("project_id", projectIdNum)
        .order("sort_order", { ascending: true });

      if (error) {
        return {
          data: null,
          error: { type: "UNKNOWN", message: error.message },
        };
      }

      const areasWithCounts: AreaWithSectionCount[] = (data || []).map(
        (area: any) => ({
          ...area,
          section_count: area.section_count?.[0]?.count || 0,
        }),
      );

      return { data: areasWithCounts, error: null };
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
   * Get a single area by ID
   */
  async getArea(
    projectId: string,
    areaId: string,
  ): Promise<Result<AreaWithSectionCount, SpecificationError>> {
    const projectIdNum = Number.parseInt(projectId, 10);
    const areaIdNum = Number.parseInt(areaId, 10);

    try {
      const { data, error } = await this.supabase
        .from("specification_areas")
        .select(
          `
          *,
          section_count:specification_area_sections(count)
        `,
        )
        .eq("id", areaIdNum)
        .eq("project_id", projectIdNum)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return {
            data: null,
            error: {
              type: "NOT_FOUND",
              message: `Area with ID ${areaId} not found`,
            },
          };
        }
        return {
          data: null,
          error: { type: "UNKNOWN", message: error.message },
        };
      }

      const area: AreaWithSectionCount = {
        ...data,
        section_count: data.section_count?.[0]?.count || 0,
      };

      return { data: area, error: null };
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
   * Create a new area
   */
  async createArea(
    projectId: string,
    data: SpecificationAreaData,
  ): Promise<Result<SpecificationArea, SpecificationError>> {
    const projectIdNum = Number.parseInt(projectId, 10);

    try {
      // Check for duplicate name
      const { data: existing } = await this.supabase
        .from("specification_areas")
        .select("id")
        .eq("project_id", projectIdNum)
        .eq("name", data.name)
        .single();

      if (existing) {
        return {
          data: null,
          error: {
            type: "UNKNOWN",
            message: `Area with name "${data.name}" already exists for this project`,
          },
        };
      }

      // If no sort_order provided, use max + 1
      let sort_order = data.sort_order || 0;
      if (!data.sort_order) {
        const { data: maxArea } = await this.supabase
          .from("specification_areas")
          .select("sort_order")
          .eq("project_id", projectIdNum)
          .order("sort_order", { ascending: false })
          .limit(1)
          .single();

        if (maxArea) {
          sort_order = (maxArea.sort_order || 0) + 1;
        }
      }

      const areaInsert: SpecificationAreaInsert = {
        project_id: projectIdNum,
        name: data.name,
        description: data.description,
        sort_order,
      };

      const { data: area, error } = await this.supabase
        .from("specification_areas")
        .insert(areaInsert)
        .select()
        .single();

      if (error) {
        return {
          data: null,
          error: { type: "UNKNOWN", message: error.message },
        };
      }

      return { data: area, error: null };
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
   * Update an area
   */
  async updateArea(
    projectId: string,
    areaId: string,
    data: SpecificationAreaData,
  ): Promise<Result<SpecificationArea, SpecificationError>> {
    const projectIdNum = Number.parseInt(projectId, 10);
    const areaIdNum = Number.parseInt(areaId, 10);

    try {
      // Check for duplicate name if changing it
      if (data.name) {
        const { data: existing } = await this.supabase
          .from("specification_areas")
          .select("id")
          .eq("project_id", projectIdNum)
          .eq("name", data.name)
          .neq("id", areaIdNum)
          .single();

        if (existing) {
          return {
            data: null,
            error: {
              type: "UNKNOWN",
              message: `Area with name "${data.name}" already exists for this project`,
            },
          };
        }
      }

      const updateData: SpecificationAreaUpdate = {
        ...data,
        updated_at: new Date().toISOString(),
      };

      const { data: updated, error } = await this.supabase
        .from("specification_areas")
        .update(updateData)
        .eq("id", areaIdNum)
        .eq("project_id", projectIdNum)
        .select()
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return {
            data: null,
            error: {
              type: "NOT_FOUND",
              message: `Area with ID ${areaId} not found`,
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
   * Delete an area
   * CRITICAL: Cascading delete removes all area-section links
   */
  async deleteArea(
    projectId: string,
    areaId: string,
  ): Promise<Result<void, SpecificationError>> {
    const projectIdNum = Number.parseInt(projectId, 10);
    const areaIdNum = Number.parseInt(areaId, 10);

    try {
      const { error } = await this.supabase
        .from("specification_areas")
        .delete()
        .eq("id", areaIdNum)
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
   * Reorder areas by updating sort_order values
   * Accepts array of area IDs in desired order
   */
  async reorderAreas(
    projectId: string,
    orderedAreaIds: number[],
  ): Promise<Result<void, SpecificationError>> {
    const projectIdNum = Number.parseInt(projectId, 10);

    try {
      // Update sort_order for each area
      const updates = orderedAreaIds.map((areaId, index) =>
        this.supabase
          .from("specification_areas")
          .update({ sort_order: index })
          .eq("id", areaId)
          .eq("project_id", projectIdNum),
      );

      const results = await Promise.all(updates);

      // Check for errors
      const errors = results.filter((r) => r.error);
      if (errors.length > 0) {
        return {
          data: null,
          error: {
            type: "UNKNOWN",
            message: `Failed to reorder areas: ${errors[0].error?.message}`,
          },
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
   * Get all specifications in an area
   */
  async getAreaSpecifications(
    projectId: string,
    areaId: string,
  ): Promise<Result<any[], SpecificationError>> {
    const projectIdNum = Number.parseInt(projectId, 10);
    const areaIdNum = Number.parseInt(areaId, 10);

    try {
      const { data, error } = await this.supabase
        .from("specification_area_sections")
        .select(
          `
          section_id,
          section:specification_sections(*)
        `,
        )
        .eq("area_id", areaIdNum)
        .eq("section.project_id", projectIdNum);

      if (error) {
        return {
          data: null,
          error: { type: "UNKNOWN", message: error.message },
        };
      }

      const specifications = (data || [])
        .map((link: any) => link.section)
        .filter(Boolean);

      return { data: specifications, error: null };
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
