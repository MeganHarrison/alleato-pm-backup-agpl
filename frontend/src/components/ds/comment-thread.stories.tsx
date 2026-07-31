import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { CommentThread, type Comment } from "./comment-thread";

const meta: Meta = {
  title: "Data Display/CommentThread",
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};

export default meta;

const sampleComments: Comment[] = [
  {
    id: "1",
    author: "Sarah Chen",
    initials: "SC",
    body: "I've reviewed the HVAC clearance requirements. The architect confirmed 36\" minimum clearance is needed. We'll need to adjust the duct routing on Level 2.",
    timestamp: "Jan 20 at 2:14 PM",
  },
  {
    id: "2",
    author: "Marcus Harris",
    initials: "MH",
    body: "Got it. I'll coordinate with the MEP sub to update the drawings. Should have revised shop drawings by end of week.",
    timestamp: "Jan 20 at 3:45 PM",
  },
  {
    id: "3",
    author: "Rachel Kim",
    initials: "RK",
    body: "Owner approved the scope change. CO-042 is now at $22,500. Please proceed once the updated drawings are approved.",
    timestamp: "Jan 21 at 9:02 AM",
    isCurrentUser: true,
  },
];

export const Default = {
  render: () => (
    <div className="max-w-xl">
      <CommentThread
        comments={sampleComments}
        currentUserInitials="ME"
        onSubmit={async (body) => {
          await new Promise((r) => setTimeout(r, 500));
          console.log("Submitted:", body);
        }}
      />
    </div>
  ),
};

export const Empty = {
  render: () => (
    <div className="max-w-xl">
      <CommentThread
        comments={[]}
        currentUserInitials="ME"
        placeholder="Ask a question or add context..."
        onSubmit={async () => {}}
      />
    </div>
  ),
};

export const ReadOnly = {
  name: "Read only (no reply)",
  render: () => (
    <div className="max-w-xl">
      <CommentThread comments={sampleComments} />
    </div>
  ),
};
