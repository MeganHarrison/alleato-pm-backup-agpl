import { Buffer } from "node:buffer";
import { read, utils } from "xlsx";
import type { createClient } from "@supabase/supabase-js";
import {
  DirectoryService,
  type DirectoryFilters,
  type PersonWithDetails,
} from "./directoryService";
import { InviteService } from "./inviteService";
import type {
  PersonCreateDTO,
  PersonUpdateDTO,
} from "./directoryService";
import { CompanyService } from "./companyService";
import type { CompanyCreateDTO } from "./companyService";
import type { Database } from "@/types/database.types";

type Tables = Database["public"]["Tables"];
type PermissionTemplate = Tables["permission_templates"]["Row"];
type PermissionAuditLog = Tables["permission_audit_log"]["Row"];

export type DirectoryTemplateType = "users" | "contacts" | "companies";

export interface DirectoryExportColumn {
  id: string;
  label: string;
}

export interface DirectoryImportOptions {
  type: DirectoryTemplateType;
  hasHeaders?: boolean;
  skipDuplicates?: boolean;
  updateExisting?: boolean;
  defaultCompanyId?: string;
  defaultPermissionTemplateId?: string;
}

export interface DirectoryImportError {
  row: number;
  field?: string;
  message: string;
}

export interface DirectoryImportResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: DirectoryImportError[];
}

export type DirectoryBulkAction =
  | "change_permission"
  | "change_status"
  | "add_to_groups"
  | "remove_from_groups";

export interface DirectoryBulkUpdatePayload {
  personIds: string[];
  action: DirectoryBulkAction;
  permissionTemplateId?: string;
  status?: "active" | "inactive";
  groupIds?: string[];
}

export interface DirectoryBulkUpdateResult {
  updated: number;
}

export interface DirectoryBulkInviteResult {
  invited: number;
  errors: DirectoryImportError[];
}

export interface DirectoryActivityEntry {
  id: string;
  person_id: string;
  project_id: number;
  action: string;
  action_description: string | null;
  performed_by: string | null;
  performed_at: string;
  changes?: Record<string, unknown>;
}

interface CsvRow {
  [key: string]: string;
}

const PEOPLE_HEADERS = [
  "first_name",
  "last_name",
  "email",
  "phone_mobile",
  "phone_business",
  "job_title",
  "company_name",
  "permission_template",
  "status",
];

const COMPANY_HEADERS = [
  "name",
  "address",
  "city",
  "state",
  "zip",
  "business_phone",
  "email_address",
  "company_type",
];

/**
 * Administrative helper around DirectoryService that handles import/export,
 * bulk operations, template generation, and activity log access.
 */
export class DirectoryAdminService {
  private directoryService: DirectoryService;
  private companyService: CompanyService;
  private inviteService: InviteService;

  constructor(private supabase: ReturnType<typeof createClient<Database>>) {
    this.directoryService = new DirectoryService(this.supabase);
    this.companyService = new CompanyService(this.supabase);
    this.inviteService = new InviteService(this.supabase);
  }

  async importFromCsv(
    projectId: string,
    fileBuffer: ArrayBuffer,
    options: DirectoryImportOptions,
    performedBy?: string,
  ): Promise<DirectoryImportResult> {
    const rows = this.parseCsv(fileBuffer, options);
    if (rows.length === 0) {
      throw new Error("The uploaded CSV file is empty.");
    }

    if (options.type === "companies") {
      return this.importCompanies(projectId, rows);
    }

    return this.importPeople(projectId, rows, options, performedBy);
  }

  async generateTemplateCsv(type: DirectoryTemplateType): Promise<string> {
    const templateRows =
      type === "companies"
        ? [COMPANY_HEADERS, COMPANY_HEADERS.map((header) => header.toUpperCase())]
        : [
            PEOPLE_HEADERS,
            PEOPLE_HEADERS.map((header) =>
              header === "permission_template"
                ? "Project Manager"
                : header === "company_name"
                  ? "Acme Construction"
                  : header === "status"
                    ? "active"
                    : header.replace("_", " "),
            ),
          ];

    return templateRows
      .map((row) => row.map((value) => this.escapeCsvValue(value)).join(","))
      .join("\n");
  }

