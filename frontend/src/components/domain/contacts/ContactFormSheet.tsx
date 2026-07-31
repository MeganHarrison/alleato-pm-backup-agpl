"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  SidePanel,
  SidePanelBody,
  SidePanelContent,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelTitle,
} from "@/components/ui/side-panel";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import {
  contactSchema,
  type ContactFormData,
} from "@/lib/schemas/contact-schema";
import {
  createContact,
  updateContact,
} from "@/app/(main)/actions/table-actions";
import { createClient } from "@/lib/supabase/client";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Contact {
  id: string | number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  person_type: "user" | "contact" | "employee" | null;
  company_id: string | null;
  job_title: string | null;
  type: string | null;
  address: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  linkedin: string | null;
  avatar: string | null;
  notes: string | null;
}

interface Company {
  id: string;
  name: string;
}

interface ContactFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact | null;
  /** Called after successful create/edit (no args). */
  onSuccess?: () => void;
  /** Pre-select a company when opening the sheet (e.g. from a commitment form). */
  defaultCompanyId?: string;
  /** Called with the newly-created contact before the sheet closes. Use for side effects like vendor linking. */
  onContactCreated?: (contact: { id: string }) => Promise<void>;
}

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];

const FORM_ID = "contact-form-sheet";

export function ContactFormSheet({
  open,
  onOpenChange,
  contact,
  onSuccess,
  defaultCompanyId,
  onContactCreated,
}: ContactFormSheetProps) {
  const isEdit = !!contact;
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [companies, setCompanies] = React.useState<Company[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = React.useState(false);
  const [companyPopoverOpen, setCompanyPopoverOpen] = React.useState(false);

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    reValidateMode: "onBlur",
    defaultValues: {
      first_name: contact?.first_name || "",
      last_name: contact?.last_name || "",
      email: contact?.email || "",
      phone: contact?.phone || "",
      person_type: contact?.person_type || "contact",
      company_id: contact?.company_id || defaultCompanyId || "",
      job_title: contact?.job_title || "",
      type: contact?.type || "",
      address: contact?.address || "",
      address_line2: contact?.address_line2 || "",
      city: contact?.city || "",
      state: contact?.state || "",
      zip: contact?.zip || "",
      linkedin: contact?.linkedin || "",
      avatar: contact?.avatar || "",
      notes: contact?.notes || "",
    },
  });

  const fetchCompanies = React.useCallback(async () => {
    setIsLoadingCompanies(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("companies")
        .select("id, name")
        .order("name", { ascending: true });
      if (error) throw error;
      setCompanies(data || []);
    } catch {
      toast.error("Failed to load companies");
    } finally {
      setIsLoadingCompanies(false);
    }
  }, []);

  React.useEffect(() => {
    if (open) {
      fetchCompanies();
      form.reset({
        first_name: contact?.first_name || "",
        last_name: contact?.last_name || "",
        email: contact?.email || "",
        phone: contact?.phone || "",
        person_type: contact?.person_type || "contact",
        company_id: contact?.company_id || defaultCompanyId || "",
        job_title: contact?.job_title || "",
        type: contact?.type || "",
        address: contact?.address || "",
        address_line2: contact?.address_line2 || "",
        city: contact?.city || "",
        state: contact?.state || "",
        zip: contact?.zip || "",
        linkedin: contact?.linkedin || "",
        avatar: contact?.avatar || "",
        notes: contact?.notes || "",
      });
    }
  }, [open, contact, defaultCompanyId, form, fetchCompanies]);

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    try {
      const cleanData = {
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email || null,
        phone_mobile: data.phone || null,
        person_type: data.person_type,
        company_id:
          data.company_id && data.company_id.trim() !== ""
            ? data.company_id
            : null,
        job_title: data.job_title || null,
        business_unit: data.type || null,
        address_line1: data.address || null,
        address_line2: data.address_line2 || null,
        city: data.city || null,
        state: data.state || null,
        zip: data.zip || null,
        linkedin: data.linkedin || null,
        profile_photo_url: data.avatar || null,
        notes: data.notes || null,
      };

      let result: { error?: string; success?: boolean; data?: { id: string } | null };
      if (isEdit && contact) {
        const updateResult = await updateContact(contact.id.toString(), cleanData);
        result = { error: updateResult.error, success: updateResult.success };
      } else {
        result = await createContact(cleanData);
      }

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (!isEdit && onContactCreated && result.data?.id) {
        await onContactCreated({ id: result.data.id });
      }

      toast.success(
        isEdit ? "Contact updated successfully" : "Contact created successfully",
      );
      onOpenChange(false);
      onSuccess?.();
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SidePanel open={open} onOpenChange={onOpenChange}>
      <SidePanelContent side="right" size="md">
          <SidePanelHeader>
            <SidePanelTitle>{isEdit ? "Edit Contact" : "New Contact"}</SidePanelTitle>
          </SidePanelHeader>

          <SidePanelBody>
            <Form {...form}>
              <form
                id={FORM_ID}
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4 pb-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="first_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter first name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="last_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter last name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="email@example.com"
                            type="email"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="(555) 123-4567"
                            type="tel"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="person_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Person Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select person type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="contact">contact</SelectItem>
                            <SelectItem value="employee">employee</SelectItem>
                            <SelectItem value="user">user</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="company_id"
                  render={({ field }) => {
                    const selectedCompany = companies.find((c) => c.id === field.value);
                    return (
                      <FormItem>
                        <FormLabel>Company</FormLabel>
                        <Popover open={companyPopoverOpen} onOpenChange={setCompanyPopoverOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                disabled={isLoadingCompanies}
                                className={cn(
                                  "w-full justify-between font-normal",
                                  !field.value && "text-muted-foreground",
                                )}
                              >
                                {isLoadingCompanies
                                  ? "Loading companies..."
                                  : selectedCompany?.name ?? "Select company"}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent
                            className="p-0"
                            align="start"
                            style={{ width: "var(--radix-popover-trigger-width)" }}
                          >
                            <Command>
                              <CommandInput placeholder="Search companies..." />
                              <CommandList>
                                <CommandEmpty>No companies found.</CommandEmpty>
                                <CommandGroup>
                                  <CommandItem
                                    value="__none"
                                    onSelect={() => { field.onChange(""); setCompanyPopoverOpen(false); }}
                                  >
                                    <Check className={cn("mr-2 h-4 w-4", !field.value ? "opacity-100" : "opacity-0")} />
                                    No Company
                                  </CommandItem>
                                  {companies.map((company) => (
                                    <CommandItem
                                      key={company.id}
                                      value={company.name}
                                      onSelect={() => { field.onChange(company.id); setCompanyPopoverOpen(false); }}
                                    >
                                      <Check className={cn("mr-2 h-4 w-4", field.value === company.id ? "opacity-100" : "opacity-0")} />
                                      {company.name}
                                    </CommandItem>
                                  ))}
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
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="job_title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Job Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Project Manager" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {!isEdit && (
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter type" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address Line 1</FormLabel>
                      <FormControl>
                        <Input placeholder="Street address" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address_line2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address Line 2</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Suite, unit, floor, etc."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="City" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value || ""}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="State" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {US_STATES.map((state) => (
                              <SelectItem key={state} value={state}>
                                {state}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="zip"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ZIP</FormLabel>
                        <FormControl>
                          <Input placeholder="12345" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="linkedin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>LinkedIn</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://linkedin.com/in/..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="avatar"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Avatar URL</FormLabel>
                        <FormControl>
                          <Input placeholder="https://..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Additional notes about this contact..."
                          className="resize-none"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </SidePanelBody>

          <SidePanelFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form={FORM_ID}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "Saving..."
                : isEdit
                  ? "Save"
                  : "Create Contact"}
            </Button>
          </SidePanelFooter>
        </SidePanelContent>
      </SidePanel>
  );
}
