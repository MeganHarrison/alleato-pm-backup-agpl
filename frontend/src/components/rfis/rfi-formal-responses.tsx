"use client";

/**
 * Formal RFI responses captured from the no-login channels (web response page /
 * email reply), shown on the internal RFI detail page. Distinct from the Velt
 * discussion thread: these are the subcontractor's official answers. An internal
 * user can designate one as the official response.
 *
 * Renders nothing when there are no responses yet (keeps the detail page quiet —
 * see noise-gate rule #9).
 */

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ds";
import { SectionRuleHeading } from "@/components/layout";
import { apiFetch } from "@/lib/api-client";
import { formatDate } from "@/lib/format";

interface RfiFormalResponse {
  id: string;
  responder_name: string | null;
  responder_email: string | null;
  body: string;
  source: "web" | "email" | "app";
  is_official: boolean;
  created_at: string;
}

const SOURCE_LABEL: Record<RfiFormalResponse["source"], string> = {
  web: "Web",
  email: "Email",
  app: "App",
};

interface RfiFormalResponsesProps {
  projectId: number;
  rfiId: string;
  hideHeading?: boolean;
}

export function RfiFormalResponses({
  projectId,
  rfiId,
  hideHeading = false,
}: RfiFormalResponsesProps) {
  const queryClient = useQueryClient();
  const queryKey = ["rfi-responses", projectId, rfiId] as const;

  const { data } = useQuery({
    queryKey,
    queryFn: () =>
      apiFetch<{ responses: RfiFormalResponse[] }>(
        `/api/projects/${projectId}/rfis/${rfiId}/responses`,
      ),
  });

  const responses = data?.responses ?? [];

  const markOfficial = useMutation({
    mutationFn: (vars: { responseId: string; is_official: boolean }) =>
      apiFetch(`/api/projects/${projectId}/rfis/${rfiId}/responses`, {
        method: "PATCH",
        body: JSON.stringify(vars),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: () => toast.error("Could not update the official response."),
  });

  if (responses.length === 0) return null;

  return (
    <div>
      {!hideHeading ? (
        <SectionRuleHeading label={`Responses (${responses.length})`} />
      ) : null}
      <div className={hideHeading ? "space-y-3" : "mt-3 space-y-3"}>
        {responses.map((response) => (
          <div key={response.id} className="rounded-md bg-muted/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {response.responder_name ?? response.responder_email ?? "Response"}
                </span>
                <StatusBadge status={SOURCE_LABEL[response.source] ?? response.source} />
                {response.is_official ? <StatusBadge status="Official" /> : null}
              </div>
              <span className="text-xs text-muted-foreground">
                {formatDate(response.created_at)}
              </span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
              {response.body}
            </p>
            <div className="mt-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={markOfficial.isPending}
                onClick={() =>
                  markOfficial.mutate({
                    responseId: response.id,
                    is_official: !response.is_official,
                  })
                }
              >
                {response.is_official ? "Remove official mark" : "Mark as official"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
