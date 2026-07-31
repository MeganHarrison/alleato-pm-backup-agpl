"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { AutocompleteField, MoneyField, FileUploadField } from "@/components/forms";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Eyebrow } from "@/components/ds";
import { useRouter } from "next/navigation";
import type { Database } from "@/types/database.types";
import { useCompanies } from "@/hooks/use-companies";
import {
  STAGE_OPTIONS,
  PHASE_OPTIONS,
  WORK_SCOPE_OPTIONS,
  PROJECT_SECTOR_OPTIONS,
  DELIVERY_METHOD_OPTIONS,
  PROJECT_TYPE_OPTIONS,
  TIMEZONE_OPTIONS,
  COUNTRY_OPTIONS,
  REGION_OPTIONS,
  OFFICE_OPTIONS,
  US_STATE_OPTIONS,
} from "@/lib/create-project/form";

type Project = Database["public"]["Tables"]["projects"]["Row"];

const CLEAR_SELECT_VALUE = "__CLEAR_OPTION__";

interface EditProjectSidebarProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormData {
  name: string;
  job_number: string;
  stage: string;
  phase: string;
  company_id: string;
  project_type: string;
  work_scope: string;
  project_sector: string;
  delivery_method: string;
  description: string;
  square_footage: string;
  total_value: string;
  office: string;
  country: string;
  street_address: string;
  city: string;
  state: string;
  postal_code: string;
  timezone: string;
  phone: string;
  region: string;
  start_date: string;
  completion_date: string;
  active: boolean;
  erp_sync: boolean;
  test_project: boolean;
}

function getMetadata(project: Project): Record<string, unknown> {
  const m = project.summary_metadata;
  if (m && typeof m === "object" && !Array.isArray(m)) return m as Record<string, unknown>;
  return {};
}

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return "";
}

function initForm(project: Project): FormData {
  const m = getMetadata(project);
  return {
    name: project.name || "",
    job_number: project["job number"] || project.project_number || "",
    stage: project.stage || "",
    phase: project.phase || "",
    company_id: project.company_id || "",
    project_type: project.type || project.category || "",
    work_scope: project.work_scope || "",
    project_sector: project.project_sector || "",
    delivery_method: project.delivery_method || "",
    description: project.summary || "",
    square_footage: str(m.square_footage),
    total_value: project["est revenue"] != null ? String(project["est revenue"]) : "",
    office: str(m.office),
    country: str(m.country) || "United States",
    street_address: project.address || "",
    city: str(m.city),
    state: project.state || "",
    postal_code: str(m.postal_code),
    timezone: str(m.timezone) || "America/New_York",
    phone: str(m.phone),
    region: str(m.region),
    start_date: project["start date"] || "",
    completion_date: project["est completion"] || "",
    active: !project.archived,
    erp_sync: typeof m.erp_sync === "boolean" ? m.erp_sync : true,
    test_project: typeof m.test_project === "boolean" ? m.test_project : false,
  };
}

function parseNum(v: string): number | null {
  if (!v.trim()) return null;
  const n = Number(v.replace(/[$,]/g, ""));
  return Number.isNaN(n) ? null : n;
}

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  allowClear = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  allowClear?: boolean;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-xs text-muted-foreground mb-1.5 inline-block">
        {label}
      </Label>
      <Select
        value={value || undefined}
        onValueChange={(v) => {
          if (allowClear && v === CLEAR_SELECT_VALUE) {
            onChange("");
            return;
          }
          onChange(v);
        }}
      >
        <SelectTrigger id={id} className="h-9 w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {allowClear && (
            <SelectItem value={CLEAR_SELECT_VALUE} className="text-muted-foreground">
              Clear
            </SelectItem>
          )}
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-xs text-muted-foreground mb-1.5 inline-block">
        {label}{required && " *"}
      </Label>
      <Input
        id={id}
        className="h-9 w-full"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
      />
    </div>
  );
}

