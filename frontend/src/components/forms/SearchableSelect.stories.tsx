import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { SearchableSelect } from "./SearchableSelect";

const meta: Meta<typeof SearchableSelect> = {
  title: "Inputs/SearchableSelect",
  component: SearchableSelect,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof SearchableSelect>;

const COMPANIES = [
  { value: "1", label: "Turner Construction" },
  { value: "2", label: "Skanska USA" },
  { value: "3", label: "Hensel Phelps" },
  { value: "4", label: "Clark Construction Group" },
  { value: "5", label: "Mortenson Construction" },
  { value: "6", label: "McCarthy Building Companies" },
];

const COST_CODES = [
  { value: "01-000", label: "01-000 General Requirements", description: "Division 01" },
  { value: "03-300", label: "03-300 Cast-In-Place Concrete", description: "Division 03" },
  { value: "05-120", label: "05-120 Structural Steel", description: "Division 05" },
  { value: "09-260", label: "09-260 Gypsum Board Assemblies", description: "Division 09" },
  { value: "15-400", label: "15-400 Plumbing Fixtures", description: "Division 15" },
];

function Controlled(props: Omit<React.ComponentProps<typeof SearchableSelect>, "onValueChange">) {
  const [value, setValue] = React.useState<string | undefined>(props.value);
  return <div className="w-72"><SearchableSelect {...props} value={value} onValueChange={setValue} /></div>;
}

export const Default: Story = {
  render: () => (
    <Controlled
      label="Company"
      options={COMPANIES}
      placeholder="Select company..."
    />
  ),
};

export const WithSelection: Story = {
  render: () => (
    <Controlled
      label="Company"
      options={COMPANIES}
      value="3"
      placeholder="Select company..."
    />
  ),
};

export const WithDescriptions: Story = {
  render: () => (
    <Controlled
      label="Cost Code"
      options={COST_CODES}
      placeholder="Select cost code..."
      searchPlaceholder="Search cost codes..."
    />
  ),
};

export const WithCreateNew: Story = {
  render: () => (
    <Controlled
      label="Vendor"
      options={COMPANIES}
      placeholder="Select vendor..."
      createNewLabel="+ Add new vendor"
      onCreateNew={() => alert("Open create vendor dialog")}
    />
  ),
};

export const Disabled: Story = {
  render: () => (
    <Controlled
      label="Company"
      options={COMPANIES}
      value="1"
      placeholder="Select company..."
      disabled
    />
  ),
};

export const EmptyOptions: Story = {
  render: () => (
    <Controlled
      label="Project"
      options={[]}
      placeholder="Select project..."
      emptyMessage="No projects found."
    />
  ),
};
