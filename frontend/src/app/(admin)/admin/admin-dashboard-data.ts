"use client";

import {
  BookOpen,
  Brain,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Inbox,
  LineChart,
  MapIcon,
  Users,
  type LucideIcon,
} from "lucide-react";

export type AdminMenuItem = {
  label: string;
  href?: string;
  route: string;
  description: string;
  icon: LucideIcon;
  badge?: string;
};

export type AdminMenuGroup = {
  title: string;
  description?: string;
  items: AdminMenuItem[];
};

export type AdminMenuSection = {
  title: string;
  description: string;
  groups: AdminMenuGroup[];
};

export type AdminTableRow = AdminMenuItem & {
  id: string;
  sectionTitle: string;
  groupTitle: string;
  availability: "link" | "project-scoped";
};

export const sections: AdminMenuSection[] = [
  {
    title: "AI Feedback and Learning",
    description:
      "Review queues and training surfaces that improve the assistant over time.",
    groups: [
      {
        title: "AI Feedback and Learning",
        items: [
          {
            label: "Task Training",
            href: "/task-training",
            route: "/task-training",
            description:
              "Review task feedback examples that train extraction behavior.",
            icon: ClipboardCheck,
          },
          {
            label: "Outlook Draft Feedback",
            href: "/outlook-draft-feedback",
            route: "/outlook-draft-feedback",
            description:
              "Review feedback on AI-generated Outlook email drafts.",
            icon: Inbox,
          },
        ],
      },
    ],
  },
  {
    title: "Access and Settings",
    description:
      "People, permissions, company configuration, route access, and admin verification.",
    groups: [
      {
        title: "Access and Settings",
        items: [
          {
            label: "User Management",
            href: "/user-management",
            route: "/user-management",
            description:
              "Invite users, grant access, and review company-wide permissions.",
            icon: Users,
          },
          {
            label: "Page Access",
            href: "/site-map",
            route: "/site-map",
            description: "View every page and set route access levels.",
            icon: MapIcon,
          },
          {
            label: "Company Info",
            href: "/admin/company-info",
            route: "/admin/company-info",
            description: "Company profile and administrative settings.",
            icon: Building2,
          },
          {
            label: "Admin Check",
            href: "/admin-check",
            route: "/admin-check",
            description: "Verify current user admin access and profile state.",
            icon: CheckCircle2,
          },
        ],
      },
    ],
  },
  {
    title: "AI Features",
    description:
      "The surfaces where people use the assistant, plus training and meeting templates.",
    groups: [
      {
        title: "AI Features",
        items: [
          {
            label: "AI",
            href: "/ai",
            route: "/ai",
            description: "AI Strategist chat and native action interface.",
            icon: Brain,
          },
          {
            label: "Executive",
            href: "/daily-briefs",
            route: "/executive",
            description: "Executive-facing operating view.",
            icon: LineChart,
          },
          {
            label: "Content Studio",
            href: "/content?area=training",
            route: "/content",
            description:
              "Create, review, and publish training, resources, SOPs, and documentation.",
            icon: BookOpen,
          },
          {
            label: "Training Docs",
            href: "/training-docs",
            route: "/training-docs",
            description: "Draft and publish reviewed workflow manuals.",
            icon: BookOpen,
          },
          {
            label: "Training Resources",
            href: "/training-data/training_resource",
            route: "/training-data/training_resource",
            description: "Manage the owner-only training resource catalog.",
            icon: BookOpen,
            badge: "Owner only",
          },
          {
            label: "Meeting Templates",
            href: "/meeting-templates",
            route: "/meeting-templates",
            description: "Reusable agenda templates for creating project meetings.",
            icon: CalendarClock,
          },
        ],
      },
    ],
  },
];

export const totalPages = sections.reduce(
  (total, section) =>
    total +
    section.groups.reduce(
      (sectionTotal, group) => sectionTotal + group.items.length,
      0,
    ),
  0,
);

export function flattenAdminMenuSections(
  items: AdminMenuSection[],
): AdminTableRow[] {
  return items.flatMap((section) =>
    section.groups.flatMap((group) =>
      group.items.map((item) => ({
        ...item,
        id: `${section.title}:${group.title}:${item.route}`,
        sectionTitle: section.title,
        groupTitle: group.title,
        availability: item.href ? "link" : "project-scoped",
      })),
    ),
  );
}
