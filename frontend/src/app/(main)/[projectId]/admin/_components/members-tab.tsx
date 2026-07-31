"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { EmptyState } from "@/components/ds";
import type { PermissionTemplate, PermissionModule, PermissionLevel } from "@/lib/permissions-shared";
import { apiFetch } from "@/lib/api-client";

const MODULES: { key: PermissionModule; label: string }[] = [
  { key: "directory",     label: "Directory" },
  { key: "budget",        label: "Budget" },
  { key: "contracts",     label: "Contracts" },
  { key: "documents",     label: "Documents" },
  { key: "schedule",      label: "Schedule" },
  { key: "submittals",    label: "Submittals" },
  { key: "rfis",          label: "RFIs" },
  { key: "change_orders", label: "Change Orders" },
];

const LEVELS: PermissionLevel[] = ["none", "read", "write", "admin"];

interface Member {
  id: string;
  person_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  company_name: string | null;
  permission_level: string;
  permission_template_id: string | null;
  template_name: string | null;
}

interface Props {
  projectId: string;
}

export function MembersTab({ projectId }: Props) {
  const qc = useQueryClient();

  const { data: members = [], isLoading: membersLoading } = useQuery<Member[]>({
    queryKey: ["project-members-permissions", projectId],
    queryFn: async () => {
      const { data } = await apiFetch<{ data: Member[] }>(
        `/api/projects/${projectId}/directory/permissions`,
      );
      return data;
    },
  });

  const { data: templates = [] } = useQuery<PermissionTemplate[]>({
    queryKey: ["permission-templates"],
    queryFn: async () => {
      const { data } = await apiFetch<{ data: PermissionTemplate[] }>(
        "/api/permissions/templates",
      );
      return data;
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({ personId, templateId }: { personId: string; templateId: string }) => {
      await apiFetch(`/api/projects/${projectId}/permissions/assign`, {
        method: "POST",
        body: JSON.stringify({ person_id: personId, template_id: templateId }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-members-permissions", projectId] });
    },
  });

  const overrideMutation = useMutation({
    mutationFn: async ({
      personId,
      module,
      level,
    }: {
      personId: string;
      module: PermissionModule;
      level: PermissionLevel | "reset";
    }) => {
      if (level === "reset") {
        await apiFetch(
          `/api/projects/${projectId}/permissions/override?person_id=${personId}&module=${module}`,
          { method: "DELETE" },
        );
      } else {
        await apiFetch(`/api/projects/${projectId}/permissions/override`, {
          method: "POST",
          body: JSON.stringify({ person_id: personId, module, level }),
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-members-permissions", projectId] });
    },
  });

  if (membersLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <EmptyState
        title="No members"
        description="Add members to this project in the Directory to manage their permissions."
      />
    );
  }

  return (
    <div className="space-y-2">
      {members.map((member) => (
        <MemberRow
          key={member.person_id}
          member={member}
          templates={templates}
          onAssignTemplate={(templateId) =>
            assignMutation.mutate({ personId: member.person_id, templateId })
          }
          onSetOverride={(module, level) =>
            overrideMutation.mutate({ personId: member.person_id, module, level })
          }
        />
      ))}
    </div>
  );
}

function MemberRow({
  member,
  templates,
  onAssignTemplate,
  onSetOverride,
}: {
  member: Member;
  templates: PermissionTemplate[];
  onAssignTemplate: (templateId: string) => void;
  onSetOverride: (module: PermissionModule, level: PermissionLevel | "reset") => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-muted cursor-pointer hover:bg-muted/70 transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium shrink-0">
              {member.first_name?.[0]}
              {member.last_name?.[0]}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {member.first_name} {member.last_name}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {member.email}
                {member.company_name && ` · ${member.company_name}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="text-xs hidden sm:flex">
              {member.template_name ?? "No template"}
            </Badge>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
            />
          </div>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="px-4 py-4 rounded-b-lg bg-muted/50 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground w-36 shrink-0">
              Permission template
            </span>
            <Select
              value={member.permission_template_id ?? ""}
              onValueChange={onAssignTemplate}
            >
              <SelectTrigger className="w-56 h-8 text-sm">
                <SelectValue placeholder="Select template…" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
              Module Overrides
            </p>
            <div className="rounded-md border border-border divide-y divide-border">
              {MODULES.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-foreground">{label}</span>
                  <Select
                    onValueChange={(v) => onSetOverride(key, v as PermissionLevel | "reset")}
                  >
                    <SelectTrigger className="w-36 h-7 text-xs">
                      <SelectValue placeholder="Override…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="reset">
                        <span className="text-muted-foreground">Reset to template</span>
                      </SelectItem>
                      {LEVELS.map((level) => (
                        <SelectItem key={level} value={level}>
                          {level.charAt(0).toUpperCase() + level.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// Suppress unused import warning — Button is available for future use
void Button;
