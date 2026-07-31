"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown } from "lucide-react";
import { z } from "zod";
import type { UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api-client";
import { RHFDateField } from "@/components/forms/fields/RHFDateField";
import { RHFMoneyField } from "@/components/forms/fields/RHFMoneyField";
import { BudgetCodeSelector } from "@/components/budget/budget-code-selector";
import { useDrawings } from "@/hooks/use-drawings";
import { useProjectBudgetCodes } from "@/hooks/use-project-budget-codes";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database.types";
import {
  flattenProjectTeamAssignees,
  type ProjectTeamRole,
} from "./project-team-assignee-options";

type PunchItemRow = Database["public"]["Tables"]["punch_items"]["Row"];

export const punchItemFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  status: z.enum(["draft", "work_required", "initiated", "closed"]),
  priority: z.enum(["low", "medium", "high"]).optional(),
  punch_item_manager_id: z.string().uuid().optional().nullable(),
  final_approver_id: z.string().uuid().optional().nullable(),
  assignee_id: z.string().uuid().optional().nullable(),
  assignee_company: z.string().optional(),
  ball_in_court: z.string().optional(),
  due_date: z.string().optional(),
  location: z.string().optional(),
  trade: z.string().optional(),
  type: z.string().optional(),
  reference: z.string().optional(),
  drawing_reference: z.string().optional(),
  cost_code: z.string().optional(),
  cost_impact: z.number().nullable().optional(),
  is_private: z.boolean().optional(),
});

export type PunchItemFormValues = z.infer<typeof punchItemFormSchema>;

/** Defaults used by both the create dialog and any other surface (e.g. drawings link modal). */
export function buildPunchItemDefaults(
  defaults?: Partial<PunchItemRow>,
): PunchItemFormValues {
  return {
    title: defaults?.title ?? "",
    description: defaults?.description ?? "",
    status: (defaults?.status as PunchItemFormValues["status"]) ?? "draft",
    priority: (defaults?.priority as PunchItemFormValues["priority"]) ?? undefined,
    punch_item_manager_id: defaults?.punch_item_manager_id ?? null,
    final_approver_id: defaults?.final_approver_id ?? null,
    assignee_id: defaults?.assignee_id ?? null,
    assignee_company: defaults?.assignee_company ?? "",
    ball_in_court: defaults?.ball_in_court ?? "",
    due_date: defaults?.due_date ?? "",
    location: defaults?.location ?? "",
    trade: defaults?.trade ?? "",
    type: defaults?.type ?? "",
    reference: defaults?.reference ?? "",
    drawing_reference: defaults?.drawing_reference ?? "",
    cost_code: defaults?.cost_code ?? "",
    cost_impact: defaults?.cost_impact ?? null,
    is_private: defaults?.is_private ?? false,
  };
}

function useProjectTeamAssignees(projectId: string) {
  return useQuery({
    queryKey: ["project-team-assignees", projectId],
    queryFn: async () => {
      const res = await apiFetch<{ data: ProjectTeamRole[] }>(
        `/api/projects/${projectId}/directory/roles`,
      );
      return flattenProjectTeamAssignees(res.data ?? []);
    },
    enabled: !!projectId,
    staleTime: 60_000,
  });
}

type ProjectTeamAssignee = ReturnType<typeof flattenProjectTeamAssignees>[number];

/**
 * Reusable project-team person picker for the punch item person fields
 * (Punch Item Manager, Final Approver). Stores the selected person id;
 * matches the Assignee combobox styling so all person fields look identical.
 */
