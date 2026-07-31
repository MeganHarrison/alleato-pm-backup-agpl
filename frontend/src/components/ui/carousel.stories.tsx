import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "./carousel";
import { Card, CardContent } from "./card";

const meta: Meta = {
  title: "Data Display/Carousel",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;

const projects = [
  { name: "Vermillion Rise Warehouse", value: "$2,450,000", status: "Active" },
  { name: "Oakwood Office Complex", value: "$5,800,000", status: "Active" },
  { name: "Harbor View Residences", value: "$12,200,000", status: "In Progress" },
  { name: "Midtown Mixed-Use", value: "$8,400,000", status: "Planning" },
  { name: "Eastside Industrial Park", value: "$3,100,000", status: "Active" },
];

export const Default = {
  render: () => (
    <Carousel className="w-full max-w-sm">
      <CarouselContent>
        {projects.map((project, i) => (
          <CarouselItem key={i}>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">{project.status}</p>
                <p className="font-semibold">{project.name}</p>
                <p className="text-2xl font-light tabular-nums mt-2">{project.value}</p>
              </CardContent>
            </Card>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  ),
};

export const MultipleVisible = {
  name: "Multiple items visible",
  render: () => (
    <Carousel opts={{ align: "start" }} className="w-full max-w-2xl">
      <CarouselContent className="-ml-4">
        {projects.map((project, i) => (
          <CarouselItem key={i} className="pl-4 basis-1/2">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">{project.status}</p>
                <p className="text-sm font-medium mt-0.5 truncate">{project.name}</p>
                <p className="text-lg font-semibold tabular-nums mt-1">{project.value}</p>
              </CardContent>
            </Card>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  ),
};
