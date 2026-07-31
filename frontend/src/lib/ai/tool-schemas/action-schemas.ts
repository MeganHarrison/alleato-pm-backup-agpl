import { z } from "zod";
import { renderChangeRequestToolDescription } from "@/lib/ai/change-request-field-guide";
import {
  providerCompatibleEmailSchema,
  providerCompatibleIsoDateSchema,
  providerCompatibleOptionalIsoDateSchema,
} from "./provider-compatible";

export const generatedTaskPrioritySchema = z.enum([
  "low",
  "normal",
  "medium",
  "high",
  "critical",
  "urgent",
]);

export const generatedTaskStatusSchema = z.enum([
  "open",
  "in_progress",
  "completed",
  "done",
  "blocked",
  "cancelled",
]);

export const projectCompanyTypeSchema = z.enum([
  "YOUR_COMPANY",
  "VENDOR",
  "SUBCONTRACTOR",
  "SUPPLIER",
  "CONNECTED_COMPANY",
]);

export const createChangeOrderDescription =
  "Create a new prime contract change order (PCCO). Use when the user says " +
  "'create a change order', 'add a CO', or describes a scope change that needs " +
  "to be documented as a change order. Always show a preview and ask for " +
  "confirmation before writing. If projectId is unknown, call getPortfolioOverview first.";

export const createChangeOrderInputSchema = z.object({
  projectId: z.number().describe("Project ID — required"),
  contractId: z
    .string()
    .optional()
    .describe(
      "Prime contract ID (uuid) if known — prime_contract_change_orders.contract_id is a uuid FK, never a number",
    ),
  title: z.string().describe("Change order title"),
  totalAmount: z.number().optional().describe("Dollar amount — can be 0 if TBD"),
  status: z
    .enum(["draft", "pending", "submitted", "approved", "rejected", "void"])
    .default("draft")
    .describe("Initial status — defaults to draft"),
  confirmed: z
    .boolean()
    .default(false)
    .describe("Set to true only after user confirms the preview"),
  idempotencyKey: z
    .string()
    .optional()
    .describe("Optional idempotency key to prevent duplicate writes"),
});

export const createChangeEventDescription = renderChangeRequestToolDescription();

export const createChangeEventInputSchema = z.object({
  projectId: z.number().describe("Project ID — required"),
  title: z.string().min(1).describe("Short descriptive title"),
  description: z.string().optional().describe("Detailed description"),
  scope: z
    .string()
    .optional()
    .describe(
      "Native scope such as TBD, In Scope, Out of Scope, or legacy owner_change/design_error aliases.",
    ),
  type: z
    .string()
    .optional()
    .describe(
      "Native type such as Owner Change, Design Change, Allowance, Scope Gap, or supported legacy aliases.",
    ),
  status: z
    .string()
    .optional()
    .describe(
      "Native status such as Open, Pending Approval, Approved, Rejected, Closed, or Converted.",
    ),
  reason: z.string().optional().describe("Optional native reason."),
  origin: z.string().optional().describe("Optional native origin."),
  originId: z
    .string()
    .optional()
    .describe("Optional linked origin record id for the selected origin."),
  expectingRevenue: z
    .boolean()
    .optional()
    .describe("Whether revenue is expected. Defaults to true."),
  lineItemRevenueSource: z
    .string()
    .optional()
    .describe("Optional line item revenue calculation mode."),
  primeContractId: z
    .string()
    .optional()
    .describe("Optional prime contract UUID used as the markup basis."),
  confirmed: z.boolean().default(false),
  idempotencyKey: z
    .string()
    .optional()
    .describe("Optional idempotency key to prevent duplicate writes"),
});

export const updateProjectStatusDescription =
  "Update a project's health status or phase. Use when the user says " +
  "'mark [project] as at-risk', 'update status to [value]', or " +
  "'[project] is now in [phase]'. Always confirm before writing.";

export const updateProjectStatusInputSchema = z.object({
  projectId: z.number().describe("Project ID"),
  healthStatus: z
    .enum(["on_track", "at_risk", "critical", "complete", "on_hold"])
    .optional()
    .describe("New health status"),
  phase: z
    .enum(["Estimating", "Planning", "Current", "Complete", "On Hold"])
    .optional()
    .describe("New project phase"),
  reason: z.string().optional().describe("Brief reason for the status change"),
  confirmed: z.boolean().default(false),
  idempotencyKey: z
    .string()
    .optional()
    .describe("Optional idempotency key to prevent duplicate writes"),
});

