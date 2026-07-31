"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Building2,
  ChevronsLeft,
  ChevronsRight,
  ChevronRight,
  ChevronDown,
  Menu,
  Sparkles,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { useProjectPermissions } from "@/hooks/use-project-permissions";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { BreadcrumbTrail } from "@/components/ui/breadcrumb-trail";
import {
  headerNavGroups,
  companyWideHeaderTools,
  companyWideToolSections,
  developerCompanyAdminTools,
  buildToolUrl,
  filterToolsByPermission,
  type HeaderNavGroup,
  type HeaderNavigationTool,
} from "@/lib/navigation-config";

import { GlobalSearch } from "@/components/search/global-search";
import { useHeaderNav } from "./use-header-nav";
import { ProjectSelector } from "./project-selector";
import { NotificationBell } from "./notification-bell";
import { CommentsSidebarButton } from "./comments-sidebar-button";
import { FeedbackButton } from "./feedback-button";
import { feedbackTargetProps } from "@/lib/admin-feedback/constants";
import { HeaderUserMenu } from "./header-user-menu";
import { createClient } from "@/lib/supabase/client";
import {
  getCurrentBrowserUser,
  resetCurrentBrowserUserCache,
} from "@/lib/supabase/current-user";
import { apiFetch } from "@/lib/api-client";
import { headerSelectTriggerClassName } from "./header-control-styles";

type PermissionUserBreadcrumbRecord = {
  personId: string;
  authUserId: string | null;
  firstName: string;
  lastName: string;
  email: string;
};

const userManagementBreadcrumbTitleCache = new Map<string, string>();

function AiChatButton() {
  const pathname = usePathname()!;
  const isActive =
    pathname === "/ai" ||
    pathname?.startsWith("/ai/") ||
    pathname === "/ai-assistant" ||
    pathname?.startsWith("/ai-assistant/");
  return (
    <Link
      href="/ai"
      aria-label="AI"
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors",
        isActive
          ? "bg-primary/10 text-primary hover:bg-primary/20"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <Sparkles className="h-4 w-4" />
    </Link>
  );
}

function SidebarToggleButton() {
  const { state, toggleSidebar } = useSidebar();
  const isExpanded = state === "expanded";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={toggleSidebar}
      aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
      className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-accent hover:text-foreground hidden md:inline-flex"
    >
      {isExpanded ? (
        <ChevronsLeft className="h-4 w-4" strokeWidth={1.6} />
      ) : (
        <ChevronsRight className="h-4 w-4" strokeWidth={1.4} />
      )}
    </Button>
  );
}

/**
 * Top header — breadcrumbs left, tools + project selector right.
 */
