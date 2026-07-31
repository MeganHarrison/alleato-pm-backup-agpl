// Shared navigation configuration for site header and sidebar
// This ensures consistency between different navigation components

import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Bot,
  Brain,
  BrainCircuit,
  Briefcase,
  Bug,
  Building2,
  Compass,
  FlaskConical,
  Calendar,
  Camera,
  CheckCircle,
  ClipboardList,
  Clock,
  DollarSign,
  FileImage,
  FileText,
  FolderOpen,
  Hammer,
  Home,
  Kanban,
  LayoutDashboard,
  Lock,
  Mail,
  MessageCircle,
  Package,
  Receipt,
  Shield,
  Sparkles,
  Table,
  SlidersHorizontal,
  TrendingUp,
  UserCog,
  Users,
  Wrench,
} from "lucide-react";
import { hasModulePermission } from "@/hooks/use-project-permissions";
import { OWNER_EMAIL, isOwnerEmail } from "@/lib/auth/owner";
import {
  canAccessUserManagement,
  type UserManagementAccessProfile,
} from "@/lib/auth/user-management-access.shared";

/**
 * The single owner of the workspace. Tools flagged `ownerOnly` are visible only
 * to this user — used to hide internal vision/roadmap surfaces from the team.
 *
 * Defined in the server-safe `@/lib/auth/owner` module and re-exported here so
 * existing client imports (`@/lib/navigation-config`) keep working while API
 * routes can import the constant without pulling in client-only navigation code.
 */
export { OWNER_EMAIL };

export type PermissionModule =
  | "directory"
  | "budget"
  | "contracts"
  | "documents"
  | "schedule"
  | "submittals"
  | "rfis"
  | "change_orders";

export interface NavigationTool {
  name: string;
  path: string;
  icon?: LucideIcon;
  requiresProject?: boolean;
  isFavorite?: boolean;
  /** Display this tool only when no project is selected */
  onlyWithoutProject?: boolean;
  /** Permission module required to see this tool. If omitted, always visible. */
  module?: PermissionModule;
  /** Minimum permission level required. Defaults to "read". */
  requiredPermission?: "read" | "write" | "admin";
  /** If true, only visible to app admins or developers. */
  adminOnly?: boolean;
  /** Named access policy for admin-adjacent tools that allow role/title access. */
  accessPolicy?: "userManagement";
  /** If true, only visible to users with the developer role. */
  developerOnly?: boolean;
  /** If true, only visible to users with user_type === "subcontractor". */
  subcontractorOnly?: boolean;
  /** If true, only visible to the workspace owner (OWNER_EMAIL). */
  ownerOnly?: boolean;
}

// Extended type for header navigation with icons and descriptions
export interface HeaderNavigationTool extends NavigationTool {
  icon?: LucideIcon;
  description?: string;
}

// Sub-grouping within a mega menu panel
export interface HeaderSubGroup {
  label: string;
  toolNames: string[];
  columns?: 1 | 2;
}

// A navigation group in the header (Planning, Finance, Company)
export interface HeaderNavGroup {
  id: string;
  label: string;
  tools: HeaderNavigationTool[];
  subGroups?: HeaderSubGroup[];
}