export const createRFIDescription =
  "Create a new Request for Information (RFI). Use when the user says " +
  "'create an RFI', 'log an RFI about [topic]', or describes a field " +
  "question that needs a formal answer from the design team. Preview before writing.";

export const createRFIInputSchema = z.object({
  projectId: z.number().describe("Project ID"),
  subject: z.string().describe("RFI subject / title"),
  question: z.string().describe("The actual question being asked"),
  ballInCourt: z.string().optional().describe("Who is responsible for answering"),
  dueDate: z.string().optional().describe("ISO date string for response due date"),
  costImpact: z.enum(["yes", "no", "tbd"]).optional().default("tbd"),
  scheduleImpact: z.enum(["yes", "no", "tbd"]).optional().default("tbd"),
  confirmed: z.boolean().default(false),
  idempotencyKey: z
    .string()
    .optional()
    .describe("Optional idempotency key to prevent duplicate writes"),
});

export const createTaskDescription =
  "Create a schedule/Gantt task backed by schedule_tasks. Use only when the user is creating " +
  "a project schedule activity, milestone, or Gantt item. For action items, follow-ups, reminders, " +
  "or Tasks page records, use createGeneratedTask instead. Always show a preview and ask for confirmation before writing.";

export const createTaskInputSchema = z.object({
  projectId: z.number().describe("Project ID"),
  name: z.string().describe("Task name / description"),
  assignee: z.string().optional().describe("Person responsible"),
  dueDate: z.string().optional().describe("ISO due date"),
  notes: z.string().optional().describe("Additional context"),
  priority: z.enum(["low", "normal", "high", "critical"]).default("normal"),
  confirmed: z.boolean().default(false),
  idempotencyKey: z
    .string()
    .optional()
    .describe("Optional idempotency key to prevent duplicate writes"),
});

export const createGeneratedTaskDescription =
  "Create an action item in the main Tasks page task register (public.tasks). " +
  "Use this for AI-generated follow-ups, reminders, accountability items, or user-created action items " +
  "that should appear on /tasks or /[projectId]/tasks. If the action item supports a known schedule/Gantt task, pass scheduleTaskId to link it. Preview before writing.";

export const createGeneratedTaskInputSchema = z.object({
  projectId: z.number().optional().describe("Project ID if the task belongs to a project"),
  scheduleTaskId: z
    .string()
    .uuid()
    .optional()
    .describe(
      "Optional schedule_tasks.id when this action item supports a specific schedule/Gantt activity",
    ),
  title: z.string().describe("Short task title"),
  description: z.string().optional().describe("Task detail or source context"),
  assignee: z.string().optional().describe("Person responsible"),
  dueDate: z.string().optional().describe("ISO due date"),
  priority: generatedTaskPrioritySchema.default("normal"),
  status: generatedTaskStatusSchema.default("open"),
  confirmed: z.boolean().default(false),
  idempotencyKey: z
    .string()
    .optional()
    .describe("Optional idempotency key to prevent duplicate writes"),
});

export const updateGeneratedTaskDescription =
  "Update an existing task in the main Tasks page task register (public.tasks). " +
  "Use when the user asks to modify, reassign, reprioritize, close, or change a due date for a Tasks page item. Preview before writing.";

export const updateGeneratedTaskInputSchema = z.object({
  taskId: z.string().uuid().describe("Task ID from public.tasks"),
  title: z.string().optional(),
  description: z.string().optional(),
  assignee: z.string().optional(),
  dueDate: z.string().nullable().optional(),
  priority: generatedTaskPrioritySchema.optional(),
  status: generatedTaskStatusSchema.optional(),
  confirmed: z.boolean().default(false),
  idempotencyKey: z.string().optional(),
});

export const deleteGeneratedTaskDescription =
  "Delete an existing task from the main Tasks page task register (public.tasks). Preview before writing.";

