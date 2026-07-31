import { z } from "zod";

const CompanyIdSchema = z.string().uuid().brand<"CompanyId">();
const ProjectCompanyIdSchema = z.string().uuid().brand<"ProjectCompanyId">();
const PersonIdSchema = z.string().uuid().brand<"PersonId">();

const CompanyTypeSchema = z.enum([
  "YOUR_COMPANY",
  "VENDOR",
  "SUBCONTRACTOR",
  "SUPPLIER",
  "CONNECTED_COMPANY",
]);

const CompanyStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);

const CompanySchema = z
  .object({
    id: CompanyIdSchema,
    name: z.string().nullable(),
    address: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    state: z.string().nullable().optional(),
    zip: z.string().nullable().optional(),
    license_number: z.string().nullable().optional(),
    website: z.string().nullable().optional(),
    created_at: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),
  })
  .passthrough();

export const ProjectCompanySchema = z
  .object({
    id: ProjectCompanyIdSchema,
    project_id: z.number(),
    company_id: CompanyIdSchema,
    business_phone: z.string().nullable(),
    email_address: z.string().nullable(),
    primary_contact_id: PersonIdSchema.nullable(),
    erp_vendor_id: z.string().nullable(),
    company_type: CompanyTypeSchema,
    status: CompanyStatusSchema,
    logo_url: z.string().nullable(),
    created_at: z.string().nullable(),
    updated_at: z.string().nullable(),
    company: CompanySchema.optional().nullable(),
    primary_contact: z.record(z.string(), z.unknown()).optional().nullable(),
    user_count: z.number().int().optional().nullable(),
  })
  .passthrough();

export const CompanyListResponseSchema = z.object({
  data: z.array(ProjectCompanySchema),
  pagination: z.object({
    current_page: z.number().int(),
    per_page: z.number().int(),
    total: z.number().int(),
    total_pages: z.number().int(),
  }),
});

export type ProjectCompanyResponse = z.infer<typeof ProjectCompanySchema>;
export type CompanyListResponse = z.infer<typeof CompanyListResponseSchema>;
