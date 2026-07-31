import { z } from "zod";

export const semanticSearchDescription =
  "Perform a semantic (vector) search across all indexed content — emails, " +
  "meeting transcripts, Teams messages, documents, and project files. " +
  "Use when the user asks a broad cross-source question: 'what do we know about [topic]?', " +
  "'find anything related to [subject]', 'research [issue] across all sources'. " +
  "Returns ranked results from multiple source families with relevance scores.";

export const semanticSearchInputSchema = z.object({
  query: z
    .string()
    .describe("Natural language search query"),
  sourceFilter: z
    .array(z.string())
    .optional()
    .describe(
      "Optional source family filter: 'email', 'meeting', 'teams', 'document', 'rag'. " +
        "Omit to search all sources.",
    ),
  projectId: z.number().optional().describe("Filter to a specific project"),
  projectName: z
    .string()
    .optional()
    .describe("Project name (partial match) to resolve project filter"),
  sinceIso: z
    .string()
    .optional()
    .describe("Only results from after this ISO timestamp"),
  limit: z
    .number()
    .optional()
    .default(15)
    .describe("Max results to return (default 15)"),
});

export const searchExternalDocumentsDescription =
  "Search external documents stored in OneDrive/SharePoint via RAG " +
  "vector search. Use when the user asks to search uploaded files, " +
  "OneDrive documents, SharePoint content, or project files by content. " +
  "Returns relevant passages with source file references.";

export const searchExternalDocumentsInputSchema = z.object({
  query: z.string().describe("Search query — keywords or natural language question"),
  projectId: z.number().optional().describe("Filter to a specific project"),
  limit: z
    .number()
    .optional()
    .default(10)
    .describe("Max results to return (default 10)"),
});

export const findProjectDocumentsDescription =
  "**USE THIS to FIND specific documents/files for a project** — " +
  "permits, contracts, drawings, specs, certificates, daily reports, " +
  "RFIs, submittals, change orders, financial docs. " +
  "This is a STRUCTURED lookup against document_metadata by project " +
  "and document category/type/title keyword. NOT a content search — " +
  "use searchDocuments for content-inside-the-document queries " +
  "(e.g. 'what does the spec say about fire ratings'). " +
  "Returns: file_name, title, type, category, date, OneDrive link, " +
  "summary, and a content preview. " +
  "Examples: 'find the permit for Westfield Collective' " +
  "→ category='permit' or titleKeyword='permit'; " +
  "'show me drawings for Goodwill' → category='drawing' or titleKeyword='drawing'; " +
  "'pull the latest contract' → category='contract' ordered by date desc.";

export const findProjectDocumentsInputSchema = z.object({
  projectId: z.number().optional().describe("Project ID — use this when known"),
  projectName: z
    .string()
    .optional()
    .describe("Project name (partial, case-insensitive match)"),
  category: z
    .enum([
      "contract",
      "permit",
      "drawing",
      "specification",
      "submittal",
      "rfi",
      "daily_report",
      "change_order",
      "certificate",
      "insurance",
      "financial_document",
      "meeting",
      "email",
      "any",
    ])
    .optional()
    .default("any")
    .describe(
      "Filter by document category (legacy). 'any' returns all categories. Prefer documentType when available.",
    ),
  documentType: z
    .enum([
      "psr",
      "schedule",
      "submittal",
      "pay_app",
      "proposal",
      "estimate",
      "bid",
      "drawing",
      "specification",
      "permit",
      "rfi",
      "change_order",
      "subcontract",
      "contract",
      "safety",
      "closeout",
      "design",
      "photo",
      "executed_contract",
      "contract_proposal",
      "change_order_executed",
      "insurance_certificate",
      "lien_waiver_progress",
      "lien_waiver_final",
      "w9",
      "closeout_manual",
      "closeout_warranty",
      "closeout_asbuilt",
      "permit_inspection",
      "drawing_revision",
      "progress_photo",
      "email_message",
      "teams_message",
      "meeting_transcript",
      "invoice_document",
      "rfi_response",
      "daily_report",
      "email_attachment",
      "other",
    ])
    .optional()
    .describe(
      "Filter by structured document type. Prefer the canonical keys derived " +
        "from the SharePoint/OneDrive folder structure: " +
        "'show PSRs' → 'psr'; 'find the schedule' → 'schedule'; " +
        "'latest pay app' → 'pay_app'; 'submittals' → 'submittal'; " +
        "'the proposal' → 'proposal'; 'estimate' → 'estimate'; " +
        "'bid responses' → 'bid'; 'drawings' → 'drawing'; 'permit' → 'permit'; " +
        "'RFIs' → 'rfi'; 'change orders' → 'change_order'; " +
        "'subcontracts' → 'subcontract'; 'owner contract' → 'contract'; " +
        "'closeout / warranty / lien waiver' → 'closeout'. " +
        "(WIP financials live in PSR folders → use 'psr'.)",
    ),
  titleKeyword: z
    .string()
    .optional()
    .describe(
      "Substring to look for in file_name, title, or summary " +
        "(case-insensitive). Use when category alone isn't enough " +
        "(e.g. titleKeyword='certificate of occupancy').",
    ),
  sinceIso: z
    .string()
    .optional()
    .describe("Only documents whose date is >= this ISO timestamp"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(15)
    .describe("Max documents to return (1-50, default 15)"),
});

export const searchDocumentsDescription =
  "Vector SEARCH inside document CONTENT — meeting transcripts, email " +
  "bodies, doc text — by topic or keyword. Use ONLY when you need to " +
  "find the specific TEXT inside documents (e.g. 'what does the spec " +
  "say about fire ratings'). " +
  "For finding a specific FILE (the permit, the contract, the drawings) " +
  "use findProjectDocuments instead. " +
  "For project FACTS (address, phase, manager) use getProjectDetails. " +
  "Works across ALL projects by default; optionally filter by projectId/Name.";

export const searchDocumentsInputSchema = z.object({
  query: z.string().describe("Search keywords or phrases to find in documents"),
  projectId: z
    .number()
    .optional()
    .describe("Optional project ID to scope the search"),
  projectName: z
    .string()
    .optional()
    .describe(
      "Optional project name to resolve and filter by (e.g. 'Uniqlo', 'Cedar Park')",
    ),
  maxResults: z.number().optional().default(10).describe("Max results to return"),
});
