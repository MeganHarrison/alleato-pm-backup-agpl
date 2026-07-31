"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  ChevronsUpDown,
  MoreVertical,
} from "lucide-react";
import { appToast as toast } from "@/lib/toast/app-toast";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { useConfirm } from "@/hooks/use-confirm";
import { createContact, updateContact } from "@/app/(main)/actions/table-actions";
import { PageShell, SectionAction, SectionRuleHeading } from "@/components/layout";
import {
  DataTable as DsDataTable,
  EntityAttachments,
  ErrorState,
  EmptyState as DsEmptyState,
} from "@/components/ds";
import { ExpandableSearch } from "@/components/tables/unified/table-toolbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/unified-modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Database } from "@/types/database.types";
import { apiFetch } from "@/lib/api-client";
import { acumaticaVendorUrl } from "@/lib/acumatica/vendor-url";
import { StatusBadge } from "@/components/ds";
import { CompanyCrmSections } from "@/components/domain/crm/company-crm-sections";

type Company = Database["public"]["Tables"]["companies"]["Row"];
type Contact = Database["public"]["Tables"]["people"]["Row"];

type ProjectOption = {
  id: number;
  name: string | null;
  project_number: string | null;
};

type ExistingContactOption = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  company_id: string | null;
};

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

interface CommitmentItem {
  id: string;
  type: "subcontract" | "purchase_order";
  project_id: number | null;
  project_name: string | null;
  project_number: string | null;
  contract_number: string | null;
  title: string | null;
  status: string | null;
  contract_date: string | null;
  total_sov_amount: number | null;
  total_billed_to_date: number | null;
  total_amount_remaining: number | null;
  updated_at: string | null;
  trade_names: string[];
  scope_summary: string | null;
}

interface CompanyDetailsResponse {
  company: Company;
  contacts: Contact[];
  projects: CompanyProjectItem[];
  commitments: CommitmentItem[];
  invoices: InvoiceItem[];
  summary: {
    contact_count: number;
    project_count: number;
    commitment_count: number;
    invoice_count: number;
  };
}

function statusVariant(status?: string | null): "default" | "secondary" | "outline" | "destructive" {
  if (!status) return "outline";
  const normalized = status.toLowerCase();
  if (normalized === "active" || normalized === "approved" || normalized === "paid") return "default";
  if (normalized === "draft" || normalized === "pending" || normalized === "submitted") return "secondary";
  if (normalized === "inactive" || normalized === "void" || normalized === "rejected") return "destructive";
  return "outline";
}

function isOpenInvoice(status: string | null | undefined): boolean {
  const normalized = (status || "").toLowerCase();
  if (!normalized) return true;
  return !["paid", "approved", "void", "rejected"].includes(normalized);
}

function getInitials(firstName?: string | null, lastName?: string | null): string {
  const first = (firstName || "").trim().charAt(0);
  const last = (lastName || "").trim().charAt(0);
  const initials = `${first}${last}`.toUpperCase();
  return initials || "--";
}


