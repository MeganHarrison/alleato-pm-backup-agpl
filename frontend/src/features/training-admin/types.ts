export const TRAINING_ADMIN_TABLE_KEYS = [
  "training_resource",
  "training_role",
  "training_topic",
  "training_resource_role",
  "training_role_skill",
  "training_skill_checkin",
  "training_docs",
  "training_doc_assets",
  "training_doc_steps",
  "training_doc_relations",
] as const;

export type TrainingAdminTableKey =
  (typeof TRAINING_ADMIN_TABLE_KEYS)[number];

export type TrainingAdminRecord = Record<string, unknown> & {
  _rowKey: string;
};

export type TrainingAdminReferenceOption = {
  value: string;
  label: string;
};

export type TrainingAdminReferenceOptions = Record<
  string,
  TrainingAdminReferenceOption[]
>;

export type TrainingAdminFieldType =
  | "text"
  | "textarea"
  | "number"
  | "boolean"
  | "select"
  | "reference"
  | "date"
  | "datetime"
  | "json"
  | "string-array";

export type TrainingAdminFieldDefinition = {
  key: string;
  label: string;
  type: TrainingAdminFieldType;
  required?: boolean;
  nullable?: boolean;
  options?: TrainingAdminReferenceOption[];
  referenceKey?: string;
  placeholder?: string;
  help?: string;
  createOnly?: boolean;
};

export type TrainingAdminColumnDefinition = {
  key: string;
  label: string;
  defaultVisible?: boolean;
  alwaysVisible?: boolean;
  kind?: "text" | "number" | "boolean" | "status" | "date" | "reference";
  referenceKey?: string;
};

export type TrainingAdminFilterDefinition = {
  key: string;
  label: string;
  options?: TrainingAdminReferenceOption[];
  referenceKey?: string;
};

export type TrainingAdminTableDefinition = {
  key: TrainingAdminTableKey;
  label: string;
  singularLabel: string;
  description: string;
  columns: TrainingAdminColumnDefinition[];
  fields: TrainingAdminFieldDefinition[];
  filters?: TrainingAdminFilterDefinition[];
  defaults: Record<string, unknown>;
};

export type TrainingAdminListResponse = {
  records: TrainingAdminRecord[];
  references: TrainingAdminReferenceOptions;
};
