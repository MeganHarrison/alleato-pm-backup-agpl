import { randomUUID } from "crypto";
import type { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { DirectoryFilters } from "@/components/directory/DirectoryFilters";
import type { ColumnConfig } from "@/components/directory/ColumnManager";

type Tables = Database["public"]["Tables"];
type UserProjectPreference = Tables["user_project_preferences"]["Row"];

const DIRECTORY_PREF_KEY = "directory";

interface PreferencesEnvelope extends Record<string, unknown> {
  [DIRECTORY_PREF_KEY]?: DirectoryPreferencesState;
}

export interface DirectorySavedFilter {
  id: string;
  name: string;
  description?: string;
  filters: DirectoryFilters;
  search?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DirectoryPreferencesState {
  savedFilters: DirectorySavedFilter[];
  lastFilters?: DirectoryFilters;
  columnPreferences?: ColumnConfig[];
}

interface LoadedPreferences {
  record: UserProjectPreference;
  envelope: PreferencesEnvelope;
  directory: DirectoryPreferencesState;
}

/**
 * Helper service that persists directory-specific preferences (saved filters,
 * last-used filters, and column visibility) in the shared
 * `user_project_preferences` table.
 */
export class DirectoryPreferencesService {
  constructor(private supabase: ReturnType<typeof createClient<Database>>) {}

  private normalizePreferences(
    prefs: PreferencesEnvelope | null,
  ): DirectoryPreferencesState {
    const directoryPrefs = prefs?.[DIRECTORY_PREF_KEY];

    if (directoryPrefs && typeof directoryPrefs === "object") {
      const typed = directoryPrefs as any;
      return {
        savedFilters: Array.isArray(typed.savedFilters)
          ? typed.savedFilters
          : [],
        lastFilters: typed.lastFilters,
        columnPreferences: typed.columnPreferences,
      };
    }

    return {
      savedFilters: [],
    };
  }

  private async loadPreferences(
    userId: string,
    projectId: string,
  ): Promise<LoadedPreferences> {
    const projectIdNum = Number.parseInt(projectId, 10);

    const { data, error } = await this.supabase
      .from("user_project_preferences")
      .select("*")
      .eq("user_id", userId)
      .eq("project_id", projectIdNum)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      const envelope = (data.preferences as PreferencesEnvelope) ?? {};
      return {
        record: data,
        envelope,
        directory: this.normalizePreferences(envelope),
      };
    }

    // Create an empty preference record for this user/project combo.
    const emptyEnvelope: PreferencesEnvelope = {
      [DIRECTORY_PREF_KEY]: {
        savedFilters: [],
      },
    };

    const { data: inserted, error: insertError } = await this.supabase
      .from("user_project_preferences")
      .insert({
        project_id: projectIdNum,
        user_id: userId,
        preferences: emptyEnvelope as any,
      })
      .select("*")
      .single();

    if (insertError || !inserted) {
      throw insertError || new Error("Unable to create preferences record");
    }

    return {
      record: inserted,
      envelope: emptyEnvelope,
      directory: emptyEnvelope[DIRECTORY_PREF_KEY]!,
    };
  }

  private async persistPreferences(
    recordId: string,
    preferences: PreferencesEnvelope,
  ) {
    const { error } = await this.supabase
      .from("user_project_preferences")
      .update({ preferences: preferences as any })
      .eq("id", recordId);

    if (error) {
      throw error;
    }
  }

  async listSavedFilters(
    userId: string,
    projectId: string,
  ): Promise<DirectorySavedFilter[]> {
    const loaded = await this.loadPreferences(userId, projectId);
    return loaded.directory.savedFilters;
  }

  async saveFilter(
    userId: string,
    projectId: string,
    payload: {
      id?: string;
      name: string;
      description?: string;
      filters: DirectoryFilters;
      search?: string;
    },
  ): Promise<DirectorySavedFilter> {
    const loaded = await this.loadPreferences(userId, projectId);
    const now = new Date().toISOString();

    const savedFilters = [...loaded.directory.savedFilters];
    let filter: DirectorySavedFilter;

    if (payload.id) {
      const index = savedFilters.findIndex((f) => f.id === payload.id);
      if (index >= 0) {
        filter = {
          ...savedFilters[index],
          name: payload.name,
          description: payload.description,
          filters: payload.filters,
          search: payload.search,
          updatedAt: now,
        };
        savedFilters[index] = filter;
      } else {
        filter = {
          id: payload.id,
          name: payload.name,
          description: payload.description,
          filters: payload.filters,
          createdAt: now,
          updatedAt: now,
        };
        savedFilters.push(filter);
      }
    } else {
      filter = {
        id: randomUUID(),
        name: payload.name,
        description: payload.description,
        filters: payload.filters,
        search: payload.search,
        createdAt: now,
        updatedAt: now,
      };
      savedFilters.push(filter);
    }

    const updatedDirectory: DirectoryPreferencesState = {
      ...loaded.directory,
      savedFilters,
    };

    const envelope: PreferencesEnvelope = {
      ...loaded.envelope,
      [DIRECTORY_PREF_KEY]: updatedDirectory,
    };

    await this.persistPreferences(loaded.record.id, envelope);

    return filter;
  }

  async deleteFilter(userId: string, projectId: string, filterId: string) {
    const loaded = await this.loadPreferences(userId, projectId);
    const savedFilters = loaded.directory.savedFilters.filter(
      (filter) => filter.id !== filterId,
    );

    const updatedDirectory: DirectoryPreferencesState = {
      ...loaded.directory,
      savedFilters,
    };

    const envelope: PreferencesEnvelope = {
      ...loaded.envelope,
      [DIRECTORY_PREF_KEY]: updatedDirectory,
    };

    await this.persistPreferences(loaded.record.id, envelope);
  }

  async saveLastFilters(
    userId: string,
    projectId: string,
    filters: DirectoryFilters,
  ) {
    const loaded = await this.loadPreferences(userId, projectId);

    const envelope: PreferencesEnvelope = {
      ...loaded.envelope,
      [DIRECTORY_PREF_KEY]: {
        ...loaded.directory,
        lastFilters: filters,
      },
    };

    await this.persistPreferences(loaded.record.id, envelope);
  }

  async getLastFilters(
    userId: string,
    projectId: string,
  ): Promise<DirectoryFilters | undefined> {
    const loaded = await this.loadPreferences(userId, projectId);
    return loaded.directory.lastFilters;
  }

  async saveColumnPreferences(
    userId: string,
    projectId: string,
    columns: ColumnConfig[],
  ) {
    const loaded = await this.loadPreferences(userId, projectId);

    const envelope: PreferencesEnvelope = {
      ...loaded.envelope,
      [DIRECTORY_PREF_KEY]: {
        ...loaded.directory,
        columnPreferences: columns,
      },
    };

    await this.persistPreferences(loaded.record.id, envelope);
  }

  async getColumnPreferences(
    userId: string,
    projectId: string,
  ): Promise<ColumnConfig[] | undefined> {
    const loaded = await this.loadPreferences(userId, projectId);
    return loaded.directory.columnPreferences;
  }
}
