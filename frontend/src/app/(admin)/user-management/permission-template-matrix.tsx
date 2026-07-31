"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { SectionRuleHeading } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { GRANULAR_FLAG_LABELS } from "@/lib/permissions-shared";
import type {
  GranularFlag,
  PermissionLevel,
  PermissionTemplate,
} from "@/lib/permissions-shared";

import {
  PERMISSION_TEMPLATE_GROUPS,
  getPermissionTemplateToolsByGroup,
  type PermissionTemplateTool,
} from "./permission-template-config";

const TEMPLATE_LEVELS: Array<{ key: PermissionLevel; label: string }> = [
  { key: "none", label: "None" },
  { key: "read", label: "Read" },
  { key: "write", label: "Write" },
  { key: "admin", label: "Admin" },
];

function getHighestTemplateLevel(
  levels: PermissionLevel[] | undefined,
): PermissionLevel {
  if (levels?.includes("admin")) return "admin";
  if (levels?.includes("write")) return "write";
  if (levels?.includes("read")) return "read";
  return "none";
}

function expandTemplateLevel(level: PermissionLevel): PermissionLevel[] {
  if (level === "admin") return ["read", "write", "admin"];
  if (level === "write") return ["read", "write"];
  if (level === "read") return ["read"];
  return ["none"];
}

