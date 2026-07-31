"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Folder,
  Bell,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  DollarSign,
  FlaskConical,
  FolderOpen,
  List,
  MessageSquare,
  Phone,
  Users,
  X,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { HeaderUserMenu } from "@/components/header/header-user-menu"
import { createClient } from "@/lib/supabase/client"
import {
  getCurrentBrowserUser,
  resetCurrentBrowserUserCache,
} from "@/lib/supabase/current-user"
import type { User } from "@supabase/supabase-js"

import {
  sidebarNavGroups,
  subcontractorSidebarGroup,
  companyWideHeaderTools,
  companyWideToolSections,
  developerCompanyAdminTools,
  buildToolUrl,
  extractProjectId,
  filterToolsByPermission,
  type NavigationTool,
  type SidebarNavGroup,
} from "@/lib/navigation-config"
import { useProjectPermissions } from "@/hooks/use-project-permissions"
import { useCurrentUserProfile } from "@/hooks/use-current-user-profile"
import { ProjectSelector } from "@/components/header/project-selector"
import { useHeaderNav } from "@/components/header/use-header-nav"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

// =============================================================================
// Flyout panel that appears on hover in collapsed mode
// =============================================================================

function SidebarFlyout({
  group,
  tools,
  projectId,
  pathname,
  isOpen,
  onMouseEnter,
  onMouseLeave,
}: {
  group: SidebarNavGroup
  tools: NavigationTool[]
  projectId: number | null
  pathname: string
  isOpen: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        "absolute left-full top-0 z-50 ml-1.5",
        "transition-all duration-200 ease-out",
        isOpen
          ? "pointer-events-auto translate-x-0 opacity-100"
          : "pointer-events-none -translate-x-1 opacity-0"
      )}
    >
      <div className="w-52 rounded-lg border border-border/60 bg-popover py-2 shadow-sm">
        <div className="px-3 pb-1.5 pt-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {group.label}
          </span>
        </div>
        <div className="flex flex-col gap-0.5 px-1.5">
          {tools.map((tool) => {
            const isExternal = tool.path.startsWith("http")
            const href = isExternal
              ? tool.path
              : tool.path.startsWith("/")
                ? tool.path
                : buildToolUrl(tool.path, projectId, tool.requiresProject)
            const isActive =
              !isExternal &&
              (pathname === href || (href !== "/" && pathname.startsWith(`${href}/`)))
            const Icon = tool.icon
            const linkClass = cn(
              "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors",
              isActive
                ? "font-medium text-foreground"
                : "text-foreground/75 hover:bg-accent/60 hover:text-foreground"
            )

            return isExternal ? (
              <a
                key={`${tool.path}:${tool.name}`}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                {Icon && <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />}
                <span className="truncate">{tool.name}</span>
              </a>
            ) : (
              <Link
                key={`${tool.path}:${tool.name}`}
                href={href}
                className={linkClass}
              >
                {Icon && <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />}
                <span className="truncate">{tool.name}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Collapsed icon button with flyout
// =============================================================================

function CollapsedGroupIcon({
  group,
  tools,
  projectId,
  pathname,
  hasActiveChild,
}: {
  group: SidebarNavGroup
  tools: NavigationTool[]
  projectId: number | null
  pathname: string
  hasActiveChild: boolean
}) {
  const [isHovered, setIsHovered] = React.useState(false)
  const leaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseEnter = React.useCallback(() => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current)
      leaveTimerRef.current = null
    }
    setIsHovered(true)
  }, [])

  const handleMouseLeave = React.useCallback(() => {
    leaveTimerRef.current = setTimeout(() => {
      setIsHovered(false)
    }, 150)
  }, [])

  React.useEffect(() => {
    return () => {
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
    }
  }, [])

  const minimalIconByGroup: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
    project: Folder,
    financial: DollarSign,
    operations: List,
    documents: FolderOpen,
    development: FlaskConical,
  }
  const Icon = minimalIconByGroup[group.id] ?? List

  return (
    <div className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-150",
          isHovered
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : hasActiveChild
              ? "text-sidebar-foreground"
              : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        )}
        aria-label={group.label}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={1.3} />
      </Button>
      <SidebarFlyout
        group={group}
        tools={tools}
        projectId={projectId}
        pathname={pathname}
        isOpen={isHovered}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  )
}

// =============================================================================
// Expanded navigation group
// =============================================================================

