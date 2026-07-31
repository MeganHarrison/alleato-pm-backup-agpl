export interface AppHelpArticle {
  title: string;
  description: string;
  slug: string;
  routes: string[];
}

export interface AppHelpToolGroup {
  title: string;
  description: string;
  articles: AppHelpArticle[];
}

const DOCS_BASE_URL = "https://docs.alleatogroup.com/help/articles";

function article(
  slug: string,
  title: string,
  description: string,
  routes: string[],
): AppHelpArticle {
  return {
    slug,
    title,
    description,
    routes,
  };
}

export function getAppHelpArticleUrl(slug: string) {
  return `${DOCS_BASE_URL}/${slug}`;
}

export const appHelpToolGroups: AppHelpToolGroup[] = [
  {
    title: "Projects",
    description:
      "Project creation, project setup, and project-level workspace entry points.",
    articles: [
      article(
        "create-a-project",
        "Create a Project",
        "Create a new project record and open the project workspace.",
        ["/create-project", "/projects", "/projects/new"],
      ),
    ],
  },
  {
    title: "Budget",
    description:
      "Project budget setup, line items, forecasts, and cost-code reference.",
    articles: [
      article(
        "budget-overview",
        "Budget Overview",
        "Understand the budget table and how to read project financials.",
        ["/[projectId]/budget"],
      ),
      article(
        "budget-line-items",
        "Budget Line Items",
        "Add, edit, and modify budget line items.",
        ["/[projectId]/budget"],
      ),
      article(
        "budget-reference",
        "Budget Reference",
        "Column definitions, formulas, forecast methods, and source data.",
        ["/[projectId]/budget", "/[projectId]/budget/setup"],
      ),
    ],
  },
  {
    title: "Prime Contracts",
    description:
      "Owner contracts, schedule of values, and prime contract modifications.",
    articles: [
      article(
        "prime-contracts",
        "Prime Contracts",
        "Manage the owner contract, SOV, and contract value changes.",
        ["/[projectId]/prime-contracts"],
      ),
    ],
  },
  {
    title: "Commitments",
    description:
      "Subcontracts, purchase orders, SOVs, commitment changes, and invoices.",
    articles: [
      article(
        "commitments",
        "Commitments",
        "Manage subcontracts, purchase orders, vendors, and SOVs.",
        ["/[projectId]/commitments"],
      ),
      article(
        "commitments-reference",
        "Commitments Reference",
        "Statuses, columns, change orders, retainage, and budget connections.",
        ["/[projectId]/commitments"],
      ),
      article(
        "submit-invoice",
        "Submit an Invoice",
        "Subcontractor pay application workflow against a commitment SOV.",
        ["/[projectId]/invoicing/subcontractor/new"],
      ),
    ],
  },
  {
    title: "Change Events",
    description: "Potential changes before they become formal change orders.",
    articles: [
      article(
        "change-events",
        "Change Events",
        "Track pricing, scope changes, and potential cost or schedule impact.",
        ["/[projectId]/change-events"],
      ),
      article(
        "change-event-to-change-order-workflow",
        "Change Event to Change Order Workflow",
        "Follow a scope change from initial capture through owner approval.",
        ["/[projectId]/change-events", "/[projectId]/change-orders"],
      ),
    ],
  },
  {
    title: "Change Orders",
    description: "Formal owner changes, approval, and contract updates.",
    articles: [
      article(
        "change-orders",
        "Change Orders",
        "Generate, approve, and issue prime contract change orders.",
        ["/[projectId]/change-orders"],
      ),
      article(
        "change-event-to-change-order-workflow",
        "Change Event to Change Order Workflow",
        "Understand how approved change events become formal change orders.",
        ["/[projectId]/change-management"],
      ),
    ],
  },
  {
    title: "Schedule",
    description:
      "Tasks, milestones, dependencies, Gantt, board, timeline, and calendar views.",
    articles: [
      article(
        "schedule",
        "Schedule",
        "View and manage project schedule work across planning and execution views.",
        ["/[projectId]/schedule"],
      ),
    ],
  },
  {
    title: "Meetings",
    description:
      "Meeting transcripts, AI summaries, action items, and meeting intelligence.",
    articles: [
      article(
        "meetings",
        "Meetings",
        "Review transcripts, summaries, extracted action items, and meeting prep.",
        ["/[projectId]/meetings"],
      ),
      article(
        "ai-meeting-intelligence",
        "Ask the AI About Meetings",
        "Use meeting transcripts and decisions as source-backed AI context.",
        ["/ai", "/[projectId]/meetings"],
      ),
    ],
  },
  {
    title: "RFIs and Submittals",
    description:
      "Communication workflows for design questions and submittal reviews.",
    articles: [
      article(
        "rfis",
        "RFIs",
        "Create, track, answer, and close requests for information.",
        ["/[projectId]/rfis"],
      ),
      article(
        "submittals",
        "Submittals",
        "Manage the submittal log, review workflow, and revisions.",
        ["/[projectId]/submittals"],
      ),
    ],
  },
  {
    title: "Documents and Drawings",
    description:
      "Project files, drawings, specifications, annotations, and transmittals.",
    articles: [
      article(
        "documents",
        "Documents",
        "Manage project files in folders with versions and downloads.",
        ["/[projectId]/documents"],
      ),
      article(
        "drawings",
        "Drawings",
        "Upload, version, and organize construction drawings.",
        ["/[projectId]/drawings"],
      ),
      article(
        "drawings-viewer",
        "Drawing Viewer and Annotations",
        "Mark up drawings and link pins to RFIs, punch items, and photos.",
        ["/[projectId]/drawings"],
      ),
      article(
        "specifications",
        "Specifications",
        "Browse spec sections, revisions, downloads, and subscriptions.",
        ["/[projectId]/specifications"],
      ),
      article(
        "transmittals",
        "Transmittals",
        "Create formal cover sheets for documents sent or received.",
        ["/[projectId]/transmittals"],
      ),
    ],
  },
  {
    title: "Directory and People",
    description:
      "Company directory, project roster, users, roles, and permissions.",
    articles: [
      article(
        "company-directory",
        "Company Directory",
        "Manage companies, contacts, vendors, prospects, and employees.",
        ["/directory"],
      ),
      article(
        "project-directory",
        "Project Directory",
        "Manage a project team roster with roles and company affiliation.",
        ["/[projectId]/directory"],
      ),
      article(
        "create-or-invite-a-user",
        "Create or Invite a User",
        "Add users and explain how invited users finish setup.",
        ["/user-management"],
      ),
      article(
        "manage-permissions",
        "Manage User Access",
        "Manage users, roles, project access, and sensitive modules.",
        ["/user-management", "/[projectId]/user-management"],
      ),
    ],
  },
  {
    title: "AI Assistant",
    description:
      "Ask Alleato, project intelligence, AI actions, memory, and source-backed answers.",
    articles: [
      article(
        "ai-assistant-overview",
        "AI Assistant Overview",
        "Understand Ask Alleato and the embedded advisor system.",
        ["/ai"],
      ),
      article(
        "ai-assistant-actions",
        "What the AI Assistant Can Do",
        "Review Eve's governed RFI action and the mutations that remain unavailable.",
        ["/ai"],
      ),
      article(
        "project-intelligence",
        "Project Intelligence",
        "Review the AI-compiled project storyline and evidence.",
        ["/[projectId]/intelligence"],
      ),
      article(
        "ai-memory",
        "AI Memory",
        "View and manage remembered facts and preferences.",
        ["/settings/memory"],
      ),
    ],
  },
  {
    title: "Estimates",
    description:
      "Conceptual and detailed cost estimates that feed the project budget.",
    articles: [
      article(
        "estimates",
        "Estimates",
        "Build and manage project cost estimates.",
        ["/[projectId]/estimates"],
      ),
    ],
  },
  {
    title: "Direct Costs",
    description:
      "Costs booked directly to the project outside of subcontracts and purchase orders.",
    articles: [
      article(
        "direct-costs",
        "Direct Costs",
        "Record and track project direct costs.",
        ["/[projectId]/direct-costs"],
      ),
    ],
  },
  {
    title: "Invoicing",
    description:
      "Owner and subcontractor billing, pay applications, and invoice review.",
    articles: [
      article(
        "invoicing",
        "Invoicing",
        "Manage owner and subcontractor invoices and pay applications.",
        ["/[projectId]/invoicing"],
      ),
    ],
  },
  {
    title: "Field Operations",
    description:
      "Daily logs, photos, and punch lists captured from the field.",
    articles: [
      article(
        "daily-log",
        "Daily Log",
        "Capture daily field activity, weather, manpower, and notes.",
        ["/[projectId]/daily-log"],
      ),
      article(
        "photos",
        "Photos",
        "Upload, organize, and reference project photos.",
        ["/[projectId]/photos"],
      ),
      article(
        "punch-list",
        "Punch List",
        "Track and close out punch items before completion.",
        ["/[projectId]/punch-list"],
      ),
    ],
  },
  {
    title: "Integrations",
    description:
      "Connected systems: Outlook, Teams, and Acumatica ERP.",
    articles: [
      article(
        "outlook-integration",
        "Outlook Integration",
        "Connect Outlook so project email flows into the platform.",
        ["/settings/integrations"],
      ),
      article(
        "acumatica-integration",
        "Acumatica Integration",
        "How financial data syncs from Acumatica ERP.",
        ["/settings/integrations"],
      ),
    ],
  },
  {
    title: "Settings and Permissions",
    description:
      "Account settings, notifications, user management, and access control.",
    articles: [
      article(
        "permissions-admin",
        "Permissions and Access",
        "Manage roles, project access, and sensitive modules.",
        ["/user-management", "/settings"],
      ),
      article(
        "notifications",
        "Notifications",
        "Control how and when the platform notifies you.",
        ["/settings"],
      ),
    ],
  },
  {
    title: "Subcontractors",
    description:
      "The subcontractor portal: assigned work and invoice submission.",
    articles: [
      article(
        "my-work",
        "My Work",
        "How subcontractors see assigned work across projects.",
        ["/my-work"],
      ),
    ],
  },
  {
    title: "Training Docs",
    description:
      "AI-assisted training doc drafting, screenshot capture, review, and publishing.",
    articles: [
      article(
        "training-docs",
        "Training Docs",
        "Create, review, and publish app training documentation.",
        ["/training-docs"],
      ),
    ],
  },
];
