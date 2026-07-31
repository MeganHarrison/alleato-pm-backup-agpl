"use client";

import * as React from "react";
import { Check, ChevronsUpDown, UserPlus, X } from "lucide-react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ContactFormSheet } from "@/components/domain/contacts/ContactFormSheet";
import { LinkExistingContactSheet } from "@/components/domain/contacts/LinkExistingContactSheet";
import { FormSection } from "@/components/forms";
import type { CreateSubcontractInput } from "@/lib/schemas/create-subcontract-schema";

interface InvoiceContactsSectionProps {
  isSubmitting: boolean;
  invoiceContactOptions: Array<{ value: string; label: string }>;
  isLoadingContacts: boolean;
  vendorId?: string | null;
  vendorCompanyId?: string | null;
  refetchContacts?: () => Promise<void>;
}

export function InvoiceContactsSection({
  isSubmitting,
  invoiceContactOptions,
  isLoadingContacts,
  vendorId,
  vendorCompanyId,
  refetchContacts,
}: InvoiceContactsSectionProps) {
  const { control, setValue, getValues } = useFormContext<CreateSubcontractInput>();
  const contractCompanyId = useWatch({ control, name: "contractCompanyId" });
  const selectedContactIds = useWatch({ control, name: "invoiceContactIds" }) || [];
  const [open, setOpen] = React.useState(false);
  const [extraLabels, setExtraLabels] = React.useState<Record<string, string>>({});
  const [showLinkExistingSheet, setShowLinkExistingSheet] = React.useState(false);
  const [showContactSheet, setShowContactSheet] = React.useState(false);

  // Resolve labels for selected contacts that aren't in the current vendor's options
  // (e.g. contacts saved before the contract company changed).
  React.useEffect(() => {
    const optionIds = new Set(invoiceContactOptions.map((o) => o.value));
    const missing = selectedContactIds.filter(
      (id: string) => !optionIds.has(id) && !extraLabels[id],
    );
    if (missing.length === 0) return;
    const supabase = createClient();
    void supabase
      .from("people")
      .select("id, first_name, last_name, email")
      .in("id", missing)
      .then(({ data }) => {
        if (!data) return;
        setExtraLabels((prev) => {
          const next = { ...prev };
          for (const person of data as Array<{ id: string; first_name: string | null; last_name: string | null; email: string | null }>) {
            const name = `${person.first_name || ""} ${person.last_name || ""}`.trim();
            next[person.id] = name || person.email || "Unknown contact";
          }
          return next;
        });
      });
  }, [selectedContactIds, invoiceContactOptions, extraLabels]);

  const handleContactCreated = async (created: { id: string }) => {
    const vendorCompanyLinkId = vendorCompanyId || vendorId;
    if (vendorCompanyLinkId) {
      const supabase = createClient();
      const { error: linkError } = await supabase
        .from("vendor_contacts")
        .insert({ company_id: vendorCompanyLinkId, person_id: created.id });
      if (linkError) console.error("Failed to link contact to vendor:", linkError.message);
    }
    await refetchContacts?.();
    const current = getValues("invoiceContactIds") || [];
    setValue("invoiceContactIds", [...current, created.id]);
  };

  const handleContactLinked = async (personId: string) => {
    await refetchContacts?.();
    const current = getValues("invoiceContactIds") || [];
    if (!current.includes(personId)) {
      setValue("invoiceContactIds", [...current, personId]);
    }
  };

  return (
    <FormSection
      title="Invoice Contacts"
      description="This person will be added to the contract and will be the point of contact and signer for subcontractor invoices."
    >
      <div>
        {(
          <Controller
            name="invoiceContactIds"
            control={control}
            render={({ field }) => {
              const value = field.value || [];
              const handleSelect = (optionValue: string) => {
                const next = value.includes(optionValue)
                  ? value.filter((v: string) => v !== optionValue)
                  : [...value, optionValue];
                field.onChange(next);
              };
              const selectedItems = value
                .map((v: string) => ({
                  id: v,
                  label:
                    invoiceContactOptions.find((o) => o.value === v)?.label ||
                    extraLabels[v] ||
                    "…",
                }));
              const removeContact = (id: string) =>
                field.onChange(value.filter((v: string) => v !== id));

              return (
                <>
                  <FormItem className="flex flex-col">
                    <FormLabel>Invoice Contacts</FormLabel>
                    <Popover open={open} onOpenChange={setOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={open}
                          className={cn(
                            "h-11 w-full justify-between",
                            value.length === 0 && "text-muted-foreground",
                          )}
                          disabled={isSubmitting || isLoadingContacts}
                          {...(value.length === 0 && { "data-placeholder-style": "" })}
                        >
                          <div className="flex flex-wrap gap-1">
                            {value.length > 0
                              ? selectedItems.map((item) => (
                                  <Badge key={item.id} variant="secondary" className="mr-1 gap-1 pr-1">
                                    {item.label}
                                    <span
                                      role="button"
                                      tabIndex={0}
                                      aria-label={`Remove ${item.label}`}
                                      className="flex h-4 w-4 items-center justify-center rounded-sm hover:bg-muted-foreground/20"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        removeContact(item.id);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          removeContact(item.id);
                                        }
                                      }}
                                    >
                                      <X className="h-3 w-3" />
                                    </span>
                                  </Badge>
                                ))
                              : isLoadingContacts
                                ? "Loading contacts..."
                                : invoiceContactOptions.length === 0
                                  ? "No contacts found — add one below"
                                  : "Select contacts who can submit invoices..."}
                          </div>
                          <ChevronsUpDown className="shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
                        <Command>
                          <CommandInput placeholder="Search contacts..." />
                          <CommandList className="max-h-72">
                            <CommandEmpty>No contacts found.</CommandEmpty>
                            <CommandGroup>
                              {invoiceContactOptions.map((option) => (
                                <CommandItem
                                  key={option.value}
                                  value={[option.label, option.value].join(" ")}
                                  className="min-h-11"
                                  onSelect={() => handleSelect(option.value)}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      value.includes(option.value) ? "opacity-100" : "opacity-0",
                                    )}
                                  />
                                  {option.label}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                            {vendorId && (
                              <>
                                <CommandSeparator />
                                <CommandGroup>
                                  <CommandItem
                                    className="min-h-11"
                                    onSelect={() => {
                                      setOpen(false);
                                      setShowLinkExistingSheet(true);
                                    }}
                                  >
                                    <UserPlus className="mr-2 h-4 w-4" />
                                    Add existing contact
                                  </CommandItem>
                                  <CommandItem
                                    className="min-h-11"
                                    onSelect={() => {
                                      setOpen(false);
                                      setShowContactSheet(true);
                                    }}
                                  >
                                    <UserPlus className="mr-2 h-4 w-4" />
                                    Create new contact
                                  </CommandItem>
                                </CommandGroup>
                              </>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>

                  <LinkExistingContactSheet
                    open={showLinkExistingSheet}
                    onOpenChange={setShowLinkExistingSheet}
                    vendorId={vendorCompanyId || vendorId || ""}
                    excludeContactIds={selectedContactIds}
                    onContactLinked={handleContactLinked}
                  />

                  <ContactFormSheet
                    open={showContactSheet}
                    onOpenChange={setShowContactSheet}
                    defaultCompanyId={vendorCompanyId ?? undefined}
                    onContactCreated={handleContactCreated}
                  />
                </>
              );
            }}
          />
        )}
      </div>
      {/* contractCompanyId watched but no longer gates rendering */}
    </FormSection>
  );
}
