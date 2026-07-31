"use client";
import {
  ContentSectionStack,
  PageShell,
  SectionRuleHeading,
} from "@/components/layout";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ds";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowRight,
  Camera,
  Check,
  ChevronsUpDown,
  Mail,
  MoreVertical,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database.types";
import { updateContact } from "@/app/(main)/actions/table-actions";
import { ContactFormSheet } from "@/components/domain/contacts/ContactFormSheet";

type Contact = Database["public"]["Tables"]["people"]["Row"];
type Company = Database["public"]["Tables"]["companies"]["Row"];
type Membership = Database["public"]["Tables"]["project_directory_memberships"]["Row"];
type PermissionTemplate = Database["public"]["Tables"]["permission_templates"]["Row"];
type Project = Database["public"]["Tables"]["projects"]["Row"];
type ContactUpdateData = Database["public"]["Tables"]["people"]["Update"];

interface ContactWithRelations extends Omit<Contact, "company"> {
  company?: Company | null;
  memberships?: (Membership & {
    project?: Project | null;
    permission_template?: PermissionTemplate | null;
  })[];
}

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];

// ─── Inline edit primitives ────────────────────────────────────────────────

interface InlineTextProps {
  label: string;
  value: string | null | undefined;
  onSave: (val: string | null) => Promise<void>;
  type?: "text" | "email" | "tel" | "url";
  placeholder?: string;
  href?: string;
}

function InlineTextField({
  label,
  value,
  onSave,
  type = "text",
  placeholder,
  href,
}: InlineTextProps) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value ?? "");
  const [saving, setSaving] = React.useState(false);

  const commit = async () => {
    const next = draft.trim() || null;
    if (next === (value || null)) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(next);
    } catch {
      toast.error("Failed to save");
      setDraft(value ?? "");
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center py-2 gap-4 border-b border-border/20">
        <p className="w-36 shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </p>
        <Input
          autoFocus
          type={type}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void commit();
            }
            if (e.key === "Escape") {
              setEditing(false);
              setDraft(value ?? "");
            }
          }}
          placeholder={placeholder}
          className="flex-1 h-7 text-sm"
          disabled={saving}
        />
      </div>
    );
  }

  return (
    <div
      className="group flex items-center py-2 gap-4 border-b border-border/20 cursor-pointer hover:bg-muted/30 -mx-2 px-2 rounded"
      onClick={() => {
        setDraft(value ?? "");
        setEditing(true);
      }}
    >
      <p className="w-36 shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
        {value ? (
          href ? (
            <a
              href={href}
              target={href.startsWith("http") ? "_blank" : undefined}
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline inline-flex items-center gap-1 truncate"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="truncate">{value}</span>
              {href.startsWith("http") && (
                <ArrowRight className="h-2.5 w-2.5 flex-shrink-0 opacity-60" />
              )}
            </a>
          ) : (
            <p className="text-sm text-foreground truncate">{value}</p>
          )
        ) : (
          <p className="text-sm text-muted-foreground/40 italic">{placeholder}</p>
        )}
        <Pencil className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-40 flex-shrink-0 transition-opacity" />
      </div>
    </div>
  );
}

interface InlineTextareaProps {
  label: string;
  value: string | null | undefined;
  onSave: (val: string | null) => Promise<void>;
  placeholder?: string;
}

function InlineTextareaField({
  label,
  value,
  onSave,
  placeholder,
}: InlineTextareaProps) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value ?? "");
  const [saving, setSaving] = React.useState(false);

  const commit = async () => {
    const next = draft.trim() || null;
    if (next === (value || null)) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(next);
    } catch {
      toast.error("Failed to save");
      setDraft(value ?? "");
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-start py-2 gap-4 border-b border-border/20">
        <p className="w-36 shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground pt-1.5">
          {label}
        </p>
        <div className="flex-1">
          <Textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setEditing(false);
                setDraft(value ?? "");
              }
            }}
            placeholder={placeholder}
            className="text-sm min-h-20 resize-none"
            disabled={saving}
          />
          <div className="flex gap-2 mt-2">
            <Button
              size="sm"
              onClick={commit}
              disabled={saving}
              className="h-7 text-xs px-3"
            >
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setDraft(value ?? "");
              }}
              className="h-7 text-xs"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group flex items-start py-2 gap-4 border-b border-border/20 cursor-pointer hover:bg-muted/30 -mx-2 px-2 rounded"
      onClick={() => {
        setDraft(value ?? "");
        setEditing(true);
      }}
    >
      <p className="w-36 shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground pt-0.5">
        {label}
      </p>
      <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
        {value ? (
          <p className="text-sm text-foreground whitespace-pre-wrap">{value}</p>
        ) : (
          <p className="text-sm text-muted-foreground/40 italic">{placeholder}</p>
        )}
        <Pencil className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-40 flex-shrink-0 transition-opacity mt-0.5" />
      </div>
    </div>
  );
}