export const companyWideHeaderTools: HeaderNavigationTool[] = [
  {
    name: "Alleato AI",
    path: "ai",
    requiresProject: false,
    icon: Bot,
    description: "AI-powered project guidance",
  },
  {
    name: "AI Features",
    path: "ai/features",
    requiresProject: false,
    icon: Sparkles,
    description: "Browse AI workflows by the job they support",
  },
  {
    name: "Company",
    path: "",
    requiresProject: false,
    icon: Briefcase,
    description: "Company home",
  },
  {
    name: "Company Directory",
    path: "directory/companies",
    requiresProject: false,
    icon: Users,
    description: "People, companies, contacts",
    module: "directory",
  },
  {
    name: "Deals",
    path: "deals",
    requiresProject: false,
    icon: DollarSign,
    description: "CRM pipeline — deals across prospects and clients",
  },
  {
    name: "User Management",
    path: "user-management",
    requiresProject: false,
    icon: UserCog,
    description: "Users, roles, and permission templates",
    adminOnly: true,
    accessPolicy: "userManagement",
  },
  {
    name: "Daily Brief",
    path: "daily-brief",
    requiresProject: false,
    icon: Sparkles,
    description: "Owner-facing daily executive brief",
  },
  {
    name: "Meetings",
    path: "meetings",
    requiresProject: false,
    icon: Users,
    description: "Company-wide meetings and segments",
  },
  {
    name: "Tasks",
    path: "tasks",
    requiresProject: false,
    icon: CheckCircle,
    description: "Company task board",
  },
  {
    name: "Documentation",
    path: "https://alleato-docs-site.vercel.app/",
    requiresProject: false,
    icon: BookOpen,
    description: "Alleato documentation site",
  },
  {
    name: "Estimates",
    path: "estimates",
    requiresProject: false,
    icon: ClipboardList,
    description: "All estimates across projects",
  },
  {
    name: "Prime Contracts",
    path: "prime-contracts",
    requiresProject: false,
    icon: FileText,
    description: "All prime contracts across projects",
  },
  {
    name: "Change Events",
    path: "change-events",
    requiresProject: false,
    icon: Clock,
    description: "All change events across projects",
  },
  {
    name: "Potential Change Orders",
    path: "potential-change-orders",
    requiresProject: false,
    icon: Receipt,
    description: "AI-surfaced change-order signals to review",
  },
];

export const developerCompanyAdminTools: HeaderNavigationTool[] = [
  {
    name: "Admin Dashboard",
    path: "admin",
    requiresProject: false,
    icon: Shield,
    description: "Internal admin command center",
    developerOnly: true,
  },
  {
    name: "Project Intelligence",
    path: "intelligence",
    requiresProject: true,
    icon: Brain,
    description: "Current project intelligence packet",
    developerOnly: true,
  },
  {
    name: "Project Attribution",
    path: "project-attribution",
    requiresProject: false,
    icon: Brain,
    description: "Communication project mapping",
    developerOnly: true,
  },
  {
    name: "Operations Readiness",
    path: "operations-readiness",
    requiresProject: false,
    icon: CheckCircle,
    description: "Source sync, tasks, packets, and daily brief readiness",
    developerOnly: true,
  },
  {
    name: "AI Chat History",
    path: "ai-chat-history",
    requiresProject: false,
    icon: Bot,
    description: "Assistant turns with traces, tools, usage, and write status",
    developerOnly: true,
  },
  {
    name: "Task Training",
    path: "task-training",
    requiresProject: false,
    icon: Brain,
    description: "Task extraction and learning review",
    developerOnly: true,
  },
  {
    name: "Training Docs",
    path: "training-docs",
    requiresProject: false,
    icon: BookOpen,
    description: "Draft and publish reviewed workflow manuals",
    developerOnly: true,
  },
  {
    name: "Training Map",
    path: "training-map",
    requiresProject: false,
    icon: Compass,
    description: "Coverage of training docs by tool and QA status",
    developerOnly: true,
  },
  {
    name: "Knowledge Sources",
    path: "knowledge/manage",
    requiresProject: false,
    icon: BookOpen,
    description: "AI knowledge source management",
    developerOnly: true,
  },
  {
    name: "Assistant Eval Runs",
    path: "eval-runs",
    requiresProject: false,
    icon: FlaskConical,
    description: "AI-assistant eval results: pass/fail, tools fired, answers",
    developerOnly: true,
  },
  {
    name: "Deep Research Archive",
    path: "deep-research",
    requiresProject: false,
    icon: BookOpen,
    description: "Past Deep Agents wiki research projects",
    developerOnly: true,
  },
  {
    name: "Annotation Inbox",
    path: "annotation-inbox",
    requiresProject: false,
    icon: MessageCircle,
    description: "Agentation annotation triage",
    developerOnly: true,
  },
];

/**
 * Development section — visible only to the workspace owner (OWNER_EMAIL).
 * Includes all non-assistant AI tools + internal admin surfaces.
 */
