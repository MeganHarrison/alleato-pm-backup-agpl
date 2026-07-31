/**
 * Development Auto-Fill System
 *
 * Provides realistic test data generation for forms in development mode.
 * Uses @snaplet/copycat for deterministic, realistic fake data.
 *
 * IMPORTANT: Only available in development (NODE_ENV !== 'production')
 */

import { copycat } from "@snaplet/copycat";

export const isDevelopment = process.env.NODE_ENV !== "production";

/**
 * Generate fake data for common field types
 */
export const fakeData = {
  // Project fields
  projectName: () => {
    const words = copycat
      .sentence(Math.random().toString(), { max: 3 })
      .split(" ");
    return `${words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")} Project`;
  },
  projectDescription: () => copycat.sentence(Math.random().toString()),
  projectNumber: () =>
    copycat
      .int(Math.random().toString(), { min: 10000, max: 99999 })
      .toString(),

  // Company fields
  companyName: () => {
    const word = copycat
      .sentence(Math.random().toString(), { max: 2 })
      .split(" ")[0];
    const suffix = copycat.oneOf(Math.random().toString(), [
      "Inc",
      "LLC",
      "Corp",
      "Construction",
    ]);
    return `${word.charAt(0).toUpperCase()}${word.slice(1)} ${suffix}`;
  },

  // Person fields
  firstName: () => copycat.firstName(Math.random().toString()),
  lastName: () => copycat.lastName(Math.random().toString()),
  fullName: () => copycat.fullName(Math.random().toString()),
  email: () => copycat.email(Math.random().toString()),
  phone: () => copycat.phoneNumber(Math.random().toString()),

  // Address fields
  streetAddress: () => copycat.streetAddress(Math.random().toString()),
  city: () => copycat.city(Math.random().toString()),
  state: () => copycat.state(Math.random().toString()),
  zipCode: () =>
    copycat
      .int(Math.random().toString(), { min: 10000, max: 99999 })
      .toString(),
  country: () => "USA",

  // Financial fields
  amount: (min = 1000, max = 1000000) =>
    copycat.int(Math.random().toString(), { min, max }),
  costCode: () => {
    const division = copycat
      .int(Math.random().toString(), { min: 1, max: 16 })
      .toString()
      .padStart(2, "0");
    const code = copycat.int(Math.random().toString(), {
      min: 1000,
      max: 9999,
    });
    return `${division}-${code}`;
  },

  // Date fields
  futureDate: () => {
    const date = new Date();
    date.setDate(
      date.getDate() +
        copycat.int(Math.random().toString(), { min: 1, max: 365 }),
    );
    return date.toISOString().split("T")[0];
  },
  pastDate: () => {
    const date = new Date();
    date.setDate(
      date.getDate() -
        copycat.int(Math.random().toString(), { min: 1, max: 365 }),
    );
    return date.toISOString().split("T")[0];
  },
  recentDate: () => {
    const date = new Date();
    date.setDate(
      date.getDate() -
        copycat.int(Math.random().toString(), { min: 1, max: 30 }),
    );
    return date.toISOString().split("T")[0];
  },

  // Construction-specific
  jobNumber: () =>
    `JOB-${copycat.int(Math.random().toString(), { min: 1000, max: 9999 })}`,
  contractNumber: () =>
    `CNT-${copycat.int(Math.random().toString(), { min: 1000, max: 9999 })}`,
  submittalNumber: () =>
    `SUB-${copycat.int(Math.random().toString(), { min: 100, max: 999 })}`,
  rfiNumber: () =>
    `RFI-${copycat.int(Math.random().toString(), { min: 100, max: 999 })}`,

  // Generic fields
  title: () => copycat.sentence(Math.random().toString(), { max: 8 }),
  description: () => copycat.paragraph(Math.random().toString()),
  notes: () => copycat.paragraph(Math.random().toString(), { min: 2, max: 4 }),
  url: () => copycat.url(Math.random().toString()),

  // Percentage
  percentage: (min = 0, max = 100) =>
    copycat.int(Math.random().toString(), { min, max }),

  // Boolean
  boolean: () => copycat.bool(Math.random().toString()),
};

/**
 * Auto-fill presets for common form types
 */
