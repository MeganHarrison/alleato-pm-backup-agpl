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
  FolderKanban,
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
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

export const PLANE_WORKSPACE_SURFACES = [
  "work-items",
  "cycles",
  "modules",
  "views",
  "pages",
  "intake",
] as const;

export type PlaneWorkspaceSurface = (typeof PLANE_WORKSPACE_SURFACES)[number];

export const PLANE_HOST_LAYOUT_SELECTOR =
  '[data-slot="sidebar-container"], [data-slot="sidebar-inset"], nav[aria-label="Primary"]';

type ProjectNavItem = {
  label: string;
  icon: LucideIcon;
  segment: PlaneWorkspaceSurface;
};

const PROJECT_NAV: readonly ProjectNavItem[] = [
  { label: "Work items", icon: Layers3, segment: "work-items" },
  { label: "Cycles", icon: Circle, segment: "cycles" },
  { label: "Modules", icon: LayoutGrid, segment: "modules" },
  { label: "Views", icon: Layers3, segment: "views" },
  { label: "Pages", icon: MessageSquareText, segment: "pages" },
  { label: "Intake", icon: Inbox, segment: "intake" },
] as const;

const WORKSPACE_NAV = [
  { label: "Home", icon: FolderKanban },
  { label: "Drafts", icon: MessageSquareText },
  { label: "Your work", icon: UserRound },
  { label: "Stickies", icon: StickyNote },
] as const;

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
): PlaneWorkspaceCommand[] {
  const commands = [
    ...PROJECT_NAV.map((item) => ({
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
  onClose,
}: {
  projectId: string;
  projectName: string;
  activeSurface: PlaneWorkspaceSurface;
  open: boolean;
  onClose: () => void;
}) {
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
        className={cn(
          "fixed inset-y-0 left-0 z-[120] flex w-[250px] flex-col border-r border-[#e5e7eb] bg-white transition-transform md:static md:z-auto md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-10 items-center justify-between border-b border-[#e5e7eb] px-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid size-6 shrink-0 place-items-center rounded bg-[#075985] text-xs font-semibold text-white">
              A
            </span>
            <span className="truncate text-sm font-medium text-[#202124]">
              Alleato
            </span>
            <ChevronDown className="size-3.5 text-[#7b8189]" />
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

        <div className="flex h-11 items-center justify-between px-5">
          <span className="text-base font-medium text-[#202124]">Projects</span>
          <div className="flex items-center gap-3 text-[#59616b]">
            <SlidersHorizontal className="size-4" />
            <PanelLeft className="size-4" />
          </div>
        </div>

        <div className="px-3 pb-2">
          <Link
            href={`/${projectId}/plane/work-items`}
            className="flex h-8 w-full items-center gap-2 rounded border border-[#d9dce1] px-2.5 text-left text-xs font-medium text-[#3f454d] hover:bg-[#f5f6f7]"
          >
            <Layers3 className="size-4" />
            New work item
          </Link>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 text-[13px]">
          <div className="space-y-0.5">
            {WORKSPACE_NAV.map(({ label, icon: Icon }) => (
              <button
                key={label}
                type="button"
                className="flex h-8 w-full items-center gap-2 rounded px-2 text-[#4f5660] hover:bg-[#f2f3f4]"
              >
                <Icon className="size-4 stroke-[1.6]" />
                {label}
              </button>
            ))}
          </div>

          <div className="mt-5">
            <p className="px-2 pb-1.5 text-xs font-semibold text-[#818790]">
              Workspace
            </p>
            <Link
              href="/projects"
              className="flex h-8 w-full items-center gap-2 rounded px-2 text-[#4f5660] hover:bg-[#f2f3f4]"
            >
              <FolderKanban className="size-4" />
              Projects
            </Link>
            <button
              type="button"
              className="flex h-8 w-full items-center gap-2 rounded px-2 text-[#4f5660] hover:bg-[#f2f3f4]"
            >
              <Ellipsis className="size-4" />
              More
            </button>
          </div>

          <p className="mt-5 px-2 pb-1.5 text-xs font-semibold text-[#818790]">
            Favorites
          </p>

          <div className="mt-4">
            <div className="flex h-8 items-center justify-between px-2 text-xs font-semibold text-[#818790]">
              <span>Projects</span>
              <ChevronDown className="size-3.5" />
            </div>
            <div className="flex h-8 items-center gap-2 px-2 text-[#4f5660]">
              <span className="grid size-4 place-items-center rounded bg-[#eef2ff] text-[10px] text-[#4338ca]">
                A
              </span>
              <span className="truncate">{projectName}</span>
            </div>
            <div className="ml-4 border-l border-[#e5e7eb] pl-2">
              {PROJECT_NAV.map(({ label, icon: Icon, segment }) => {
                const active = segment === activeSurface;
                return (
                  <Link
                    key={label}
                    href={`/${projectId}/plane/${segment}`}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-8 w-full items-center gap-2 rounded px-2 text-left text-[12px] text-[#4f5660] hover:bg-[#f2f3f4]",
                      active && "bg-[#e7e7e7] font-medium text-[#292d32]",
                    )}
                  >
                    <Icon className="size-4 stroke-[1.6]" />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>

        <div className="border-t border-[#e5e7eb] p-3">
          <Link
            href="/auth/source"
            className="flex min-h-8 items-center justify-between rounded bg-[#f1f2f3] px-2 text-xs font-medium text-[#4f5660] hover:bg-[#e5e7eb]"
          >
            Source code
            <Archive className="size-3.5" />
          </Link>
        </div>
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
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const commandInputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const previousFocusedElement = useRef<HTMLElement | null>(null);
  const commands = getPlaneWorkspaceCommands(projectId, commandQuery);

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
        ...document.querySelectorAll<HTMLElement>(
          PLANE_HOST_LAYOUT_SELECTOR,
        ),
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
      className="fixed inset-0 z-[2147483000] flex overflow-hidden bg-white font-sans text-[#202124] outline-none"
    >
      <PlaneSidebar
        projectId={projectId}
        projectName={projectName}
        activeSurface={activeSurface}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
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
    </div>
  );

  return mounted ? createPortal(surface, document.body) : surface;
}