export function EditProjectSidebar({ project, open, onOpenChange }: EditProjectSidebarProps) {
  const [form, setForm] = React.useState<FormData>(initForm(project));
  const [saving, setSaving] = React.useState(false);
  const [logoFile, setLogoFile] = React.useState<File | null>(null);
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const [companySearch, setCompanySearch] = React.useState("");
  const router = useRouter();
  const {
    options: companyOptions,
    isLoading: isLoadingCompanies,
    error: companiesError,
  } = useCompanies({
    enabled: open,
    search: companySearch,
  });

  React.useEffect(() => {
    if (open) {
      setForm(initForm(project));
      setLogoFile(null);
      setPhotoFile(null);
      setCompanySearch("");
    }
  }, [open, project]);

  const selectedClientValue = form.company_id || undefined;

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const existingMeta = getMetadata(project);
      const payload = {
        name: form.name,
        "job number": form.job_number || null,
        company_id: form.company_id || null,
        stage: form.stage || null,
        phase: form.phase || null,
        category: form.project_type || null,
        type: form.project_type || null,
        summary: form.description || null,
        address: form.street_address || null,
        state: form.state || null,
        archived: !form.active,
        "start date": form.start_date || null,
        "est completion": form.completion_date || null,
        "est revenue": parseNum(form.total_value),
        work_scope: form.work_scope || null,
        project_sector: form.project_sector || null,
        delivery_method: form.delivery_method || null,
        summary_metadata: {
          ...existingMeta,
          square_footage: parseNum(form.square_footage),
          project_logo: logoFile ? logoFile.name : (existingMeta.project_logo ?? null),
          project_photo: photoFile ? photoFile.name : (existingMeta.project_photo ?? null),
          city: form.city || null,
          postal_code: form.postal_code || null,
          country: form.country || null,
          timezone: form.timezone || null,
          phone: form.phone || null,
          region: form.region || null,
          office: form.office || null,
          erp_sync: form.erp_sync,
          test_project: form.test_project,
        },
      };

      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to update project");

      toast.success("Project updated");
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Failed to update project");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <form onSubmit={handleSubmit}>
          <div className="space-y-6 px-6 pt-6">
            <SheetHeader className="px-0 pt-0 pb-2">
              <SheetTitle className="text-xl font-semibold text-left">Edit Project</SheetTitle>
            </SheetHeader>

            {/* General Information */}
            <section className="space-y-3">
              <Eyebrow className="text-primary">
                General Information
              </Eyebrow>
              <div className="grid grid-cols-2 gap-3">
                <TextField id="edit-name" label="Project Name" value={form.name} onChange={(v) => set("name", v)} required />
                <TextField id="edit-job" label="Job Number" value={form.job_number} onChange={(v) => set("job_number", v)} required />
                <SelectField
                  id="edit-stage"
                  label="Status"
                  value={form.stage}
                  onChange={(v) => set("stage", v)}
                  options={STAGE_OPTIONS.map((v) => ({ value: v, label: v }))}
                  placeholder="Select stage"
                  allowClear
                />
                <SelectField
                  id="edit-phase"
                  label="Phase"
                  value={form.phase}
                  onChange={(v) => set("phase", v)}
                  options={PHASE_OPTIONS.map((v) => ({ value: v, label: v }))}
                  placeholder="Select phase"
                  allowClear
                />
                <AutocompleteField
                  label="Client"
                  options={companyOptions}
                  value={selectedClientValue}
                  onValueChange={(value) => {
                    set("company_id", value ?? "");
                  }}
                  placeholder={isLoadingCompanies ? "Loading companies..." : "Select client"}
                  searchPlaceholder="Search companies..."
                  emptyMessage={
                    companiesError
                      ? `Could not load companies: ${companiesError.message}`
                      : "No companies found"
                  }
                  loading={isLoadingCompanies}
                  onSearch={setCompanySearch}
                  clearable
                />
                <SelectField
                  id="edit-type"
                  label="Type"
                  value={form.project_type}
                  onChange={(v) => set("project_type", v)}
                  options={PROJECT_TYPE_OPTIONS.map((v) => ({ value: v, label: v }))}
                  placeholder="Select type"
                  allowClear
                />
                <SelectField
                  id="edit-scope"
                  label="Work Scope"
                  value={form.work_scope}
                  onChange={(v) => set("work_scope", v)}
                  options={WORK_SCOPE_OPTIONS.map((v) => ({ value: v, label: v }))}
                  placeholder="Select scope"
                  allowClear
                />
                <SelectField
                  id="edit-sector"
                  label="Project Sector"
                  value={form.project_sector}
                  onChange={(v) => set("project_sector", v)}
                  options={PROJECT_SECTOR_OPTIONS.map((v) => ({ value: v, label: v }))}
                  placeholder="Select sector"
                  allowClear
                />
                <SelectField
                  id="edit-delivery"
                  label="Delivery Method"
                  value={form.delivery_method}
                  onChange={(v) => set("delivery_method", v)}
                  options={DELIVERY_METHOD_OPTIONS.map((v) => ({ value: v, label: v }))}
                  placeholder="Select method"
                  allowClear
                />
              </div>
              <div>
                <Label htmlFor="edit-desc" className="text-xs text-muted-foreground mb-1.5 inline-block">
                  Description
                </Label>
                <Textarea
                  id="edit-desc"
                  className="min-h-20"
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                />
              </div>
            </section>

            {/* Project Metrics */}
            <section className="space-y-3">
              <Eyebrow className="text-primary">
                Project Metrics
              </Eyebrow>
              <div className="grid grid-cols-2 gap-3">
                <TextField id="edit-sqft" label="Square Footage" value={form.square_footage} onChange={(v) => set("square_footage", v)} type="number" />
                <MoneyField
                  id="edit-value"
                  label="Total Value"
                  value={parseNum(form.total_value) ?? undefined}
                  onChange={(value) => set("total_value", value !== undefined ? String(value) : "")}
                />
              </div>
            </section>

            {/* Logo */}
            <section className="space-y-3">
              <Eyebrow className="text-primary">
                Logo
              </Eyebrow>
              <div className="grid grid-cols-2 gap-3">
                <FileUploadField
                  label="Project Logo"
                  accept=".jpg,.jpeg,.png,.tif,.tiff,.bmp"
                  hint="Square image recommended"
                  onFilesSelected={(files) => setLogoFile(files[0] ?? null)}
                  value={
                    logoFile
                      ? [{ name: logoFile.name, size: logoFile.size, type: logoFile.type }]
                      : getMetadata(project).project_logo
                        ? [{ name: String(getMetadata(project).project_logo), size: 0, type: "image/*" }]
                        : []
                  }
                  variant="minimal"
                  showMetaText={false}
                />
                <FileUploadField
                  label="Project Photo"
                  accept=".jpg,.jpeg,.png,.tif,.tiff,.bmp"
                  hint="Landscape image recommended"
                  onFilesSelected={(files) => setPhotoFile(files[0] ?? null)}
                  value={
                    photoFile
                      ? [{ name: photoFile.name, size: photoFile.size, type: photoFile.type }]
                      : getMetadata(project).project_photo
                        ? [{ name: String(getMetadata(project).project_photo), size: 0, type: "image/*" }]
                        : []
                  }
                  variant="minimal"
                  showMetaText={false}
                />
              </div>
            </section>

            {/* Location */}
            <section className="space-y-3">
              <Eyebrow className="text-primary">
                Location
              </Eyebrow>
              <div className="grid grid-cols-2 gap-3">
                <SelectField
                  id="edit-office"
                  label="Office"
                  value={form.office}
                  onChange={(v) => set("office", v)}
                  options={OFFICE_OPTIONS}
                  placeholder="Select office"
                  allowClear
                />
                <SelectField
                  id="edit-country"
                  label="Country"
                  value={form.country}
                  onChange={(v) => set("country", v)}
                  options={COUNTRY_OPTIONS}
                  placeholder="Select country"
                />
                <div className="col-span-2">
                  <TextField id="edit-street" label="Street Address" value={form.street_address} onChange={(v) => set("street_address", v)} />
                </div>
                <TextField id="edit-city" label="City" value={form.city} onChange={(v) => set("city", v)} />
                <SelectField
                  id="edit-state"
                  label="State"
                  value={form.state}
                  onChange={(v) => set("state", v)}
                  options={US_STATE_OPTIONS}
                  placeholder="Select state"
                  allowClear
                />
                <TextField id="edit-zip" label="Zip Code" value={form.postal_code} onChange={(v) => set("postal_code", v)} />
                <SelectField
                  id="edit-tz"
                  label="Timezone"
                  value={form.timezone}
                  onChange={(v) => set("timezone", v)}
                  options={TIMEZONE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                  placeholder="Select timezone"
                />
                <TextField id="edit-phone" label="Phone" value={form.phone} onChange={(v) => set("phone", v)} type="tel" />
                <SelectField
                  id="edit-region"
                  label="Region"
                  value={form.region}
                  onChange={(v) => set("region", v)}
                  options={REGION_OPTIONS}
                  placeholder="Select region"
                  allowClear
                />
              </div>
            </section>

            {/* Dates */}
            <section className="space-y-3">
              <Eyebrow className="text-primary">
                Dates
              </Eyebrow>
              <div className="grid grid-cols-2 gap-3">
                <TextField id="edit-start" label="Start Date" value={form.start_date} onChange={(v) => set("start_date", v)} type="date" />
                <TextField id="edit-end" label="Completion Date" value={form.completion_date} onChange={(v) => set("completion_date", v)} type="date" />
              </div>
            </section>

            {/* Status & Flags */}
            <section className="space-y-3">
              <Eyebrow className="text-primary">
                Status & Flags
              </Eyebrow>
              <div className="space-y-2.5">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <Checkbox checked={form.active} onCheckedChange={(c) => set("active", Boolean(c))} />
                  <span className="text-sm text-foreground">Active</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <Checkbox checked={form.erp_sync} onCheckedChange={(c) => set("erp_sync", Boolean(c))} />
                  <span className="text-sm text-foreground">ERP Sync</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <Checkbox checked={form.test_project} onCheckedChange={(c) => set("test_project", Boolean(c))} />
                  <span className="text-sm text-foreground">Test Project</span>
                </label>
              </div>
            </section>
          </div>

          <SheetFooter className="px-6 pb-6">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
