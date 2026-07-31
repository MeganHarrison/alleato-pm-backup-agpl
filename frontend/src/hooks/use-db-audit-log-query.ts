import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { AuditLogItem } from "@/features/db-audit-log/db-audit-log-table-config";

interface AuditLogParams {
  page: number;
  perPage: number;
  search: string;
  operation: string;
  table_name: string;
}

interface AuditLogResponse {
  items: AuditLogItem[];
  total: number;
  page: number;
  perPage: number;
}

export const auditLogKeys = {
  all: ["db-audit-log"] as const,
  list: (params: AuditLogParams) => ["db-audit-log", "list", params] as const,
};

export function useAuditLogList(params: AuditLogParams) {
  return useQuery({
    queryKey: auditLogKeys.list(params),
    queryFn: async () => {
      const qs = new URLSearchParams({
        page: String(params.page),
        perPage: String(params.perPage),
        ...(params.search ? { search: params.search } : {}),
        ...(params.operation ? { operation: params.operation } : {}),
        ...(params.table_name ? { table_name: params.table_name } : {}),
      });
      return apiFetch<AuditLogResponse>(`/api/admin/db-audit-log?${qs}`);
    },
    staleTime: 30_000,
  });
}
