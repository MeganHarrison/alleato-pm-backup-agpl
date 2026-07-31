"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronsUpDown,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Checkbox,
  EmptyState,
  InlineTable,
  InlineTableBody,
  InlineTableCell,
  InlineTableHeader,
  InlineTableHeaderCell,
  InlineTableHeaderRow,
  InlineTableRow,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusBadge,
} from "@/components/ds";
import { SectionRuleHeading } from "@/components/layout";
import { ExpandableSearch } from "@/components/tables/unified/table-toolbar";
import { cn } from "@/lib/utils";
import {
  ALL_GRANULAR_FLAGS,
  GRANULAR_FLAG_LABELS,
  type GranularFlag,
  type PermissionTemplate,
} from "@/lib/permissions-shared";
import {
  getProjectRoleTemplates,
  type GranularOverrideEffect,
  type UserAccessSummary,
} from "../_lib/user-access-data";

type ProjectOption = {
  id: number;
  name: string;
  jobNumber: string | null;
};

export function UserAccessPanel({
  user,
  templates,
  companyTemplates,
  projects,
  isTemplatesLoading,
  isProjectsLoading,
  isAssignmentSaving,
  isCompanyTemplateSaving,
  isGranularOverrideSaving,
  onAssignTemplate,
  onAddProjectAccess,
  onRemoveProjectAccess,
  onAssignCompanyTemplate,
  onSetGranularOverride,
}: {
  user: UserAccessSummary;
  templates: PermissionTemplate[];
  companyTemplates: PermissionTemplate[];
  projects: ProjectOption[];
  isTemplatesLoading: boolean;
  isProjectsLoading: boolean;
  isAssignmentSaving: boolean;
  isCompanyTemplateSaving: boolean;
  isGranularOverrideSaving: boolean;
  onAssignTemplate: (projectId: number | string, personId: string, templateId: string) => void;
  onAddProjectAccess: (projectIds: number[], templateId: string) => void;
  onRemoveProjectAccess: (projectId: number | string) => void;
  onAssignCompanyTemplate: (personId: string, templateId: string | null) => void;
  onSetGranularOverride: (
    personId: string,
    flag: GranularFlag,
    effect: GranularOverrideEffect | null,
  ) => void;
}) {
  const [isEditingCompanyAccess, setIsEditingCompanyAccess] = useState(false);
  const [isProjectPickerOpen, setIsProjectPickerOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([]);
  const defaultProjectTemplateId = getProjectRoleTemplates(templates)[0]?.id ?? "none";
  const [selectedProjectTemplateId, setSelectedProjectTemplateId] = useState<string>(
    defaultProjectTemplateId,
  );
  const companyOverrideCount = user.granularOverrides.filter(
    (override) => override.projectId == null,
  ).length;
  const assignedProjectIds = useMemo(
    () => new Set(user.memberships.map((membership) => String(membership.projectId))),
    [user.memberships],
  );
  const availableProjects = useMemo(
    () => projects.filter((project) => !assignedProjectIds.has(String(project.id))),
    [assignedProjectIds, projects],
  );
  const visibleProjects = useMemo(() => {
    const query = projectSearch.trim().toLowerCase();
    if (!query) return availableProjects;

    return availableProjects.filter((project) => {
      const searchable = `${project.name} ${project.jobNumber ?? ""} ${project.id}`.toLowerCase();
      return searchable.includes(query);
    });
  }, [availableProjects, projectSearch]);
  const selectedProjects = useMemo(
    () => availableProjects.filter((project) => selectedProjectIds.includes(project.id)),
    [availableProjects, selectedProjectIds],
  );
  const userRole = user.isAdmin
    ? "Admin"
    : user.companyTemplateName
      ? user.companyTemplateName
      : user.projectCount > 0
        ? "Selected projects"
        : "No project access";
  const canAddProject =
    selectedProjectIds.length > 0 &&
    selectedProjectTemplateId !== "none" &&
    !isProjectsLoading &&
    !isTemplatesLoading &&
    !isAssignmentSaving;

  useEffect(() => {
    setSelectedProjectIds((current) =>
      current.filter((projectId) => availableProjects.some((project) => project.id === projectId)),
    );
  }, [availableProjects]);

  useEffect(() => {
    if (selectedProjectTemplateId === "none" && defaultProjectTemplateId !== "none") {
      setSelectedProjectTemplateId(defaultProjectTemplateId);
    }
  }, [defaultProjectTemplateId, selectedProjectTemplateId]);

  const toggleProject = (projectId: number) => {
    setSelectedProjectIds((current) =>
      current.includes(projectId)
        ? current.filter((id) => id !== projectId)
        : [...current, projectId],
    );
  };

  const selectedProjectLabel =
    selectedProjects.length === 0
      ? "Select projects"
      : selectedProjects.length === 1
        ? selectedProjects[0].name
        : `${selectedProjects.length} projects selected`;

  return (
    <div className="space-y-8">
      <section className="py-2">
        <div className="grid grid-cols-2 gap-x-4 gap-y-5 md:grid-cols-4">
          <div className="group relative min-w-0 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              User role
            </p>
            <div className="absolute -right-1 -top-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground/60 opacity-100 hover:text-muted-foreground md:opacity-0 md:transition-opacity md:group-hover:opacity-100"
                disabled={isTemplatesLoading || isCompanyTemplateSaving || companyTemplates.length === 0}
                onClick={() => setIsEditingCompanyAccess((current) => !current)}
                aria-label="Edit user role"
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </div>
            {isEditingCompanyAccess ? (
              <Select
                value={user.companyTemplateId ?? "none"}
                disabled={isTemplatesLoading || isCompanyTemplateSaving || companyTemplates.length === 0}
                onValueChange={(val) => {
                  onAssignCompanyTemplate(user.personId, val === "none" ? null : val);
                  setIsEditingCompanyAccess(false);
                }}
              >
                <SelectTrigger className="h-9 w-full text-sm">
                  <SelectValue placeholder="No company role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No company role</SelectItem>
                  {companyTemplates.map((tpl) => (
                    <SelectItem key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{userRole}</p>
              </div>
            )}
          </div>
          <SummaryItem
            label="Project roles"
            value={`${user.assignedProjectCount}/${user.projectCount}`}
          />
          <SummaryItem
            label="Exceptions"
            value={String(companyOverrideCount)}
          />
          <SummaryItem
            label="Auth link"
            value={user.authUserId ? "Linked" : "Missing"}
          />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <SectionRuleHeading label="Project access" />
          <div className="grid gap-2 sm:grid-cols-[minmax(260px,1fr)_minmax(180px,220px)_auto] lg:w-2/3 lg:max-w-3xl">
            <Popover open={isProjectPickerOpen} onOpenChange={setIsProjectPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 justify-between px-3 text-left text-sm font-normal"
                  disabled={isProjectsLoading || isAssignmentSaving || availableProjects.length === 0}
                >
                  <span className="truncate">{selectedProjectLabel}</span>
                  <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-80 p-0 sm:w-96">
                <div className="space-y-2 p-2">
                  <ExpandableSearch
                    value={projectSearch}
                    onChange={setProjectSearch}
                    placeholder="Search projects"
                    ariaLabel="Search projects"
                    defaultExpanded
                  />
                  <div className="flex items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
                    <span>{selectedProjectIds.length} selected</span>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        disabled={visibleProjects.length === 0}
                        onClick={() =>
                          setSelectedProjectIds((current) =>
                            Array.from(new Set([...current, ...visibleProjects.map((project) => project.id)])),
                          )
                        }
                      >
                        Select visible
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        disabled={selectedProjectIds.length === 0}
                        onClick={() => setSelectedProjectIds([])}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-72 overflow-y-auto border-t border-border">
                    {visibleProjects.length === 0 ? (
                      <EmptyState
                        title="No available projects"
                        description="Every project is already assigned, or none match your search."
                        className="py-6"
                      />
                    ) : (
                      visibleProjects.map((project) => {
                        const isSelected = selectedProjectIds.includes(project.id);

                        return (
                          <div
                            key={project.id}
                            role="button"
                            tabIndex={0}
                            className="flex w-full items-center gap-3 border-b border-border px-2 py-2 text-left text-sm last:border-b-0 hover:bg-muted/50"
                            onClick={() => toggleProject(project.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                toggleProject(project.id);
                              }
                            }}
                          >
                            <Checkbox checked={isSelected} aria-label={`Select ${project.name}`} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium text-foreground">
                                {project.name}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {project.jobNumber ? `Project #${project.jobNumber}` : `Project #${project.id}`}
                              </span>
                            </span>
                            {isSelected && <Check className="h-4 w-4 text-primary" />}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <RoleSelect
              value={selectedProjectTemplateId}
              disabled={isTemplatesLoading || isAssignmentSaving || templates.length === 0}
              templates={templates}
              onValueChange={setSelectedProjectTemplateId}
            />
            <Button
              type="button"
              size="sm"
              disabled={!canAddProject}
              onClick={() => {
                if (!canAddProject) return;
                onAddProjectAccess(selectedProjectIds, selectedProjectTemplateId);
                setSelectedProjectIds([]);
                setProjectSearch("");
                setIsProjectPickerOpen(false);
              }}
            >
              <Plus className="h-4 w-4" />
              Add {selectedProjectIds.length > 1 ? selectedProjectIds.length : ""}
            </Button>
          </div>
        </div>

        {user.memberships.length === 0 ? (
          <EmptyState
            title="No project memberships"
            description="Add a project above to give this person access."
            className="py-12"
          />
        ) : (
          <div className="overflow-hidden">
            <InlineTable variant="read" className="hidden sm:block">
              <InlineTableHeader>
                <InlineTableHeaderRow>
                  <InlineTableHeaderCell>Project</InlineTableHeaderCell>
                  <InlineTableHeaderCell>Status</InlineTableHeaderCell>
                  <InlineTableHeaderCell className="w-60">Role</InlineTableHeaderCell>
                  <InlineTableHeaderCell className="w-12" />
                </InlineTableHeaderRow>
              </InlineTableHeader>
              <InlineTableBody>
                {user.memberships.map((membership) => (
                  <ProjectAccessTableRow
                    key={`${user.personId}-${membership.projectId}`}
                    user={user}
                    membership={membership}
                    templates={templates}
                    isTemplatesLoading={isTemplatesLoading}
                    isAssignmentSaving={isAssignmentSaving}
                    onAssignTemplate={onAssignTemplate}
                    onRemoveProjectAccess={onRemoveProjectAccess}
                  />
                ))}
              </InlineTableBody>
            </InlineTable>
            <div className="divide-y divide-border sm:hidden">
              {user.memberships.map((membership) => (
                <ProjectAccessMobileRow
                  key={`${user.personId}-${membership.projectId}`}
                  user={user}
                  membership={membership}
                  templates={templates}
                  isTemplatesLoading={isTemplatesLoading}
                  isAssignmentSaving={isAssignmentSaving}
                  onAssignTemplate={onAssignTemplate}
                  onRemoveProjectAccess={onRemoveProjectAccess}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      <GranularExceptionPanel
        user={user}
        templates={templates}
        companyTemplates={companyTemplates}
        isSaving={isGranularOverrideSaving}
        onSetGranularOverride={onSetGranularOverride}
      />
    </div>
  );
}

function SummaryItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

function getTemplateFlagsById(templates: PermissionTemplate[]) {
  return new Map(templates.map((template) => [template.id, template.granular_flags ?? []]));
}

function getInheritedGranularFlags(
  user: UserAccessSummary,
  templates: PermissionTemplate[],
  companyTemplates: PermissionTemplate[],
) {
  const flags = new Set<GranularFlag>();
  const flagsById = getTemplateFlagsById([...templates, ...companyTemplates]);
  const assignedTemplateIds = [
    user.companyTemplateId,
    ...user.memberships.map((membership) => membership.templateId),
  ].filter((id): id is string => !!id);

  for (const templateId of assignedTemplateIds) {
    for (const flag of flagsById.get(templateId) ?? []) {
      flags.add(flag);
    }
  }

  return flags;
}

function getCompanyGranularOverride(
  user: UserAccessSummary,
  flag: GranularFlag,
): GranularOverrideEffect | null {
  return (
    user.granularOverrides.find(
      (override) => override.projectId == null && override.flag === flag,
    )?.effect ?? null
  );
}

function GranularExceptionPanel({
  user,
  templates,
  companyTemplates,
  isSaving,
  onSetGranularOverride,
}: {
  user: UserAccessSummary;
  templates: PermissionTemplate[];
  companyTemplates: PermissionTemplate[];
  isSaving: boolean;
  onSetGranularOverride: (
    personId: string,
    flag: GranularFlag,
    effect: GranularOverrideEffect | null,
  ) => void;
}) {
  const inheritedFlags = getInheritedGranularFlags(user, templates, companyTemplates);
  return (
    <section className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <SectionRuleHeading label="Granular exceptions" />
        </div>
      </div>

      <div className="overflow-hidden">
        <InlineTable variant="read" className="hidden sm:block">
          <InlineTableHeader>
            <InlineTableHeaderRow>
              <InlineTableHeaderCell>Capability</InlineTableHeaderCell>
              <InlineTableHeaderCell>Status</InlineTableHeaderCell>
              <InlineTableHeaderCell className="w-48">Exception</InlineTableHeaderCell>
            </InlineTableHeaderRow>
          </InlineTableHeader>
          <InlineTableBody>
            {ALL_GRANULAR_FLAGS.map((flag) => {
              const override = getCompanyGranularOverride(user, flag);
              const inherited = inheritedFlags.has(flag);
              const effective = override ?? (inherited ? "allow" : "deny");

              return (
                <GranularExceptionRow
                  key={flag}
                  flag={flag}
                  user={user}
                  override={override}
                  inherited={inherited}
                  effective={effective}
                  isSaving={isSaving}
                  onSetGranularOverride={onSetGranularOverride}
                />
              );
            })}
          </InlineTableBody>
        </InlineTable>
        <div className="divide-y divide-border sm:hidden">
          {ALL_GRANULAR_FLAGS.map((flag) => {
            const override = getCompanyGranularOverride(user, flag);
            const inherited = inheritedFlags.has(flag);
            const effective = override ?? (inherited ? "allow" : "deny");

            return (
              <GranularExceptionMobileRow
                key={flag}
                flag={flag}
                user={user}
                override={override}
                inherited={inherited}
                effective={effective}
                isSaving={isSaving}
                onSetGranularOverride={onSetGranularOverride}
              />
            );
          })}
        </div>
      </div>

      {user.isAdmin && (
        <p className="text-xs text-muted-foreground">
          Exceptions are bypassed because this user is a Super Admin.
        </p>
      )}
    </section>
  );
}

function GranularCapabilityLabel({
  flag,
  override,
  inherited,
}: {
  flag: GranularFlag;
  override: GranularOverrideEffect | null;
  inherited: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-foreground">
          {GRANULAR_FLAG_LABELS[flag] ?? flag}
        </p>
        {flag === "approve_change_orders" && (
          <Badge variant="outline" className="text-xs">
            Change orders
          </Badge>
        )}
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {override
          ? `${override === "allow" ? "Allowed" : "Denied"} by exception`
          : `${inherited ? "Allowed" : "Denied"} by assigned role`}
      </p>
    </div>
  );
}

function GranularExceptionSelect({
  user,
  flag,
  override,
  effective,
  isSaving,
  onSetGranularOverride,
}: {
  user: UserAccessSummary;
  flag: GranularFlag;
  override: GranularOverrideEffect | null;
  effective: GranularOverrideEffect;
  isSaving: boolean;
  onSetGranularOverride: (
    personId: string,
    flag: GranularFlag,
    effect: GranularOverrideEffect | null,
  ) => void;
}) {
  return (
    <Select
      value={override ?? "inherit"}
      disabled={user.isAdmin || isSaving}
      onValueChange={(value) => {
        onSetGranularOverride(
          user.personId,
          flag,
          value === "inherit" ? null : (value as GranularOverrideEffect),
        );
      }}
    >
      <SelectTrigger className="h-9 w-full text-sm">
        <SelectValue placeholder="Inherit" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="inherit">
          Inherit ({effective === "allow" ? "Allowed" : "Denied"})
        </SelectItem>
        <SelectItem value="allow">Always allow</SelectItem>
        <SelectItem value="deny">Deny</SelectItem>
      </SelectContent>
    </Select>
  );
}

function GranularExceptionRow({
  user,
  flag,
  override,
  inherited,
  effective,
  isSaving,
  onSetGranularOverride,
}: {
  user: UserAccessSummary;
  flag: GranularFlag;
  override: GranularOverrideEffect | null;
  inherited: boolean;
  effective: GranularOverrideEffect;
  isSaving: boolean;
  onSetGranularOverride: (
    personId: string,
    flag: GranularFlag,
    effect: GranularOverrideEffect | null,
  ) => void;
}) {
  return (
    <InlineTableRow>
      <InlineTableCell>
        <GranularCapabilityLabel flag={flag} override={override} inherited={inherited} />
      </InlineTableCell>
      <InlineTableCell>
        <StatusBadge
          status={override ? "Exception" : effective === "allow" ? "Allowed" : "Denied"}
          variant={override ? "warning" : effective === "allow" ? "success" : "neutral"}
        />
      </InlineTableCell>
      <InlineTableCell>
        <GranularExceptionSelect
          user={user}
          flag={flag}
          override={override}
          effective={effective}
          isSaving={isSaving}
          onSetGranularOverride={onSetGranularOverride}
        />
      </InlineTableCell>
    </InlineTableRow>
  );
}

function GranularExceptionMobileRow({
  user,
  flag,
  override,
  inherited,
  effective,
  isSaving,
  onSetGranularOverride,
}: {
  user: UserAccessSummary;
  flag: GranularFlag;
  override: GranularOverrideEffect | null;
  inherited: boolean;
  effective: GranularOverrideEffect;
  isSaving: boolean;
  onSetGranularOverride: (
    personId: string,
    flag: GranularFlag,
    effect: GranularOverrideEffect | null,
  ) => void;
}) {
  return (
    <div className="space-y-3 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <GranularCapabilityLabel flag={flag} override={override} inherited={inherited} />
        <StatusBadge
          status={override ? "Exception" : effective === "allow" ? "Allowed" : "Denied"}
          variant={override ? "warning" : effective === "allow" ? "success" : "neutral"}
        />
      </div>
      <GranularExceptionSelect
        user={user}
        flag={flag}
        override={override}
        effective={effective}
        isSaving={isSaving}
        onSetGranularOverride={onSetGranularOverride}
      />
    </div>
  );
}

function RoleSelect({
  value,
  disabled,
  templates,
  onValueChange,
}: {
  value: string | null;
  disabled: boolean;
  templates: PermissionTemplate[];
  onValueChange: (templateId: string) => void;
}) {
  const roleTemplates = getProjectRoleTemplates(templates);

  return (
    <Select
      value={value ?? "none"}
      disabled={disabled || roleTemplates.length === 0}
      onValueChange={(templateId) => {
        if (templateId === "none") return;
        onValueChange(templateId);
      }}
    >
      <SelectTrigger className="h-9 w-full text-sm">
        <SelectValue placeholder="Select role" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none" disabled>
          No role
        </SelectItem>
        {roleTemplates.map((template) => (
          <SelectItem key={template.id} value={template.id}>
            {template.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ProjectAccessTableRow({
  user,
  membership,
  templates,
  isTemplatesLoading,
  isAssignmentSaving,
  onAssignTemplate,
  onRemoveProjectAccess,
}: {
  user: UserAccessSummary;
  membership: UserAccessSummary["memberships"][number];
  templates: PermissionTemplate[];
  isTemplatesLoading: boolean;
  isAssignmentSaving: boolean;
  onAssignTemplate: (
    projectId: number | string,
    personId: string,
    templateId: string,
  ) => void;
  onRemoveProjectAccess: (projectId: number | string) => void;
}) {
  const hasRole = Boolean(membership.templateId);

  return (
    <InlineTableRow>
      <InlineTableCell>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {membership.projectName ?? `Project #${membership.projectId}`}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Project #{membership.projectId}
          </p>
        </div>
      </InlineTableCell>
      <InlineTableCell>
        <StatusBadge
          status={hasRole ? "Assigned" : "Missing role"}
          variant={hasRole ? "success" : "warning"}
        />
      </InlineTableCell>
      <InlineTableCell>
        <RoleSelect
          value={membership.templateId}
          disabled={isTemplatesLoading || isAssignmentSaving || templates.length === 0}
          templates={templates}
          onValueChange={(templateId) =>
            onAssignTemplate(membership.projectId, user.personId, templateId)
          }
        />
      </InlineTableCell>
      <InlineTableCell className="text-right">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={isAssignmentSaving}
          onClick={() => onRemoveProjectAccess(membership.projectId)}
          aria-label={`Remove ${membership.projectName ?? `project ${membership.projectId}`} access`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </InlineTableCell>
    </InlineTableRow>
  );
}

function ProjectAccessMobileRow({
  user,
  membership,
  templates,
  isTemplatesLoading,
  isAssignmentSaving,
  onAssignTemplate,
  onRemoveProjectAccess,
}: {
  user: UserAccessSummary;
  membership: UserAccessSummary["memberships"][number];
  templates: PermissionTemplate[];
  isTemplatesLoading: boolean;
  isAssignmentSaving: boolean;
  onAssignTemplate: (
    projectId: number | string,
    personId: string,
    templateId: string,
  ) => void;
  onRemoveProjectAccess: (projectId: number | string) => void;
}) {
  const hasRole = Boolean(membership.templateId);

  return (
    <div className="space-y-3 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {membership.projectName ?? `Project #${membership.projectId}`}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Current: {membership.templateName ?? "No role"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <StatusBadge
            status={hasRole ? "Assigned" : "Missing"}
            variant={hasRole ? "success" : "warning"}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={isAssignmentSaving}
            onClick={() => onRemoveProjectAccess(membership.projectId)}
            aria-label={`Remove ${membership.projectName ?? `project ${membership.projectId}`} access`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <RoleSelect
        value={membership.templateId}
        disabled={isTemplatesLoading || isAssignmentSaving || templates.length === 0}
        templates={templates}
        onValueChange={(templateId) =>
          onAssignTemplate(membership.projectId, user.personId, templateId)
        }
      />
    </div>
  );
}

export function UserAvatar({
  user,
  size = "md",
}: {
  user: Pick<UserAccessSummary, "fullName" | "initials" | "profilePhotoUrl">;
  size?: "md" | "lg";
}) {
  return (
    <Avatar className={cn(size === "lg" ? "h-12 w-12" : "h-9 w-9")}>
      {user.profilePhotoUrl && (
        <AvatarImage src={user.profilePhotoUrl} alt={user.fullName} />
      )}
      <AvatarFallback>{user.initials}</AvatarFallback>
    </Avatar>
  );
}