export const developmentTools: HeaderNavigationTool[] = [
  // AI tools (non-assistant)
  {
    name: "AI Vision",
    path: "ai-vision",
    requiresProject: false,
    icon: Compass,
    description: "The AI build vision, agent team, and tool roadmap",
    ownerOnly: true,
  },
  {
    name: "Skill Library",
    path: "ai/skills",
    requiresProject: false,
    icon: Brain,
    description: "Approved assistant skills",
    ownerOnly: true,
  },
  {
    name: "Teach Alleato",
    path: "ai/teach",
    requiresProject: false,
    icon: BrainCircuit,
    description: "Submit field knowledge for review",
    ownerOnly: true,
  },
  {
    name: "AI Learning Promotions",
    path: "ai/learning-promotions",
    requiresProject: false,
    icon: Sparkles,
    description: "Review candidate AI learnings",
    ownerOnly: true,
  },
  {
    name: "AI Skills Admin",
    path: "ai/admin/skills",
    requiresProject: false,
    icon: Shield,
    description: "Review Skill Library records",
    ownerOnly: true,
  },
  // Internal admin surfaces
  {
    name: "Admin Dashboard",
    path: "admin",
    requiresProject: false,
    icon: Shield,
    description: "Internal admin command center",
    ownerOnly: true,
  },
  {
    name: "Project Intelligence",
    path: "intelligence",
    requiresProject: true,
    icon: Brain,
    description: "Current project intelligence packet",
    ownerOnly: true,
  },
  {
    name: "Project Attribution",
    path: "project-attribution",
    requiresProject: false,
    icon: Brain,
    description: "Communication project mapping",
    ownerOnly: true,
  },
  {
    name: "Operations Readiness",
    path: "operations-readiness",
    requiresProject: false,
    icon: CheckCircle,
    description: "Source sync, tasks, packets, and daily brief readiness",
    ownerOnly: true,
  },
  {
    name: "Task Training",
    path: "task-training",
    requiresProject: false,
    icon: Brain,
    description: "Task extraction and learning review",
    ownerOnly: true,
  },
  {
    name: "Training Docs",
    path: "training-docs",
    requiresProject: false,
    icon: BookOpen,
    description: "Draft and publish reviewed workflow manuals",
    ownerOnly: true,
  },
  {
    name: "Training Map",
    path: "training-map",
    requiresProject: false,
    icon: Compass,
    description: "Coverage of training docs by tool and QA status",
    ownerOnly: true,
  },
  {
    name: "Knowledge Sources",
    path: "knowledge/manage",
    requiresProject: false,
    icon: BookOpen,
    description: "AI knowledge source management",
    ownerOnly: true,
  },
  {
    name: "Assistant Eval Runs",
    path: "eval-runs",
    requiresProject: false,
    icon: FlaskConical,
    description: "AI-assistant eval results: pass/fail, tools fired, answers",
    ownerOnly: true,
  },
  {
    name: "Deep Research Archive",
    path: "deep-research",
    requiresProject: false,
    icon: BookOpen,
    description: "Past Deep Agents wiki research projects",
    ownerOnly: true,
  },
  {
    name: "Annotation Inbox",
    path: "annotation-inbox",
    requiresProject: false,
    icon: MessageCircle,
    description: "Agentation annotation triage",
    ownerOnly: true,
  },
];

export interface CompanyWideToolSection {
  label: string;
  toolNames: string[];
}

export const companyWideToolSections: CompanyWideToolSection[] = [
  {
    label: "Company",
    toolNames: [
      "Company",
      "Company Directory",
      "User Management",
      "Alleato AI",
      "Admin Dashboard",
    ],
  },
  {
    label: "Work",
    toolNames: ["Meetings", "Tasks", "Documentation"],
  },
  {
    label: "Financial",
    toolNames: [
      "Estimates",
      "Prime Contracts",
      "Change Events",
      "Potential Change Orders",
    ],
  },
];

export const coreTools: NavigationTool[] = [
  { name: "Company", path: "", icon: Briefcase, requiresProject: false },
  {
    name: "Company Directory",
    path: "directory/companies",
    icon: Building2,
    requiresProject: false,
    module: "directory",
  },
  { name: "Home", path: "home", icon: Home, requiresProject: true },
  {
    name: "Documents",
    path: "documents",
    icon: FolderOpen,
    requiresProject: true,
    module: "documents",
  },
  {
    name: "Directory",
    path: "directory",
    icon: Users,
    requiresProject: true,
    module: "directory",
  },
  {
    name: "Tables Directory",
    path: "tables-directory",
    icon: Table,
    requiresProject: false,
    adminOnly: true,
  },
];

