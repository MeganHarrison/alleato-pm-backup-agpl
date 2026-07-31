import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { Button } from "./button";
import { Badge } from "./badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";

const meta: Meta = {
  title: "Data Display/Card",
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};

export default meta;

export const Default = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Prime Contract</CardTitle>
        <CardDescription>Vermillion Rise Warehouse — Lump Sum</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">$2,450,000</p>
        <p className="text-sm text-muted-foreground mt-1">Contract value</p>
      </CardContent>
      <CardFooter>
        <Button size="sm" variant="outline">View Details</Button>
      </CardFooter>
    </Card>
  ),
};

export const WithAction = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Change Orders</CardTitle>
        <CardDescription>3 pending approval</CardDescription>
        <CardAction>
          <Badge variant="secondary">3</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Total pending value: <span className="font-semibold text-foreground">$84,500</span>
        </p>
      </CardContent>
    </Card>
  ),
};

export const Simple = {
  render: () => (
    <Card className="w-72">
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Use a simple card for lightweight containers with no header needed.
        </p>
      </CardContent>
    </Card>
  ),
};

export const Grid = {
  name: "Card grid",
  render: () => (
    <div className="grid grid-cols-3 gap-4 w-full max-w-3xl">
      {[
        { title: "Budget", value: "$5,200,000", desc: "Original contract" },
        { title: "Committed", value: "$3,840,000", desc: "74% of budget" },
        { title: "Remaining", value: "$1,360,000", desc: "Available budget" },
      ].map((item) => (
        <Card key={item.title}>
          <CardHeader>
            <CardDescription>{item.title}</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{item.value}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{item.desc}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  ),
};