export const deleteGeneratedTaskInputSchema = z.object({
  taskId: z.string().uuid().describe("Task ID from public.tasks"),
  reason: z.string().optional().describe("Why the task should be deleted"),
  confirmed: z.boolean().default(false),
  idempotencyKey: z.string().optional(),
});

export const createProjectCompanyDescription =
  "Add a company to a project's directory. Use when the user says 'add [company] to this project', " +
  "'add a vendor/subcontractor/supplier', or provides company directory details. Reuses an existing global company by exact name when possible, assigns it to the project, and previews before writing.";

export const createProjectCompanyInputSchema = z.object({
  projectId: z.number().describe("Project ID"),
  name: z.string().describe("Company name"),
  companyType: projectCompanyTypeSchema.default("VENDOR"),
  emailAddress: providerCompatibleEmailSchema
    .optional()
    .describe("Project directory email for the company"),
  businessPhone: z.string().optional().describe("Company business phone"),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  website: z.string().optional(),
  confirmed: z.boolean().default(false),
  idempotencyKey: z.string().optional(),
});

export const createProjectContactDescription =
  "Add a contact to a project's directory. Use when the user says 'add [person] as a contact', " +
  "'add this vendor contact to the project', or provides contact details. Reuses an existing person by email, links them to the project directory, optionally links their company, and previews before writing.";

export const createProjectContactInputSchema = z.object({
  projectId: z.number().describe("Project ID"),
  firstName: z.string().describe("Contact first name"),
  lastName: z.string().describe("Contact last name"),
  email: providerCompatibleEmailSchema.optional(),
  jobTitle: z.string().optional(),
  phoneBusiness: z.string().optional(),
  phoneMobile: z.string().optional(),
  companyId: z.string().uuid().optional().describe("Existing companies.id if known"),
  companyName: z.string().optional().describe("Existing company name to link by exact name"),
  role: z
    .string()
    .optional()
    .describe("Project-specific role, e.g. Architect, Owner Rep, Electrical PM"),
  makePrimaryCompanyContact: z.boolean().default(false),
  confirmed: z.boolean().default(false),
  idempotencyKey: z.string().optional(),
});

export const createContactInputSchema = z.object({
  firstName: z.string().describe("Contact first name"),
  lastName: z.string().describe("Contact last name"),
  email: providerCompatibleEmailSchema
    .optional()
    .describe("Contact email; used to de-duplicate existing people"),
  phone: z.string().optional().describe("Primary phone number (stored as phone_mobile)"),
  jobTitle: z.string().optional().describe("Job title, e.g. Project Manager"),
  department: z.string().optional().describe("Department / business unit, e.g. Operations"),
  companyId: z.string().uuid().optional().describe("Existing companies.id when known"),
  companyName: z
    .string()
    .optional()
    .describe("Company name to link by exact match when companyId is unknown"),
  notes: z.string().optional().describe("Freeform relationship notes"),
  confirmed: z
    .boolean()
    .default(false)
    .describe("Set to true only after the user submits the form"),
  idempotencyKey: z.string().optional(),
});

export const flagProjectRiskDescription =
  "Flag a project risk or insight. Use when the user says 'flag a risk', " +
  "'log an issue', or 'mark this as a concern'. Creates an AI insight record " +
  "that shows up in the risk dashboard. Preview before writing.";

export const flagProjectRiskInputSchema = z.object({
  projectId: z.number().describe("Project ID"),
  title: z.string().describe("Risk title — short, specific"),
  description: z.string().describe("Full description of the risk"),
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  insightType: z
    .enum([
      "financial_risk",
      "schedule_risk",
      "scope_risk",
      "team_risk",
      "client_risk",
      "general",
    ])
    .default("general"),
  financialImpact: z.number().optional().describe("Estimated dollar impact"),
  timelineImpactDays: z.number().optional().describe("Estimated schedule impact in days"),
  confirmed: z.boolean().default(false),
  idempotencyKey: z.string().optional(),
});

export const updateRFIStatusDescription =
  "Update the status of an existing RFI. Use when the user says " +
  "'close RFI #[n]', 'mark RFI [n] as answered', or 'RFI [n] is resolved'. " +
  "Always preview before writing.";

