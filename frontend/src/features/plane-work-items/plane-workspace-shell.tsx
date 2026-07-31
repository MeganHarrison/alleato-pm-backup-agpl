/**
 * Adapted from Plane's workspace/project sidebar and global command header at
 * revision 39856932cd6b9bd17eab0920506d628190b47af2.
 *
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See LICENSES/NOTICE-PLANE.md and /source for corresponding source information.
 */

"use client";

import {
  Archive,
  Bell,
  ChevronDown,
  Circle,
  CircleHelp,
  Command,
  Ellipsis,
  FileText,
  FolderKanban,
  Hammer,
  Inbox,
  Layers3,
  LayoutGrid,
  Menu,
  MessageSquareText,
  PanelLeft,
  Search,
  SlidersHorizontal,
  StickyNote,
  type LucideIcon,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import {
  hasModulePermission,
  useProjectPermissions,
} from "@/hooks/use-project-permissions";
import type { PermissionModule } from "@/lib/navigation-config";
import { cn } from "@/lib/utils";
import { PlaneWorkspaceItemsNavigation } from "@/features/plane-workspace-shell/plane-workspace-items-navigation";
import { PlaneOverlayProvider } from "./plane-overlay";

export const PLANE_WORKSPACE_SURFACES = [
  "home",
  "projects",
  "your-work",
  "drafts",
  "work-items",
  "cycles",
  "modules",
  "views",
  "pages",
  "intake",
  "rfis",
  "submittals",
  "change-events",
  "commitments",
  "prime-contracts",
] as const;

export type PlaneWorkspaceSurface = (typeof PLANE_WORKSPACE_SURFACES)[number];

export const PLANE_HOST_LAYOUT_SELECTOR =
  '[data-slot="sidebar-container"], [data-slot="sidebar-inset"], nav[aria-label="Primary"]';

export type ProjectNavItem = {
  label: string;
  icon: LucideIcon;
  segment: PlaneWorkspaceSurface;
  permissionModule?: PermissionModule;
};

export const PLANE_PROJECT_NAV: readonly ProjectNavItem[] = [
  { label: "Work items", icon: Layers3, segment: "work-items" },
  { label: "Cycles", icon: Circle, segment: "cycles" },
  { label: "Modules", icon: LayoutGrid, segment: "modules" },
  { label: "Views", icon: Layers3, segment: "views" },
  { label: "Pages", icon: MessageSquareText, segment: "pages" },
  { label: "Intake", icon: Inbox, segment: "intake" },
  {
    label: "RFIs",
    icon: MessageSquareText,
    segment: "rfis",
    permissionModule: "rfis",
  },
  {
    label: "Submittals",
    icon: Inbox,
    segment: "submittals",
    permissionModule: "submittals",
  },
  {
    label: "Change Events",
    icon: Circle,
    segment: "change-events",
    permissionModule: "change_orders",
  },
  {
    label: "Commitments",
    icon: Hammer,
    segment: "commitments",
    permissionModule: "contracts",
  },
  {
    label: "Prime Contracts",
    icon: FileText,
    segment: "prime-contracts",
    permissionModule: "contracts",
  },
] as const;

const WORKSPACE_NAV = [
  {
    label: "Home",
    icon: FolderKanban,
    href: (projectId: string) => `/${projectId}/plane/home`,
  },
  {
    label: "Drafts",
    icon: MessageSquareText,
    href: (projectId: string) => `/${projectId}/plane/drafts`,
  },
  {
    label: "Your work",
    icon: UserRound,
    href: (projectId: string) => `/${projectId}/plane/your-work`,
  },
  {
    label: "Stickies",
    icon: StickyNote,
    disabledReason: "Stickies are not available in Alleato yet.",
  },
] as const;

export function getVisiblePlaneProjectNav(
  permissions: Record<string, string[]>,
  isLoading: boolean,
): readonly ProjectNavItem[] {
  return PLANE_PROJECT_NAV.filter(
    (item) =>
      !item.permissionModule ||
      (!isLoading &&
        hasModulePermission(permissions, item.permissionModule, "read")),
  );
}

export const PLANE_SIDEBAR_STORAGE_KEY = "plane-workspace-sidebar";
export const PLANE_SIDEBAR_DEFAULT_WIDTH = 250;
export const PLANE_SIDEBAR_MIN_WIDTH = 220;
export const PLANE_SIDEBAR_MAX_WIDTH = 360;
export const PLANE_SIDEBAR_COLLAPSED_WIDTH = 52;
export const PLANE_SIDEBAR_KEYBOARD_STEP = 16;

export type PlaneSidebarPreference = {
  width: number;
  collapsed: boolean;
};

export function clampPlaneSidebarWidth(width: number) {
  return Math.min(
    PLANE_SIDEBAR_MAX_WIDTH,
    Math.max(PLANE_SIDEBAR_MIN_WIDTH, Math.round(width)),
  );
}

export function parsePlaneSidebarPreference(
  value: string | null,
): PlaneSidebarPreference {
  if (!value) {
    return { width: PLANE_SIDEBAR_DEFAULT_WIDTH, collapsed: false };
  }

  try {
    const parsed = JSON.parse(value) as Partial<PlaneSidebarPreference>;
    return {
      width:
        typeof parsed.width === "number" && Number.isFinite(parsed.width)
          ? clampPlaneSidebarWidth(parsed.width)
          : PLANE_SIDEBAR_DEFAULT_WIDTH,
      collapsed: parsed.collapsed === true,
    };
  } catch {
    return { width: PLANE_SIDEBAR_DEFAULT_WIDTH, collapsed: false };
  }
}

export function getPlaneSidebarKeyboardWidth(
  currentWidth: number,
  key: string,
) {
  if (key === "Home") return PLANE_SIDEBAR_MIN_WIDTH;
  if (key === "End") return PLANE_SIDEBAR_MAX_WIDTH;
  if (key === "ArrowLeft") {
    return clampPlaneSidebarWidth(currentWidth - PLANE_SIDEBAR_KEYBOARD_STEP);
  }
  if (key === "ArrowRight") {
    return clampPlaneSidebarWidth(currentWidth + PLANE_SIDEBAR_KEYBOARD_STEP);
  }
  return null;
}

type PlaneWorkspaceShellProps = {
  projectId: string;
  projectName: string;
  activeSurface: PlaneWorkspaceSurface;
  children: ReactNode;
};

export type PlaneWorkspaceCommand = {
  label: string;
  href: string;
};

export function getPlaneWorkspaceCommands(
  projectId: string,
  query: string,
  projectNav: readonly ProjectNavItem[] = PLANE_PROJECT_NAV,
): PlaneWorkspaceCommand[] {
  const commands = [
    ...WORKSPACE_NAV.flatMap((item) =>
      "href" in item
        ? [
            {
              label: `Open ${item.label}`,
              href: item.href(projectId),
            },
          ]
        : [],
    ),
    {
      label: "Open Projects",
      href: `/${projectId}/plane/projects`,
    },
    ...projectNav.map((item) => ({
      label: `Open ${item.label}`,
      href: `/${projectId}/plane/${item.segment}`,
    })),
    { label: "View corresponding source", href: "/auth/source" },
  ];
  const normalized = query.trim().toLowerCase();
  return normalized
    ? commands.filter((command) =>
        command.label.toLowerCase().includes(normalized),
      )
    : commands;
}

function PlaneSidebar({
  projectId,
  projectName,
  activeSurface,
  open,
  desktopWidth,
  desktopCollapsed,
  projectNav,
  onClose,
  onDesktopWidthChange,
  onDesktopCollapsedChange,
}: {
  projectId: string;
  projectName: string;
  activeSurface: PlaneWorkspaceSurface;
  open: boolean;
  desktopWidth: number;
  desktopCollapsed: boolean;
  projectNav: readonly ProjectNavItem[];
  onClose: () => void;
  onDesktopWidthChange: (width: number) => void;
  onDesktopCollapsedChange: (collapsed: boolean) => void;
}) {
  function startResize(event: ReactPointerEvent<HTMLDivElement>) {
    if (desktopCollapsed || event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = desktopWidth;

    function resize(pointerEvent: PointerEvent) {
      onDesktopWidthChange(startWidth + pointerEvent.clientX - startX);
    }

    function finishResize() {
      window.removeEventListener("pointermove", resize);
      window.removeEventListener("pointerup", finishResize);
      window.removeEventListener("pointercancel", finishResize);
    }

    window.addEventListener("pointermove", resize);
    window.addEventListener("pointerup", finishResize, { once: true });
    window.addEventListener("pointercancel", finishResize, { once: true });
  }

  function resizeWithKeyboard(event: ReactKeyboardEvent<HTMLDivElement>) {
    const nextWidth = getPlaneSidebarKeyboardWidth(desktopWidth, event.key);
    if (nextWidth === null) return;
    event.preventDefault();
    onDesktopWidthChange(nextWidth);
  }

  const desktopSidebarWidth = desktopCollapsed
    ? PLANE_SIDEBAR_COLLAPSED_WIDTH
    : desktopWidth;
  const sidebarStyle = {
    "--plane-sidebar-width": `${desktopSidebarWidth}px`,
  } as CSSProperties;
  const labelClassName = cn(
    "min-w-0 truncate",
    desktopCollapsed && "md:hidden",
  );

  return (
    <>
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-[110] bg-black/20 md:hidden"
          aria-label="Close navigation"
          onClick={onClose}
        />
      ) : null}
      <aside
        aria-label="Plane workspace navigation"
        data-plane-sidebar-collapsed={desktopCollapsed ? "true" : "false"}
        style={sidebarStyle}
        className={cn(
          "fixed inset-y-0 left-0 z-[120] flex w-[250px] flex-col border-r border-[#e5e7eb] bg-white transition-[transform,width] md:static md:z-auto md:w-[var(--plane-sidebar-width)] md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div
          className={cn(
            "flex h-10 items-center justify-between border-b border-[#e5e7eb] px-3",
            desktopCollapsed && "md:justify-center md:px-2",
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid size-6 shrink-0 place-items-center rounded bg-[#075985] text-xs font-semibold text-white">
              A
            </span>
            <span
              className={cn(
                "truncate text-sm font-medium text-[#202124]",
                desktopCollapsed && "md:hidden",
              )}
            >
              Alleato
            </span>
            <ChevronDown
              className={cn(
                "size-3.5 text-[#7b8189]",
                desktopCollapsed && "md:hidden",
              )}
            />
          </div>
          <button
            type="button"
            className="md:hidden"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <X className="size-4" />
          </button>
        </div>

        <div
          className={cn(
            "flex h-11 items-center justify-between px-5",
            desktopCollapsed && "md:justify-center md:px-2",
          )}
        >
          <span
            className={cn(
              "text-base font-medium text-[#202124]",
              desktopCollapsed && "md:hidden",
            )}
          >
            Projects
          </span>
          <div className="flex items-center gap-3 text-[#59616b]">
            <SlidersHorizontal
              className={cn("size-4", desktopCollapsed && "md:hidden")}
              aria-hidden="true"
            />
            <PanelLeft className="size-4 md:hidden" aria-hidden="true" />
            <button
              type="button"
              onClick={() => onDesktopCollapsedChange(!desktopCollapsed)}
              className="hidden size-7 place-items-center rounded hover:bg-[#f2f3f4] md:grid"
              aria-label={
                desktopCollapsed
                  ? "Restore project sidebar"
                  : "Collapse project sidebar"
              }
              title={
                desktopCollapsed
                  ? "Restore project sidebar"
                  : "Collapse project sidebar"
              }
            >
              <PanelLeft className="size-4" />
            </button>
          </div>
        </div>

        <div className={cn("px-3 pb-2", desktopCollapsed && "md:px-2")}>
          <Link
            href={`/${projectId}/plane/work-items`}
            aria-label="New work item"
            title={desktopCollapsed ? "New work item" : undefined}
            className={cn(
              "flex h-8 w-full items-center gap-2 rounded border border-[#d9dce1] px-2.5 text-left text-xs font-medium text-[#3f454d] hover:bg-[#f5f6f7]",
              desktopCollapsed && "md:justify-center md:px-0",
            )}
          >
            <Layers3 className="size-4" />
            <span className={labelClassName}>New work item</span>
          </Link>
        </div>

        <nav
          className={cn(
            "min-h-0 flex-1 overflow-y-auto px-3 pb-4 text-[13px]",
            desktopCollapsed && "md:px-2",
          )}
        >
          <div className="space-y-0.5">
            {WORKSPACE_NAV.map((item) => {
              const Icon = item.icon;
              const itemClassName = cn(
                "flex h-8 w-full items-center gap-2 rounded px-2 text-[#4f5660]",
                desktopCollapsed && "md:justify-center md:px-0",
              );
              if ("href" in item) {
                return (
                  <Link
                    key={item.label}
                    href={item.href(projectId)}
                    aria-label={item.label}
                    title={desktopCollapsed ? item.label : undefined}
                    className={cn(itemClassName, "hover:bg-[#f2f3f4]")}
                  >
                    <Icon className="size-4 shrink-0 stroke-[1.6]" />
                    <span className={labelClassName}>{item.label}</span>
                  </Link>
                );
              }
              return (
                <button
                  key={item.label}
                  type="button"
                  disabled
                  aria-disabled="true"
                  aria-label={`${item.label} unavailable`}
                  title={item.disabledReason}
                  className={cn(
                    itemClassName,
                    "cursor-not-allowed text-[#9aa0a8]",
                  )}
                >
                  <Icon className="size-4 shrink-0 stroke-[1.6]" />
                  <span className={labelClassName}>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-5">
            <p
              className={cn(
                "px-2 pb-1.5 text-xs font-semibold text-[#818790]",
                desktopCollapsed && "md:hidden",
              )}
            >
              Workspace
            </p>
            <Link
              href={`/${projectId}/plane/projects`}
              aria-label="Projects"
              title={desktopCollapsed ? "Projects" : undefined}
              className={cn(
                "flex h-8 w-full items-center gap-2 rounded px-2 text-[#4f5660] hover:bg-[#f2f3f4]",
                desktopCollapsed && "md:justify-center md:px-0",
              )}
            >
              <FolderKanban className="size-4 shrink-0" />
              <span className={labelClassName}>Projects</span>
            </Link>
            <button
              type="button"
              disabled
              aria-disabled="true"
              aria-label="More unavailable"
              title="More workspace tools are not available in Alleato yet."
              className={cn(
                "flex h-8 w-full cursor-not-allowed items-center gap-2 rounded px-2 text-[#9aa0a8]",
                desktopCollapsed && "md:justify-center md:px-0",
              )}
            >
              <Ellipsis className="size-4 shrink-0" />
              <span className={labelClassName}>More</span>
            </button>
          </div>

          <PlaneWorkspaceItemsNavigation
            projectId={Number(projectId)}
            projectName={projectName}
            activeSurface={activeSurface}
            collapsed={desktopCollapsed}
            onNavigate={onClose}
          />

          <div className="mt-4">
            <div
              className={cn(
                "flex h-8 items-center justify-between px-2 text-xs font-semibold text-[#818790]",
                desktopCollapsed && "md:hidden",
              )}
            >
              <span>Projects</span>
              <ChevronDown className="size-3.5" />
            </div>
            <div
              className={cn(
                "flex h-8 items-center gap-2 px-2 text-[#4f5660]",
                desktopCollapsed && "md:justify-center md:px-0",
              )}
              title={desktopCollapsed ? projectName : undefined}
              aria-label={desktopCollapsed ? projectName : undefined}
            >
              <span className="grid size-4 place-items-center rounded bg-[#eef2ff] text-[10px] text-[#4338ca]">
                A
              </span>
              <span className={labelClassName}>{projectName}</span>
            </div>
            <div
              className={cn(
                "ml-4 border-l border-[#e5e7eb] pl-2",
                desktopCollapsed && "md:ml-0 md:border-l-0 md:pl-0",
              )}
            >
              {projectNav.map(({ label, icon: Icon, segment }) => {
                const active = segment === activeSurface;
                return (
                  <Link
                    key={label}
                    href={`/${projectId}/plane/${segment}`}
                    aria-current={active ? "page" : undefined}
                    aria-label={label}
                    title={desktopCollapsed ? label : undefined}
                    className={cn(
                      "flex h-8 w-full items-center gap-2 rounded px-2 text-left text-[12px] text-[#4f5660] hover:bg-[#f2f3f4]",
                      active && "bg-[#e7e7e7] font-medium text-[#292d32]",
                      desktopCollapsed && "md:justify-center md:px-0",
                    )}
                  >
                    <Icon className="size-4 shrink-0 stroke-[1.6]" />
                    <span className={labelClassName}>{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>

        <div
          className={cn(
            "border-t border-[#e5e7eb] p-3",
            desktopCollapsed && "md:p-2",
          )}
        >
          <Link
            href="/auth/source"
            aria-label="Source code"
            title={desktopCollapsed ? "Source code" : undefined}
            className={cn(
              "flex min-h-8 items-center justify-between rounded bg-[#f1f2f3] px-2 text-xs font-medium text-[#4f5660] hover:bg-[#e5e7eb]",
              desktopCollapsed && "md:justify-center md:px-0",
            )}
          >
            <span className={labelClassName}>Source code</span>
            <Archive className="size-3.5" />
          </Link>
        </div>
        {!desktopCollapsed ? (
          <div
            role="separator"
            aria-label="Resize project sidebar"
            aria-orientation="vertical"
            aria-valuemin={PLANE_SIDEBAR_MIN_WIDTH}
            aria-valuemax={PLANE_SIDEBAR_MAX_WIDTH}
            aria-valuenow={desktopWidth}
            tabIndex={0}
            onPointerDown={startResize}
            onKeyDown={resizeWithKeyboard}
            className="absolute inset-y-0 right-0 hidden w-1 translate-x-1/2 cursor-col-resize touch-none outline-none hover:bg-[#075985]/30 focus-visible:bg-[#075985]/40 md:block"
          />
        ) : null}
      </aside>
    </>
  );
}

export function PlaneWorkspaceShell({
  projectId,
  projectName,
  activeSurface,
  children,
}: PlaneWorkspaceShellProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarWidth, setDesktopSidebarWidth] = useState(
    PLANE_SIDEBAR_DEFAULT_WIDTH,
  );
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
  const [sidebarPreferenceLoaded, setSidebarPreferenceLoaded] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const commandInputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const previousFocusedElement = useRef<HTMLElement | null>(null);
  const numericProjectId = Number(projectId);
  const { permissions, isLoading: permissionsLoading } = useProjectPermissions(
    Number.isSafeInteger(numericProjectId) && numericProjectId > 0
      ? numericProjectId
      : null,
  );
  const projectNav = getVisiblePlaneProjectNav(permissions, permissionsLoading);
  const commands = getPlaneWorkspaceCommands(
    projectId,
    commandQuery,
    projectNav,
  );

  useEffect(() => {
    try {
      const preference = parsePlaneSidebarPreference(
        window.localStorage.getItem(PLANE_SIDEBAR_STORAGE_KEY),
      );
      setDesktopSidebarWidth(preference.width);
      setDesktopSidebarCollapsed(preference.collapsed);
    } catch (cause) {
      console.warn(
        "[PlaneWorkspaceShell] Sidebar preference could not be loaded.",
        cause,
      );
    } finally {
      setSidebarPreferenceLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!sidebarPreferenceLoaded) return;
    try {
      window.localStorage.setItem(
        PLANE_SIDEBAR_STORAGE_KEY,
        JSON.stringify({
          width: desktopSidebarWidth,
          collapsed: desktopSidebarCollapsed,
        } satisfies PlaneSidebarPreference),
      );
    } catch (cause) {
      console.warn(
        "[PlaneWorkspaceShell] Sidebar preference could not be saved.",
        cause,
      );
    }
  }, [desktopSidebarCollapsed, desktopSidebarWidth, sidebarPreferenceLoaded]);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    const hiddenHostElements = new Map<
      HTMLElement,
      {
        ariaHidden: string | null;
        inert: boolean;
        visibility: string;
      }
    >();

    previousFocusedElement.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const isolateReplacementSurface = () => {
      const hostElements = [
        ...document.querySelectorAll<HTMLElement>(PLANE_HOST_LAYOUT_SELECTOR),
        ...[...document.querySelectorAll<HTMLElement>("header")].filter(
          (element) => !element.closest("[data-plane-workspace-root]"),
        ),
      ];

      hostElements.forEach((element) => {
        if (hiddenHostElements.has(element)) return;
        hiddenHostElements.set(element, {
          ariaHidden: element.getAttribute("aria-hidden"),
          inert: element.inert,
          visibility: element.style.visibility,
        });
        element.inert = true;
        element.setAttribute("aria-hidden", "true");
        element.style.visibility = "hidden";
      });
    };

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    isolateReplacementSurface();
    setMounted(true);

    const observer = new MutationObserver(isolateReplacementSurface);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
      hiddenHostElements.forEach((previous, element) => {
        element.inert = previous.inert;
        element.style.visibility = previous.visibility;
        if (previous.ariaHidden === null) {
          element.removeAttribute("aria-hidden");
        } else {
          element.setAttribute("aria-hidden", previous.ariaHidden);
        }
      });
      if (previousFocusedElement.current?.isConnected) {
        previousFocusedElement.current.focus();
      }
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const previousFocus = previousFocusedElement.current;
    if (
      previousFocus &&
      (previousFocus.closest('[data-slot="sidebar-container"]') ||
        previousFocus.closest('[data-slot="sidebar-inset"]') ||
        previousFocus.closest('nav[aria-label="Primary"]'))
    ) {
      rootRef.current?.focus();
    }
  }, [mounted]);

  useEffect(() => {
    const handleCommandShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((current) => !current);
        window.setTimeout(() => commandInputRef.current?.focus(), 0);
      }
    };
    document.addEventListener("keydown", handleCommandShortcut);
    return () => document.removeEventListener("keydown", handleCommandShortcut);
  }, []);

  function runCommand(href: string) {
    setCommandOpen(false);
    setCommandQuery("");
    router.push(href);
  }

  const surface = (
    <div
      ref={rootRef}
      data-plane-workspace-root
      data-plane-workspace-surface={activeSurface}
      tabIndex={-1}
      className="fixed inset-0 z-[2147483000] isolate flex overflow-hidden bg-white font-sans text-[#202124] outline-none"
    >
      <PlaneOverlayProvider>
        <PlaneSidebar
          projectId={projectId}
          projectName={projectName}
          activeSurface={activeSurface}
          open={sidebarOpen}
          desktopWidth={desktopSidebarWidth}
          desktopCollapsed={desktopSidebarCollapsed}
          projectNav={projectNav}
          onClose={() => setSidebarOpen(false)}
          onDesktopWidthChange={(width) =>
            setDesktopSidebarWidth(clampPlaneSidebarWidth(width))
          }
          onDesktopCollapsedChange={setDesktopSidebarCollapsed}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="relative z-30 flex h-10 shrink-0 items-center border-b border-[#e5e7eb] bg-[#f7f8f9] px-3">
            <button
              type="button"
              className="mr-2 md:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="size-4" />
            </button>
            <div className="relative mx-auto w-full max-w-[365px]">
              <div
                className={cn(
                  "flex h-7 items-center gap-2 rounded-md border border-[#d9dce1] bg-white px-2.5 text-xs text-[#858b93]",
                  commandOpen && "border-[#9aa0a8]",
                )}
              >
                <Search className="size-3.5" />
                <input
                  ref={commandInputRef}
                  value={commandQuery}
                  onChange={(event) => {
                    setCommandQuery(event.target.value);
                    setCommandOpen(true);
                  }}
                  onFocus={() => setCommandOpen(true)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setCommandOpen(false);
                      setCommandQuery("");
                    }
                    if (event.key === "Enter" && commands[0]) {
                      event.preventDefault();
                      runCommand(commands[0].href);
                    }
                  }}
                  placeholder="Search commands..."
                  className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[#858b93]"
                  aria-label="Search commands"
                  aria-expanded={commandOpen}
                  aria-controls="plane-command-list"
                />
                {commandQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCommandQuery("");
                      commandInputRef.current?.focus();
                    }}
                    aria-label="Clear command search"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : (
                  <Command className="size-3.5" />
                )}
              </div>
              {commandOpen ? (
                <div
                  id="plane-command-list"
                  role="listbox"
                  className="absolute left-1/2 top-8 z-50 max-h-[60vh] w-[min(574px,calc(100vw-24px))] -translate-x-1/2 overflow-y-auto rounded-md border border-[#d9dce1] bg-white p-2 shadow-lg"
                >
                  {commands.length ? (
                    commands.map((command) => (
                      <button
                        key={command.href}
                        type="button"
                        role="option"
                        className="flex h-9 w-full items-center rounded px-3 text-left text-[13px] text-[#30343a] hover:bg-[#f1f2f3]"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => runCommand(command.href)}
                      >
                        {command.label}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-5 text-center text-xs text-[#7b8189]">
                      No commands found
                    </div>
                  )}
                  <div className="mt-2 border-t border-[#eceef0] px-3 pt-2 text-[10px] text-[#858b93]">
                    Enter to open · Esc to close · Ctrl K to toggle
                  </div>
                </div>
              ) : null}
            </div>
            <div className="ml-auto hidden items-center gap-4 text-[#69707a] sm:flex">
              <Bell className="size-4" />
              <CircleHelp className="size-4" />
              <span className="grid size-5 place-items-center rounded-full bg-[#087f5b] text-[10px] font-semibold text-white">
                M
              </span>
            </div>
          </header>

          <div
            data-plane-workspace-content
            className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white"
          >
            {children}
          </div>
        </div>
      </PlaneOverlayProvider>
    </div>
  );

  return mounted ? createPortal(surface, document.body) : surface;
}
