import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

const meta: Meta = {
  title: "Navigation/Tabs",
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};

export default meta;

export const Default = {
  render: () => (
    <Tabs defaultValue="overview" className="w-full max-w-lg">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="schedule">Schedule of Values</TabsTrigger>
        <TabsTrigger value="invoices">Invoices</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="mt-4">
        <p className="text-sm text-muted-foreground">Contract overview and key details.</p>
      </TabsContent>
      <TabsContent value="schedule" className="mt-4">
        <p className="text-sm text-muted-foreground">Schedule of values and billing items.</p>
      </TabsContent>
      <TabsContent value="invoices" className="mt-4">
        <p className="text-sm text-muted-foreground">Pay applications and invoice history.</p>
      </TabsContent>
    </Tabs>
  ),
};

export const ComfortableSpacing = {
  render: () => (
    <Tabs defaultValue="general" className="w-full max-w-4xl">
      <TabsList spacing="comfortable" className="justify-start">
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="responses">Responses</TabsTrigger>
        <TabsTrigger value="workflow-templates">Workflow Templates</TabsTrigger>
        <TabsTrigger value="imports">Imports</TabsTrigger>
      </TabsList>
      <TabsContent value="general" className="mt-4">
        <p className="text-sm text-muted-foreground">General settings content.</p>
      </TabsContent>
      <TabsContent value="responses" className="mt-4">
        <p className="text-sm text-muted-foreground">Responses settings content.</p>
      </TabsContent>
      <TabsContent value="workflow-templates" className="mt-4">
        <p className="text-sm text-muted-foreground">Workflow template settings content.</p>
      </TabsContent>
      <TabsContent value="imports" className="mt-4">
        <p className="text-sm text-muted-foreground">Import settings content.</p>
      </TabsContent>
    </Tabs>
  ),
};
