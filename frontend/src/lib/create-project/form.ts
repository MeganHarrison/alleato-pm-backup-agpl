import { type HTMLAttributes } from "react";
import { type DefaultValues } from "react-hook-form";
import { z } from "zod";

const numberFromInput = (value: unknown) => {
  if (value === "" || value === null || typeof value === "undefined")
    return undefined;
  if (typeof value === "number") return Number.isNaN(value) ? undefined : value;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isNaN(parsed) ? undefined : parsed;
};

const optionalNumeric = z.preprocess(
  numberFromInput,
  z.number().nonnegative().optional(),
);

const requiredCurrency = z.preprocess(
  numberFromInput,
  z
    .number({ message: "Enter a valid number" })
    .nonnegative({ message: "Must be a positive value" }),
);

export const createProjectSchema = z.object({
  stage: z.string().optional(),
  phase: z.string().optional(),
  name: z.string().min(1, { message: "Project name is required" }),
  project_number: z.string().min(1, { message: "Job number is required" }),
  description: z.string().optional(),
  work_scope: z.string().optional(),
  project_sector: z.string().optional(),
  delivery_method: z.string().optional(),
  project_logo: z.any().optional(),
  project_photo: z.any().optional(),
  square_footage: optionalNumeric,
  total_value: optionalNumeric,
  project_code: z.string().optional(),
  project_type: z.string().optional(),
  active: z.boolean().optional().default(true),
  country: z.string().optional(),
  street_address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  timezone: z.string().optional(),
  phone: z.string().optional(),
  region: z.string().optional(),
  office: z.string().optional(),
  start_date: z.string().optional(),
  completion_date: z.string().optional(),
  erp_sync: z.boolean().optional().default(true),
  test_project: z.boolean().optional().default(false),
  onedrive: z.string().optional(),
});

export type CreateProjectFormValues = z.infer<typeof createProjectSchema>;
export type FieldName = keyof CreateProjectFormValues;

export type FieldControl =
  | "text"
  | "textarea"
  | "select"
  | "number"
  | "date"
  | "checkbox"
  | "file"
  | "formatted-number"
  | "currency";

export interface FieldDefinition {
  name: FieldName;
  label: string;
  control: FieldControl;
  placeholder?: string;
  description?: string;
  options?: { label: string; value: string }[];
  colSpan?: "full";
  allowEmptyOption?: boolean;
  required?: boolean;
  step?: string;
  accept?: string;
  inputType?: "text" | "email" | "tel";
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  statusHint?: string;
}

export interface FormSection {
  id: string;
  title: string;
  description?: string;
  fields: FieldDefinition[];
}

export type FormLayoutMode = "cards" | "sections" | "single-column";

export interface DevFieldOverride {
  hidden?: boolean;
  control?: FieldControl;
  colSpan?: "full";
}

export interface DevSectionOverride {
  hidden?: boolean;
}

export interface DevTemplateFormConfig<FieldKey extends string = string> {
  layout: FormLayoutMode;
  sections: Record<string, DevSectionOverride>;
  fields: Partial<Record<FieldKey, DevFieldOverride>>;
}

export type DevFormConfigs<FieldKey extends string = string> =
  Record<string, DevTemplateFormConfig<FieldKey>>;

export const FORM_DEV_CONFIG_STORAGE_KEY =
  "create-project-form-dev-config-v1";

export const DEFAULT_LAYOUT_BY_TEMPLATE: Record<string, FormLayoutMode> = {
  standard: "cards",
  shell: "sections",
  interiors: "single-column",
};

export const createDefaultTemplateConfig = <FieldKey extends string = string>(
  template: string,
): DevTemplateFormConfig<FieldKey> => ({
  layout: DEFAULT_LAYOUT_BY_TEMPLATE[template] ?? "cards",
  sections: {},
  fields: {},
});

export const getTemplateConfig = <FieldKey extends string = string>(
  configs: DevFormConfigs<FieldKey>,
  template: string,
): DevTemplateFormConfig<FieldKey> => {
  return configs[template] ?? createDefaultTemplateConfig(template);
};

export const PROJECT_TEMPLATE_OPTIONS = [
  { value: "standard", label: "Standard Project Template" },
  { value: "shell", label: "Shell Template" },
  { value: "interiors", label: "Interiors Template" },
];

