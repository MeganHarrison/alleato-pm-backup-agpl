import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { Label } from "@/components/ui/label";
import { TagInput } from "./tag-input";

const meta: Meta = {
  title: "Inputs/TagInput",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;

function DefaultDemo() {
  const [tags, setTags] = React.useState<string[]>([]);
  return (
    <div className="w-80">
      <TagInput value={tags} onChange={setTags} placeholder="Add label..." />
    </div>
  );
}

function WithValuesDemo() {
  const [tags, setTags] = React.useState(["Urgent", "Owner-Driven", "Budget Impact"]);
  return (
    <div className="w-80">
      <TagInput value={tags} onChange={setTags} placeholder="Add tag..." />
    </div>
  );
}

function WithLabelDemo() {
  const [tags, setTags] = React.useState(["03-000 Concrete", "05-000 Metals"]);
  return (
    <div className="w-80 space-y-1.5">
      <Label>Applicable Cost Codes</Label>
      <TagInput
        value={tags}
        onChange={setTags}
        placeholder="Add cost code..."
      />
      <p className="text-xs text-muted-foreground">Press Enter or comma to add. Backspace to remove last.</p>
    </div>
  );
}

function MaxTagsDemo() {
  const [tags, setTags] = React.useState(["High Priority", "Electrical"]);
  return (
    <div className="w-80 space-y-1.5">
      <Label>Labels (max 3)</Label>
      <TagInput
        value={tags}
        onChange={setTags}
        placeholder="Add label..."
        maxTags={3}
      />
    </div>
  );
}

export const Default = { render: () => <DefaultDemo /> };
export const WithValues = { render: () => <WithValuesDemo /> };
export const WithLabel = { render: () => <WithLabelDemo /> };
export const MaxTags = { render: () => <MaxTagsDemo /> };

export const Disabled = {
  render: () => (
    <div className="w-80">
      <TagInput
        value={["Active", "Owner Contract", "GMP"]}
        onChange={() => {}}
        disabled
      />
    </div>
  ),
};