export const updateRFIStatusInputSchema = z.object({
  rfiId: z.string().optional().describe("RFI UUID if known"),
  rfiNumber: z.number().optional().describe("RFI number (easier to get from user)"),
  projectId: z.number().describe("Project ID — needed to look up by number"),
  newStatus: z.enum(["open", "answered", "closed", "void"]).describe("New status"),
  response: z.string().optional().describe("Optional response text to record"),
  confirmed: z.boolean().default(false),
  idempotencyKey: z.string().optional(),
});

export const createSubmittalDescription =
  "Create a new submittal. Use when the user says 'create a submittal for [spec section]', " +
  "'log a submittal', or 'we need to submit [material/equipment]'. " +
  "Always preview before writing.";

export const createSubmittalInputSchema = z.object({
  projectId: z.number().describe("Project ID"),
  title: z.string().describe("Submittal title, e.g. 'Structural Steel Shop Drawings'"),
  specSection: z.string().optional().describe("Spec section number, e.g. '05 12 00'"),
  dueDate: z.string().optional().describe("ISO due date"),
  submittedBy: z.string().default("TBD").describe("Subcontractor or party submitting"),
  status: z
    .enum([
      "Draft",
      "Open",
      "Distributed",
      "Closed",
      "submitted",
      "under_review",
      "requires_revision",
      "approved",
      "rejected",
      "superseded",
    ])
    .default("Draft"),
  confirmed: z.boolean().default(false),
  idempotencyKey: z.string().optional(),
});

export const logDailyReportDescription =
  "Create a daily log entry for a project. Use when the user says " +
  "'log today's daily report', 'record site activity for [date]', or " +
  "'add a daily log entry'. Weather conditions and notes are stored as JSON. " +
  "Always preview before writing.";

export const logDailyReportInputSchema = z.object({
  projectId: z.number().describe("Project ID"),
  logDate: z
    .string()
    .describe("ISO date, e.g. '2026-03-23'")
    .default(new Date().toISOString().split("T")[0]),
  weather: z.string().optional().describe("Weather description, e.g. 'Clear, 72°F'"),
  crewCount: z.number().optional().describe("Total workers on site"),
  workPerformed: z.string().optional().describe("Summary of work performed"),
  notes: z.string().optional().describe("Additional notes or observations"),
  confirmed: z.boolean().default(false),
  idempotencyKey: z.string().optional(),
});

export const generateProjectSummaryDescription =
  "Generate a comprehensive project status summary by pulling budget, schedule, " +
  "RFI, change order, and meeting data — then synthesizing it into a stored document. " +
  "Use when the user says 'give me a status summary', 'project report', or " +
  "'what's the status of [project]'. This creates a reusable document, not just a chat response.";

export const generateProjectSummaryInputSchema = z.object({
  projectId: z.number().optional().describe("Project ID (provide this OR projectName)"),
  projectName: z.string().optional().describe("Project name (fuzzy match)"),
  confirmed: z.boolean().default(false),
  idempotencyKey: z.string().optional(),
});

export const commitmentLineItemSchema = z.object({
  budgetCode: z.string().optional(),
  description: z.string().describe("SOV line item description"),
  amount: z.number().describe("Line item amount in dollars"),
  quantity: z.number().optional(),
  unitCost: z.number().optional(),
  uom: z.string().optional(),
  retainagePercent: z.number().optional(),
});

export const createCommitmentDescription =
  "Create a new commitment — either a subcontract (for labor/trade work) or a " +
  "purchase order (for materials or equipment). Use when the user says " +
  "'create a subcontract', 'add a PO', 'set up a commitment with [vendor]', " +
  "or describes awarding work to a subcontractor or supplier. " +
  "Always show a preview and ask for confirmation before writing. " +
  "If projectId is unknown, call getPortfolioOverview first.";

