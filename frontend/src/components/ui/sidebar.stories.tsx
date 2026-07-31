import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import {
  BarChart3,
  Building2,
  ClipboardList,
  DollarSign,
  FileText,
  FolderOpen,
  Home,
  Settings,
  Users,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "./sidebar";

const meta: Meta = {
  title: "Navigation/Sidebar",
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
};

export default meta;

type SidebarItem = {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  active?: boolean;
};

const navItems: SidebarItem[] = [
  { icon: Home, label: "Overview", active: true },
  { icon: DollarSign, label: "Budget" },
  { icon: ClipboardList, label: "Commitments" },
  { icon: FileText, label: "Change Orders" },
  { icon: BarChart3, label: "Invoicing" },
];

const toolItems: SidebarItem[] = [
  { icon: FolderOpen, label: "Documents" },
  { icon: Building2, label: "Drawings" },
  { icon: Users, label: "Directory" },
];

export const Default = {
  render: () => (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <Sidebar>
          <SidebarHeader>
            <div className="px-2 py-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Vermillion Rise
              </p>
              <p className="text-sm font-medium truncate">Warehouse Project</p>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Financial</SidebarGroupLabel>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton isActive={item.active}>
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>Project Tools</SidebarGroupLabel>
              <SidebarMenu>
                {toolItems.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton>
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <Settings />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <main className="flex-1 p-6">
          <SidebarTrigger className="mb-4" />
          <p className="text-sm text-muted-foreground">Main content area</p>
        </main>
      </div>
    </SidebarProvider>
  ),
};

export const Collapsed = {
  render: () => (
    <SidebarProvider defaultOpen={false}>
      <div className="flex h-screen w-full">
        <Sidebar collapsible="icon">
          <SidebarContent>
            <SidebarGroup>
              <SidebarMenu>
                {[...navItems, ...toolItems].map((item) => (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton isActive={item.active} tooltip={item.label}>
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <main className="flex-1 p-6">
          <SidebarTrigger className="mb-4" />
          <p className="text-sm text-muted-foreground">Sidebar is collapsed — hover icons to see tooltips</p>
        </main>
      </div>
    </SidebarProvider>
  ),
};
