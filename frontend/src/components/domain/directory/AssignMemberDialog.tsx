"use client";

import React from "react";
import { Check, UserPlus, ArrowLeft, X, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/unified-modal";
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
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { ProjectRole } from "@/hooks/use-project-roles";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PersonOption {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  job_title: string | null;
  company_name: string | null;
}

interface DirectoryPeopleResponse {
  data?: Array<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    email?: string | null;
    job_title?: string | null;
    company?: { name?: string | null } | null;
  }>;
  meta?: {
    total?: number;
    page?: number;
    perPage?: number;
    totalPages?: number;
  };
}

interface CompanyOption {
  id: string;
  name: string;
}

interface CreatedPersonResponse {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  job_title: string | null;
  company?: { id: string; name: string | null } | null;
}

const WRAPPED_VALUE_PATTERN = /^[\s"'\[(]+|[\s"'\])]+$/g;

function cleanPersonText(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return cleanPersonText(parsed.find((item) => typeof item === "string") as string | undefined);
      }
      if (parsed !== null && typeof parsed === "object" && "display" in parsed) {
        return cleanPersonText((parsed as { display?: unknown }).display as string | undefined);
      }
    } catch (error) {
      console.warn(
        JSON.stringify({
          event: "assign_member_clean_person_text_parse_failed",
          error: error instanceof Error ? error.message : String(error),
          value: trimmed.slice(0, 120),
        }),
      );
    }
  }

  return trimmed.replace(WRAPPED_VALUE_PATTERN, "").trim();
}

function getPersonDisplayName(person: PersonOption): string {
  const firstName = cleanPersonText(person.first_name);
  const lastName = cleanPersonText(person.last_name);
  const email = cleanPersonText(person.email);
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();

  if (!name) return email || "Unnamed person";
  if (email && name.toLowerCase() === email.toLowerCase()) return email;
  return name;
}

function splitSearchName(search: string): { first: string; last: string } {
  const tokens = search.trim().split(/\s+/);
  if (tokens.length === 0) return { first: "", last: "" };
  if (tokens.length === 1) return { first: tokens[0], last: "" };
  return { first: tokens[0], last: tokens.slice(1).join(" ") };
}

// ── CreateContactForm ──────────────────────────────────────────────────────────