export const createCommitmentInputSchema = z.object({
  projectId: z.number().describe("Project ID — required"),
  type: z
    .enum(["subcontract", "purchase_order"])
    .describe(
      "Type of commitment: 'subcontract' for labor/trade work, 'purchase_order' for materials/equipment",
    ),
  title: z.string().describe("Commitment title, e.g. 'Electrical Work' or 'Structural Steel Supply'"),
  vendorName: z
    .string()
    .optional()
    .describe("Vendor or subcontractor company name — used to look up contract_company_id"),
  contractNumber: z
    .string()
    .optional()
    .describe("Contract number — auto-generated (SC-001 or PO-001) if not provided"),
  status: z
    .enum(["Draft", "Out for Bid", "Out for Signature", "Approved", "Complete", "Terminated", "Void"])
    .default("Draft")
    .describe("Initial status — defaults to Draft"),
  description: z.string().optional().describe("Scope description"),
  startDate: providerCompatibleOptionalIsoDateSchema
    .optional()
    .describe("ISO start date, e.g. '2026-04-01'; blank means unset"),
  estimatedCompletionDate: providerCompatibleOptionalIsoDateSchema
    .optional()
    .describe("ISO estimated completion date; blank means unset"),
  defaultRetainagePercent: z
    .number()
    .optional()
    .describe("Default retainage percentage, e.g. 10 for 10%"),
  lineItems: z
    .array(commitmentLineItemSchema)
    .optional()
    .describe("Optional SOV line items to create with the commitment after confirmation"),
  confirmed: z
    .boolean()
    .default(false)
    .describe("Set to true only after user confirms the preview"),
  idempotencyKey: z
    .string()
    .optional()
    .describe("Optional idempotency key to prevent duplicate writes"),
});

const optionalPrimeContractUuid = z
  .union([z.string().uuid(), z.literal("")])
  .optional();

const optionalPrimeContractText = (maximum: number) =>
  z
    .union([z.string().trim().min(1).max(maximum), z.literal("")])
    .optional();

export const primeContractLineItemSchema = z.object({
  description: z.string().trim().min(1).max(500).describe("SOV line description"),
  amount: z.number().min(0).describe("SOV line amount in dollars"),
  budgetCodeId: optionalPrimeContractUuid.describe("Existing project budget-code UUID"),
  costCodeId: optionalPrimeContractText(100).describe("Existing cost-code text ID"),
  quantity: z.number().min(0).optional(),
  unitCost: z.number().min(0).optional(),
  unitOfMeasure: z.string().trim().max(50).optional(),
});

const primeContractWorkbookRowSchema = z.object({
  sourceSheet: z.enum(["General Conditions", "Details"]),
  rowNumber: z.number().int().positive(),
  costCode: z.string().trim().min(1),
  costTypeCode: z.string().trim().min(1).max(10),
  description: z.string().trim().min(1),
  workDescription: z.string().trim().nullable().optional(),
  budgetAmount: z.number().positive(),
  unitQty: z.number().nonnegative().nullable().optional(),
  unitOfMeasure: z.string().trim().nullable().optional(),
  unitCost: z.number().nonnegative().nullable().optional(),
  warnings: z.array(z.string()).default([]),
});

export const createPrimeContractDescription =
  "Draft and create a project Prime Contract (the owner/client contract) with a Schedule of Values. " +
  "Use manual rows, current project budget lines, or canonical structured rows from an attached Alleato Estimate Workbook. " +
  "Use when the user asks to create, set up, or draft a Prime Contract. Always call this tool with " +
  "confirmed: false first so the user can review the contract number, owner, commercial terms, and " +
  "SOV. Use confirmed: true only after explicit user confirmation; the runtime will require a separate " +
  "approval before any record is written.";

