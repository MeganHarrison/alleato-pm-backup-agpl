import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import type { ControlPlaneData } from "@/lib/codex-command-center/control-plane";

export function useCommandCenterOps() {
  return useQuery<ControlPlaneData>({
    queryKey: ["command-center-ops"],
    queryFn: ({ signal }) =>
      apiFetch<ControlPlaneData>("/api/command-center/ops", { signal }),
    staleTime: 30 * 1000,
  });
}
