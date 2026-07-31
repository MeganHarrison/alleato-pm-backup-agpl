"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { X } from "lucide-react";
import { useSupabase } from "@/hooks/useSupabase";
import type { DirectorySavedFilter } from "@/services/directoryPreferencesService";
import type { Database } from "@/types/database.types";
import { SectionRuleHeading } from "@/components/layout/spacing";

type Tables = Database["public"]["Tables"];
type Company = Tables["companies"]["Row"];
type PermissionTemplate = Tables["permission_templates"]["Row"];

export interface DirectoryFilters {
  search?: string;
  type?: "user" | "contact" | "all";
  status?: "active" | "inactive" | "all";
  companyId?: string;
  permissionTemplateId?: string;
  groupBy?: "company" | "none";
  sortBy?: string[];
}

// Type-safe union for all possible filter values
type DirectoryFilterValue =
  | "user"
  | "contact"
  | "all"
  | "active"
  | "inactive"
  | "company"
  | "none"
  | string
  | string[]
  | undefined;

export interface PersonWithDetails {
  id: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  phone_mobile?: string | null;
  phone_business?: string | null;
  job_title?: string | null;
  person_type: "user" | "contact";
  status: "active" | "inactive";
  avatar_updated_at?: string | null;
  company?: Company | null;
  membership?: {
    id: string;
    status: "active" | "inactive";
    invite_status?: "not_invited" | "invited" | "accepted" | "expired" | null;
    permission_template_id?: string | null;
  } | null;
  permission_template?: PermissionTemplate | null;
}

interface DirectoryFiltersProps {
  filters: DirectoryFilters;
  onFiltersChange: (filters: DirectoryFilters) => void;
  projectId: string;
  search?: string;
  onSavedFilterSelected?: (filters: DirectoryFilters, search?: string) => void;
  savedFilters?: DirectorySavedFilter[];
  savedFiltersLoading?: boolean;
  onSaveFilter?: (filters: DirectoryFilters, search?: string) => void;
  onDeleteSavedFilter?: (id: string) => void;
}

/**
 * Render a directory filter panel and manage loading of company and permission template options.
 *
 * Renders controls for type, status, company, permission template, grouping, and sort order; loads company and permission template options on mount and propagates every change via the `onFiltersChange` callback.
 *
 * @param filters - Current filter state to drive the control values
 * @param onFiltersChange - Callback invoked with the updated filters when any control changes
 * @param projectId - Identifier for the current project (passed to the component but not required for control interaction)
 * @returns The filter panel JSX element
 */