export const autoFillPresets = {
  project: {
    // Basic Information
    name: fakeData.projectName,
    description: fakeData.projectDescription,
    project_number: () =>
      `24-${copycat.int(Math.random().toString(), { min: 100, max: 999 })}`,
    project_code: () =>
      `PRJ-${copycat.int(Math.random().toString(), { min: 1000, max: 9999 })}`,

    // Project Setup - Values matching form dropdown options exactly
    stage: () =>
      copycat.oneOf(Math.random().toString(), [
        "Planning",
        "Pre-Construction",
        "Course of Construction",
        "Closeout",
        "Warranty",
        "Archived",
      ]),

    // Classification - Values matching form dropdown options exactly
    project_type: () =>
      copycat.oneOf(Math.random().toString(), [
        "New Build",
        "Addition",
        "Fit-Out",
        "Maintenance",
        "Restoration",
      ]),
    project_sector: () =>
      copycat.oneOf(Math.random().toString(), [
        "Commercial",
        "Industrial",
        "Infrastructure",
        "Healthcare",
        "Institutional",
        "Residential",
      ]),
    work_scope: () =>
      copycat.oneOf(Math.random().toString(), [
        "Ground-Up Construction",
        "Renovation",
        "Tenant Improvement",
        "Interior Build-Out",
        "Maintenance",
      ]),
    delivery_method: () =>
      copycat.oneOf(Math.random().toString(), [
        "Design-Bid-Build",
        "Design-Build",
        "Construction Management at Risk",
        "Integrated Project Delivery",
      ]),

    // Location - Values matching form dropdown options exactly
    street_address: fakeData.streetAddress,
    city: fakeData.city,
    state: () =>
      copycat.oneOf(Math.random().toString(), [
        "AL",
        "AK",
        "AZ",
        "AR",
        "CA",
        "CO",
        "CT",
        "DE",
        "FL",
        "GA",
        "HI",
        "ID",
        "IL",
        "IN",
        "IA",
        "KS",
        "KY",
        "LA",
        "ME",
        "MD",
        "MA",
        "MI",
        "MN",
        "MS",
        "MO",
        "MT",
        "NE",
        "NV",
        "NH",
        "NJ",
        "NM",
        "NY",
        "NC",
        "ND",
        "OH",
        "OK",
        "OR",
        "PA",
        "RI",
        "SC",
        "SD",
        "TN",
        "TX",
        "UT",
        "VT",
        "VA",
        "WA",
        "WV",
        "WI",
        "WY",
      ]),
    postal_code: fakeData.zipCode,
    country: () => "United States",
    region: () =>
      copycat.oneOf(Math.random().toString(), [
        "Northeast",
        "Southeast",
        "Midwest",
        "Southwest",
        "West Coast",
        "Mountain States",
      ]),
    timezone: () =>
      copycat.oneOf(Math.random().toString(), [
        "America/New_York",
        "America/Chicago",
        "America/Denver",
        "America/Los_Angeles",
        "America/Anchorage",
        "Pacific/Honolulu",
      ]),
    office: () =>
      copycat.oneOf(Math.random().toString(), [
        "Alleato Group",
        "Alleato Group West",
        "Alleato Group Southeast",
      ]),

    // Financials
    total_value: () => fakeData.amount(500000, 15000000),
    square_footage: () => fakeData.amount(5000, 500000),

    // Dates
    start_date: fakeData.futureDate,
    completion_date: () => {
      const date = new Date();
      date.setDate(
        date.getDate() +
          copycat.int(Math.random().toString(), { min: 180, max: 730 }),
      );
      return date.toISOString().split("T")[0];
    },

    // Contact
    phone: fakeData.phone,

    // Flags
    active: () => true,
    test_project: () => false,
    erp_sync: () => true,
  },

  contract: {
    title: () =>
      `${copycat.oneOf(Math.random().toString(), ["Prime", "Subcontract", "Amendment"])} Contract`,
    contract_number: fakeData.contractNumber,
    description: fakeData.description,
    contract_amount: () => fakeData.amount(50000, 5000000),
    start_date: fakeData.recentDate,
    end_date: fakeData.futureDate,
    vendor: fakeData.companyName,
    status: () =>
      copycat.oneOf(Math.random().toString(), [
        "Draft",
        "Pending",
        "Approved",
        "Executed",
      ]),
  },

  company: {
    name: fakeData.companyName,
    address: fakeData.streetAddress,
    city: fakeData.city,
    state: fakeData.state,
    zip: fakeData.zipCode,
    phone: fakeData.phone,
    email: fakeData.email,
    website: fakeData.url,
  },

  contact: {
    first_name: fakeData.firstName,
    last_name: fakeData.lastName,
    email: fakeData.email,
    phone: fakeData.phone,
    title: () =>
      copycat.oneOf(Math.random().toString(), [
        "Project Manager",
        "Superintendent",
        "Foreman",
        "Engineer",
        "Estimator",
      ]),
    company: fakeData.companyName,
  },

  budgetLineItem: {
    cost_code: fakeData.costCode,
    description: () => copycat.sentence(Math.random().toString(), { max: 12 }),
    quantity: () => fakeData.amount(1, 1000),
    unit: () =>
      copycat.oneOf(Math.random().toString(), ["EA", "LF", "SF", "CY", "LS"]),
    unit_cost: () => fakeData.amount(10, 1000),
    amount: () => fakeData.amount(1000, 100000),
  },

  meeting: {
    title: () =>
      `${copycat.oneOf(Math.random().toString(), ["Weekly", "Daily", "Safety", "Progress", "Owner"])} Meeting`,
    date: fakeData.recentDate,
    attendees: () =>
      `${fakeData.fullName()}, ${fakeData.fullName()}, ${fakeData.fullName()}`,
    notes: fakeData.notes,
  },

  changeEvent: {
    number: () =>
      `CE-${copycat.int(Math.random().toString(), { min: 1, max: 999 }).toString().padStart(3, "0")}`,
    title: () =>
      copycat.oneOf(Math.random().toString(), [
        "Unforeseen Site Conditions",
        "Owner Design Change Request",
        "Code Compliance Update",
        "RFI Resolution - Structural Modification",
        "Value Engineering Proposal",
        "Schedule Acceleration Request",
      ]),
    status: () =>
      copycat.oneOf(Math.random().toString(), [
        "open",
        "pending",
        "approved",
        "rejected",
      ]),
    origin: () =>
      copycat.oneOf(Math.random().toString(), [
        "owner",
        "architect",
        "contractor",
        "field_conditions",
        "rfi",
        "design_change",
      ]),
    type: () =>
      copycat.oneOf(Math.random().toString(), [
        "allowance",
        "owner_change",
        "design_error",
        "unforeseen_conditions",
        "code_requirement",
      ]),
    changeReason: () =>
      copycat.oneOf(Math.random().toString(), [
        "client_request",
        "design_development",
        "differing_site_conditions",
        "errors_and_omissions",
        "regulatory_requirement",
      ]),
    scope: () =>
      copycat.oneOf(Math.random().toString(), [
        "in_scope",
        "out_of_scope",
        "tbd",
      ]),
    description: () =>
      copycat.paragraph(Math.random().toString(), { min: 2, max: 3 }),
  },

  commitment: {
    // Required fields
    number: () =>
      `SC-${copycat.int(Math.random().toString(), { min: 100, max: 999 })}`,
    title: () =>
      copycat.oneOf(Math.random().toString(), [
        "Electrical Subcontract",
        "Plumbing Installation",
        "HVAC Systems",
        "Concrete Work",
        "Steel Erection",
        "Drywall & Framing",
        "Roofing Subcontract",
        "Flooring Installation",
      ]),
    description: fakeData.description,
    status: () =>
      copycat.oneOf(Math.random().toString(), [
        "draft",
        "sent",
        "pending",
        "approved",
        "executed",
        "closed",
        "void",
      ]),
    original_amount: () => fakeData.amount(50000, 2000000),
    accounting_method: () =>
      copycat.oneOf(Math.random().toString(), ["amount", "unit", "percent"]),

    // Optional fields
    retention_percentage: () =>
      copycat.oneOf(Math.random().toString(), [5, 10, 15]),
    executed_date: fakeData.recentDate,
    start_date: fakeData.futureDate,
    substantial_completion_date: () => {
      const date = new Date();
      date.setDate(
        date.getDate() +
          copycat.int(Math.random().toString(), { min: 90, max: 365 }),
      );
      return date.toISOString().split("T")[0];
    },
    vendor_invoice_number: () =>
      `INV-${copycat.int(Math.random().toString(), { min: 10000, max: 99999 })}`,
    signed_received_date: fakeData.recentDate,
    private: () => false,
  },

  primeContract: {
    number: () =>
      `${copycat.int(Math.random().toString(), { min: 1, max: 999 })}`,
    title: () =>
      copycat.oneOf(Math.random().toString(), [
        "General Construction Contract",
        "Owner-Contractor Agreement",
        "Design-Build Contract",
        "Construction Management Agreement",
        "Prime Contract for Office Build-Out",
        "Commercial Renovation Contract",
      ]),
    description: fakeData.description,
    status: () =>
      copycat.oneOf(Math.random().toString(), [
        "draft",
        "out_for_signature",
        "approved",
        "complete",
        "terminated",
      ]),
    executed: () => copycat.bool(Math.random().toString()),
    defaultRetainage: () =>
      copycat.oneOf(Math.random().toString(), [5, 10, 15]),
    startDate: () => {
      const date = new Date();
      date.setDate(
        date.getDate() +
          copycat.int(Math.random().toString(), { min: 1, max: 30 }),
      );
      return date;
    },
    estimatedCompletionDate: () => {
      const date = new Date();
      date.setDate(
        date.getDate() +
          copycat.int(Math.random().toString(), { min: 180, max: 730 }),
      );
      return date;
    },
    substantialCompletionDate: () => {
      const date = new Date();
      date.setDate(
        date.getDate() +
          copycat.int(Math.random().toString(), { min: 150, max: 700 }),
      );
      return date;
    },
    signedContractReceivedDate: () => {
      const date = new Date();
      date.setDate(
        date.getDate() -
          copycat.int(Math.random().toString(), { min: 1, max: 14 }),
      );
      return date;
    },
    originalAmount: () => fakeData.amount(500000, 10000000),
    inclusions: () =>
      `• ${copycat.sentence(Math.random().toString())}\n• ${copycat.sentence(Math.random().toString())}\n• ${copycat.sentence(Math.random().toString())}`,
    exclusions: () =>
      `• ${copycat.sentence(Math.random().toString())}\n• ${copycat.sentence(Math.random().toString())}`,
    isPrivate: () => false,
    accountingMethod: () => "amount" as const,
    sovItems: () => [
      {
        id: `sov-${Date.now()}-1`,
        budgetCode: "01-1000",
        description: "General Requirements",
        amount: 150000,
        billedToDate: 0,
        amountRemaining: 150000,
      },
      {
        id: `sov-${Date.now()}-2`,
        budgetCode: "03-3000",
        description: "Concrete Work",
        amount: 450000,
        billedToDate: 0,
        amountRemaining: 450000,
      },
      {
        id: `sov-${Date.now()}-3`,
        budgetCode: "09-2000",
        description: "Finishes",
        amount: 300000,
        billedToDate: 0,
        amountRemaining: 300000,
      },
    ],
  },

  invoice: {
    number: () =>
      `INV-${copycat.int(Math.random().toString(), { min: 1000, max: 9999 })}`,
    billing_period_start: fakeData.pastDate,
    billing_period_end: fakeData.recentDate,
    invoice_date: () => new Date().toISOString().split("T")[0],
    due_date: fakeData.futureDate,
    status: () =>
      copycat.oneOf(Math.random().toString(), [
        "draft",
        "submitted",
        "approved",
        "paid",
        "void",
      ]),
    notes: fakeData.notes,
  },
};

/**
 * Get auto-fill data for a specific form type
 */
export function getAutoFillData(
  formType: keyof typeof autoFillPresets,
): Record<string, any> {
  if (!isDevelopment) {
    return {};
  }

  const preset = autoFillPresets[formType];
  if (!preset) {
    return {};
  }

  const data: Record<string, any> = {};
  for (const [key, generator] of Object.entries(preset)) {
    data[key] = typeof generator === "function" ? generator() : generator;
  }

  return data;
}
