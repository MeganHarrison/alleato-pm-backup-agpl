import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { Building2, Mail, Phone } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./hover-card";

const meta: Meta = {
  title: "Overlays/HoverCard",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;

export const Default = {
  render: () => (
    <HoverCard>
      <HoverCardTrigger asChild>
        <span className="cursor-pointer text-sm font-medium text-primary underline underline-offset-2">
          Pacific Mechanical Inc.
        </span>
      </HoverCardTrigger>
      <HoverCardContent className="w-72">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-semibold">Pacific Mechanical Inc.</h4>
            <p className="text-xs text-muted-foreground">Licensed HVAC & Mechanical Contractor</p>
            <div className="flex flex-col gap-0.5 pt-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Phone className="h-3 w-3" />
                (415) 555-0182
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Mail className="h-3 w-3" />
                contracts@pacmech.com
              </div>
            </div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  ),
};

export const UserPreview = {
  render: () => (
    <HoverCard>
      <HoverCardTrigger asChild>
        <span className="cursor-pointer text-sm text-primary underline underline-offset-2">
          @sarah.chen
        </span>
      </HoverCardTrigger>
      <HoverCardContent>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            SC
          </div>
          <div>
            <p className="text-sm font-medium">Sarah Chen</p>
            <p className="text-xs text-muted-foreground">Project Manager</p>
            <p className="text-xs text-muted-foreground">12 active projects</p>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  ),
};
