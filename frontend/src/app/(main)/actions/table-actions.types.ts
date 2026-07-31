import type { Database } from "@/types/database.types";

// Generic types for table operations
export type TableName = keyof Database["public"]["Tables"];

export type TableRow<T extends TableName> = Database["public"]["Tables"][T]["Row"];
export type TableInsert<T extends TableName> = Database["public"]["Tables"][T]["Insert"];
export type TableUpdate<T extends TableName> = Database["public"]["Tables"][T]["Update"];

// Specific table data types
export type MeetingData = TableUpdate<"document_metadata">;
export type ProjectData = TableUpdate<"projects">;
export type CompanyData = TableInsert<"companies">;
export type CompanyUpdateData = TableUpdate<"companies">;
export type ContactData = TableInsert<"people">;
export type ContactUpdateData = TableUpdate<"people">;

// Response types
export interface ActionResponse<T = unknown> {
  success?: boolean;
  error?: string;
  data?: T;
}

export type UpdateResponse = ActionResponse;
export type DeleteResponse = ActionResponse;
export type CreateResponse<T> = ActionResponse<T>;
