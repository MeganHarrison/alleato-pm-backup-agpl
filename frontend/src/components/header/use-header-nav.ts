"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  companyWideHeaderTools,
  extractProjectId,
  headerNavGroups,
  getActiveGroupId,
  adminSettingsTools,
  developerCompanyAdminTools,
  type HeaderNavigationTool,
} from "@/lib/navigation-config";
import { apiFetch } from "@/lib/api-client";
import { getPrimeContractPcoDisplayName } from "@/lib/prime-contract-pcos/display";
import { useProject } from "@/contexts/project-context";
import { createClient } from "@/lib/supabase/client";
import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";
import {
  getRouteBreadcrumbOverride,
  isLikelyRecordIdentifier,
} from "./breadcrumb-utils";

interface Project {
  id: number;
  name: string;
  "job number": string | null;
  phase: string | null;
}

function normalizeProject(project: Project | null | undefined): Project | null {
  if (!project) return null;

  const id = Number(project.id);
  if (!Number.isFinite(id)) return null;

  return {
    ...project,
    id,
    name: typeof project.name === "string" ? project.name.trim() : "",
  };
}

function getProjectBreadcrumbLabel(project: Project | null): string {
  const projectName = project?.name.trim();
  return projectName || "Project";
}

interface Breadcrumb {
  label: string;
  href: string;
}

interface UseHeaderNavReturn {
  projectId: number | null;
  currentProject: Project | null;
  activeToolName: string;
  activeGroupId: string | null;
  breadcrumbs: Breadcrumb[];
  openPanel: string | null;
  setOpenPanel: (id: string | null) => void;
  togglePanel: (id: string) => void;
  closePanels: () => void;
  projects: Project[];
  loadingProjects: boolean;
  fetchProjects: () => void;
  handleProjectSelect: (projectId: number) => void;
}

const COMPANY_HOME_LABEL = "Company";

const TABLE_ROUTE_ALIASES: Record<string, string> = {
  tasks: "tasks",
  projects: "projects",
};

function getCreateRouteBreadcrumbLabel(
  segments: string[],
  index: number,
): string | null {
  if (segments[index] !== "new") return null;

  if (segments[index - 1] === "prime-contracts") {
    return "New Prime Contract";
  }

  if (segments[index - 1] === "prime-contract-pcos") {
    return "New Prime Contract Potential Change Order";
  }

  if (
    segments[index - 1] === "pcos" &&
    segments[index - 2] === "change-orders" &&
    segments[index - 4] === "prime-contracts"
  ) {
    return "New Prime Contract Potential Change Order";
  }

  return null;
}

