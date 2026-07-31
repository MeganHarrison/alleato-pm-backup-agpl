import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "./chart";

const meta: Meta = {
  title: "Data Display/Chart",
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};

export default meta;

const monthlySpend = [
  { month: "Jan", budget: 420000, actual: 385000 },
  { month: "Feb", budget: 420000, actual: 410000 },
  { month: "Mar", budget: 450000, actual: 462000 },
  { month: "Apr", budget: 480000, actual: 478000 },
  { month: "May", budget: 500000, actual: 521000 },
  { month: "Jun", budget: 500000, actual: 495000 },
];

const barConfig: ChartConfig = {
  budget: { label: "Budget", color: "hsl(var(--primary) / 0.3)" },
  actual: { label: "Actual", color: "hsl(var(--primary))" },
};

export const BarChartExample = {
  name: "Bar Chart — Budget vs Actual",
  render: () => (
    <ChartContainer config={barConfig} className="h-64 w-full max-w-2xl">
      <BarChart data={monthlySpend}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) =>
                new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value))
              }
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="budget" fill="var(--color-budget)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="actual" fill="var(--color-actual)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  ),
};

const cumulativeData = [
  { month: "Jan", committed: 1200000, billed: 890000 },
  { month: "Feb", committed: 1850000, billed: 1340000 },
  { month: "Mar", committed: 2400000, billed: 1890000 },
  { month: "Apr", committed: 2980000, billed: 2380000 },
  { month: "May", committed: 3420000, billed: 2870000 },
  { month: "Jun", committed: 3840000, billed: 3210000 },
];

const lineConfig: ChartConfig = {
  committed: { label: "Committed", color: "hsl(var(--primary))" },
  billed: { label: "Billed to Date", color: "hsl(var(--primary) / 0.5)" },
};

export const LineChartExample = {
  name: "Line Chart — Committed vs Billed",
  render: () => (
    <ChartContainer config={lineConfig} className="h-64 w-full max-w-2xl">
      <LineChart data={cumulativeData}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Line dataKey="committed" stroke="var(--color-committed)" strokeWidth={2} dot={false} />
        <Line dataKey="billed" stroke="var(--color-billed)" strokeWidth={2} dot={false} strokeDasharray="4 4" />
      </LineChart>
    </ChartContainer>
  ),
};

const forecastData = [
  { month: "Jan", spend: 385000 },
  { month: "Feb", spend: 410000 },
  { month: "Mar", spend: 462000 },
  { month: "Apr", spend: 478000 },
  { month: "May", spend: 521000 },
  { month: "Jun", spend: 495000 },
  { month: "Jul", spend: 510000, forecast: true },
  { month: "Aug", spend: 540000, forecast: true },
];

const areaConfig: ChartConfig = {
  spend: { label: "Monthly Spend", color: "hsl(var(--primary))" },
};

export const AreaChartExample = {
  name: "Area Chart — Monthly Spend",
  render: () => (
    <ChartContainer config={areaConfig} className="h-64 w-full max-w-2xl">
      <AreaChart data={forecastData}>
        <defs>
          <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-spend)" stopOpacity={0.2} />
            <stop offset="95%" stopColor="var(--color-spend)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area
          dataKey="spend"
          stroke="var(--color-spend)"
          strokeWidth={2}
          fill="url(#spendGradient)"
        />
      </AreaChart>
    </ChartContainer>
  ),
};