export function SiteHeader({
  hideBreadcrumbs = false,
}: { hideBreadcrumbs?: boolean } = {}) {
  const router = useRouter();
  const pathname = usePathname()!;
  const nav = useHeaderNav();
  const { setOpenMobile } = useSidebar();
  const { permissions, userType, isAppAdmin } = useProjectPermissions(
    nav.projectId,
  );
  const isDeveloper = userType === "developer";
  const [user, setUser] = React.useState<User | null>(null);
  const [userManagementBreadcrumbTitle, setUserManagementBreadcrumbTitle] =
    React.useState<string | null>(null);

  React.useEffect(() => {
    const supabase = createClient();

    const fetchUser = async () => {
      const currentUser = await getCurrentBrowserUser(supabase);
      setUser(currentUser);
    };

    void fetchUser();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      resetCurrentBrowserUserCache();
      setUser(session?.user ?? null);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  const userManagementUserId = React.useMemo(() => {
    const segments = pathname?.split("/").filter(Boolean) ?? [];
    if (
      segments.length >= 3 &&
      segments[0] === "user-management" &&
      segments[1] === "users" &&
      segments[2]
    ) {
      return decodeURIComponent(segments[2]);
    }

    return null;
  }, [pathname]);

  React.useEffect(() => {
    if (!userManagementUserId) {
      setUserManagementBreadcrumbTitle(null);
      return;
    }

    const cachedTitle =
      userManagementBreadcrumbTitleCache.get(userManagementUserId);
    if (cachedTitle) {
      setUserManagementBreadcrumbTitle(cachedTitle);
      return;
    }

    let isActive = true;
    const loadUserTitle = async () => {
      try {
        const response = await apiFetch<{
          data: PermissionUserBreadcrumbRecord[];
        }>("/api/permissions/users");
        const userRecord = response.data.find(
          (item) =>
            item.personId === userManagementUserId ||
            item.authUserId === userManagementUserId,
        );
        if (!userRecord || !isActive) return;

        const fullName = [userRecord.firstName, userRecord.lastName]
          .filter(Boolean)
          .join(" ")
          .trim();
        const title = fullName || userRecord.email;
        if (!title) return;

        userManagementBreadcrumbTitleCache.set(userManagementUserId, title);
        setUserManagementBreadcrumbTitle(title);
      } catch {
        if (isActive) setUserManagementBreadcrumbTitle(null);
      }
    };

    loadUserTitle();
    return () => {
      isActive = false;
    };
  }, [userManagementUserId]);

  const breadcrumbs = React.useMemo(() => {
    if (!userManagementUserId || !userManagementBreadcrumbTitle) {
      return nav.breadcrumbs;
    }

    return nav.breadcrumbs.map((crumb, index) =>
      index === nav.breadcrumbs.length - 1
        ? { ...crumb, label: userManagementBreadcrumbTitle }
        : crumb,
    );
  }, [nav.breadcrumbs, userManagementBreadcrumbTitle, userManagementUserId]);

  return (
    <header
      className="relative z-40 flex h-12 shrink-0 items-center text-foreground shadow-sm"
      {...feedbackTargetProps("app.site-header")}
    >
      <div className="flex w-full items-center justify-between px-3 sm:px-5 lg:px-7 min-w-0">
        {/* ── Left: Sidebar toggle + Mobile logo + Breadcrumbs (desktop) ── */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Sidebar toggle — desktop only, left of breadcrumbs */}
          <SidebarToggleButton />

          {/* Mobile: Logo on left */}
          <Link
            href="/"
            className="flex items-center md:hidden"
            aria-label="Home"
          >
            <Image
              src="/Alleato-Group-Logo_Dark.png"
              alt="Alleato"
              width={96}
              height={21}
              priority
              className="h-auto w-24 dark:invert"
              style={{ height: "auto" }}
            />
          </Link>

          {/* Breadcrumbs — only where there's room (lg+). Below lg the project
              selector + tools dropdown already convey location, so hiding the
              trail here keeps the header from crowding into it. */}
          {!hideBreadcrumbs && breadcrumbs.length > 1 && (
            <div className="hidden lg:flex items-center gap-1 text-xs min-w-0 overflow-hidden">
              <BreadcrumbTrail
                items={breadcrumbs}
                listClassName="text-xs"
                linkClassName="max-w-[8rem] xl:max-w-[10rem] text-muted-foreground"
                currentClassName="max-w-[10rem] xl:max-w-[12rem] font-medium text-foreground"
                maxVisibleItems={5}
                leadingItems={2}
                trailingItems={2}
              />
            </div>
          )}
        </div>

        {/* ── Site-wide search — trigger visible on all viewports; the ⌘K
            listener + dialog mount here once for the whole app shell ── */}
        <div className="flex items-center pr-1 md:pr-2">
          <GlobalSearch />
        </div>

        {/* ── Right: Tools dropdown + Project selector (desktop only) ── */}
        <div className="hidden md:flex items-center gap-1 lg:gap-2 flex-shrink-0">
          <ProjectSelector
            projectId={nav.projectId}
            currentProject={nav.currentProject}
            projects={nav.projects}
            loadingProjects={nav.loadingProjects}
            onFetchProjects={nav.fetchProjects}
            onProjectSelect={nav.handleProjectSelect}
            onViewAll={() => router.push("/")}
          />
          <ToolsDropdown
            projectId={nav.projectId}
            currentProject={nav.currentProject}
            projects={nav.projects}
            loadingProjects={nav.loadingProjects}
            onFetchProjects={nav.fetchProjects}
            onProjectSelect={nav.handleProjectSelect}
            onViewAll={() => router.push("/")}
            activeToolName={nav.activeToolName}
            permissions={permissions}
            isAppAdmin={isAppAdmin}
            userType={userType}
            isDeveloper={isDeveloper}
            userEmail={user?.email ?? null}
          />
          <AiChatButton />
          <FeedbackButton />
          <CommentsSidebarButton />
          <React.Suspense fallback={null}>
            <NotificationBell />
          </React.Suspense>
          <HeaderUserMenu
            user={user}
            projectId={nav.projectId}
            activeToolName={nav.activeToolName}
            permissions={permissions}
            isAppAdmin={isAppAdmin}
            userType={userType}
          />
        </div>

        {/* Mobile: Menu button on right */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setOpenMobile(true)}
          aria-label="Open menu"
          className="md:hidden h-12 w-12 shrink-0 text-foreground"
        >
          <Menu className="size-6" strokeWidth={1.8} />
        </Button>
      </div>
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Tools dropdown
 * ───────────────────────────────────────────────────────────────────────────── */

function ToolsDropdown({
  projectId,
  currentProject,
  projects,
  loadingProjects,
  onFetchProjects,
  onProjectSelect,
  onViewAll,
  activeToolName,
  permissions,
  isAppAdmin,
  userType,
  isDeveloper,
  userEmail,
}: {
  projectId: number | null;
  currentProject: {
    id: number;
    name: string | null;
    "job number": string | null;
  } | null;
  projects: { id: number; name: string | null; "job number": string | null }[];
  loadingProjects: boolean;
  onFetchProjects: () => void;
  onProjectSelect: (projectId: number) => void;
  onViewAll: () => void;
  activeToolName: string;
  permissions: Record<string, string[]>;
  isAppAdmin: boolean;
  userType: string | null;
  isDeveloper: boolean;
  userEmail: string | null;
}) {
  const [open, setOpen] = React.useState(false);
  const [showCompanyTools, setShowCompanyTools] = React.useState(false);

  const groups = headerNavGroups.map((group) => ({
    ...group,
    visibleTools: filterToolsByPermission(
      group.tools,
      projectId,
      permissions,
      isAppAdmin,
      userType,
      isDeveloper,
      userEmail,
    ),
  }));
  const visibleCompanyTools = filterToolsByPermission(
    companyWideHeaderTools,
    projectId,
    permissions,
    isAppAdmin,
    userType,
    isDeveloper,
    userEmail,
  );
  const visibleDeveloperAdminTools = filterToolsByPermission(
    isDeveloper ? developerCompanyAdminTools : [],
    projectId,
    permissions,
    isAppAdmin,
    userType,
    isDeveloper,
  );

  React.useEffect(() => {
    if (!open) {
      setShowCompanyTools(false);
      return;
    }
    if (!projectId) {
      setShowCompanyTools(true);
    }
  }, [open, projectId]);

  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn("w-36 lg:w-44 xl:w-52", headerSelectTriggerClassName)}
        >
          <span
            className={cn(
              "truncate text-xs",
              activeToolName === "Projects"
                ? "text-muted-foreground"
                : "text-foreground/80",
            )}
          >
            {activeToolName === "Projects" ? "Select Tool" : activeToolName}
          </span>
          <ChevronDown
            className="h-3 w-3 shrink-0 text-muted-foreground/60"
            strokeWidth={1.6}
          />
        </Button>
      </PopoverTrigger>
      {open && (
        <Button
          type="button"
          variant="ghost"
          aria-label="Close tools menu"
          className="fixed inset-x-0 bottom-0 top-12 z-[10000] h-auto cursor-default rounded-none bg-background/55 p-0 backdrop-blur-sm animate-in fade-in duration-150 hover:bg-background/55 focus-visible:ring-0 focus-visible:ring-offset-0"
          onClick={() => setOpen(false)}
        />
      )}

      <PopoverContent
        align="end"
        sideOffset={6}
        className="z-[10010] overflow-hidden border border-border bg-popover p-0 shadow-sm"
        style={{
          width: "min(1040px, calc(100vw - 1.5rem))",
          maxWidth: "calc(100vw - 1.5rem)",
        }}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between border-b border-border/50 px-5 py-2.5">
          <div className="flex items-center gap-2">
            {showCompanyTools && projectId && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => setShowCompanyTools(false)}
                aria-label="Back to project tools"
              >
                <ChevronsLeft className="h-3.5 w-3.5" strokeWidth={1.6} />
              </Button>
            )}
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              {showCompanyTools ? "Company-wide tools" : "Project tools"}
            </span>
          </div>
          {!projectId && !showCompanyTools && (
            <span className="rounded-full bg-status-warning/10 px-2 py-0.5 text-[10px] font-medium text-status-warning">
              Select a project to unlock more tools
            </span>
          )}
        </div>

        {/* Groups */}
        <div
          key={showCompanyTools ? "company-tools" : "project-tools"}
          className="animate-in fade-in duration-200"
        >
          {showCompanyTools ? (
            <>
              <CompanyToolsPanel
                tools={companyWideHeaderTools}
                visibleTools={visibleCompanyTools}
                adminTools={isDeveloper ? developerCompanyAdminTools : []}
                visibleAdminTools={visibleDeveloperAdminTools}
                projectId={projectId}
                activeToolName={activeToolName}
                onClose={() => setOpen(false)}
              />
              {!projectId && (
                <div className="border-t border-border/50 px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13px] font-medium text-muted-foreground">
                      Select a project
                    </span>
                    <ProjectSelector
                      projectId={projectId}
                      currentProject={currentProject}
                      projects={projects}
                      loadingProjects={loadingProjects}
                      onFetchProjects={onFetchProjects}
                      onProjectSelect={(nextProjectId) => {
                        onProjectSelect(nextProjectId);
                        setShowCompanyTools(false);
                        setOpen(false);
                      }}
                      onViewAll={onViewAll}
                    />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="overflow-x-auto">
              <div
                className="flex divide-x divide-border/40"
                style={{ minWidth: 860 }}
              >
                {groups.map((group) => (
                  <ToolsGroup
                    key={group.id}
                    group={group}
                    visibleTools={group.visibleTools}
                    projectId={projectId}
                    activeToolName={activeToolName}
                    onClose={() => setOpen(false)}
                  />
                ))}
              </div>
              <div className="border-t border-border/50 px-5 py-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCompanyTools(true)}
                  className="h-8 gap-2 px-2 text-[13px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Building2 className="h-3.5 w-3.5" strokeWidth={1.6} />
                  View Company Tools
                  <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.6} />
                </Button>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CompanyToolsPanel({
  tools,
  visibleTools,
  adminTools,
  visibleAdminTools,
  projectId,
  activeToolName,
  onClose,
}: {
  tools: HeaderNavigationTool[];
  visibleTools: HeaderNavigationTool[];
  adminTools: HeaderNavigationTool[];
  visibleAdminTools: HeaderNavigationTool[];
  projectId: number | null;
  activeToolName: string;
  onClose: () => void;
}) {
  // Only the named Company-wide sections render. The single Admin Dashboard
  // link lives at the end of the "Company" section; other internal admin tools
  // are reachable from the Admin Dashboard page itself.
  const sections = companyWideToolSections;
  const allVisibleTools = [...visibleTools, ...visibleAdminTools];

  return (
    <div className="overflow-x-auto">
      <div className="flex divide-x divide-border/40" style={{ minWidth: 760 }}>
        {sections.map((section) => (
          <div key={section.label} className="flex flex-1 flex-col gap-0 p-4">
            <p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {section.label}
            </p>
            {section.toolNames.map((toolName) => {
              const tool = allVisibleTools.find(
                (candidate) => candidate.name === toolName,
              );
              if (!tool) return null;
              return (
                <ToolItem
                  key={`${tool.path}:${tool.name}`}
                  tool={tool}
                  projectId={projectId}
                  isActive={tool.name === activeToolName}
                  isDisabled={false}
                  onClose={onClose}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function ToolsGroup({
  group,
  visibleTools,
  projectId,
  activeToolName,
  onClose,
}: {
  group: HeaderNavGroup & { visibleTools: HeaderNavigationTool[] };
  visibleTools: HeaderNavigationTool[];
  projectId: number | null;
  activeToolName: string;
  onClose: () => void;
}) {
  // If the group has subGroups, render with sub-section headers
  if (group.subGroups && group.subGroups.length > 0) {
    return (
      <div className="flex flex-1 flex-col gap-0 p-4">
        <p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
          {group.label}
        </p>
        {group.subGroups.map((subGroup) => {
          const subTools = visibleTools.filter((tool) =>
            subGroup.toolNames.includes(tool.name),
          );
          return (
            <div key={subGroup.label} className="mb-3 last:mb-0">
              <p className="mb-1 px-2 text-[10px] font-medium text-muted-foreground/70">
                {subGroup.label}
              </p>
              {subTools.map((tool) => (
                <ToolItem
                  key={`${tool.path}:${tool.name}`}
                  tool={tool}
                  projectId={projectId}
                  isActive={tool.name === activeToolName}
                  isDisabled={false}
                  onClose={onClose}
                />
              ))}
            </div>
          );
        })}
      </div>
    );
  }

  // Default: flat list
  return (
    <div className="flex flex-1 flex-col gap-0 p-4">
      <p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {group.label}
      </p>
      {visibleTools.map((tool) => (
        <ToolItem
          key={`${tool.path}:${tool.name}`}
          tool={tool}
          projectId={projectId}
          isActive={tool.name === activeToolName}
          isDisabled={false}
          onClose={onClose}
        />
      ))}
    </div>
  );
}

function ToolItem({
  tool,
  projectId,
  isActive,
  isDisabled,
  onClose,
}: {
  tool: HeaderNavigationTool;
  projectId: number | null;
  isActive: boolean;
  isDisabled: boolean;
  onClose: () => void;
}) {
  const isExternal = tool.path.startsWith("http");
  const href = buildToolUrl(tool.path, projectId, tool.requiresProject);
  const Icon = tool.icon;

  const className = cn(
    "group flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors",
    isDisabled
      ? "pointer-events-none opacity-30"
      : isActive
        ? "bg-muted text-foreground"
        : "text-foreground/75 hover:bg-muted hover:text-foreground",
  );

  const content = (
    <>
      {Icon && (
        <span
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center",
            isActive
              ? "text-foreground"
              : "text-muted-foreground group-hover:text-foreground",
          )}
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={1.6} />
        </span>
      )}
      <span
        className={cn(
          "text-[13px]",
          isActive ? "font-semibold" : "font-normal",
        )}
      >
        {tool.name}
      </span>
    </>
  );

  if (isExternal) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => onClose()}
        className={className}
      >
        {content}
      </a>
    );
  }

  return (
    <Link
      href={href}
      onClick={(e) => {
        if (isDisabled) {
          e.preventDefault();
          return;
        }
        onClose();
      }}
      className={className}
    >
      {content}
    </Link>
  );
}
