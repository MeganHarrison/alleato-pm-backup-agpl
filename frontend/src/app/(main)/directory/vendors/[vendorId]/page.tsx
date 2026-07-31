"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check, Mail, MoreVertical, Phone } from "lucide-react";

import type { Database } from "@/types/database.types";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/format";
import { PageShell } from "@/components/layout";
import { DetailField, DetailFieldGrid, ErrorState, StatusBadge } from "@/components/ds";
import { Button } from "@/components/ui/button";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Vendor = Database["public"]["Tables"]["companies"]["Row"];
type Contact = Database["public"]["Tables"]["people"]["Row"];

function normalizeVendorField(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (
    trimmed === "{}" ||
    trimmed === "[]" ||
    trimmed.toLowerCase() === "null" ||
    trimmed.toLowerCase() === "undefined"
  ) {
    return "";
  }
  return trimmed;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
}

function getContactInitials(contact: Contact): string {
  const first = (contact.first_name ?? "").trim().charAt(0);
  const last = (contact.last_name ?? "").trim().charAt(0);
  const initials = `${first}${last}`.toUpperCase();
  return initials || "?";
}

export default function VendorDetailPage() {
  const router = useRouter();
  const params = useParams()!;
  const vendorId = params.vendorId as string;

  const [vendor, setVendor] = React.useState<Vendor | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [contacts, setContacts] = React.useState<Contact[]>([]);
  const [availableContacts, setAvailableContacts] = React.useState<Contact[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = React.useState(false);

      type CommitmentRow = { id: string; contract_number: string; title: string | null; status: string; project_id: number; projects: { id: number; name: string } | null };
  type DirectCostRow = { id: string; description: string | null; total_amount: number; date: string; invoice_number: string | null; status: string; project_id: number; projects: { id: number; name: string } | null };
  const [commitments, setCommitments] = React.useState<CommitmentRow[]>([]);
  const [vendorDirectCosts, setVendorDirectCosts] = React.useState<DirectCostRow[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = React.useState(false);
  const [addContactComboboxOpen, setAddContactComboboxOpen] = React.useState(false);
  const [addContactModalOpen, setAddContactModalOpen] = React.useState(false);
  const [contactQuery, setContactQuery] = React.useState("");
  const [isUnlinkingContactId, setIsUnlinkingContactId] = React.useState<string | null>(null);
  const [isLinkingContactId, setIsLinkingContactId] = React.useState<string | null>(null);
  const [isSavingContact, setIsSavingContact] = React.useState(false);
  const [newContactForm, setNewContactForm] = React.useState({
    first_name: "",
    last_name: "",
    email: "",
    phone_business: "",
    job_title: "",
  });

  React.useEffect(() => {
    let isActive = true;

    const loadVendor = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const supabase = createClient();
        const { data, error: queryError } = await supabase
          .from("companies")
          .select("*")
          .eq("id", vendorId)
          .single();

        if (queryError) throw queryError;
        if (!isActive) return;
        setVendor(data);
      } catch (err) {
        if (!isActive) return;
        setError(err instanceof Error ? err.message : "Failed to load vendor details");
      } finally {
        if (isActive) setIsLoading(false);
      }
    };

    void loadVendor();

    return () => {
      isActive = false;
    };
  }, [vendorId]);

  const loadContacts = React.useCallback(async (companyId: string) => {
    try {
      setIsLoadingContacts(true);
      const supabase = createClient();
      const { data, error: queryError } = await supabase
        .from("people")
        .select("*")
        .eq("company_id", companyId)
        .order("last_name", { ascending: true })
        .order("first_name", { ascending: true });

      if (queryError) throw queryError;
      setContacts(data ?? []);
    } catch {
      setContacts([]);
    } finally {
      setIsLoadingContacts(false);
    }
  }, []);

  const loadAvailableContacts = React.useCallback(async (_companyId: string) => {
    try {
      const supabase = createClient();
      const { data, error: queryError } = await supabase
        .from("people")
        .select("*")
        .order("last_name", { ascending: true })
        .order("first_name", { ascending: true });

      if (queryError) throw queryError;
      setAvailableContacts(data ?? []);
    } catch {
      setAvailableContacts([]);
    }
  }, []);

  React.useEffect(() => {
    if (!vendor?.id) {
      setContacts([]);
      setAvailableContacts([]);
      return;
    }
    void loadContacts(vendor.id);
    void loadAvailableContacts(vendor.id);
  }, [loadAvailableContacts, loadContacts, vendor?.id]);

  React.useEffect(() => {
    if (!vendor) return;
    let isActive = true;
    const load = async () => {
      setIsLoadingProjects(true);
      try {
        const supabase = createClient();
        const [{ data: subs }, { data: costs }] = await Promise.all([
          vendor.id
            ? supabase
                .from("subcontracts")
                .select("id, contract_number, title, status, project_id, projects(id, name)")
                .eq("contract_company_id", vendor.id)
                .order("created_at", { ascending: false })
            : Promise.resolve({ data: [] }),
          supabase
            .from("direct_costs")
            .select("id, description, total_amount, date, invoice_number, status, project_id, projects(id, name)")
            .eq("vendor_id", vendorId)
            .order("date", { ascending: false })
            .limit(20),
        ]);
        if (!isActive) return;
        setCommitments((subs ?? []) as CommitmentRow[]);
        setVendorDirectCosts((costs ?? []) as DirectCostRow[]);
      } finally {
        if (isActive) setIsLoadingProjects(false);
      }
    };
    void load();
    return () => { isActive = false; };
  }, [vendor, vendorId]);

  if (isLoading) {
    return (
      <PageShell
        variant="detail"
        title="Vendor Details"
        description="Loading vendor information..."
        onBack={() => router.push("/directory/vendors")}
      >
        <div className="space-y-6">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      </PageShell>
    );
  }

  if (error || !vendor) {
    return (
      <PageShell
        variant="detail"
        title="Vendor Details"
        description="Unable to load vendor details"
        onBack={() => router.push("/directory/vendors")}
      >
        <ErrorState
          error={error ?? "Vendor not found"}
          onRetry={() => router.push("/directory/vendors")}
        />
      </PageShell>
    );
  }

  const email = normalizeVendorField(vendor.contact_email);
  const phone = normalizeVendorField(vendor.contact_phone);
  const contactName = normalizeVendorField(vendor.contact_name);
  const location = [vendor.city, vendor.state, vendor.zip_code].filter(Boolean).join(", ");
  const handleCreateContact = async () => {
    if (!vendor.id) return;
    if (!newContactForm.first_name.trim() || !newContactForm.last_name.trim()) return;

    try {
      setIsSavingContact(true);
      const supabase = createClient();
      const { error: insertError } = await supabase.from("people").insert({
        first_name: newContactForm.first_name.trim(),
        last_name: newContactForm.last_name.trim(),
        email: newContactForm.email.trim() || null,
        phone_business: newContactForm.phone_business.trim() || null,
        job_title: newContactForm.job_title.trim() || null,
        person_type: "contact",
        status: "active",
        company_id: vendor.id,
      });

      if (insertError) throw insertError;

      setAddContactModalOpen(false);
      setNewContactForm({
        first_name: "",
        last_name: "",
        email: "",
        phone_business: "",
        job_title: "",
      });
      await loadContacts(vendor.id);
      await loadAvailableContacts(vendor.id);
    } finally {
      setIsSavingContact(false);
    }
  };

  const handleAddExistingContact = async (contactId: string) => {
    if (!vendor.id) return;
    try {
      setIsLinkingContactId(contactId);
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("people")
        .update({ company_id: vendor.id })
        .eq("id", contactId);

      if (updateError) throw updateError;
      await loadContacts(vendor.id);
      await loadAvailableContacts(vendor.id);
      setAddContactComboboxOpen(false);
      setContactQuery("");
    } finally {
      setIsLinkingContactId(null);
    }
  };

  const handleRemoveContact = async (contactId: string) => {
    if (!vendor.id) return;
    try {
      setIsUnlinkingContactId(contactId);
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("people")
        .update({ company_id: null })
        .eq("id", contactId)
        .eq("company_id", vendor.id);

      if (updateError) throw updateError;
      await loadContacts(vendor.id);
      await loadAvailableContacts(vendor.id);
    } finally {
      setIsUnlinkingContactId(null);
    }
  };

  const filteredAvailableContacts = (() => {
    const term = contactQuery.trim().toLowerCase();
    if (!term) return availableContacts;
    return availableContacts.filter((contact) => {
      const fullName = `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.toLowerCase();
      const emailValue = (contact.email ?? "").toLowerCase();
      return fullName.includes(term) || emailValue.includes(term);
    });
  })();

  return (
    <PageShell
      variant="detailWide"
      title={vendor.name}
      description={location || normalizeVendorField(vendor.legal_name) || "Vendor details"}
      onBack={() => router.push("/directory/vendors")}
      actions={
        <Link
          href={`/directory/vendors?detail=${vendor.id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Directory
        </Link>
      }
    >
      <div className="space-y-10">
        <section className="space-y-8">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={vendor.status?.toLowerCase() === "active" ? "Active" : "Inactive"} />
            </div>
          </div>

          {(contactName || phone || email) && (
            <div className="space-y-3 border-b border-border pb-8">
              {/* eslint-disable-next-line design-system/no-raw-heading */}
              <h3 className="text-sm font-semibold text-foreground">Primary Contact</h3>
              <div className="space-y-2">
                {contactName ? <p className="text-sm font-medium">{contactName}</p> : null}
                {phone ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{phone}</span>
                  </div>
                ) : null}
                {email ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <a href={`mailto:${email}`} className="text-primary hover:underline break-all">
                      {email}
                    </a>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          <DetailFieldGrid columns={2}>
            <DetailField label="Legal Name" value={normalizeVendorField(vendor.legal_name)} />
            <DetailField
              label="Customer ID"
              value={normalizeVendorField(vendor.customer_id)}
            />
            <DetailField label="Payment Method" value={normalizeVendorField(vendor.payment_method)} />
            <DetailField label="Terms" value={normalizeVendorField(vendor.terms)} />
            <DetailField label="Tax ID" value={normalizeVendorField(vendor.tax_id)} />
            <DetailField label="1099 Vendor" value={vendor.is_1099_vendor ? "Yes" : "No"} />
            <DetailField label="Address" value={normalizeVendorField(vendor.address)} />
            <DetailField label="City" value={normalizeVendorField(vendor.city)} />
            <DetailField label="State" value={normalizeVendorField(vendor.state)} />
            <DetailField label="Zip Code" value={normalizeVendorField(vendor.zip_code)} />
            <DetailField label="Created" value={formatDate(vendor.created_at)} />
            <DetailField label="Updated" value={formatDate(vendor.updated_at)} />
          </DetailFieldGrid>

          {normalizeVendorField(vendor.notes) ? (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{normalizeVendorField(vendor.notes)}</p>
            </div>
          ) : null}

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              {/* eslint-disable-next-line design-system/no-raw-heading */}
              <h3 className="text-sm font-semibold text-foreground">Company Contacts</h3>
              <Popover
                open={addContactComboboxOpen}
                onOpenChange={(open) => {
                  setAddContactComboboxOpen(open);
                  if (!open) setContactQuery("");
                }}
              >
                <PopoverTrigger asChild>
                  <Button variant="link" className="h-auto p-0 text-sm font-medium">
                    Add contact
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-96 p-0" align="end">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Search contacts by name or email..."
                      value={contactQuery}
                      onValueChange={setContactQuery}
                    />
                    <CommandList>
                      <CommandEmpty>
                        <div className="px-2 py-3 text-sm text-muted-foreground">
                          No matching contacts.
                          <Button
                            variant="link"
                            className="ml-1 h-auto p-0 text-sm"
                            onClick={() => {
                              setAddContactComboboxOpen(false);
                              setAddContactModalOpen(true);
                            }}
                          >
                            Add new contact
                          </Button>
                        </div>
                      </CommandEmpty>
                      <CommandGroup>
                        {filteredAvailableContacts.map((contact) => (
                          <CommandItem
                            key={contact.id}
                            value={contact.id}
                            onSelect={() => void handleAddExistingContact(contact.id)}
                            disabled={isLinkingContactId === contact.id}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                isLinkingContactId === contact.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            {contact.first_name} {contact.last_name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                  <div className="border-t px-3 py-2">
                    <Button
                      variant="link"
                      className="h-auto p-0 text-sm"
                      onClick={() => {
                        setAddContactComboboxOpen(false);
                        setAddContactModalOpen(true);
                      }}
                    >
                      Add new contact
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            {isLoadingContacts ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No contacts linked to this company.</p>
            ) : (
              <div className="space-y-2">
                {contacts.map((contact) => (
                  <div key={contact.id} className="flex items-center justify-between gap-3 py-2">
                    <Link href={`/directory/contacts/${contact.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar size="lg">
                        <AvatarFallback className="bg-primary/10 text-primary">{getContactInitials(contact)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 space-y-0.5">
                        <div className="truncate text-sm font-medium text-foreground">
                          {contact.first_name} {contact.last_name}
                        </div>
                        <div className="truncate text-sm text-muted-foreground">
                          {contact.email || contact.phone_business || contact.phone_mobile || "No contact info"}
                        </div>
                      </div>
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          aria-label={`Contact actions for ${contact.first_name} ${contact.last_name}`}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          disabled={isUnlinkingContactId === contact.id}
                          onClick={() => void handleRemoveContact(contact.id)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}
          </section>
          {/* Projects & Activity */}
          <section className="space-y-6">
            {/* eslint-disable-next-line design-system/no-raw-heading */}
            <h3 className="text-sm font-semibold text-foreground">Projects & Activity</h3>

            {isLoadingProjects ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <>
                {/* Commitments */}
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Commitments ({commitments.length})
                  </p>
                  {commitments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No commitments found.</p>
                  ) : (
                    <div className="divide-y divide-border rounded-md border border-border overflow-hidden">
                      {commitments.map((c) => (
                        <Link
                          key={c.id}
                          href={`/${c.project_id}/commitments/${c.id}`}
                          className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors"
                        >
                          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-muted-foreground">
                            SC
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block truncate text-sm">{c.title ?? c.contract_number}</span>
                            <span className="text-xs text-muted-foreground">{c.projects?.name ?? `Project ${c.project_id}`}</span>
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <StatusBadge status={c.status} />
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* Direct Costs / Invoices */}
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Invoices & Direct Costs ({vendorDirectCosts.length})
                  </p>
                  {vendorDirectCosts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No direct costs or invoices found.</p>
                  ) : (
                    <div className="divide-y divide-border rounded-md border border-border overflow-hidden">
                      {vendorDirectCosts.map((dc) => (
                        <Link
                          key={dc.id}
                          href={`/${dc.project_id}/direct-costs/${dc.id}`}
                          className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <span className="block truncate text-sm">{dc.description ?? dc.invoice_number ?? "Direct Cost"}</span>
                            <span className="text-xs text-muted-foreground">
                              {dc.projects?.name ?? `Project ${dc.project_id}`}
                              {dc.date ? ` · ${new Date(dc.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {formatCurrency(dc.total_amount)}
                            </span>
                            <StatusBadge status={dc.status} />
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </section>
      </div>

      <Modal open={addContactModalOpen} onOpenChange={setAddContactModalOpen}>
        <ModalContent className="sm:max-w-lg">
          <ModalHeader>
            <ModalTitle>Add Contact</ModalTitle>
            <ModalDescription>Create a company contact for this vendor.</ModalDescription>
          </ModalHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="vendor-contact-first-name">First Name</Label>
                <Input
                  id="vendor-contact-first-name"
                  value={newContactForm.first_name}
                  onChange={(e) =>
                    setNewContactForm((prev) => ({ ...prev, first_name: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="vendor-contact-last-name">Last Name</Label>
                <Input
                  id="vendor-contact-last-name"
                  value={newContactForm.last_name}
                  onChange={(e) =>
                    setNewContactForm((prev) => ({ ...prev, last_name: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vendor-contact-email">Email</Label>
              <Input
                id="vendor-contact-email"
                type="email"
                value={newContactForm.email}
                onChange={(e) =>
                  setNewContactForm((prev) => ({ ...prev, email: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vendor-contact-phone">Phone</Label>
              <Input
                id="vendor-contact-phone"
                value={newContactForm.phone_business}
                onChange={(e) =>
                  setNewContactForm((prev) => ({ ...prev, phone_business: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vendor-contact-job-title">Job Title</Label>
              <Input
                id="vendor-contact-job-title"
                value={newContactForm.job_title}
                onChange={(e) =>
                  setNewContactForm((prev) => ({ ...prev, job_title: e.target.value }))
                }
              />
            </div>
          </div>
          <ModalFooter>
            <Button
              variant="outline"
              onClick={() => setAddContactModalOpen(false)}
              disabled={isSavingContact}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleCreateContact()}
              disabled={
                isSavingContact ||
                !newContactForm.first_name.trim() ||
                !newContactForm.last_name.trim()
              }
            >
              {isSavingContact ? "Creating..." : "Create Contact"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </PageShell>
  );
}
