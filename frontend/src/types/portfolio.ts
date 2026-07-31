export interface Project {
  id: string;
  name: string;
  projectNumber: string;
  jobNumber?: string;
  projectTemplate?: string;
  client?: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  status: "Active" | "Inactive";
  currentPhase?: string;
  stage: string;
  workScope?: string;
  projectSector?: string;
  deliveryMethod?: string;
  squareFootage?: number | null;
  totalValue?: number | null;
  projectCode?: string;
  type: string;
  onedrive?: string;
  access?: string;
  erpSystem?: string | null;
  acumaticaProjectId?: string | null;
  projectType?: string;
  phase?: string;
  category?: string;
  country?: string;
  timezone?: string;
  region?: string;
  office?: string;
  completionDate?: string | null;
  erpSync?: boolean;
  testProject?: boolean;
  projectLogo?: string;
  projectPhoto?: string;
  active?: boolean;
  description?: string;
  summaryMetadata?: Record<string, unknown> | null;
  startDate?: string | null;
  estRevenue?: number | null;
  estProfit?: number | null;
  budget?: number | null;
  notes: string;
  isFlagged?: boolean;
}

export interface PortfolioView {
  id: string;
  name: string;
  isDefault?: boolean;
}

export interface PortfolioFilter {
  id: string;
  field: string;
  operator: "equals" | "contains" | "startsWith" | "endsWith";
  value: string;
}

export type PortfolioViewType = "list" | "thumbnails" | "overview" | "map";

export type StatusFilter = "all" | "active" | "inactive";

export interface PortfolioTableColumn {
  id: string;
  label: string;
  accessor: keyof Project;
  width?: number;
  sortable?: boolean;
}