export const createPrimeContractInputSchema = z.object({
  projectId: z.number().int().positive().describe("Project ID — required"),
  title: z.string().trim().min(1).max(500).describe("Prime Contract title"),
  contractNumber: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .describe("Contract number; auto-generated as PC-#### when omitted"),
  ownerCompanyId: optionalPrimeContractUuid.describe("Exact owner/client company UUID"),
  ownerCompanyName: optionalPrimeContractText(500).describe(
    "Owner/client company name to resolve without guessing ambiguous matches",
  ),
  description: z.string().trim().max(5000).optional(),
  status: z
    .enum(["draft", "out_for_signature", "approved", "complete", "terminated"])
    .default("draft"),
  startDate: providerCompatibleIsoDateSchema.optional(),
  endDate: providerCompatibleIsoDateSchema.optional(),
  retentionPercentage: z.number().min(0).max(100).default(0),
  paymentTerms: z.string().trim().max(500).optional(),
  billingSchedule: z.string().trim().max(500).optional(),
  inclusions: z.string().trim().max(5000).optional(),
  exclusions: z.string().trim().max(5000).optional(),
  isPrivate: z.boolean().default(false),
  allowedUserIds: z.array(z.string().uuid()).default([]),
  allowSovView: z.boolean().default(false),
  sovSource: z.enum(["manual", "budget", "workbook"]).default("manual"),
  budgetLineIds: z
    .array(z.string().uuid())
    .max(500)
    .optional()
    .describe(
      "For budget-backed SOVs, the exact budget-line UUIDs to import; omit to import all positive project budget lines",
    ),
  workbookRows: z
    .array(primeContractWorkbookRowSchema)
    .max(500)
    .optional()
    .describe(
      "Canonical structured rows extracted from an attached Alleato Estimate Workbook; pass them exactly as provided",
    ),
  workbookOmittedRows: z
    .number()
    .int()
    .nonnegative()
    .default(0)
    .describe("Rows omitted by the bounded attachment handoff; any positive value blocks creation"),
  lineItems: z.array(primeContractLineItemSchema).default([]),
  confirmed: z
    .boolean()
    .default(false)
    .describe("False renders a no-write draft; true requests the separately approved write"),
  idempotencyKey: z.string().trim().min(1).optional(),
});

export const editPrimeContractSovRowSchema = z
  .object({
    projectBudgetCodeId: optionalPrimeContractUuid.describe(
      "Exact active project budget-code UUID; preferred when known",
    ),
    costCode: optionalPrimeContractText(100).describe(
      "Project cost code, with punctuation optional (for example 01-3120 or 013120)",
    ),
    costType: optionalPrimeContractText(100).describe(
      "Cost type code or description, such as L or Labor. Omit it when the screenshot does not show one; the tool may resolve it only when exact cost code and amount identify one project budget row",
    ),
    description: optionalPrimeContractText(500).describe(
      "SOV description; defaults to the active project budget-code description",
    ),
    amount: z.number().finite().min(0).describe("SOV row amount in dollars"),
    quantity: z.number().finite().positive().optional(),
    unitCost: z.number().finite().min(0).optional(),
    unitOfMeasure: optionalPrimeContractText(50),
  })
  .superRefine((row, context) => {
    if (!row.projectBudgetCodeId && !row.costCode) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide projectBudgetCodeId or costCode.",
        path: ["costCode"],
      });
    }
    if ((row.quantity === undefined) !== (row.unitCost === undefined)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide both quantity and unitCost, or omit both and use amount.",
        path: ["quantity"],
      });
    }
  });

export const editPrimeContractSovDescription =
  "Preview and edit the Schedule of Values on an existing draft Prime Contract. " +
  "Use this anywhere in Alleato AI when the user asks to add missing cost codes or update existing SOV amounts. " +
  "Rows resolve only to active project budget codes. When cost type is omitted, exact cost code plus amount may resolve it from the project budget; ambiguous rows block instead of guessing. " +
  "Matching rows are updated and new rows are appended. " +
  "This tool never deletes omitted rows and blocks non-draft contracts. Always call with confirmed: false first, " +
  "then pass the returned previewToken with confirmed: true only after the user explicitly approves that preview.";

export const editPrimeContractSovInputSchema = z
  .object({
    projectId: z.number().int().positive().describe("Project ID"),
    contractId: z.string().uuid().describe("Existing Prime Contract UUID"),
    rows: z.array(editPrimeContractSovRowSchema).min(1).max(500),
    confirmed: z
      .boolean()
      .default(false)
      .describe("False returns a no-write preview; true requests the separately approved write"),
    previewToken: z
      .string()
      .uuid()
      .optional()
      .describe(
        "Opaque token returned by the immediately preceding preview; required unchanged for confirmation",
      ),
    idempotencyKey: z.string().trim().min(1).optional(),
  })
  .superRefine((input, context) => {
    if (input.confirmed && !input.previewToken) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Run the no-write preview first and pass its previewToken when confirming.",
        path: ["previewToken"],
      });
    }
  });