interface InlineSelectProps {
  label: string;
  value: string | null | undefined;
  onSave: (val: string | null) => Promise<void>;
  options: { value: string; label: string }[];
  placeholder?: string;
}

function InlineSelectField({
  label,
  value,
  onSave,
  options,
  placeholder,
}: InlineSelectProps) {
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const commit = async (val: string) => {
    setEditing(false);
    if ((val || null) === (value || null)) return;
    setSaving(true);
    try {
      await onSave(val || null);
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const displayLabel = options.find((o) => o.value === value)?.label;

  if (editing) {
    return (
      <div className="flex items-center py-2 gap-4 border-b border-border/20">
        <p className="w-36 shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </p>
        <Select
          defaultOpen
          value={value ?? ""}
          onValueChange={commit}
          onOpenChange={(open) => {
            if (!open) setEditing(false);
          }}
          disabled={saving}
        >
          <SelectTrigger className="flex-1 h-7 text-sm">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div
      className="group flex items-center py-2 gap-4 border-b border-border/20 cursor-pointer hover:bg-muted/30 -mx-2 px-2 rounded"
      onClick={() => setEditing(true)}
    >
      <p className="w-36 shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
        {displayLabel ?? value ? (
          <p className="text-sm text-foreground capitalize">
            {displayLabel ?? value}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground/40 italic">{placeholder}</p>
        )}
        <Pencil className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-40 flex-shrink-0 transition-opacity" />
      </div>
    </div>
  );
}

interface InlineCompanyProps {
  label: string;
  company: Company | null | undefined;
  onSave: (companyId: string | null) => Promise<void>;
}

function InlineCompanyField({ label, company, onSave }: InlineCompanyProps) {
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const [companies, setCompanies] = React.useState<
    Pick<Company, "id" | "name">[]
  >([]);

  React.useEffect(() => {
    if (!editing) return;
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("companies")
        .select("id, name")
        .order("name");
      setCompanies(data ?? []);
      setPopoverOpen(true);
    };
    void load();
  }, [editing]);

  const commit = async (id: string) => {
    const next = id || null;
    setPopoverOpen(false);
    setEditing(false);
    if (next === (company?.id ?? null)) return;
    setSaving(true);
    try {
      await onSave(next);
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center py-2 gap-4 border-b border-border/20">
        <p className="w-36 shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </p>
        <Popover
          open={popoverOpen}
          onOpenChange={(open) => {
            setPopoverOpen(open);
            if (!open) setEditing(false);
          }}
        >
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className="flex-1 justify-between h-7 text-sm font-normal"
              disabled={saving}
            >
              {saving ? "Saving…" : (company?.name ?? "Select company")}
              <ChevronsUpDown className="ml-2 h-3 w-3 opacity-50 flex-shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-64" align="start">
            <Command>
              <CommandInput placeholder="Search companies…" />
              <CommandList>
                <CommandEmpty>No companies found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem value="__none" onSelect={() => commit("")}>
                    <Check
                      className={cn(
                        "mr-2 h-3 w-3",
                        !company ? "opacity-100" : "opacity-0",
                      )}
                    />
                    No company
                  </CommandItem>
                  {companies.map((c) => (
                    <CommandItem
                      key={c.id}
                      value={c.name}
                      onSelect={() => commit(c.id)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-3 w-3",
                          company?.id === c.id ? "opacity-100" : "opacity-0",
                        )}
                      />
                      {c.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <div
      className="group flex items-center py-2 gap-4 border-b border-border/20 cursor-pointer hover:bg-muted/30 -mx-2 px-2 rounded"
      onClick={() => setEditing(true)}
    >
      <p className="w-36 shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
        {company ? (
          <Link
            href={`/directory/companies/${company.id}`}
            className="text-sm text-primary hover:underline truncate"
            onClick={(e) => e.stopPropagation()}
          >
            {company.name}
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground/40 italic">No company</p>
        )}
        <Pencil className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-40 flex-shrink-0 transition-opacity" />
      </div>
    </div>
  );
}

// ─── Hero inline fields (centered, for the profile header) ──────────────────

interface HeroNameFieldProps {
  firstName: string | null | undefined;
  lastName: string | null | undefined;
  onSave: (first: string, last: string) => Promise<void>;
}

function HeroNameField({ firstName, lastName, onSave }: HeroNameFieldProps) {
  const [editing, setEditing] = React.useState(false);
  const [draftFirst, setDraftFirst] = React.useState(firstName ?? "");
  const [draftLast, setDraftLast] = React.useState(lastName ?? "");
  const [saving, setSaving] = React.useState(false);

  const fullName =
    `${firstName ?? ""} ${lastName ?? ""}`.trim() || "Unnamed Contact";

  const commit = async () => {
    const f = draftFirst.trim();
    const l = draftLast.trim();
    if (f === (firstName ?? "") && l === (lastName ?? "")) {
      setEditing(false);
      return;
    }
    if (!f) {
      toast.error("First name is required");
      return;
    }
    setSaving(true);
    try {
      await onSave(f, l);
    } catch {
      toast.error("Failed to save");
      setDraftFirst(firstName ?? "");
      setDraftLast(lastName ?? "");
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <div className="flex flex-col items-center gap-1.5 w-full max-w-xs">
        <div className="flex gap-2 w-full">
          <Input
            autoFocus
            value={draftFirst}
            onChange={(e) => setDraftFirst(e.target.value)}
            placeholder="First name"
            className="text-center text-base font-semibold"
            disabled={saving}
            onKeyDown={(e) => {
              if (e.key === "Enter") void commit();
              if (e.key === "Escape") {
                setEditing(false);
                setDraftFirst(firstName ?? "");
                setDraftLast(lastName ?? "");
              }
            }}
          />
          <Input
            value={draftLast}
            onChange={(e) => setDraftLast(e.target.value)}
            placeholder="Last name"
            className="text-center text-base font-semibold"
            disabled={saving}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") void commit();
              if (e.key === "Escape") {
                setEditing(false);
                setDraftFirst(firstName ?? "");
                setDraftLast(lastName ?? "");
              }
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      className="group h-auto px-2 py-0.5 gap-1.5 hover:bg-transparent hover:opacity-80 transition-opacity"
      onClick={() => {
        setDraftFirst(firstName ?? "");
        setDraftLast(lastName ?? "");
        setEditing(true);
      }}
    >
      <span className="text-xl font-semibold text-foreground">{fullName}</span>
      <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-50 transition-opacity" />
    </Button>
  );
}

interface HeroTextFieldProps {
  value: string | null | undefined;
  placeholder: string;
  onSave: (val: string | null) => Promise<void>;
  className?: string;
}

function HeroTextField({
  value,
  placeholder,
  onSave,
  className,
}: HeroTextFieldProps) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value ?? "");
  const [saving, setSaving] = React.useState(false);

  const commit = async () => {
    const next = draft.trim() || null;
    if (next === (value || null)) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(next);
    } catch {
      toast.error("Failed to save");
      setDraft(value ?? "");
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") void commit();
          if (e.key === "Escape") {
            setEditing(false);
            setDraft(value ?? "");
          }
        }}
        placeholder={placeholder}
        className={cn("text-center text-sm max-w-48", className)}
        disabled={saving}
      />
    );
  }

  return (
    <Button
      variant="ghost"
      className={cn(
        "group h-auto px-1.5 py-0.5 gap-1 hover:bg-transparent hover:opacity-70 transition-opacity",
        className,
      )}
      onClick={() => {
        setDraft(value ?? "");
        setEditing(true);
      }}
    >
      {value ? (
        <span className="text-sm text-muted-foreground">{value}</span>
      ) : (
        <span className="text-sm text-muted-foreground/30 italic">
          {placeholder}
        </span>
      )}
      <Pencil className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-50 transition-opacity" />
    </Button>
  );
}

interface HeroCompanyFieldProps {
  company: Company | null | undefined;
  onSave: (companyId: string | null) => Promise<void>;
}

function HeroCompanyField({ company, onSave }: HeroCompanyFieldProps) {
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const [companies, setCompanies] = React.useState<
    Pick<Company, "id" | "name">[]
  >([]);

  React.useEffect(() => {
    if (!editing) return;
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("companies")
        .select("id, name")
        .order("name");
      setCompanies(data ?? []);
      setPopoverOpen(true);
    };
    void load();
  }, [editing]);

  const commit = async (id: string) => {
    const next = id || null;
    setPopoverOpen(false);
    setEditing(false);
    if (next === (company?.id ?? null)) return;
    setSaving(true);
    try {
      await onSave(next);
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <Popover
        open={popoverOpen}
        onOpenChange={(open) => {
          setPopoverOpen(open);
          if (!open) setEditing(false);
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs font-normal max-w-48"
            disabled={saving}
          >
            {saving ? "Saving…" : (company?.name ?? "Select company")}
            <ChevronsUpDown className="ml-1.5 h-3 w-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-64" align="center">
          <Command>
            <CommandInput placeholder="Search companies…" />
            <CommandList>
              <CommandEmpty>No companies found.</CommandEmpty>
              <CommandGroup>
                <CommandItem value="__none" onSelect={() => commit("")}>
                  <Check
                    className={cn(
                      "mr-2 h-3 w-3",
                      !company ? "opacity-100" : "opacity-0",
                    )}
                  />
                  No company
                </CommandItem>
                {companies.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={c.name}
                    onSelect={() => commit(c.id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-3 w-3",
                        company?.id === c.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {c.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Button
      variant="ghost"
      className="group h-auto px-1.5 py-0.5 gap-1 hover:bg-transparent hover:opacity-70 transition-opacity"
      onClick={() => setEditing(true)}
    >
      {company ? (
        <span className="text-sm text-muted-foreground">{company.name}</span>
      ) : (
        <span className="text-sm text-muted-foreground/30 italic">
          No company
        </span>
      )}
      <Pencil className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-50 transition-opacity" />
    </Button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function ContactDetailsPage() {
  const params = useParams()! ?? {};
  const router = useRouter();
  const contactId = params.contactId as string;
  const avatarInputRef = React.useRef<HTMLInputElement>(null);

  const [contact, setContact] = React.useState<ContactWithRelations | null>(
    null,
  );
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const [editSheetOpen, setEditSheetOpen] = React.useState(false);
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      setError(null);
      const supabase = createClient();

      const { data: contactData, error: contactError } = await supabase
        .from("people")
        .select("*")
        .eq("id", contactId)
        .single();
      if (contactError) throw contactError;

      let company: Company | null = null;
      if (contactData.company_id) {
        const { data } = await supabase
          .from("companies")
          .select("*")
          .eq("id", contactData.company_id)
          .single();
        company = data;
      }

      const { data: memberships, error: membershipError } = await supabase
        .from("project_directory_memberships")
        .select(
          "*, project:projects(*), permission_template:permission_templates(*)",
        )
        .eq("person_id", contactId)
        .order("created_at", { ascending: false });
      if (membershipError) throw membershipError;

      setContact({
        ...contactData,
        company,
        memberships: memberships ?? [],
      });
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [contactId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const save = React.useCallback(
    async (fields: ContactUpdateData) => {
      const result = await updateContact(contactId, fields);
      if (result?.error) throw new Error(result.error);
      await load();
    },
    [contactId, load],
  );

  const handleAvatarUpload = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploadingAvatar(true);
      try {
        const supabase = createClient();
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `contacts/${contactId}/avatar.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("profile-images")
          .upload(path, file, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage
          .from("profile-images")
          .getPublicUrl(path);
        await save({ profile_photo_url: urlData.publicUrl });
        toast.success("Photo updated");
      } catch {
        toast.error("Upload failed");
      } finally {
        setUploadingAvatar(false);
        if (avatarInputRef.current) avatarInputRef.current.value = "";
      }
    },
    [contactId, save],
  );

  if (isLoading) {
    return (
      <PageShell
        variant="content"
        title="Contact"
        onBack={() => router.push("/directory/contacts")}
      >
        <div className="space-y-10 pt-4">
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="h-20 w-20 rounded-full" />
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-28" />
          </div>
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
      </PageShell>
    );
  }

  if (error || !contact) {
    return (
      <PageShell
        variant="content"
        onBack={() => router.push("/directory/contacts")}
        title="Contact Not Found"
      >
        <div className="text-center py-16">
          <p className="text-sm text-muted-foreground mb-4">
            {error?.message ?? "Contact not found"}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/directory/contacts")}
          >
            Back to Contacts
          </Button>
        </div>
      </PageShell>
    );
  }

  const fullName =
    `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() ||
    "Unnamed Contact";
  const initials = fullName
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const activeCount =
    contact.memberships?.filter((m) => m.status === "active").length ?? 0;

  return (
    <PageShell
      variant="content"
      title={fullName}
      onBack={() => router.push("/directory/contacts")}
      actions={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">More actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {contact.email && (
              <>
                <DropdownMenuItem asChild>
                  <a href={`mailto:${contact.email}`}>
                    <Mail className="mr-2 h-3.5 w-3.5" />
                    Send Email
                  </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={() => setEditSheetOpen(true)}>
              <Pencil className="mr-2 h-3.5 w-3.5" />
              Edit Contact
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      <ContentSectionStack className="pt-2">
        {/* ── Profile hero ─────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-2 py-4">
          {/* Avatar with upload */}
          <div className="relative group/avatar">
            <Button
              variant="ghost"
              className="relative h-auto w-auto p-0 rounded-full overflow-hidden focus-visible:ring-2 focus-visible:ring-ring hover:bg-transparent"
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              aria-label="Change profile photo"
            >
              {contact.profile_photo_url ? (
                <img
                  src={contact.profile_photo_url}
                  alt={fullName}
                  className="h-20 w-20 rounded-full object-cover bg-muted"
                />
              ) : (
                <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-xl font-medium text-muted-foreground">
                    {initials}
                  </span>
                </div>
              )}
              <div className="absolute inset-0 rounded-full bg-foreground/40 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                {uploadingAvatar ? (
                  <div className="h-4 w-4 rounded-full border-2 border-background border-t-transparent animate-spin" />
                ) : (
                  <Camera className="h-5 w-5 text-background" />
                )}
              </div>
            </Button>
            <Input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleAvatarUpload}
            />
          </div>

          {/* Name */}
          <HeroNameField
            firstName={contact.first_name}
            lastName={contact.last_name}
            onSave={(first, last) =>
              save({ first_name: first, last_name: last })
            }
          />

          {/* Job title */}
          <HeroTextField
            value={contact.job_title}
            placeholder="Add job title"
            onSave={(val) => save({ job_title: val })}
          />

          {/* Company */}
          <HeroCompanyField
            company={contact.company}
            onSave={(val) => save({ company_id: val })}
          />
        </div>

        {/* ── Contact ──────────────────────────────────────────── */}
        <div>
          <SectionRuleHeading label="Contact" />
          <InlineTextField
            label="First Name"
            value={contact.first_name}
            placeholder="First name"
            onSave={(val) => save({ first_name: val ?? "" })}
          />
          <InlineTextField
            label="Last Name"
            value={contact.last_name}
            placeholder="Last name"
            onSave={(val) => save({ last_name: val ?? "" })}
          />
          <InlineCompanyField
            label="Company"
            company={contact.company}
            onSave={(val) => save({ company_id: val })}
          />
          <InlineTextField
            label="Job Title"
            value={contact.job_title}
            placeholder="Project Manager"
            onSave={(val) => save({ job_title: val })}
          />
          <InlineTextField
            label="Phone"
            value={contact.phone_mobile ?? contact.phone_business}
            type="tel"
            href={
              (contact.phone_mobile ?? contact.phone_business)
                ? `tel:${contact.phone_mobile ?? contact.phone_business}`
                : undefined
            }
            placeholder="(555) 123-4567"
            onSave={(val) =>
              save({ phone_mobile: val, phone_business: val })
            }
          />
          <InlineTextField
            label="Email"
            value={contact.email}
            type="email"
            href={contact.email ? `mailto:${contact.email}` : undefined}
            placeholder="email@example.com"
            onSave={(val) => save({ email: val })}
          />
          <InlineSelectField
            label="Person Type"
            value={contact.person_type}
            options={[
              { value: "contact", label: "Contact" },
              { value: "employee", label: "Employee" },
              { value: "user", label: "User" },
            ]}
            placeholder="Select type"
            onSave={(val) =>
              save({
                person_type:
                  (val as "contact" | "employee" | "user") ?? undefined,
              })
            }
          />
          <InlineTextField
            label="Department"
            value={contact.business_unit}
            placeholder="e.g. Operations"
            onSave={(val) => save({ business_unit: val })}
          />
        </div>

        {/* ── Address ──────────────────────────────────────────── */}
        <div>
          <SectionRuleHeading label="Address" />
          <InlineTextField
            label="Street"
            value={contact.address_line1}
            placeholder="123 Main St"
            onSave={(val) => save({ address_line1: val })}
          />
          <InlineTextField
            label="Suite / Unit"
            value={contact.address_line2}
            placeholder="Suite 100"
            onSave={(val) => save({ address_line2: val })}
          />
          <InlineTextField
            label="City"
            value={contact.city}
            placeholder="City"
            onSave={(val) => save({ city: val })}
          />
          <InlineSelectField
            label="State"
            value={contact.state}
            options={US_STATES.map((s) => ({ value: s, label: s }))}
            placeholder="Select state"
            onSave={(val) => save({ state: val })}
          />
          <InlineTextField
            label="ZIP"
            value={contact.zip}
            placeholder="12345"
            onSave={(val) => save({ zip: val })}
          />
        </div>

        {/* ── Social ───────────────────────────────────────────── */}
        <div>
          <SectionRuleHeading label="Social" />
          <InlineTextField
            label="LinkedIn"
            value={contact.linkedin}
            type="url"
            href={contact.linkedin ?? undefined}
            placeholder="https://linkedin.com/in/…"
            onSave={(val) => save({ linkedin: val })}
          />
          <InlineTextField
            label="Facebook"
            value={contact.facebook}
            type="url"
            href={contact.facebook ?? undefined}
            placeholder="https://facebook.com/…"
            onSave={(val) => save({ facebook: val })}
          />
          <InlineTextField
            label="X"
            value={contact.x_handle}
            type="url"
            href={contact.x_handle ?? undefined}
            placeholder="https://x.com/…"
            onSave={(val) => save({ x_handle: val })}
          />
        </div>

        {/* ── Notes ────────────────────────────────────────────── */}
        <div>
          <SectionRuleHeading label="Notes" />
          <InlineTextareaField
            label="Notes"
            value={contact.notes}
            placeholder="Add notes about this contact…"
            onSave={(val) => save({ notes: val })}
          />
        </div>

        {/* ── Projects ─────────────────────────────────────────── */}
        <div>
          <SectionRuleHeading
            label={`Projects${activeCount > 0 ? ` · ${activeCount} active` : ""}`}
          />
          {contact.memberships && contact.memberships.length > 0 ? (
            <div className="divide-y divide-border/20">
              {contact.memberships.map((m) => (
                <div
                  key={m.id}
                  className="py-3 flex items-start justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {m.project?.name ?? "Unknown Project"}
                    </p>
                    {m.permission_template && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {m.permission_template.name}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {m.role && (
                      <span className="text-xs text-muted-foreground">
                        {m.role}
                      </span>
                    )}
                    <span
                      className={cn(
                        "text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full",
                        m.status === "active"
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {m.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No project access"
              description="This contact has not been assigned to any projects yet."
            />
          )}
        </div>
      </ContentSectionStack>

      <ContactFormSheet
        open={editSheetOpen}
        onOpenChange={setEditSheetOpen}
        contact={{
          id: contact.id,
          first_name: contact.first_name,
          last_name: contact.last_name,
          email: contact.email,
          phone: contact.phone_mobile ?? contact.phone_business,
          person_type:
            contact.person_type as "user" | "contact" | "employee" | null,
          company_id: contact.company_id,
          job_title: contact.job_title,
          type: contact.business_unit,
          address: contact.address_line1,
          address_line2: contact.address_line2,
          city: contact.city,
          state: contact.state,
          zip: contact.zip,
          linkedin: contact.linkedin,
          avatar: contact.profile_photo_url,
          notes: contact.notes,
        }}
        onSuccess={() => {
          void load();
        }}
      />
    </PageShell>
  );
}