function ProjectPersonField({
  form,
  name,
  label,
  people,
  isLoading,
  error,
}: {
  form: UseFormReturn<PunchItemFormValues>;
  name: "punch_item_manager_id" | "final_approver_id";
  label: string;
  people: ProjectTeamAssignee[];
  isLoading: boolean;
  error: unknown;
}) {
  const [open, setOpen] = useState(false);
  const emptyText = error
    ? "Could not load project team contacts."
    : isLoading
      ? "Loading project team contacts..."
      : "No project team contacts found.";

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => {
        const selected = people.find((p) => p.id === field.value);
        return (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    className={cn(
                      "w-full justify-between font-normal",
                      !field.value && "text-muted-foreground",
                    )}
                  >
                    <span className="flex flex-col items-start min-w-0">
                      <span className={cn(!selected && "text-muted-foreground")}>
                        {selected?.full_name ?? `Select ${label.toLowerCase()}...`}
                      </span>
                      {selected?.company_name && (
                        <span className="text-xs text-muted-foreground">{selected.company_name}</span>
                      )}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </FormControl>
              </PopoverTrigger>
              {/* eslint-disable-next-line design-system/no-arbitrary-spacing */}
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                  <CommandInput placeholder="Search project team contacts..." />
                  <CommandList>
                    <CommandEmpty>{emptyText}</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="__none__"
                        onSelect={() => {
                          field.onChange(null);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            !field.value ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <span className="text-muted-foreground italic">None</span>
                      </CommandItem>
                      {people.map((person) => {
                        const searchValue = [
                          person.full_name,
                          person.email,
                          person.company_name,
                          person.role_names.join(", "),
                        ]
                          .filter(Boolean)
                          .join(" ");
                        return (
                          <CommandItem
                            key={person.id}
                            value={searchValue}
                            onSelect={() => {
                              field.onChange(person.id);
                              setOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                field.value === person.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <div>
                              <p className="text-sm">{person.full_name}</p>
                              {person.company_name && (
                                <p className="text-xs text-muted-foreground">{person.company_name}</p>
                              )}
                            </div>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

interface PunchItemFormFieldsProps {
  form: UseFormReturn<PunchItemFormValues>;
  projectId?: number;
  /** Wrap the fields in a `<Form>` provider. Set false when the caller already provides one. */
  withFormProvider?: boolean;
}

/**
 * Canonical field set for punch item create / edit forms.
 *
 * Used by:
 *  - `PunchItemFormSheet` (the punch list create / edit side panel)
 *  - `LinkPinModal` (drawing-pin "create new punch item" tab)
 *
 * Any change to the punch item form (new field, validation, dropdown source)
 * belongs here so both surfaces stay in sync.
 *
 * The component renders fields only — submit buttons / dialog footers are
 * owned by the caller because they differ across surfaces.
 */
export function PunchItemFormFields({
  form,
  projectId,
  withFormProvider = true,
}: PunchItemFormFieldsProps) {
  const projectIdStr = projectId ? String(projectId) : "";
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [bicOpen, setBicOpen] = useState(false);
  const [drawingOpen, setDrawingOpen] = useState(false);

  const {
    data: projectTeamAssignees = [],
    isLoading: isLoadingAssignees,
    error: assigneesError,
  } = useProjectTeamAssignees(projectIdStr);

  // Drawing Reference must point at a real drawing — never free text.
  const { data: drawingsData } = useDrawings(projectIdStr);
  const drawings = drawingsData?.drawings ?? [];

  // Cost Code uses the same project budget-code dropdown as every other tool.
  const { budgetCodes, loadingCodes } = useProjectBudgetCodes(projectIdStr);

  const fields = (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Title *</FormLabel>
            <FormControl>
              <Input placeholder="Enter punch item title" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Textarea placeholder="Enter description" rows={3} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="work_required">Work Required</SelectItem>
                  <SelectItem value="initiated">Initiated</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="priority"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Priority</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ProjectPersonField
          form={form}
          name="punch_item_manager_id"
          label="Punch Item Manager"
          people={projectTeamAssignees}
          isLoading={isLoadingAssignees}
          error={assigneesError}
        />
        <ProjectPersonField
          form={form}
          name="final_approver_id"
          label="Final Approver"
          people={projectTeamAssignees}
          isLoading={isLoadingAssignees}
          error={assigneesError}
        />
      </div>

      <FormField
        control={form.control}
        name="assignee_id"
        render={({ field }) => {
          const selected = projectTeamAssignees.find((p) => p.id === field.value);
          const displayName = selected?.full_name ?? null;
          const displayCompany = selected?.company_name ?? null;
          const emptyText = assigneesError
            ? "Could not load project team contacts."
            : isLoadingAssignees
              ? "Loading project team contacts..."
              : "No project team contacts found.";
          return (
            <FormItem>
              <FormLabel>Assignee</FormLabel>
              <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      className={cn(
                        "w-full justify-between font-normal",
                        !field.value && "text-muted-foreground",
                      )}
                    >
                      <span className="flex flex-col items-start min-w-0">
                        <span className={cn(!displayName && "text-muted-foreground")}>
                          {displayName ?? "Select assignee..."}
                        </span>
                        {displayCompany && (
                          <span className="text-xs text-muted-foreground">{displayCompany}</span>
                        )}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                {/* eslint-disable-next-line design-system/no-arbitrary-spacing */}
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Search project team contacts..." />
                    <CommandList>
                      <CommandEmpty>{emptyText}</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="__none__"
                          onSelect={() => {
                            field.onChange(null);
                            form.setValue("assignee_company", "");
                            setAssigneeOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              !field.value ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <span className="text-muted-foreground italic">Unassigned</span>
                        </CommandItem>
                        {projectTeamAssignees.map((person) => {
                          const name = person.full_name;
                          const roleLabel = person.role_names.join(", ");
                          const searchValue = [
                            name,
                            person.email,
                            person.company_name,
                            roleLabel,
                          ]
                            .filter(Boolean)
                            .join(" ");
                          return (
                            <CommandItem
                              key={person.id}
                              value={searchValue}
                              onSelect={() => {
                                field.onChange(person.id);
                                form.setValue("assignee_company", person.company_name ?? "");
                                setAssigneeOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  field.value === person.id ? "opacity-100" : "opacity-0",
                                )}
                              />
                              <div>
                                <p className="text-sm">{name}</p>
                                {person.company_name && (
                                  <p className="text-xs text-muted-foreground">{person.company_name}</p>
                                )}
                                {roleLabel && !person.company_name && (
                                  <p className="text-xs text-muted-foreground">{roleLabel}</p>
                                )}
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          );
        }}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="ball_in_court"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ball in Court</FormLabel>
              <Popover open={bicOpen} onOpenChange={setBicOpen}>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      className={cn(
                        "w-full justify-between font-normal",
                        !field.value && "text-muted-foreground",
                      )}
                    >
                      {field.value || "Select responsible party..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                {/* eslint-disable-next-line design-system/no-arbitrary-spacing */}
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Search project team contacts..." />
                    <CommandList>
                      <CommandEmpty>
                        {assigneesError
                          ? "Could not load project team contacts."
                          : isLoadingAssignees
                            ? "Loading project team contacts..."
                            : "No project team contacts found."}
                      </CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="__none__"
                          onSelect={() => {
                            field.onChange("");
                            setBicOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              !field.value ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <span className="text-muted-foreground italic">None</span>
                        </CommandItem>
                        {projectTeamAssignees.map((person) => {
                          const name = person.full_name;
                          const roleLabel = person.role_names.join(", ");
                          const searchValue = [
                            name,
                            person.email,
                            person.company_name,
                            roleLabel,
                          ]
                            .filter(Boolean)
                            .join(" ");
                          return (
                            <CommandItem
                              key={person.id}
                              value={searchValue}
                              onSelect={() => {
                                field.onChange(name);
                                setBicOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  field.value === name ? "opacity-100" : "opacity-0",
                                )}
                              />
                              {name}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        <RHFDateField
          control={form.control}
          name="due_date"
          label="Due Date"
          nullable
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="location"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Location</FormLabel>
              <FormControl>
                <Input placeholder="Location" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="trade"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Trade</FormLabel>
              <FormControl>
                <Input placeholder="Trade" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <FormControl>
                <Input placeholder="Type" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="reference"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reference</FormLabel>
              <FormControl>
                <Input placeholder="Reference number or link" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="drawing_reference"
        render={({ field }) => {
          const selected = drawings.find((d) => d.drawingNumber === field.value);
          const emptyText = !projectIdStr
            ? "Select a project to link drawings."
            : "No drawings found.";
          return (
            <FormItem>
              <FormLabel>Drawing Reference</FormLabel>
              <Popover open={drawingOpen} onOpenChange={setDrawingOpen}>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      className={cn(
                        "w-full justify-between font-normal",
                        !field.value && "text-muted-foreground",
                      )}
                    >
                      <span className="truncate">
                        {selected
                          ? `${selected.drawingNumber}${selected.title ? ` — ${selected.title}` : ""}`
                          : field.value || "Link a drawing..."}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                  <Command>
                    <CommandInput placeholder="Search drawings..." />
                    <CommandList>
                      <CommandEmpty>{emptyText}</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="__none__"
                          onSelect={() => {
                            field.onChange("");
                            setDrawingOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              !field.value ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <span className="text-muted-foreground italic">No drawing</span>
                        </CommandItem>
                        {drawings.map((drawing) => {
                          const searchValue = [drawing.drawingNumber, drawing.title]
                            .filter(Boolean)
                            .join(" ");
                          return (
                            <CommandItem
                              key={drawing.id}
                              value={searchValue}
                              onSelect={() => {
                                field.onChange(drawing.drawingNumber);
                                setDrawingOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  field.value === drawing.drawingNumber
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                              <div>
                                <p className="text-sm">{drawing.drawingNumber}</p>
                                {drawing.title && (
                                  <p className="text-xs text-muted-foreground">{drawing.title}</p>
                                )}
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          );
        }}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="cost_code"
          render={({ field }) => {
            const selectedId = budgetCodes.find((c) => c.code === field.value)?.id ?? "";
            return (
              <FormItem>
                <FormLabel>Cost Code</FormLabel>
                <FormControl>
                  <BudgetCodeSelector
                    value={selectedId}
                    budgetCodes={budgetCodes}
                    loading={loadingCodes}
                    placeholder="Select cost code..."
                    onValueChange={(_id, code) => field.onChange(code.code)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            );
          }}
        />

        <RHFMoneyField
          control={form.control}
          name="cost_impact"
          label="Cost Impact"
          allowNegative
        />
      </div>

      <FormField
        control={form.control}
        name="is_private"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center gap-3 space-y-0">
            <FormControl>
              <Checkbox
                checked={!!field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
              />
            </FormControl>
            <FormLabel className="font-normal">
              Private
              <span className="ml-2 text-xs text-muted-foreground">
                Only the creator, manager, approver, and assignees can see this item
              </span>
            </FormLabel>
          </FormItem>
        )}
      />
    </div>
  );

  if (!withFormProvider) return fields;

  return <Form {...form}>{fields}</Form>;
}