export default function CompanyDetailsPage() {
  const router = useRouter();
  const params = useParams()! ?? {};
  const companyId = params.companyId as string;
  const { confirm, ConfirmDialog } = useConfirm();

  const [data, setData] = React.useState<CompanyDetailsResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [invoiceFilter, setInvoiceFilter] = React.useState<"all" | "open">("all");
  const [commitmentQuery, setCommitmentQuery] = React.useState("");

  const [addContactOpen, setAddContactOpen] = React.useState(false);
  const [contactMode, setContactMode] = React.useState<"existing" | "new">("existing");
  const [isSavingContact, setIsSavingContact] = React.useState(false);
  const [availableContacts, setAvailableContacts] = React.useState<ExistingContactOption[]>([]);
  const [contactComboboxOpen, setContactComboboxOpen] = React.useState(false);
  const [contactQuery, setContactQuery] = React.useState("");
  const [selectedExistingContactId, setSelectedExistingContactId] = React.useState<string>("");
  const [newContactForm, setNewContactForm] = React.useState({
    first_name: "",
    last_name: "",
    email: "",
    phone_business: "",
    job_title: "",
  });
  const [editContactOpen, setEditContactOpen] = React.useState(false);
  const [editingContactId, setEditingContactId] = React.useState<string>("");
  const [isUpdatingContact, setIsUpdatingContact] = React.useState(false);
  const [removingContactId, setRemovingContactId] = React.useState<string | null>(null);
  const [editContactForm, setEditContactForm] = React.useState({
    first_name: "",
    last_name: "",
    email: "",
    phone_business: "",
    job_title: "",
  });

  const [settingPrimaryContactId, setSettingPrimaryContactId] = React.useState<string | null>(null);

  const [addToProjectOpen, setAddToProjectOpen] = React.useState(false);
  const [projects, setProjects] = React.useState<ProjectOption[]>([]);
  const [projectComboboxOpen, setProjectComboboxOpen] = React.useState(false);
  const [projectQuery, setProjectQuery] = React.useState("");
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>("");
  const [confirmProjectAccessImpact, setConfirmProjectAccessImpact] = React.useState(false);
  const [isAddingToProject, setIsAddingToProject] = React.useState(false);
  const associatedProjects = data?.projects ?? [];
  const commitments = data?.commitments ?? [];
  const invoices = data?.invoices ?? [];
  const filteredInvoices = invoiceFilter === "open" ? invoices.filter((item) => isOpenInvoice(item.status)) : invoices;
  const filteredCommitments = React.useMemo(() => {
    const query = commitmentQuery.trim().toLowerCase();
    if (!query) return commitments;
    return commitments.filter((item) => {
      const haystack = [
        item.contract_number,
        item.title,
        item.project_name,
        item.project_number,
        item.scope_summary,
        item.trade_names.join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [commitmentQuery, commitments]);
  const loadDetails = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const payload = await apiFetch<CompanyDetailsResponse>(
        `/api/directory/companies/${companyId}/details`,
        { cache: "no-store" },
      );
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch company details");
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  React.useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  const loadAvailableContacts = React.useCallback(async () => {
    if (!data?.company.id) return;
    const supabase = createClient();
    const { data: people, error: peopleError } = await supabase
      .from("people")
      .select("id, first_name, last_name, email, company_id")
      .order("last_name", { ascending: true })
      .limit(200);

    if (peopleError) {
      toast.error("Failed to load contacts");
      return;
    }

    const options = (people || []).filter((person) => person.company_id !== data.company.id);
    setAvailableContacts(options as ExistingContactOption[]);
  }, [data?.company.id]);

  const loadProjects = React.useCallback(async () => {
    try {
      const payload = await apiFetch<{ data: ProjectOption[] }>(
        "/api/projects?limit=200&archived=false",
        { cache: "no-store" },
      );
      setProjects(payload.data || []);
    } catch (err) {
      toast.error("Failed to load projects");
    }
  }, []);

  const openAddContactModal = React.useCallback(async () => {
    setAddContactOpen(true);
    setContactMode("existing");
    setContactQuery("");
    setContactComboboxOpen(false);
    await loadAvailableContacts();
  }, [loadAvailableContacts]);

  async function handleAddExistingContact() {
    if (!selectedExistingContactId || !data?.company.id) {
      toast.error("Select a contact first");
      return;
    }

    try {
      setIsSavingContact(true);
      const result = await updateContact(selectedExistingContactId, {
        company_id: data.company.id,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      toast.success("Contact added to company");
      setAddContactOpen(false);
      setSelectedExistingContactId("");
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : "Failed to add contact";
      toast.error(message);
      return;
    } finally {
      setIsSavingContact(false);
    }

    // Refresh is best-effort: a failed reload must not look like a failed link.
    await loadDetails();
  }

  async function handleCreateNewContact() {
    if (!data?.company.id) return;
    if (!newContactForm.first_name.trim() || !newContactForm.last_name.trim()) {
      toast.error("First and last name are required");
      return;
    }

    try {
      setIsSavingContact(true);
      const result = await createContact({
        first_name: newContactForm.first_name.trim(),
        last_name: newContactForm.last_name.trim(),
        person_type: "contact",
        email: newContactForm.email.trim() || null,
        phone_business: newContactForm.phone_business.trim() || null,
        job_title: newContactForm.job_title.trim() || null,
        company_id: data.company.id,
        status: "active",
      });

      if (result.error) {
        throw new Error(result.error);
      }

      toast.success("Contact created and linked to company");
      setAddContactOpen(false);
      setNewContactForm({ first_name: "", last_name: "", email: "", phone_business: "", job_title: "" });
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : "Failed to create contact";
      toast.error(message);
      return;
    } finally {
      setIsSavingContact(false);
    }

    // Refresh is best-effort: a failed reload must not look like a failed create.
    await loadDetails();
  }

  function openEditContact(contact: Contact) {
    setEditingContactId(contact.id);
    setEditContactForm({
      first_name: contact.first_name || "",
      last_name: contact.last_name || "",
      email: contact.email || "",
      phone_business: contact.phone_business || contact.phone_mobile || "",
      job_title: contact.job_title || "",
    });
    setEditContactOpen(true);
  }

  async function handleUpdateContact() {
    if (!editingContactId) return;
    if (!editContactForm.first_name.trim() || !editContactForm.last_name.trim()) {
      toast.error("First and last name are required");
      return;
    }

    try {
      setIsUpdatingContact(true);
      const result = await updateContact(editingContactId, {
        first_name: editContactForm.first_name.trim(),
        last_name: editContactForm.last_name.trim(),
        email: editContactForm.email.trim() || null,
        phone_business: editContactForm.phone_business.trim() || null,
        job_title: editContactForm.job_title.trim() || null,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      toast.success("Contact updated");
      setEditContactOpen(false);
      setEditingContactId("");
      await loadDetails();
    } catch (err) {
      toast.error("Failed to update contact");
    } finally {
      setIsUpdatingContact(false);
    }
  }

  async function handleSetPrimaryContact(contactId: string) {
    if (!companyId) return;
    const supabase = createClient();
    setSettingPrimaryContactId(contactId);
    try {
      const { error } = await supabase
        .from("companies")
        .update({ primary_contact_id: contactId })
        .eq("id", companyId);
      if (error) throw error;
      await loadDetails();
      toast.success("Primary contact updated");
    } catch (err) {
      toast.error("Failed to set primary contact");
    } finally {
      setSettingPrimaryContactId(null);
    }
  }

  async function handleRemoveContactFromCompany(contact: Contact) {
    if (!data?.company.id) return;

    const confirmed = await confirm({
      description: `Remove ${contact.first_name || ""} ${contact.last_name || ""} from ${data.company.name}?`,
      confirmLabel: "Remove",
    });
    if (!confirmed) return;

    try {
      setRemovingContactId(contact.id);
      const result = await updateContact(contact.id, {
        company_id: null,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      toast.success("Contact removed from company");
      await loadDetails();
    } catch (err) {
      toast.error("Failed to remove contact from company");
    } finally {
      setRemovingContactId(null);
    }
  }

  async function handleAddCompanyToProject() {
    if (!data?.company.id || !selectedProjectId) {
      toast.error("Select a project first");
      return;
    }
    if (!confirmProjectAccessImpact) {
      toast.error("Confirm the access impact before continuing");
      return;
    }

    try {
      setIsAddingToProject(true);
      await apiFetch(`/api/directory/companies/${data.company.id}/add-to-project`, {
        method: "POST",
        body: JSON.stringify({ project_id: Number(selectedProjectId) }),
      });

      toast.success("Company added to project");
      setAddToProjectOpen(false);
      setSelectedProjectId("");
      setConfirmProjectAccessImpact(false);
      await loadDetails();
    } catch (err) {
      toast.error("Failed to add company to project");
    } finally {
      setIsAddingToProject(false);
    }
  }

  if (isLoading) {
    return (
      <PageShell variant="detail" title="Company Details" description="Loading company information..." onBack={() => router.back()}>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-56 w-full" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </PageShell>
    );
  }

  if (error || !data) {
    return (
      <PageShell variant="detail" title="Company Details" description="Unable to load company details" onBack={() => router.back()}>
        <ErrorState
          error={error ?? "Company not found"}
          onRetry={() => router.push("/directory/companies")}
        />
      </PageShell>
    );
  }

  const { company, contacts, summary } = data;
  const companyLocation = [company.city, company.state].filter(Boolean).join(", ");
  const filteredAvailableContacts = (() => {
    const query = contactQuery.trim().toLowerCase();
    if (!query) return availableContacts;
    return availableContacts.filter((contact) => {
      const fullName = `${contact.first_name} ${contact.last_name}`.toLowerCase();
      const email = (contact.email || "").toLowerCase();
      return fullName.includes(query) || email.includes(query);
    });
  })();
  const filteredProjects = (() => {
    const query = projectQuery.trim().toLowerCase();
    if (!query) return projects;
    return projects.filter((project) => {
      const name = (project.name || "").toLowerCase();
      const number = (project.project_number || "").toLowerCase();
      return name.includes(query) || number.includes(query);
    });
  })();
  const websiteUrl = company.website
    ? company.website.startsWith("http")
      ? company.website
      : `https://${company.website}`
    : null;
  const primaryContact = contacts.find((c) => c.id === company.primary_contact_id) ?? contacts[0] ?? null;
  return (
    <PageShell
      variant="detailWide"
      title={company.name}
      statusBadge={
        company.lifecycle_stage !== "active" ? (
          <StatusBadge status={company.lifecycle_stage} />
        ) : undefined
      }
      onBack={() => router.back()}
      actions={
        company.acumatica_vendor_id ? (
          <a
            href={acumaticaVendorUrl(company.acumatica_vendor_id)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            ERP Linked
            <ArrowRight className="h-3 w-3" />
          </a>
        ) : undefined
      }
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
          <main className="min-w-0">
            <div className="space-y-10">
              <section className="space-y-4">
                <SectionRuleHeading
                  label="Contacts"
                  actions={
                    contacts.length > 0 ? (
                      <SectionAction onClick={() => void openAddContactModal()}>
                        Add contact
                      </SectionAction>
                    ) : undefined
                  }
                />
                {contacts.length === 0 ? (
                  <DsEmptyState
                    title="No contacts yet"
                    description="Add contacts to track people associated with this company."
                    action={<Button size="sm" onClick={() => void openAddContactModal()}>Add contact</Button>}
                  />
                ) : (
                  <ul className="divide-y divide-border">
                    {contacts.map((contact) => {
                      const isPrimary = contact.id === (company.primary_contact_id ?? primaryContact?.id);
                      return (
                        <li key={contact.id} className="group flex items-center gap-2 py-2">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarFallback className="bg-muted text-xs font-medium text-muted-foreground">
                              {getInitials(contact.first_name, contact.last_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            {(() => {
                              const displayName = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.email || "Unknown";
                              const showEmail = contact.email && displayName !== contact.email;
                              return (
                                <>
                                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                                    <Link
                                      href={`/directory/contacts/${contact.id}`}
                                      className="truncate text-sm font-medium text-foreground underline-offset-4 hover:underline"
                                    >
                                      {displayName}
                                    </Link>
                                    {showEmail ? (
                                      <p className="truncate text-xs text-muted-foreground">
                                        {contact.email}
                                      </p>
                                    ) : null}
                                    {isPrimary && (
                                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">Primary</Badge>
                                    )}
                                  </div>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {contact.job_title || "No title"}
                                  </p>
                                </>
                              );
                            })()}
                          </div>
                          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            {!isPrimary && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-muted-foreground"
                                disabled={settingPrimaryContactId === contact.id}
                                onClick={() => void handleSetPrimaryContact(contact.id)}
                              >
                                {settingPrimaryContactId === contact.id ? "Saving..." : "Set primary"}
                              </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  aria-label="Contact actions"
                                  disabled={removingContactId === contact.id}
                                >
                                  <MoreVertical className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onSelect={() => void handleRemoveContactFromCompany(contact)}
                                >
                                  Remove from Company
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <CompanyCrmSections
                companyId={companyId}
                companyName={company.name}
              />

              <section className="space-y-4">
                <SectionRuleHeading
                  label="Projects"
                  actions={
                    associatedProjects.length > 0 ? (
                      <SectionAction
                        onClick={() => {
                          setAddToProjectOpen(true);
                          setProjectQuery("");
                          setProjectComboboxOpen(false);
                          void loadProjects();
                        }}
                      >
                        Add project
                      </SectionAction>
                    ) : undefined
                  }
                />
                {associatedProjects.length === 0 ? (
                  <DsEmptyState
                    title="No projects yet"
                    description="Add this company to a project to get started."
                    action={
                      <Button
                        size="sm"
                        onClick={() => {
                          setAddToProjectOpen(true);
                          setProjectQuery("");
                          setProjectComboboxOpen(false);
                          void loadProjects();
                        }}
                      >
                        Add project
                      </Button>
                    }
                  />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {associatedProjects.map((project) => (
                      <Link
                        key={project.id}
                        href={`/${project.id}/home`}
                        className="group rounded-lg border border-border/50 bg-background hover:border-border transition-colors p-4"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-foreground leading-snug group-hover:underline underline-offset-4">
                            {project.name || `Project ${project.id}`}
                          </p>
                          {project.archived && (
                            <Badge variant="outline" className="shrink-0">Archived</Badge>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge variant={statusVariant(project.company_status)}>
                            {project.company_status || "Unknown"}
                          </Badge>
                          {project.project_number && (
                            <span className="font-mono text-xs text-muted-foreground">#{project.project_number}</span>
                          )}
                          {project.state && (
                            <span className="text-xs text-muted-foreground">{project.state}</span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <SectionRuleHeading label="Commitments" />
                  {commitments.length > 0 && (
                    <ExpandableSearch
                      value={commitmentQuery}
                      onChange={setCommitmentQuery}
                      placeholder="Search scope or trade..."
                      ariaLabel="Search commitments"
                    />
                  )}
                </div>
                {filteredCommitments.length === 0 ? (
                  <DsEmptyState
                    title={commitmentQuery.trim() ? "No matching commitments found" : "No commitments found"}
                    description={
                      commitmentQuery.trim()
                        ? "Try a different trade, scope term, or project."
                        : "Commitments tied to this company will appear here."
                    }
                  />
                ) : (
                  <DsDataTable<CommitmentItem>
                    rows={filteredCommitments}
                    columns={[
                      {
                        key: "commitment",
                        header: "Commitment",
                        primary: true,
                        render: (item) => (
                          <div className="min-w-0 space-y-1">
                            {item.project_id ? (
                              <Link
                                href={`/${item.project_id}/commitments/${item.id}`}
                                className="font-medium text-foreground underline-offset-4 hover:underline"
                              >
                                {[item.contract_number, item.title].filter(Boolean).join(" - ") || "Untitled commitment"}
                              </Link>
                            ) : (
                              <span className="font-medium text-foreground">
                                {[item.contract_number, item.title].filter(Boolean).join(" - ") || "Untitled commitment"}
                              </span>
                            )}
                            {item.scope_summary ? (
                              <p className="line-clamp-2 text-xs text-muted-foreground">{item.scope_summary}</p>
                            ) : null}
                          </div>
                        ),
                      },
                      {
                        key: "trade",
                        header: "Trade / Scope",
                        render: (item) =>
                          item.trade_names.length > 0 ? item.trade_names.join(", ") : "No trade tagged",
                      },
                      {
                        key: "project",
                        header: "Project",
                        render: (item) =>
                          `${item.project_name || "Unknown project"}${item.project_number ? ` (${item.project_number})` : ""}`,
                      },
                      {
                        key: "status",
                        header: "Status",
                        render: (item) => (
                          <Badge variant={statusVariant(item.status)}>{item.status || "Unknown"}</Badge>
                        ),
                      },
                    ]}
                  />
                )}
              </section>

              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <SectionRuleHeading label="Invoices" />
                  <Tabs
                    value={invoiceFilter}
                    onValueChange={(value) => setInvoiceFilter(value as "open" | "all")}
                  >
                    <TabsList className="rounded-full">
                      <TabsTrigger value="open" className="rounded-full">Open</TabsTrigger>
                      <TabsTrigger value="all" className="rounded-full">All</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                {filteredInvoices.length === 0 ? (
                  <DsEmptyState
                    title={invoiceFilter === "open" ? "No open invoices found" : "No invoices found"}
                    description="Invoices from associated projects will appear here."
                  />
                ) : (
                  <DsDataTable<InvoiceItem>
                    rows={filteredInvoices}
                    columns={[
                      {
                        key: "invoice",
                        header: "Invoice",
                        primary: true,
                        render: (invoice) => invoice.invoice_number || `Invoice ${invoice.id}`,
                      },
                      {
                        key: "status",
                        header: "Status",
                        render: (invoice) => (
                          <Badge variant={statusVariant(invoice.status)}>{invoice.status || "Unknown"}</Badge>
                        ),
                      },
                      {
                        key: "contract",
                        header: "Contract",
                        render: (invoice) =>
                          `${invoice.contract_number || invoice.prime_contract_id}: ${invoice.contract_title || "Untitled"}`,
                      },
                      {
                        key: "project",
                        header: "Project",
                        render: (invoice) =>
                          `${invoice.project_name || "Unknown project"} (${invoice.project_number || "-"})`,
                      },
                      {
                        key: "period",
                        header: "Period",
                        align: "right",
                        render: (invoice) =>
                          `${formatDate(invoice.period_start)} to ${formatDate(invoice.period_end)}`,
                      },
                    ]}
                  />
                )}
              </section>

            </div>
          </main>

          <aside className="min-w-0">
            <div className="space-y-6 lg:sticky lg:top-6">
              <section className="rounded-lg bg-muted/25 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Company file</p>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <p className="shrink-0 text-muted-foreground">Status</p>
                    <p className="text-right font-medium text-foreground">{company.status || "—"}</p>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <p className="shrink-0 text-muted-foreground">Type</p>
                    <p className="text-right font-medium text-foreground">{company.type || "—"}</p>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <p className="shrink-0 text-muted-foreground">Vendor ID</p>
                    {company.acumatica_vendor_id ? (
                      <a
                        href={acumaticaVendorUrl(company.acumatica_vendor_id)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-right font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {company.acumatica_vendor_id}
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      </a>
                    ) : (
                      <p className="text-right font-medium text-foreground">—</p>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <p className="shrink-0 text-muted-foreground">License Number</p>
                    <p className="text-right font-medium text-foreground">{company.license_number || "—"}</p>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <p className="shrink-0 text-muted-foreground">Website</p>
                    {websiteUrl ? (
                      <a
                        href={websiteUrl}
                        rel="noreferrer"
                        target="_blank"
                        className="flex min-w-0 items-center gap-1.5 text-right font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        <span className="truncate">{company.website}</span>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      </a>
                    ) : (
                      <p className="text-right font-medium text-foreground">—</p>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <p className="shrink-0 text-muted-foreground">Primary contact</p>
                    {primaryContact ? (
                      <Link
                        href={`/directory/contacts/${primaryContact.id}`}
                        className="truncate text-right text-sm font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {primaryContact.first_name} {primaryContact.last_name}
                      </Link>
                    ) : (
                      <p className="text-right font-medium text-foreground">—</p>
                    )}
                  </div>
                </div>
              </section>

              <EntityAttachments
                entityType="company"
                entityId={companyId}
                projectId="0"
                hideIfEmpty={true}
              />

            </div>
          </aside>
      </div>

      <Modal open={addContactOpen} onOpenChange={setAddContactOpen}>
        <ModalContent className="sm:max-w-xl">
          <ModalHeader>
            <ModalTitle>Add Contact</ModalTitle>
            <ModalDescription>
              Add an existing contact to this company or create a new one.
            </ModalDescription>
          </ModalHeader>

          <Tabs value={contactMode} onValueChange={(value) => setContactMode(value as "existing" | "new")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="existing" className="flex-1">Existing Contact</TabsTrigger>
              <TabsTrigger value="new" className="flex-1">Create New</TabsTrigger>
            </TabsList>

            <TabsContent value="existing" className="space-y-4 pt-2">
              <div className="grid gap-2">
                <Label>Contact</Label>
                <Popover
                  open={contactComboboxOpen}
                  onOpenChange={(open) => {
                    setContactComboboxOpen(open);
                    if (!open) setContactQuery("");
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={contactComboboxOpen}
                      className="w-full justify-between"
                    >
                      {selectedExistingContactId
                        ? (() => {
                            const selected = availableContacts.find((item) => item.id === selectedExistingContactId);
                            if (!selected) return "Select contact";
                            return `${selected.first_name} ${selected.last_name}${selected.email ? ` • ${selected.email}` : ""}`;
                          })()
                        : "Select contact"}
                      <ChevronsUpDown className="shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Type a name or email..."
                        value={contactQuery}
                        onValueChange={setContactQuery}
                      />
                      <CommandList>
                        <CommandEmpty>No matching contacts.</CommandEmpty>
                        <CommandGroup>
                          {filteredAvailableContacts.map((contact) => (
                            <CommandItem
                              key={contact.id}
                              value={contact.id}
                              onSelect={() => {
                                setSelectedExistingContactId(contact.id);
                                setContactComboboxOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedExistingContactId === contact.id ? "opacity-100" : "opacity-0",
                                )}
                              />
                              {contact.first_name} {contact.last_name}
                              {contact.email ? ` • ${contact.email}` : ""}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <ModalFooter>
                <Button variant="outline" onClick={() => setAddContactOpen(false)} disabled={isSavingContact}>
                  Cancel
                </Button>
                <Button onClick={handleAddExistingContact} disabled={isSavingContact}>
                  {isSavingContact ? "Adding..." : "Add Contact"}
                </Button>
              </ModalFooter>
            </TabsContent>

            <TabsContent value="new" className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="new-contact-first">First Name</Label>
                  <Input
                    id="new-contact-first"
                    value={newContactForm.first_name}
                    onChange={(e) => setNewContactForm((prev) => ({ ...prev, first_name: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="new-contact-last">Last Name</Label>
                  <Input
                    id="new-contact-last"
                    value={newContactForm.last_name}
                    onChange={(e) => setNewContactForm((prev) => ({ ...prev, last_name: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-contact-email">Email</Label>
                <Input
                  id="new-contact-email"
                  type="email"
                  value={newContactForm.email}
                  onChange={(e) => setNewContactForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-contact-phone">Phone</Label>
                <Input
                  id="new-contact-phone"
                  value={newContactForm.phone_business}
                  onChange={(e) => setNewContactForm((prev) => ({ ...prev, phone_business: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-contact-title">Job Title</Label>
                <Input
                  id="new-contact-title"
                  value={newContactForm.job_title}
                  onChange={(e) => setNewContactForm((prev) => ({ ...prev, job_title: e.target.value }))}
                />
              </div>
              <ModalFooter>
                <Button variant="outline" onClick={() => setAddContactOpen(false)} disabled={isSavingContact}>
                  Cancel
                </Button>
                <Button onClick={handleCreateNewContact} disabled={isSavingContact}>
                  {isSavingContact ? "Creating..." : "Create Contact"}
                </Button>
              </ModalFooter>
            </TabsContent>
          </Tabs>
        </ModalContent>
      </Modal>

      <Modal open={editContactOpen} onOpenChange={setEditContactOpen}>
        <ModalContent className="sm:max-w-lg">
          <ModalHeader>
            <ModalTitle>Edit Contact</ModalTitle>
            <ModalDescription>Update this company contact information.</ModalDescription>
          </ModalHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-contact-first">First Name</Label>
                <Input
                  id="edit-contact-first"
                  value={editContactForm.first_name}
                  onChange={(e) => setEditContactForm((prev) => ({ ...prev, first_name: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-contact-last">Last Name</Label>
                <Input
                  id="edit-contact-last"
                  value={editContactForm.last_name}
                  onChange={(e) => setEditContactForm((prev) => ({ ...prev, last_name: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-contact-email">Email</Label>
              <Input
                id="edit-contact-email"
                type="email"
                value={editContactForm.email}
                onChange={(e) => setEditContactForm((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-contact-phone">Phone</Label>
              <Input
                id="edit-contact-phone"
                value={editContactForm.phone_business}
                onChange={(e) => setEditContactForm((prev) => ({ ...prev, phone_business: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-contact-title">Job Title</Label>
              <Input
                id="edit-contact-title"
                value={editContactForm.job_title}
                onChange={(e) => setEditContactForm((prev) => ({ ...prev, job_title: e.target.value }))}
              />
            </div>
          </div>
          <ModalFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditContactOpen(false);
                setEditingContactId("");
              }}
              disabled={isUpdatingContact}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateContact} disabled={isUpdatingContact}>
              {isUpdatingContact ? "Saving..." : "Save Contact"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal open={addToProjectOpen} onOpenChange={setAddToProjectOpen}>
        <ModalContent className="sm:max-w-lg">
          <ModalHeader>
            <ModalTitle>Add Company to Project</ModalTitle>
            <ModalDescription>
              Assign this company to a project and grant directory visibility.
            </ModalDescription>
          </ModalHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Project</Label>
              <Popover
                open={projectComboboxOpen}
                onOpenChange={(open) => {
                  setProjectComboboxOpen(open);
                  if (!open) setProjectQuery("");
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={projectComboboxOpen}
                    className="w-full justify-between"
                  >
                    {selectedProjectId
                      ? (() => {
                          const selected = projects.find((item) => String(item.id) === selectedProjectId);
                          if (!selected) return "Select project";
                          return `${selected.project_number ? `${selected.project_number} • ` : ""}${selected.name || `Project ${selected.id}`}`;
                        })()
                      : "Select project"}
                    <ChevronsUpDown className="shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Type project number or name..."
                      value={projectQuery}
                      onValueChange={setProjectQuery}
                    />
                    <CommandList>
                      <CommandEmpty>No matching projects.</CommandEmpty>
                      <CommandGroup>
                        {filteredProjects.map((project) => (
                          <CommandItem
                            key={project.id}
                            value={String(project.id)}
                            onSelect={() => {
                              setSelectedProjectId(String(project.id));
                              setProjectComboboxOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedProjectId === String(project.id) ? "opacity-100" : "opacity-0",
                              )}
                            />
                            {project.project_number ? `${project.project_number} • ` : ""}
                            {project.name || `Project ${project.id}`}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              Adding this company to a project may allow contacts from this company to access project directory information based on project membership and permissions.
            </div>

            <div className="flex items-start gap-2">
              <Checkbox
                id="confirm-project-access"
                checked={confirmProjectAccessImpact}
                onCheckedChange={(checked) => setConfirmProjectAccessImpact(checked === true)}
              />
              <Label htmlFor="confirm-project-access" className="text-sm leading-5">
                I understand this assignment can impact directory visibility and access.
              </Label>
            </div>
          </div>
          <ModalFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddToProjectOpen(false);
                setConfirmProjectAccessImpact(false);
              }}
              disabled={isAddingToProject}
            >
              Cancel
            </Button>
            <Button onClick={handleAddCompanyToProject} disabled={isAddingToProject}>
              {isAddingToProject ? "Adding..." : "Add to Project"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      {ConfirmDialog}
    </PageShell>
  );
}
