import { tool } from "ai";
import {
  createProjectCompanyDescription,
  createProjectCompanyInputSchema,
  createProjectContactDescription,
  createProjectContactInputSchema,
} from "@/lib/ai/tool-descriptors";
import { createContactInputSchema } from "@/lib/ai/tool-schemas/action-schemas";
import { type ActionToolInternals, withWriteTrace } from "./action-tool-internals";

export function createCompanyContactWriteTools(internals: ActionToolInternals) {
  const {
    options,
    supabase,
    resolveIdempotencyKey,
    getReplayResponse,
    recordWriteAudit,
    enforceProjectWriteAccess,
    normalizeDirectoryText,
    findCompanyByName,
    ensureProjectCompanyAssociation,
    findPersonByEmail,
  } = internals;

  return {
    createProjectCompany: tool({
      description: createProjectCompanyDescription,
      inputSchema: createProjectCompanyInputSchema,
      execute: withWriteTrace("createProjectCompany", options, async (input) => {
        const access = await enforceProjectWriteAccess(input.projectId);
        if (!access.ok) return { success: false, error: access.error };

        const companyName = normalizeDirectoryText(input.name);
        if (!companyName) {
          return { success: false, error: "Company name is required." };
        }

        const normalized = {
          name: companyName,
          companyType: input.companyType,
          emailAddress: normalizeDirectoryText(input.emailAddress),
          businessPhone: normalizeDirectoryText(input.businessPhone),
          address: normalizeDirectoryText(input.address),
          city: normalizeDirectoryText(input.city),
          state: normalizeDirectoryText(input.state),
          zip: normalizeDirectoryText(input.zip),
          website: normalizeDirectoryText(input.website),
        };

        if (!input.confirmed) {
          return {
            action: "preview",
            message:
              "Here's the company I'll add to the project directory. Reply **confirm** to proceed.",
            preview: {
              tables: ["companies", "project_companies"],
              fields: {
                project_id: input.projectId,
                name: normalized.name,
                company_type: normalized.companyType,
                email_address: normalized.emailAddress,
                contact_phone: normalized.businessPhone,
                address: normalized.address,
                city: normalized.city,
                state: normalized.state,
                zip_code: normalized.zip,
                website: normalized.website,
                status: "ACTIVE",
              },
            },
          };
        }

        const idempotencyKey = resolveIdempotencyKey("createProjectCompany", input);
        const replay = await getReplayResponse("createProjectCompany", idempotencyKey);
        if (replay) return replay;

        try {
          const existingCompany = await findCompanyByName(normalized.name);
          let company = existingCompany;

          if (!company) {
            const { data, error } = await supabase
              .from("companies")
              .insert({
                name: normalized.name,
                address: normalized.address,
                city: normalized.city,
                state: normalized.state,
                zip_code: normalized.zip,
                contact_phone: normalized.businessPhone,
                contact_email: normalized.emailAddress,
                website: normalized.website,
                is_vendor: normalized.companyType !== "YOUR_COMPANY",
                status: "active",
                type: normalized.companyType,
              })
              .select("id,name,address,city,state,website,contact_phone,is_vendor")
              .single();

            if (error) {
              throw new Error(`Failed to create company: ${error.message}`);
            }
            company = data;
          }

          const assignmentResult = await ensureProjectCompanyAssociation({
            projectId: input.projectId,
            companyId: company.id,
            companyType: normalized.companyType,
            emailAddress: normalized.emailAddress,
          });

          const response = {
            success: true,
            message:
              assignmentResult.action === "already_assigned"
                ? `Company **${company.name}** was already active on this project.`
                : `Company **${company.name}** was added to the project directory.`,
            record: {
              company,
              projectCompany: assignmentResult.assignment,
              companyAction: existingCompany ? "reused_existing_company" : "created_company",
              assignmentAction: assignmentResult.action,
            },
            links: {
              projectDirectory: `/${input.projectId}/directory`,
              companyDirectory: "/directory/companies",
            },
          };
          await recordWriteAudit({
            toolName: "createProjectCompany",
            idempotencyKey,
            projectId: access.projectId,
            input,
            status: "success",
            response,
          });
          return response;
        } catch (error) {
          const failure = {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
          await recordWriteAudit({
            toolName: "createProjectCompany",
            idempotencyKey,
            projectId: access.projectId,
            input,
            status: "error",
            response: failure,
          });
          return failure;
        }
      }),
    }),

    createProjectContact: tool({
      description: createProjectContactDescription,
      inputSchema: createProjectContactInputSchema,
      execute: withWriteTrace("createProjectContact", options, async (input) => {
        const access = await enforceProjectWriteAccess(input.projectId);
        if (!access.ok) return { success: false, error: access.error };

        const firstName = normalizeDirectoryText(input.firstName);
        const lastName = normalizeDirectoryText(input.lastName);
        if (!firstName || !lastName) {
          return { success: false, error: "First name and last name are required." };
        }

        const normalized = {
          firstName,
          lastName,
          email: normalizeDirectoryText(input.email),
          jobTitle: normalizeDirectoryText(input.jobTitle),
          phoneBusiness: normalizeDirectoryText(input.phoneBusiness),
          phoneMobile: normalizeDirectoryText(input.phoneMobile),
          companyName: normalizeDirectoryText(input.companyName),
          role: normalizeDirectoryText(input.role),
        };

        if (!input.confirmed) {
          return {
            action: "preview",
            message:
              "Here's the contact I'll add to the project directory. Reply **confirm** to proceed.",
            preview: {
              tables: ["people", "project_directory_memberships", "project_companies"],
              fields: {
                project_id: input.projectId,
                first_name: normalized.firstName,
                last_name: normalized.lastName,
                email: normalized.email,
                job_title: normalized.jobTitle,
                phone_business: normalized.phoneBusiness,
                phone_mobile: normalized.phoneMobile,
                company_id: input.companyId ?? null,
                company_name: normalized.companyName,
                role: normalized.role,
                person_type: "contact",
                status: "active",
                make_primary_company_contact: input.makePrimaryCompanyContact,
              },
            },
          };
        }

        const idempotencyKey = resolveIdempotencyKey("createProjectContact", input);
        const replay = await getReplayResponse("createProjectContact", idempotencyKey);
        if (replay) return replay;

        try {
          let companyId = input.companyId ?? null;
          let companyName = normalized.companyName;
          if (!companyId && normalized.companyName) {
            const company = await findCompanyByName(normalized.companyName);
            if (!company) {
              throw new Error(`Company "${normalized.companyName}" was not found. Add the company first, then add the contact.`);
            }
            companyId = company.id;
            companyName = company.name;
          }

          let projectCompany = null;
          if (companyId) {
            const association = await ensureProjectCompanyAssociation({
              projectId: input.projectId,
              companyId,
              companyType: "VENDOR",
              emailAddress: null,
            });
            projectCompany = association.assignment;
          }

          const existingPerson = await findPersonByEmail(normalized.email);
          let person = existingPerson;

          if (person) {
            const updates: Record<string, unknown> = {
              status: "active",
              person_type: person.person_type || "contact",
            };
            if (companyId && person.company_id !== companyId) updates.company_id = companyId;
            if (normalized.jobTitle) updates.job_title = normalized.jobTitle;
            if (normalized.phoneBusiness) updates.phone_business = normalized.phoneBusiness;
            if (normalized.phoneMobile) updates.phone_mobile = normalized.phoneMobile;

            const { data, error } = await supabase
              .from("people")
              .update(updates as never)
              .eq("id", person.id)
              .select("id,first_name,last_name,email,company_id,person_type,status,job_title,phone_business,phone_mobile")
              .single();

            if (error) {
              throw new Error(`Failed to update existing contact: ${error.message}`);
            }
            person = data;
          } else {
            const { data, error } = await supabase
              .from("people")
              .insert({
                first_name: normalized.firstName,
                last_name: normalized.lastName,
                email: normalized.email,
                job_title: normalized.jobTitle,
                phone_business: normalized.phoneBusiness,
                phone_mobile: normalized.phoneMobile,
                company_id: companyId,
                company: companyName,
                person_type: "contact",
                status: "active",
              })
              .select("id,first_name,last_name,email,company_id,person_type,status,job_title,phone_business,phone_mobile")
              .single();

            if (error) {
              throw new Error(`Failed to create contact: ${error.message}`);
            }
            person = data;
          }

          const { data: existingMembership, error: existingMembershipError } = await supabase
            .from("project_directory_memberships")
            .select("id,project_id,person_id,role,status,user_type,invite_status")
            .eq("project_id", input.projectId)
            .eq("person_id", person.id)
            .maybeSingle();

          if (existingMembershipError) {
            throw new Error(`Failed to check project contact membership: ${existingMembershipError.message}`);
          }

          let membership = existingMembership;
          let membershipAction: "created" | "reactivated" | "already_assigned" = "already_assigned";
          if (existingMembership) {
            if (existingMembership.status !== "active" || (normalized.role && existingMembership.role !== normalized.role)) {
              const { data, error } = await supabase
                .from("project_directory_memberships")
                .update({
                  status: "active",
                  role: normalized.role ?? existingMembership.role,
                  user_type: existingMembership.user_type || "client",
                  invite_status: "accepted",
                })
                .eq("id", existingMembership.id)
                .select("id,project_id,person_id,role,status,user_type,invite_status")
                .single();

              if (error) {
                throw new Error(`Failed to reactivate project contact membership: ${error.message}`);
              }
              membership = data;
              membershipAction = "reactivated";
            }
          } else {
            const { data, error } = await supabase
              .from("project_directory_memberships")
              .insert({
                project_id: input.projectId,
                person_id: person.id,
                role: normalized.role,
                status: "active",
                // 'contact' is not an allowed user_type
                // (project_directory_memberships_user_type_check: employee |
                // client | subcontractor | developer). AI-added project contacts
                // default to the least-privileged external type. Guarded by the
                // AI tool contract harness.
                user_type: "client",
                invite_status: "accepted",
              })
              .select("id,project_id,person_id,role,status,user_type,invite_status")
              .single();

            if (error) {
              throw new Error(`Failed to add contact to project directory: ${error.message}`);
            }
            membership = data;
            membershipAction = "created";
          }

          let primaryContactUpdated = false;
          if (input.makePrimaryCompanyContact && projectCompany) {
            const { error } = await supabase
              .from("project_companies")
              .update({ primary_contact_id: person.id })
              .eq("id", projectCompany.id);

            if (error) {
              throw new Error(`Failed to set primary company contact: ${error.message}`);
            }
            primaryContactUpdated = true;
          }

          const fullName = [person.first_name, person.last_name].filter(Boolean).join(" ");
          const response = {
            success: true,
            message:
              membershipAction === "already_assigned"
                ? `Contact **${fullName}** was already active on this project.`
                : `Contact **${fullName}** was added to the project directory.`,
            record: {
              person,
              membership,
              projectCompany,
              personAction: existingPerson ? "reused_existing_person" : "created_person",
              membershipAction,
              primaryContactUpdated,
            },
            links: {
              projectDirectory: `/${input.projectId}/directory`,
              contactDirectory: "/directory/contacts",
            },
          };
          await recordWriteAudit({
            toolName: "createProjectContact",
            idempotencyKey,
            projectId: access.projectId,
            input,
            status: "success",
            response,
          });
          return response;
        } catch (error) {
          const failure = {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
          await recordWriteAudit({
            toolName: "createProjectContact",
            idempotencyKey,
            projectId: access.projectId,
            input,
            status: "error",
            response: failure,
          });
          return failure;
        }
      }),
    }),

    createContact: tool({
      description:
        "Create a contact in the global directory (public.people). Use when the user wants to 'add a contact', " +
        "'create a new contact', or 'add [person] to the directory' WITHOUT tying them to a specific project " +
        "(use createProjectContact when a project is involved). This renders an interactive, prefilled contact " +
        "form widget: fill in every field you already know (first/last name, email, phone, job title, company, " +
        "department, notes) so the user only completes what's missing, then submits. Reuses an existing person by " +
        "email and links the company by id or exact name. Always previews the form before writing.",
      inputSchema: createContactInputSchema,
      execute: withWriteTrace("createContact", options, async (input) => {
        const firstName = normalizeDirectoryText(input.firstName);
        const lastName = normalizeDirectoryText(input.lastName);
        if (!firstName || !lastName) {
          return { success: false, error: "First name and last name are required." };
        }

        const normalized = {
          firstName,
          lastName,
          email: normalizeDirectoryText(input.email),
          phone: normalizeDirectoryText(input.phone),
          jobTitle: normalizeDirectoryText(input.jobTitle),
          department: normalizeDirectoryText(input.department),
          companyName: normalizeDirectoryText(input.companyName),
          notes: normalizeDirectoryText(input.notes),
        };

        const buildWidget = (
          status: "draft" | "created",
          extra: { companyId?: string | null; contactHref?: string | null },
        ) => ({
          type: "create_contact" as const,
          id: status === "created" ? "create-contact-created" : "create-contact-preview",
          title: "Create contact",
          status,
          defaultFirstName: normalized.firstName,
          defaultLastName: normalized.lastName,
          defaultEmail: normalized.email ?? undefined,
          defaultPhone: normalized.phone ?? undefined,
          defaultJobTitle: normalized.jobTitle ?? undefined,
          defaultDepartment: normalized.department ?? undefined,
          defaultCompanyName: normalized.companyName ?? undefined,
          defaultNotes: normalized.notes ?? undefined,
          companyId: extra.companyId ?? input.companyId ?? null,
          contactHref: extra.contactHref ?? null,
          confirmPrompt:
            "Create this contact in the directory with createContact (confirmed). Show the final form first and wait for my confirmation.",
        });

        if (!input.confirmed) {
          return {
            action: "preview",
            message:
              "Here's the contact I'll add to the directory. Edit any field, then submit to create it.",
            preview: {
              table: "people",
              fields: {
                first_name: normalized.firstName,
                last_name: normalized.lastName,
                email: normalized.email,
                phone_mobile: normalized.phone,
                job_title: normalized.jobTitle,
                business_unit: normalized.department,
                company_id: input.companyId ?? null,
                company: normalized.companyName,
                notes: normalized.notes,
                person_type: "contact",
                status: "active",
              },
            },
            widget: buildWidget("draft", {}),
          };
        }

        const idempotencyKey = resolveIdempotencyKey("createContact", input);
        const replay = await getReplayResponse("createContact", idempotencyKey);
        if (replay) return replay;

        try {
          let companyId = input.companyId ?? null;
          let companyName = normalized.companyName;
          let companyMatched = Boolean(companyId);
          if (!companyId && normalized.companyName) {
            const company = await findCompanyByName(normalized.companyName);
            if (company) {
              companyId = company.id;
              companyName = company.name;
              companyMatched = true;
            }
          }

          const existingPerson = await findPersonByEmail(normalized.email);
          let person = existingPerson;

          if (person) {
            const updates: Record<string, unknown> = {
              status: "active",
              person_type: person.person_type || "contact",
            };
            if (companyId && person.company_id !== companyId) updates.company_id = companyId;
            if (companyName) updates.company = companyName;
            if (normalized.jobTitle) updates.job_title = normalized.jobTitle;
            if (normalized.phone) updates.phone_mobile = normalized.phone;
            if (normalized.department) updates.business_unit = normalized.department;
            if (normalized.notes) updates.notes = normalized.notes;

            const { data, error } = await supabase
              .from("people")
              .update(updates as never)
              .eq("id", person.id)
              .select("id,first_name,last_name,email,company_id,company,person_type,status,job_title,business_unit,phone_mobile,notes")
              .single();

            if (error) {
              throw new Error(`Failed to update existing contact: ${error.message}`);
            }
            person = data;
          } else {
            const { data, error } = await supabase
              .from("people")
              .insert({
                first_name: normalized.firstName,
                last_name: normalized.lastName,
                email: normalized.email,
                phone_mobile: normalized.phone,
                job_title: normalized.jobTitle,
                business_unit: normalized.department,
                notes: normalized.notes,
                company_id: companyId,
                company: companyName,
                person_type: "contact",
                status: "active",
              })
              .select("id,first_name,last_name,email,company_id,company,person_type,status,job_title,business_unit,phone_mobile,notes")
              .single();

            if (error) {
              throw new Error(`Failed to create contact: ${error.message}`);
            }
            person = data;
          }

          const fullName = [person.first_name, person.last_name].filter(Boolean).join(" ");
          const contactHref = `/directory/contacts/${person.id}`;
          const unmatchedCompanyNote =
            !companyMatched && normalized.companyName
              ? ` I kept the company name "${normalized.companyName}" on the record but couldn't match it to an existing company — add the company to link it.`
              : "";
          const response = {
            success: true,
            message:
              (existingPerson
                ? `Contact **${fullName}** already existed, so I updated their details.`
                : `Contact **${fullName}** was added to the directory.`) + unmatchedCompanyNote,
            record: {
              person,
              personAction: existingPerson ? "reused_existing_person" : "created_person",
              companyMatched,
            },
            links: {
              contact: contactHref,
              contactDirectory: "/directory/contacts",
            },
            widget: buildWidget("created", { companyId, contactHref }),
          };
          await recordWriteAudit({
            toolName: "createContact",
            idempotencyKey,
            projectId: null,
            input,
            status: "success",
            response,
          });
          return response;
        } catch (error) {
          const failure = {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
          await recordWriteAudit({
            toolName: "createContact",
            idempotencyKey,
            projectId: null,
            input,
            status: "error",
            response: failure,
          });
          return failure;
        }
      }),
    }),
  };
}
