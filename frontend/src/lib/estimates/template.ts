import type { EstimateLineItem } from "@/lib/schemas/estimates";

type UnitBasis = "Weeks" | "Months" | "LS" | "EA" | "LF" | "SF";

export interface GCTemplateItem {
  cost_code: string;
  description: string;
  default_rate: number;
  unit_basis: UnitBasis;
  fixed_qty?: number;
}

export interface QTOTemplateLineItem {
  description: string;
  default_qty: number | null;
  unit: string;
  material_unit_price: number;
  subcontract_unit_price: number;
  comment_type: EstimateLineItem["comment_type"];
}

export interface QTOTemplateDivision {
  code: string;
  name: string;
  items: QTOTemplateLineItem[];
}

export const GC_TEMPLATE: GCTemplateItem[] = [
  { cost_code: "3128", description: "Project Manager", default_rate: 3796, unit_basis: "Weeks" },
  { cost_code: "3144", description: "Superintendent", default_rate: 3375, unit_basis: "Weeks" },
  { cost_code: "3129", description: "PM Fuel", default_rate: 100, unit_basis: "Weeks" },
  { cost_code: "3130", description: "PM Truck", default_rate: 550, unit_basis: "Months" },
  { cost_code: "3245", description: "Office Supplies", default_rate: 150, unit_basis: "Months" },
  { cost_code: "3247", description: "Printing & Copying", default_rate: 750, unit_basis: "LS", fixed_qty: 3 },
  { cost_code: "3329", description: "Leed Documentation", default_rate: 0, unit_basis: "LS", fixed_qty: 0 },
  { cost_code: "4126", description: "Permit Requirements", default_rate: 15000, unit_basis: "LS", fixed_qty: 1 },
  { cost_code: "4523", description: "Testing & Inspections", default_rate: 3500, unit_basis: "LS", fixed_qty: 1 },
  { cost_code: "5113", description: "Temporary Electric", default_rate: 1000, unit_basis: "Months" },
  { cost_code: "5216", description: "First Aid/Safety Supplies", default_rate: 75, unit_basis: "Months" },
  { cost_code: "5213", description: "Field Office", default_rate: 650, unit_basis: "Months" },
  { cost_code: "5217", description: "Safety Inspections", default_rate: 150, unit_basis: "Months" },
  { cost_code: "5219", description: "Temp Toilets", default_rate: 350, unit_basis: "Months" },
  { cost_code: "6113", description: "Software Licensing", default_rate: 1500, unit_basis: "LS", fixed_qty: 1 },
  { cost_code: "6500", description: "Travel & Entertainment", default_rate: 12000, unit_basis: "Months" },
  { cost_code: "7333", description: "Misc Small Tools", default_rate: 500, unit_basis: "Months" },
  { cost_code: "7336", description: "Equipment Rental", default_rate: 750, unit_basis: "Months" },
  { cost_code: "7413", description: "Progress Cleaning", default_rate: 650, unit_basis: "Months" },
  { cost_code: "7419", description: "Dumpsters", default_rate: 750, unit_basis: "EA", fixed_qty: 6 },
  { cost_code: "—", description: "Temp Fencing", default_rate: 10, unit_basis: "LF", fixed_qty: 0 },
  { cost_code: "7423", description: "Final Cleaning", default_rate: 0.5, unit_basis: "SF", fixed_qty: 5000 },
];

