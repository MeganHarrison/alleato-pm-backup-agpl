"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { SectionRuleHeading } from "@/components/layout";
import { ErrorState } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { MultiSelectField } from "@/components/forms/MultiSelectField";
import { cn } from "@/lib/utils";
import type { PermissionTemplate } from "@/lib/permissions-shared";

export type AccessScope = "all_projects" | "selected_projects";

export type ProjectOption = {
  id: number;
  name: string;
  jobNumber: string | null;
};

export type EmployeeOption = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  jobTitle: string | null;
};

export type InviteUserPayload = {
  first_name: string;
  last_name: string;
  email: string;
  job_title?: string;
  /** Existing person selected from the dropdown, so the API links instead of duplicating. */
  person_id?: string;
  /** Company to tag the person with (injected per-surface, e.g. "Alleato Group"). */
  company?: string;
  access_scope: AccessScope;
  template_id: string;
  project_ids: number[];
};

export function InviteUserDialog({
  open,
  onOpenChange,
  mode,
  projectTemplates,
  companyTemplates,
  employees,
  projects,
  isLoading,
  isSaving,
  onInvite,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "app" | "project";
  projectTemplates: PermissionTemplate[];
  companyTemplates: PermissionTemplate[];
  employees: EmployeeOption[];
  projects: ProjectOption[];
  isLoading: boolean;
  isSaving: boolean;
  onInvite: (payload: InviteUserPayload) => Promise<void>;
}) {
  const initialAccessScope: AccessScope =
    mode === "project" ? "selected_projects" : "all_projects";
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    null,
  );
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [accessScope, setAccessScope] =
    useState<AccessScope>(initialAccessScope);
  const [projectTemplateId, setProjectTemplateId] = useState("");
  const [companyTemplateId, setCompanyTemplateId] = useState("");
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<number>>(
    new Set(),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSelectedEmployeeId(null);
      setFirstName("");
      setLastName("");
      setEmail("");
      setJobTitle("");
      setAccessScope(initialAccessScope);
      setProjectTemplateId("");
      setCompanyTemplateId("");
      setSelectedProjectIds(new Set());
      setError(null);
      return;
    }

    setProjectTemplateId(
      (current) =>
        current || findTemplateId(projectTemplates, "Project Manager"),
    );
    setCompanyTemplateId(
      (current) =>
        current ||
        findTemplateId(companyTemplates, "Project Manager") ||
        companyTemplates[0]?.id ||
        "",
    );
    setAccessScope(initialAccessScope);
  }, [open, projectTemplates, companyTemplates, initialAccessScope]);

  const selectedEmployee =
    employees.find((employee) => employee.id === selectedEmployeeId) ?? null;

  const selectEmployee = (employee: EmployeeOption | null) => {
    setSelectedEmployeeId(employee?.id ?? null);

    if (!employee) {
      setFirstName("");
      setLastName("");
      setEmail("");
      setJobTitle("");
      return;
    }

    setFirstName(employee.firstName);
    setLastName(employee.lastName);
    setEmail(employee.email ?? "");
    setJobTitle(employee.jobTitle ?? "");
  };

  const selectedTemplateId =
    accessScope === "all_projects"
      ? companyTemplateId || companyTemplates[0]?.id || ""
      : projectTemplateId ||
        findTemplateId(projectTemplates, "Project Manager") ||
        projectTemplates[0]?.id ||
        "";

  const canSubmit =
    firstName.trim() &&
    lastName.trim() &&
    email.trim() &&
    selectedTemplateId &&
    (accessScope === "all_projects" || selectedProjectIds.size > 0);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!canSubmit) {
      setError(
        "Add the user details, permission template, and project access before saving.",
      );
      return;
    }

    try {
      await onInvite({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        job_title: jobTitle.trim() || undefined,
        person_id: selectedEmployeeId ?? undefined,
        access_scope: accessScope,
        template_id: selectedTemplateId,
        project_ids:
          accessScope === "all_projects" ? [] : Array.from(selectedProjectIds),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="form"
        className="max-h-[calc(100svh-2rem)] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>
            {mode === "project" ? "Add project access" : "Grant app access"}
          </DialogTitle>
        </DialogHeader>

        <form className="space-y-6" onSubmit={submit}>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Employee
            </label>
            <EmployeeCombobox
              employees={employees}
              selectedEmployeeId={selectedEmployeeId}
              disabled={isLoading}
              onSelect={selectEmployee}
            />
            {selectedEmployee ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto px-0 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground"
                onClick={() => selectEmployee(null)}
              >
                Clear selection and enter a new employee
              </Button>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="invite-first-name"
                className="text-sm font-medium text-foreground"
              >
                First name
              </label>
              <Input
                id="invite-first-name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                autoComplete="given-name"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="invite-last-name"
                className="text-sm font-medium text-foreground"
              >
                Last name
              </label>
              <Input
                id="invite-last-name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                autoComplete="family-name"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="invite-email"
                className="text-sm font-medium text-foreground"
              >
                Email
              </label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="invite-title"
                className="text-sm font-medium text-foreground"
              >
                Title
              </label>
              <Input
                id="invite-title"
                value={jobTitle}
                onChange={(event) => setJobTitle(event.target.value)}
                placeholder="Project Manager"
              />
            </div>
          </div>

          {mode === "app" ? (
            <div className="space-y-3">
              <SectionRuleHeading label="Access" />
              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setAccessScope("all_projects");
                    setCompanyTemplateId(
                      (current) => current || companyTemplates[0]?.id || "",
                    );
                  }}
                  className={cn(
                    "h-auto justify-start rounded-md px-4 py-3 text-left transition-colors",
                    accessScope === "all_projects"
                      ? "border-primary bg-primary/5 hover:bg-primary/5"
                      : "hover:bg-muted/50",
                  )}
                >
                  <span className="block min-w-0">
                    <span className="block text-sm font-semibold text-foreground">
                      All projects
                    </span>
                    <span className="mt-1 block whitespace-normal text-sm font-normal text-muted-foreground">
                      Access across every current and future project.
                    </span>
                  </span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setAccessScope("selected_projects");
                    setProjectTemplateId(
                      (current) => current || projectTemplates[0]?.id || "",
                    );
                  }}
                  className={cn(
                    "h-auto justify-start rounded-md px-4 py-3 text-left transition-colors",
                    accessScope === "selected_projects"
                      ? "border-primary bg-primary/5 hover:bg-primary/5"
                      : "hover:bg-muted/50",
                  )}
                >
                  <span className="block min-w-0">
                    <span className="block text-sm font-semibold text-foreground">
                      Specific projects
                    </span>
                    <span className="mt-1 block whitespace-normal text-sm font-normal text-muted-foreground">
                      Access only to selected projects.
                    </span>
                  </span>
                </Button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className="space-y-1.5">
              <label
                htmlFor="invite-role"
                className="text-sm font-medium text-foreground"
              >
                Permission template
              </label>
              <Select
                value={selectedTemplateId}
                disabled={isLoading}
                onValueChange={(value) => {
                  if (accessScope === "all_projects") {
                    setCompanyTemplateId(value);
                  } else {
                    setProjectTemplateId(value);
                  }
                }}
              >
                <SelectTrigger id="invite-role" className="h-9 text-sm">
                  <SelectValue placeholder="Select permission template" />
                </SelectTrigger>
                <SelectContent>
                  {(accessScope === "all_projects"
                    ? companyTemplates
                    : projectTemplates
                  ).map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Start with a permission template, then customize the user later
                if needed.
              </p>
            </div>

            <div className="space-y-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Projects
                  {accessScope === "selected_projects" &&
                    selectedProjectIds.size > 0 && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {selectedProjectIds.size} selected
                      </span>
                    )}
                </label>
              </div>
              {accessScope === "all_projects" ? (
                <div className="rounded-md border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                  This user will inherit access across every current and future
                  project through the selected company permission template.
                </div>
              ) : (
                <MultiSelectField
                  label=""
                  options={projects.map((project) => ({
                    value: String(project.id),
                    label: project.jobNumber
                      ? `${project.name} ${project.jobNumber}`
                      : project.name,
                  }))}
                  value={Array.from(selectedProjectIds).map(String)}
                  onChange={(values) =>
                    setSelectedProjectIds(
                      new Set(
                        values
                          .map((value) => Number(value))
                          .filter(Number.isFinite),
                      ),
                    )
                  }
                  placeholder={
                    isLoading ? "Loading projects..." : "Select projects..."
                  }
                  disabled={isLoading}
                />
              )}
            </div>
          </div>

          {error && (
            <ErrorState
              title="Invite blocked"
              error={error}
              className="items-start py-2 text-left"
            />
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !canSubmit}>
              {isSaving
                ? "Saving..."
                : mode === "project"
                  ? "Add Project Access"
                  : "Grant Access"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EmployeeCombobox({
  employees,
  selectedEmployeeId,
  disabled,
  onSelect,
}: {
  employees: EmployeeOption[];
  selectedEmployeeId: string | null;
  disabled: boolean;
  onSelect: (employee: EmployeeOption | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedEmployee =
    employees.find((employee) => employee.id === selectedEmployeeId) ?? null;
  const selectedLabel = selectedEmployee
    ? formatEmployeeLabel(selectedEmployee)
    : "Search People before inviting...";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-11 w-full justify-between px-4 py-1 text-left text-base font-normal sm:h-9 md:text-sm",
            !selectedEmployee && "text-muted-foreground",
          )}
        >
          <span className="min-w-0 truncate">{selectedLabel}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search employees..." />
          {/* Stop wheel events from reaching the Dialog's scroll-lock
              (react-remove-scroll), which otherwise blocks mouse-wheel
              scrolling on this portaled list — only scrollbar drag worked. */}
          <CommandList onWheel={(event) => event.stopPropagation()}>
            <CommandEmpty>No employee found.</CommandEmpty>
            <CommandGroup>
            {employees.map((employee) => (
              <CommandItem
                key={employee.id}
                value={[
                  employee.firstName,
                  employee.lastName,
                  employee.email ?? "",
                  employee.jobTitle ?? "",
                ].join(" ")}
                onSelect={() => {
                  onSelect(employee);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    employee.id === selectedEmployeeId
                      ? "opacity-100"
                      : "opacity-0",
                  )}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {formatEmployeeName(employee)}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[employee.email, employee.jobTitle]
                      .filter(Boolean)
                      .join(" · ") || "No email on file"}
                  </span>
                </span>
              </CommandItem>
            ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function formatEmployeeName(employee: EmployeeOption) {
  return (
    [employee.firstName, employee.lastName].filter(Boolean).join(" ") ||
    "Unnamed employee"
  );
}

function formatEmployeeLabel(employee: EmployeeOption) {
  const detail = [employee.email, employee.jobTitle]
    .filter(Boolean)
    .join(" · ");
  return detail
    ? `${formatEmployeeName(employee)} (${detail})`
    : formatEmployeeName(employee);
}

function findTemplateId(templates: PermissionTemplate[], name: string) {
  return (
    templates.find(
      (template) => template.name.toLowerCase() === name.toLowerCase(),
    )?.id ?? ""
  );
}
