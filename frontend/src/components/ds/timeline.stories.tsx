import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { CheckCircle2, DollarSign, FileText, MessageSquare, User } from "lucide-react";
import { Timeline, type TimelineItem } from "./timeline";

const meta: Meta = {
  title: "Data Display/Timeline",
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};

export default meta;

const activityLog: TimelineItem[] = [
  {
    id: "1",
    title: "Change order CO-042 approved",
    description: "CO-042 for $22,500 was approved by the owner. Contract value updated to $2,472,500.",
    timestamp: "2 hours ago",
    user: "Sarah Chen",
    variant: "success",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  {
    id: "2",
    title: "Invoice #INV-007 submitted",
    description: "Pay application for billing period Jan 1–31 submitted for $194,000.",
    timestamp: "Yesterday",
    user: "Marcus Harris",
    variant: "info",
    icon: <DollarSign className="h-3.5 w-3.5" />,
  },
  {
    id: "3",
    title: "RFI-014 response received",
    description: "Architect confirmed HVAC clearance requirements. Clearance increased to 36\".",
    timestamp: "Jan 20",
    user: "Architect of Record",
    variant: "default",
    icon: <MessageSquare className="h-3.5 w-3.5" />,
  },
  {
    id: "4",
    title: "Subcontract SC-043 executed",
    description: "West Coast Electrical subcontract executed for $312,000.",
    timestamp: "Jan 18",
    user: "Rachel Kim",
    variant: "success",
    icon: <FileText className="h-3.5 w-3.5" />,
  },
  {
    id: "5",
    title: "Project kickoff meeting",
    description: "Project team established. PM assigned, site access confirmed.",
    timestamp: "Jan 10",
    user: "Sarah Chen",
    variant: "default",
    icon: <User className="h-3.5 w-3.5" />,
  },
];

export const Default = {
  render: () => (
    <div className="max-w-lg">
      <Timeline items={activityLog} />
    </div>
  ),
};

export const Minimal = {
  name: "Minimal (dots only)",
  render: () => (
    <div className="max-w-lg">
      <Timeline
        items={[
          { id: "1", title: "Contract executed", timestamp: "Jan 15", variant: "success" },
          { id: "2", title: "Mobilization complete", timestamp: "Jan 20", variant: "success" },
          { id: "3", title: "Foundation poured", timestamp: "Feb 5", variant: "success" },
          { id: "4", title: "Steel erection — in progress", timestamp: "Mar 1", variant: "info" },
          { id: "5", title: "MEP rough-in", timestamp: "Apr 15", variant: "default" },
          { id: "6", title: "Substantial completion", timestamp: "Jun 30", variant: "default" },
        ]}
      />
    </div>
  ),
};

export const WithDescriptions = {
  name: "Status changes",
  render: () => (
    <div className="max-w-lg">
      <Timeline
        items={[
          { id: "1", title: "Status changed to Active", description: "Contract executed and NTP issued.", timestamp: "Jan 15", variant: "success" },
          { id: "2", title: "Budget variance flagged", description: "Concrete costs tracking 8% over budget. Review required.", timestamp: "Feb 12", variant: "warning" },
          { id: "3", title: "Change order submitted", description: "CO-040 submitted for owner review.", timestamp: "Feb 20", variant: "info" },
          { id: "4", title: "CO-040 rejected", description: "Owner rejected CO-040. Resubmission required with additional backup.", timestamp: "Feb 25", variant: "destructive" },
        ]}
      />
    </div>
  ),
};