export const STAGE_OPTIONS = [
  "Bidding",
  "Course of Construction",
  "Post-Construction",
  "Pre-Construction",
  "Speculative",
  "Warranty",
];

export const PHASE_OPTIONS = [
  "Planning",
  "Estimating",
  "Current",
  "Complete",
  "Loss",
  "Archive",
];

export const WORK_SCOPE_OPTIONS = [
  "Ground-Up Construction",
  "Renovation",
  "Tenant Improvement",
  "Interior Build-Out",
  "Maintenance",
];

export const PROJECT_SECTOR_OPTIONS = [
  "Commercial",
  "Industrial",
  "Infrastructure",
  "Healthcare",
  "Institutional",
  "Residential",
];

export const DELIVERY_METHOD_OPTIONS = [
  "Design-Bid-Build",
  "Design-Build",
  "Construction Management at Risk",
  "Integrated Project Delivery",
];

export const PROJECT_TYPE_OPTIONS = [
  "New Build",
  "Addition",
  "Fit-Out",
  "Maintenance",
  "Restoration",
];

export const TIMEZONE_OPTIONS = [
  { label: "Eastern Time (ET)", value: "America/New_York" },
  { label: "Central Time (CT)", value: "America/Chicago" },
  { label: "Mountain Time (MT)", value: "America/Denver" },
  { label: "Pacific Time (PT)", value: "America/Los_Angeles" },
  { label: "Alaska Time (AKT)", value: "America/Anchorage" },
  { label: "Hawaii Time (HST)", value: "Pacific/Honolulu" },
];

export const COUNTRY_OPTIONS = [
  { value: "United States", label: "United States" },
  { value: "Canada", label: "Canada" },
  { value: "Mexico", label: "Mexico" },
];

export const REGION_OPTIONS = [
  { value: "Northeast", label: "Northeast" },
  { value: "Southeast", label: "Southeast" },
  { value: "Midwest", label: "Midwest" },
  { value: "Southwest", label: "Southwest" },
  { value: "West Coast", label: "West Coast" },
  { value: "Mountain States", label: "Mountain States" },
];

export const OFFICE_OPTIONS = [
  { value: "Alleato Group Indianapolis", label: "Alleato Group Indianapolis" },
  { value: "Alleato Group Tampa", label: "Alleato Group Tampa" },
];

