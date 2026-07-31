"use client";
/* eslint-disable design-system/no-raw-heading */

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Project } from "@/types/portfolio";

const CLEAR_SELECT_VALUE = "__CLEAR_OPTION__";
const ACCEPTED_IMAGE_TYPES = ".jpg,.jpeg,.png,.tif,.tiff,.bmp";

const STAGE_OPTIONS = [
  "Bidding",
  "Course of Construction",
  "Post-Construction",
  "Pre-Construction",
  "Speculative",
  "Warranty",
];

const PHASE_OPTIONS = [
  "Planning",
  "Estimating",
  "Current",
  "Complete",
  "Loss",
  "Archive",
];

const WORK_SCOPE_OPTIONS = [
  "Ground-Up Construction",
  "Renovation",
  "Tenant Improvement",
  "Interior Build-Out",
  "Maintenance",
];

const PROJECT_SECTOR_OPTIONS = [
  "Commercial",
  "Industrial",
  "Infrastructure",
  "Healthcare",
  "Institutional",
  "Residential",
];

const DELIVERY_METHOD_OPTIONS = [
  "Design-Bid-Build",
  "Design-Build",
  "Construction Management at Risk",
  "Integrated Project Delivery",
];

const PROJECT_TYPE_OPTIONS = [
  "New Build",
  "Addition",
  "Fit-Out",
  "Maintenance",
  "Restoration",
];

const TIMEZONE_OPTIONS = [
  { label: "Eastern Time (ET)", value: "America/New_York" },
  { label: "Central Time (CT)", value: "America/Chicago" },
  { label: "Mountain Time (MT)", value: "America/Denver" },
  { label: "Pacific Time (PT)", value: "America/Los_Angeles" },
  { label: "Alaska Time (AKT)", value: "America/Anchorage" },
  { label: "Hawaii Time (HST)", value: "Pacific/Honolulu" },
];

const COUNTRY_OPTIONS = [
  { value: "United States", label: "United States" },
  { value: "Canada", label: "Canada" },
  { value: "Mexico", label: "Mexico" },
];

const REGION_OPTIONS = [
  { value: "Northeast", label: "Northeast" },
  { value: "Southeast", label: "Southeast" },
  { value: "Midwest", label: "Midwest" },
  { value: "Southwest", label: "Southwest" },
  { value: "West Coast", label: "West Coast" },
  { value: "Mountain States", label: "Mountain States" },
];

const OFFICE_OPTIONS = [
  { value: "Alleato Group Indianapolis", label: "Alleato Group Indianapolis" },
  { value: "Alleato Group Tampa", label: "Alleato Group Tampa" },
];

const US_STATE_OPTIONS = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "DC", label: "District of Columbia" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
];

interface EditProjectDialogProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface EditProjectFormData {
  stage: string;
  phase: string;
  name: string;
  project_number: string;
  client: string;
  description: string;
  work_scope: string;
  project_sector: string;
  delivery_method: string;
  square_footage: string;
  total_value: string;
  est_profit: string;
  project_code: string;
  project_type: string;
  active: boolean;
  country: string;
  street_address: string;
  city: string;
  state: string;
  postal_code: string;
  timezone: string;
  phone: string;
  region: string;
  office: string;
  start_date: string;
  completion_date: string;
  erp_sync: boolean;
  test_project: boolean;
  project_logo: string;
  project_photo: string;
}

const parseOptionalNumber = (value: string): number | null => {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(/[$,]/g, ""));
  return Number.isNaN(parsed) ? null : parsed;
};

const toStringValue = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
};

const getSummaryMetadata = (project: Project): Record<string, unknown> => {
  const metadata = project.summaryMetadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  return metadata;
};