function ExpandedNavGroup({
  group,
  tools,
  projectId,
  pathname,
  isOpen,
  onToggle,
}: {
  group: SidebarNavGroup
  tools: NavigationTool[]
  projectId: number | null
  pathname: string
  isOpen: boolean
  onToggle: () => void
}) {
  const { isMobile, setOpenMobile } = useSidebar()
  const closeMobileSidebar = React.useCallback(() => {
    if (isMobile) setOpenMobile(false)
  }, [isMobile, setOpenMobile])

  return (
    <div className={cn("flex flex-col", isMobile ? "mt-4 first:mt-1" : "mt-2.5 first:mt-0.5 md:mt-4 md:first:mt-1")}>
      <Button
        type="button"
        variant="ghost"
        onClick={onToggle}
        className={cn(
          "h-auto w-full justify-between rounded-md text-left hover:bg-transparent",
          isMobile ? "px-3 pb-2 pt-0" : "px-2 pb-1 pt-0"
        )}
      >
        <span className={cn(
          "text-[10px] font-semibold uppercase tracking-widest",
          isMobile ? "text-muted-foreground" : "text-sidebar-foreground/50"
        )}>
          {group.label}
        </span>
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform duration-200",
            isMobile ? "text-muted-foreground/70" : "text-sidebar-foreground/40",
            isOpen ? "rotate-0" : "-rotate-90"
          )}
          strokeWidth={2.5}
        />
      </Button>
      <div
        className={cn(
          "grid transition-all duration-200 ease-in-out",
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className={cn("flex flex-col pb-1", isMobile ? "gap-1" : "gap-0 md:gap-0.5")}>
            {tools.map((tool) => {
              const isExternal = tool.path.startsWith("http")
              const href = isExternal
                ? tool.path
                : tool.path.startsWith("/")
                  ? tool.path
                  : buildToolUrl(tool.path, projectId, tool.requiresProject)
              const isActive =
                !isExternal &&
                (pathname === href || (href !== "/" && pathname.startsWith(`${href}/`)))
              const Icon = tool.icon
              const linkClass = cn(
                "flex items-center gap-2 rounded-md transition-colors duration-150",
                isMobile ? "px-3 py-2.5 text-[13px]" : "px-2 py-1.5 text-xs",
                isActive
                  ? isMobile
                    ? "bg-muted text-foreground font-medium"
                    : "font-medium text-sidebar-foreground"
                  : isMobile
                    ? "text-muted-foreground hover:bg-muted hover:text-foreground"
                    : "text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              )

              return isExternal ? (
                <a
                  key={`${tool.path}:${tool.name}`}
                  href={href}
                  target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
                onClick={closeMobileSidebar}
              >
                  {Icon && <Icon className={cn("shrink-0", isMobile ? "h-4 w-4" : "h-3.5 w-3.5")} strokeWidth={1.5} />}
                  <span className="truncate">{tool.name}</span>
                </a>
              ) : (
                <Link
                  key={`${tool.path}:${tool.name}`}
                href={href}
                className={linkClass}
                onClick={closeMobileSidebar}
              >
                  {Icon && <Icon className={cn("shrink-0", isMobile ? "h-4 w-4" : "h-3.5 w-3.5")} strokeWidth={1.5} />}
                  <span className="truncate">{tool.name}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function ExpandedCompanyWideTools({
  visibleTools,
  projectId,
  pathname,
  onBack,
  projectSelector,
}: {
  visibleTools: NavigationTool[]
  projectId: number | null
  pathname: string
  onBack: () => void
  projectSelector?: React.ReactNode
}) {
  const { isMobile, setOpenMobile } = useSidebar()
  const closeMobileSidebar = React.useCallback(() => {
    if (isMobile) setOpenMobile(false)
  }, [isMobile, setOpenMobile])

  // Only the named Company-wide sections render. The single Admin Dashboard
  // link lives at the end of the "Company" section; other internal admin tools
  // are reachable from the Admin Dashboard page itself.
  const sections = companyWideToolSections

  return (
    <div className="flex flex-col">
      {projectId ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onBack}
          aria-label="Back to project tools"
          className={cn(
            "mb-3 rounded-md",
            isMobile
              ? "text-muted-foreground hover:bg-muted hover:text-foreground"
              : "text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
          )}
        >
          <ChevronsLeft className="h-3.5 w-3.5" strokeWidth={1.6} />
        </Button>
      ) : (
        <div className="mb-4 space-y-2 px-2">
          <span className={cn(
            "text-[10px] font-semibold uppercase tracking-widest",
            isMobile ? "text-muted-foreground" : "text-sidebar-foreground/50"
          )}>
            Select a project
          </span>
          {projectSelector}
        </div>
      )}
      {sections.map((section) => {
        const sectionTools = section.toolNames
          .map((toolName) => visibleTools.find((tool) => tool.name === toolName))
          .filter((tool): tool is NavigationTool => Boolean(tool))

        if (sectionTools.length === 0) return null

        return (
          <div key={section.label} className="flex flex-col mt-4 first:mt-0">
            <span className={cn(
              "px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest",
              isMobile ? "text-muted-foreground" : "text-sidebar-foreground/50"
            )}>
              {section.label}
            </span>
            <div className={cn("flex flex-col pb-1", isMobile ? "gap-1" : "gap-0.5")}>
              {sectionTools.map((tool) => {
                const isExternal = tool.path.startsWith("http")
                const href = isExternal
                  ? tool.path
                  : tool.path.startsWith("/")
                    ? tool.path
                    : buildToolUrl(tool.path, projectId, tool.requiresProject)
                const isActive =
                  !isExternal &&
                  (pathname === href || (href !== "/" && pathname.startsWith(`${href}/`)))
                const Icon = tool.icon
                const linkClass = cn(
                  "flex items-center gap-2 rounded-md transition-colors duration-150",
                  isMobile ? "px-3 py-2.5 text-[13px]" : "px-2 py-1.5 text-xs",
                  isActive
                    ? isMobile
                      ? "bg-muted text-foreground font-medium"
                      : "font-medium text-sidebar-foreground"
                    : isMobile
                      ? "text-muted-foreground hover:bg-muted hover:text-foreground"
                      : "text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                )

                return isExternal ? (
                  <a
                    key={`${tool.path}:${tool.name}`}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={linkClass}
                    onClick={closeMobileSidebar}
                  >
                    {Icon && <Icon className={cn("shrink-0", isMobile ? "h-4 w-4" : "h-3.5 w-3.5")} strokeWidth={1.5} />}
                    <span className="truncate">{tool.name}</span>
                  </a>
                ) : (
                  <Link
                    key={`${tool.path}:${tool.name}`}
                    href={href}
                    className={linkClass}
                    onClick={closeMobileSidebar}
                  >
                    {Icon && <Icon className={cn("shrink-0", isMobile ? "h-4 w-4" : "h-3.5 w-3.5")} strokeWidth={1.5} />}
                    <span className="truncate">{tool.name}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CompanyWideToolsButton({
  tools,
  projectId,
  pathname,
}: {
  tools: NavigationTool[]
  projectId: number | null
  pathname: string
}) {
  const [isHovered, setIsHovered] = React.useState(false)
  const leaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const companyGroup = React.useMemo<SidebarNavGroup>(
    () => ({
      id: "company-wide",
      label: "Company-wide tools",
      icon: Building2,
      tools,
    }),
    [tools]
  )

  const handleMouseEnter = React.useCallback(() => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current)
      leaveTimerRef.current = null
    }
    setIsHovered(true)
  }, [])

  const handleMouseLeave = React.useCallback(() => {
    leaveTimerRef.current = setTimeout(() => setIsHovered(false), 150)
  }, [])

  React.useEffect(() => {
    return () => {
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
    }
  }, [])

  return (
    <div className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-foreground/60 transition-all duration-150 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        aria-label="View Company Tools"
      >
        <Building2 className="h-3.5 w-3.5" strokeWidth={1.4} />
      </Button>
      <SidebarFlyout
        group={companyGroup}
        tools={tools}
        projectId={projectId}
        pathname={pathname}
        isOpen={isHovered}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  )
}

// =============================================================================
// Main AppSidebar
// =============================================================================

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()! ?? ""
  const router = useRouter()
  const { state, isMobile, setOpenMobile } = useSidebar()

  const [isHovering, setIsHovering] = React.useState(false)
  const [user, setUser] = React.useState<User | null>(null)
  const [showCompanyWideTools, setShowCompanyWideTools] = React.useState(false)

  React.useEffect(() => {
    const supabase = createClient()
    void getCurrentBrowserUser(supabase).then((currentUser) => setUser(currentUser))
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      resetCurrentBrowserUserCache()
      setUser(session?.user ?? null)
    })
    return () => data.subscription.unsubscribe()
  }, [])
  const hoverTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Hover-to-peek: when collapsed, hovering expands temporarily
  // The sidebar reverts to collapsed when the mouse leaves
  const isPinned = state === "expanded"
  const mobileDisplayName = React.useMemo(() => {
    const fullName = typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : ""
    const emailPrefix = typeof user?.email === "string" && user.email.includes("@") ? user.email.split("@")[0] : ""
    return fullName || emailPrefix || "User"
  }, [user])
  const isVisuallyExpanded = isPinned || (isHovering && !isMobile)
  // On mobile, the sidebar renders inside a Sheet — always show expanded navigation
  const isCollapsed = isMobile ? false : !isVisuallyExpanded
  const isTeamChatPage = pathname.startsWith("/team-chat")

  const handleMouseEnter = React.useCallback(() => {
    if (isPinned || isMobile) return
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = setTimeout(() => setIsHovering(true), 200)
  }, [isPinned, isMobile])

  const handleMouseLeave = React.useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = setTimeout(() => setIsHovering(false), 350)
  }, [])

  // Clean up timer on unmount
  React.useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    }
  }, [])

  // Extract project ID from URL path
  const projectId = React.useMemo(() => extractProjectId(pathname), [pathname])
  const { permissions, userType, isAppAdmin, isDeveloper: isDeveloperFromShell } = useProjectPermissions(projectId)
  const { profile: currentUserProfile } = useCurrentUserProfile()
  const isDeveloper = isDeveloperFromShell || currentUserProfile?.isDeveloper === true

  // Header nav hook for project selector
  const nav = useHeaderNav()
  const mobileProjectLabel = nav.currentProject?.name || "Select a project"
  const mobileProjectMeta = nav.currentProject?.["job number"]
    ? `Job ${nav.currentProject["job number"]}`
    : "Project tools"

  const isSubcontractor = userType === "subcontractor"
  // Filter tools by permission
  const filterTools = React.useCallback(
    (tools: NavigationTool[]): NavigationTool[] => {
      return filterToolsByPermission(
        tools,
        projectId,
        permissions,
        isAppAdmin,
        userType,
        isDeveloper,
        user?.email ?? null,
        {
          isAdmin: currentUserProfile?.isAdmin,
          isDeveloper,
          role: currentUserProfile?.role,
          title: currentUserProfile?.title,
          userType,
        },
      )
    },
    [
      currentUserProfile?.isAdmin,
      currentUserProfile?.role,
      currentUserProfile?.title,
      isAppAdmin,
      isDeveloper,
      permissions,
      projectId,
      user?.email,
      userType,
    ]
  )

  // Check if a group has any active child
  const groupHasActiveChild = React.useCallback(
    (tools: NavigationTool[]): boolean => {
      return tools.some((tool) => {
        if (tool.path.startsWith("http")) return false
        const href = tool.path.startsWith("/")
          ? tool.path
          : buildToolUrl(tool.path, projectId, tool.requiresProject)
        return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`))
      })
    },
    [pathname, projectId]
  )

  // Filtered groups — subcontractors get a focused single-group nav
  const filteredGroups = React.useMemo(() => {
    if (isSubcontractor && projectId) {
      const tools = filterTools(subcontractorSidebarGroup.tools)
      return tools.length > 0 ? [{ ...subcontractorSidebarGroup, tools }] : []
    }
    const projectGroups = sidebarNavGroups
      .map((group) => ({
        ...group,
        tools: filterTools(group.tools),
      }))
      .filter((group) => group.tools.length > 0)

    return projectGroups
  }, [filterTools, isSubcontractor, projectId])

  const companyWideTools = React.useMemo<NavigationTool[]>(
    () => [
      ...companyWideHeaderTools,
      // Only surface the single Admin Dashboard link (last item of the Company
      // section). Other internal admin tools are reachable from that page.
      ...(isDeveloper
        ? developerCompanyAdminTools.filter((tool) => tool.name === "Admin Dashboard")
        : []),
    ],
    [isDeveloper]
  )
  const visibleCompanyWideTools = React.useMemo(
    () => filterTools(companyWideTools),
    [companyWideTools, filterTools]
  )

  // Collapsible section state for project-scoped sidebar groups.
  const [openGroupIds, setOpenGroupIds] = React.useState<Set<string>>(new Set())
  const initializedGroupKeyRef = React.useRef<string | null>(null)
  const filteredGroupKey = React.useMemo(
    () => filteredGroups.map((group) => group.id).join("|"),
    [filteredGroups]
  )

  const toggleGroup = React.useCallback((groupId: string) => {
    setOpenGroupIds((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }, [])

  // Default every visible section open once the permission-filtered nav is known.
  // User collapse choices are preserved until the set of visible groups changes.
  React.useEffect(() => {
    if (!filteredGroupKey || initializedGroupKeyRef.current === filteredGroupKey) return

    initializedGroupKeyRef.current = filteredGroupKey
    setOpenGroupIds(new Set(filteredGroups.map((group) => group.id)))
  }, [filteredGroups, filteredGroupKey])

  // Auto-expand the group that contains the active route
  React.useEffect(() => {
    const activeGroup = filteredGroups.find((g) => groupHasActiveChild(g.tools))
    if (activeGroup) {
      setOpenGroupIds((prev) => {
        if (prev.has(activeGroup.id)) return prev
        return new Set([...prev, activeGroup.id])
      })
    }
  }, [filteredGroups, groupHasActiveChild])

  React.useEffect(() => {
    setShowCompanyWideTools(!projectId)
  }, [projectId])

  React.useEffect(() => {
    if (groupHasActiveChild(companyWideTools)) {
      setShowCompanyWideTools(true)
    }
  }, [companyWideTools, groupHasActiveChild, pathname])

  const teamChatCollapsedShortcuts = React.useMemo(
    () => [
      { id: "activity", label: "Activity", icon: Bell },
      { id: "chat", label: "Chat", icon: MessageSquare, active: true },
      { id: "teams", label: "Teams", icon: Users },
      { id: "calendar", label: "Calendar", icon: CalendarDays },
      { id: "calls", label: "Calls", icon: Phone },
    ],
    []
  )

  return (
    <Sidebar
      collapsible="icon"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(isMobile && "h-dvh min-h-dvh max-h-dvh bg-background text-foreground shadow-sm")}
      data-hover-expanded={isHovering && !isPinned ? "true" : undefined}
      {...props}
    >
      {/* ── Header ── */}
      <SidebarHeader
        className={cn(
          isMobile
            ? "bg-background px-5 pb-4 pt-5 text-foreground"
            : "px-0 pb-4 pt-5"
        )}
      >
        {isCollapsed ? (
          // Collapsed: logo icon only
          <div className="flex flex-col items-center gap-4">
            <Link href="/" className="flex items-center justify-center">
              <Image
                src="/alleato-favicon.png"
                alt="Alleato"
                width={28}
                height={28}
                className="rounded"
              />
            </Link>
          </div>
        ) : (
          <div className={cn("flex flex-col", isMobile ? "gap-5" : "gap-3")}>
            <div className={cn("flex h-7 items-center", isMobile ? "justify-between" : "pl-6 pr-2")}>
              <Link
                href="/"
                className="flex items-center rounded-md transition-opacity hover:opacity-80"
                onClick={() => {
                  if (isMobile) setOpenMobile(false)
                }}
              >
                <Image
                  src="/alleato-favicon.png"
                  alt="Alleato"
                  width={28}
                  height={28}
                  className="shrink-0 rounded"
                />
              </Link>
              {isMobile && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Close navigation"
                  onClick={() => setOpenMobile(false)}
                  className="h-8 w-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" strokeWidth={1.7} />
                </Button>
              )}
            </div>
            {isMobile && (
              <div className="flex items-center gap-3">
                <HeaderUserMenu
                  user={user}
                  projectId={projectId}
                  activeToolName=""
                  permissions={permissions}
                  isAppAdmin={isAppAdmin}
                  userType={userType}
                />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-foreground">
                    {mobileDisplayName}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {mobileProjectLabel}
                  </div>
                </div>
              </div>
            )}
            {/* Keep project selector only for mobile sidebar drawer */}
            <div className={cn(
              "md:hidden",
              "[&_.project-selector-trigger]:w-full",
              "[&_.project-selector-trigger]:border-input",
              "[&_.project-selector-trigger]:bg-background",
              "[&_.project-selector-trigger]:text-foreground",
              "[&_.project-selector-trigger]:hover:bg-muted",
              "[&_.project-selector-trigger_*]:text-muted-foreground"
            )}>
              <ProjectSelector
                projectId={nav.projectId}
                currentProject={nav.currentProject}
                projects={nav.projects}
                loadingProjects={nav.loadingProjects}
                onFetchProjects={nav.fetchProjects}
                onProjectSelect={(nextProjectId) => {
                  nav.handleProjectSelect(nextProjectId)
                  setOpenMobile(false)
                }}
                onViewAll={() => {
                  setOpenMobile(false)
                  router.push("/")
                }}
              />
              <div className="mt-1 truncate px-1 text-[11px] text-muted-foreground">
                {mobileProjectMeta}
              </div>
            </div>
          </div>
        )}
      </SidebarHeader>

      {/* ── Content ── */}
      <SidebarContent
        className={cn(
          isCollapsed
            ? "items-center pl-1 pr-0 py-2"
            : isMobile
              ? "bg-background px-5 py-1 text-foreground"
              : "px-3 py-1",
          "group-data-[hover-expanded=true]:overflow-y-auto"
        )}
      >
        {isCollapsed ? (
          // Collapsed: group icons with hover flyouts
          <div className="flex flex-col items-center gap-1">
            {isTeamChatPage ? (
              <>
                {teamChatCollapsedShortcuts.map((item) => {
                  const Icon = item.icon
                  return (
                    <Button
                      key={item.id}
                      type="button"
                      variant="ghost"
                      size="icon"
                      title={item.label}
                      className={cn(
                        "h-9 w-9 rounded-lg text-sidebar-foreground/65",
                        item.active
                          ? "text-sidebar-foreground"
                          : "hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </Button>
                  )
                })}
                <div className="my-1 h-px w-7 bg-sidebar-border/70" />
              </>
            ) : null}
            {filteredGroups.map((group) => (
              <CollapsedGroupIcon
                key={group.id}
                group={group}
                tools={group.tools}
                projectId={projectId}
                pathname={pathname}
                hasActiveChild={groupHasActiveChild(group.tools)}
              />
            ))}
            {visibleCompanyWideTools.length > 0 && (
              <>
                <div className="my-1 h-px w-7 bg-sidebar-border/70" />
                <CompanyWideToolsButton
                  tools={visibleCompanyWideTools}
                  projectId={projectId}
                  pathname={pathname}
                />
              </>
            )}
          </div>
        ) : (
          // Expanded: full navigation
          <div className="flex flex-col">
            {showCompanyWideTools ? (
              <ExpandedCompanyWideTools
                visibleTools={visibleCompanyWideTools}
                projectId={projectId}
                pathname={pathname}
                onBack={() => setShowCompanyWideTools(false)}
                projectSelector={
                  <div className="[&_.project-selector-trigger]:w-full">
                    <ProjectSelector
                      projectId={nav.projectId}
                      currentProject={nav.currentProject}
                      projects={nav.projects}
                      loadingProjects={nav.loadingProjects}
                      onFetchProjects={nav.fetchProjects}
                      onProjectSelect={nav.handleProjectSelect}
                      onViewAll={() => router.push("/")}
                    />
                  </div>
                }
              />
            ) : (
              <>
                {filteredGroups.map((group) => (
                  <ExpandedNavGroup
                    key={group.id}
                    group={group}
                    tools={group.tools}
                    projectId={projectId}
                    pathname={pathname}
                    isOpen={openGroupIds.has(group.id)}
                    onToggle={() => toggleGroup(group.id)}
                  />
                ))}
                {visibleCompanyWideTools.length > 0 && (
                  <div className={cn(
                    "mt-4 pt-3",
                    isMobile ? "border-t border-border" : "border-t border-sidebar-border/70"
                  )}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCompanyWideTools(true)}
                      className={cn(
                        "h-9 w-full justify-start gap-2 px-3 text-xs font-medium",
                        isMobile
                          ? "text-muted-foreground hover:bg-muted hover:text-foreground"
                          : "text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                      )}
                    >
                      <Building2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                      <span className="truncate">View Company Tools</span>
                      <ChevronRight className="ml-auto h-3.5 w-3.5" strokeWidth={1.6} />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </SidebarContent>

      {/* User row — mobile sidebar only */}
      {isMobile && (
        <SidebarFooter className="mt-auto border-t border-border bg-background px-5 py-4 text-foreground">
          <Link
            href="/settings/profile"
            onClick={() => setOpenMobile(false)}
            className="flex min-h-9 items-center gap-2 rounded-md px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Users className="h-4 w-4" strokeWidth={1.5} />
            <span className="truncate">{user?.email || mobileDisplayName}</span>
          </Link>
        </SidebarFooter>
      )}

      <SidebarRail />
    </Sidebar>
  )
}