  createExportStream(
    projectId: string,
    filters: DirectoryFilters,
    columns: DirectoryExportColumn[],
  ): ReadableStream {
    return new ReadableStream({
      start: async (controller) => {
        try {
          const header = columns
            .map((col) => this.escapeCsvValue(col.label))
            .join(",");
          controller.enqueue(`${header}\n`);

          const perPage = 500;
          let page = 1;

          while (true) {
            const result = await this.directoryService.getPeople(projectId, {
              ...filters,
              page,
              perPage,
            });

            for (const person of result.data) {
              const rowValues = columns.map((column) =>
                this.escapeCsvValue(
                  this.getColumnValue(person, column.id) ?? "",
                ),
              );
              controller.enqueue(`${rowValues.join(",")}\n`);
            }

            if (result.data.length < perPage) {
              break;
            }

            page += 1;
          }

          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });
  }

  async bulkUpdatePeople(
    projectId: string,
    payload: DirectoryBulkUpdatePayload,
    performedBy: string,
  ): Promise<DirectoryBulkUpdateResult> {
    if (payload.personIds.length === 0) {
      return { updated: 0 };
    }

    const projectIdNum = Number.parseInt(projectId, 10);

    if (payload.action === "change_permission") {
      if (!payload.permissionTemplateId) {
        throw new Error("permissionTemplateId is required for this action");
      }
      await this.supabase
        .from("project_directory_memberships")
        .update({ permission_template_id: payload.permissionTemplateId })
        .eq("project_id", projectIdNum)
        .in("person_id", payload.personIds);
    } else if (payload.action === "change_status") {
      if (!payload.status) {
        throw new Error("status is required for this action");
      }
      await this.supabase
        .from("project_directory_memberships")
        .update({ status: payload.status })
        .eq("project_id", projectIdNum)
        .in("person_id", payload.personIds);
    } else if (
      payload.action === "add_to_groups" ||
      payload.action === "remove_from_groups"
    ) {
      if (!payload.groupIds || payload.groupIds.length === 0) {
        throw new Error("groupIds are required for group actions");
      }
      if (payload.action === "add_to_groups") {
        const rows = payload.personIds.flatMap((personId) =>
          payload.groupIds!.map((groupId) => ({
            group_id: groupId,
            person_id: personId,
          })),
        );
        await this.supabase.from("distribution_group_members").upsert(rows, {
          onConflict: "group_id,person_id",
        });
      } else {
        for (const groupId of payload.groupIds) {
          await this.supabase
            .from("distribution_group_members")
            .delete()
            .eq("group_id", groupId)
            .in("person_id", payload.personIds);
        }
      }
    }

    await Promise.all(
      payload.personIds.map((personId) =>
        this.directoryService.logActivity(
          projectId,
          personId,
          `bulk_${payload.action}`,
          "Bulk directory action performed",
          payload as unknown as Record<string, unknown>,
          performedBy,
        ),
      ),
    );

    return { updated: payload.personIds.length };
  }

  async bulkInvite(
    projectId: string,
    personIds: string[],
  ): Promise<DirectoryBulkInviteResult> {
    const errors: DirectoryImportError[] = [];
    let invited = 0;

    for (const personId of personIds) {
      try {
        const result = await this.inviteService.resendInvite(projectId, personId);
        if (!result.success) {
          throw new Error(result.error ?? "Failed to send invite to user");
        }
        invited += 1;
      } catch (error) {
        errors.push({
          row: invited + errors.length + 1,
          message:
            error instanceof Error
              ? error.message
              : "Failed to send invite to user",
        });
      }
    }

    return { invited, errors };
  }

  async getActivityLog(
    projectId: string,
    options: { limit?: number; personId?: string } = {},
  ): Promise<DirectoryActivityEntry[]> {
    const projectIdNum = Number.parseInt(projectId, 10);

    let query = this.supabase
      .from("permission_audit_log")
      .select("*")
      .eq("project_id", projectIdNum)
      .order("created_at", { ascending: false })
      .limit(options.limit ?? 100);

    if (options.personId) {
      query = query.eq("person_id", options.personId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return ((data || []) as PermissionAuditLog[]).map((entry) => ({
      id: entry.id,
      person_id: entry.person_id,
      project_id: entry.project_id,
      action: entry.action,
      action_description: entry.module
        ? `Permission change recorded for ${entry.module}`
        : "Permission change recorded",
      performed_by: entry.changed_by,
      performed_at: entry.created_at,
      changes:
        entry.module || entry.old_level || entry.new_level
          ? {
              module: entry.module,
              old_level: entry.old_level,
              new_level: entry.new_level,
              template_id: entry.template_id,
            }
          : undefined,
    }));
  }

  private parseCsv(
    fileBuffer: ArrayBuffer,
    options: DirectoryImportOptions,
  ): CsvRow[] {
    const workbook = read(Buffer.from(fileBuffer), { type: "buffer" });
    if (workbook.SheetNames.length === 0) {
      throw new Error("No sheets found in uploaded CSV file");
    }

    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    const header = options.hasHeaders
      ? undefined
      : options.type === "companies"
        ? COMPANY_HEADERS
        : PEOPLE_HEADERS;

    const rows = utils.sheet_to_json<Record<string, unknown>>(sheet, {
      header,
      defval: "",
      blankrows: false,
    });

    return rows.map((row) => {
      const normalized: CsvRow = {};
      Object.entries(row).forEach(([key, value]) => {
        const normalizedKey = this.normalizeHeader(key);
        if (normalizedKey) {
          normalized[normalizedKey] =
            typeof value === "string"
              ? value.trim()
              : value !== null && value !== undefined
                ? String(value)
                : "";
        }
      });
      return normalized;
    });
  }

  private async importPeople(
    projectId: string,
    rows: CsvRow[],
    options: DirectoryImportOptions,
    performedBy?: string,
  ): Promise<DirectoryImportResult> {
    const stats: DirectoryImportResult = {
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    const projectIdNum = Number.parseInt(projectId, 10);
    const companies = await this.loadCompanyLookup(projectIdNum);
    const templates = await this.loadPermissionTemplates();
    const existingByEmail = new Map<string, PersonWithDetails>();

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = options.hasHeaders ? i + 2 : i + 1;
      const row = rows[i];

      try {
        const firstName = row.first_name;
        const lastName = row.last_name;

        if (!firstName || !lastName) {
          throw new Error("First and last name are required");
        }

        const personType = options.type === "users" ? "user" : "contact";
        const email = row.email?.toLowerCase() || null;
        const companyName = row.company_name || row.company;

        if (personType === "user" && !email) {
          throw new Error("Email is required for users");
        }

        let companyId = row.company_id || options.defaultCompanyId || null;
        if (!companyId && companyName) {
          companyId = await this.ensureCompany(
            projectId,
            companyName,
            companies,
          );
        }

        let permissionTemplateId =
          row.permission_template_id || options.defaultPermissionTemplateId;
        if (!permissionTemplateId && row.permission_template) {
          permissionTemplateId =
            templates.get(row.permission_template.toLowerCase())?.id;
        }

        if (personType === "user" && !permissionTemplateId) {
          throw new Error(
            "Permission template is required for user imports. Provide a default template or include a column.",
          );
        }

        const personData: PersonCreateDTO = {
          first_name: firstName,
          last_name: lastName,
          email: email || undefined,
          phone_mobile: row.phone_mobile || undefined,
          phone_business: row.phone_business || undefined,
          job_title: row.job_title || undefined,
          company_id: companyId || undefined,
          person_type: personType as PersonCreateDTO["person_type"],
          permission_template_id: permissionTemplateId || undefined,
        };

        let existingPerson = email
          ? existingByEmail.get(email)
          : undefined;

        if (!existingPerson && email) {
          const existing = await this.findPersonByEmail(projectId, email);
          if (existing) {
            existingPerson = existing;
            existingByEmail.set(email, existing);
          }
        }

        let targetPersonId: string | undefined = existingPerson?.id;

        if (existingPerson) {
          if (options.skipDuplicates) {
            stats.skipped += 1;
            continue;
          }

          if (!options.updateExisting) {
            throw new Error("Duplicate email detected");
          }

          const updatedPerson = await this.directoryService.updatePerson(
            projectId,
            existingPerson.id!,
            {
              ...personData,
              status:
                (row.status as "active" | "inactive") ||
                existingPerson.status ||
                undefined,
            },
          );
          stats.updated += 1;
          targetPersonId = updatedPerson.id;
          if (email) {
            existingByEmail.set(email, updatedPerson);
          }
        } else {
          const createdPerson = await this.directoryService.createPerson(
            projectId,
            personData,
          );

          if (email) {
            existingByEmail.set(email, createdPerson);
          }

          if (row.status === "inactive") {
            await this.directoryService.deactivatePerson(
              projectId,
              createdPerson.id,
            );
          }

          stats.imported += 1;
          targetPersonId = createdPerson.id;
        }

        if (performedBy && targetPersonId) {
          await this.directoryService.logActivity(
            projectId,
            targetPersonId,
            "import",
            "Imported via CSV",
            row,
            performedBy,
          );
        }
      } catch (error) {
        stats.errors.push({
          row: rowNumber,
          message:
            error instanceof Error ? error.message : "Unknown import error",
        });
        stats.skipped += 1;
      }
    }

    return stats;
  }

  private async importCompanies(
    projectId: string,
    rows: CsvRow[],
  ): Promise<DirectoryImportResult> {
    const stats: DirectoryImportResult = {
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 1;
      const row = rows[i];

      try {
        if (!row.name) {
          throw new Error("Company name is required");
        }

        await this.companyService.createCompany(projectId, {
          name: row.name,
          address: row.address,
          city: row.city,
          state: row.state,
          zip: row.zip,
          business_phone: row.business_phone,
          email_address: row.email_address,
          company_type: row.company_type
            ? (row.company_type.toUpperCase() as CompanyCreateDTO["company_type"])
            : undefined,
        });

        stats.imported += 1;
      } catch (error) {
        stats.errors.push({
          row: rowNumber,
          message:
            error instanceof Error ? error.message : "Unknown company import error",
        });
        stats.skipped += 1;
      }
    }

    return stats;
  }

  private async ensureCompany(
    projectId: string,
    companyName: string,
    cache: Map<string, string>,
  ): Promise<string> {
    const key = companyName.toLowerCase();
    const existing = cache.get(key);
    if (existing) {
      return existing;
    }

    const company = await this.companyService.createCompany(projectId, {
      name: companyName,
      company_type: "VENDOR",
    });

    cache.set(key, company.company_id);
    return company.company_id;
  }

  private async loadCompanyLookup(
    projectId: number,
  ): Promise<Map<string, string>> {
    const { data } = await this.supabase
      .from("project_companies")
      .select("company_id, company:companies(name)")
      .eq("project_id", projectId);

    const map = new Map<string, string>();
    (data || []).forEach((entry) => {
      const name = entry.company?.name;
      if (name) {
        map.set(name.toLowerCase(), entry.company_id);
      }
    });
    return map;
  }

  private async loadPermissionTemplates(): Promise<
    Map<string, PermissionTemplate>
  > {
    const { data } = await this.supabase
      .from("permission_templates")
      .select("*")
      .eq("scope", "project")
      .order("name");

    const map = new Map<string, PermissionTemplate>();
    (data || []).forEach((template) => {
      map.set(template.name.toLowerCase(), template);
    });
    return map;
  }

  private async findPersonByEmail(
    projectId: string,
    email: string,
  ): Promise<PersonWithDetails | undefined> {
    const projectIdNum = Number.parseInt(projectId, 10);
    const { data } = await this.supabase
      .from("people")
      .select(
        `
        *,
        company:companies!people_company_id_fkey(*),
        project_directory_memberships!inner(
          *,
          permission_template:permission_templates(*)
        )
      `,
      )
      .eq("email", email)
      .eq("project_directory_memberships.project_id", projectIdNum)
      .maybeSingle();

    if (!data) return undefined;

    return {
      ...data,
      membership: data.project_directory_memberships?.[0],
      permission_template:
        data.project_directory_memberships?.[0]?.permission_template ?? undefined,
    } as PersonWithDetails;
  }

  private getColumnValue(person: any, columnId: string): string | null {
    switch (columnId) {
      case "name":
        return `${person.first_name || ""} ${person.last_name || ""}`.trim();
      case "email":
        return person.email || "";
      case "phone":
        return person.phone_mobile || person.phone_business || "";
      case "job_title":
        return person.job_title || "";
      case "company":
        return person.company?.name || "";
      case "permission_template":
        return person.permission_template?.name || "";
      case "invite_status":
        return person.membership?.invite_status || "";
      case "status":
        return person.membership?.status || "";
      default:
        return person[columnId] ?? "";
    }
  }

  private escapeCsvValue(value: unknown): string {
    if (value === null || value === undefined) return "";
    const stringValue = String(value);
    if (/[",\n]/.test(stringValue)) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  }

  private normalizeHeader(header: string): string | null {
    const normalized = header.trim().toLowerCase().replace(/\s+/g, "_");
    if (!normalized) {
      return null;
    }
    return normalized;
  }
}