export const projectManagementTools: NavigationTool[] = [
  {
    name: "Schedule",
    path: "schedule",
    icon: Calendar,
    requiresProject: true,
    module: "schedule",
  },
  {
    name: "Progress Reports",
    path: "progress-reports",
    icon: FileText,
    requiresProject: true,
    module: "documents",
    developerOnly: true,
  },
  { name: "Meetings", path: "meetings", icon: Users, requiresProject: true },
  { name: "Daily Log", path: "daily-log", icon: Clock, requiresProject: true },
  {
    name: "Punch List",
    path: "punch-list",
    icon: CheckCircle,
    requiresProject: true,
  },
  {
    name: "RFIs",
    path: "rfis",
    icon: MessageCircle,
    requiresProject: true,
    module: "rfis",
  },
  {
    name: "Submittals",
    path: "submittals",
    icon: Package,
    requiresProject: true,
    module: "submittals",
  },
  {
    name: "Transmittals",
    path: "transmittals",
    icon: Mail,
    requiresProject: true,
    module: "documents",
  },
  {
    name: "Photos",
    path: "photos",
    icon: Camera,
    requiresProject: true,
    module: "documents",
  },
  {
    name: "Drawings",
    path: "drawings",
    icon: FileImage,
    requiresProject: true,
    module: "documents",
  },
  {
    name: "Specifications",
    path: "specifications",
    icon: BookOpen,
    requiresProject: true,
    module: "documents",
  },
  {
    name: "Documents",
    path: "documents",
    icon: FolderOpen,
    requiresProject: true,
    module: "documents",
  },
];

export const financialManagementTools: NavigationTool[] = [
  {
    name: "Estimates",
    path: "estimates",
    icon: ClipboardList,
    requiresProject: true,
    module: "budget",
  },
  {
    name: "Budget",
    path: "budget",
    icon: TrendingUp,
    requiresProject: true,
    module: "budget",
  },
  {
    name: "Prime Contracts",
    path: "prime-contracts",
    icon: FileText,
    requiresProject: true,
    module: "contracts",
  },
  {
    name: "Commitments",
    path: "commitments",
    icon: Hammer,
    requiresProject: true,
    module: "contracts",
  },
  {
    name: "Change Orders",
    path: "change-orders",
    icon: ClipboardList,
    requiresProject: true,
    module: "change_orders",
  },
  {
    name: "Change Events",
    path: "change-events",
    icon: Clock,
    requiresProject: true,
    module: "change_orders",
  },
  {
    name: "Direct Costs",
    path: "direct-costs",
    icon: DollarSign,
    requiresProject: true,
    module: "budget",
  },
  {
    name: "Invoicing",
    path: "invoices",
    icon: Receipt,
    requiresProject: true,
    module: "contracts",
  },
  {
    name: "Project Status Report",
    path: "project-status-report",
    icon: ClipboardList,
    requiresProject: true,
    module: "budget",
    developerOnly: true,
  },
];

/**
 * Tools shown exclusively to users with user_type === "subcontractor".
 * These replace the full Financial/Operations nav for subcontractors.
 */
export const subcontractorTools: NavigationTool[] = [
  {
    name: "My Work",
    path: "my-work",
    icon: Home,
    requiresProject: true,
    subcontractorOnly: true,
  },
  {
    name: "My Schedule of Values",
    path: "commitments",
    icon: ClipboardList,
    requiresProject: true,
    subcontractorOnly: true,
    module: "contracts",
  },
  {
    name: "Submit Invoice",
    path: "invoicing/subcontractor/new",
    icon: Receipt,
    requiresProject: true,
    subcontractorOnly: true,
    module: "contracts",
  },
  {
    name: "RFIs",
    path: "rfis",
    icon: MessageCircle,
    requiresProject: true,
    subcontractorOnly: true,
    module: "rfis",
  },
  {
    name: "Submittals",
    path: "submittals",
    icon: Package,
    requiresProject: true,
    subcontractorOnly: true,
    module: "submittals",
  },
  {
    name: "Documents",
    path: "documents",
    icon: FolderOpen,
    requiresProject: true,
    subcontractorOnly: true,
    module: "documents",
  },
];