const createInitialFormData = (project: Project): EditProjectFormData => {
  const metadata = getSummaryMetadata(project);

  return {
    stage: project.currentPhase || project.stage || "",
    phase: project.phase || "",
    name: project.name || "",
    project_number: project.projectNumber || project.jobNumber || "",
    client: project.client || "",
    description: project.description || project.notes || "",
    work_scope: project.workScope || "",
    project_sector: project.projectSector || "",
    delivery_method: project.deliveryMethod || "",
    square_footage:
      project.squareFootage != null
        ? String(project.squareFootage)
        : toStringValue(metadata.square_footage),
    total_value:
      project.totalValue != null
        ? String(project.totalValue)
        : project.estRevenue != null
        ? String(project.estRevenue)
        : "",
    est_profit: project.estProfit != null ? String(project.estProfit) : "",
    project_code: project.projectCode || toStringValue(metadata.project_code),
    project_type: project.projectType || project.type || project.category || "",
    active: project.active ?? project.status !== "Inactive",
    country: project.country || toStringValue(metadata.country) || "United States",
    street_address: project.address || "",
    city: project.city || toStringValue(metadata.city),
    state: project.state || "",
    postal_code: project.zip || toStringValue(metadata.postal_code),
    timezone:
      project.timezone || toStringValue(metadata.timezone) || "America/New_York",
    phone: project.phone || toStringValue(metadata.phone),
    region: project.region || toStringValue(metadata.region),
    office: project.office || toStringValue(metadata.office),
    start_date: project.startDate || "",
    completion_date: project.completionDate || "",
    erp_sync:
      project.erpSync ??
      (typeof metadata.erp_sync === "boolean" ? metadata.erp_sync : true),
    test_project:
      project.testProject ??
      (typeof metadata.test_project === "boolean" ? metadata.test_project : false),
    project_logo: project.projectLogo || toStringValue(metadata.project_logo),
    project_photo: project.projectPhoto || toStringValue(metadata.project_photo),
  };
};

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  allowClear = false,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  allowClear?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={id} className="mb-2 inline-block">
        {label}
      </Label>
      <Select
        value={value || undefined}
        onValueChange={(nextValue) => {
          if (allowClear && nextValue === CLEAR_SELECT_VALUE) {
            onChange("");
            return;
          }
          onChange(nextValue);
        }}
      >
        <SelectTrigger id={id} className="h-10 w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {allowClear && (
            <SelectItem value={CLEAR_SELECT_VALUE} className="text-muted-foreground">
              Clear selection
            </SelectItem>
          )}
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function EditProjectDialog({
  project,
  open,
  onOpenChange,
  onSuccess,
}: EditProjectDialogProps) {
  const [formData, setFormData] = React.useState<EditProjectFormData>(
    createInitialFormData(project),
  );
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setFormData(createInitialFormData(project));
    }
  }, [open, project]);

  const setField = <K extends keyof EditProjectFormData>(
    key: K,
    value: EditProjectFormData[K],
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const existingMetadata = getSummaryMetadata(project);
      const updatePayload = {
        name: formData.name,
        "job number": formData.project_number || null,
        stage: formData.stage || null,
        phase: formData.phase || null,
        category: formData.project_type || null,
        type: formData.project_type || null,
        summary: formData.description || null,
        address: formData.street_address || null,
        state: formData.state || null,
        archived: !formData.active,
        "start date": formData.start_date || null,
        "est completion": formData.completion_date || null,
        "est revenue": parseOptionalNumber(formData.total_value),
        "est profit": parseOptionalNumber(formData.est_profit),
        work_scope: formData.work_scope || null,
        project_sector: formData.project_sector || null,
        delivery_method: formData.delivery_method || null,
        summary_metadata: {
          ...existingMetadata,
          square_footage: parseOptionalNumber(formData.square_footage),
          project_code: formData.project_code || null,
          city: formData.city || null,
          postal_code: formData.postal_code || null,
          country: formData.country || null,
          timezone: formData.timezone || null,
          phone: formData.phone || null,
          region: formData.region || null,
          office: formData.office || null,
          erp_sync: formData.erp_sync,
          test_project: formData.test_project,
          project_logo: formData.project_logo || null,
          project_photo: formData.project_photo || null,
        },
      };

      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatePayload),
      });

      if (!response.ok) {
        throw new Error("Failed to update project");
      }

      toast.success("Project updated successfully");
      onOpenChange(false);
      onSuccess?.();
    } catch {
      toast.error("Failed to update project");
    } finally {
      setIsSaving(false);
    }
  };

  const [width, setWidth] = React.useState(720);
  const isResizing = React.useRef(false);

  const handleResizeStart = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizing.current = true;
      const startX = e.clientX;
      const startWidth = width;

      const onMouseMove = (moveEvent: MouseEvent) => {
        if (!isResizing.current) return;
        const delta = startX - moveEvent.clientX;
        const newWidth = Math.max(560, Math.min(startWidth + delta, 1200));
        setWidth(newWidth);
      };

      const onMouseUp = () => {
        isResizing.current = false;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [width],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="p-0 gap-0 sm:max-w-none"
        style={{ width: `${width}px` }}
      >
        {/* Resize handle */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 z-10"
          onMouseDown={handleResizeStart}
        />

        <SheetHeader className="px-6 py-4">
          <SheetTitle>Edit Project</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 min-h-0 flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">

            {/* General Information */}
            <section className="space-y-4 border-b border-border pb-8">
              <h3 className="text-base font-semibold text-foreground">General Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name" className="mb-2 inline-block">
                    Project Name *
                  </Label>
                  <Input
                    id="name"
                    className="h-10 w-full"
                    value={formData.name}
                    onChange={(e) => setField("name", e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="project_number" className="mb-2 inline-block">
                    Job Number *
                  </Label>
                  <Input
                    id="project_number"
                    className="h-10 w-full"
                    value={formData.project_number}
                    onChange={(e) => setField("project_number", e.target.value)}
                    required
                  />
                </div>

                <SelectField
                  id="stage"
                  label="Stage"
                  value={formData.stage}
                  onChange={(value) => setField("stage", value)}
                  options={STAGE_OPTIONS.map((value) => ({ value, label: value }))}
                  placeholder="Select stage"
                  allowClear
                />

                <SelectField
                  id="phase"
                  label="Phase"
                  value={formData.phase}
                  onChange={(value) => setField("phase", value)}
                  options={PHASE_OPTIONS.map((value) => ({ value, label: value }))}
                  placeholder="Select phase"
                  allowClear
                />

                <div>
                  <Label htmlFor="client" className="mb-2 inline-block">
                    Client
                  </Label>
                  <Input
                    id="client"
                    className="h-10 w-full"
                    value={formData.client}
                    onChange={(e) => setField("client", e.target.value)}
                  />
                </div>

                <SelectField
                  id="project_type"
                  label="Type"
                  value={formData.project_type}
                  onChange={(value) => setField("project_type", value)}
                  options={PROJECT_TYPE_OPTIONS.map((value) => ({ value, label: value }))}
                  placeholder="Select project type"
                  allowClear
                />

                <SelectField
                  id="work_scope"
                  label="Work Scope"
                  value={formData.work_scope}
                  onChange={(value) => setField("work_scope", value)}
                  options={WORK_SCOPE_OPTIONS.map((value) => ({ value, label: value }))}
                  placeholder="Select work scope"
                  allowClear
                />

                <SelectField
                  id="project_sector"
                  label="Project Sector"
                  value={formData.project_sector}
                  onChange={(value) => setField("project_sector", value)}
                  options={PROJECT_SECTOR_OPTIONS.map((value) => ({ value, label: value }))}
                  placeholder="Select project sector"
                  allowClear
                />

                <SelectField
                  id="delivery_method"
                  label="Delivery Method"
                  value={formData.delivery_method}
                  onChange={(value) => setField("delivery_method", value)}
                  options={DELIVERY_METHOD_OPTIONS.map((value) => ({ value, label: value }))}
                  placeholder="Select delivery method"
                  allowClear
                />

                <div className="md:col-span-2">
                  <Label htmlFor="description" className="mb-2 inline-block">
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    className="min-h-24"
                    value={formData.description}
                    onChange={(e) => setField("description", e.target.value)}
                  />
                </div>
              </div>
            </section>

            {/* Project Metrics */}
            <section className="space-y-4 border-b border-border pb-8">
              <h3 className="text-base font-semibold text-foreground">Project Metrics</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="square_footage" className="mb-2 inline-block">
                    Square Footage
                  </Label>
                  <Input
                    id="square_footage"
                    className="h-10 w-full"
                    type="number"
                    value={formData.square_footage}
                    onChange={(e) => setField("square_footage", e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="total_value" className="mb-2 inline-block">
                    Total Value ($)
                  </Label>
                  <Input
                    id="total_value"
                    className="h-10 w-full"
                    type="number"
                    step="0.01"
                    value={formData.total_value}
                    onChange={(e) => setField("total_value", e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="est_profit" className="mb-2 inline-block">
                    Estimated Profit ($)
                  </Label>
                  <Input
                    id="est_profit"
                    className="h-10 w-full"
                    type="number"
                    step="0.01"
                    value={formData.est_profit}
                    onChange={(e) => setField("est_profit", e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="project_code" className="mb-2 inline-block">
                    Code
                  </Label>
                  <Input
                    id="project_code"
                    className="h-10 w-full"
                    value={formData.project_code}
                    onChange={(e) => setField("project_code", e.target.value)}
                  />
                </div>
              </div>
            </section>

            {/* Project Location */}
            <section className="space-y-4 border-b border-border pb-8">
              <h3 className="text-base font-semibold text-foreground">Project Location</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SelectField
                  id="office"
                  label="Office"
                  value={formData.office}
                  onChange={(value) => setField("office", value)}
                  options={OFFICE_OPTIONS}
                  placeholder="Select office"
                  allowClear
                />

                <SelectField
                  id="country"
                  label="Country"
                  value={formData.country}
                  onChange={(value) => setField("country", value)}
                  options={COUNTRY_OPTIONS}
                  placeholder="Select country"
                />

                <div className="md:col-span-2">
                  <Label htmlFor="street_address" className="mb-2 inline-block">
                    Street Address
                  </Label>
                  <Input
                    id="street_address"
                    className="h-10 w-full"
                    value={formData.street_address}
                    onChange={(e) => setField("street_address", e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="city" className="mb-2 inline-block">
                    City
                  </Label>
                  <Input
                    id="city"
                    className="h-10 w-full"
                    value={formData.city}
                    onChange={(e) => setField("city", e.target.value)}
                  />
                </div>

                <SelectField
                  id="state"
                  label="State"
                  value={formData.state}
                  onChange={(value) => setField("state", value)}
                  options={US_STATE_OPTIONS}
                  placeholder="Select state"
                  allowClear
                />

                <div>
                  <Label htmlFor="postal_code" className="mb-2 inline-block">
                    Zip Code
                  </Label>
                  <Input
                    id="postal_code"
                    className="h-10 w-full"
                    value={formData.postal_code}
                    onChange={(e) => setField("postal_code", e.target.value)}
                  />
                </div>

                <SelectField
                  id="timezone"
                  label="Timezone"
                  value={formData.timezone}
                  onChange={(value) => setField("timezone", value)}
                  options={TIMEZONE_OPTIONS.map((opt) => ({
                    value: opt.value,
                    label: opt.label,
                  }))}
                  placeholder="Select timezone"
                />

                <div>
                  <Label htmlFor="phone" className="mb-2 inline-block">
                    Phone
                  </Label>
                  <Input
                    id="phone"
                    className="h-10 w-full"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setField("phone", e.target.value)}
                  />
                </div>

                <SelectField
                  id="region"
                  label="Region"
                  value={formData.region}
                  onChange={(value) => setField("region", value)}
                  options={REGION_OPTIONS}
                  placeholder="Select region"
                  allowClear
                />
              </div>
            </section>

            {/* Dates */}
            <section className="space-y-4 border-b border-border pb-8">
              <h3 className="text-base font-semibold text-foreground">Dates</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_date" className="mb-2 inline-block">
                    Start Date
                  </Label>
                  <Input
                    id="start_date"
                    className="h-10 w-full"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setField("start_date", e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="completion_date" className="mb-2 inline-block">
                    Completion Date
                  </Label>
                  <Input
                    id="completion_date"
                    className="h-10 w-full"
                    type="date"
                    value={formData.completion_date}
                    onChange={(e) => setField("completion_date", e.target.value)}
                  />
                </div>
              </div>
            </section>

            {/* Logo & Photo */}
            <section className="space-y-4 border-b border-border pb-8">
              <h3 className="text-base font-semibold text-foreground">Logo & Photo</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="project_logo" className="mb-2 inline-block">
                    Project Logo
                  </Label>
                  <Input
                    id="project_logo"
                    className="h-10 w-full"
                    type="file"
                    accept={ACCEPTED_IMAGE_TYPES}
                    onChange={(e) =>
                      setField("project_logo", e.target.files?.[0]?.name || formData.project_logo)
                    }
                  />
                  {formData.project_logo && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Current: {formData.project_logo}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="project_photo" className="mb-2 inline-block">
                    Project Photo
                  </Label>
                  <Input
                    id="project_photo"
                    className="h-10 w-full"
                    type="file"
                    accept={ACCEPTED_IMAGE_TYPES}
                    onChange={(e) =>
                      setField("project_photo", e.target.files?.[0]?.name || formData.project_photo)
                    }
                  />
                  {formData.project_photo && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Current: {formData.project_photo}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Status & Flags */}
            <section className="space-y-4">
              <h3 className="text-base font-semibold text-foreground">Status & Flags</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center gap-3 rounded-md border px-3 py-2">
                  <Checkbox
                    id="active"
                    checked={formData.active}
                    onCheckedChange={(checked) => setField("active", Boolean(checked))}
                  />
                  <Label htmlFor="active">Active</Label>
                </div>

                <div className="flex items-center gap-3 rounded-md border px-3 py-2">
                  <Checkbox
                    id="erp_sync"
                    checked={formData.erp_sync}
                    onCheckedChange={(checked) => setField("erp_sync", Boolean(checked))}
                  />
                  <Label htmlFor="erp_sync">ERP Sync</Label>
                </div>

                <div className="flex items-center gap-3 rounded-md border px-3 py-2">
                  <Checkbox
                    id="test_project"
                    checked={formData.test_project}
                    onCheckedChange={(checked) =>
                      setField("test_project", Boolean(checked))
                    }
                  />
                  <Label htmlFor="test_project">Test Project</Label>
                </div>
              </div>
            </section>

          </div>

          <div className="border-t bg-background px-6 py-4">
            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