function CreateContactForm({
  initialName,
  companies,
  onCancel,
  onCreated,
}: {
  initialName: string;
  companies: CompanyOption[];
  onCancel: () => void;
  onCreated: (person: PersonOption) => void;
}) {
  const seed = splitSearchName(initialName);
  const [firstName, setFirstName] = React.useState(seed.first);
  const [lastName, setLastName] = React.useState(seed.last);
  const [email, setEmail] = React.useState("");
  const [jobTitle, setJobTitle] = React.useState("");
  const [companyId, setCompanyId] = React.useState<string>("");
  const [saving, setSaving] = React.useState(false);
  const [companyOpen, setCompanyOpen] = React.useState(false);
  const [companySearch, setCompanySearch] = React.useState("");

  const selectedCompany = companies.find((c) => c.id === companyId) ?? null;
  const filteredCompanies = React.useMemo(() => {
    const query = companySearch.trim().toLowerCase();
    if (!query) return companies;
    return companies.filter((c) => c.name.toLowerCase().includes(query));
  }, [companies, companySearch]);

  const handleCreate = async () => {
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    if (!trimmedFirst || !trimmedLast) {
      toast.error("First and last name are required");
      return;
    }
    setSaving(true);
    try {
      const created = await apiFetch<CreatedPersonResponse>("/api/people", {
        method: "POST",
        body: JSON.stringify({
          first_name: trimmedFirst,
          last_name: trimmedLast,
          email: email.trim() || undefined,
          job_title: jobTitle.trim() || undefined,
          company_id: companyId || undefined,
          person_type: "contact",
        }),
      });

      onCreated({
        id: created.id,
        first_name: created.first_name,
        last_name: created.last_name,
        email: created.email,
        job_title: created.job_title,
        company_name: created.company?.name ?? null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create contact";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-6 pb-6">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="assign-create-first" className="text-xs font-medium text-muted-foreground">
              First name
            </Label>
            <Input
              id="assign-create-first"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoFocus
              disabled={saving}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="assign-create-last" className="text-xs font-medium text-muted-foreground">
              Last name
            </Label>
            <Input
              id="assign-create-last"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={saving}
              className="h-9"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="assign-create-email" className="text-xs font-medium text-muted-foreground">
            Email
          </Label>
          <Input
            id="assign-create-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            disabled={saving}
            className="h-9"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="assign-create-title" className="text-xs font-medium text-muted-foreground">
              Job title
            </Label>
            <Input
              id="assign-create-title"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              disabled={saving}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="assign-create-company" className="text-xs font-medium text-muted-foreground">
              Company
            </Label>
            <Popover open={companyOpen} onOpenChange={setCompanyOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="assign-create-company"
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={companyOpen}
                  disabled={saving}
                  className="h-9 w-full justify-between bg-background font-normal"
                >
                  <span
                    className={cn(
                      "truncate",
                      !selectedCompany && "text-muted-foreground",
                    )}
                  >
                    {selectedCompany ? selectedCompany.name : "None"}
                  </span>
                  <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[var(--radix-popover-trigger-width)] p-0"
                align="start"
              >
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search company…"
                    value={companySearch}
                    onValueChange={setCompanySearch}
                  />
                  <CommandList className="max-h-60 overflow-y-auto">
                    {filteredCompanies.length > 0 ? (
                      <CommandGroup>
                        {filteredCompanies.map((c) => (
                          <CommandItem
                            key={c.id}
                            value={c.id}
                            onSelect={() => {
                              setCompanyId(c.id);
                              setCompanyOpen(false);
                              setCompanySearch("");
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                companyId === c.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <span className="truncate">{c.name}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    ) : (
                      <CommandEmpty>
                        No matching company. New companies are managed in
                        Acumatica (ERP) by Accounting.
                      </CommandEmpty>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={handleCreate} disabled={saving}>
            {saving ? "Creating..." : "Create & assign"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── AssignMemberDialog ─────────────────────────────────────────────────────────

export function AssignMemberDialog({
  open,
  onOpenChange,
  role,
  onSave,
  projectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: ProjectRole | null;
  onSave: (roleId: string, personIds: string[]) => Promise<void>;
  projectId: string;
}) {
  const [people, setPeople] = React.useState<PersonOption[]>([]);
  const [externalPeople, setExternalPeople] = React.useState<PersonOption[]>([]);
  const [externalLoaded, setExternalLoaded] = React.useState(false);
  const [externalLoading, setExternalLoading] = React.useState(false);
  const [companies, setCompanies] = React.useState<CompanyOption[]>([]);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [search, setSearch] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [mode, setMode] = React.useState<"search" | "external" | "create">(
    "search",
  );

  // Lookup that spans both employee and external-contact lists. Used for
  // rendering the "Assigned" pills regardless of which list the person came
  // from (an already-assigned external contact must still render correctly
  // before the external list has been loaded).
  const findPerson = React.useCallback(
    (id: string): PersonOption | undefined =>
      people.find((p) => p.id === id) ??
      externalPeople.find((p) => p.id === id),
    [people, externalPeople],
  );

  React.useEffect(() => {
    if (!open || !role) return;
    setSelectedIds(role.members.map((m) => m.person_id));
    setSearch("");
    setMode("search");
    setExternalLoaded(false);
    setExternalPeople([]);

    const loadAllPeople = async () => {
      try {
        // Project Team roles are Alleato-internal positions (Superintendent, PM, etc.),
        // so the role-assignment dropdown only lists employees. External contributors
        // (architects, engineers, subs) are added via the "Add external contact" flow
        // below and live in the directory without polluting role dropdowns.
        const params = new URLSearchParams({
          type: "employee",
          status: "active",
          page: "1",
          per_page: "1000",
        });
        const result = await apiFetch<DirectoryPeopleResponse>(
          `/api/people?${params}`,
        );

        // Guardrail: surface silent truncation if the employee roster ever exceeds per_page.
        const total = result.meta?.total;
        const returned = result.data?.length ?? 0;
        if (typeof total === "number" && total > returned) {
           
          console.warn(
            `[AssignMemberDialog] /api/people returned ${returned}/${total} employees — increase per_page or paginate.`,
          );
        }

        setPeople(
          (result.data || []).map((p) => ({
            id: p.id,
            first_name: p.first_name,
            last_name: p.last_name,
            email: p.email ?? null,
            job_title: p.job_title ?? null,
            company_name: p.company?.name ?? null,
          })),
        );
      } catch (error) {
        setPeople([]);
        toast.error("Failed to load people");
      }
    };

    const loadCompanies = async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("companies")
          .select("id, name")
          .order("name");
        setCompanies((data ?? []).filter((c) => c.name) as CompanyOption[]);
      } catch {
        setCompanies([]);
      }
    };

    // If the role already has members who are external contacts (not in the
    // employees fetch), eagerly load just those rows so their assigned-pills
    // render immediately. We do this with a direct Supabase .in() call to
    // avoid pulling the entire contacts list before the user opens that view.
    const loadAssignedExternal = async () => {
      const memberIds = role.members.map((m) => m.person_id);
      if (memberIds.length === 0) return;
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("people")
          .select(
            "id, first_name, last_name, email, job_title, person_type, company:companies!people_company_id_fkey(id, name)",
          )
          .in("id", memberIds)
          .neq("person_type", "employee");
        if (error || !data) {
          console.warn(
            JSON.stringify({
              event: "assign_member_assigned_external_lookup_failed",
              roleId: role.id,
              error: error?.message ?? "No external contact data returned",
            }),
          );
          return;
        }
        setExternalPeople(
          data.map((p) => ({
            id: p.id,
            first_name: p.first_name,
            last_name: p.last_name,
            email: p.email ?? null,
            job_title: p.job_title ?? null,
            company_name: p.company?.name ?? null,
          })),
        );
      } catch (error) {
        console.warn(
          JSON.stringify({
            event: "assign_member_assigned_external_lookup_failed",
            roleId: role.id,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    };

    void loadAllPeople();
    void loadCompanies();
    void loadAssignedExternal();
  }, [open, role, projectId]);

  // Lazy-load the full external-contacts list the first time the user opens
  // the "Add external contact" view. We pull a generous page so the Command
  // component can filter client-side. (Current dataset: ~1100 contacts.)
  const loadExternalPeople = React.useCallback(async () => {
    if (externalLoaded || externalLoading) return;
    setExternalLoading(true);
    try {
      const params = new URLSearchParams({
        type: "contact",
        status: "active",
        page: "1",
        per_page: "2000",
      });
      const result = await apiFetch<DirectoryPeopleResponse>(
        `/api/people?${params}`,
      );

      const total = result.meta?.total;
      const returned = result.data?.length ?? 0;
      if (typeof total === "number" && total > returned) {

        console.warn(
          `[AssignMemberDialog] /api/people returned ${returned}/${total} external contacts — increase per_page or paginate.`,
        );
      }

      const fetched = (result.data || []).map((p) => ({
        id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        email: p.email ?? null,
        job_title: p.job_title ?? null,
        company_name: p.company?.name ?? null,
      }));
      // Merge with any already-loaded assigned externals so we don't lose them.
      setExternalPeople((prev) => {
        const seen = new Set(fetched.map((p) => p.id));
        const carryover = prev.filter((p) => !seen.has(p.id));
        return [...carryover, ...fetched];
      });
      setExternalLoaded(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        JSON.stringify({
          event: "assign_member_external_contacts_load_failed",
          error: message,
        }),
      );
      toast.error(`External contacts did not load: ${message}`);
    } finally {
      setExternalLoading(false);
    }
  }, [externalLoaded, externalLoading]);

  const handleSelect = async (personId: string) => {
    if (!role || saving) return;
    const next = selectedIds.includes(personId)
      ? selectedIds.filter((x) => x !== personId)
      : [...selectedIds, personId];
    setSelectedIds(next);
    setSaving(true);
    try {
      await onSave(role.id, next);
      toast.success("Role assignment updated");
    } catch (err) {
      toast.error("Failed to update role assignment");
      setSelectedIds(selectedIds);
    } finally {
      setSaving(false);
    }
  };

  const handleCreated = async (newPerson: PersonOption) => {
    if (!role) return;
    // Newly created people are person_type='contact', so they belong in the
    // external list — not the employee list.
    setExternalPeople((prev) => [newPerson, ...prev]);
    const next = [...selectedIds, newPerson.id];
    setSelectedIds(next);
    setSaving(true);
    try {
      await onSave(role.id, next);
      toast.success(`${getPersonDisplayName(newPerson)} added to ${role.role_name}`);
      setMode("external");
      setSearch("");
    } catch (err) {
      toast.error("Contact created, but failed to assign role");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveSelected = async (personId: string) => {
    if (!role || saving) return;
    const next = selectedIds.filter((x) => x !== personId);
    setSelectedIds(next);
    setSaving(true);
    try {
      await onSave(role.id, next);
      toast.success("Removed from role");
    } catch {
      toast.error("Failed to remove from role");
      setSelectedIds(selectedIds);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent
        size="2xl"
        className="flex flex-col overflow-hidden gap-0 p-0 border-border/60"
        style={{ maxHeight: "85vh" }}
      >
        <ModalHeader className="px-6 pt-6 pb-4">
          <div className="flex items-start gap-2">
            {mode !== "search" && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => {
                  setMode(mode === "create" ? "external" : "search");
                  setSearch("");
                }}
                aria-label="Back"
                className="-ml-1 mt-0.5 h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="space-y-1">
              <ModalTitle className="text-lg tracking-tight">
                Assign members
              </ModalTitle>
              <ModalDescription>
                {role
                  ? `Choose who fills the ${role.role_name} role on this project.`
                  : "Choose who fills this role."}
              </ModalDescription>
            </div>
          </div>
        </ModalHeader>

        {mode === "create" ? (
          <CreateContactForm
            initialName={search}
            companies={companies}
            onCancel={() => setMode("external")}
            onCreated={handleCreated}
          />
        ) : (
          <div className="flex min-h-0 flex-col px-6 pb-6">
            <Command className="overflow-visible" shouldFilter={true}>
              <div className="rounded-md bg-muted/50">
                <CommandInput
                  placeholder={
                    mode === "external"
                      ? "Search external contacts…"
                      : "Search Alleato team…"
                  }
                  value={search}
                  onValueChange={setSearch}
                />
              </div>
              <CommandList className="mt-2 max-h-80 overflow-y-auto overscroll-contain -mx-1">
                <CommandEmpty>
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    {mode === "external" && externalLoading
                      ? "Loading contacts…"
                      : search
                        ? `No matches for "${search}".`
                        : mode === "external"
                          ? "No external contacts yet."
                          : "No people yet."}
                  </div>
                </CommandEmpty>
                <CommandGroup className="p-0">
                  {(mode === "external" ? externalPeople : people).map(
                    (person) => {
                      const displayName = getPersonDisplayName(person);
                      const companyName = cleanPersonText(person.company_name);
                      const email = cleanPersonText(person.email);
                      const isSelected = selectedIds.includes(person.id);

                      return (
                        <CommandItem
                          key={person.id}
                          value={`${displayName} ${email} ${companyName}`}
                          onSelect={() => void handleSelect(person.id)}
                          className={cn(
                            "flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors",
                            "data-[selected=true]:bg-accent/60",
                          )}
                          disabled={saving}
                        >
                          <div
                            className={cn(
                              "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors",
                              isSelected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-muted-foreground/25 bg-transparent",
                            )}
                          >
                            {isSelected && (
                              <Check
                                className="h-3 w-3 text-primary-foreground"
                                strokeWidth={3}
                              />
                            )}
                          </div>
                          <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_minmax(0,1fr)] items-baseline gap-3">
                            <span className="truncate text-sm text-foreground">
                              {displayName}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              {email}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              {companyName}
                            </span>
                          </div>
                        </CommandItem>
                      );
                    },
                  )}
                </CommandGroup>
              </CommandList>
            </Command>

            {selectedIds.length > 0 && (
              <div className="mt-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
                  Assigned · {selectedIds.length}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedIds.map((id) => {
                    const p = findPerson(id);
                    if (!p) return null;
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 rounded-full bg-secondary py-0.5 pl-2.5 pr-1 text-xs"
                      >
                        <span className="text-foreground">
                          {getPersonDisplayName(p)}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => void handleRemoveSelected(id)}
                          disabled={saving}
                          aria-label={`Remove ${getPersonDisplayName(p)}`}
                          className="ml-0.5 h-4 w-4 rounded-full text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-40"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-4 flex justify-end">
              {mode === "search" ? (
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  onClick={() => {
                    setMode("external");
                    setSearch("");
                    void loadExternalPeople();
                  }}
                  className="text-xs font-medium"
                >
                  <UserPlus className="h-3 w-3" />
                  Add external contact
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  onClick={() => setMode("create")}
                  className="text-xs font-medium"
                >
                  <UserPlus className="h-3 w-3" />
                  Create new contact
                </Button>
              )}
            </div>
          </div>
        )}
      </ModalContent>
    </Modal>
  );
}
