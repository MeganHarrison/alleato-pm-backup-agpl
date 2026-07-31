"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, MoreVertical, UserPlus } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Badge,
  Button,
  DataTable as DsDataTable,
  EmptyState as DsEmptyState,
  ErrorState,
  SectionHeader as DsSectionHeader,
  Skeleton,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ds";
import { createClient } from "@/lib/supabase/client";
import { updateContact } from "@/app/(main)/actions/table-actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ContactFormSheet } from "@/components/domain/contacts/ContactFormSheet";
import { apiFetch } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { appToast as toast } from "@/lib/toast/app-toast";
import { acumaticaVendorUrl } from "@/lib/acumatica/vendor-url";
import type { Database } from "@/types/database.types";

type Company = Database["public"]["Tables"]["companies"]["Row"];
type Contact = Database["public"]["Tables"]["people"]["Row"];

interface CompanyProjectItem {
  id: number;
  name: string | null;
  project_number: string | null;
  state: string | null;
  archived: boolean;
  company_status: string | null;
  company_type: string | null;
}

interface InvoiceItem {
  id: number;
  invoice_number: string | null;
  status: string | null;
  prime_contract_id: string | null;
  contract_number: string | null;
  contract_title: string | null;
  project_id: number | null;
  project_name: string | null;
  project_number: string | null;
  period_start: string | null;
  period_end: string | null;
  created_at: string | null;
  updated_at: string;
}

interface CompanyDetailsResponse {
  company: Company;
  contacts: Contact[];
  projects: CompanyProjectItem[];
  invoices: InvoiceItem[];
}

function statusVariant(
  status?: string | null,
): "default" | "secondary" | "outline" | "destructive" {
  if (!status) return "outline";
  const n = status.toLowerCase();
  if (n === "active" || n === "approved" || n === "paid") return "default";
  if (n === "draft" || n === "pending" || n === "submitted") return "secondary";
  if (n === "inactive" || n === "void" || n === "rejected") return "destructive";
  return "outline";
}

function FactRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

