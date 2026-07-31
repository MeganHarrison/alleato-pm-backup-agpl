import { z } from "zod";

export const contactSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  person_type: z.enum(["user", "contact", "employee"]),
  company_id: z.string().optional().or(z.literal("")),
  job_title: z.string().optional().or(z.literal("")),
  type: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  address_line2: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  state: z.string().optional().or(z.literal("")),
  zip: z.string().optional().or(z.literal("")),
  linkedin: z.string().optional().or(z.literal("")),
  avatar: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export type ContactFormData = z.infer<typeof contactSchema>;
