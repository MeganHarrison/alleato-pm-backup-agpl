"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  IconLogout,
  IconMoon,
  IconSun,
  IconUserCircle,
} from "@tabler/icons-react";
import type { User } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getBestAvatarUrl } from "@/lib/gravatar";
import { logout } from "@/lib/supabase/logout";
import {
  adminSettingsTools,
  buildToolUrl,
  filterToolsByPermission,
} from "@/lib/navigation-config";

interface HeaderUserMenuProps {
  user: User | null;
  projectId: number | null;
  activeToolName: string;
  permissions: Record<string, string[]>;
  isAppAdmin: boolean;
  userType: string | null;
}

export function HeaderUserMenu({
  user,
  projectId,
  activeToolName,
  permissions,
  isAppAdmin,
  userType,
}: HeaderUserMenuProps) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const isDarkTheme = resolvedTheme === "dark";
  const themeActionLabel = isDarkTheme
    ? "Switch to light theme"
    : "Switch to dark theme";

  const settingsTools = useMemo(
    () =>
      adminSettingsTools.filter(
        (tool) => tool.name === "Settings" || tool.name === "Admin Panel"
      ),
    []
  );

  const visibleSettingsTools = useMemo(
    () =>
      filterToolsByPermission(
        settingsTools,
        projectId,
        permissions,
        isAppAdmin,
        userType
      ),
    [settingsTools, projectId, permissions, isAppAdmin, userType]
  );

  // Generate avatar data from user
  const userEmail = user?.email || "";
  const avatarSrc = getBestAvatarUrl(user?.user_metadata?.avatar_url, userEmail);
  const fullName =
    typeof user?.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : "";
  const emailPrefix =
    typeof user?.email === "string" && user.email.includes("@")
      ? user.email.split("@")[0]
      : "";
  const displayName = fullName || emailPrefix || "User";
  const fallbackInitials = fullName
    ? fullName
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : displayName.slice(0, 2).toUpperCase();

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Logged out successfully");
      router.push("/auth/login");
      router.refresh();
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to log out");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* eslint-disable-next-line design-system/no-design-violations -- avatar trigger for dropdown menu */}
        <button
          type="button"
          className="flex items-center rounded-full p-0.5 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 focus:ring-offset-background"
          aria-label="Open user menu"
        >
          <Avatar className="h-7 w-7 sm:h-8 sm:w-8 rounded-full">
            <AvatarImage
              src={avatarSrc}
              alt="User avatar"
              className="rounded-full"
            />
            <AvatarFallback className="rounded-full bg-primary/10 font-medium text-xs sm:text-sm">
              {fallbackInitials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4} className="w-48">
        <DropdownMenuLabel className="text-sm font-semibold">
          {displayName}
        </DropdownMenuLabel>
        {user?.email && (
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            {user.email}
          </DropdownMenuLabel>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings/profile" className="cursor-pointer">
            <IconUserCircle className="mr-2 h-4 w-4" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => setTheme(isDarkTheme ? "light" : "dark")}
        >
          {isDarkTheme ? (
            <IconSun className="mr-2 h-4 w-4" />
          ) : (
            <IconMoon className="mr-2 h-4 w-4" />
          )}
          {themeActionLabel}
        </DropdownMenuItem>
        {visibleSettingsTools.length > 0 && (
          <>
            <DropdownMenuSeparator />
            {settingsTools.map((tool) => {
              const href = buildToolUrl(tool.path, projectId, tool.requiresProject);
              const isActive = tool.name === activeToolName;
              const isDisabled =
                (tool.requiresProject && !projectId) ||
                !visibleSettingsTools.includes(tool);
              const Icon = tool.icon;

              return (
                <DropdownMenuItem
                  key={tool.name}
                  asChild
                  disabled={isDisabled}
                  className={cn(isActive && "bg-accent")}
                >
                  <Link
                    href={href}
                    className={cn(
                      "flex cursor-pointer items-center gap-2",
                      isDisabled && "pointer-events-none cursor-not-allowed opacity-50"
                    )}
                  >
                    {Icon && <Icon className="h-4 w-4" />}
                    <span>{tool.name}</span>
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-destructive focus:text-destructive"
          onClick={handleLogout}
        >
          <IconLogout className="mr-2 h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