export function DirectoryFilters({
  filters,
  onFiltersChange,
  projectId,
  search,
  onSavedFilterSelected,
  savedFilters = [],
  savedFiltersLoading = false,
  onSaveFilter,
  onDeleteSavedFilter,
}: DirectoryFiltersProps) {
  const supabase = useSupabase();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [permissionTemplates, setPermissionTemplates] = useState<
    PermissionTemplate[]
  >([]);
  const [loading, setLoading] = useState(false);

  // Load companies and permission templates
  useEffect(() => {
    const loadFilterData = async () => {
      setLoading(true);
      try {
        // Load companies
        const { data: companiesData, error: companiesError } = await supabase
          .from("companies")
          .select("*")
          .order("name");

        if (!companiesError && companiesData) {
          setCompanies(companiesData);
        }

        // Load permission templates
        const { data: templatesData, error: templatesError } = await supabase
          .from("permission_templates")
          .select("*")
          .eq("scope", "project")
          .order("name");

        if (!templatesError && templatesData) {
          setPermissionTemplates(templatesData);
        }
      } catch (error) {

        console.error("Failed to fetch directory filters:", error);

        // Intentionally swallowed: component shows appropriate state on error

      } finally {
        setLoading(false);
      }
    };

    loadFilterData();
  }, [supabase]);

  const handleFilterChange = (
    key: keyof DirectoryFilters,
    value: DirectoryFilterValue,
  ) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    });
  };

  const clearFilters = () => {
    onFiltersChange({
      type: "all",
      status: "active",
      groupBy: filters.groupBy, // Preserve grouping preference
    });
  };

  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    if (key === "groupBy") return false;
    if (key === "status" && value === "active") return false;
    if (key === "type" && value === "all") return false;
    return value !== undefined && value !== "";
  }).length;

  const handleSaveCurrentFilters = () => {
    if (!onSaveFilter) return;
    onSaveFilter(filters, search);
  };

  const handleApplySavedFilter = (savedFilter: DirectorySavedFilter) => {
    onFiltersChange(savedFilter.filters);
    if (onSavedFilterSelected) {
      onSavedFilterSelected(savedFilter.filters, savedFilter.search);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Filters</CardTitle>
            {activeFilterCount > 0 && (
              <CardDescription>
                {activeFilterCount} active{" "}
                {activeFilterCount === 1 ? "filter" : "filters"}
              </CardDescription>
            )}
          </div>
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear all
              <X className="ml-2 h-3 w-3" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-md border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Saved Filters</Label>
              {savedFiltersLoading && (
                <p className="text-xs text-muted-foreground">Loading…</p>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={handleSaveCurrentFilters}>
              Save current
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {savedFilters.length === 0 ? (
              <span className="text-xs text-muted-foreground">
                No saved filters yet.
              </span>
            ) : (
              savedFilters.map((filter) => (
                <Button
                  key={filter.id}
                  variant="secondary"
                  size="sm"
                  onClick={() => handleApplySavedFilter(filter)}
                  className="gap-2"
                >
                  {filter.name}
                  <X
                    className="h-3 w-3"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeleteSavedFilter?.(filter.id);
                    }}
                  />
                </Button>
              ))
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {/* Person Type Filter */}
          <div className="space-y-2">
            <Label htmlFor="type-filter">Type</Label>
            <Select
              value={filters.type || "all"}
              onValueChange={(value) => handleFilterChange("type", value)}
            >
              <SelectTrigger id="type-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="user">Users Only</SelectItem>
                <SelectItem value="contact">Contacts Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div className="space-y-2">
            <Label htmlFor="status-filter">Status</Label>
            <Select
              value={filters.status || "active"}
              onValueChange={(value) => handleFilterChange("status", value)}
            >
              <SelectTrigger id="status-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Company Filter */}
          <div className="space-y-2">
            <Label htmlFor="company-filter">Company</Label>
            <Select
              value={filters.companyId || "all"}
              onValueChange={(value) =>
                handleFilterChange(
                  "companyId",
                  value === "all" ? undefined : value,
                )
              }
              disabled={loading}
            >
              <SelectTrigger id="company-filter">
                <SelectValue placeholder="All Companies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                <SelectItem value="no-company">No Company</SelectItem>
                <Separator className="my-1" />
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Permission Template Filter */}
          <div className="space-y-2">
            <Label htmlFor="permission-filter">Permission</Label>
            <Select
              value={filters.permissionTemplateId || "all"}
              onValueChange={(value) =>
                handleFilterChange(
                  "permissionTemplateId",
                  value === "all" ? undefined : value,
                )
              }
              disabled={loading}
            >
              <SelectTrigger id="permission-filter">
                <SelectValue placeholder="All Permissions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Permissions</SelectItem>
                <SelectItem value="none">No Permission</SelectItem>
                <Separator className="my-1" />
                {permissionTemplates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        {/* View Options */}
        <div className="space-y-4">
          <SectionRuleHeading label="View Options" />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="group-by-company">Group by Company</Label>
              <p className="text-xs text-muted-foreground">
                Organize people by their company affiliation
              </p>
            </div>
            <Switch
              id="group-by-company"
              checked={filters.groupBy === "company"}
              onCheckedChange={(checked) =>
                handleFilterChange("groupBy", checked ? "company" : "none")
              }
            />
          </div>
        </div>

        <Separator />

        {/* Sort Options */}
        <div className="space-y-4">
          <SectionRuleHeading label="Sort By" />

          <div className="space-y-2">
            <Select
              value={filters.sortBy?.[0] || "company:asc"}
              onValueChange={(value) => handleFilterChange("sortBy", [value])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="company:asc">Company (A-Z)</SelectItem>
                <SelectItem value="company:desc">Company (Z-A)</SelectItem>
                <SelectItem value="name:asc">Name (A-Z)</SelectItem>
                <SelectItem value="name:desc">Name (Z-A)</SelectItem>
                <SelectItem value="email:asc">Email (A-Z)</SelectItem>
                <SelectItem value="email:desc">Email (Z-A)</SelectItem>
                <SelectItem value="created_at:desc">Newest First</SelectItem>
                <SelectItem value="created_at:asc">Oldest First</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