export function CompanyDetailSheet({
  companyId,
  open,
  onOpenChange,
  projectId,
}: {
  companyId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}) {
  const [data, setData] = React.useState<CompanyDetailsResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [addContactOpen, setAddContactOpen] = React.useState(false);
  const [addContactPopoverOpen, setAddContactPopoverOpen] = React.useState(false);
  const [existingPeople, setExistingPeople] = React.useState<
    Array<{ id: string; first_name: string | null; last_name: string | null; email: string | null }>
  >([]);
  const [loadingPeople, setLoadingPeople] = React.useState(false);

  const loadDetails = React.useCallback(async (cancelledRef?: { current: boolean }) => {
    if (!companyId) return;
    setIsLoading(true);
    setError(null);
    setData(null);
    try {
      const payload = await apiFetch<CompanyDetailsResponse>(
        `/api/directory/companies/${companyId}/details`,
        { cache: "no-store" },
      );
      if (cancelledRef?.current) return;
      setData(payload);
    } catch (err: unknown) {
      if (cancelledRef?.current) return;
      setError(err instanceof Error ? err.message : "Failed to load company");
    } finally {
      if (cancelledRef?.current) return;
      setIsLoading(false);
    }
  }, [companyId]);

  React.useEffect(() => {
    if (!open || !companyId) return;
    let cancelled = false;
    void loadDetails({
      get current() {
        return cancelled;
      },
    });
    return () => {
      cancelled = true;
    };
  }, [open, companyId, loadDetails]);

  React.useEffect(() => {
    if (!addContactPopoverOpen || !companyId) return;
    setLoadingPeople(true);
    const supabase = createClient();
    // Only offer people who are not already assigned to a company. Adding an
    // existing contact here rewrites their `company_id` to this company, so
    // showing people who already work elsewhere would silently move them out
    // of their real company. Unassigned people (or "Create new person") are the
    // only safe candidates to attach as a contact of this company.
    supabase
      .from("people")
      .select("id, first_name, last_name, email")
      .is("company_id", null)
      .order("last_name")
      .limit(200)
      .then(({ data: rows }) => {
        setExistingPeople(
          (rows ?? []).map((p) => ({
            id: p.id,
            first_name: p.first_name ?? null,
            last_name: p.last_name ?? null,
            email: p.email ?? null,
          })),
        );
        setLoadingPeople(false);
      });
  }, [addContactPopoverOpen, companyId]);

  const handleAddExistingContact = async (person: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  }) => {
    setAddContactPopoverOpen(false);
    try {
      await updateContact(person.id, { company_id: companyId! });
      const name =
        [person.first_name, person.last_name].filter(Boolean).join(" ") ||
        person.email ||
        "Person";
      toast.success(`${name} added to company`);
      await loadDetails();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The company directory did not confirm the add.";
      toast.error("Could not add person", { description: message });
    }
  };

  const company = data?.company ?? null;
  const contacts = data?.contacts ?? [];
  const projects = data?.projects ?? [];
  const invoices = data?.invoices ?? [];
  const effectivePrimaryContactId = company?.primary_contact_id ?? contacts[0]?.id ?? null;
  const websiteUrl = company?.website
    ? company.website.startsWith("http")
      ? company.website
      : `https://${company.website}`
    : null;
  const location = [company?.city, company?.state].filter(Boolean).join(", ");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto md:w-full md:max-w-3xl lg:w-full lg:max-w-4xl xl:max-w-5xl">
        <SheetHeader>
          <div className="flex items-start justify-between gap-3 pr-8">
            <div className="min-w-0">
              <SheetTitle className="truncate text-xl tracking-tight">
                {company?.name ?? (isLoading ? "Loading…" : "Company")}
              </SheetTitle>
              {location && (
                <p className="truncate text-xs text-muted-foreground">{location}</p>
              )}
            </div>
            {companyId && company && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    aria-label="Company actions"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onSelect={() => setAddContactPopoverOpen(true)}>
                    <UserPlus className="mr-2 h-3.5 w-3.5" />
                    Add from company directory
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={`/directory/companies/${companyId}`}>
                      <ArrowRight className="mr-2 h-3.5 w-3.5" />
                      View full profile
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </SheetHeader>

        <div className="px-8 pb-8 space-y-8">
          {isLoading && (
            <div className="space-y-4 pt-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          )}

          {error && !isLoading && (
            <div className="pt-4">
              <ErrorState error={error} />
            </div>
          )}

          {company && !isLoading && (
            <>
              <section className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                <FactRow label="Status" value={company.status} />
                <FactRow label="Type" value={company.type} />
                <FactRow
                  label="ERP Vendor ID"
                  value={
                    company.acumatica_vendor_id ? (
                      <a
                        href={acumaticaVendorUrl(company.acumatica_vendor_id)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
                      >
                        {company.acumatica_vendor_id}
                        <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                      </a>
                    ) : null
                  }
                />
                <FactRow label="License Number" value={company.license_number} />
                <FactRow label="Email" value={company.contact_email} />
                <FactRow label="Phone" value={company.contact_phone} />
                <FactRow
                  label="Website"
                  value={
                    websiteUrl ? (
                      <a
                        href={websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
                      >
                        <span className="truncate">{company.website}</span>
                        <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                      </a>
                    ) : null
                  }
                />
                <FactRow label="Address" value={company.address} />
                <FactRow label="City" value={company.city} />
                <FactRow label="State" value={company.state} />
                <FactRow label="Postal Code" value={company.zip_code} />
                <FactRow label="Country" value={company.country} />
                <FactRow label="Legal Name" value={company.legal_name} />
                <FactRow label="Display Name" value={company.title} />
                <FactRow label="Tax ID" value={company.tax_id} />
              </section>

              {company.notes && (
                <section className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">Notes</span>
                  <div className="text-sm text-foreground">{company.notes}</div>
                </section>
              )}

              <section className="space-y-3">
                <DsSectionHeader
                  title={`Contacts (${contacts.length})`}
                  action={
                    <Popover
                      open={addContactPopoverOpen}
                      onOpenChange={setAddContactPopoverOpen}
                    >
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 text-xs">
                          <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                          Add from company directory
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-0" align="end">
                        <Command>
                          <CommandInput placeholder="Search unassigned people..." />
                          <CommandList className="max-h-56">
                            <CommandEmpty>
                              {loadingPeople
                                ? "Loading..."
                                : "No unassigned people. Use “Create new person” below."}
                            </CommandEmpty>
                            {existingPeople.length > 0 && (
                              <CommandGroup heading="People not yet assigned to a company">
                                {existingPeople.map((person) => {
                                  const name =
                                    [person.first_name, person.last_name]
                                      .filter(Boolean)
                                      .join(" ") ||
                                    person.email ||
                                    "Unnamed";
                                  return (
                                    <CommandItem
                                      key={person.id}
                                      value={`${person.first_name ?? ""} ${person.last_name ?? ""} ${person.email ?? ""}`}
                                      onSelect={() =>
                                        void handleAddExistingContact(person)
                                      }
                                    >
                                      <div className="flex min-w-0 flex-col">
                                        <span className="truncate text-sm">
                                          {name}
                                        </span>
                                        {person.email && (
                                          <span className="truncate text-xs text-muted-foreground">
                                            {person.email}
                                          </span>
                                        )}
                                      </div>
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            )}
                          </CommandList>
                        </Command>
                        <div className="border-t border-border/60 p-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start text-sm"
                            onClick={() => {
                              setAddContactPopoverOpen(false);
                              setAddContactOpen(true);
                            }}
                          >
                            <UserPlus className="mr-2 h-4 w-4 shrink-0" />
                            Create new person
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  }
                />
                {contacts.length === 0 ? (
                  <DsEmptyState
                    title="No contacts"
                    description="No contacts associated with this company."
                    action={
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAddContactPopoverOpen(true)}
                      >
                        <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                        Add from company directory
                      </Button>
                    }
                  />
                ) : (
                  <ul className="divide-y divide-border/60">
                    {contacts.map((contact) => {
                      const isPrimary = contact.id === effectivePrimaryContactId;
                      return (
                        <li key={contact.id} className="flex min-w-0 items-center justify-between gap-4 py-2">
                          <div className="min-w-0">
                            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                              <Link
                                href={`/directory/contacts/${contact.id}`}
                                className="truncate text-sm font-medium text-foreground underline-offset-4 hover:underline"
                              >
                                {contact.first_name} {contact.last_name}
                              </Link>
                              {contact.email && (
                                <span className="truncate text-xs text-muted-foreground">
                                  {contact.email}
                                </span>
                              )}
                              {isPrimary && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0 shrink-0"
                                >
                                  Primary
                                </Badge>
                              )}
                            </div>
                            <p className="truncate text-xs text-muted-foreground">
                              {contact.job_title || "No title"}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section className="space-y-3">
                <DsSectionHeader title={`Projects (${projects.length})`} />
                {projects.length === 0 ? (
                  <DsEmptyState
                    title="No projects"
                    description="This company is not associated with any projects."
                  />
                ) : (
                  <DsDataTable<CompanyProjectItem>
                    rows={projects}
                    columns={[
                      {
                        key: "project",
                        header: "Project",
                        primary: true,
                        render: (project) => (
                          <Link
                            href={`/${project.id}/home`}
                            className="font-medium text-foreground underline-offset-4 hover:underline"
                          >
                            {project.name || `Project ${project.id}`}
                          </Link>
                        ),
                      },
                      {
                        key: "status",
                        header: "Status",
                        render: (project) => (
                          <Badge variant={statusVariant(project.company_status)}>
                            {project.company_status || "Unknown"}
                          </Badge>
                        ),
                      },
                      {
                        key: "number",
                        header: "Number",
                        render: (project) => (
                          <span className="font-mono text-xs">
                            #{project.project_number || "-"}
                          </span>
                        ),
                      },
                    ]}
                  />
                )}
              </section>

              <section className="space-y-3">
                <DsSectionHeader title={`Invoices (${invoices.length})`} />
                {invoices.length === 0 ? (
                  <DsEmptyState
                    title="No invoices"
                    description="No invoices for this company's projects."
                  />
                ) : (
                  <DsDataTable<InvoiceItem>
                    rows={invoices.slice(0, 10)}
                    columns={[
                      {
                        key: "invoice",
                        header: "Invoice",
                        primary: true,
                        render: (invoice) =>
                          invoice.invoice_number || `Invoice ${invoice.id}`,
                      },
                      {
                        key: "status",
                        header: "Status",
                        render: (invoice) => (
                          <Badge variant={statusVariant(invoice.status)}>
                            {invoice.status || "Unknown"}
                          </Badge>
                        ),
                      },
                      {
                        key: "project",
                        header: "Project",
                        render: (invoice) =>
                          invoice.project_name || invoice.project_number || "—",
                      },
                      {
                        key: "period",
                        header: "Period",
                        align: "right",
                        render: (invoice) =>
                          invoice.period_end ? formatDate(invoice.period_end) : "—",
                      },
                    ]}
                  />
                )}
              </section>

            </>
          )}
        </div>

        <ContactFormSheet
          open={addContactOpen}
          onOpenChange={setAddContactOpen}
          defaultCompanyId={companyId ?? undefined}
          onSuccess={() => {
            void loadDetails();
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
