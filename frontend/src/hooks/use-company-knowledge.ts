"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CompanyContext {
  id: string;
  mission: string | null;
  vision: string | null;
  company_history: string | null;
  core_values: unknown[] | null;
  key_differentiators: unknown[] | null;
  competitive_landscape: unknown[] | null;
  target_markets: unknown[] | null;
  goals: unknown | null;
  okrs: unknown | null;
  strategic_initiatives: unknown | null;
  org_structure: unknown | null;
  policies: unknown | null;
  resource_constraints: unknown | null;
  annual_revenue_range: string | null;
  employee_count: number | null;
  founded_year: number | null;
  headquarters: string | null;
  service_areas: unknown[] | null;
  certifications: unknown[] | null;
  key_clients: unknown[] | null;
  notes: string | null;
  updated_at: string | null;
}

export type KnowledgeCategory =
  // Original categories
  | "strategy"
  | "policy"
  | "process"
  | "market_intel"
  | "lessons_learned"
  | "best_practice"
  | "org_update"
  | "general"
  // Construction domain categories
  | "system_design"
  | "pricing_intel"
  | "vendor_intel"
  | "client_education"
  | "technical_reference"
  | "safety_compliance"
  | "installation_ops";

export const KNOWLEDGE_CATEGORIES: {
  value: KnowledgeCategory;
  label: string;
  description: string;
}[] = [
  { value: "system_design", label: "System Design", description: "ASRS design, fire suppression, MEP systems" },
  { value: "pricing_intel", label: "Pricing Intel", description: "Vendor pricing, cost benchmarks, quote analysis" },
  { value: "vendor_intel", label: "Vendor Intel", description: "Vendor capabilities, reliability, relationships" },
  { value: "client_education", label: "Client Education", description: "Knowledge for educating clients" },
  { value: "technical_reference", label: "Technical Reference", description: "Engineering specs, standards, code requirements" },
  { value: "safety_compliance", label: "Safety & Compliance", description: "OSHA, fire code, safety protocols" },
  { value: "installation_ops", label: "Installation & Ops", description: "Installation best practices, field operations" },
  { value: "lessons_learned", label: "Lessons Learned", description: "Post-project insights and takeaways" },
  { value: "best_practice", label: "Best Practice", description: "Proven approaches and standards" },
  { value: "market_intel", label: "Market Intel", description: "Industry trends, competitor analysis" },
  { value: "strategy", label: "Strategy", description: "Company strategy and direction" },
  { value: "process", label: "Process", description: "Internal processes and workflows" },
  { value: "policy", label: "Policy", description: "Company policies and guidelines" },
  { value: "org_update", label: "Org Update", description: "Organizational changes and announcements" },
  { value: "general", label: "General", description: "Uncategorized knowledge" },
];

export type KnowledgeOrigin = "manual" | "meeting_extraction" | "ai_assistant" | "import";
export type KnowledgeApprovalStatus = "draft" | "approved" | "archived";
export type KnowledgeVisibility = "internal" | "admin_only" | "client_visible";

export interface KnowledgeArticle {
  id: string;
  title: string;
  content: string;
  category: KnowledgeCategory;
  tags: string[] | null;
  source: string | null;
  author_id: string | null;
  is_active: boolean;
  project_id: number | null;
  meeting_id: string | null;
  origin: KnowledgeOrigin;
  approval_status: KnowledgeApprovalStatus;
  visibility: KnowledgeVisibility;
  ai_searchable: boolean;
  source_document_id: string | null;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const knowledgeKeys = {
  all: ["company-knowledge"] as const,
  list: (filters?: KnowledgeFilters) =>
    ["company-knowledge", "list", filters] as const,
  detail: (id: string) => ["company-knowledge", "detail", id] as const,
};

// ---------------------------------------------------------------------------
// Company Context (singleton profile)
// ---------------------------------------------------------------------------

export function useCompanyContext() {
  return useQuery({
    queryKey: ["company-context"],
    queryFn: async ({ signal }): Promise<CompanyContext | null> => {
      const json = await apiFetch<{ data: CompanyContext | null }>(
        "/api/admin/company-context",
        { signal },
      );
      return json.data;
    },
  });
}

export function useUpdateCompanyContext() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: Partial<CompanyContext>) =>
      apiFetch("/api/admin/company-context", {
        method: "PUT",
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-context"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Knowledge Articles
// ---------------------------------------------------------------------------

export interface KnowledgeFilters {
  category?: string;
  search?: string;
  projectId?: number;
  origin?: string;
  tag?: string;
  approvalStatus?: string;
  visibility?: string;
  aiSearchable?: boolean;
  manage?: boolean;
}

export function useKnowledgeArticles(filters?: KnowledgeFilters) {
  const params = new URLSearchParams();
  if (filters?.category && filters.category !== "all") {
    params.set("category", filters.category);
  }
  if (filters?.search) {
    params.set("search", filters.search);
  }
  if (filters?.projectId) {
    params.set("projectId", String(filters.projectId));
  }
  if (filters?.origin && filters.origin !== "all") {
    params.set("origin", filters.origin);
  }
  if (filters?.tag) {
    params.set("tag", filters.tag);
  }
  if (filters?.approvalStatus && filters.approvalStatus !== "all") {
    params.set("approvalStatus", filters.approvalStatus);
  }
  if (filters?.visibility && filters.visibility !== "all") {
    params.set("visibility", filters.visibility);
  }
  if (typeof filters?.aiSearchable === "boolean") {
    params.set("aiSearchable", String(filters.aiSearchable));
  }
  if (filters?.manage) {
    params.set("manage", "true");
  }

  return useQuery({
    queryKey: knowledgeKeys.list(filters),
    queryFn: async ({ signal }): Promise<KnowledgeArticle[]> => {
      const json = await apiFetch<{ data: KnowledgeArticle[] }>(
        `/api/knowledge?${params.toString()}`,
        { signal },
      );
      return json.data;
    },
  });
}

export function useCreateKnowledgeArticle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      article: Pick<KnowledgeArticle, "title" | "content" | "category"> & {
        tags?: string[];
        source?: string;
        project_id?: number;
        meeting_id?: string;
        origin?: KnowledgeOrigin;
        approval_status?: KnowledgeApprovalStatus;
        visibility?: KnowledgeVisibility;
        ai_searchable?: boolean;
        source_document_id?: string | null;
      },
    ) =>
      apiFetch("/api/knowledge", {
        method: "POST",
        body: JSON.stringify(article),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: knowledgeKeys.all });
      toast.success("Knowledge article created");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useUpdateKnowledgeArticle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      update: { id: string } & Partial<KnowledgeArticle>,
    ) =>
      apiFetch("/api/knowledge", {
        method: "PATCH",
        body: JSON.stringify(update),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: knowledgeKeys.all });
      toast.success("Knowledge article updated");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useDeleteKnowledgeArticle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(
        `/api/knowledge?id=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: knowledgeKeys.all });
      toast.success("Knowledge article deleted");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