export function useHeaderNav(): UseHeaderNavReturn {
  const pathname = usePathname()!;
  const router = useRouter();
  const searchParams = useSearchParams()!;
  const { selectedProject, isLoading: isProjectContextLoading } = useProject();
  const reportHeaderNavFailure = useCallback(
    (operation: string, error: unknown, metadata?: Record<string, unknown>) => {
      reportNonCriticalFailure({
        area: "header-nav",
        operation,
        error,
        userVisibleFallback:
          "Header breadcrumb label fell back to the route label.",
        metadata: { pathname, ...metadata },
      });
    },
    [pathname],
  );

  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const projectsLoadedRef = useRef(false);
  const projectsFetchPromiseRef = useRef<Promise<void> | null>(null);
  const [meetingTitle, setMeetingTitle] = useState<string | null>(null);
  const [globalMeetingTitle, setGlobalMeetingTitle] = useState<string | null>(
    null,
  );
  const [primeContractTitle, setPrimeContractTitle] = useState<string | null>(
    null,
  );
  const [companyTitle, setCompanyTitle] = useState<string | null>(null);
  const [vendorTitle, setVendorTitle] = useState<string | null>(null);
  const [contactTitle, setContactTitle] = useState<string | null>(null);
  const [commitmentTitle, setCommitmentTitle] = useState<string | null>(null);
  const [primePcoTitle, setPrimePcoTitle] = useState<string | null>(null);
  const [changeEventTitle, setChangeEventTitle] = useState<string | null>(null);
  const [primeCoTitle, setPrimeCoTitle] = useState<string | null>(null);
  const [commitmentCoTitle, setCommitmentCoTitle] = useState<string | null>(
    null,
  );
  const [invoiceTitle, setInvoiceTitle] = useState<string | null>(null);
  const [rfiTitle, setRfiTitle] = useState<string | null>(null);
  const [submittalTitle, setSubmittalTitle] = useState<string | null>(null);
  const [subcontractorInvoiceInfo, setSubcontractorInvoiceInfo] = useState<{
    commitmentLabel: string;
    invoiceLabel: string;
  } | null>(null);
  const [drawingTitle, setDrawingTitle] = useState<string | null>(null);
  const [testRunTitle, setTestRunTitle] = useState<string | null>(null);
  const [progressReportTitle, setProgressReportTitle] = useState<string | null>(
    null,
  );
  const [dailyBriefTitle, setDailyBriefTitle] = useState<string | null>(null);
  const [punchItemTitle, setPunchItemTitle] = useState<string | null>(null);

  // Title caches scoped to this component instance — cleared on unmount
  const meetingTitleCache = useRef(new Map<string, string>()).current;
  const globalMeetingTitleCache = useRef(new Map<string, string>()).current;
  const primeContractTitleCache = useRef(new Map<string, string>()).current;
  const companyTitleCache = useRef(new Map<string, string>()).current;
  const vendorTitleCache = useRef(new Map<string, string>()).current;
  const contactTitleCache = useRef(new Map<string, string>()).current;
  const commitmentTitleCache = useRef(new Map<string, string>()).current;
  const primePcoTitleCache = useRef(new Map<string, string>()).current;
  const changeEventTitleCache = useRef(new Map<string, string>()).current;
  const primeCoTitleCache = useRef(new Map<string, string>()).current;
  const commitmentCoTitleCache = useRef(new Map<string, string>()).current;
  const invoiceTitleCache = useRef(new Map<string, string>()).current;
  const rfiTitleCache = useRef(new Map<string, string>()).current;
  const submittalTitleCache = useRef(new Map<string, string>()).current;
  const subcontractorInvoiceTitleCache = useRef(
    new Map<string, { commitmentLabel: string; invoiceLabel: string }>(),
  ).current;
  const drawingTitleCache = useRef(new Map<string, string>()).current;
  const testRunTitleCache = useRef(new Map<string, string>()).current;
  const progressReportTitleCache = useRef(new Map<string, string>()).current;
  const dailyBriefTitleCache = useRef(new Map<string, string>()).current;
  const punchItemTitleCache = useRef(new Map<string, string>()).current;

  // Extract project ID from URL path or query parameters
  const projectId = useMemo(() => {
    const pathId = extractProjectId(pathname ?? "");
    if (pathId) return pathId;

    // Fallback to query parameters for legacy URLs
    const projectParam =
      searchParams?.get("project") || searchParams?.get("projectId");
    if (projectParam && /^\d+$/.test(projectParam)) {
      return parseInt(projectParam);
    }
    return null;
  }, [pathname, searchParams]);
  const contextProject = useMemo(() => {
    const normalizedProject = normalizeProject(
      selectedProject as Project | null,
    );
    if (!normalizedProject || normalizedProject.id !== projectId) return null;
    return normalizedProject;
  }, [projectId, selectedProject]);
  const breadcrumbProject = currentProject ?? contextProject;

  // Determine the currently active tool from the URL
  const activeToolName = useMemo(() => {
    const segments = pathname?.split("/").filter(Boolean) ?? [];
    const allTools: HeaderNavigationTool[] = [
      ...headerNavGroups.flatMap((g) => g.tools),
      ...companyWideHeaderTools,
      ...developerCompanyAdminTools,
      ...adminSettingsTools,
    ];

    // Check if we're on a project-scoped page (/{projectId}/{tool})
    if (segments.length >= 2 && /^\d+$/.test(segments[0])) {
      const scopedPath = segments.slice(1).join("/");
      const scopedFirstSegment = segments[1];

      // Prefer the most specific path match to avoid collisions like
      // "directory" vs "directory/companies".
      const matchingTool = allTools
        .filter((tool) => tool.requiresProject !== false)
        .sort((left, right) => right.path.length - left.path.length)
        .find(
          (tool) =>
            tool.path === scopedPath ||
            scopedPath.startsWith(`${tool.path}/`) ||
            tool.path === scopedFirstSegment,
        );
      return matchingTool?.name || "Home";
    }

    // Check global routes
    if (segments.length >= 1) {
      const firstSegment = segments[0];
      const aliasedPath = TABLE_ROUTE_ALIASES[firstSegment];
      const globalPath = segments.join("/");

      // Non-project URLs should resolve against non-project tools first.
      const globalTools = allTools.filter(
        (tool) => tool.requiresProject === false,
      );

      // Prefer exact full-path matches before first-segment fallbacks.
      const matchingTool = globalTools
        .sort((left, right) => right.path.length - left.path.length)
        .find(
          (tool) =>
            tool.path === globalPath ||
            (aliasedPath ? tool.path === aliasedPath : false) ||
            globalPath.startsWith(`${tool.path}/`) ||
            tool.path === firstSegment ||
            tool.path.split("/")[0] === firstSegment,
        );
      if (matchingTool) return matchingTool.name;
    }

    return COMPANY_HOME_LABEL;
  }, [pathname]);

  // Determine which header group contains the active tool
  const activeGroupId = useMemo(() => {
    const segments = pathname?.split("/").filter(Boolean) ?? [];
    let toolPath = "";

    if (segments.length >= 2 && /^\d+$/.test(segments[0])) {
      toolPath = segments[1];
    } else if (segments.length >= 1) {
      toolPath = TABLE_ROUTE_ALIASES[segments[0]] ?? segments[0];
    }

    return getActiveGroupId(toolPath, headerNavGroups);
  }, [pathname]);

  // Generate breadcrumbs
  const breadcrumbs = useMemo(() => {
    const segments = pathname?.split("/").filter(Boolean) ?? [];
    const crumbs: Breadcrumb[] = [];
    const skippedIndexes = new Set<number>();
    const allTools: HeaderNavigationTool[] = [
      ...headerNavGroups.flatMap((g) => g.tools),
      ...companyWideHeaderTools,
      ...developerCompanyAdminTools,
      ...adminSettingsTools,
    ];
    const isMeetingDetailRoute =
      segments.length >= 3 &&
      /^\d+$/.test(segments[0]) &&
      segments[1] === "meetings";
    const isGlobalMeetingDetailRoute =
      segments.length === 2 && segments[0] === "meetings";
    const isPrimeContractDetailRoute =
      segments.length >= 3 &&
      /^\d+$/.test(segments[0]) &&
      segments[1] === "prime-contracts";
    const isCommitmentDetailRoute =
      segments.length >= 3 &&
      /^\d+$/.test(segments[0]) &&
      segments[1] === "commitments" &&
      segments[2] !== "new" &&
      segments[2] !== "recycle-bin" &&
      segments[2] !== "settings";
    const isChangeEventDetailRoute =
      segments.length >= 3 &&
      /^\d+$/.test(segments[0]) &&
      segments[1] === "change-events" &&
      segments[2] !== "new";
    const isPrimePcoDetailRoute =
      segments.length >= 3 &&
      segments[1] === "prime-contract-pcos" &&
      segments[2] !== "new";
    const isNestedPrimePcoDetailRoute =
      segments.length >= 6 &&
      segments[1] === "prime-contracts" &&
      segments[3] === "change-orders" &&
      segments[4] === "pcos" &&
      segments[5] !== "new";
    const isNestedPrimePcoCreateRoute =
      segments.length >= 6 &&
      segments[1] === "prime-contracts" &&
      segments[3] === "change-orders" &&
      segments[4] === "pcos" &&
      segments[5] === "new";
    const isPrimeCoDetailRoute =
      segments.length >= 4 &&
      /^\d+$/.test(segments[0]) &&
      segments[1] === "change-orders" &&
      segments[2] === "prime" &&
      segments[3] !== "new";
    const isCommitmentCoDetailRoute =
      segments.length >= 4 &&
      /^\d+$/.test(segments[0]) &&
      segments[1] === "change-orders" &&
      segments[2] === "commitment" &&
      segments[3] !== "new";
    const isInvoiceDetailRoute =
      segments.length >= 5 &&
      segments[1] === "prime-contracts" &&
      segments[3] === "invoices" &&
      segments[4] !== "new";
    const isGlobalCompanyDetailRoute =
      segments.length >= 3 &&
      segments[0] === "directory" &&
      segments[1] === "companies" &&
      segments[2] !== "new";
    const isGlobalVendorDetailRoute =
      segments.length >= 3 &&
      segments[0] === "directory" &&
      segments[1] === "vendors" &&
      segments[2] !== "new";
    const isGlobalContactDetailRoute =
      segments.length >= 3 &&
      segments[0] === "directory" &&
      segments[1] === "contacts" &&
      segments[2] !== "new";
    const isProjectCompanyDetailRoute =
      segments.length >= 4 &&
      /^\d+$/.test(segments[0]) &&
      segments[1] === "directory" &&
      segments[2] === "companies" &&
      segments[3] !== "new";
    const isRfiDetailRoute =
      segments.length >= 3 &&
      /^\d+$/.test(segments[0]) &&
      segments[1] === "rfis" &&
      segments[2] !== "new";
    const isSubmittalDetailRoute =
      segments.length >= 3 &&
      /^\d+$/.test(segments[0]) &&
      segments[1] === "submittals" &&
      segments[2] !== "new" &&
      segments[2] !== "recycle-bin" &&
      segments[2] !== "settings";
    const isSubcontractorInvoiceDetailRoute =
      segments.length >= 4 &&
      /^\d+$/.test(segments[0]) &&
      segments[1] === "invoicing" &&
      segments[2] === "subcontractor" &&
      segments[3] !== "new";
    const isDrawingViewerRoute =
      segments.length >= 4 &&
      /^\d+$/.test(segments[0]) &&
      segments[1] === "drawings" &&
      segments[2] === "viewer";
    const isDrawingDetailRoute =
      segments.length >= 3 &&
      /^\d+$/.test(segments[0]) &&
      segments[1] === "drawings" &&
      ![
        "viewer",
        "board",
        "areas",
        "sets",
        "recycle-bin",
        "revisions-report",
        "new",
      ].includes(segments[2]);
    const isProgressReportDetailRoute =
      segments.length >= 3 &&
      /^\d+$/.test(segments[0]) &&
      segments[1] === "progress-reports" &&
      /^[0-9a-f-]{36}$/i.test(segments[2]);
    const isTestRunDetailRoute =
      segments.length >= 3 &&
      segments[0] === "testing" &&
      segments[1] === "runs" &&
      /^[0-9a-f-]{36}$/i.test(segments[2]);
    const isDailyBriefDetailRoute =
      segments.length >= 2 &&
      segments[0] === "daily-briefs" &&
      /^[0-9a-f-]{36}$/i.test(segments[1]);
    const isPunchItemDetailRoute =
      segments.length >= 3 &&
      /^\d+$/.test(segments[0]) &&
      segments[1] === "punch-list" &&
      segments[2] !== "new" &&
      segments[2] !== "recycle-bin" &&
      segments[2] !== "settings";
    const isUserManagementUserDetailRoute =
      segments.length >= 3 &&
      segments[0] === "user-management" &&
      segments[1] === "users";

    // Always start with the company-level home label.
    crumbs.push({ label: COMPANY_HOME_LABEL, href: "/" });

    segments.forEach((segment, index) => {
      if (skippedIndexes.has(index)) return;
      if (isCommitmentCoDetailRoute && index === 2) return;

      let href = `/${segments.slice(0, index + 1).join("/")}`;
      let label: string;

      // Keep nested prime-contract PCO breadcrumbs on valid routes.
      if (isNestedPrimePcoDetailRoute || isNestedPrimePcoCreateRoute) {
        const nestedProjectId = segments[0];
        const nestedContractId = segments[2];
        const nestedPcoId = segments[5];

        if (index === 3) {
          href = `/${nestedProjectId}/prime-contracts/${nestedContractId}`;
        } else if (index === 4) {
          href = `/${nestedProjectId}/prime-contracts/${nestedContractId}`;
        } else if (index === 5 && isNestedPrimePcoDetailRoute) {
          href = `/${nestedProjectId}/prime-contracts/${nestedContractId}/change-orders/pcos/${nestedPcoId}`;
        }
      }

      if (isUserManagementUserDetailRoute && index === 1) {
        label = "Users";
        href = "/user-management";
        crumbs.push({ label, href });
        return;
      }

      const routeBreadcrumbOverride = getRouteBreadcrumbOverride(
        segments,
        index,
      );
      if (routeBreadcrumbOverride) {
        crumbs.push(routeBreadcrumbOverride);
        return;
      }

      if (index === 0 && !/^\d+$/.test(segment)) {
        const globalMultiSegmentTool = allTools.find((tool) => {
          if (tool.requiresProject || !tool.path.includes("/")) return false;

          const toolSegments = tool.path.split("/");
          return segments.slice(0, toolSegments.length).join("/") === tool.path;
        });

        if (globalMultiSegmentTool) {
          label = globalMultiSegmentTool.name;
          href = `/${globalMultiSegmentTool.path}`;

          const toolDepth = globalMultiSegmentTool.path.split("/").length;
          for (
            let skippedIndex = 1;
            skippedIndex < toolDepth;
            skippedIndex += 1
          ) {
            skippedIndexes.add(skippedIndex);
          }

          crumbs.push({ label, href });
          return;
        }
      }

      // Check if this segment is a project ID (numeric)
      if (index === 0 && /^\d+$/.test(segment)) {
        label = getProjectBreadcrumbLabel(breadcrumbProject);
        href = `/${segment}/home`;
      } else if (isGlobalMeetingDetailRoute && index === 1) {
        label = globalMeetingTitle || "Meeting";
      } else if (isMeetingDetailRoute && index === 2) {
        label = meetingTitle || "Meeting";
      } else if (isPrimeContractDetailRoute && index === 2) {
        label = primeContractTitle || "Prime Contract";
      } else if (isCommitmentDetailRoute && index === 2) {
        label = commitmentTitle || "Commitment";
      } else if (isPrimePcoDetailRoute && index === 2) {
        label = primePcoTitle || "Prime PCO";
      } else if (isNestedPrimePcoDetailRoute && index === 5) {
        label = primePcoTitle || "Prime PCO";
      } else if (
        (isNestedPrimePcoDetailRoute || isNestedPrimePcoCreateRoute) &&
        index === 3
      ) {
        label = "Prime Contract";
      } else if (
        (isNestedPrimePcoDetailRoute || isNestedPrimePcoCreateRoute) &&
        index === 4
      ) {
        label = "Potential Change Orders";
      } else if (isChangeEventDetailRoute && index === 2) {
        label = changeEventTitle || "Change Event";
      } else if (isPrimeCoDetailRoute && index === 3) {
        label = primeCoTitle || "Prime CO";
      } else if (isCommitmentCoDetailRoute && index === 3) {
        label = commitmentCoTitle || "Commitment CO";
      } else if (isInvoiceDetailRoute && index === 4) {
        label = invoiceTitle || "Invoice";
      } else if (isGlobalCompanyDetailRoute && index === 2) {
        label = companyTitle || "Company";
      } else if (isGlobalVendorDetailRoute && index === 2) {
        label = vendorTitle || "Vendor";
      } else if (isGlobalContactDetailRoute && index === 2) {
        label = contactTitle || "Contact";
      } else if (isProjectCompanyDetailRoute && index === 3) {
        label = companyTitle || "Company";
      } else if (isRfiDetailRoute && index === 2) {
        label = rfiTitle || "RFI";
      } else if (isSubmittalDetailRoute && index === 2) {
        label = submittalTitle || "Submittal";
      } else if (isSubcontractorInvoiceDetailRoute && index === 2) {
        label = subcontractorInvoiceInfo?.commitmentLabel ?? "Subcontractor";
      } else if (isSubcontractorInvoiceDetailRoute && index === 3) {
        label = subcontractorInvoiceInfo?.invoiceLabel ?? `Invoice #${segment}`;
      } else if (isDrawingDetailRoute && index === 2) {
        label = drawingTitle || "Drawing";
      } else if (isDrawingViewerRoute && index === 3) {
        label = drawingTitle || "Drawing";
      } else if (isTestRunDetailRoute && index === 2) {
        label = testRunTitle || "Run";
      } else if (isProgressReportDetailRoute && index === 2) {
        label = progressReportTitle || "Progress Report";
      } else if (isDailyBriefDetailRoute && index === 1) {
        label = dailyBriefTitle || "Daily Brief";
      } else if (isPunchItemDetailRoute && index === 2) {
        label = punchItemTitle || "Punch Item";
      } else if (index === 0 && segment === "directory") {
        // Global directory routes (/directory/vendors, /directory/clients, etc.)
        // — not project-scoped, so label as Company Directory
        label = "Company Directory";
      } else {
        // Try to find a matching tool name
        const matchingTool = allTools.find((tool) => tool.path === segment);
        const aliasMatchingTool =
          index === 0 && TABLE_ROUTE_ALIASES[segment]
            ? allTools.find(
                (tool) => tool.path === TABLE_ROUTE_ALIASES[segment],
              )
            : null;

        if (matchingTool || aliasMatchingTool) {
          const resolvedTool = matchingTool ?? aliasMatchingTool;
          label = resolvedTool?.name ?? segment;
        } else {
          // Format segment name for display
          label = isLikelyRecordIdentifier(segment, index)
            ? "Details"
            : segment
                .split("-")
                .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                .join(" ");

          // Special cases
          const labelMap: Record<string, string> = {
            "prime-contracts": "Prime Contracts",
            "prime-contract-pcos": "Prime Contract PCOs",
            "commitment-pcos": "Commitment PCO's",
            pcos: "Potential Change Orders",
            "change-events": "Change Events",
            "change-orders": "Change Orders",
            "direct-costs": "Direct Costs",
            "daily-log": "Daily Log",
            "punch-list": "Punch List",
            sov: "Schedule of Values",
            rfis: "RFIs",
            "line-item": "Line Item",
            new: "New",
            edit: "Edit",
          };

          if (labelMap[segment]) {
            label = labelMap[segment];
          }

          label = getCreateRouteBreadcrumbLabel(segments, index) ?? label;
        }
      }

      crumbs.push({ label, href });
    });

    return crumbs;
  }, [
    pathname,
    companyTitle,
    vendorTitle,
    contactTitle,
    breadcrumbProject,
    meetingTitle,
    globalMeetingTitle,
    primeContractTitle,
    commitmentTitle,
    primePcoTitle,
    changeEventTitle,
    primeCoTitle,
    commitmentCoTitle,
    invoiceTitle,
    rfiTitle,
    submittalTitle,
    subcontractorInvoiceInfo,
    drawingTitle,
    testRunTitle,
    progressReportTitle,
    dailyBriefTitle,
    punchItemTitle,
  ]);

  // Fetch the title for project punch-item detail routes. This is intentionally
  // owned by the shared header rather than each detail page so every entry
  // point to the record gets the same human-readable breadcrumb.
  useEffect(() => {
    const segments = pathname?.split("/").filter(Boolean) ?? [];
    const isPunchItemDetailRoute =
      segments.length >= 3 &&
      /^\d+$/.test(segments[0]) &&
      segments[1] === "punch-list" &&
      segments[2] !== "new" &&
      segments[2] !== "recycle-bin" &&
      segments[2] !== "settings";

    if (!isPunchItemDetailRoute) {
      setPunchItemTitle(null);
      return;
    }

    const projectId = segments[0];
    const punchItemId = segments[2];
    const cacheKey = `${projectId}:${punchItemId}`;
    const cachedTitle = punchItemTitleCache.get(cacheKey);
    if (cachedTitle) {
      setPunchItemTitle(cachedTitle);
      return;
    }

    let isActive = true;
    const fetchPunchItemTitle = async () => {
      try {
        const data = await apiFetch<{
          title?: unknown;
          number?: unknown;
        }>(`/api/projects/${projectId}/punch-items/${punchItemId}`);
        const title =
          typeof data?.title === "string" && data.title.trim().length > 0
            ? data.title.trim()
            : null;
        const number =
          data?.number != null && String(data.number).trim().length > 0
            ? `Punch Item #${String(data.number).trim()}`
            : null;
        const resolvedTitle = title ?? number;

        if (!isActive) return;
        if (resolvedTitle) {
          punchItemTitleCache.set(cacheKey, resolvedTitle);
          setPunchItemTitle(resolvedTitle);
        } else {
          setPunchItemTitle(null);
        }
      } catch (error) {
        reportHeaderNavFailure("resolve-punch-item-title", error, {
          projectId,
          punchItemId,
        });
      }
    };

    fetchPunchItemTitle();
    return () => {
      isActive = false;
    };
  }, [pathname]);
  useEffect(() => {
    const segments = pathname?.split("/").filter(Boolean) ?? [];
    const isMeetingDetailRoute =
      segments.length >= 3 &&
      /^\d+$/.test(segments[0]) &&
      segments[1] === "meetings";

    if (!isMeetingDetailRoute) {
      setMeetingTitle(null);
      return;
    }

    const meetingId = segments[2];
    if (!meetingId || meetingId === "new") {
      setMeetingTitle(null);
      return;
    }

    const cachedTitle = meetingTitleCache.get(meetingId);
    if (cachedTitle) {
      setMeetingTitle(cachedTitle);
      return;
    }

    let isActive = true;
    const fetchMeetingTitle = async () => {
      try {
        const data = await apiFetch<{ data?: { title?: unknown } }>(
          `/api/projects/${segments[0]}/meetings/${meetingId}`,
        );
        const title = data?.data?.title;
        if (isActive) {
          if (typeof title === "string" && title.length > 0) {
            meetingTitleCache.set(meetingId, title);
            setMeetingTitle(title);
          } else {
            setMeetingTitle(null);
          }
        }
      } catch (error) {
        reportHeaderNavFailure("resolve-project-meeting-title", error, {
          meetingId,
        });
      }
    };

    fetchMeetingTitle();
    return () => {
      isActive = false;
    };
  }, [pathname]);

  useEffect(() => {
    const segments = pathname?.split("/").filter(Boolean) ?? [];
    const isDrawingViewerRoute =
      segments.length >= 4 &&
      /^\d+$/.test(segments[0]) &&
      segments[1] === "drawings" &&
      segments[2] === "viewer";
    const isDrawingDetailRoute =
      segments.length >= 3 &&
      /^\d+$/.test(segments[0]) &&
      segments[1] === "drawings" &&
      ![
        "viewer",
        "board",
        "areas",
        "sets",
        "recycle-bin",
        "revisions-report",
        "new",
      ].includes(segments[2]);

    if (!isDrawingViewerRoute && !isDrawingDetailRoute) {
      setDrawingTitle(null);
      return;
    }

    const projectId = segments[0];
    const drawingId = isDrawingViewerRoute ? segments[3] : segments[2];
    if (!drawingId) {
      setDrawingTitle(null);
      return;
    }

    const cacheKey = `${projectId}:${drawingId}`;
    const cachedTitle = drawingTitleCache.get(cacheKey);
    if (cachedTitle) {
      setDrawingTitle(cachedTitle);
      return;
    }

    let isActive = true;
    const fetchDrawingTitle = async () => {
      try {
        const data = await apiFetch<{
          title?: unknown;
          drawing_number?: unknown;
        }>(`/api/projects/${projectId}/drawings/${drawingId}`);
        const resolvedTitle =
          (typeof data?.title === "string" && data.title.trim().length > 0
            ? data.title.trim()
            : null) ||
          (typeof data?.drawing_number === "string" &&
          data.drawing_number.trim().length > 0
            ? data.drawing_number.trim()
            : null);

        if (!isActive) return;
        if (resolvedTitle) {
          drawingTitleCache.set(cacheKey, resolvedTitle);
          setDrawingTitle(resolvedTitle);
        } else {
          setDrawingTitle(null);
        }
      } catch (error) {
        reportHeaderNavFailure("resolve-drawing-title", error, {
          projectId,
          drawingId,
        });
      }
    };

    fetchDrawingTitle();
    return () => {
      isActive = false;
    };
  }, [pathname]);

  useEffect(() => {
    const segments = pathname?.split("/").filter(Boolean) ?? [];
    const isTestRunRoute =
      segments.length >= 3 &&
      segments[0] === "testing" &&
      segments[1] === "runs" &&
      /^[0-9a-f-]{36}$/i.test(segments[2]);

    if (!isTestRunRoute) {
      setTestRunTitle(null);
      return;
    }

    const runId = segments[2];
    const cached = testRunTitleCache.get(runId);
    if (cached) {
      setTestRunTitle(cached);
      return;
    }

    let isActive = true;
    const fetchTitle = async () => {
      try {
        const data = await apiFetch<{
          run?: { suite?: { display_name?: unknown } };
        }>(`/api/testing/runs/${runId}`);
        const title: string | null =
          typeof data?.run?.suite?.display_name === "string" &&
          data.run.suite.display_name.length > 0
            ? data.run.suite.display_name
            : null;
        if (isActive && title) {
          testRunTitleCache.set(runId, title);
          setTestRunTitle(title);
        }
      } catch (error) {
        reportHeaderNavFailure("resolve-test-run-title", error, { runId });
      }
    };

    fetchTitle();
    return () => {
      isActive = false;
    };
  }, [pathname]);

  useEffect(() => {
    const segments = pathname?.split("/").filter(Boolean) ?? [];
    const isProgressReportDetail =
      segments.length >= 3 &&
      /^\d+$/.test(segments[0]) &&
      segments[1] === "progress-reports" &&
      /^[0-9a-f-]{36}$/i.test(segments[2]);

    if (!isProgressReportDetail) {
      setProgressReportTitle(null);
      return;
    }

    const reportId = segments[2];
    const cached = progressReportTitleCache.get(reportId);
    if (cached) {
      setProgressReportTitle(cached);
      return;
    }

    let isActive = true;
    const fetchTitle = async () => {
      try {
        const data = await apiFetch<{ report?: { title?: unknown } }>(
          `/api/projects/${segments[0]}/progress-reports/${reportId}`,
        );
        const title =
          typeof data?.report?.title === "string" &&
          data.report.title.length > 0
            ? data.report.title
            : null;
        if (isActive && title) {
          progressReportTitleCache.set(reportId, title);
          setProgressReportTitle(title);
        }
      } catch (error) {
        reportHeaderNavFailure("resolve-progress-report-title", error, {
          reportId,
        });
      }
    };

    fetchTitle();
    return () => {
      isActive = false;
    };
  }, [pathname]);

  // Fetch business date for the global Daily Brief detail route
  // (/daily-briefs/[briefId]) so the crumb reads the date, not a raw UUID.
  useEffect(() => {
    const segments = pathname?.split("/").filter(Boolean) ?? [];
    const isDailyBriefDetailRoute =
      segments.length >= 2 &&
      segments[0] === "daily-briefs" &&
      /^[0-9a-f-]{36}$/i.test(segments[1]);

    if (!isDailyBriefDetailRoute) {
      setDailyBriefTitle(null);
      return;
    }

    const briefId = segments[1];
    const cached = dailyBriefTitleCache.get(briefId);
    if (cached) {
      setDailyBriefTitle(cached);
      return;
    }

    let isActive = true;
    const fetchTitle = async () => {
      try {
        const data = await apiFetch<{
          businessDate?: unknown;
          title?: unknown;
        }>(`/api/executive/daily-brief/${briefId}`);
        const label =
          typeof data?.businessDate === "string" &&
          data.businessDate.length > 0
            ? data.businessDate
            : typeof data?.title === "string" && data.title.length > 0
              ? data.title
              : null;
        if (isActive && label) {
          dailyBriefTitleCache.set(briefId, label);
          setDailyBriefTitle(label);
        }
      } catch (error) {
        reportHeaderNavFailure("resolve-daily-brief-title", error, { briefId });
      }
    };

    fetchTitle();
    return () => {
      isActive = false;
    };
  }, [pathname]);

  useEffect(() => {
    const segments = pathname?.split("/").filter(Boolean) ?? [];
    const isGlobalVendorDetailRoute =
      segments.length >= 3 &&
      segments[0] === "directory" &&
      segments[1] === "vendors" &&
      segments[2] !== "new";

    if (!isGlobalVendorDetailRoute) {
      setVendorTitle(null);
      return;
    }

    const vendorId = segments[2];
    if (!vendorId) {
      setVendorTitle(null);
      return;
    }

    const cachedTitle = vendorTitleCache.get(vendorId);
    if (cachedTitle) {
      setVendorTitle(cachedTitle);
      return;
    }

    let isActive = true;
    const fetchVendorTitle = async () => {
      try {
        const data = await apiFetch<{ name?: unknown }>(
          `/api/directory/vendors/${vendorId}`,
        );
        const title =
          typeof data?.name === "string" && data.name.length > 0
            ? data.name
            : null;

        if (isActive) {
          if (title) {
            vendorTitleCache.set(vendorId, title);
            setVendorTitle(title);
          } else {
            setVendorTitle(null);
          }
        }
      } catch (error) {
        reportHeaderNavFailure("resolve-vendor-title", error, { vendorId });
      }
    };

    fetchVendorTitle();
    return () => {
      isActive = false;
    };
  }, [pathname]);

  useEffect(() => {
    const segments = pathname?.split("/").filter(Boolean) ?? [];
    const isGlobalContactDetailRoute =
      segments.length >= 3 &&
      segments[0] === "directory" &&
      segments[1] === "contacts" &&
      segments[2] !== "new";

    if (!isGlobalContactDetailRoute) {
      setContactTitle(null);
      return;
    }

    const contactId = segments[2];
    if (!contactId) {
      setContactTitle(null);
      return;
    }

    const cachedTitle = contactTitleCache.get(contactId);
    if (cachedTitle) {
      setContactTitle(cachedTitle);
      return;
    }

    let isActive = true;
    const fetchContactTitle = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("people")
          .select("first_name, last_name, email")
          .eq("id", contactId)
          .single();

        if (error || !isActive) return;

        const fullName =
          `${data.first_name || ""} ${data.last_name || ""}`.trim();
        const title =
          (fullName.length > 0 ? fullName : null) ||
          (typeof data.email === "string" && data.email.length > 0
            ? data.email
            : null);

        if (title) {
          contactTitleCache.set(contactId, title);
          setContactTitle(title);
        } else {
          setContactTitle(null);
        }
      } catch (error) {
        reportHeaderNavFailure("resolve-contact-title", error, { contactId });
      }
    };

    fetchContactTitle();
    return () => {
      isActive = false;
    };
  }, [pathname]);

  // Fetch title for global /meetings/[meetingId] route
  useEffect(() => {
    const segments = pathname?.split("/").filter(Boolean) ?? [];
    const isGlobalMeetingRoute =
      segments.length === 2 && segments[0] === "meetings";

    if (!isGlobalMeetingRoute) {
      setGlobalMeetingTitle(null);
      return;
    }

    const meetingId = segments[1];
    const cached = globalMeetingTitleCache.get(meetingId);
    if (cached) {
      setGlobalMeetingTitle(cached);
      return;
    }

    let isActive = true;
    const fetchTitle = async () => {
      try {
        const data = await apiFetch<{ title?: unknown }>(
          `/api/meetings/${meetingId}`,
        );
        const title =
          typeof data?.title === "string" && data.title.length > 0
            ? data.title
            : null;
        if (isActive && title) {
          globalMeetingTitleCache.set(meetingId, title);
          setGlobalMeetingTitle(title);
        }
      } catch (error) {
        reportHeaderNavFailure("resolve-global-meeting-title", error, {
          meetingId,
        });
      }
    };

    fetchTitle();
    return () => {
      isActive = false;
    };
  }, [pathname]);

  useEffect(() => {
    const segments = pathname?.split("/").filter(Boolean) ?? [];
    const isPrimeContractDetailRoute =
      segments.length >= 3 &&
      /^\d+$/.test(segments[0]) &&
      segments[1] === "prime-contracts";

    if (!isPrimeContractDetailRoute) {
      setPrimeContractTitle(null);
      return;
    }

    const contractId = segments[2];
    if (!contractId || contractId === "new") {
      setPrimeContractTitle(null);
      return;
    }

    const cacheKey = `${segments[0]}:${contractId}`;
    const cachedTitle = primeContractTitleCache.get(cacheKey);
    if (cachedTitle) {
      setPrimeContractTitle(cachedTitle);
      return;
    }

    let isActive = true;
    const fetchPrimeContractTitle = async () => {
      try {
        const data = await apiFetch<{ title?: unknown }>(
          `/api/projects/${segments[0]}/contracts/${contractId}`,
        );
        const title =
          typeof data?.title === "string" && data.title.length > 0
            ? data.title
            : null;

        if (isActive) {
          if (title) {
            primeContractTitleCache.set(cacheKey, title);
            setPrimeContractTitle(title);
          } else {
            setPrimeContractTitle(null);
          }
        }
      } catch (error) {
        reportHeaderNavFailure("resolve-prime-contract-title", error, {
          projectId: segments[0],
          contractId,
        });
      }
    };

    fetchPrimeContractTitle();
    return () => {
      isActive = false;
    };
  }, [pathname]);

  useEffect(() => {
    const segments = pathname?.split("/").filter(Boolean) ?? [];
    const isCommitmentDetailRoute =
      segments.length >= 3 &&
      /^\d+$/.test(segments[0]) &&
      segments[1] === "commitments" &&
      segments[2] !== "new" &&
      segments[2] !== "recycle-bin" &&
      segments[2] !== "settings";

    if (!isCommitmentDetailRoute) {
      setCommitmentTitle(null);
      return;
    }

    const commitmentId = segments[2];
    const cacheKey = `${segments[0]}:${commitmentId}`;
    const cachedTitle = commitmentTitleCache.get(cacheKey);
    if (cachedTitle) {
      setCommitmentTitle(cachedTitle);
      return;
    }

    let isActive = true;
    const fetchCommitmentTitle = async () => {
      try {
        const json = await apiFetch<{
          data?: { contract_number?: unknown; title?: unknown };
        }>(`/api/commitments/${commitmentId}`);
        const record = json?.data;
        const titlePart =
          typeof record?.title === "string" && record.title.length > 0
            ? record.title
            : null;
        const number =
          typeof record?.contract_number === "string" &&
          record.contract_number.length > 0 &&
          !/^[0-9a-f-]{36}$/i.test(record.contract_number)
            ? record.contract_number
            : null;
        const title = titlePart ?? number;

        if (isActive) {
          if (title) {
            commitmentTitleCache.set(cacheKey, title);
            setCommitmentTitle(title);
          } else {
            setCommitmentTitle(null);
          }
        }
      } catch (error) {
        reportHeaderNavFailure("resolve-commitment-title", error, {
          projectId: segments[0],
          commitmentId,
        });
      }
    };

    fetchCommitmentTitle();
    return () => {
      isActive = false;
    };
  }, [pathname]);

  // Fetch title for prime contract PCO detail routes ([projectId]/prime-contract-pcos/[pcoId]).
  useEffect(() => {
    const segments = pathname?.split("/").filter(Boolean) ?? [];
    const isFlatPrimePcoDetailRoute =
      segments.length >= 3 &&
      segments[1] === "prime-contract-pcos" &&
      segments[2] !== "new";
    const isNestedPrimePcoDetailRoute =
      segments.length >= 6 &&
      segments[1] === "prime-contracts" &&
      segments[3] === "change-orders" &&
      segments[4] === "pcos" &&
      segments[5] !== "new";

    if (!isFlatPrimePcoDetailRoute && !isNestedPrimePcoDetailRoute) {
      setPrimePcoTitle(null);
      return;
    }

    const projectId = segments[0];
    const pcoId = isFlatPrimePcoDetailRoute ? segments[2] : segments[5];
    const cacheKey = `${projectId}:${pcoId}`;
    const cachedTitle = primePcoTitleCache.get(cacheKey);
    if (cachedTitle) {
      setPrimePcoTitle(cachedTitle);
      return;
    }

    let isActive = true;
    const fetchPrimePcoTitle = async () => {
      try {
        const data = await apiFetch<{ pco_number?: unknown; title?: unknown }>(
          `/api/projects/${projectId}/prime-contract-pcos/${pcoId}`,
        );
        const title = getPrimeContractPcoDisplayName({
          pcoNumber:
            typeof data?.pco_number === "string" ? data.pco_number : null,
          title: typeof data?.title === "string" ? data.title : null,
        });

        if (isActive) {
          primePcoTitleCache.set(cacheKey, title);
          setPrimePcoTitle(title);
        }
      } catch (error) {
        reportHeaderNavFailure("resolve-prime-pco-title", error, {
          projectId: segments[0],
          pcoId,
        });
      }
    };

    fetchPrimePcoTitle();
    return () => {
      isActive = false;
    };
  }, [pathname]);

  // Fetch title for change event detail routes
  useEffect(() => {
    const segments = pathname?.split("/").filter(Boolean) ?? [];
    const isChangeEventDetailRoute =
      segments.length >= 3 &&
      /^\d+$/.test(segments[0]) &&
      segments[1] === "change-events" &&
      segments[2] !== "new";

    if (!isChangeEventDetailRoute) {
      setChangeEventTitle(null);
      return;
    }

    const changeEventId = segments[2];
    const cacheKey = `${segments[0]}:${changeEventId}`;
    const cachedTitle = changeEventTitleCache.get(cacheKey);
    if (cachedTitle) {
      setChangeEventTitle(cachedTitle);
      return;
    }

    let isActive = true;
    const fetchChangeEventTitle = async () => {
      try {
        const data = await apiFetch<{ title?: unknown; number?: unknown }>(
          `/api/projects/${segments[0]}/change-events/${changeEventId}`,
        );
        const title =
          typeof data?.title === "string" && data.title.length > 0
            ? data.title
            : typeof data?.number === "string" && data.number.length > 0
              ? data.number
              : null;

        if (isActive) {
          if (title) {
            changeEventTitleCache.set(cacheKey, title);
            setChangeEventTitle(title);
          } else {
            setChangeEventTitle(null);
          }
        }
      } catch (error) {
        reportHeaderNavFailure("resolve-change-event-title", error, {
          projectId: segments[0],
          changeEventId,
        });
      }
    };

    fetchChangeEventTitle();
    return () => {
      isActive = false;
    };
  }, [pathname]);

  // Fetch title for prime CO detail routes ([projectId]/change-orders/prime/[primeCoId])
  useEffect(() => {
    const segments = pathname?.split("/").filter(Boolean) ?? [];
    const isPrimeCoRoute =
      segments.length >= 4 &&
      /^\d+$/.test(segments[0]) &&
      segments[1] === "change-orders" &&
      segments[2] === "prime" &&
      segments[3] !== "new";

    if (!isPrimeCoRoute) {
      setPrimeCoTitle(null);
      return;
    }

    const primeCoId = segments[3];
    const cacheKey = `${segments[0]}:${primeCoId}`;
    const cached = primeCoTitleCache.get(cacheKey);
    if (cached) {
      setPrimeCoTitle(cached);
      return;
    }

    let isActive = true;
    const fetchTitle = async () => {
      try {
        const data = await apiFetch<{ pcco_number?: unknown; title?: unknown }>(
          `/api/projects/${segments[0]}/prime-contract-change-orders/${primeCoId}`,
        );
        const title =
          (typeof data?.pcco_number === "string" && data.pcco_number.length > 0
            ? data.pcco_number
            : null) ||
          (typeof data?.title === "string" && data.title.length > 0
            ? data.title
            : null);
        if (isActive) {
          if (title) {
            primeCoTitleCache.set(cacheKey, title);
            setPrimeCoTitle(title);
          } else {
            setPrimeCoTitle(null);
          }
        }
      } catch (error) {
        reportHeaderNavFailure("resolve-prime-co-title", error, {
          projectId: segments[0],
          primeCoId,
        });
      }
    };

    fetchTitle();
    return () => {
      isActive = false;
    };
  }, [pathname]);

  // Fetch title for commitment CO detail routes ([projectId]/change-orders/commitment/[commitmentCoId])
  useEffect(() => {
    const segments = pathname?.split("/").filter(Boolean) ?? [];
    const isCommitmentCoRoute =
      segments.length >= 4 &&
      /^\d+$/.test(segments[0]) &&
      segments[1] === "change-orders" &&
      segments[2] === "commitment" &&
      segments[3] !== "new";

    if (!isCommitmentCoRoute) {
      setCommitmentCoTitle(null);
      return;
    }

    const projectId = segments[0];
    const commitmentCoId = segments[3];
    const cacheKey = `${projectId}:${commitmentCoId}`;
    const cached = commitmentCoTitleCache.get(cacheKey);
    if (cached) {
      setCommitmentCoTitle(cached);
      return;
    }

    let isActive = true;
    const fetchTitle = async () => {
      try {
        const data = await apiFetch<{
          title?: unknown;
          change_order_number?: unknown;
        }>(
          `/api/projects/${projectId}/commitment-change-orders/${commitmentCoId}`,
        );
        const titlePart =
          typeof data?.title === "string" && data.title.trim().length > 0
            ? data.title.trim()
            : null;
        const numberPart =
          typeof data?.change_order_number === "string" &&
          data.change_order_number.trim().length > 0
            ? `CO ${data.change_order_number.trim()}`
            : null;
        const title =
          titlePart && numberPart
            ? `${numberPart} — ${titlePart}`
            : (titlePart ?? numberPart);

        if (isActive) {
          if (title) {
            commitmentCoTitleCache.set(cacheKey, title);
            setCommitmentCoTitle(title);
          } else {
            setCommitmentCoTitle(null);
          }
        }
      } catch (error) {
        reportHeaderNavFailure("resolve-commitment-co-title", error, {
          projectId: segments[0],
          commitmentCoId,
        });
      }
    };

    fetchTitle();
    return () => {
      isActive = false;
    };
  }, [pathname]);

  // Fetch title for invoice detail routes ([projectId]/prime-contracts/[contractId]/invoices/[invoiceId])
  useEffect(() => {
    const segments = pathname?.split("/").filter(Boolean) ?? [];
    const isInvoiceRoute =
      segments.length >= 5 &&
      segments[1] === "prime-contracts" &&
      segments[3] === "invoices" &&
      segments[4] !== "new";

    if (!isInvoiceRoute) {
      setInvoiceTitle(null);
      return;
    }

    const projectId = segments[0];
    const contractId = segments[2];
    const invoiceId = segments[4];
    const cacheKey = `${projectId}:${contractId}:${invoiceId}`;
    const cached = invoiceTitleCache.get(cacheKey);
    if (cached) {
      setInvoiceTitle(cached);
      return;
    }

    let isActive = true;
    const fetchTitle = async () => {
      try {
        const data = await apiFetch<{
          application_number?: unknown;
          title?: unknown;
        }>(
          `/api/projects/${projectId}/contracts/${contractId}/payment-applications/${invoiceId}`,
        );
        // Note: page URL uses "invoices/[id]" but API route uses "payment-applications/[id]"
        const appNumber =
          typeof data?.application_number === "string" &&
          data.application_number.length > 0
            ? `Invoice #${data.application_number}`
            : null;
        const title =
          appNumber ||
          (typeof data?.title === "string" && data.title.length > 0
            ? data.title
            : null);
        if (isActive) {
          if (title) {
            invoiceTitleCache.set(cacheKey, title);
            setInvoiceTitle(title);
          } else {
            setInvoiceTitle(null);
          }
        }
      } catch (error) {
        reportHeaderNavFailure("resolve-invoice-title", error, {
          projectId,
          contractId,
          invoiceId,
        });
      }
    };

    fetchTitle();
    return () => {
      isActive = false;
    };
  }, [pathname]);

  // Fetch title for RFI detail routes ([projectId]/rfis/[rfiId])
  useEffect(() => {
    const segments = pathname?.split("/").filter(Boolean) ?? [];
    const isRfiDetailRoute =
      segments.length >= 3 &&
      /^\d+$/.test(segments[0]) &&
      segments[1] === "rfis" &&
      segments[2] !== "new";

    if (!isRfiDetailRoute) {
      setRfiTitle(null);
      return;
    }

    const rfiId = segments[2];
    const cacheKey = `${segments[0]}:${rfiId}`;
    const cached = rfiTitleCache.get(cacheKey);
    if (cached) {
      setRfiTitle(cached);
      return;
    }

    let isActive = true;
    const fetchRfiTitle = async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("rfis")
          .select("number, subject")
          .eq("id", rfiId)
          .single();

        if (!isActive || !data) return;
        const number =
          data.number != null && String(data.number).length > 0
            ? `RFI #${data.number}`
            : null;
        const subject =
          typeof data.subject === "string" && data.subject.length > 0
            ? data.subject
            : null;
        const title = subject ?? number;
        if (title) {
          rfiTitleCache.set(cacheKey, title);
          setRfiTitle(title);
        } else {
          setRfiTitle(null);
        }
      } catch (error) {
        reportHeaderNavFailure("resolve-rfi-title", error, {
          projectId,
          rfiId,
        });
      }
    };

    fetchRfiTitle();
    return () => {
      isActive = false;
    };
  }, [pathname]);

  // Fetch title for submittal detail routes ([projectId]/submittals/[submittalId]).
  useEffect(() => {
    const segments = pathname?.split("/").filter(Boolean) ?? [];
    const isSubmittalDetailRoute =
      segments.length >= 3 &&
      /^\d+$/.test(segments[0]) &&
      segments[1] === "submittals" &&
      segments[2] !== "new" &&
      segments[2] !== "recycle-bin" &&
      segments[2] !== "settings";

    if (!isSubmittalDetailRoute) {
      setSubmittalTitle(null);
      return;
    }

    const projectId = segments[0];
    const submittalId = segments[2];
    const cacheKey = `${projectId}:${submittalId}`;
    const cached = submittalTitleCache.get(cacheKey);
    if (cached) {
      setSubmittalTitle(cached);
      return;
    }

    let isActive = true;
    const fetchSubmittalTitle = async () => {
      // Resolve breadcrumb label from submittal number + title to avoid raw UUID crumbs.
      try {
        const data = await apiFetch<{
          submittal_number?: unknown;
          title?: unknown;
        }>(`/api/projects/${projectId}/submittals/${submittalId}`);
        const number =
          typeof data?.submittal_number === "string" &&
          data.submittal_number.trim().length > 0
            ? data.submittal_number.trim()
            : null;
        const title =
          typeof data?.title === "string" && data.title.trim().length > 0
            ? data.title.trim()
            : null;
        const resolvedTitle =
          number && title ? `${number} — ${title}` : (title ?? number);

        if (!isActive) return;
        if (resolvedTitle) {
          submittalTitleCache.set(cacheKey, resolvedTitle);
          setSubmittalTitle(resolvedTitle);
        } else {
          setSubmittalTitle(null);
        }
      } catch (error) {
        reportHeaderNavFailure("resolve-submittal-title", error, {
          projectId,
          submittalId,
        });
      }
    };

    fetchSubmittalTitle();
    return () => {
      isActive = false;
    };
  }, [pathname]);

  useEffect(() => {
    const segments = pathname?.split("/").filter(Boolean) ?? [];
    const isGlobalCompanyDetailRoute =
      segments.length >= 3 &&
      segments[0] === "directory" &&
      segments[1] === "companies" &&
      segments[2] !== "new";
    const isProjectCompanyDetailRoute =
      segments.length >= 4 &&
      /^\d+$/.test(segments[0]) &&
      segments[1] === "directory" &&
      segments[2] === "companies" &&
      segments[3] !== "new";

    if (!isGlobalCompanyDetailRoute && !isProjectCompanyDetailRoute) {
      setCompanyTitle(null);
      return;
    }

    const projectId = isProjectCompanyDetailRoute ? segments[0] : null;
    const companyId = isProjectCompanyDetailRoute ? segments[3] : segments[2];
    if (!companyId) {
      setCompanyTitle(null);
      return;
    }

    const cacheKey = projectId ? `${projectId}:${companyId}` : companyId;
    const cachedTitle = companyTitleCache.get(cacheKey);
    if (cachedTitle) {
      setCompanyTitle(cachedTitle);
      return;
    }

    let isActive = true;
    const fetchCompanyTitle = async () => {
      try {
        const endpoint = projectId
          ? `/api/projects/${projectId}/directory/companies/${companyId}`
          : `/api/directory/companies/${companyId}`;
        const data = await apiFetch<{
          name?: unknown;
          company?: { name?: unknown };
        }>(endpoint);
        const title =
          (typeof data?.name === "string" && data.name.length > 0
            ? data.name
            : null) ||
          (typeof data?.company?.name === "string" &&
          data.company.name.length > 0
            ? data.company.name
            : null);
        if (isActive) {
          if (title) {
            companyTitleCache.set(cacheKey, title);
            setCompanyTitle(title);
          } else {
            setCompanyTitle(null);
          }
        }
      } catch (error) {
        reportHeaderNavFailure("resolve-company-title", error, {
          projectId: segments[0],
          companyId,
        });
      }
    };

    fetchCompanyTitle();
    return () => {
      isActive = false;
    };
  }, [pathname]);

  // Fetch info for subcontractor invoice detail routes ([projectId]/invoicing/subcontractor/[invoiceId])
  useEffect(() => {
    const segments = pathname?.split("/").filter(Boolean) ?? [];
    const isSubcontractorInvoiceDetailRoute =
      segments.length >= 4 &&
      /^\d+$/.test(segments[0]) &&
      segments[1] === "invoicing" &&
      segments[2] === "subcontractor" &&
      segments[3] !== "new";

    if (!isSubcontractorInvoiceDetailRoute) {
      setSubcontractorInvoiceInfo(null);
      return;
    }

    const projectId = segments[0];
    const invoiceId = segments[3];
    const cacheKey = `${projectId}:${invoiceId}`;
    const cached = subcontractorInvoiceTitleCache.get(cacheKey);
    if (cached) {
      setSubcontractorInvoiceInfo(cached);
      return;
    }

    let isActive = true;
    const fetchInfo = async () => {
      try {
        const data = await apiFetch<{
          data?: {
            subcontracts?: {
              contract_number?: string | null;
              title?: string | null;
            } | null;
            purchase_orders?: {
              contract_number?: string | null;
              title?: string | null;
            } | null;
            invoice_number?: unknown;
            id?: unknown;
          };
        }>(
          `/api/projects/${projectId}/invoicing/subcontractor/invoices/${invoiceId}`,
        );
        const invoice = data?.data;
        if (!invoice || !isActive) return;

        const sc = invoice.subcontracts ?? null;
        const po = invoice.purchase_orders ?? null;
        const contractNumber =
          sc?.contract_number ?? po?.contract_number ?? null;
        const contractTitle = sc?.title ?? po?.title ?? null;

        const commitmentLabel = contractNumber
          ? contractTitle
            ? `${contractNumber} — ${contractTitle}`
            : contractNumber
          : (contractTitle ?? "Subcontractor Invoice");

        const invoiceLabel = invoice.invoice_number
          ? `Invoice #${invoice.invoice_number}`
          : `Invoice #${invoice.id}`;

        const info = { commitmentLabel, invoiceLabel };
        subcontractorInvoiceTitleCache.set(cacheKey, info);
        setSubcontractorInvoiceInfo(info);
      } catch (error) {
        reportHeaderNavFailure("resolve-subcontractor-invoice-title", error, {
          projectId,
          invoiceId,
        });
      }
    };

    fetchInfo();
    return () => {
      isActive = false;
    };
  }, [pathname]);

  // Auto-close panels on route change
  useEffect(() => {
    setOpenPanel(null);
  }, [pathname]);

  // Fetch current project details when project ID changes
  useEffect(() => {
    const fetchCurrentProject = async () => {
      if (projectId) {
        if (isProjectContextLoading) {
          return;
        }

        const normalizedSelectedProject = normalizeProject(
          selectedProject
            ? {
                id: selectedProject.id,
                name: selectedProject.name,
                "job number": selectedProject.number ?? null,
                phase: selectedProject.status ?? null,
              }
            : null,
        );
        if (normalizedSelectedProject?.id === projectId) {
          setCurrentProject(normalizedSelectedProject);
          return;
        }

        try {
          const project = await apiFetch<Project>(`/api/projects/${projectId}`);
          const normalizedProject = normalizeProject(project);
          if (normalizedProject?.id === projectId) {
            setCurrentProject(normalizedProject);
          }
        } catch (error) {
          reportHeaderNavFailure("load-current-project", error, { projectId });
        }
      } else {
        setCurrentProject(null);
      }
    };

    fetchCurrentProject();
  }, [isProjectContextLoading, projectId, selectedProject]);

  // Fetch projects for the selector dropdown
  const fetchProjects = useCallback(async () => {
    if (projectsLoadedRef.current) return;
    if (projectsFetchPromiseRef.current) {
      await projectsFetchPromiseRef.current;
      return;
    }

    setLoadingProjects(true);
    const request = (async () => {
      const allProjects: Project[] = [];
      let page = 1;
      let totalPages = 1;

      while (page <= totalPages) {
        const result = await apiFetch<{
          data?: Project[];
          meta?: { totalPages?: number };
        }>(
          `/api/projects?fields=id,name,job_number,phase&includeClient=false&limit=100&page=${page}&archived=false&phase=Current`,
        );
        const pageProjects = Array.isArray(result?.data) ? result.data : [];
        allProjects.push(...pageProjects);

        const apiTotalPages =
          typeof result?.meta?.totalPages === "number"
            ? result.meta.totalPages
            : 1;
        totalPages = Math.max(apiTotalPages, 1);
        page += 1;
      }

      setProjects(allProjects);
      projectsLoadedRef.current = true;
    })();

    projectsFetchPromiseRef.current = request;

    try {
      await request;
    } catch (error) {
      reportHeaderNavFailure("load-project-switcher-options", error);
    } finally {
      projectsFetchPromiseRef.current = null;
      setLoadingProjects(false);
    }
  }, []);

  // Handle project selection - navigate to the same tool for the new project
  const handleProjectSelect = useCallback(
    (newProjectId: number) => {
      const segments = pathname?.split("/").filter(Boolean) ?? [];

      // Check if we're currently on a project-scoped page
      if (segments.length >= 2 && /^\d+$/.test(segments[0])) {
        // Navigate to the same tool for the new project
        const toolPath = segments.slice(1).join("/");
        router.push(`/${newProjectId}/${toolPath}`);
      } else {
        // Navigate to home for the new project
        router.push(`/${newProjectId}/home`);
      }
    },
    [pathname, router],
  );

  const togglePanel = useCallback((id: string) => {
    setOpenPanel((prev) => (prev === id ? null : id));
  }, []);

  const closePanels = useCallback(() => {
    setOpenPanel(null);
  }, []);

  return {
    projectId,
    currentProject,
    activeToolName,
    activeGroupId,
    breadcrumbs,
    openPanel,
    setOpenPanel,
    togglePanel,
    closePanels,
    projects,
    loadingProjects,
    fetchProjects,
    handleProjectSelect,
  };
}
