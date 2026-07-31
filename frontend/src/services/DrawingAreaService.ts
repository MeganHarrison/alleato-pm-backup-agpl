import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

type DrawingAreaError = { type: string; message: string };
type Result<T, E = DrawingAreaError> = { data: T; error: null } | { data: null; error: E };

type DrawingArea = Database['public']['Tables']['drawing_areas']['Row'];
type DrawingAreaWithCounts = Database['public']['Views']['drawing_areas_with_counts']['Row'];
type DrawingAreaInsert = Database['public']['Tables']['drawing_areas']['Insert'];
type DrawingAreaUpdate = Database['public']['Tables']['drawing_areas']['Update'];

export interface CreateDrawingAreaInput {
  name: string;
  description?: string;
  parent_area_id?: string;
  sort_order?: number;
}

export interface UpdateDrawingAreaInput {
  name?: string;
  description?: string;
  parent_area_id?: string;
  sort_order?: number;
}

/**
 * Service class for managing drawing areas.
 * Uses instance-based pattern with Supabase client injection.
 */
export class DrawingAreaService {
  constructor(private supabase: ReturnType<typeof createClient<Database>>) {}

  /**
   * List all drawing areas for a project with counts.
   * @param projectId - The project ID to filter by
   * @returns Result containing array of drawing areas with counts
   */
  async list(projectId: string): Promise<Result<DrawingAreaWithCounts[]>> {
    try {
      const projectIdNum = parseInt(projectId, 10);
      if (isNaN(projectIdNum)) {
        return {
          data: null,
          error: {
            type: 'INVALID_INPUT',
            message: 'Invalid project ID format',
          },
        };
      }

      const { data, error } = await this.supabase
        .from('drawing_areas_with_counts')
        .select('*')
        .eq('project_id', projectIdNum)
        .order('sort_order', { ascending: true });

      if (error) {
        return {
          data: null,
          error: {
            type: 'DATABASE_ERROR',
            message: error.message,
          },
        };
      }

      return { data: data || [], error: null };
    } catch (err) {
      return {
        data: null,
        error: {
          type: 'UNKNOWN_ERROR',
          message: err instanceof Error ? err.message : 'An unknown error occurred',
        },
      };
    }
  }

  /**
   * Get a single drawing area by ID.
   * @param areaId - The drawing area ID
   * @returns Result containing the drawing area
   */
  async getById(areaId: string): Promise<Result<DrawingArea>> {
    try {
      const { data, error } = await this.supabase
        .from('drawing_areas')
        .select('*')
        .eq('id', areaId)
        .single();

      if (error) {
        return {
          data: null,
          error: {
            type: error.code === 'PGRST116' ? 'NOT_FOUND' : 'DATABASE_ERROR',
            message: error.message,
          },
        };
      }

      return { data, error: null };
    } catch (err) {
      return {
        data: null,
        error: {
          type: 'UNKNOWN_ERROR',
          message: err instanceof Error ? err.message : 'An unknown error occurred',
        },
      };
    }
  }

