"use client";

import * as React from "react";
import { DEFAULT_HEADER_STATE, useHeader } from "@/components/layout/header-context";

interface AppShellProps {
  children: React.ReactNode;
  companyName?: string;
  projectName?: string;
  currentTool?: string;
  userInitials?: string;
}

export function AppShell({
  children,
  companyName,
  projectName,
  currentTool,
  userInitials,
}: AppShellProps) {
  const { setHeader } = useHeader();

  React.useEffect(() => {
    setHeader({
      companyName: companyName ?? DEFAULT_HEADER_STATE.companyName,
      projectName: projectName ?? DEFAULT_HEADER_STATE.projectName,
      currentTool: currentTool ?? DEFAULT_HEADER_STATE.currentTool,
      userInitials: userInitials ?? DEFAULT_HEADER_STATE.userInitials,
    });

    return () => setHeader(DEFAULT_HEADER_STATE);
  }, [companyName, currentTool, projectName, setHeader, userInitials]);

  return <div className="flex-1 flex flex-col bg-background">{children}</div>;
}
