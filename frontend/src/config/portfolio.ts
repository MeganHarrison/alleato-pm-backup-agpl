import { PortfolioView } from "@/types/portfolio";

export const portfolioViews: PortfolioView[] = [
  {
    id: "projects",
    name: "Company",
    isDefault: true,
  },
  {
    id: "executive-dashboard",
    name: "Executive Dashboard",
  },
  {
    id: "health-dashboard",
    name: "Health Dashboard",
  },
  {
    id: "my-open-items",
    name: "My Open Items",
  },
];

export const financialViews: PortfolioView[] = [
  {
    id: "budget-summary",
    name: "Budget Summary",
  },
  {
    id: "cost-summary",
    name: "Cost Summary",
  },
  {
    id: "commitment-summary",
    name: "Commitment Summary",
  },
];

export const projectStages: string[] = [
  "Bid",
  "Preconstruction",
  "In Progress",
  "Warranty",
  "Complete",
];

export const projectTypes: string[] = [
  "Commercial",
  "Industrial",
  "Retail",
  "Residential",
  "Healthcare",
  "Education",
];
