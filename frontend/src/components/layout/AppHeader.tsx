"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconSearch,
  IconBell,
  IconUser,
  IconChevronDown,
} from "@tabler/icons-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { logout } from "@/lib/supabase/logout";

interface AppHeaderProps {
  className?: string;
  currentProject?: {
    id: string;
    name: string;
  };
  projects?: Array<{
    id: string;
    name: string;
  }>;
  user?: {
    name?: string;
    email?: string;
    avatar?: string;
  };
  onProjectChange?: (projectId: string) => void;
}

export function AppHeader({
  className,
  currentProject,
  projects = [],
  user,
  onProjectChange,
}: AppHeaderProps) {
  const pathname = usePathname()!;

  return (
    <header
      className={cn(
        "flex h-16 items-center justify-between border-b bg-background px-6",
        className,
      )}
    >
      <div className="flex items-center gap-6">
        {/* Project Selector */}
        <Select value={currentProject?.id} onValueChange={onProjectChange}>
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="Select a project">
              {currentProject?.name || "Select a project"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Global Search */}
        <div className="relative">
          <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search..."
            className="w-[300px] pl-10"
            aria-label="Global search"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <IconBell />
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-destructive" />
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name || "User"}
                  className="h-8 w-8 rounded-full"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                  <IconUser />
                </div>
              )}
              <span className="hidden md:inline">
                {user?.name || user?.email || "User"}
              </span>
              <IconChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile">Profile</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings">Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/help">Help & Support</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onSelect={async (event) => {
                event.preventDefault();
                try {
                  await logout();
                  // Use window.location for hard navigation to clear all state
                  window.location.href = "/auth/login";
                } catch (error) {
                  console.error("Logout error:", error);
                  // Still redirect even on error
                  window.location.href = "/auth/login";
                }
              }}
            >
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