export function PermissionTemplateMatrix({
  template,
  isSaving,
  onChange,
}: {
  template: PermissionTemplate;
  isSaving: boolean;
  onChange: (template: PermissionTemplate) => void;
}) {
  const expandableToolIds = useMemo(
    () =>
      PERMISSION_TEMPLATE_GROUPS.flatMap((group) =>
        getPermissionTemplateToolsByGroup(group.key)
          .filter((tool) => tool.granularFlags.length > 0)
          .map((tool) => tool.id),
      ),
    [],
  );
  const [expandedToolIds, setExpandedToolIds] = useState<Set<string>>(
    () => new Set(),
  );
  const activeGranularFlags = useMemo(
    () => new Set(template.granular_flags ?? []),
    [template.granular_flags],
  );

  const updateModuleLevel = (
    tool: Extract<PermissionTemplateTool, { kind: "module" }>,
    level: PermissionLevel,
  ) => {
    onChange({
      ...template,
      rules_json: {
        ...template.rules_json,
        [tool.moduleKey]: expandTemplateLevel(level),
      },
    });
  };

  const updateGranularFlag = (flag: GranularFlag, checked: boolean) => {
    const currentFlags = new Set(template.granular_flags ?? []);
    if (checked) {
      currentFlags.add(flag);
    } else {
      currentFlags.delete(flag);
    }
    onChange({
      ...template,
      granular_flags: Array.from(currentFlags),
    });
  };

  const updateCapabilityTool = (
    tool: Extract<PermissionTemplateTool, { kind: "capability" }>,
    checked: boolean,
  ) => {
    const currentFlags = new Set(template.granular_flags ?? []);
    for (const flag of tool.granularFlags) {
      if (checked) {
        currentFlags.add(flag);
      } else {
        currentFlags.delete(flag);
      }
    }
    onChange({
      ...template,
      granular_flags: Array.from(currentFlags),
    });
  };

  const toggleToolExpansion = (toolId: string) => {
    setExpandedToolIds((current) => {
      const next = new Set(current);
      if (next.has(toolId)) {
        next.delete(toolId);
      } else {
        next.add(toolId);
      }
      return next;
    });
  };

  const setAllExpanded = (expanded: boolean) => {
    setExpandedToolIds(expanded ? new Set(expandableToolIds) : new Set());
  };

  return (
    <div className="space-y-6">
      {PERMISSION_TEMPLATE_GROUPS.map((group, groupIndex) => {
        const tools = getPermissionTemplateToolsByGroup(group.key);

        return (
          <section key={group.key} className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <SectionRuleHeading label={group.label} />
              {groupIndex === 0 && expandableToolIds.length > 0 ? (
                <div className="flex items-center gap-4">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-auto px-0 py-0 text-xs font-medium text-muted-foreground hover:bg-transparent hover:text-foreground"
                    onClick={() => setAllExpanded(true)}
                    disabled={expandableToolIds.length === 0}
                  >
                    Expand all
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-auto px-0 py-0 text-xs font-medium text-muted-foreground hover:bg-transparent hover:text-foreground"
                    onClick={() => setAllExpanded(false)}
                    disabled={expandableToolIds.length === 0}
                  >
                    Collapse all
                  </Button>
                </div>
              ) : null}
            </div>
            <div className="overflow-hidden border-t border-border">
              <div className="grid grid-cols-[minmax(0,1.8fr)_repeat(4,minmax(52px,72px))] border-b border-border bg-muted/30 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <div className="px-4 py-1.5">Tool</div>
                {TEMPLATE_LEVELS.map((level) => (
                  <div
                    key={`${group.key}-${level.key}`}
                    className="border-l border-border px-2 py-1.5 text-center"
                  >
                    {level.label}
                  </div>
                ))}
              </div>
              <div className="divide-y divide-border">
                {tools.map((tool) => {
                  const isExpanded = expandedToolIds.has(tool.id);
                  const canExpand =
                    tool.kind === "module" && tool.granularFlags.length > 0;
                  const isCapabilityTool = tool.kind === "capability";
                  const selectedLevel = isCapabilityTool
                    ? "none"
                    : getHighestTemplateLevel(template.rules_json[tool.moduleKey]);
                  const capabilityEnabled = tool.granularFlags.every((flag) =>
                    activeGranularFlags.has(flag),
                  );

                  return (
                    <div key={tool.id}>
                      <div className="grid grid-cols-[minmax(0,1.8fr)_repeat(4,minmax(52px,72px))] items-center">
                        <div className="px-4 py-1.5">
                          <div className="flex items-center gap-2">
                            {canExpand ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0"
                                onClick={() => toggleToolExpansion(tool.id)}
                                aria-label={`${isExpanded ? "Hide" : "Show"} ${tool.label} options`}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                            ) : (
                              <span className="block h-6 w-6 shrink-0" aria-hidden />
                            )}
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium leading-4 text-foreground">
                                {tool.label}
                              </p>
                              {canExpand ? (
                                <p className="text-[11px] leading-4 text-muted-foreground">
                                  {tool.granularFlags.length} option
                                  {tool.granularFlags.length === 1 ? "" : "s"}
                                </p>
                              ) : null}
                              {isCapabilityTool ? (
                                <p className="text-[11px] leading-4 text-muted-foreground">
                                  Capability toggle
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        {isCapabilityTool ? (
                          <div className="col-span-4 flex h-full items-center justify-between gap-3 border-l border-border px-3 py-1.5">
                            <span className="text-xs leading-4 text-muted-foreground">
                              Included as a company capability instead of a permission level.
                            </span>
                            <label className="flex items-center gap-2">
                              <Checkbox
                                checked={capabilityEnabled}
                                disabled={isSaving}
                                onCheckedChange={(checked) =>
                                  updateCapabilityTool(tool, checked === true)
                                }
                              />
                              <span className="text-[11px] text-muted-foreground">
                                Include
                              </span>
                            </label>
                          </div>
                        ) : (
                          TEMPLATE_LEVELS.map((level) => (
                            <label
                              key={`${tool.id}-${level.key}`}
                              className="flex h-full items-center justify-center border-l border-border px-2 py-1.5"
                              aria-label={`${tool.label} ${level.label}`}
                            >
                              <Checkbox
                                checked={selectedLevel === level.key}
                                disabled={isSaving}
                                onCheckedChange={(checked) => {
                                  if (checked && tool.kind === "module") {
                                    updateModuleLevel(tool, level.key);
                                  }
                                }}
                              />
                            </label>
                          ))
                        )}
                      </div>

                      {canExpand && isExpanded ? (
                        <div className="border-t border-border bg-muted/10 px-3 py-1.5">
                          <div className="grid gap-1">
                            {tool.granularFlags.map((flag) => (
                              <label
                                key={`${tool.id}-${flag}`}
                                className="flex items-start gap-2 rounded-md px-1 py-0.5 hover:bg-muted/40"
                              >
                                <Checkbox
                                  checked={activeGranularFlags.has(flag)}
                                  disabled={isSaving}
                                  onCheckedChange={(checked) =>
                                    updateGranularFlag(flag, checked === true)
                                  }
                                />
                                <span className="text-[13px] leading-4 text-foreground">
                                  {GRANULAR_FLAG_LABELS[flag]}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