  /**
   * Create a new drawing area.
   * @param projectId - The project ID
   * @param input - The drawing area data
   * @param userId - The user ID creating the area
   * @returns Result containing the created drawing area
   */
  async create(
    projectId: string,
    input: CreateDrawingAreaInput,
    userId: string
  ): Promise<Result<DrawingArea>> {
    try {
      const projectIdNum = parseInt(projectId, 10);
      if (isNaN(projectIdNum)) {
        return {
          data: null,
          error: {
            type: 'INVALID_INPUT',
            message: 'Invalid project ID format',
          },
        };
      }

      if (!input.name || input.name.trim().length === 0) {
        return {
          data: null,
          error: {
            type: 'INVALID_INPUT',
            message: 'Drawing area name is required',
          },
        };
      }

      const insertData: DrawingAreaInsert = {
        project_id: projectIdNum,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        parent_area_id: input.parent_area_id || null,
        sort_order: input.sort_order ?? 0,
        created_by: userId,
      };

      const { data, error } = await this.supabase
        .from('drawing_areas')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        return {
          data: null,
          error: {
            type: 'DATABASE_ERROR',
            message: error.message,
          },
        };
      }

      return { data, error: null };
    } catch (err) {
      return {
        data: null,
        error: {
          type: 'UNKNOWN_ERROR',
          message: err instanceof Error ? err.message : 'An unknown error occurred',
        },
      };
    }
  }

  /**
   * Update an existing drawing area.
   * @param areaId - The drawing area ID
   * @param input - The fields to update
   * @returns Result containing the updated drawing area
   */
  async update(
    areaId: string,
    input: UpdateDrawingAreaInput
  ): Promise<Result<DrawingArea>> {
    try {
      if (Object.keys(input).length === 0) {
        return {
          data: null,
          error: {
            type: 'INVALID_INPUT',
            message: 'No fields to update',
          },
        };
      }

      if (input.name !== undefined && input.name.trim().length === 0) {
        return {
          data: null,
          error: {
            type: 'INVALID_INPUT',
            message: 'Drawing area name cannot be empty',
          },
        };
      }

      const updateData: DrawingAreaUpdate = {};

      if (input.name !== undefined) {
        updateData.name = input.name.trim();
      }
      if (input.description !== undefined) {
        updateData.description = input.description.trim() || null;
      }
      if (input.parent_area_id !== undefined) {
        updateData.parent_area_id = input.parent_area_id || null;
      }
      if (input.sort_order !== undefined) {
        updateData.sort_order = input.sort_order;
      }

      const { data, error } = await this.supabase
        .from('drawing_areas')
        .update(updateData)
        .eq('id', areaId)
        .select()
        .single();

      if (error) {
        return {
          data: null,
          error: {
            type: error.code === 'PGRST116' ? 'NOT_FOUND' : 'DATABASE_ERROR',
            message: error.message,
          },
        };
      }

      return { data, error: null };
    } catch (err) {
      return {
        data: null,
        error: {
          type: 'UNKNOWN_ERROR',
          message: err instanceof Error ? err.message : 'An unknown error occurred',
        },
      };
    }
  }

  /**
   * Delete a drawing area.
   * @param areaId - The drawing area ID
   * @returns Result containing success status
   */
  async delete(areaId: string): Promise<Result<{ success: true }>> {
    try {
      const { error } = await this.supabase
        .from('drawing_areas')
        .delete()
        .eq('id', areaId);

      if (error) {
        return {
          data: null,
          error: {
            type: 'DATABASE_ERROR',
            message: error.message,
          },
        };
      }

      return { data: { success: true }, error: null };
    } catch (err) {
      return {
        data: null,
        error: {
          type: 'UNKNOWN_ERROR',
          message: err instanceof Error ? err.message : 'An unknown error occurred',
        },
      };
    }
  }

  /**
   * Reorder a drawing area by updating its sort order.
   * @param areaId - The drawing area ID
   * @param newSortOrder - The new sort order value
   * @returns Result containing the updated drawing area
   */
  async reorder(areaId: string, newSortOrder: number): Promise<Result<DrawingArea>> {
    try {
      if (!Number.isInteger(newSortOrder) || newSortOrder < 0) {
        return {
          data: null,
          error: {
            type: 'INVALID_INPUT',
            message: 'Sort order must be a non-negative integer',
          },
        };
      }

      const { data, error } = await this.supabase
        .from('drawing_areas')
        .update({ sort_order: newSortOrder })
        .eq('id', areaId)
        .select()
        .single();

      if (error) {
        return {
          data: null,
          error: {
            type: error.code === 'PGRST116' ? 'NOT_FOUND' : 'DATABASE_ERROR',
            message: error.message,
          },
        };
      }

      return { data, error: null };
    } catch (err) {
      return {
        data: null,
        error: {
          type: 'UNKNOWN_ERROR',
          message: err instanceof Error ? err.message : 'An unknown error occurred',
        },
      };
    }
  }
}
