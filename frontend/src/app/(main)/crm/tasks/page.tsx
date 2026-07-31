"use client";

import { usePathname } from "next/navigation";

import { CRM_WORKSPACE_SPLIT_PAGE_CLASSNAME } from "@/features/crm/crm-workspace-layout";
import { buildCrmWorkspaceTabs } from "@/features/crm/crm-workspace-tabs";
import { TasksInbox } from "@/features/tasks/tasks-inbox";

export default function CrmTasksPage() {
  const pathname = usePathname();

  return (
    <TasksInbox
      context="crm"
      defaultScope="mine"
      defaultView="split"
      showTabs={false}
      showCreateAction={false}
      title="CRM actions"
      description="Calls, emails, meetings, and follow-ups tied to CRM relationships"
      workspaceTabs={buildCrmWorkspaceTabs(pathname)}
      workspaceSplitPageClassName={CRM_WORKSPACE_SPLIT_PAGE_CLASSNAME}
      workspaceTableLayout={{ maxWidth: "2xl" }}
    />
  );
}