export const adminTools: NavigationTool[] = [
  {
    name: "Actions",
    path: "/actions",
    icon: Wrench,
    requiresProject: false,
    adminOnly: true,
  },
  {
    name: "Operations Readiness",
    path: "/operations-readiness",
    icon: CheckCircle,
    requiresProject: false,
    adminOnly: true,
  },
  {
    name: "Database Inventory",
    path: "/database-inventory",
    icon: Table,
    requiresProject: false,
    adminOnly: true,
  },
  {
    name: "What's New",
    path: "/updates",
    icon: TrendingUp,
    requiresProject: false,
  },
  {
    name: "Documentation",
    path: "https://alleato-docs-site.vercel.app/",
    icon: MessageCircle,
    requiresProject: false,
  },
  {
    name: "Procore Docs",
    path: "/procore-docs",
    icon: BookOpen,
    requiresProject: false,
  },
  {
    name: "Document Pipeline",
    path: "/admin/documents/pipeline",
    icon: FolderOpen,
    requiresProject: false,
    adminOnly: true,
  },
  {
    name: "AI Learning Promotions",
    path: "/ai/learning-promotions",
    icon: Sparkles,
    requiresProject: false,
    adminOnly: true,
  },
  {
    name: "Email Learning",
    path: "/ai/email-learning",
    icon: Mail,
    requiresProject: false,
    adminOnly: true,
  },
  {
    name: "AI Skills Admin",
    path: "/ai/admin/skills",
    icon: Shield,
    requiresProject: false,
    adminOnly: true,
  },
  {
    name: "Project Attribution",
    path: "/project-attribution",
    icon: Brain,
    requiresProject: false,
    adminOnly: true,
  },
  {
    name: "Task Training",
    path: "/task-training",
    icon: Brain,
    requiresProject: false,
    adminOnly: true,
  },
  {
    name: "My Feedback",
    path: "/my-feedback",
    icon: MessageCircle,
    requiresProject: false,
    adminOnly: true,
  },
  {
    name: "Training Docs",
    path: "/training-docs",
    icon: BookOpen,
    requiresProject: false,
    adminOnly: true,
  },
  {
    name: "Training Map",
    path: "/training-map",
    icon: Compass,
    requiresProject: false,
    adminOnly: true,
  },
  {
    name: "Knowledge Sources",
    path: "/knowledge/manage",
    icon: BookOpen,
    requiresProject: false,
    adminOnly: true,
  },
  {
    name: "Deep Research Archive",
    path: "/deep-research",
    icon: BookOpen,
    requiresProject: false,
    adminOnly: true,
  },
  // AI SDK DevTools — only visible in development (http://localhost:4983)
  ...(process.env.NODE_ENV === "development"
    ? [
        {
          name: "AI DevTools",
          path: "http://localhost:4983",
          icon: Bug,
          requiresProject: false,
        } as NavigationTool,
      ]
    : []),
];

// Helper function to build project-scoped URLs
export const buildToolUrl = (
  toolPath: string,
  projectId: number | null,
  requiresProject: boolean = true,
): string => {
  // External links (docs site, dev tools) are absolute — return as-is.
  if (toolPath.startsWith("http")) {
    return toolPath;
  }
  if (requiresProject && projectId) {
    return `/${projectId}/${toolPath}`;
  }
  return `/${toolPath}`;
};

// Helper function to check if a path is currently active
export const isActivePath = (pathname: string, toolPath: string): boolean => {
  const segments = pathname?.split("/").filter(Boolean) ?? [];
  if (segments.length >= 2 && /^\d+$/.test(segments[0])) {
    return segments[1] === toolPath.split("/")[0];
  }
  return segments[0] === toolPath.split("/")[0];
};

// Helper to extract project ID from pathname
export const extractProjectId = (pathname: string): number | null => {
  const segments = pathname?.split("/").filter(Boolean) ?? [];
  const firstSegment = segments[0];
  if (firstSegment && /^\d+$/.test(firstSegment)) {
    return parseInt(firstSegment);
  }
  return null;
};