export const US_STATE_OPTIONS = [
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

export const FIELD_CONTROL_OPTIONS: Record<FieldControl, FieldControl[]> = {
  text: ["text", "textarea"],
  textarea: ["textarea", "text"],
  select: ["select"],
  number: ["number", "formatted-number", "currency"],
  date: ["date"],
  checkbox: ["checkbox"],
  file: ["file"],
  "formatted-number": ["formatted-number", "number", "currency"],
  currency: ["currency", "formatted-number", "number"],
};

export const getFieldControlOptions = (field: FieldDefinition): FieldControl[] => {
  return FIELD_CONTROL_OPTIONS[field.control] ?? [field.control];
};

export const isControlAllowedForField = (
  field: FieldDefinition,
  control: FieldControl,
): boolean => {
  return getFieldControlOptions(field).includes(control);
};

export const formSections: FormSection[] = [
  {
    id: "general-information",
    title: "General Information",
    fields: [
      {
        name: "name",
        label: "Project Name",
        control: "text",
        required: true,
      },
      {
        name: "project_number",
        label: "Job Number",
        control: "text",
        required: true,
      },
      {
        name: "phase",
        label: "Phase",
        control: "select",
        options: PHASE_OPTIONS.map((value) => ({ value, label: value })),
        allowEmptyOption: true,
        placeholder: "Select phase",
      },
      {
        name: "stage",
        label: "Status",
        control: "select",
        options: STAGE_OPTIONS.map((value) => ({ value, label: value })),
        allowEmptyOption: true,
        placeholder: "Select stage",
      },
      {
        name: "work_scope",
        label: "Work Scope",
        control: "select",
        options: WORK_SCOPE_OPTIONS.map((value) => ({ value, label: value })),
        allowEmptyOption: true,
      },
      {
        name: "project_sector",
        label: "Project Sector",
        control: "select",
        options: PROJECT_SECTOR_OPTIONS.map((value) => ({ value, label: value })),
        allowEmptyOption: true,
      },
      {
        name: "delivery_method",
        label: "Delivery Method",
        control: "select",
        options: DELIVERY_METHOD_OPTIONS.map((value) => ({ value, label: value })),
        allowEmptyOption: true,
      },
      {
        name: "project_type",
        label: "Type",
        control: "select",
        options: PROJECT_TYPE_OPTIONS.map((value) => ({ value, label: value })),
        allowEmptyOption: true,
      },
      {
        name: "start_date",
        label: "Start Date",
        control: "date",
      },
      {
        name: "completion_date",
        label: "Completion Date",
        control: "date",
      },
      {
        name: "onedrive",
        label: "OneDrive Folder",
        control: "text",
        colSpan: "full",
        placeholder: "https://",
      },
      {
        name: "description",
        label: "Description",
        control: "textarea",
        colSpan: "full",
      },
    ],
  },
  {
    id: "project-metrics",
    title: "Project Metrics",
    fields: [
      {
        name: "square_footage",
        label: "Square Footage",
        control: "formatted-number",
        placeholder: "Enter square footage",
      },
      {
        name: "total_value",
        label: "Total Value",
        control: "currency",
        placeholder: "$0.00",
      },
    ],
  },
  {
    id: "project-location",
    title: "Project Location",
    fields: [
      {
        name: "street_address",
        label: "Street Address",
        control: "text",
        colSpan: "full",
      },
      {
        name: "city",
        label: "City",
        control: "text",
      },
      {
        name: "state",
        label: "State",
        control: "select",
        options: US_STATE_OPTIONS,
      },
      {
        name: "postal_code",
        label: "Postal Code",
        control: "text",
      },
      {
        name: "office",
        label: "Office",
        control: "select",
        options: OFFICE_OPTIONS,
      },
    ],
  },
  {
    id: "logo",
    title: "Logo",
    fields: [
      {
        name: "project_logo",
        label: "Project Logo",
        control: "file",
        accept: ".jpg,.jpeg,.png,.tif,.tiff,.bmp",
      },
      {
        name: "project_photo",
        label: "Project Photo",
        control: "file",
        accept: ".jpg,.jpeg,.png,.tif,.tiff,.bmp",
      },
    ],
  },
  {
    id: "project-status",
    title: "Project Status",
    fields: [
      {
        name: "active",
        label: "Active",
        control: "checkbox",
        description: "Show this project across the company.",
      },
      {
        name: "erp_sync",
        label: "ERP Sync",
        control: "checkbox",
        description: "Enable ERP sync flag.",
      },
    ],
  },
];

export const defaultValues: DefaultValues<CreateProjectFormValues> = {
  stage: undefined,
  phase: "Current",
  name: "",
  project_number: "",
  description: "",
  work_scope: undefined,
  project_sector: undefined,
  delivery_method: undefined,
  project_logo: undefined,
  project_photo: undefined,
  square_footage: undefined,
  total_value: undefined,
  project_code: "",
  project_type: undefined,
  active: true,
  country: "United States",
  street_address: "",
  city: "",
  state: undefined,
  postal_code: "",
  office: "Alleato Group Indianapolis",
  start_date: "",
  completion_date: "",
  erp_sync: true,
  test_project: false,
  onedrive: "",
};

export const formatNumberWithCommas = (
  value: number | string | undefined | null,
): string => {
  if (value === undefined || value === null || value === "") return "";
  const num = typeof value === "string" ? Number(value.replace(/,/g, "")) : value;
  if (Number.isNaN(num)) return "";
  return num.toLocaleString("en-US");
};

export const formatCurrency = (
  value: number | string | undefined | null,
): string => {
  if (value === undefined || value === null || value === "") return "";
  const num = typeof value === "string" ? Number(value.replace(/[$,]/g, "")) : value;
  if (Number.isNaN(num)) return "";
  return num.toLocaleString("en-US", { style: "currency", currency: "USD" });
};

export const parseFormattedNumber = (value: string): number | undefined => {
  if (!value) return undefined;
  const parsed = Number(value.replace(/\$/g, "").replace(/,/g, ""));
  return Number.isNaN(parsed) ? undefined : parsed;
};
