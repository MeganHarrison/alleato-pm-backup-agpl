"use client";

import * as React from "react";
import {
  PortfolioHeader,
  PortfolioFilters,
  ProjectsTable,
} from "@/components/portfolio";
import { PortfolioViewType, StatusFilter, Project } from "@/types/portfolio";
import { portfolioViews, financialViews } from "@/config/portfolio";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { PageShell } from "@/components/layout";
import {
  DEFAULT_PROJECT_PHASE_FILTER,
  filterPortfolioProjects,
} from "@/lib/portfolio/projects-page-filters";

export default function ProjectsPage() {
  const router = useRouter();
  const [activeView, setActiveView] = React.useState("projects");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] =
    React.useState<StatusFilter>("active");
  const [viewType, setViewType] = React.useState<PortfolioViewType>("list");
  const [phaseFilter, setPhaseFilter] = React.useState<string | null>(
    DEFAULT_PROJECT_PHASE_FILTER,
  );
  const [categoryFilter, setCategoryFilter] = React.useState<string | null>(
    null,
  );
  const [clientFilter, setClientFilter] = React.useState<string | null>(null);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Fetch projects from Supabase
  React.useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        const baseParams = new URLSearchParams();

        if (searchQuery) baseParams.append("search", searchQuery);
        if (statusFilter === "active") baseParams.append("archived", "false");
        else if (statusFilter === "inactive")
          baseParams.append("archived", "true");

        const allProjectRows: Record<string, unknown>[] = [];
        let page = 1;
        let totalPages = 1;

        while (page <= totalPages) {
          const pagedParams = new URLSearchParams(baseParams);
          pagedParams.set("page", String(page));
          pagedParams.set("limit", "100");

          let result: { data?: unknown[]; meta?: { totalPages?: number } };
          try {
            result = await apiFetch<{
              data?: unknown[];
              meta?: { totalPages?: number };
            }>(`/api/projects?${pagedParams.toString()}`);
          } catch (fetchError) {
            console.error("Failed to fetch projects:", fetchError);
            setProjects([]);
            return;
          }

          const pageRows = Array.isArray(result.data)
            ? (result.data as Record<string, unknown>[])
            : [];
          allProjectRows.push(...pageRows);
          const apiTotalPages =
            typeof result.meta?.totalPages === "number"
              ? result.meta.totalPages
              : 1;
          totalPages = Math.max(apiTotalPages, 1);
          page += 1;
        }

        const toStringValue = (value: unknown, fallback = ""): string => {
          if (typeof value === "string") return value;
          if (typeof value === "number") return String(value);
          return fallback;
        };
        const toNullableString = (value: unknown): string | null =>
          typeof value === "string" ? value : null;
        const toNullableNumber = (value: unknown): number | null =>
          typeof value === "number" ? value : null;

        const mappedProjects = allProjectRows.map(
          (p: Record<string, unknown>) => {
            const address = toStringValue(p.address);
            const phase = toStringValue(p.phase);
            const category = toStringValue(p.category);

            return {
              id: toStringValue(p.id, "0"),
              name: toStringValue(p.name, "Untitled Project"),
              jobNumber: toStringValue(p["job number"], toStringValue(p.id, "0")),
              client: toStringValue(p.client),
              startDate: toNullableString(p["start date"]),
              state: toStringValue(p.state),
              phase,
              estRevenue: toNullableNumber(p["est revenue"]),
              estProfit: toNullableNumber(p["est profit"]),
              budget: toNullableNumber(p.budget),
              category,
              onedrive: toNullableString(p.onedrive),
              // Legacy fields for backward compatibility
              projectNumber: toStringValue(
                p["job number"],
                toStringValue(p.id, "0"),
              ),
              address,
              city: address ? address.split(",")[0] || "" : "",
              zip: "",
              phone: "",
              status: p.archived ? "Inactive" : "Active",
              stage: phase || "Unknown",
              type: category || "General",
              notes: toStringValue(p.summary),
              isFlagged: false,
            };
          },
        );

        setProjects(mappedProjects as Project[]);
      } catch (error) {
        console.error("Error fetching projects:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [searchQuery, statusFilter]);

  // Extract unique phase, category, and client options from projects
  const phaseOptions = React.useMemo(() => {
    const phases = new Set(
      projects.map((p) => p.phase).filter((p): p is string => Boolean(p)),
    );
    return Array.from(phases).sort();
  }, [projects]);

  const categoryOptions = React.useMemo(() => {
    const categories = new Set(
      projects.map((p) => p.category).filter((c): c is string => Boolean(c)),
    );
    return Array.from(categories).sort();
  }, [projects]);

  const clientOptions = React.useMemo(() => {
    const clients = new Set(
      projects.map((p) => p.client).filter((c): c is string => Boolean(c)),
    );
    return Array.from(clients).sort();
  }, [projects]);

  // Filter projects based on phase, category, and client (search and status are handled server-side)
  const filteredProjects = React.useMemo(() => {
    return filterPortfolioProjects(projects, {
      phaseFilter,
      categoryFilter,
      clientFilter,
    });
  }, [projects, phaseFilter, categoryFilter, clientFilter]);

  const handleViewChange = (viewId: string) => {
    setActiveView(viewId);
  };

  const handleSettingsClick = () => {
    // TODO: implement settings
  };

  const handleExport = (format: "pdf" | "csv") => {
    if (format === "pdf") {
      window.print();
      return;
    }

    const headers = ["Job #", "Name", "Client", "Budget", "Phase", "Category", "Status", "Start Date", "State", "Est. Revenue", "Est. Profit"];
    const rows = filteredProjects.map((p) => [
      p.jobNumber,
      p.name,
      p.client ?? "",
      p.budget != null ? String(p.budget) : "",
      p.phase ?? "",
      p.category ?? "",
      p.status,
      p.startDate ?? "",
      p.state ?? "",
      p.estRevenue != null ? String(p.estRevenue) : "",
      p.estProfit != null ? String(p.estProfit) : "",
    ]);

    const escape = (cell: string | undefined) => {
      const s = cell ?? "";
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const csv = [headers, ...rows]
      .map((row) => row.map(escape).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `projects-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(link);
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setStatusFilter("active");
    setPhaseFilter(DEFAULT_PROJECT_PHASE_FILTER);
    setCategoryFilter(null);
    setClientFilter(null);
  };

  const handleProjectClick = (project: Project) => {
    router.push(`/${project.id}/home`);
  };

  const handleCreateProject = () => {
    router.push("/project-form");
  };

  const handleCreateTestProject = async () => {
    try {
      setLoading(true);
      let result: { project?: { id: string | number } };
      try {
        result = await apiFetch<{ project?: { id: string | number } }>(
          "/api/projects/bootstrap",
          {
            method: "POST",
            body: JSON.stringify({
              name: `Test Project ${new Date().toISOString().split("T")[0]}`,
            }),
          },
        );
      } catch (error) {
        console.error("Failed to create test project:", error);
        alert(
          error instanceof Error
            ? `Failed to create test project: ${error.message}`
            : "Failed to create test project. Check console for details.",
        );
        return;
      }

      // Refresh projects list
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (statusFilter === "active") params.append("archived", "false");
      else if (statusFilter === "inactive") params.append("archived", "true");

      let refreshResult: { data?: Record<string, unknown>[] } | null = null;
      try {
        refreshResult = await apiFetch<{ data?: Record<string, unknown>[] }>(
          `/api/projects?${params.toString()}`,
        );
      } catch (refreshError) {
        console.error("Failed to refresh projects:", refreshError);
      }

      if (refreshResult?.data) {
        const mappedProjects: Project[] = refreshResult.data.map((p: any) => ({
          id: p.id.toString(),
          name: p.name || "Untitled Project",
          jobNumber: p["job number"] || p.id.toString(),
          client: p.client || "",
          startDate: p["start date"] || null,
          state: p.state || "",
          phase: p.phase || "",
          estRevenue: p["est revenue"] || null,
          estProfit: p["est profit"] || null,
          budget: typeof p.budget === "number" ? p.budget : null,
          category: p.category || "",
          onedrive: p.onedrive || null,
          projectNumber: p["job number"] || p.id.toString(),
          address: p.address || "",
          city: p.address ? p.address.split(",")[0] || "" : "",
          zip: "",
          phone: "",
          status: p.archived ? "Inactive" : "Active",
          stage: p.phase || "Unknown",
          type: p.category || "General",
          notes: p.summary || "",
          isFlagged: false,
        }));
        setProjects(mappedProjects);
      }

      // Navigate to the newly created project
      if (result.project?.id !== undefined) {
        router.push(`/${result.project.id}/home`);
      }
    } catch (error) {
      console.error("Error creating test project:", error);
      alert("Failed to create test project. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell
      variant="table"
      title="Projects"
      showHeader={false}
      className="h-full"
      contentClassName="h-full pt-0 pb-0"
    >
      <div className="flex flex-col h-[calc(100vh-50px)] min-h-0 bg-neutral-50 rounded-lg overflow-hidden">
      {/* Portfolio Header with tabs */}
      <PortfolioHeader
        views={portfolioViews}
        financialViews={financialViews}
        activeView={activeView}
        onViewChange={handleViewChange}
        onSettingsClick={handleSettingsClick}
        onExport={handleExport}
        onCreateProject={handleCreateProject}
        onCreateTestProject={handleCreateTestProject}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Filters */}
        <PortfolioFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          viewType={viewType}
          onViewTypeChange={setViewType}
          phaseFilter={phaseFilter}
          onPhaseFilterChange={setPhaseFilter}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={setCategoryFilter}
          clientFilter={clientFilter}
          onClientFilterChange={setClientFilter}
          phaseOptions={phaseOptions}
          categoryOptions={categoryOptions}
          clientOptions={clientOptions}
          onClearFilters={handleClearFilters}
        />

        {/* Projects count */}
        <div className="px-4 py-2 text-xs sm:text-sm text-foreground bg-background border-b border-border">
          <span className="font-medium">{filteredProjects.length}</span> project
          {filteredProjects.length !== 1 ? "s" : ""} found
        </div>

        {/* Projects Table */}
        <div className="flex-1 overflow-hidden bg-background">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-muted-foreground">Loading projects...</div>
            </div>
          ) : (
            <ProjectsTable
              data={filteredProjects}
              onProjectClick={handleProjectClick}
            />
          )}
        </div>
      </div>
      </div>
    </PageShell>
  );
}