// Shared permission filtering for navigation tools
export function filterToolsByPermission<T extends NavigationTool>(
  tools: T[],
  projectId: number | null,
  permissions: Record<string, string[]>,
  isAppAdmin: boolean,
  userType: string | null,
  isDeveloper = userType === "developer",
  userEmail: string | null = null,
  accessProfile: UserManagementAccessProfile = {},
): T[] {
  return tools.filter((tool) => {
    // Owner-only tools are hidden everywhere unless the caller supplies the
    // owner's email. Callers that don't pass userEmail never surface them.
    if (tool.ownerOnly && !isOwnerEmail(userEmail)) return false;
    if (tool.onlyWithoutProject && projectId) return false;
    // Hide project-scoped tools when no project selected
    if (tool.requiresProject && !projectId) return false;
    // Developer-only tools: only site developers can see experimental/internal report surfaces.
    if (tool.developerOnly && !isDeveloper) return false;
    // Admin-only tools: only for app admins/developers, except named policies
    // that deliberately allow role/title based access.
    if (
      tool.adminOnly &&
      !isAppAdmin &&
      userType !== "developer" &&
      !(
        tool.accessPolicy === "userManagement" &&
        canAccessUserManagement({
          ...accessProfile,
          isAdmin: accessProfile.isAdmin ?? isAppAdmin,
          isDeveloper: accessProfile.isDeveloper ?? isDeveloper,
          userType: accessProfile.userType ?? userType,
        })
      )
    ) {
      return false;
    }
    // Module-gated tools: check user has required permission
    if (tool.module && projectId) {
      return hasModulePermission(
        permissions,
        tool.module,
        tool.requiredPermission || "read",
      );
    }
    return true;
  });
}

// =============================================================================
// SIDEBAR NAVIGATION GROUPS (for sidebar with grouped icons)
// =============================================================================

export interface SidebarNavGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  tools: NavigationTool[];
}

export const subcontractorSidebarGroup: SidebarNavGroup = {
  id: "subcontractor",
  label: "My Project",
  icon: Briefcase,
  tools: subcontractorTools,
};

export const sidebarNavGroups: SidebarNavGroup[] = [
  {
    id: "project",
    label: "Project",
    icon: Briefcase,
    tools: [
      { name: "Home", path: "home", icon: Home, requiresProject: true },
      { name: "Alleato AI", path: "ai", icon: Bot, requiresProject: false },
      {
        name: "Project Directory",
        path: "directory",
        icon: Users,
        requiresProject: true,
        module: "directory" as PermissionModule,
      },
      {
        name: "Company Directory",
        path: "directory/companies",
        icon: Building2,
        requiresProject: false,
        module: "directory" as PermissionModule,
      },
    ],
  },
  {
    id: "financial",
    label: "Financial",
    icon: DollarSign,
    tools: financialManagementTools,
  },
  {
    id: "operations",
    label: "Operations",
    icon: ClipboardList,
    tools: [
      {
        name: "Schedule",
        path: "schedule",
        icon: Calendar,
        requiresProject: true,
        module: "schedule" as PermissionModule,
      },
      {
        name: "Meetings",
        path: "meetings",
        icon: Users,
        requiresProject: true,
      },
      {
        name: "Daily Log",
        path: "daily-log",
        icon: Clock,
        requiresProject: true,
      },
      {
        name: "Punch List",
        path: "punch-list",
        icon: CheckCircle,
        requiresProject: true,
      },
      {
        name: "Project Tasks",
        path: "plane/work-items",
        icon: CheckCircle,
        requiresProject: true,
      },
      {
        name: "RFIs",
        path: "rfis",
        icon: MessageCircle,
        requiresProject: true,
        module: "rfis" as PermissionModule,
      },
      {
        name: "Submittals",
        path: "submittals",
        icon: Package,
        requiresProject: true,
        module: "submittals" as PermissionModule,
      },
      {
        name: "Transmittals",
        path: "transmittals",
        icon: Mail,
        requiresProject: true,
        module: "documents" as PermissionModule,
      },
      {
        name: "Emails",
        path: "emails",
        icon: Mail,
        requiresProject: true,
        module: "documents" as PermissionModule,
        ownerOnly: true,
      },
    ],
  },
  {
    id: "documents",
    label: "Documents",
    icon: FolderOpen,
    tools: [
      {
        name: "Photos",
        path: "photos",
        icon: Camera,
        requiresProject: true,
        module: "documents" as PermissionModule,
      },
      {
        name: "Drawings",
        path: "drawings",
        icon: FileImage,
        requiresProject: true,
        module: "documents" as PermissionModule,
      },
      {
        name: "Specifications",
        path: "specifications",
        icon: BookOpen,
        requiresProject: true,
        module: "documents" as PermissionModule,
      },
      {
        name: "Documents",
        path: "documents",
        icon: FolderOpen,
        requiresProject: true,
        module: "documents" as PermissionModule,
      },
    ],
  },
];