export const QTO_TEMPLATE: QTOTemplateDivision[] = [
  {
    code: "00", name: "Design", items: [
      { description: "Alleato Coordination", default_qty: 1, unit: "LOT", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Boundary Survey", default_qty: 1, unit: "LOT", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Topographic Survey", default_qty: 1, unit: "LOT", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Geotechnical Survey", default_qty: 1, unit: "LOT", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Civil Design", default_qty: 1, unit: "LOT", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Architectural Design", default_qty: 1, unit: "LOT", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Structural", default_qty: 1, unit: "LOT", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "MEP Design", default_qty: 1, unit: "LOT", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
    ],
  },
  {
    code: "01", name: "General Conditions", items: [
      { description: "Application Fees", default_qty: 1, unit: "LOT", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "State Release", default_qty: 1, unit: "LOT", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Local Permits", default_qty: 1, unit: "LOT", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Local Planning", default_qty: 1, unit: "LOT", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
    ],
  },
  { code: "02", name: "Existing Conditions", items: [] },
  {
    code: "03", name: "Concrete", items: [
      { description: "Transformer Pads", default_qty: null, unit: "EA", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Generator Pads", default_qty: null, unit: "EA", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Bollard Concrete", default_qty: null, unit: "EA", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Rebar", default_qty: null, unit: "LOT", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Concrete Subcontractor", default_qty: 1, unit: "LOT", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
    ],
  },
  { code: "04", name: "Masonry", items: [] },
  {
    code: "05", name: "Metals", items: [
      { description: "Reinforce Joists", default_qty: null, unit: "LOT", material_unit_price: 0, subcontract_unit_price: 0, comment_type: "included_in" },
      { description: "Internal Contingency", default_qty: 1, unit: "LOT", material_unit_price: 0, subcontract_unit_price: 0, comment_type: "internal" },
      { description: "Design", default_qty: 1, unit: "LOT", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
    ],
  },
  {
    code: "06", name: "Wood, Plastics & Composites", items: [
      { description: "Hardi Board", default_qty: null, unit: "SF", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Exterior Plywood / Blocking", default_qty: null, unit: "SF", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Framing Labor", default_qty: null, unit: "SF", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Interior Framing Material", default_qty: null, unit: "SF", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "FRP", default_qty: null, unit: "SF", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Acoustical Panels", default_qty: null, unit: "SF", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Misc Blocking / Backing", default_qty: 1, unit: "LOT", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
    ],
  },
  {
    code: "07", name: "Thermal & Moisture Protection", items: [
      { description: "Insulation", default_qty: null, unit: "SF", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Roofing", default_qty: null, unit: "SF", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
    ],
  },
  {
    code: "08", name: "Openings", items: [
      { description: "Storefront / Curtain Wall", default_qty: null, unit: "SF", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "HM Frames", default_qty: null, unit: "EA", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Wood Doors", default_qty: null, unit: "EA", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Door Hardware", default_qty: null, unit: "EA", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Overhead Doors", default_qty: null, unit: "EA", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Access Doors", default_qty: null, unit: "EA", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
    ],
  },
  {
    code: "09", name: "Finishes", items: [
      { description: "Drywall", default_qty: null, unit: "SF", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "ACT Ceiling", default_qty: null, unit: "SF", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Flooring — VCT", default_qty: null, unit: "SF", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Flooring — Carpet", default_qty: null, unit: "SF", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Flooring — Epoxy", default_qty: null, unit: "SF", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Painting", default_qty: null, unit: "SF", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Tile", default_qty: null, unit: "SF", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
    ],
  },
  { code: "10", name: "Specialties", items: [] },
  {
    code: "11", name: "Equipment", items: [
      { description: "By Owner", default_qty: 1, unit: "LOT", material_unit_price: 0, subcontract_unit_price: 0, comment_type: "excluded" },
    ],
  },
  { code: "12", name: "Furnishings", items: [] },
  {
    code: "21", name: "Fire Suppression", items: [
      { description: "Fire Sprinkler System", default_qty: 1, unit: "LOT", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
    ],
  },
  {
    code: "22", name: "Plumbing", items: [
      { description: "Plumbing Rough-In", default_qty: null, unit: "LOT", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Plumbing Fixtures", default_qty: null, unit: "EA", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Water Heater", default_qty: null, unit: "EA", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Gas Piping", default_qty: 1, unit: "LOT", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
    ],
  },
  {
    code: "23", name: "HVAC", items: [
      { description: "RTU Units", default_qty: null, unit: "EA", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Ductwork", default_qty: 1, unit: "LOT", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Controls", default_qty: 1, unit: "LOT", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Exhaust Fans", default_qty: null, unit: "EA", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "HVAC Subcontractor", default_qty: 1, unit: "LOT", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
    ],
  },
  {
    code: "26", name: "Electrical", items: [
      { description: "Electrical Rough-In", default_qty: 1, unit: "LOT", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Switchgear / Panels", default_qty: null, unit: "EA", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Lighting", default_qty: 1, unit: "LOT", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Generator", default_qty: null, unit: "EA", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
    ],
  },
  {
    code: "27", name: "Communications", items: [
      { description: "Low Voltage / Data", default_qty: 1, unit: "LOT", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
    ],
  },
  {
    code: "28", name: "Electronic Safety & Security", items: [
      { description: "Fire Alarm System", default_qty: 1, unit: "LOT", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
    ],
  },
  {
    code: "31", name: "Earthwork", items: [
      { description: "Mobilization", default_qty: 1, unit: "LOT", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Clearing & Grubbing", default_qty: null, unit: "AC", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Mass Grading", default_qty: null, unit: "CY", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Fine Grading", default_qty: null, unit: "SF", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Import / Export Fill", default_qty: null, unit: "CY", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Erosion Control", default_qty: 1, unit: "LOT", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Dewatering", default_qty: 1, unit: "LOT", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Rock Excavation", default_qty: null, unit: "CY", material_unit_price: 0, subcontract_unit_price: 0, comment_type: "plug_number" },
    ],
  },
  {
    code: "32", name: "Exterior Improvements", items: [
      { description: "Asphalt Paving", default_qty: null, unit: "SF", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Concrete Curb & Gutter", default_qty: null, unit: "LF", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Concrete Sidewalks", default_qty: null, unit: "SF", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Striping", default_qty: 1, unit: "LOT", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Signage", default_qty: 1, unit: "LOT", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Landscaping", default_qty: 1, unit: "LOT", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Irrigation", default_qty: 1, unit: "LOT", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Fencing", default_qty: null, unit: "LF", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
    ],
  },
  {
    code: "33", name: "Utilities / Storm / Drain", items: [
      { description: "Storm Drainage", default_qty: 1, unit: "LOT", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
      { description: "Utility Connections", default_qty: 1, unit: "LOT", material_unit_price: 0, subcontract_unit_price: 0, comment_type: null },
    ],
  },
];

export const DIVISION_NAME_BY_CODE = Object.fromEntries(
  QTO_TEMPLATE.map((division) => [division.code, division.name])
) as Record<string, string>;

export function getDefaultGCQuantity(item: GCTemplateItem, durationWeeks: number): number {
  if (item.fixed_qty !== undefined) return item.fixed_qty;
  if (item.unit_basis === "Weeks") return durationWeeks;
  if (item.unit_basis === "Months") return Math.ceil(durationWeeks / 4);
  return 1;
}

export function buildInitialEstimateTemplateLineItems(
  durationWeeks: number
): Array<Omit<EstimateLineItem, "line_item_id">> {
  const gcRows = GC_TEMPLATE.map((item, index) => ({
    line_number: index + 1,
    division_code: "01",
    description: item.description,
    quantity: getDefaultGCQuantity(item, durationWeeks),
    unit: item.unit_basis,
    material_unit_price: 0,
    material_cost: 0,
    labor_crew_size: null,
    labor_hours: null,
    labor_man_hours: 0,
    labor_rate: null,
    labor_cost: 0,
    equipment_duration: null,
    equipment_unit: null,
    equipment_rate: null,
    equipment_cost: 0,
    subcontract_unit_price: item.default_rate,
    subcontract_cost: 0,
    total_cost: 0,
    comments: null,
    comment_type: null,
    vendor_name: null,
    gc_cost_code: item.cost_code,
    sort_order: index,
  }));

  let sortOrder = gcRows.length;
  const qtoRows = QTO_TEMPLATE.flatMap((division) =>
    division.items.map((item, index) => ({
      line_number: index + 1,
      division_code: division.code,
      description: item.description,
      quantity: item.default_qty,
      unit: item.unit,
      material_unit_price: item.material_unit_price,
      material_cost: 0,
      labor_crew_size: null,
      labor_hours: null,
      labor_man_hours: 0,
      labor_rate: null,
      labor_cost: 0,
      equipment_duration: null,
      equipment_unit: null,
      equipment_rate: null,
      equipment_cost: 0,
      subcontract_unit_price: item.subcontract_unit_price,
      subcontract_cost: 0,
      total_cost: 0,
      comments: null,
      comment_type: item.comment_type,
      vendor_name: null,
      gc_cost_code: null,
      sort_order: sortOrder++,
    }))
  );

  return [...gcRows, ...qtoRows];
}


// =============================================================================
// Estimate V2 starter templates
// =============================================================================

export const ESTIMATE_V2_GC_TEMPLATE: Array<{
  cost_code: string;
  description: string;
  cost_type: string;
  qty_basis: string;
  rate: number;
  allocation: number;
}> = [
  { cost_code: "01-3120", description: "Vice President", cost_type: "Revenue", qty_basis: "weeks", rate: 7031, allocation: 0.15 },
  { cost_code: "01-3126", description: "Pre-construction", cost_type: "Revenue", qty_basis: "weeks", rate: 3796, allocation: 0.20 },
  { cost_code: "01-3127", description: "Sr. Project Manager", cost_type: "Labor", qty_basis: "weeks", rate: 4218, allocation: 0.25 },
  { cost_code: "01-3128", description: "Project Manager", cost_type: "Labor", qty_basis: "weeks", rate: 3515, allocation: 1.00 },
  { cost_code: "01-3129", description: "Asst. Project Manager", cost_type: "Labor", qty_basis: "weeks", rate: 2812, allocation: 0 },
  { cost_code: "01-3130", description: "Project Engineer", cost_type: "Labor", qty_basis: "weeks", rate: 2531, allocation: 0 },
  { cost_code: "01-3131", description: "Field Engineer", cost_type: "Labor", qty_basis: "weeks", rate: 2250, allocation: 0 },
  { cost_code: "01-3132", description: "Intern", cost_type: "Labor", qty_basis: "weeks", rate: 1350, allocation: 0 },
  { cost_code: "01-3142", description: "General Superintendent", cost_type: "Labor", qty_basis: "weeks", rate: 6328, allocation: 0 },
  { cost_code: "01-3143", description: "Sr. Superintendent", cost_type: "Labor", qty_basis: "weeks", rate: 4218, allocation: 0 },
  { cost_code: "01-3144", description: "Superintendent", cost_type: "Labor", qty_basis: "weeks", rate: 3515, allocation: 1.00 },
  { cost_code: "01-3145", description: "Asst. Superintendent", cost_type: "Labor", qty_basis: "weeks", rate: 2812, allocation: 0 },
  { cost_code: "01-3223", description: "Construction Layout", cost_type: "Expense", qty_basis: "months", rate: 150, allocation: 1 },
  { cost_code: "01-3236", description: "Aerial & Periodic Drones", cost_type: "Expense", qty_basis: "months", rate: 350, allocation: 0.25 },
  { cost_code: "01-3238", description: "Jobsite Security", cost_type: "Expense", qty_basis: "ls", rate: 500, allocation: 1 },
  { cost_code: "01-3245", description: "Office Supplies", cost_type: "Expense", qty_basis: "months", rate: 500, allocation: 1 },
  { cost_code: "01-3247", description: "Printing & Copying", cost_type: "Expense", qty_basis: "months", rate: 500, allocation: 1 },
  { cost_code: "01-3249", description: "Postage & Courier", cost_type: "Expense", qty_basis: "months", rate: 750, allocation: 1 },
  { cost_code: "01-3329", description: "LEED Documentation", cost_type: "Expense", qty_basis: "months", rate: 650, allocation: 0 },
  { cost_code: "01-3514", description: "Legal Fees", cost_type: "Expense", qty_basis: "ls", rate: 0, allocation: 0 },
  { cost_code: "01-4123", description: "Fees", cost_type: "Expense", qty_basis: "sf", rate: 1.25, allocation: 0 },
  { cost_code: "01-4124", description: "Sanitary Fees", cost_type: "Expense", qty_basis: "sf", rate: 1.25, allocation: 0 },
  { cost_code: "01-4126", description: "Permit Requirements", cost_type: "Expense", qty_basis: "ls", rate: 0, allocation: 1 },
  { cost_code: "01-4523", description: "Testing and Inspections", cost_type: "Expense", qty_basis: "ls", rate: 0, allocation: 0 },
  { cost_code: "01-4533", description: "Municipality Inspections", cost_type: "Expense", qty_basis: "ea", rate: 0, allocation: 0 },
  { cost_code: "01-4613", description: "Winter Conditions", cost_type: "Expense", qty_basis: "ls", rate: 0, allocation: 0 },
  { cost_code: "01-5113", description: "Temporary Electric", cost_type: "Expense", qty_basis: "months", rate: 500, allocation: 1 },
  { cost_code: "01-5116", description: "Temporary Fire Protection", cost_type: "Expense", qty_basis: "months", rate: 0, allocation: 0 },
  { cost_code: "01-5119", description: "Temporary Fuel", cost_type: "Expense", qty_basis: "weeks", rate: 150, allocation: 1 },
  { cost_code: "01-5123", description: "Temporary HVAC", cost_type: "Expense", qty_basis: "months", rate: 0, allocation: 0 },
  { cost_code: "01-5126", description: "Temporary Lighting", cost_type: "Expense", qty_basis: "ls", rate: 5000, allocation: 1 },
  { cost_code: "01-5129", description: "Temporary Gas", cost_type: "Expense", qty_basis: "months", rate: 0, allocation: 0 },
  { cost_code: "01-5133", description: "Temporary Internet/Telecomm", cost_type: "Expense", qty_basis: "months", rate: 250, allocation: 1 },
  { cost_code: "01-5136", description: "Temporary Water", cost_type: "Expense", qty_basis: "months", rate: 0, allocation: 0 },
  { cost_code: "01-5213", description: "Field Offices", cost_type: "Expense", qty_basis: "months", rate: 1200, allocation: 0.15 },
  { cost_code: "01-5214", description: "Temporary Storage", cost_type: "Expense", qty_basis: "months", rate: 1000, allocation: 0 },
  { cost_code: "01-5216", description: "First Aid / Safety Supplies", cost_type: "Expense", qty_basis: "months", rate: 350, allocation: 1 },
  { cost_code: "01-5217", description: "Safety Inspections", cost_type: "Expense", qty_basis: "months", rate: 450, allocation: 0 },
  { cost_code: "01-5219", description: "Temporary Toilets", cost_type: "Expense", qty_basis: "months", rate: 350, allocation: 1 },
  { cost_code: "01-5419", description: "Temporary Cranes", cost_type: "Expense", qty_basis: "ls", rate: 0, allocation: 0 },
  { cost_code: "01-5423", description: "Temp Scaffolding & Platforms", cost_type: "Expense", qty_basis: "ls", rate: 0, allocation: 0 },
  { cost_code: "01-5513", description: "Temporary Access Roads", cost_type: "Expense", qty_basis: "ls", rate: 0, allocation: 0 },
  { cost_code: "01-5519", description: "Temporary Parking Areas", cost_type: "Expense", qty_basis: "ls", rate: 0, allocation: 0 },
  { cost_code: "01-5623", description: "Temporary Barricades", cost_type: "Expense", qty_basis: "ls", rate: 500, allocation: 1 },
  { cost_code: "01-5626", description: "Temporary Fencing", cost_type: "Expense", qty_basis: "lf", rate: 0, allocation: 0 },
  { cost_code: "01-5639", description: "Temp Tree & Plant Protection", cost_type: "Expense", qty_basis: "ls", rate: 0, allocation: 0 },
  { cost_code: "01-5713", description: "Temp Erosion and Sediment", cost_type: "Expense", qty_basis: "ls", rate: 0, allocation: 0 },
  { cost_code: "01-5813", description: "Temporary Project Signage", cost_type: "Expense", qty_basis: "ls", rate: 0, allocation: 0 },
  { cost_code: "01-6113", description: "Software Licensing", cost_type: "Expense", qty_basis: "months", rate: 1000, allocation: 0.25 },
  { cost_code: "01-6115", description: "Performance and Payment Bonds", cost_type: "Expense", qty_basis: "ls", rate: 0, allocation: 0 },
  { cost_code: "01-6119", description: "Maintenance Bond", cost_type: "Expense", qty_basis: "ls", rate: 0, allocation: 0 },
  { cost_code: "01-6500", description: "Travel", cost_type: "Expense", qty_basis: "months", rate: 4000, allocation: 0 },
  { cost_code: "01-6502", description: "Truck Allowance", cost_type: "Expense", qty_basis: "months", rate: 750, allocation: 0 },
  { cost_code: "01-6503", description: "Truck Fuel", cost_type: "Expense", qty_basis: "months", rate: 300, allocation: 0 },
  { cost_code: "01-6504", description: "Recruitment", cost_type: "Expense", qty_basis: "ls", rate: 0, allocation: 0 },
  { cost_code: "01-6505", description: "Marketing", cost_type: "Expense", qty_basis: "months", rate: 250, allocation: 0 },
  { cost_code: "01-7123", description: "Construction Surveying", cost_type: "Expense", qty_basis: "ls", rate: 0, allocation: 0 },
  { cost_code: "01-7329", description: "Cutting and Patching", cost_type: "Expense", qty_basis: "ls", rate: 0, allocation: 0 },
  { cost_code: "01-7333", description: "Misc Small Tools", cost_type: "Expense", qty_basis: "months", rate: 1000, allocation: 0 },
  { cost_code: "01-7336", description: "Equipment Rental", cost_type: "Expense", qty_basis: "months", rate: 500, allocation: 0 },
  { cost_code: "01-7413", description: "Progress Cleaning", cost_type: "Expense", qty_basis: "months", rate: 1000, allocation: 1 },
  { cost_code: "01-7416", description: "Site Maintenance", cost_type: "Expense", qty_basis: "months", rate: 0, allocation: 0 },
  { cost_code: "01-7419", description: "Dumpsters", cost_type: "Expense", qty_basis: "ea", rate: 750, allocation: 1 },
  { cost_code: "01-7423", description: "Final Cleaning", cost_type: "Subcontract", qty_basis: "sf", rate: 0.75, allocation: 0 },
  { cost_code: "01-7425", description: "General Labor", cost_type: "Expense", qty_basis: "months", rate: 1000, allocation: 0 },
  { cost_code: "01-7433", description: "Window Washing", cost_type: "Subcontract", qty_basis: "sf", rate: 0, allocation: 0 },
  { cost_code: "01-7823", description: "Operation and Maintenance Data", cost_type: "Expense", qty_basis: "ls", rate: 0, allocation: 0 },
  { cost_code: "01-7836", description: "Warranties", cost_type: "Expense", qty_basis: "ls", rate: 0, allocation: 0 },
  { cost_code: "01-7841", description: "Project Final Photos", cost_type: "Expense", qty_basis: "ls", rate: 500, allocation: 0 },
  { cost_code: "01-8113", description: "Sust Design Reqmts/LEED Reqmts", cost_type: "Expense", qty_basis: "ls", rate: 0, allocation: 0 },
  { cost_code: "01-9119", description: "Facility Commissioning", cost_type: "Expense", qty_basis: "ls", rate: 0, allocation: 0 },
];

export const ESTIMATE_V2_DETAIL_DIVISIONS: Array<{
  division_code: string;
  division_header: string;
  rows: Array<{ cost_code: string; cost_type: string; name: string }>;
}> = [
  { division_code: "02", division_header: "02-0000 Existing Conditions", rows: [
    { cost_code: "02-0150", cost_type: "Expense",     name: "Maint. & Site Remediation" },
    { cost_code: "02-2113", cost_type: "Expense",     name: "Site Surveys" },
    { cost_code: "02-2219", cost_type: "Expense",     name: "Traffic Assessment" },
    { cost_code: "02-2400", cost_type: "Expense",     name: "Environmental Assessments" },
    { cost_code: "02-2600", cost_type: "Expense",     name: "Hazard Material Assessments" },
    { cost_code: "02-4113", cost_type: "Subcontract", name: "Selective Site Demolition" },
    { cost_code: "02-4116", cost_type: "Subcontract", name: "Structure Demolition" },
    { cost_code: "02-4119", cost_type: "Subcontract", name: "Selective Interior Demolition" },
    { cost_code: "02-6500", cost_type: "Subcontract", name: "UG Storage Tank Removal" },
    { cost_code: "02-8213", cost_type: "Subcontract", name: "Asbestos Abatement" },
  ]},
  { division_code: "03", division_header: "03-0000 Concrete", rows: [
    { cost_code: "03-3500", cost_type: "", name: "Concrete Finishing" },
  ]},
  { division_code: "04", division_header: "04-0000 Masonry", rows: [
    { cost_code: "04-2000", cost_type: "", name: "Unit Masonry-Brick" },
    { cost_code: "04-2200", cost_type: "", name: "Concrete Unit Masonry-Block" },
    { cost_code: "04-4300", cost_type: "", name: "Stone Masonry" },
    { cost_code: "04-7200", cost_type: "", name: "Cast Stone Masonry" },
    { cost_code: "04-7300", cost_type: "", name: "Manufactured Stone Masonry" },
  ]},
  { division_code: "05", division_header: "05-0000 Metals", rows: [
    { cost_code: "05-1100", cost_type: "", name: "Miscellaneous Metals" },
    { cost_code: "05-1200", cost_type: "", name: "Structural Steel Framing" },
    { cost_code: "05-2000", cost_type: "", name: "Metal Joists" },
    { cost_code: "05-3000", cost_type: "", name: "Metal Decking" },
    { cost_code: "05-4100", cost_type: "", name: "Structural Metal Stud Framing" },
    { cost_code: "05-5100", cost_type: "", name: "Metal Stairs" },
    { cost_code: "05-5133", cost_type: "", name: "Metal Ladders" },
    { cost_code: "05-5813", cost_type: "", name: "Column Covers" },
    { cost_code: "05-5823", cost_type: "", name: "Formed Metal Guards" },
    { cost_code: "05-5900", cost_type: "", name: "Metal Specialties" },
    { cost_code: "05-7000", cost_type: "", name: "Decorative Metal" },
  ]},
  { division_code: "06", division_header: "06-0000 Woods Plastics and Composites", rows: [
    { cost_code: "06-1000", cost_type: "", name: "Rough Carpentry" },
    { cost_code: "06-1100", cost_type: "", name: "Wood Framing" },
  ]},
  { division_code: "07", division_header: "07-0000 Thermal & Moisture Protection", rows: [
    { cost_code: "07-2100", cost_type: "", name: "Thermal Insulation" },
    { cost_code: "07-2500", cost_type: "", name: "Weather Barriers" },
  ]},
  { division_code: "08", division_header: "08-0000 Openings", rows: [
    { cost_code: "08-1113", cost_type: "", name: "Hollow Metal Door and Frames" },
    { cost_code: "08-3600", cost_type: "", name: "Overhead Doors" },
    { cost_code: "08-7100", cost_type: "", name: "Door Hardware" },
    { cost_code: "08-7900", cost_type: "", name: "Hardware Accessories" },
  ]},
  { division_code: "09", division_header: "09-0000 Finishes", rows: [
    { cost_code: "09-2116", cost_type: "", name: "Gypsum Board Assemblies" },
    { cost_code: "09-5100", cost_type: "", name: "Acoustical Ceilings" },
    { cost_code: "09-6013", cost_type: "", name: "Floor Prep" },
    { cost_code: "09-6200", cost_type: "", name: "Specialty Flooring" },
    { cost_code: "09-6513", cost_type: "", name: "Resilient Base" },
    { cost_code: "09-9123", cost_type: "", name: "Interior Painting" },
  ]},
  { division_code: "10", division_header: "10-0000 Specialties", rows: [
    { cost_code: "10-1116", cost_type: "", name: "Markerboards" },
    { cost_code: "10-1139", cost_type: "", name: "Visual Display Rails" },
    { cost_code: "10-1300", cost_type: "", name: "Directories" },
    { cost_code: "10-1400", cost_type: "", name: "Signage" },
    { cost_code: "10-2113", cost_type: "", name: "Toilet Compartments" },
    { cost_code: "10-2123", cost_type: "", name: "Cubicle Curtains and Track" },
    { cost_code: "10-2233", cost_type: "", name: "Accordion Folding Partitions" },
    { cost_code: "10-2613", cost_type: "", name: "Corner Guards" },
    { cost_code: "10-2616", cost_type: "", name: "Bumper Guards" },
    { cost_code: "10-2623", cost_type: "", name: "Fiberglass Reinf Prot Covering" },
    { cost_code: "10-2813", cost_type: "", name: "Toilet Accessories" },
    { cost_code: "10-4000", cost_type: "", name: "Safety Specialties" },
    { cost_code: "10-4116", cost_type: "", name: "Knox Box" },
    { cost_code: "10-4416", cost_type: "", name: "Fire Extinguishers" },
    { cost_code: "10-5100", cost_type: "", name: "Lockers" },
    { cost_code: "10-5523", cost_type: "", name: "Mail Boxes" },
    { cost_code: "10-7313", cost_type: "", name: "Awnings" },
    { cost_code: "10-7316", cost_type: "", name: "Canopies" },
    { cost_code: "10-7500", cost_type: "", name: "Flagpoles" },
    { cost_code: "10-8200", cost_type: "", name: "Grilles and Screens" },
  ]},
  { division_code: "11", division_header: "11-0000 Equipment", rows: [
    { cost_code: "11-1200", cost_type: "", name: "Parking Control Equipment" },
    { cost_code: "11-1300", cost_type: "", name: "Loading Dock Equipment" },
    { cost_code: "11-4000", cost_type: "", name: "Foodservice Equipment" },
    { cost_code: "11-6000", cost_type: "", name: "Entertainment and Recreation Equipment" },
    { cost_code: "11-7000", cost_type: "", name: "Healthcare Equipment" },
  ]},
  { division_code: "12", division_header: "12-0000 Furnishings", rows: [
    { cost_code: "12-2100", cost_type: "", name: "Window Blinds" },
    { cost_code: "12-3000", cost_type: "", name: "Casework" },
    { cost_code: "12-3500", cost_type: "", name: "Specialty Casework" },
    { cost_code: "12-4813", cost_type: "", name: "Entrance Floor Mats and Frames" },
    { cost_code: "12-5100", cost_type: "", name: "Office Furniture" },
    { cost_code: "12-9000", cost_type: "", name: "Other Furnishings" },
  ]},
  { division_code: "13", division_header: "13-0000 Special Construction", rows: [
    { cost_code: "13-2100", cost_type: "", name: "Controlled Environment Rooms" },
    { cost_code: "13-2213", cost_type: "", name: "Paint Booths" },
    { cost_code: "13-2400", cost_type: "", name: "Special Activity Rooms" },
    { cost_code: "13-3400", cost_type: "", name: "Fabricated Engr Structures" },
    { cost_code: "13-4900", cost_type: "", name: "Radiation Protection" },
  ]},
  { division_code: "14", division_header: "14-0000 Conveying Equipment", rows: [
    { cost_code: "14-2000", cost_type: "", name: "Elevators" },
    { cost_code: "14-4200", cost_type: "", name: "Wheelchair Lifts" },
  ]},
  { division_code: "21", division_header: "21-0000 Fire Suppression", rows: [
    { cost_code: "21-1100", cost_type: "", name: "Facility Fire-Suppression Water" },
    { cost_code: "21-1200", cost_type: "", name: "Fire-Suppression Standpipes" },
    { cost_code: "21-1223", cost_type: "", name: "Hose Valve Stations" },
    { cost_code: "21-1313", cost_type: "", name: "Wet-Pipe Sprinkler System" },
    { cost_code: "21-1316", cost_type: "", name: "Dry-Pipe Sprinkler Systems" },
    { cost_code: "21-1319", cost_type: "", name: "Preaction Sprinkler Systems" },
    { cost_code: "21-2000", cost_type: "", name: "Fire-Extinguishing System" },
    { cost_code: "21-3000", cost_type: "", name: "Fire Pumps" },
    { cost_code: "21-4000", cost_type: "", name: "Fire-Suppression Water Storage" },
  ]},
  { division_code: "22", division_header: "22-0000 Plumbing", rows: [
    { cost_code: "22-1000", cost_type: "", name: "Plumbing Piping" },
    { cost_code: "22-1116", cost_type: "", name: "Domestic Water Piping" },
    { cost_code: "22-1123", cost_type: "", name: "Domestic Water Pumps" },
    { cost_code: "22-1316", cost_type: "", name: "Sanitary Waste and Vent Piping" },
    { cost_code: "22-1319", cost_type: "", name: "Grease Removal Devices" },
    { cost_code: "22-1326", cost_type: "", name: "Sanitary Waste Separators" },
    { cost_code: "22-1416", cost_type: "", name: "Roof Drains and Leaders" },
    { cost_code: "22-1500", cost_type: "", name: "Gen Serv Compress-Air Systems" },
    { cost_code: "22-4513", cost_type: "", name: "Emergency Showers" },
    { cost_code: "22-4516", cost_type: "", name: "Eyewash Equipment" },
    { cost_code: "22-4713", cost_type: "", name: "Drinking Fountains" },
    { cost_code: "22-6000", cost_type: "", name: "Medical Gas System" },
  ]},
  { division_code: "23", division_header: "23-0000 HVAC", rows: [
    { cost_code: "23-0700", cost_type: "", name: "HVAC Insulation" },
    { cost_code: "23-1123", cost_type: "", name: "Facility Natural-Gas Piping" },
    { cost_code: "23-3000", cost_type: "", name: "HVAC Air Distribution" },
    { cost_code: "23-3439", cost_type: "", name: "HVLS Fans" },
    { cost_code: "23-3800", cost_type: "", name: "Summer Ventilation" },
    { cost_code: "23-5600", cost_type: "", name: "Solar Energy Heating Equipment" },
    { cost_code: "23-7000", cost_type: "", name: "Central HVAC Equipment" },
    { cost_code: "23-8000", cost_type: "", name: "Decentralized HVAC Equipment" },
  ]},
  { division_code: "25", division_header: "25-0000 Integrated Automation", rows: [
    { cost_code: "25-5000", cost_type: "", name: "Energy Management System" },
  ]},
  { division_code: "26", division_header: "26-0000 Electrical", rows: [
    { cost_code: "26-1000", cost_type: "", name: "Med-Volt Elect Distribution" },
    { cost_code: "26-2000", cost_type: "", name: "Low-Volt Elect Distribution" },
    { cost_code: "26-3100", cost_type: "", name: "Photovoltaic Collectors" },
    { cost_code: "26-3200", cost_type: "", name: "Packaged Generators" },
    { cost_code: "26-3343", cost_type: "", name: "Charging Equipment" },
    { cost_code: "26-5100", cost_type: "", name: "Interior Lighting" },
    { cost_code: "26-5213", cost_type: "", name: "Emergency and Exit Lighting" },
    { cost_code: "26-5500", cost_type: "", name: "Special Purpose Lighting" },
    { cost_code: "26-5600", cost_type: "", name: "Exterior Lighting" },
  ]},
  { division_code: "27", division_header: "27-0000 Communications", rows: [
    { cost_code: "27-1000", cost_type: "", name: "Structured Cabling" },
    { cost_code: "27-3000", cost_type: "", name: "Voice Communications" },
    { cost_code: "27-4000", cost_type: "", name: "Audio-Video Communications" },
  ]},
  { division_code: "28", division_header: "28-0000 Electronic Safety and Security", rows: [
    { cost_code: "28-1000", cost_type: "", name: "Access Control" },
    { cost_code: "28-2000", cost_type: "", name: "Electronic Surveillance" },
    { cost_code: "28-4000", cost_type: "", name: "Electronic Monitoring and Control" },
    { cost_code: "28-4600", cost_type: "", name: "Fire Detection and Alarm" },
  ]},
  { division_code: "31", division_header: "31-0000 Earthwork", rows: [
    { cost_code: "31-1100", cost_type: "", name: "Clearing and Grubbing" },
    { cost_code: "31-2213", cost_type: "", name: "Rough Grading" },
    { cost_code: "31-2219", cost_type: "", name: "Finish Grading" },
    { cost_code: "31-2316", cost_type: "", name: "Excavation" },
    { cost_code: "31-2319", cost_type: "", name: "Dewatering" },
    { cost_code: "31-2500", cost_type: "", name: "Erosion Control (Permanent)" },
    { cost_code: "31-3200", cost_type: "", name: "Soil Stabilization" },
    { cost_code: "31-3219", cost_type: "", name: "Geogrid Soil Stabilization" },
    { cost_code: "31-3700", cost_type: "", name: "Riprap" },
    { cost_code: "31-4800", cost_type: "", name: "Underpinning" },
    { cost_code: "31-5000", cost_type: "", name: "Excav Support and Protection" },
    { cost_code: "31-6000", cost_type: "", name: "Special Foundations & Load Bearing" },
    { cost_code: "31-6200", cost_type: "", name: "Driven Piles" },
    { cost_code: "31-6613", cost_type: "", name: "Aggregate Piles/Geopiers" },
    { cost_code: "31-6615", cost_type: "", name: "Helical Foundation Piles" },
  ]},
  { division_code: "32", division_header: "32-0000 Exterior Improvements", rows: [
    { cost_code: "32-0523", cost_type: "", name: "Cement and Concrete Exterior" },
    { cost_code: "32-1123", cost_type: "", name: "Aggregate Base Courses" },
    { cost_code: "32-1216", cost_type: "", name: "Asphalt Paving" },
    { cost_code: "32-1236", cost_type: "", name: "Seal Coating" },
    { cost_code: "32-1313", cost_type: "", name: "Concrete Paving" },
    { cost_code: "32-1373", cost_type: "", name: "Concrete Paving Joint Sealants" },
    { cost_code: "32-1500", cost_type: "", name: "Aggregate Surfacing" },
    { cost_code: "32-1613", cost_type: "", name: "Curbs and Gutters" },
    { cost_code: "32-1623", cost_type: "", name: "Sidewalks" },
    { cost_code: "32-1633", cost_type: "", name: "Driveways" },
    { cost_code: "32-1713", cost_type: "", name: "Parking Bumpers" },
    { cost_code: "32-1723", cost_type: "", name: "Pavement Markings" },
    { cost_code: "32-3113", cost_type: "", name: "Chain Link Fences and Gates" },
    { cost_code: "32-3213", cost_type: "", name: "CIP Concrete Retaining Walls" },
    { cost_code: "32-3300", cost_type: "", name: "Site Furnishings" },
    { cost_code: "32-3500", cost_type: "", name: "Screening Devices" },
    { cost_code: "32-3900", cost_type: "", name: "Manufactured Site Specialties" },
    { cost_code: "32-7000", cost_type: "", name: "Wetlands" },
    { cost_code: "32-8000", cost_type: "", name: "Irrigation" },
    { cost_code: "32-9000", cost_type: "", name: "Planting" },
  ]},
  { division_code: "33", division_header: "33-0000 Utilities", rows: [
    { cost_code: "33-0504", cost_type: "", name: "Utility Relocations" },
    { cost_code: "33-1000", cost_type: "", name: "Water Utilities" },
    { cost_code: "33-1413", cost_type: "", name: "Public Water Utility Distribution" },
    { cost_code: "33-3111", cost_type: "", name: "Public Sanitary Sewerage" },
    { cost_code: "33-3113", cost_type: "", name: "Site Sanitary Sewerage" },
    { cost_code: "33-3123", cost_type: "", name: "Sanitary Sewerage Force Main" },
    { cost_code: "33-3200", cost_type: "", name: "Sanitary Sewerage Equipment" },
    { cost_code: "33-4000", cost_type: "", name: "Stormwater Utilities" },
    { cost_code: "33-4116", cost_type: "", name: "Subsurface Drainage" },
    { cost_code: "33-4200", cost_type: "", name: "Stormwater Conveyance" },
    { cost_code: "33-4231", cost_type: "", name: "Stormwater Area Drains" },
    { cost_code: "33-7119", cost_type: "", name: "Elect Underground Ducts & MHs" },
  ]},
  { division_code: "34", division_header: "34-0000 Transportation", rows: [
    { cost_code: "34-1100", cost_type: "", name: "Rail Tracks" },
    { cost_code: "34-4100", cost_type: "", name: "Road Signaling & Control Equipment" },
    { cost_code: "34-7200", cost_type: "", name: "Railway Construction" },
  ]},
  { division_code: "35", division_header: "35-0000 Waterway and Marine Construction", rows: [
    { cost_code: "35-3000", cost_type: "", name: "Coastal Construction" },
  ]},
  { division_code: "50", division_header: "50-0000 Design Services", rows: [
    { cost_code: "50-1000", cost_type: "", name: "Site Investigation Report / Phase 1" },
    { cost_code: "50-1250", cost_type: "", name: "Geotechnical Report" },
    { cost_code: "50-2000", cost_type: "", name: "Architectural Design" },
    { cost_code: "50-2500", cost_type: "", name: "Wetlands Studies" },
    { cost_code: "50-3000", cost_type: "", name: "Environmental Phase 2 Studies" },
    { cost_code: "50-3500", cost_type: "", name: "Arch, Endangered & Threat Species" },
    { cost_code: "50-4100", cost_type: "", name: "Traffic Engineering Study" },
    { cost_code: "50-4200", cost_type: "", name: "Traffic Engineering Design" },
    { cost_code: "50-4500", cost_type: "", name: "Facility Engineering" },
    { cost_code: "50-5000", cost_type: "", name: "Structural Engineering" },
    { cost_code: "50-5500", cost_type: "", name: "HVAC Engineering" },
    { cost_code: "50-6000", cost_type: "", name: "Plumbing Engineering" },
    { cost_code: "50-6500", cost_type: "", name: "Electrical Engineering" },
    { cost_code: "50-7000", cost_type: "", name: "Fire Protection Engineering" },
    { cost_code: "50-7500", cost_type: "", name: "FA/Security System Engineering" },
    { cost_code: "50-8000", cost_type: "", name: "Specialty Engineering" },
    { cost_code: "50-8500", cost_type: "", name: "Miscellaneous Engineering" },
    { cost_code: "50-9100", cost_type: "", name: "ALTA Survey" },
    { cost_code: "50-9200", cost_type: "", name: "Topographic Survey" },
    { cost_code: "51-1000", cost_type: "", name: "Space Planning" },
  ]},
];

export function buildEstimateV2GcStarterRows(estimateId: number) {
  return ESTIMATE_V2_GC_TEMPLATE.map((item, index) => ({
    estimate_id: estimateId,
    cost_code: item.cost_code,
    description: item.description,
    cost_type: item.cost_type,
    qty: null,
    qty_basis: item.qty_basis,
    unit: null,
    rate: item.rate,
    allocation: item.allocation,
    sort_order: index + 1,
  }));
}

export function buildEstimateV2DetailStarterRows(estimateId: number) {
  let sortOrder = 0;
  return ESTIMATE_V2_DETAIL_DIVISIONS.flatMap((division) =>
    division.rows.map((row) => {
      sortOrder += 1;
      return {
        estimate_id: estimateId,
        division_code: division.division_code,
        division_name: division.division_header.replace(/^\d+-\d+\s+/, ""),
        cost_code: row.cost_code,
        cost_type: row.cost_type || null,
        cost_code_name: row.name,
        work_description: null,
        estimated_amount: 0,
        sub_name: null,
        sort_order: sortOrder,
      };
    })
  );
}