// =============================================================================
// HEADER NAVIGATION GROUPS (for top navigation mega menus)
// =============================================================================

export const headerNavGroups: HeaderNavGroup[] = [
  {
    id: "finance",
    label: "Financial",
    tools: [
      {
        name: "Estimates",
        path: "estimates",
        requiresProject: true,
        icon: ClipboardList,
        description: "Pre-construction estimates",
        module: "budget",
      },
      {
        name: "Budget",
        path: "budget",
        requiresProject: true,
        icon: TrendingUp,
        description: "Project budget management",
        module: "budget",
      },
      {
        name: "Prime Contracts",
        path: "prime-contracts",
        requiresProject: true,
        icon: FileText,
        description: "Main project contracts",
        module: "contracts",
      },
      {
        name: "Commitments",
        path: "commitments",
        requiresProject: true,
        icon: Hammer,
        description: "Subcontracts and POs",
        module: "contracts",
      },
      {
        name: "Change Orders",
        path: "change-orders",
        requiresProject: true,
        icon: FileText,
        description: "Contract modifications",
        module: "change_orders",
      },
      {
        name: "Change Events",
        path: "change-events",
        requiresProject: true,
        icon: Clock,
        description: "Potential change tracking",
        module: "change_orders",
      },
      {
        name: "Direct Costs",
        path: "direct-costs",
        requiresProject: true,
        icon: DollarSign,
        description: "Labor and material costs",
        module: "budget",
      },
      {
        name: "Invoicing",
        path: "invoices",
        requiresProject: true,
        icon: FileText,
        description: "Billing and payments",
        module: "contracts",
      },
      {
        name: "Project Status Report",
        path: "project-status-report",
        requiresProject: true,
        icon: ClipboardList,
        description: "Monthly project status summary",
        module: "budget",
        developerOnly: true,
      },
    ],
    subGroups: [
      {
        label: "Budgeting",
        toolNames: [
          "Estimates",
          "Budget",
          "Direct Costs",
          "Project Status Report",
        ],
      },
      {
        label: "Contracts",
        toolNames: ["Prime Contracts", "Commitments", "Invoicing"],
      },
      { label: "Changes", toolNames: ["Change Orders", "Change Events"] },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    tools: [
      {
        name: "Schedule",
        path: "schedule",
        requiresProject: true,
        icon: Calendar,
        description: "Project schedule",
        module: "schedule",
      },
      {
        name: "Meetings",
        path: "meetings",
        requiresProject: true,
        icon: Users,
        description: "Meeting minutes and schedules",
      },
      {
        name: "Daily Log",
        path: "daily-log",
        requiresProject: true,
        icon: Clock,
        description: "Daily progress tracking",
      },
      {
        name: "Punch List",
        path: "punch-list",
        requiresProject: true,
        icon: CheckCircle,
        description: "Track completion items",
      },
      {
        name: "RFIs",
        path: "rfis",
        requiresProject: true,
        icon: MessageCircle,
        description: "Requests for Information",
        module: "rfis",
      },
      {
        name: "Submittals",
        path: "submittals",
        requiresProject: true,
        icon: Package,
        description: "Material and shop drawings",
        module: "submittals",
      },
      {
        name: "Transmittals",
        path: "transmittals",
        requiresProject: true,
        icon: Mail,
        description: "Document transmittals",
        module: "documents",
      },
      {
        name: "Emails",
        path: "emails",
        requiresProject: true,
        icon: Mail,
        description: "Application and Resend emails",
        module: "documents",
        ownerOnly: true,
      },
    ],
    subGroups: [
      {
        label: "Scheduling",
        toolNames: ["Schedule", "Meetings", "Daily Log", "Punch List"],
      },
      {
        label: "Correspondence",
        toolNames: ["RFIs", "Submittals", "Transmittals", "Emails"],
      },
    ],
  },
  {
    id: "documents",
    label: "Documents",
    tools: [
      {
        name: "Photos",
        path: "photos",
        requiresProject: true,
        icon: Camera,
        description: "Project photo documentation",
        module: "documents",
      },
      {
        name: "Drawings",
        path: "drawings",
        requiresProject: true,
        icon: FileImage,
        description: "Blueprints and technical drawings",
        module: "documents",
      },
      {
        name: "Specifications",
        path: "specifications",
        requiresProject: true,
        icon: FileText,
        description: "Project specifications",
        module: "documents",
      },
      {
        name: "Documents",
        path: "documents",
        requiresProject: true,
        icon: FolderOpen,
        description: "Project files and documents",
        module: "documents",
      },
    ],
  },
  {
    id: "company",
    label: "Project",
    tools: [
      {
        name: "Alleato AI",
        path: "ai",
        requiresProject: false,
        icon: Bot,
        description: "AI-powered project guidance",
      },
      {
        name: "Project Directory",
        path: "directory",
        requiresProject: true,
        icon: Users,
        description: "People and companies assigned to this project",
        module: "directory",
      },
      {
        name: "Project Tasks",
        path: "plane/work-items",
        requiresProject: true,
        icon: CheckCircle,
        description: "Tasks for this project",
      },
      {
        name: "Company Directory",
        path: "directory/companies",
        requiresProject: false,
        icon: Building2,
        description: "People, companies, contacts",
        module: "directory",
      },
    ],
  },
];

// Admin/Settings tools (shown in gear icon dropdown)
export const adminSettingsTools: HeaderNavigationTool[] = [
  {
    name: "Company Settings",
    path: "/company-settings",
    requiresProject: false,
    icon: SlidersHorizontal,
    description: "Company defaults and governed configuration",
    adminOnly: true,
  },
  {
    name: "Actions",
    path: "/actions",
    requiresProject: false,
    icon: Wrench,
    description: "Manual internal workflows and triggers",
    adminOnly: true,
  },
  {
    name: "Command Center",
    path: "/command-center",
    requiresProject: false,
    icon: LayoutDashboard,
    description: "Operational dashboard",
    adminOnly: true,
  },
  {
    name: "Operations Readiness",
    path: "/operations-readiness",
    requiresProject: false,
    icon: CheckCircle,
    description: "Source sync, task, packet, and daily brief readiness",
    adminOnly: true,
  },
  {
    name: "AI Chat History",
    path: "/ai-chat-history",
    requiresProject: false,
    icon: Bot,
    description: "Assistant turns with traces and write status",
    developerOnly: true,
  },
  {
    name: "Feedback Inbox",
    path: "/feedback-inbox",
    requiresProject: false,
    icon: MessageCircle,
    description: "User feedback and requests",
  },
  {
    name: "Roadmap",
    path: "/product-board",
    requiresProject: false,
    icon: Kanban,
    description: "Feature request kanban board",
    adminOnly: false,
  },
  {
    name: "Annotation Inbox",
    path: "/annotation-inbox",
    requiresProject: false,
    icon: MessageCircle,
    description: "Agentation annotation triage",
    adminOnly: true,
  },
  {
    name: "Tables Directory",
    path: "tables-directory",
    requiresProject: false,
    icon: Table,
    description: "Database tables",
    adminOnly: true,
  },
  {
    name: "Document Pipeline",
    path: "/admin/documents/pipeline",
    requiresProject: false,
    icon: FolderOpen,
    description: "Document workflows",
    adminOnly: true,
  },
  {
    name: "Training Docs",
    path: "/training-docs",
    requiresProject: false,
    icon: BookOpen,
    description: "Reviewed workflow manuals",
    adminOnly: true,
  },
  {
    name: "Training Map",
    path: "/training-map",
    requiresProject: false,
    icon: Compass,
    description: "Coverage of training docs by tool and QA status",
    adminOnly: true,
  },
  {
    name: "Project Attribution",
    path: "/admin/project-attribution",
    requiresProject: false,
    icon: Brain,
    description: "Communication project mapping",
    adminOnly: true,
  },
  {
    name: "Procore Tools",
    path: "procore-tools",
    requiresProject: false,
    icon: Wrench,
    description: "Procore tool modules and implementation status",
    adminOnly: true,
  },
  {
    name: "Tools",
    path: "/tools",
    requiresProject: false,
    icon: Wrench,
    description: "Browse all Alleato tools by category",
    adminOnly: true,
  },
];

// Helper to find which header group contains the active tool
export function getActiveGroupId(
  toolPath: string,
  groups: HeaderNavGroup[],
): string | null {
  for (const group of groups) {
    const match = group.tools.find(
      (tool) => tool.path === toolPath || toolPath.startsWith(tool.path + "/"),
    );
    if (match) return group.id;
  }
  return null;
}
