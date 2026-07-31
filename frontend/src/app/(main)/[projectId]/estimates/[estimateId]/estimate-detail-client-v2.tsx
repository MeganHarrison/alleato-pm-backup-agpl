"use client";

import * as React from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Mail,
  Printer,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { PageShell, PageTabs } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Modal as Dialog,
  ModalContent as DialogContent,
  ModalDescription as DialogDescription,
  ModalFooter as DialogFooter,
  ModalHeader as DialogHeader,
  ModalTitle as DialogTitle,
} from "@/components/ui/unified-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { apiFetch } from "@/lib/api-client";
import { usePdfExport } from "@/hooks/use-pdf-export";
import {
  calculateDurationWeeks,
  computeEstimateDetailDivisionTotal,
  computeEstimateGcTotal,
} from "@/lib/estimates/estimate-pdf";
import { appToast as toast } from "@/lib/toast/app-toast";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { SeedBudgetFromEstimateModal } from "@/components/domain/estimates/SeedBudgetFromEstimateModal";
import { ExpandableSearch } from "@/components/tables/unified/expandable-search";
import {
  ColumnToggle,
  FilterMenu,
  type ColumnConfig,
  type FilterConfig,
} from "@/components/tables/unified/table-toolbar";
import type { Database } from "@/types/database.types";
import type {
  EstimateAllowanceRow,
  EstimateAlternateRow,
  EstimateRow,
} from "@/lib/schemas/estimates";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GcItem = Database["public"]["Tables"]["estimate_gc_items"]["Row"];
type DetailItem = Database["public"]["Tables"]["estimate_detail_items"]["Row"];
type SublistSub = Database["public"]["Tables"]["estimate_sublist_subs"]["Row"];
type CallLog =
  Database["public"]["Tables"]["estimate_sublist_call_logs"]["Row"];
type ScopeItem =
  Database["public"]["Tables"]["estimate_sublist_scope_items"]["Row"];
type BidItem =
  Database["public"]["Tables"]["estimate_sublist_bid_items"]["Row"];
type DraftSublistRow = {
  id: number;
  division_code: string;
  division_name: string;
  position: number;
  company: string | null;
  company_id: string | null;
  contact_name: string | null;
  email: string | null;
  cell: string | null;
  price: number | null;
  comments: string | null;
  intend_to_submit: string | null;
  email_sent: string | null;
  phone_follow_up: string | null;
  bid_received: string | null;
  is_awarded: boolean | null;
  isDraft: true;
};

interface EstimateDetailClientV2Props {
  projectId: string;
  projectName: string;
  estimate: EstimateRow;
  gcItems: GcItem[];
  detailItems: DetailItem[];
  sublistSubs: SublistSub[];
  alternates: EstimateAlternateRow[];
  allowances: EstimateAllowanceRow[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

function getEstimateErrorDescription(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "The request did not complete. Check the browser console or API response for details.";
}

function showEstimateError(title: string, error: unknown, id: string) {
  toast.error(title, {
    id,
    description: getEstimateErrorDescription(error),
  });
}

/** Maps CSI division codes → trade keywords to match against company vendor_class / type */
const CSI_DIVISION_TRADES: Record<string, string[]> = {
  "02": ["demolition", "environmental", "existing conditions", "abatement"],
  "03": ["concrete", "structural concrete"],
  "04": ["masonry", "brick", "block"],
  "05": ["steel", "metals", "structural steel", "iron"],
  "06": ["carpentry", "wood", "millwork", "cabinetry", "framing"],
  "07": [
    "roofing",
    "waterproofing",
    "insulation",
    "caulking",
    "sealants",
    "moisture protection",
  ],
  "08": ["doors", "windows", "glazing", "openings", "hardware"],
  "09": [
    "drywall",
    "painting",
    "flooring",
    "tile",
    "finishes",
    "ceilings",
    "acoustical",
  ],
  "10": ["specialties", "toilet", "signage", "lockers"],
  "11": ["equipment"],
  "12": ["furnishings", "furniture", "blinds"],
  "13": ["special construction"],
  "14": ["elevator", "conveying", "escalator"],
  "21": ["fire sprinkler", "fire suppression", "sprinkler"],
  "22": ["plumbing", "mechanical", "piping"],
  "23": [
    "hvac",
    "mechanical",
    "heating",
    "cooling",
    "ventilation",
    "air conditioning",
  ],
  "25": ["automation", "controls", "building automation", "bas"],
  "26": ["electrical", "electric", "lighting", "power"],
  "27": [
    "data",
    "communications",
    "low voltage",
    "telecom",
    "av",
    "audio visual",
  ],
  "28": [
    "security",
    "fire alarm",
    "access control",
    "cctv",
    "electronic safety",
  ],
  "31": ["earthwork", "grading", "excavation", "site work"],
  "32": [
    "paving",
    "landscaping",
    "site improvements",
    "concrete flatwork",
    "exterior",
  ],
  "33": ["utilities", "underground", "site utilities"],
  "50": ["design", "architect", "engineer"],
  "51": ["design", "architect", "engineer", "planning", "survey"],
  "52": ["procurement", "purchasing"],
  "53": ["construction services", "field services"],
  "54": ["miscellaneous services"],
  "55": ["other"],
};

function companyMatchesDivision(
  company: { vendor_class?: string | null; type?: string | null },
  divisionCode: string,
): boolean {
  const keywords = CSI_DIVISION_TRADES[divisionCode];
  if (!keywords) return false;
  const haystack =
    `${company.vendor_class ?? ""} ${company.type ?? ""}`.toLowerCase();
  return keywords.some((kw) => haystack.includes(kw));
}

const DETAIL_DIVISIONS: Array<{
  division_code: string;
  division_name: string;
  division_header: string;
  rows: Array<{ cost_code: string; cost_type: string; name: string }>;
}> = [
  {
    division_code: "02",
    division_name: "Existing Conditions",
    division_header: "02-0000 Existing Conditions",
    rows: [
      {
        cost_code: "02-0150",
        cost_type: "Expense",
        name: "Maint. & Site Remediation",
      },
      { cost_code: "02-2113", cost_type: "Expense", name: "Site Surveys" },
      {
        cost_code: "02-2219",
        cost_type: "Expense",
        name: "Traffic Assessment",
      },
      {
        cost_code: "02-2400",
        cost_type: "Expense",
        name: "Environmental Assessments",
      },
      {
        cost_code: "02-2600",
        cost_type: "Expense",
        name: "Hazard Material Assessments",
      },
      {
        cost_code: "02-4113",
        cost_type: "Subcontract",
        name: "Selective Site Demolition",
      },
      {
        cost_code: "02-4116",
        cost_type: "Subcontract",
        name: "Structure Demolition",
      },
      {
        cost_code: "02-4119",
        cost_type: "Subcontract",
        name: "Selective Interior Demolition",
      },
      {
        cost_code: "02-6500",
        cost_type: "Subcontract",
        name: "UG Storage Tank Removal",
      },
      {
        cost_code: "02-8213",
        cost_type: "Subcontract",
        name: "Asbestos Abatement",
      },
    ],
  },
  {
    division_code: "03",
    division_name: "Concrete",
    division_header: "03-0000 Concrete",
    rows: [{ cost_code: "03-3500", cost_type: "", name: "Concrete Finishing" }],
  },
  {
    division_code: "04",
    division_name: "Masonry",
    division_header: "04-0000 Masonry",
    rows: [
      { cost_code: "04-2000", cost_type: "", name: "Unit Masonry-Brick" },
      {
        cost_code: "04-2200",
        cost_type: "",
        name: "Concrete Unit Masonry-Block",
      },
      { cost_code: "04-4300", cost_type: "", name: "Stone Masonry" },
      { cost_code: "04-7200", cost_type: "", name: "Cast Stone Masonry" },
      {
        cost_code: "04-7300",
        cost_type: "",
        name: "Manufactured Stone Masonry",
      },
    ],
  },
  {
    division_code: "05",
    division_name: "Metals",
    division_header: "05-0000 Metals",
    rows: [
      { cost_code: "05-1100", cost_type: "", name: "Miscellaneous Metals" },
      { cost_code: "05-1200", cost_type: "", name: "Structural Steel Framing" },
      { cost_code: "05-2000", cost_type: "", name: "Metal Joists" },
      { cost_code: "05-3000", cost_type: "", name: "Metal Decking" },
      {
        cost_code: "05-4100",
        cost_type: "",
        name: "Structural Metal Stud Framing",
      },
      { cost_code: "05-5100", cost_type: "", name: "Metal Stairs" },
      { cost_code: "05-5133", cost_type: "", name: "Metal Ladders" },
      { cost_code: "05-5813", cost_type: "", name: "Column Covers" },
      { cost_code: "05-5823", cost_type: "", name: "Formed Metal Guards" },
      { cost_code: "05-5900", cost_type: "", name: "Metal Specialties" },
      { cost_code: "05-7000", cost_type: "", name: "Decorative Metal" },
    ],
  },
  {
    division_code: "06",
    division_name: "Wood Plastics & Composites",
    division_header: "06-0000 Woods Plastics and Composites",
    rows: [
      { cost_code: "06-1000", cost_type: "", name: "Rough Carpentry" },
      { cost_code: "06-1100", cost_type: "", name: "Wood Framing" },
    ],
  },
  {
    division_code: "07",
    division_name: "Thermal & Moisture Protection",
    division_header: "07-0000 Thermal & Moisture Protection",
    rows: [
      { cost_code: "07-2100", cost_type: "", name: "Thermal Insulation" },
      { cost_code: "07-2500", cost_type: "", name: "Weather Barriers" },
    ],
  },
  {
    division_code: "08",
    division_name: "Openings",
    division_header: "08-0000 Openings",
    rows: [
      {
        cost_code: "08-1113",
        cost_type: "",
        name: "Hollow Metal Door and Frames",
      },
      { cost_code: "08-3600", cost_type: "", name: "Overhead Doors" },
      { cost_code: "08-7100", cost_type: "", name: "Door Hardware" },
      { cost_code: "08-7900", cost_type: "", name: "Hardware Accessories" },
    ],
  },
  {
    division_code: "09",
    division_name: "Finishes",
    division_header: "09-0000 Finishes",
    rows: [
      { cost_code: "09-2116", cost_type: "", name: "Gypsum Board Assemblies" },
      { cost_code: "09-5100", cost_type: "", name: "Acoustical Ceilings" },
      { cost_code: "09-6013", cost_type: "", name: "Floor Prep" },
      { cost_code: "09-6200", cost_type: "", name: "Specialty Flooring" },
      { cost_code: "09-6513", cost_type: "", name: "Resilient Base" },
      { cost_code: "09-9123", cost_type: "", name: "Interior Painting" },
    ],
  },
  {
    division_code: "10",
    division_name: "Specialties",
    division_header: "10-0000 Specialties",
    rows: [
      { cost_code: "10-1116", cost_type: "", name: "Markerboards" },
      { cost_code: "10-1139", cost_type: "", name: "Visual Display Rails" },
      { cost_code: "10-1300", cost_type: "", name: "Directories" },
      { cost_code: "10-1400", cost_type: "", name: "Signage" },
      { cost_code: "10-2113", cost_type: "", name: "Toilet Compartments" },
      {
        cost_code: "10-2123",
        cost_type: "",
        name: "Cubicle Curtains and Track",
      },
      {
        cost_code: "10-2233",
        cost_type: "",
        name: "Accordion Folding Partitions",
      },
      { cost_code: "10-2613", cost_type: "", name: "Corner Guards" },
      { cost_code: "10-2616", cost_type: "", name: "Bumper Guards" },
      {
        cost_code: "10-2623",
        cost_type: "",
        name: "Fiberglass Reinf Prot Covering",
      },
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
    ],
  },
  {
    division_code: "11",
    division_name: "Equipment",
    division_header: "11-0000 Equipment",
    rows: [
      {
        cost_code: "11-1200",
        cost_type: "",
        name: "Parking Control Equipment",
      },
      { cost_code: "11-1300", cost_type: "", name: "Loading Dock Equipment" },
      { cost_code: "11-4000", cost_type: "", name: "Foodservice Equipment" },
      {
        cost_code: "11-6000",
        cost_type: "",
        name: "Entertainment and Recreation Equipment",
      },
      { cost_code: "11-7000", cost_type: "", name: "Healthcare Equipment" },
    ],
  },
  {
    division_code: "12",
    division_name: "Furnishings",
    division_header: "12-0000 Furnishings",
    rows: [
      { cost_code: "12-2100", cost_type: "", name: "Window Blinds" },
      { cost_code: "12-3000", cost_type: "", name: "Casework" },
      { cost_code: "12-3500", cost_type: "", name: "Specialty Casework" },
      {
        cost_code: "12-4813",
        cost_type: "",
        name: "Entrance Floor Mats and Frames",
      },
      { cost_code: "12-5100", cost_type: "", name: "Office Furniture" },
      { cost_code: "12-9000", cost_type: "", name: "Other Furnishings" },
    ],
  },
  {
    division_code: "13",
    division_name: "Special Construction",
    division_header: "13-0000 Special Construction",
    rows: [
      {
        cost_code: "13-2100",
        cost_type: "",
        name: "Controlled Environment Rooms",
      },
      { cost_code: "13-2213", cost_type: "", name: "Paint Booths" },
      { cost_code: "13-2400", cost_type: "", name: "Special Activity Rooms" },
      {
        cost_code: "13-3400",
        cost_type: "",
        name: "Fabricated Engr Structures",
      },
      { cost_code: "13-4900", cost_type: "", name: "Radiation Protection" },
    ],
  },
  {
    division_code: "14",
    division_name: "Conveying Equipment",
    division_header: "14-0000 Conveying Equipment",
    rows: [
      { cost_code: "14-2000", cost_type: "", name: "Elevators" },
      { cost_code: "14-4200", cost_type: "", name: "Wheelchair Lifts" },
    ],
  },
  {
    division_code: "21",
    division_name: "Fire Suppression",
    division_header: "21-0000 Fire Suppression",
    rows: [
      {
        cost_code: "21-1100",
        cost_type: "",
        name: "Facility Fire-Suppression Water",
      },
      {
        cost_code: "21-1200",
        cost_type: "",
        name: "Fire-Suppression Standpipes",
      },
      { cost_code: "21-1223", cost_type: "", name: "Hose Valve Stations" },
      {
        cost_code: "21-1313",
        cost_type: "",
        name: "Wet-Pipe Sprinkler System",
      },
      {
        cost_code: "21-1316",
        cost_type: "",
        name: "Dry-Pipe Sprinkler Systems",
      },
      {
        cost_code: "21-1319",
        cost_type: "",
        name: "Preaction Sprinkler Systems",
      },
      {
        cost_code: "21-2000",
        cost_type: "",
        name: "Fire-Extinguishing System",
      },
      { cost_code: "21-3000", cost_type: "", name: "Fire Pumps" },
      {
        cost_code: "21-4000",
        cost_type: "",
        name: "Fire-Suppression Water Storage",
      },
    ],
  },
  {
    division_code: "22",
    division_name: "Plumbing",
    division_header: "22-0000 Plumbing",
    rows: [
      { cost_code: "22-1000", cost_type: "", name: "Plumbing Piping" },
      { cost_code: "22-1116", cost_type: "", name: "Domestic Water Piping" },
      { cost_code: "22-1123", cost_type: "", name: "Domestic Water Pumps" },
      {
        cost_code: "22-1316",
        cost_type: "",
        name: "Sanitary Waste and Vent Piping",
      },
      { cost_code: "22-1319", cost_type: "", name: "Grease Removal Devices" },
      {
        cost_code: "22-1326",
        cost_type: "",
        name: "Sanitary Waste Separators",
      },
      { cost_code: "22-1416", cost_type: "", name: "Roof Drains and Leaders" },
      {
        cost_code: "22-1500",
        cost_type: "",
        name: "Gen Serv Compress-Air Systems",
      },
      { cost_code: "22-4513", cost_type: "", name: "Emergency Showers" },
      { cost_code: "22-4516", cost_type: "", name: "Eyewash Equipment" },
      { cost_code: "22-4713", cost_type: "", name: "Drinking Fountains" },
      { cost_code: "22-6000", cost_type: "", name: "Medical Gas System" },
    ],
  },
  {
    division_code: "23",
    division_name: "HVAC",
    division_header: "23-0000 HVAC",
    rows: [
      { cost_code: "23-0700", cost_type: "", name: "HVAC Insulation" },
      {
        cost_code: "23-1123",
        cost_type: "",
        name: "Facility Natural-Gas Piping",
      },
      { cost_code: "23-3000", cost_type: "", name: "HVAC Air Distribution" },
      { cost_code: "23-3439", cost_type: "", name: "HVLS Fans" },
      { cost_code: "23-3800", cost_type: "", name: "Summer Ventilation" },
      {
        cost_code: "23-5600",
        cost_type: "",
        name: "Solar Energy Heating Equipment",
      },
      { cost_code: "23-7000", cost_type: "", name: "Central HVAC Equipment" },
      {
        cost_code: "23-8000",
        cost_type: "",
        name: "Decentralized HVAC Equipment",
      },
    ],
  },
  {
    division_code: "25",
    division_name: "Integrated Automation",
    division_header: "25-0000 Integrated Automation",
    rows: [
      { cost_code: "25-5000", cost_type: "", name: "Energy Management System" },
    ],
  },
  {
    division_code: "26",
    division_name: "Electrical",
    division_header: "26-0000 Electrical",
    rows: [
      {
        cost_code: "26-1000",
        cost_type: "",
        name: "Med-Volt Elect Distribution",
      },
      {
        cost_code: "26-2000",
        cost_type: "",
        name: "Low-Volt Elect Distribution",
      },
      { cost_code: "26-3100", cost_type: "", name: "Photovoltaic Collectors" },
      { cost_code: "26-3200", cost_type: "", name: "Packaged Generators" },
      { cost_code: "26-3343", cost_type: "", name: "Charging Equipment" },
      { cost_code: "26-5100", cost_type: "", name: "Interior Lighting" },
      {
        cost_code: "26-5213",
        cost_type: "",
        name: "Emergency and Exit Lighting",
      },
      { cost_code: "26-5500", cost_type: "", name: "Special Purpose Lighting" },
      { cost_code: "26-5600", cost_type: "", name: "Exterior Lighting" },
    ],
  },
  {
    division_code: "27",
    division_name: "Communications",
    division_header: "27-0000 Communications",
    rows: [
      { cost_code: "27-1000", cost_type: "", name: "Structured Cabling" },
      { cost_code: "27-3000", cost_type: "", name: "Voice Communications" },
      {
        cost_code: "27-4000",
        cost_type: "",
        name: "Audio-Video Communications",
      },
    ],
  },
  {
    division_code: "28",
    division_name: "Electronic Safety & Security",
    division_header: "28-0000 Electronic Safety and Security",
    rows: [
      { cost_code: "28-1000", cost_type: "", name: "Access Control" },
      { cost_code: "28-2000", cost_type: "", name: "Electronic Surveillance" },
      {
        cost_code: "28-4000",
        cost_type: "",
        name: "Electronic Monitoring and Control",
      },
      { cost_code: "28-4600", cost_type: "", name: "Fire Detection and Alarm" },
    ],
  },
  {
    division_code: "31",
    division_name: "Earthwork",
    division_header: "31-0000 Earthwork",
    rows: [
      { cost_code: "31-1100", cost_type: "", name: "Clearing and Grubbing" },
      { cost_code: "31-2213", cost_type: "", name: "Rough Grading" },
      { cost_code: "31-2219", cost_type: "", name: "Finish Grading" },
      { cost_code: "31-2316", cost_type: "", name: "Excavation" },
      { cost_code: "31-2319", cost_type: "", name: "Dewatering" },
      {
        cost_code: "31-2500",
        cost_type: "",
        name: "Erosion Control (Permanent)",
      },
      { cost_code: "31-3200", cost_type: "", name: "Soil Stabilization" },
      {
        cost_code: "31-3219",
        cost_type: "",
        name: "Geogrid Soil Stabilization",
      },
      { cost_code: "31-3700", cost_type: "", name: "Riprap" },
      { cost_code: "31-4800", cost_type: "", name: "Underpinning" },
      {
        cost_code: "31-5000",
        cost_type: "",
        name: "Excav Support and Protection",
      },
      {
        cost_code: "31-6000",
        cost_type: "",
        name: "Special Foundations & Load Bearing",
      },
      { cost_code: "31-6200", cost_type: "", name: "Driven Piles" },
      { cost_code: "31-6613", cost_type: "", name: "Aggregate Piles/Geopiers" },
      { cost_code: "31-6615", cost_type: "", name: "Helical Foundation Piles" },
    ],
  },
  {
    division_code: "32",
    division_name: "Exterior Improvements",
    division_header: "32-0000 Exterior Improvements",
    rows: [
      {
        cost_code: "32-0523",
        cost_type: "",
        name: "Cement and Concrete Exterior",
      },
      { cost_code: "32-1123", cost_type: "", name: "Aggregate Base Courses" },
      { cost_code: "32-1216", cost_type: "", name: "Asphalt Paving" },
      { cost_code: "32-1236", cost_type: "", name: "Seal Coating" },
      { cost_code: "32-1313", cost_type: "", name: "Concrete Paving" },
      {
        cost_code: "32-1373",
        cost_type: "",
        name: "Concrete Paving Joint Sealants",
      },
      { cost_code: "32-1500", cost_type: "", name: "Aggregate Surfacing" },
      { cost_code: "32-1613", cost_type: "", name: "Curbs and Gutters" },
      { cost_code: "32-1623", cost_type: "", name: "Sidewalks" },
      { cost_code: "32-1633", cost_type: "", name: "Driveways" },
      { cost_code: "32-1713", cost_type: "", name: "Parking Bumpers" },
      { cost_code: "32-1723", cost_type: "", name: "Pavement Markings" },
      {
        cost_code: "32-3113",
        cost_type: "",
        name: "Chain Link Fences and Gates",
      },
      {
        cost_code: "32-3213",
        cost_type: "",
        name: "CIP Concrete Retaining Walls",
      },
      { cost_code: "32-3300", cost_type: "", name: "Site Furnishings" },
      { cost_code: "32-3500", cost_type: "", name: "Screening Devices" },
      {
        cost_code: "32-3900",
        cost_type: "",
        name: "Manufactured Site Specialties",
      },
      { cost_code: "32-7000", cost_type: "", name: "Wetlands" },
      { cost_code: "32-8000", cost_type: "", name: "Irrigation" },
      { cost_code: "32-9000", cost_type: "", name: "Planting" },
    ],
  },
  {
    division_code: "33",
    division_name: "Utilities",
    division_header: "33-0000 Utilities",
    rows: [
      { cost_code: "33-0504", cost_type: "", name: "Utility Relocations" },
      { cost_code: "33-1000", cost_type: "", name: "Water Utilities" },
      {
        cost_code: "33-1413",
        cost_type: "",
        name: "Public Water Utility Distribution",
      },
      { cost_code: "33-3111", cost_type: "", name: "Public Sanitary Sewerage" },
      { cost_code: "33-3113", cost_type: "", name: "Site Sanitary Sewerage" },
      {
        cost_code: "33-3123",
        cost_type: "",
        name: "Sanitary Sewerage Force Main",
      },
      {
        cost_code: "33-3200",
        cost_type: "",
        name: "Sanitary Sewerage Equipment",
      },
      { cost_code: "33-4000", cost_type: "", name: "Stormwater Utilities" },
      { cost_code: "33-4116", cost_type: "", name: "Subsurface Drainage" },
      { cost_code: "33-4200", cost_type: "", name: "Stormwater Conveyance" },
      { cost_code: "33-4231", cost_type: "", name: "Stormwater Area Drains" },
      {
        cost_code: "33-7119",
        cost_type: "",
        name: "Elect Underground Ducts & MHs",
      },
    ],
  },
  {
    division_code: "34",
    division_name: "Transportation",
    division_header: "34-0000 Transportation",
    rows: [
      { cost_code: "34-1100", cost_type: "", name: "Rail Tracks" },
      {
        cost_code: "34-4100",
        cost_type: "",
        name: "Road Signaling & Control Equipment",
      },
      { cost_code: "34-7200", cost_type: "", name: "Railway Construction" },
    ],
  },
  {
    division_code: "35",
    division_name: "Waterway and Marine Construction",
    division_header: "35-0000 Waterway and Marine Construction",
    rows: [
      { cost_code: "35-3000", cost_type: "", name: "Coastal Construction" },
    ],
  },
  {
    division_code: "50",
    division_name: "Design Services",
    division_header: "50-0000 Design Services",
    rows: [
      {
        cost_code: "50-1000",
        cost_type: "",
        name: "Site Investigation Report / Phase 1",
      },
      { cost_code: "50-1250", cost_type: "", name: "Geotechnical Report" },
      { cost_code: "50-2000", cost_type: "", name: "Architectural Design" },
      { cost_code: "50-2500", cost_type: "", name: "Wetlands Studies" },
      {
        cost_code: "50-3000",
        cost_type: "",
        name: "Environmental Phase 2 Studies",
      },
      {
        cost_code: "50-3500",
        cost_type: "",
        name: "Arch, Endangered & Threat Species",
      },
      {
        cost_code: "50-4100",
        cost_type: "",
        name: "Traffic Engineering Study",
      },
      {
        cost_code: "50-4200",
        cost_type: "",
        name: "Traffic Engineering Design",
      },
      { cost_code: "50-4500", cost_type: "", name: "Facility Engineering" },
      { cost_code: "50-5000", cost_type: "", name: "Structural Engineering" },
      { cost_code: "50-5500", cost_type: "", name: "HVAC Engineering" },
      { cost_code: "50-6000", cost_type: "", name: "Plumbing Engineering" },
      { cost_code: "50-6500", cost_type: "", name: "Electrical Engineering" },
      {
        cost_code: "50-7000",
        cost_type: "",
        name: "Fire Protection Engineering",
      },
      {
        cost_code: "50-7500",
        cost_type: "",
        name: "FA/Security System Engineering",
      },
      { cost_code: "50-8000", cost_type: "", name: "Specialty Engineering" },
      {
        cost_code: "50-8500",
        cost_type: "",
        name: "Miscellaneous Engineering",
      },
      { cost_code: "50-9100", cost_type: "", name: "ALTA Survey" },
      { cost_code: "50-9200", cost_type: "", name: "Topographic Survey" },
    ],
  },
  {
    division_code: "51",
    division_name: "Space Planning",
    division_header: "51-0000 Space Planning",
    rows: [{ cost_code: "51-1000", cost_type: "", name: "Space Planning" }],
  },
  {
    division_code: "52",
    division_name: "Procurement",
    division_header: "52-0000 Procurement",
    rows: [],
  },
  {
    division_code: "53",
    division_name: "Construction Services",
    division_header: "53-0000 Construction Services",
    rows: [],
  },
  {
    division_code: "54",
    division_name: "Miscellaneous Services",
    division_header: "54-0000 Miscellaneous Services",
    rows: [],
  },
  {
    division_code: "55",
    division_name: "Other",
    division_header: "55-0000 Other",
    rows: [],
  },
];

const ALL_DIVISIONS: Array<{ code: string; name: string }> =
  DETAIL_DIVISIONS.map((division) => ({
    code: division.division_code,
    name: division.division_name,
  }));

const COST_TYPE_OPTIONS = [
  "Labor",
  "Expense",
  "Subcontract",
  "Revenue",
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCostCodeDisplay(value: string | null): string {
  const trimmed = value?.trim() ?? "";
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return trimmed;

  return String(Math.round(Number(trimmed)));
}

const WEEKS_PER_MONTH = 4.334;

function getEffectiveQty(
  item: GcItem,
  durationMonths: number,
  durationWeeks: number,
): number {
  if (item.qty_basis === "weeks") return durationWeeks;
  if (item.qty_basis === "months") {
    return durationMonths > 0
      ? durationMonths
      : Math.ceil(durationWeeks / WEEKS_PER_MONTH);
  }
  return item.qty || 1;
}

function isYes(value: string | null): boolean {
  return value === "Yes";
}

type BidPursuitStatusKey =
  | "empty"
  | "needs_contact"
  | "not_invited"
  | "invited"
  | "follow_up"
  | "declined"
  | "bid_received"
  | "ready_to_award"
  | "awarded";

type SubScopeCoverage = {
  requiredCount: number;
  coveredCount: number;
  uncoveredCount: number;
  percent: number;
};

type BidPursuitStatus = {
  key: BidPursuitStatusKey;
  label: string;
  nextAction: string;
  tone: "muted" | "warning" | "success" | "destructive";
  priority: number;
};

function getBidPursuitStatus(
  sub: SublistSub,
  scopeCoverage?: SubScopeCoverage | null,
): BidPursuitStatus {
  const hasCompany = Boolean(sub.company?.trim() || sub.company_id);
  const hasReachableContact = Boolean(sub.email?.trim() || sub.cell?.trim());
  const hasBid = isYes(sub.bid_received) || (sub.price ?? 0) > 0;
  const hasScopeGap = Boolean(
    scopeCoverage &&
    scopeCoverage.requiredCount > 0 &&
    scopeCoverage.uncoveredCount > 0,
  );

  if (sub.is_awarded) {
    return {
      key: "awarded",
      label: "Awarded",
      nextAction: "Flow bid or start contract",
      tone: "success",
      priority: 7,
    };
  }
  if (!hasCompany) {
    return {
      key: "empty",
      label: "Needs bidder",
      nextAction: "Select a company",
      tone: "warning",
      priority: 0,
    };
  }
  if (!hasReachableContact) {
    return {
      key: "needs_contact",
      label: "Needs contact",
      nextAction: "Add email or phone",
      tone: "warning",
      priority: 1,
    };
  }
  if (hasBid) {
    if (hasScopeGap) {
      return {
        key: "bid_received",
        label: "Scope gaps",
        nextAction: `Map ${scopeCoverage!.uncoveredCount} uncovered scope item${scopeCoverage!.uncoveredCount !== 1 ? "s" : ""}`,
        tone: "warning",
        priority: 5,
      };
    }
    return {
      key: "ready_to_award",
      label: "Ready to award",
      nextAction: "Level bid or award",
      tone: "success",
      priority: 5,
    };
  }
  if (sub.bid_received === "No" || sub.intend_to_submit === "No") {
    return {
      key: "declined",
      label: "No bid",
      nextAction: "Add another bidder",
      tone: "muted",
      priority: 4,
    };
  }
  if (sub.phone_follow_up === "Voicemail" || sub.phone_follow_up === "No") {
    return {
      key: "follow_up",
      label: "Follow up",
      nextAction: "Call or resend invite",
      tone: "warning",
      priority: 3,
    };
  }
  if (isYes(sub.email_sent)) {
    return {
      key: "invited",
      label: "Invited",
      nextAction: "Confirm intent",
      tone: "muted",
      priority: 6,
    };
  }

  return {
    key: "not_invited",
    label: "Not invited",
    nextAction: "Create invite draft",
    tone: "warning",
    priority: 2,
  };
}

const PURSUIT_STATUS_OPTIONS: Array<{
  value: "all" | BidPursuitStatusKey;
  label: string;
}> = [
  { value: "all", label: "All statuses" },
  { value: "not_invited", label: "Not invited" },
  { value: "follow_up", label: "Follow up" },
  { value: "ready_to_award", label: "Ready to award" },
  { value: "needs_contact", label: "Needs contact" },
  { value: "empty", label: "Needs bidder" },
  { value: "declined", label: "No bid" },
  { value: "awarded", label: "Awarded" },
];

// ---------------------------------------------------------------------------
// Inline input components
// ---------------------------------------------------------------------------

function InlineText({
  value,
  onChange,
  placeholder,
  className,
  onFocus,
  onBlur: onBlurProp,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
}) {
  const [local, setLocal] = React.useState(value);
  React.useEffect(() => {
    setLocal(value);
  }, [value]);
  const commit = () => {
    if (local !== value) onChange(local);
  };
  return (
    <Input
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={(e) => {
        commit();
        onBlurProp?.(e);
      }}
      onFocus={onFocus}
      onKeyDown={(e) => e.key === "Enter" && commit()}
      placeholder={placeholder}
      className={`h-7 border-transparent bg-transparent text-xs transition-colors placeholder:text-muted-foreground/45 focus:border-border focus:bg-background ${className ?? ""}`}
    />
  );
}

function InlineNumber({
  value,
  onChange,
  className,
  step,
  min,
  currency,
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
  step?: string;
  min?: string;
  currency?: boolean;
}) {
  const [local, setLocal] = React.useState(String(value));
  const [editing, setEditing] = React.useState(false);

  React.useEffect(() => {
    if (!editing) setLocal(String(value));
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const parsed = parseFloat(local);
    if (!Number.isNaN(parsed)) onChange(parsed);
    else setLocal(String(value));
  };

  if (!editing) {
    return (
      <div
        role="button"
        tabIndex={0}
        className={`flex h-7 cursor-text items-center justify-end rounded px-2 text-xs tabular-nums text-foreground hover:bg-muted/40 ${className ?? ""}`}
        onClick={() => setEditing(true)}
        onFocus={() => setEditing(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setEditing(true);
        }}
      >
        {currency ? formatCurrencyFull(value) : value}
      </div>
    );
  }

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && commit()}
      autoFocus
      className={`h-7 border-transparent bg-transparent text-xs transition-colors focus:border-border focus:bg-background ${className ?? ""}`}
    />
  );
}

/** Standalone duration field: a clean pill-style editable number with a trailing unit label */
function DurationField({
  value,
  onChange,
  unit,
  readOnly = false,
  title,
}: {
  value: number;
  onChange: (v: number) => void;
  unit: string;
  readOnly?: boolean;
  title?: string;
}) {
  const [local, setLocal] = React.useState(String(value));
  React.useEffect(() => {
    setLocal(String(value));
  }, [value]);
  const commit = () => {
    if (readOnly) return;
    const parsed = parseFloat(local);
    if (!Number.isNaN(parsed)) onChange(parsed);
    else setLocal(String(value));
  };
  return (
    <div
      className={`flex h-8 items-center rounded-md border border-border text-xs transition-colors focus-within:border-ring focus-within:ring-1 focus-within:ring-ring/30 ${readOnly ? "bg-muted/30 text-muted-foreground" : "bg-background"}`}
      title={title}
    >
      <Input
        type="number"
        step="0.5"
        min="0"
        value={local}
        readOnly={readOnly}
        aria-readonly={readOnly || undefined}
        onChange={(e) => {
          if (!readOnly) setLocal(e.target.value);
        }}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        className="h-auto w-16 border-0 bg-transparent pl-3 pr-1 text-right text-xs tabular-nums shadow-none outline-none ring-0 focus-visible:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <span className="pr-2.5 text-muted-foreground">{unit}</span>
    </div>
  );
}

function InlineSelect({
  value,
  options,
  onValueChange,
  placeholder,
  className,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onValueChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Select value={value || ""} onValueChange={onValueChange}>
      <SelectTrigger
        className={`h-7 w-full border-transparent bg-transparent text-xs focus:border-border focus:bg-background ${className ?? ""}`}
      >
        <SelectValue placeholder={placeholder ?? "—"} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className="text-xs">
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function EstimateDetailClientV2({
  projectId,
  projectName,
  estimate,
  gcItems: initialGcItems,
  detailItems: initialDetailItems,
  sublistSubs: initialSublistSubs,
}: EstimateDetailClientV2Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState("summary");
  const [gcItems, setGcItems] = React.useState<GcItem[]>(initialGcItems);
  const [detailItems, setDetailItems] =
    React.useState<DetailItem[]>(initialDetailItems);
  const [sublistSubs, setSublistSubs] =
    React.useState<SublistSub[]>(initialSublistSubs);
  const creatingSublistDivisionsRef = React.useRef(new Set<string>());

  // Estimate-level editable fields
  const initialDurationMonths = estimate.project_duration_months ?? 0;
  const [durationMonths, setDurationMonths] = React.useState<number>(
    initialDurationMonths,
  );
  const [durationWeeks, setDurationWeeks] = React.useState<number>(
    calculateDurationWeeks(initialDurationMonths),
  );
  const [contingencyAmount, setContingencyAmount] = React.useState<number>(
    estimate.contingency_amount ?? 0,
  );
  const [insuranceRate, setInsuranceRate] = React.useState<number>(
    estimate.insurance_rate ?? 0.0125,
  );
  const [feeRate, setFeeRate] = React.useState<number>(
    estimate.fee_rate ?? 0.1,
  );
  const [hideEmptyDetailRows, setHideEmptyDetailRows] = React.useState(false);


  // Template state
  type GcTemplate = { template_id: string; name: string; created_at: string };
  type GcTemplateItem = {
    cost_code: string;
    description: string;
    cost_type: string;
    qty_basis: string | null;
    rate: number | null;
    allocation: number | null;
    sort_order?: number | null;
  };
  const [templates, setTemplates] = React.useState<GcTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = React.useState(false);
  const [showCreateTemplate, setShowCreateTemplate] = React.useState(false);
  const [templateName, setTemplateName] = React.useState("");
  const [isSavingTemplate, setIsSavingTemplate] = React.useState(false);
  const [showSeedBudget, setShowSeedBudget] = React.useState(false);
  const [pendingTemplate, setPendingTemplate] =
    React.useState<GcTemplate | null>(null);
  const [showLoadConfirm, setShowLoadConfirm] = React.useState(false);
  const [isLoadingTemplate, setIsLoadingTemplate] = React.useState(false);

  const fetchTemplates = React.useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const data = await apiFetch<GcTemplate[]>("/api/estimates/gc-templates");
      setTemplates(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch estimate GC templates", error);
      showEstimateError(
        "Template list unavailable",
        error,
        "estimate-gc-templates-load",
      );
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  const handleCreateTemplate = async () => {
    if (!templateName.trim()) return;
    setIsSavingTemplate(true);
    try {
      const items: GcTemplateItem[] = gcItems.map((item) => ({
        cost_code: item.cost_code,
        description: item.description,
        cost_type: item.cost_type,
        qty_basis: item.qty_basis,
        rate: item.rate,
        allocation: item.allocation,
        sort_order: item.sort_order,
      }));
      await apiFetch("/api/estimates/gc-templates", {
        method: "POST",
        body: JSON.stringify({ name: templateName.trim(), items }),
      });
      toast.success(`Template "${templateName.trim()}" saved`);
      setShowCreateTemplate(false);
      setTemplateName("");
    } catch (error) {
      console.error("Failed to create estimate GC template", error);
      showEstimateError(
        "Template save issue",
        error,
        "estimate-gc-template-save",
      );
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleSelectTemplate = (template: GcTemplate) => {
    setPendingTemplate(template);
    setShowLoadConfirm(true);
  };

  const handleConfirmLoadTemplate = async () => {
    if (!pendingTemplate) return;
    setIsLoadingTemplate(true);
    try {
      // Fetch the full template data first (before touching anything in the DB)
      const allTemplates = await apiFetch<
        Array<GcTemplate & { items: GcTemplateItem[] }>
      >("/api/estimates/gc-templates");
      const templateList = Array.isArray(allTemplates) ? allTemplates : [];
      const full = templateList.find(
        (t) => t.template_id === pendingTemplate.template_id,
      );
      const templateItems = Array.isArray(full?.items) ? full.items : [];

      // Atomic replace: PUT inserts new rows first, then deletes old ones only
      // on success — so a failure at any point leaves the original rows intact.
      const created = await apiFetch<GcItem[]>(
        `/api/projects/${projectId}/estimates/${estimate.estimate_id}/gc-items`,
        {
          method: "PUT",
          body: JSON.stringify({
            items: templateItems.map((item, idx) => ({
              ...item,
              sort_order: item.sort_order ?? idx + 1,
            })),
          }),
        },
      );
      setGcItems(created);
      toast.success(`Loaded template "${pendingTemplate.name}"`);
    } catch (error) {
      console.error("Failed to load estimate GC template", error);
      showEstimateError(
        "Template load failed",
        error,
        "estimate-gc-template-load",
      );
    } finally {
      setIsLoadingTemplate(false);
      setShowLoadConfirm(false);
      setPendingTemplate(null);
    }
  };

  // Patch estimate helper
  const patchEstimate = React.useCallback(
    async (fields: Record<string, unknown>) => {
      try {
        await apiFetch(
          `/api/projects/${projectId}/estimates/${estimate.estimate_id}`,
          {
            method: "PUT",
            body: JSON.stringify({
              ...fields,
              estimate_id: estimate.estimate_id,
            }),
          },
        );

      } catch (err) {
        console.error("Failed to save estimate fields", err);
        showEstimateError(
          "Estimate field save issue",
          err,
          "estimate-fields-save",
        );
      }
    },
    [projectId, estimate.estimate_id],
  );

  const handleDurationMonthsBlur = (val: number) => {
    const weeks = calculateDurationWeeks(val);
    setDurationMonths(val);
    setDurationWeeks(weeks);
    void patchEstimate({
      project_duration_months: val,
      project_duration_weeks: weeks,
    });
  };

  // ---------------------------------------------------------------------------
  // GC items handlers
  // ---------------------------------------------------------------------------

  const patchGcItem = async (id: number, fields: Partial<GcItem>) => {
    try {
      const updated = await apiFetch<GcItem>(
        `/api/projects/${projectId}/estimates/${estimate.estimate_id}/gc-items/${id}`,
        { method: "PATCH", body: JSON.stringify(fields) },
      );
      setGcItems((prev) =>
        prev.map((item) => (item.id === id ? updated : item)),
      );
    } catch (err) {
      console.error("Failed to save estimate GC row", err);
      showEstimateError(
        "General Conditions row save issue",
        err,
        `estimate-gc-row-save-${id}`,
      );
    }
  };

  const addGcRow = async () => {
    const nextOrder =
      gcItems.reduce((max, i) => Math.max(max, i.sort_order ?? 0), 0) + 1;
    try {
      const created = await apiFetch<GcItem>(
        `/api/projects/${projectId}/estimates/${estimate.estimate_id}/gc-items`,
        {
          method: "POST",
          body: JSON.stringify({
            cost_code: "",
            description: "",
            cost_type: "Expense",
            qty_basis: "ls",
            rate: 0,
            allocation: 1,
            sort_order: nextOrder,
          }),
        },
      );
      setGcItems((prev) => [...prev, created]);
    } catch (err) {
      console.error("Failed to add estimate GC row", err);
      showEstimateError(
        "General Conditions row add issue",
        err,
        "estimate-gc-row-add",
      );
    }
  };

  const deleteGcRow = async (id: number) => {
    const prev = gcItems;
    setGcItems((items) => items.filter((i) => i.id !== id));
    try {
      await apiFetch(
        `/api/projects/${projectId}/estimates/${estimate.estimate_id}/gc-items/${id}`,
        { method: "DELETE" },
      );
    } catch (err) {
      console.error("Failed to delete estimate GC row", err);
      setGcItems(prev);
      showEstimateError(
        "General Conditions row delete issue",
        err,
        `estimate-gc-row-delete-${id}`,
      );
    }
  };

  // ---------------------------------------------------------------------------
  // Detail items handlers
  // ---------------------------------------------------------------------------

  const patchDetailItem = async (id: number, fields: Partial<DetailItem>) => {
    try {
      const updated = await apiFetch<DetailItem>(
        `/api/projects/${projectId}/estimates/${estimate.estimate_id}/detail-items/${id}`,
        { method: "PATCH", body: JSON.stringify(fields) },
      );
      setDetailItems((prev) =>
        prev.map((item) => (item.id === id ? updated : item)),
      );
    } catch (err) {
      console.error("Failed to save estimate detail row", err);
      showEstimateError(
        "Detail row save issue",
        err,
        `estimate-detail-row-save-${id}`,
      );
    }
  };

  const upsertDetailCatalogRow = React.useCallback(
    async (
      divCode: string,
      divHeader: string,
      templateRow: { cost_code: string; cost_type: string; name: string },
      fields: Partial<DetailItem>,
    ) => {
      const existing = detailItems.find(
        (item) =>
          item.division_code === divCode &&
          item.cost_code === templateRow.cost_code,
      );

      if (existing) {
        await patchDetailItem(existing.id, fields);
        return;
      }

      const nextOrder =
        DETAIL_DIVISIONS.find(
          (division) => division.division_code === divCode,
        )?.rows.findIndex((row) => row.cost_code === templateRow.cost_code) ??
        0;

      try {
        const created = await apiFetch<DetailItem>(
          `/api/projects/${projectId}/estimates/${estimate.estimate_id}/detail-items`,
          {
            method: "POST",
            body: JSON.stringify({
              division_code: divCode,
              division_name: divHeader.replace(/^\d+-\d+\s+/, ""),
              cost_code: templateRow.cost_code,
              cost_type: templateRow.cost_type || fields.cost_type || null,
              cost_code_name: templateRow.name,
              estimated_amount: 0,
              sort_order: nextOrder + 1,
              ...fields,
            }),
          },
        );
        setDetailItems((prev) => [...prev, created]);

      } catch (err) {
        console.error("Failed to create estimate detail row from catalog", err);
        showEstimateError(
          "Detail row create issue",
          err,
          `estimate-detail-row-create-${divCode}-${templateRow.cost_code}`,
        );
      }
    },
    [detailItems, estimate.estimate_id, patchDetailItem, projectId],
  );

  const deleteDetailRow = async (id: number) => {
    const prev = detailItems;
    setDetailItems((items) => items.filter((i) => i.id !== id));
    try {
      await apiFetch(
        `/api/projects/${projectId}/estimates/${estimate.estimate_id}/detail-items/${id}`,
        { method: "DELETE" },
      );
    } catch (err) {
      console.error("Failed to delete estimate detail row", err);
      setDetailItems(prev);
      showEstimateError(
        "Detail row delete issue",
        err,
        `estimate-detail-row-delete-${id}`,
      );
    }
  };

  // ---------------------------------------------------------------------------
  // Sublist handlers
  // ---------------------------------------------------------------------------

  const patchSublistSub = async (id: number, fields: Partial<SublistSub>) => {
    try {
      const updated = await apiFetch<SublistSub>(
        `/api/projects/${projectId}/estimates/${estimate.estimate_id}/sublist/${id}`,
        { method: "PATCH", body: JSON.stringify(fields) },
      );
      setSublistSubs((prev) => prev.map((s) => (s.id === id ? updated : s)));
    } catch (err) {
      console.error("Failed to save estimate sublist sub", err);
      showEstimateError(
        "Sublist row save issue",
        err,
        `estimate-sublist-row-save-${id}`,
      );
    }
  };

  const deleteSublistSub = React.useCallback(
    async (sub: SublistSub): Promise<boolean> => {
      const label = sub.company || `Division ${sub.division_code} sub`;
      if (!window.confirm(`Delete ${label} from the sublist?`)) return false;

      try {
        await apiFetch(
          `/api/projects/${projectId}/estimates/${estimate.estimate_id}/sublist/${sub.id}`,
          { method: "DELETE" },
        );
        setSublistSubs((prev) => prev.filter((item) => item.id !== sub.id));

        toast.success("Sub deleted");
        return true;
      } catch (error) {
        console.error("Failed to delete estimate sublist sub", error);
        showEstimateError(
          "Sublist row delete issue",
          error,
          `estimate-sublist-row-delete-${sub.id}`,
        );
        return false;
      }
    },
    [projectId, estimate.estimate_id],
  );

  // Add a single new row to a division (unlimited slots — PRP 1.3)
  const ensureSublistRows = React.useCallback(
    async (divCode: string, divName: string): Promise<SublistSub | null> => {
      if (creatingSublistDivisionsRef.current.has(divCode)) return null;
      creatingSublistDivisionsRef.current.add(divCode);

      const existing = sublistSubs.filter((s) => s.division_code === divCode);
      const nextPos =
        existing.reduce((max, s) => Math.max(max, s.position ?? 0), 0) + 1;
      try {
        const created = await apiFetch<SublistSub>(
          `/api/projects/${projectId}/estimates/${estimate.estimate_id}/sublist`,
          {
            method: "POST",
            body: JSON.stringify({
              division_code: divCode,
              division_name: divName,
              position: nextPos,
            }),
          },
        );
        setSublistSubs((prev) => [...prev, created]);
        return created;
      } catch (error) {
        console.error("Failed to create estimate sublist row", error);
        showEstimateError(
          "Sublist row add issue",
          error,
          `estimate-sublist-row-add-${divCode}`,
        );
        return null;
      } finally {
        creatingSublistDivisionsRef.current.delete(divCode);
      }
    },
    [sublistSubs, projectId, estimate.estimate_id],
  );

  // Award a sub (un-awards all others in the same division atomically)
  const awardSub = React.useCallback(
    async (subId: number, revoke = false) => {
      try {
        const subBefore = sublistSubs.find((s) => s.id === subId);
        const updated = await apiFetch<SublistSub>(
          `/api/projects/${projectId}/estimates/${estimate.estimate_id}/sublist/${subId}/award`,
          { method: "POST", body: JSON.stringify({ revoke }) },
        );
        // Refresh all subs in same division from server response
        setSublistSubs((prev) => {
          const divCode = prev.find((s) => s.id === subId)?.division_code;
          return prev.map((s) => {
            if (s.division_code !== divCode) return s;
            if (s.id === subId)
              return revoke
                ? { ...s, is_awarded: false }
                : (updated ?? { ...s, is_awarded: true });
            return { ...s, is_awarded: false };
          });
        });

        if (revoke) {
          toast.success("Award revoked");
        } else {
          // Offer to create a subcontract from the awarded bid
          const divName =
            ALL_DIVISIONS.find((d) => d.code === subBefore?.division_code)
              ?.name ??
            subBefore?.division_code ??
            "";
          const hasCompany = !!subBefore?.company_id;
          const hasPrice =
            typeof subBefore?.price === "number" && subBefore.price > 0;

          if (hasCompany && hasPrice) {
            const params = new URLSearchParams({
              type: "subcontract",
              vendor_id: subBefore!.company_id!,
              title: `Division ${subBefore!.division_code} ${divName} — ${subBefore!.company ?? ""}`,
              amount: String(subBefore!.price),
              description: `Subcontract for Division ${subBefore!.division_code} (${divName}) work.`,
            });
            toast.success("Sub awarded!", {
              description: `${subBefore!.company ?? "Sub"} awarded for Division ${subBefore!.division_code}.`,
              action: {
                label: "Create Subcontract →",
                onClick: () =>
                  router.push(
                    `/${projectId}/commitments/new?${params.toString()}`,
                  ),
              },
              duration: 8000,
            });
          } else {
            toast.success("Sub awarded");
          }
        }
      } catch (error) {
        console.error("Failed to update estimate award", error);
        showEstimateError(
          "Award update issue",
          error,
          `estimate-award-update-${subId}`,
        );
      }
    },
    [projectId, estimate.estimate_id, sublistSubs, router],
  );

  // ---------------------------------------------------------------------------
  // Summary calculations
  // ---------------------------------------------------------------------------

  const gcTotal = React.useMemo(
    () => computeEstimateGcTotal(gcItems, durationMonths, durationWeeks),
    [gcItems, durationMonths, durationWeeks],
  );
  const detailTotalsByDiv = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const div of ALL_DIVISIONS) {
      map[div.code] = computeEstimateDetailDivisionTotal(detailItems, div.code);
    }
    return map;
  }, [detailItems]);
  const detailTotal = Object.values(detailTotalsByDiv).reduce(
    (s, v) => s + v,
    0,
  );
  const subtotal = gcTotal + detailTotal;
  const contingency = contingencyAmount;
  const insurance = Math.round(subtotal * insuranceRate * 100) / 100;
  const fee = Math.round((subtotal + insurance) * feeRate * 100) / 100;
  const grandTotal = subtotal + contingency + insurance + fee;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const { exportPdf: handleExportPDF } = usePdfExport({
    endpoint: `/api/projects/${projectId}/estimates/${estimate.estimate_id}/pdf`,
    filename: estimate.title || "estimate",
    errorMessage: "Estimate PDF export issue",
  });

  const actionsMenu = (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" className="gap-1.5">
            Actions
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem
            disabled
            title="Prime Contract SOV import is not available yet."
          >
            Import to Prime Contract SOV
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={estimate.status !== "approved"}
            onClick={() => setShowSeedBudget(true)}
            title={
              estimate.status !== "approved"
                ? "Estimate must be approved before seeding the budget"
                : undefined
            }
          >
            Seed Budget from Estimate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleExportPDF}>
            <Printer className="h-4 w-4" />
            Export PDF
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              setTemplateName("");
              setShowCreateTemplate(true);
            }}
          >
            Create Template
          </DropdownMenuItem>
          <DropdownMenuSub
            onOpenChange={(open) => {
              if (open) void fetchTemplates();
            }}
          >
            <DropdownMenuSubTrigger>Load Template</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-52">
              {templatesLoading ? (
                <DropdownMenuItem disabled>Loading…</DropdownMenuItem>
              ) : templates.length === 0 ? (
                <DropdownMenuItem disabled>No templates saved</DropdownMenuItem>
              ) : (
                templates.map((t) => (
                  <DropdownMenuItem
                    key={t.template_id}
                    onClick={() => handleSelectTemplate(t)}
                  >
                    {t.name}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() =>
              router.push(
                `/${projectId}/estimates/new?variationOf=${estimate.estimate_id}`,
              )
            }
          >
            New Variation
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create Template dialog */}
      <Dialog open={showCreateTemplate} onOpenChange={setShowCreateTemplate}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Save as Template</DialogTitle>
            <DialogDescription>
              Save the current General Conditions items as a reusable template.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-2">
            <Label htmlFor="template-name">Template name</Label>
            <Input
              id="template-name"
              placeholder="e.g. Warehouse Standard GC"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreateTemplate();
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateTemplate(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleCreateTemplate()}
              disabled={!templateName.trim() || isSavingTemplate}
            >
              {isSavingTemplate ? "Saving…" : "Save Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load Template overwrite confirmation */}
      <Dialog open={showLoadConfirm} onOpenChange={setShowLoadConfirm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Load Template</DialogTitle>
            <DialogDescription>
              Loading <strong>&ldquo;{pendingTemplate?.name}&rdquo;</strong>{" "}
              will replace all current General Conditions items. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowLoadConfirm(false);
                setPendingTemplate(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleConfirmLoadTemplate()}
              disabled={isLoadingTemplate}
            >
              {isLoadingTemplate ? "Loading…" : "Replace & Load"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  return (
    <PageShell
      variant="detailXWide"
      title={estimate.title}
      description={`${estimate.status} · R${estimate.revision}`}
      actions={actionsMenu}
    >
      {/* Tabs row — duration fields share the same line on the GC tab */}
      <div className="flex w-full items-center gap-4">
        <div className="flex-1 overflow-hidden">
          <PageTabs
            variant="inline"
            tabs={[
              {
                label: "Summary",
                href: "summary",
                isActive: activeTab === "summary",
              },
              {
                label: "General Conditions",
                href: "gc",
                isActive: activeTab === "gc",
              },
              {
                label: "Details",
                href: "details",
                isActive: activeTab === "details",
              },
              {
                label: "SubList",
                href: "sublist",
                isActive: activeTab === "sublist",
              },
            ]}
            onTabClick={(href) => setActiveTab(href)}
          />
        </div>
        {activeTab === "gc" && (
          <div className="mb-2 flex shrink-0 items-center gap-2 md:mb-3">
            <DurationField
              value={durationMonths}
              onChange={handleDurationMonthsBlur}
              unit="mo"
            />
            <DurationField
              value={durationWeeks}
              onChange={() => undefined}
              unit="wk"
              readOnly
              title="Calculated from months x 4.334"
            />
          </div>
        )}
        {activeTab === "details" && (
          <label className="mb-2 flex shrink-0 items-center gap-3 text-sm text-foreground md:mb-3">
            <span className="whitespace-nowrap text-sm font-medium">
              Hide rows without amount
            </span>
            <Switch
              checked={hideEmptyDetailRows}
              onCheckedChange={(checked) =>
                setHideEmptyDetailRows(Boolean(checked))
              }
              aria-label="Hide rows without amount"
            />
          </label>
        )}
      </div>

      {/* Tab content */}
      <div
        className={`mt-2 ${activeTab === "sublist" ? "w-full" : "mx-auto w-full max-w-6xl"}`}
      >
        {activeTab === "gc" && (
          <GcTab
            gcItems={gcItems}
            durationMonths={durationMonths}
            durationWeeks={durationWeeks}
            onPatchItem={patchGcItem}
            onAddRow={addGcRow}
            onDeleteRow={deleteGcRow}
          />
        )}
        {activeTab === "details" && (
          <DetailsTab
            detailItems={detailItems}
            sublistSubs={sublistSubs}
            onPatchItem={patchDetailItem}
            onUpsertCatalogRow={upsertDetailCatalogRow}
            onDeleteRow={deleteDetailRow}
            hideEmptyRows={hideEmptyDetailRows}
          />
        )}
        {activeTab === "sublist" && (
          <SubListTab
            sublistSubs={sublistSubs}
            projectId={projectId}
            estimateId={String(estimate.estimate_id)}
            detailTotalsByDiv={detailTotalsByDiv}
            onPatchSub={patchSublistSub}
            onEnsureRows={ensureSublistRows}
            onAwardSub={awardSub}
            onDeleteSub={deleteSublistSub}
          />
        )}
        {activeTab === "summary" && (
          <SummaryTab
            estimate={estimate}
            projectName={projectName}
            gcItems={gcItems}
            detailItems={detailItems}
            gcTotal={gcTotal}
            detailTotalsByDiv={detailTotalsByDiv}
            subtotal={subtotal}
            contingencyAmount={contingencyAmount}
            insuranceRate={insuranceRate}
            feeRate={feeRate}
            insurance={insurance}
            fee={fee}
            grandTotal={grandTotal}
            durationMonths={durationMonths}
            durationWeeks={durationWeeks}
            onContingencyBlur={(v) => {
              setContingencyAmount(v);
              void patchEstimate({ contingency_amount: v });
            }}
            onInsuranceRateBlur={(v) => {
              setInsuranceRate(v / 100);
              void patchEstimate({ insurance_rate: v / 100 });
            }}
            onFeeRateBlur={(v) => {
              setFeeRate(v / 100);
              void patchEstimate({ fee_rate: v / 100 });
            }}
          />
        )}
      </div>

      <SeedBudgetFromEstimateModal
        open={showSeedBudget}
        onOpenChange={setShowSeedBudget}
        projectId={projectId}
        estimateId={estimate.estimate_id}
        estimateTitle={estimate.title}
      />
    </PageShell>
  );
}

// ---------------------------------------------------------------------------
// GC Tab
// ---------------------------------------------------------------------------

function GcTab({
  gcItems,
  durationMonths,
  durationWeeks,
  onPatchItem,
  onAddRow,
  onDeleteRow,
}: {
  gcItems: GcItem[];
  durationMonths: number;
  durationWeeks: number;
  onPatchItem: (id: number, fields: Partial<GcItem>) => Promise<void>;
  onAddRow: () => Promise<void>;
  onDeleteRow: (id: number) => Promise<void>;
}) {
  const gcTotal = computeEstimateGcTotal(
    gcItems,
    durationMonths,
    durationWeeks,
  );

  return (
    <div className="space-y-3">
      {/* Table */}
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left text-muted-foreground">
              <th className="py-2 pl-3 pr-2 font-medium">Cost Code</th>
              <th className="px-2 py-2 font-medium">Description</th>
              <th className="w-32 px-2 py-2 font-medium">Cost Type</th>
              <th className="w-20 px-2 py-2 text-right font-medium">Qty</th>
              <th className="w-16 px-2 py-2 font-medium">Unit</th>
              <th className="w-32 px-2 py-2 text-right font-medium">Rate</th>
              <th className="w-24 px-2 py-2 text-right font-medium">Alloc %</th>
              <th className="w-28 px-2 py-2 text-right font-medium">Total</th>
              <th className="w-8 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {gcItems.map((item) => {
              const isWeeksBasis = item.qty_basis === "weeks";
              const isMonthsBasis = item.qty_basis === "months";
              const isDerived = isWeeksBasis || isMonthsBasis;
              const qtyEffective = getEffectiveQty(
                item,
                durationMonths,
                durationWeeks,
              );
              const rowTotal =
                qtyEffective * (item.rate ?? 0) * (item.allocation ?? 0);

              return (
                <tr
                  key={item.id}
                  className="group border-b border-border/30 hover:bg-muted/20"
                >
                  <td className="py-1 pl-3 pr-2">
                    <span className="inline-flex h-7 w-24 items-center px-2 text-xs tabular-nums text-foreground">
                      {item.cost_code}
                    </span>
                  </td>
                  <td className="px-2 py-1">
                    <span className="inline-flex h-7 min-w-44 items-center px-2 text-xs text-foreground">
                      {item.description}
                    </span>
                  </td>
                  <td className="w-32 px-2 py-1">
                    <InlineSelect
                      value={item.cost_type}
                      options={COST_TYPE_OPTIONS.map((o) => ({
                        value: o,
                        label: o,
                      }))}
                      onValueChange={(v) =>
                        void onPatchItem(item.id, { cost_type: v })
                      }
                    />
                  </td>
                  <td className="px-2 py-1 text-right">
                    {isDerived ? (
                      <span className="inline-flex h-7 items-center justify-end px-2 text-muted-foreground tabular-nums">
                        {qtyEffective}
                      </span>
                    ) : (
                      <InlineNumber
                        value={item.qty || 1}
                        onChange={(v) => void onPatchItem(item.id, { qty: v })}
                        className="w-full text-right"
                      />
                    )}
                  </td>
                  <td className="px-2 py-1">
                    <InlineSelect
                      value={item.qty_basis ?? item.unit ?? "ls"}
                      options={[
                        { value: "weeks", label: "weeks" },
                        { value: "months", label: "months" },
                        { value: "ls", label: "ls" },
                        { value: "sf", label: "sf" },
                        { value: "ea", label: "ea" },
                        { value: "lf", label: "lf" },
                      ]}
                      onValueChange={(v) =>
                        void onPatchItem(item.id, { qty_basis: v })
                      }
                      className="w-24"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <InlineNumber
                      value={item.rate ?? 0}
                      onChange={(v) => void onPatchItem(item.id, { rate: v })}
                      className="w-full text-right"
                      currency
                    />
                  </td>
                  <td className="px-2 py-1">
                    <InlineNumber
                      value={Math.round((item.allocation ?? 0) * 100)}
                      onChange={(v) =>
                        void onPatchItem(item.id, { allocation: v / 100 })
                      }
                      className="w-full text-right"
                      min="0"
                      step="1"
                    />
                  </td>
                  <td className="px-2 py-1 text-right font-medium tabular-nums text-foreground">
                    {formatCurrency(rowTotal)}
                  </td>
                  <td className="px-2 py-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Delete row"
                      onClick={() => void onDeleteRow(item.id)}
                      className="h-6 p-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/20">
              <td
                colSpan={7}
                className="py-2 pl-3 text-xs font-semibold text-foreground"
              >
                Total General Conditions
              </td>
              <td className="py-2 pr-3 text-right text-sm font-bold tabular-nums text-foreground">
                {formatCurrency(gcTotal)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1 text-xs"
        onClick={() => void onAddRow()}
      >
        <Plus className="h-3.5 w-3.5" />
        Add Row
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Details Tab
// ---------------------------------------------------------------------------

function DetailsTab({
  detailItems,
  sublistSubs,
  onPatchItem,
  onUpsertCatalogRow,
  onDeleteRow,
  hideEmptyRows,
}: {
  detailItems: DetailItem[];
  sublistSubs: SublistSub[];
  onPatchItem: (id: number, fields: Partial<DetailItem>) => Promise<void>;
  onUpsertCatalogRow: (
    divCode: string,
    divHeader: string,
    templateRow: { cost_code: string; cost_type: string; name: string },
    fields: Partial<DetailItem>,
  ) => Promise<void>;
  onDeleteRow: (id: number) => Promise<void>;
  hideEmptyRows: boolean;
}) {
  const [openDivisionCodes, setOpenDivisionCodes] = React.useState<Set<string>>(
    () => new Set(DETAIL_DIVISIONS.map((division) => division.division_code)),
  );

  const toggleDivision = React.useCallback((divisionCode: string) => {
    setOpenDivisionCodes((prev) => {
      const next = new Set(prev);
      if (next.has(divisionCode)) {
        next.delete(divisionCode);
      } else {
        next.add(divisionCode);
      }
      return next;
    });
  }, []);

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-xs">
        {/* Single header row for all divisions */}
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="py-2 pl-4 pr-2 font-medium">Cost Code</th>
            <th className="w-28 px-2 py-2 font-medium">Cost Type</th>
            <th className="px-2 py-2 font-medium">Cost Code Name</th>
            <th className="px-2 py-2 font-medium">Work Description</th>
            <th className="w-36 px-2 py-2 text-right font-medium">
              Estimate / Bid
            </th>
            <th className="px-2 py-2 font-medium">Sub Name / Plug</th>
            <th className="w-8 px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {DETAIL_DIVISIONS.map((div) => {
            const persistedRows = detailItems.filter(
              (i) => i.division_code === div.division_code,
            );
            const subOptions = Array.from(
              new Set(
                sublistSubs
                  .filter((sub) => sub.division_code === div.division_code)
                  .map((sub) => sub.company?.trim() ?? "")
                  .filter((company) => company.length > 0),
              ),
            );
            const persistedByCostCode = new Map(
              persistedRows
                .filter((item) => item.cost_code)
                .map((item) => [item.cost_code as string, item]),
            );
            const catalogRows = div.rows.map((catalogRow) => ({
              key: catalogRow.cost_code,
              persisted: persistedByCostCode.get(catalogRow.cost_code) ?? null,
              template: catalogRow,
            }));
            const extraRows = persistedRows
              .filter(
                (item) =>
                  !item.cost_code ||
                  !div.rows.some(
                    (catalogRow) => catalogRow.cost_code === item.cost_code,
                  ),
              )
              .map((item) => ({
                key: `custom-${item.id}`,
                persisted: item,
                template: {
                  cost_code: item.cost_code ?? "",
                  cost_type: item.cost_type ?? "",
                  name: item.cost_code_name ?? "",
                },
              }));
            const displayRows = [...catalogRows, ...extraRows].filter(
              ({ persisted }) => {
                if (!hideEmptyRows) return true;
                return (persisted?.estimated_amount ?? 0) > 0;
              },
            );
            const divTotal = persistedRows.reduce(
              (s, i) => s + (i.estimated_amount ?? 0),
              0,
            );
            const isOpen = openDivisionCodes.has(div.division_code);
            return (
              <React.Fragment key={div.division_code}>
                <tr
                  className={cn(
                    "border-b border-t border-border bg-muted/60 transition-colors hover:bg-muted/70",
                    isOpen && "border-b-border/40",
                  )}
                >
                  <td colSpan={5} className="py-1.5 pl-2 pr-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => toggleDivision(div.division_code)}
                      className="h-auto min-h-8 w-full justify-start gap-2 rounded-sm px-2 py-0 text-left font-semibold text-foreground hover:bg-transparent hover:text-foreground"
                    >
                      {isOpen ? (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span>{div.division_header}</span>
                    </Button>
                  </td>
                  <td
                    colSpan={2}
                    className="py-2 pr-4 text-right font-medium tabular-nums text-muted-foreground"
                  >
                    {divTotal > 0 ? formatCurrency(divTotal) : ""}
                  </td>
                </tr>

                {isOpen && (
                  <>
                    {displayRows.map(({ key, persisted, template }) => (
                      <tr
                        key={key}
                        className="group border-b border-border/20 hover:bg-muted/20"
                      >
                        <td className="py-1 pl-4 pr-2">
                          <span className="inline-flex h-7 w-36 items-center px-2 text-xs tabular-nums text-foreground">
                            {formatCostCodeDisplay(
                              template.cost_code || persisted?.cost_code || "",
                            )}
                          </span>
                        </td>
                        <td className="px-2 py-1">
                          <InlineSelect
                            value={
                              persisted?.cost_type ?? template.cost_type ?? ""
                            }
                            options={COST_TYPE_OPTIONS.map((o) => ({
                              value: o,
                              label: o,
                            }))}
                            onValueChange={(v) => {
                              if (persisted) {
                                void onPatchItem(persisted.id, {
                                  cost_type: v || null,
                                });
                                return;
                              }
                              void onUpsertCatalogRow(
                                div.division_code,
                                div.division_header,
                                template,
                                { cost_type: v || null },
                              );
                            }}
                            placeholder="—"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <span className="inline-flex h-7 min-w-40 items-center px-2 text-xs text-foreground">
                            {persisted?.cost_code_name ??
                              div.rows.find(
                                (row) => row.cost_code === persisted?.cost_code,
                              )?.name ??
                              template.name ??
                              ""}
                          </span>
                        </td>
                        <td className="px-2 py-1">
                          <InlineText
                            value={persisted?.work_description ?? ""}
                            onChange={(v) => {
                              if (persisted) {
                                void onPatchItem(persisted.id, {
                                  work_description: v || null,
                                });
                                return;
                              }
                              void onUpsertCatalogRow(
                                div.division_code,
                                div.division_header,
                                template,
                                { work_description: v || null },
                              );
                            }}
                            placeholder="Description"
                            className="min-w-40"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <InlineNumber
                            value={persisted?.estimated_amount ?? 0}
                            onChange={(v) => {
                              if (persisted) {
                                void onPatchItem(persisted.id, {
                                  estimated_amount: v,
                                });
                                return;
                              }
                              void onUpsertCatalogRow(
                                div.division_code,
                                div.division_header,
                                template,
                                { estimated_amount: v },
                              );
                            }}
                            className="w-full text-right"
                            currency
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Select
                            value={persisted?.sub_name ?? "none"}
                            onValueChange={(value) => {
                              const nextValue = value === "none" ? null : value;
                              if (persisted) {
                                void onPatchItem(persisted.id, {
                                  sub_name: nextValue,
                                });
                                return;
                              }
                              void onUpsertCatalogRow(
                                div.division_code,
                                div.division_header,
                                template,
                                { sub_name: nextValue },
                              );
                            }}
                          >
                            <SelectTrigger className="h-7 w-full min-w-0 border-transparent bg-transparent px-2 text-xs focus:border-border focus:bg-background">
                              <SelectValue placeholder="Select bidder" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none" className="text-xs">
                                No bidder selected
                              </SelectItem>
                              {persisted?.sub_name &&
                              !subOptions.includes(persisted.sub_name) ? (
                                <SelectItem
                                  value={persisted.sub_name}
                                  className="text-xs"
                                >
                                  {persisted.sub_name}
                                </SelectItem>
                              ) : null}
                              {subOptions.map((subName) => (
                                <SelectItem
                                  key={subName}
                                  value={subName}
                                  className="text-xs"
                                >
                                  {subName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-1">
                          {persisted ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label="Delete row"
                              onClick={() => void onDeleteRow(persisted.id)}
                              className="h-6 p-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SubList Tab
// ---------------------------------------------------------------------------

const INTEND_OPTIONS = [
  { value: "Yes", label: "Yes" },
  { value: "No", label: "No" },
];
const EMAIL_SENT_OPTIONS = [
  { value: "Yes", label: "Yes" },
  { value: "No", label: "No" },
  { value: "Other", label: "Other" },
];
const PHONE_OPTIONS = [
  { value: "Yes", label: "Yes" },
  { value: "No", label: "No" },
  { value: "Voicemail", label: "Voicemail" },
];
const BID_OPTIONS = [
  { value: "Yes", label: "Yes" },
  { value: "No", label: "No" },
  { value: "Other", label: "Other" },
];

type Company = Database["public"]["Tables"]["companies"]["Row"];

function SubListTab({
  sublistSubs,
  projectId,
  estimateId,
  detailTotalsByDiv,
  onPatchSub,
  onEnsureRows,
  onAwardSub,
  onDeleteSub,
}: {
  sublistSubs: SublistSub[];
  projectId: string;
  estimateId: string;
  detailTotalsByDiv: Record<string, number>;
  onPatchSub: (id: number, fields: Partial<SublistSub>) => Promise<void>;
  onEnsureRows: (
    divCode: string,
    divName: string,
  ) => Promise<SublistSub | null>;
  onAwardSub: (subId: number, revoke?: boolean) => Promise<void>;
  onDeleteSub: (sub: SublistSub) => Promise<boolean>;
}) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [filterIntend, setFilterIntend] = React.useState("all");
  const [filterBid, setFilterBid] = React.useState("all");
  const [filterPursuit, setFilterPursuit] = React.useState<
    "all" | BidPursuitStatusKey
  >("all");
  const [sortConfig, setSortConfig] = React.useState<{
    col: keyof SublistSub;
    dir: "asc" | "desc";
  } | null>(null);
  const [selectedSubIds, setSelectedSubIds] = React.useState<Set<number>>(
    new Set(),
  );
  const [visibleColumns, setVisibleColumns] = React.useState<string[]>([
    "contact",
    "email",
    "phone",
    "intend",
    "bid",
    "outreach",
    "comments",
  ]);
  const [focusedSubId, setFocusedSubId] = React.useState<number | null>(null);
  const [pendingScopeFocusSubId, setPendingScopeFocusSubId] = React.useState<
    number | null
  >(null);
  const [draftSubsByDivision, setDraftSubsByDivision] = React.useState<
    Record<string, DraftSublistRow[]>
  >({});
  const draftRowIdRef = React.useRef(-1);
  const [companies, setCompanies] = React.useState<Company[]>([]);
  const [companySearch, setCompanySearch] = React.useState("");
  const [openComboboxId, setOpenComboboxId] = React.useState<number | null>(
    null,
  );
  const [openComboboxDivision, setOpenComboboxDivision] =
    React.useState<string>("");
  const addingSubDivisionsRef = React.useRef(new Set<string>());
  const [addingSubDivisions, setAddingSubDivisions] = React.useState<
    Set<string>
  >(() => new Set());
  const subRowRefs = React.useRef<Record<number, HTMLElement | null>>({});

  const setDivisionAdding = React.useCallback(
    (divCode: string, isAdding: boolean) => {
      setAddingSubDivisions((prev) => {
        const next = new Set(prev);
        if (isAdding) {
          next.add(divCode);
        } else {
          next.delete(divCode);
        }
        return next;
      });
    },
    [],
  );

  const handleEnsureRows = React.useCallback(
    async (divCode: string, divName: string): Promise<SublistSub | null> => {
      if (addingSubDivisionsRef.current.has(divCode)) return null;

      addingSubDivisionsRef.current.add(divCode);
      setDivisionAdding(divCode, true);

      try {
        return await onEnsureRows(divCode, divName);
      } finally {
        addingSubDivisionsRef.current.delete(divCode);
        setDivisionAdding(divCode, false);
      }
    },
    [onEnsureRows, setDivisionAdding],
  );

  const createDraftSub = React.useCallback(
    (divCode: string, divName: string, position: number): DraftSublistRow => ({
      id: draftRowIdRef.current--,
      division_code: divCode,
      division_name: divName,
      position,
      company: null,
      company_id: null,
      contact_name: null,
      email: null,
      cell: null,
      price: null,
      comments: null,
      intend_to_submit: null,
      email_sent: null,
      phone_follow_up: null,
      bid_received: null,
      is_awarded: null,
      isDraft: true,
    }),
    [],
  );

  const addDraftRows = React.useCallback(
    (divCode: string, divName: string, count = 1) => {
      setDraftSubsByDivision((prev) => {
        const existing = prev[divCode] ?? [];
        const persistedCount = sublistSubs.filter(
          (sub) => sub.division_code === divCode,
        ).length;
        const basePosition = persistedCount + existing.length + 1;
        const nextDrafts = Array.from({ length: count }, (_, index) =>
          createDraftSub(divCode, divName, basePosition + index),
        );
        return { ...prev, [divCode]: [...existing, ...nextDrafts] };
      });
    },
    [createDraftSub, sublistSubs],
  );

  const updateDraftSub = React.useCallback(
    (draftId: number, updater: (draft: DraftSublistRow) => DraftSublistRow) => {
      setDraftSubsByDivision((prev) => {
        const next: Record<string, DraftSublistRow[]> = {};
        for (const [divisionCode, drafts] of Object.entries(prev)) {
          next[divisionCode] = drafts.map((draft) =>
            draft.id === draftId ? updater(draft) : draft,
          );
        }
        return next;
      });
    },
    [],
  );

  const removeDraftSub = React.useCallback((draftId: number) => {
    setDraftSubsByDivision((prev) => {
      const next: Record<string, DraftSublistRow[]> = {};
      for (const [divisionCode, drafts] of Object.entries(prev)) {
        const filtered = drafts.filter((draft) => draft.id !== draftId);
        if (filtered.length > 0) next[divisionCode] = filtered;
      }
      return next;
    });
    setSelectedSubIds((prev) => {
      const next = new Set(prev);
      next.delete(draftId);
      return next;
    });
  }, []);

  const persistDraftSub = React.useCallback(
    async (draft: DraftSublistRow, fields: Partial<SublistSub> = {}) => {
      const created = await handleEnsureRows(
        draft.division_code,
        draft.division_name,
      );
      if (!created) return null;
      removeDraftSub(draft.id);
      if (Object.keys(fields).length > 0) {
        await onPatchSub(created.id, fields);
        return {
          ...created,
          ...fields,
        } as SublistSub;
      }
      return created;
    },
    [handleEnsureRows, onPatchSub, removeDraftSub],
  );

  // Call log state
  const [callLogsBySubId, setCallLogsBySubId] = React.useState<
    Record<number, CallLog[]>
  >({});
  const [openCallLogSubId, setOpenCallLogSubId] = React.useState<number | null>(
    null,
  );
  const [callLogOutcome, setCallLogOutcome] = React.useState<string>("");
  const [callLogNotes, setCallLogNotes] = React.useState<string>("");
  const [callLogSubmitting, setCallLogSubmitting] = React.useState(false);

  const loadCallLogs = React.useCallback(
    async (subId: number) => {
      try {
        const logs = await apiFetch<CallLog[]>(
          `/api/projects/${projectId}/estimates/${estimateId}/sublist/${subId}/call-logs`,
        );
        setCallLogsBySubId((prev) => ({ ...prev, [subId]: logs ?? [] }));
      } catch (error) {
        console.error("Failed to load estimate sub call logs", error);
      }
    },
    [projectId, estimateId],
  );

  const openCallLog = React.useCallback(
    (subId: number) => {
      setOpenCallLogSubId(subId);
      setCallLogOutcome("");
      setCallLogNotes("");
      void loadCallLogs(subId);
    },
    [loadCallLogs],
  );

  const submitCallLog = React.useCallback(
    async (subId: number) => {
      if (!callLogOutcome) return;
      setCallLogSubmitting(true);
      try {
        const log = await apiFetch<CallLog>(
          `/api/projects/${projectId}/estimates/${estimateId}/sublist/${subId}/call-logs`,
          {
            method: "POST",
            body: JSON.stringify({
              outcome: callLogOutcome,
              notes: callLogNotes || undefined,
            }),
          },
        );
        if (log) {
          setCallLogsBySubId((prev) => ({
            ...prev,
            [subId]: [log, ...(prev[subId] ?? [])],
          }));
          // Update phone_follow_up on the sub row to reflect latest outcome
          await onPatchSub(subId, {
            phone_follow_up: callLogOutcome === "Reached" ? "Yes" : "No",
          });
        }
        setCallLogOutcome("");
        setCallLogNotes("");
        toast.success("Call logged");
      } catch (error) {
        console.error("Failed to log estimate sub call", error);
        showEstimateError(
          "Call log save issue",
          error,
          `estimate-call-log-save-${subId}`,
        );
      } finally {
        setCallLogSubmitting(false);
      }
    },
    [projectId, estimateId, callLogOutcome, callLogNotes, onPatchSub],
  );

  // Scope package state
  const [scopeItemsByDiv, setScopeItemsByDiv] = React.useState<
    Record<string, ScopeItem[]>
  >({});
  const [expandedScopeDivs, setExpandedScopeDivs] = React.useState<Set<string>>(
    new Set(),
  );
  const [newScopeDesc, setNewScopeDesc] = React.useState<
    Record<string, string>
  >({});

  const loadScopeItems = React.useCallback(
    async (divCode: string) => {
      try {
        const items = await apiFetch<ScopeItem[]>(
          `/api/projects/${projectId}/estimates/${estimateId}/scope-items?division_code=${divCode}`,
        );
        setScopeItemsByDiv((prev) => ({ ...prev, [divCode]: items ?? [] }));
      } catch (error) {
        console.error("Failed to load estimate scope items", error);
      }
    },
    [projectId, estimateId],
  );

  React.useEffect(() => {
    const divisionsNeedingScope = Array.from(
      new Set(
        sublistSubs
          .filter((sub) =>
            Boolean(
              sub.company?.trim() ||
              sub.email?.trim() ||
              sub.cell?.trim() ||
              (sub.price ?? 0) > 0,
            ),
          )
          .map((sub) => sub.division_code)
          .filter((divCode) => scopeItemsByDiv[divCode] === undefined),
      ),
    );

    divisionsNeedingScope.forEach((divCode) => {
      void loadScopeItems(divCode);
    });
  }, [sublistSubs, scopeItemsByDiv, loadScopeItems]);

  // Division benchmark cache (5.3) — must be before toggleScopeDiv to avoid TDZ
  const [benchmarkCache, setBenchmarkCache] = React.useState<
    Record<
      string,
      {
        count: number;
        min: number | null;
        max: number | null;
        avg: number | null;
        source: string;
      }
    >
  >({});

  const loadBenchmark = React.useCallback(
    async (divCode: string) => {
      if (benchmarkCache[divCode] !== undefined) return;
      setBenchmarkCache((prev) => ({
        ...prev,
        [divCode]: {
          count: 0,
          min: null,
          max: null,
          avg: null,
          source: "none",
        },
      }));
      try {
        const data = await apiFetch<{
          count: number;
          min: number | null;
          max: number | null;
          avg: number | null;
          source: string;
        }>(`/api/estimates/benchmark?division_code=${divCode}`);
        if (data) setBenchmarkCache((prev) => ({ ...prev, [divCode]: data }));
      } catch (error) {
        console.error("Failed to load estimate benchmark", error);
      }
    },
    [benchmarkCache],
  );

  const toggleScopeDiv = React.useCallback(
    (divCode: string) => {
      setExpandedScopeDivs((prev) => {
        const next = new Set(prev);
        if (next.has(divCode)) {
          next.delete(divCode);
        } else {
          next.add(divCode);
          if (!scopeItemsByDiv[divCode]) void loadScopeItems(divCode);
          if (!benchmarkCache[divCode]) void loadBenchmark(divCode);
        }
        return next;
      });
    },
    [scopeItemsByDiv, loadScopeItems, benchmarkCache, loadBenchmark],
  );

  const addScopeItem = React.useCallback(
    async (divCode: string) => {
      const desc = (newScopeDesc[divCode] ?? "").trim();
      if (!desc) return;
      try {
        const item = await apiFetch<ScopeItem>(
          `/api/projects/${projectId}/estimates/${estimateId}/scope-items`,
          {
            method: "POST",
            body: JSON.stringify({
              division_code: divCode,
              description: desc,
              sort_order: scopeItemsByDiv[divCode]?.length ?? 0,
            }),
          },
        );
        if (item) {
          setScopeItemsByDiv((prev) => ({
            ...prev,
            [divCode]: [...(prev[divCode] ?? []), item],
          }));
          setNewScopeDesc((prev) => ({ ...prev, [divCode]: "" }));
        }
      } catch (error) {
        console.error("Failed to add estimate scope item", error);
        showEstimateError(
          "Scope item add issue",
          error,
          `estimate-scope-item-add-${divCode}`,
        );
      }
    },
    [projectId, estimateId, newScopeDesc, scopeItemsByDiv],
  );

  const toggleScopeItemChecked = React.useCallback(
    async (divCode: string, item: ScopeItem) => {
      const updated = { ...item, is_checked: !item.is_checked };
      setScopeItemsByDiv((prev) => ({
        ...prev,
        [divCode]: (prev[divCode] ?? []).map((s) =>
          s.id === item.id ? updated : s,
        ),
      }));
      try {
        await apiFetch(
          `/api/projects/${projectId}/estimates/${estimateId}/scope-items/${item.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({ is_checked: updated.is_checked }),
          },
        );
      } catch (err) {
        // revert optimistic update
        setScopeItemsByDiv((prev) => ({
          ...prev,
          [divCode]: (prev[divCode] ?? []).map((s) =>
            s.id === item.id ? item : s,
          ),
        }));
        showEstimateError(
          "Scope item save failed",
          err,
          `estimate-scope-item-toggle-${item.id}`,
        );
      }
    },
    [projectId, estimateId],
  );

  const deleteScopeItem = React.useCallback(
    async (divCode: string, itemId: number) => {
      setScopeItemsByDiv((prev) => ({
        ...prev,
        [divCode]: (prev[divCode] ?? []).filter((s) => s.id !== itemId),
      }));
      try {
        await apiFetch(
          `/api/projects/${projectId}/estimates/${estimateId}/scope-items/${itemId}`,
          { method: "DELETE" },
        );
      } catch (error) {
        console.error("Failed to delete estimate scope item", error);
        showEstimateError(
          "Scope item delete issue",
          error,
          `estimate-scope-item-delete-${itemId}`,
        );
        void loadScopeItems(divCode);
      }
    },
    [projectId, estimateId, loadScopeItems],
  );

  // Bid items state (structured bid entry per sub)
  const [bidItemsBySubId, setBidItemsBySubId] = React.useState<
    Record<number, BidItem[]>
  >({});
  const [expandedBidSubIds, setExpandedBidSubIds] = React.useState<Set<number>>(
    new Set(),
  );
  const [newBidDesc, setNewBidDesc] = React.useState<Record<number, string>>(
    {},
  );
  const [newBidAmount, setNewBidAmount] = React.useState<
    Record<number, string>
  >({});
  const [newBidScopeItemId, setNewBidScopeItemId] = React.useState<
    Record<number, string>
  >({});

  const removeDeletedSubState = React.useCallback((sub: SublistSub) => {
    setExpandedBidSubIds((prev) => {
      const next = new Set(prev);
      next.delete(sub.id);
      return next;
    });
    setBidItemsBySubId((prev) => {
      const next = { ...prev };
      delete next[sub.id];
      return next;
    });
    setNewBidDesc((prev) => {
      const next = { ...prev };
      delete next[sub.id];
      return next;
    });
    setNewBidAmount((prev) => {
      const next = { ...prev };
      delete next[sub.id];
      return next;
    });
    setNewBidScopeItemId((prev) => {
      const next = { ...prev };
      delete next[sub.id];
      return next;
    });
    setCallLogsBySubId((prev) => {
      const next = { ...prev };
      delete next[sub.id];
      return next;
    });
    setOpenCallLogSubId((current) => (current === sub.id ? null : current));
    setSelectedSubIds((prev) => {
      const next = new Set(prev);
      next.delete(sub.id);
      return next;
    });
  }, []);

  const deleteSub = React.useCallback(
    async (sub: SublistSub) => {
      const deleted = await onDeleteSub(sub);
      if (!deleted) return;
      removeDeletedSubState(sub);
    },
    [onDeleteSub, removeDeletedSubState],
  );

  const loadBidItems = React.useCallback(
    async (subId: number) => {
      try {
        const items = await apiFetch<BidItem[]>(
          `/api/projects/${projectId}/estimates/${estimateId}/sublist/${subId}/bid-items`,
        );
        setBidItemsBySubId((prev) => ({ ...prev, [subId]: items ?? [] }));
      } catch (error) {
        console.error("Failed to load sublist bid items", error);
      }
    },
    [projectId, estimateId],
  );

  const toggleBidExpand = React.useCallback(
    (subId: number) => {
      setExpandedBidSubIds((prev) => {
        const next = new Set(prev);
        if (next.has(subId)) {
          next.delete(subId);
        } else {
          next.add(subId);
          if (!bidItemsBySubId[subId]) void loadBidItems(subId);
        }
        return next;
      });
    },
    [bidItemsBySubId, loadBidItems],
  );

  const addBidItem = React.useCallback(
    async (subId: number) => {
      const desc = (newBidDesc[subId] ?? "").trim();
      const amount = parseFloat(newBidAmount[subId] ?? "0") || 0;
      const scopeItemId = parseInt(newBidScopeItemId[subId] ?? "", 10);
      if (!desc) return;
      try {
        const item = await apiFetch<BidItem>(
          `/api/projects/${projectId}/estimates/${estimateId}/sublist/${subId}/bid-items`,
          {
            method: "POST",
            body: JSON.stringify({
              description: desc,
              amount,
              scope_item_id: Number.isNaN(scopeItemId)
                ? undefined
                : scopeItemId,
            }),
          },
        );
        if (item) {
          setBidItemsBySubId((prev) => ({
            ...prev,
            [subId]: [...(prev[subId] ?? []), item],
          }));
          setNewBidDesc((prev) => ({ ...prev, [subId]: "" }));
          setNewBidAmount((prev) => ({ ...prev, [subId]: "" }));
          setNewBidScopeItemId((prev) => ({ ...prev, [subId]: "" }));
          // Update local sub price
          const newTotal = [...(bidItemsBySubId[subId] ?? []), item]
            .filter((b) => !b.is_excluded)
            .reduce((s, b) => s + Number(b.amount), 0);
          void onPatchSub(subId, { price: newTotal });
        }
      } catch (error) {
        console.error("Failed to add estimate bid item", error);
        showEstimateError(
          "Bid item add issue",
          error,
          `estimate-bid-item-add-${subId}`,
        );
      }
    },
    [
      projectId,
      estimateId,
      newBidDesc,
      newBidAmount,
      newBidScopeItemId,
      bidItemsBySubId,
      onPatchSub,
    ],
  );

  const patchBidItem = React.useCallback(
    async (subId: number, itemId: number, fields: Partial<BidItem>) => {
      setBidItemsBySubId((prev) => ({
        ...prev,
        [subId]: (prev[subId] ?? []).map((b) =>
          b.id === itemId ? { ...b, ...fields } : b,
        ),
      }));
      try {
        await apiFetch(
          `/api/projects/${projectId}/estimates/${estimateId}/sublist/${subId}/bid-items/${itemId}`,
          { method: "PATCH", body: JSON.stringify(fields) },
        );
        // Recompute local total
        const updatedItems = (bidItemsBySubId[subId] ?? []).map((b) =>
          b.id === itemId ? { ...b, ...fields } : b,
        );
        const total = updatedItems
          .filter((b) => !b.is_excluded)
          .reduce((s, b) => s + Number(b.amount), 0);
        void onPatchSub(subId, { price: total });
      } catch (error) {
        console.error("Failed to update estimate bid item", error);
        showEstimateError(
          "Bid item update issue",
          error,
          `estimate-bid-item-update-${itemId}`,
        );
      }
    },
    [projectId, estimateId, bidItemsBySubId, onPatchSub],
  );

  const deleteBidItem = React.useCallback(
    async (subId: number, itemId: number) => {
      const remaining = (bidItemsBySubId[subId] ?? []).filter(
        (b) => b.id !== itemId,
      );
      setBidItemsBySubId((prev) => ({ ...prev, [subId]: remaining }));
      try {
        await apiFetch(
          `/api/projects/${projectId}/estimates/${estimateId}/sublist/${subId}/bid-items/${itemId}`,
          { method: "DELETE" },
        );
        const total = remaining
          .filter((b) => !b.is_excluded)
          .reduce((s, b) => s + Number(b.amount), 0);
        void onPatchSub(subId, { price: total });
      } catch (error) {
        console.error("Failed to delete estimate bid item", error);
        showEstimateError(
          "Bid item delete issue",
          error,
          `estimate-bid-item-delete-${itemId}`,
        );
        void loadBidItems(subId);
      }
    },
    [projectId, estimateId, bidItemsBySubId, onPatchSub, loadBidItems],
  );

  // Smart suggestions state (5.2)
  type SuggestedCompany = {
    id: string;
    name: string;
    contact_name?: string | null;
    contact_email?: string | null;
    contact_phone?: string | null;
    vendor_class?: string | null;
    type?: string | null;
    is_trade_match: boolean;
    prior_contracts: number;
    bid_history: { total: number; awarded: number } | null;
    score: number;
  };
  const [suggestionsCache, setSuggestionsCache] = React.useState<
    Record<string, SuggestedCompany[]>
  >({});
  const [expandedSuggestions, setExpandedSuggestions] = React.useState<
    Set<string>
  >(new Set());

  const loadSuggestions = React.useCallback(
    async (divCode: string, excludeIds: string[]) => {
      const qs = new URLSearchParams({ division_code: divCode, limit: "6" });
      if (excludeIds.length)
        qs.set("exclude_company_ids", excludeIds.join(","));
      try {
        const data = await apiFetch<SuggestedCompany[]>(
          `/api/estimates/suggest-subs?${qs.toString()}`,
        );
        if (data) setSuggestionsCache((prev) => ({ ...prev, [divCode]: data }));
      } catch (error) {
        console.error("Failed to load suggested companies", error);
      }
    },
    [],
  );

  const toggleSuggestions = React.useCallback(
    (divCode: string, excludeIds: string[]) => {
      setExpandedSuggestions((prev) => {
        const next = new Set(prev);
        if (next.has(divCode)) {
          next.delete(divCode);
        } else {
          next.add(divCode);
          if (!suggestionsCache[divCode])
            void loadSuggestions(divCode, excludeIds);
        }
        return next;
      });
    },
    [suggestionsCache, loadSuggestions],
  );

  // Bid invitation modal state
  const [bidInviteSubId, setBidInviteSubId] = React.useState<number | null>(
    null,
  );
  const [bidInviteDueDate, setBidInviteDueDate] = React.useState("");
  const [bidInviteMessage, setBidInviteMessage] = React.useState("");
  const [bidInviteSending, setBidInviteSending] = React.useState(false);

  const sendBidInvitation = React.useCallback(async () => {
    if (!bidInviteSubId) return;
    setBidInviteSending(true);
    try {
      const result = await apiFetch<{
        success: boolean;
        draft?: { webLink?: string | null };
        recipient?: string;
      }>(
        `/api/projects/${projectId}/estimates/${estimateId}/sublist/${bidInviteSubId}/bid-invitation`,
        {
          method: "POST",
          body: JSON.stringify({
            bid_due_date: bidInviteDueDate || undefined,
            custom_message: bidInviteMessage || undefined,
          }),
        },
      );
      if (result?.success) {
        // Update local email_sent state
        void onPatchSub(bidInviteSubId, { email_sent: "Yes" });
        toast.success("Bid invitation draft created in Outlook", {
          description: result.draft?.webLink
            ? undefined
            : `Draft sent to ${result.recipient ?? "recipient"}`,
          action: result.draft?.webLink
            ? {
                label: "Open in Outlook",
                onClick: () => window.open(result.draft!.webLink!, "_blank"),
              }
            : undefined,
          duration: 8000,
        });
        setBidInviteSubId(null);
        setBidInviteDueDate("");
        setBidInviteMessage("");
      }
    } catch (err) {
      console.error("Failed to send estimate bid invitation", err);
      showEstimateError(
        "Bid invitation issue",
        err,
        `estimate-bid-invitation-${bidInviteSubId}`,
      );
    } finally {
      setBidInviteSending(false);
    }
  }, [
    bidInviteSubId,
    bidInviteDueDate,
    bidInviteMessage,
    projectId,
    estimateId,
    onPatchSub,
  ]);

  // Company bid history cache (5.1)
  const [bidHistoryCache, setBidHistoryCache] = React.useState<
    Record<
      string,
      {
        total_bids: number;
        awarded: number;
        win_rate: number;
        avg_price: number | null;
        divisions: { code: string; bids: number; awarded: number }[];
      }
    >
  >({});

  const loadBidHistory = React.useCallback(
    async (companyId: string) => {
      if (bidHistoryCache[companyId] !== undefined) return; // already cached
      setBidHistoryCache((prev) => ({
        ...prev,
        [companyId]: {
          total_bids: 0,
          awarded: 0,
          win_rate: 0,
          avg_price: null,
          divisions: [],
        },
      }));
      try {
        const data = await apiFetch<{
          total_bids: number;
          awarded: number;
          win_rate: number;
          avg_price: number | null;
          divisions: { code: string; bids: number; awarded: number }[];
        }>(`/api/companies/${companyId}/bid-history`);
        if (data)
          setBidHistoryCache((prev) => ({ ...prev, [companyId]: data }));
      } catch (error) {
        console.error("Failed to load company bid history", error);
      }
    },
    [bidHistoryCache],
  );

  // Load companies once on mount
  React.useEffect(() => {
    const supabaseClient = createClient();
    supabaseClient
      .from("companies")
      .select(
        "id, name, contact_name, contact_email, contact_phone, type, vendor_class, is_vendor",
      )
      .order("name", { ascending: true })
      .limit(2000)
      .then(({ data }) => {
        if (data) setCompanies(data as Company[]);
      });
  }, []);

  const filteredCompanies = React.useMemo(() => {
    const q = companySearch.toLowerCase();
    const nameMatches = q
      ? companies.filter((c) => c.name.toLowerCase().includes(q))
      : companies;

    if (openComboboxDivision) {
      // Sort trade-matching companies to the top
      const matching: Company[] = [];
      const rest: Company[] = [];
      for (const c of nameMatches) {
        if (companyMatchesDivision(c, openComboboxDivision)) matching.push(c);
        else rest.push(c);
      }
      return [...matching, ...rest].slice(0, 50);
    }

    return nameMatches.slice(0, 50);
  }, [companies, companySearch, openComboboxDivision]);

  const getSubScopeCoverage = React.useCallback(
    (sub: SublistSub): SubScopeCoverage | null => {
      const requiredScopeItems = (
        scopeItemsByDiv[sub.division_code] ?? []
      ).filter((item) => item.is_checked);
      if (requiredScopeItems.length === 0) return null;

      const coveredScopeIds = new Set(
        (bidItemsBySubId[sub.id] ?? [])
          .filter((item) => !item.is_excluded && item.scope_item_id)
          .map((item) => item.scope_item_id as number),
      );

      const coveredCount = requiredScopeItems.filter((item) =>
        coveredScopeIds.has(item.id),
      ).length;
      const uncoveredCount = requiredScopeItems.length - coveredCount;

      return {
        requiredCount: requiredScopeItems.length,
        coveredCount,
        uncoveredCount,
        percent:
          requiredScopeItems.length > 0
            ? Math.round((coveredCount / requiredScopeItems.length) * 100)
            : 0,
      };
    },
    [bidItemsBySubId, scopeItemsByDiv],
  );

  const getUncoveredScopeItems = React.useCallback(
    (sub: SublistSub) => {
      const requiredScopeItems = (
        scopeItemsByDiv[sub.division_code] ?? []
      ).filter((item) => item.is_checked);
      if (requiredScopeItems.length === 0) return [];

      const coveredScopeIds = new Set(
        (bidItemsBySubId[sub.id] ?? [])
          .filter((item) => !item.is_excluded && item.scope_item_id)
          .map((item) => item.scope_item_id as number),
      );

      return requiredScopeItems.filter((item) => !coveredScopeIds.has(item.id));
    },
    [bidItemsBySubId, scopeItemsByDiv],
  );

  const getSubPursuitStatus = React.useCallback(
    (sub: SublistSub) => getBidPursuitStatus(sub, getSubScopeCoverage(sub)),
    [getSubScopeCoverage],
  );

  const selectCompany = React.useCallback(
    async (sub: SublistSub | DraftSublistRow, company: Company) => {
      setOpenComboboxId(null);
      setCompanySearch("");
      if ("isDraft" in sub) {
        await persistDraftSub(sub, {
          company_id: company.id,
          company: company.name,
          contact_name: company.contact_name ?? sub.contact_name,
          email: company.contact_email ?? sub.email,
          cell: company.contact_phone ?? sub.cell,
        });
        return;
      }
      await onPatchSub(sub.id, {
        company_id: company.id,
        company: company.name,
        contact_name: company.contact_name ?? sub.contact_name,
        email: company.contact_email ?? sub.email,
        cell: company.contact_phone ?? sub.cell,
      });
    },
    [onPatchSub, persistDraftSub],
  );

  const commitManualCompany = React.useCallback(
    async (sub: SublistSub | DraftSublistRow, rawValue: string) => {
      const trimmed = rawValue.trim();
      const currentCompany = sub.company?.trim() ?? "";
      const keepCompanyId =
        !("isDraft" in sub) &&
        Boolean(sub.company_id && trimmed && trimmed === currentCompany);

      setOpenComboboxId(null);
      setCompanySearch("");

      if ("isDraft" in sub) {
        if (!trimmed) {
          updateDraftSub(sub.id, (draft) => ({
            ...draft,
            company: null,
            company_id: null,
          }));
          return;
        }
        await persistDraftSub(sub, {
          company: trimmed,
          company_id: null,
        });
        return;
      }

      await onPatchSub(sub.id, {
        company: trimmed || null,
        company_id: keepCompanyId ? sub.company_id : null,
      });
    },
    [onPatchSub, persistDraftSub, updateDraftSub],
  );

  const hasActiveFilter = Boolean(
    searchQuery ||
    filterIntend !== "all" ||
    filterBid !== "all" ||
    filterPursuit !== "all" ||
    sortConfig,
  );

  const toggleSort = (col: keyof SublistSub) => {
    setSortConfig((prev) =>
      prev?.col === col
        ? prev.dir === "asc"
          ? { col, dir: "desc" }
          : null
        : { col, dir: "asc" },
    );
  };

  const filteredSubs = React.useMemo(() => {
    let rows = [...sublistSubs];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.company ?? "").toLowerCase().includes(q) ||
          (r.contact_name ?? "").toLowerCase().includes(q) ||
          (r.email ?? "").toLowerCase().includes(q),
      );
    }
    if (filterIntend !== "all")
      rows = rows.filter((r) => r.intend_to_submit === filterIntend);
    if (filterBid !== "all")
      rows = rows.filter((r) => r.bid_received === filterBid);
    if (filterPursuit !== "all")
      rows = rows.filter((r) => getSubPursuitStatus(r).key === filterPursuit);
    if (sortConfig) {
      rows.sort((a, b) => {
        const av =
          sortConfig.col === "price"
            ? Number(a[sortConfig.col]) || 0
            : String(a[sortConfig.col] ?? "").toLowerCase();
        const bv =
          sortConfig.col === "price"
            ? Number(b[sortConfig.col]) || 0
            : String(b[sortConfig.col] ?? "").toLowerCase();
        return sortConfig.dir === "asc"
          ? av < bv
            ? -1
            : av > bv
              ? 1
              : 0
          : av > bv
            ? -1
            : av < bv
              ? 1
              : 0;
      });
    }
    return rows;
  }, [
    sublistSubs,
    searchQuery,
    filterIntend,
    filterBid,
    filterPursuit,
    sortConfig,
    getSubPursuitStatus,
  ]);

  const exactCompanyMatch = React.useMemo(() => {
    const q = companySearch.trim().toLowerCase();
    if (!q) return null;
    return (
      filteredCompanies.find(
        (company) => company.name.trim().toLowerCase() === q,
      ) ?? null
    );
  }, [filteredCompanies, companySearch]);

  const visibleDivisions = React.useMemo(() => {
    if (hasActiveFilter) {
      return ALL_DIVISIONS.filter((div) =>
        filteredSubs.some((s) => s.division_code === div.code),
      );
    }

    const activeDivisions = ALL_DIVISIONS.filter((div) => {
      const hasEstimateAmount = (detailTotalsByDiv[div.code] ?? 0) > 0;
      const hasSubRows = sublistSubs.some((s) => s.division_code === div.code);
      return hasEstimateAmount || hasSubRows;
    });

    return activeDivisions.length > 0 ? activeDivisions : ALL_DIVISIONS;
  }, [detailTotalsByDiv, filteredSubs, hasActiveFilter, sublistSubs]);

  React.useEffect(() => {
    if (hasActiveFilter) return;

    visibleDivisions.forEach((div) => {
      const persistedCount = sublistSubs.filter(
        (sub) => sub.division_code === div.code,
      ).length;
      const draftCount = draftSubsByDivision[div.code]?.length ?? 0;
      const missing = Math.max(0, 2 - (persistedCount + draftCount));
      if (missing > 0) {
        addDraftRows(div.code, div.name, missing);
      }
    });
  }, [
    addDraftRows,
    draftSubsByDivision,
    hasActiveFilter,
    sublistSubs,
    visibleDivisions,
  ]);

  const focusSubRow = React.useCallback((subId: number) => {
    setFocusedSubId(subId);
    const row = subRowRefs.current[subId];
    row?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  React.useEffect(() => {
    if (focusedSubId === null) return;
    const timeout = window.setTimeout(
      () =>
        setFocusedSubId((current) =>
          current === focusedSubId ? null : current,
        ),
      2200,
    );
    return () => window.clearTimeout(timeout);
  }, [focusedSubId]);

  React.useEffect(() => {
    if (
      pendingScopeFocusSubId === null ||
      !expandedBidSubIds.has(pendingScopeFocusSubId)
    )
      return;

    const timeout = window.setTimeout(() => {
      const unmappedSelect = document.querySelector<HTMLElement>(
        `[data-scope-map-select="${pendingScopeFocusSubId}"]`,
      );
      const addItemInput = document.querySelector<HTMLInputElement>(
        `[data-bid-item-desc-input="${pendingScopeFocusSubId}"]`,
      );
      const target = unmappedSelect ?? addItemInput;
      target?.focus();
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      setPendingScopeFocusSubId((current) =>
        current === pendingScopeFocusSubId ? null : current,
      );
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [expandedBidSubIds, pendingScopeFocusSubId]);

  const runPrimaryAction = React.useCallback(
    async (sub: SublistSub) => {
      focusSubRow(sub.id);
      const status = getSubPursuitStatus(sub);

      if (status.key === "empty" || status.key === "needs_contact") {
        setOpenComboboxDivision(sub.division_code);
        setOpenComboboxId(sub.id);
        setCompanySearch("");
        return;
      }

      if (status.key === "not_invited") {
        if (sub.email?.trim()) {
          setBidInviteSubId(sub.id);
        } else {
          openCallLog(sub.id);
        }
        return;
      }

      if (status.key === "follow_up") {
        openCallLog(sub.id);
        return;
      }

      if (status.key === "declined") {
        await handleEnsureRows(sub.division_code, sub.division_name);
        return;
      }

      if (status.key === "bid_received") {
        setPendingScopeFocusSubId(sub.id);
        if (!expandedBidSubIds.has(sub.id)) {
          toggleBidExpand(sub.id);
        }
        return;
      }

      if (status.key === "ready_to_award") {
        if (!expandedBidSubIds.has(sub.id)) toggleBidExpand(sub.id);
        return;
      }

      if (status.key === "awarded" && sub.price && sub.price > 0) {
        void (async () => {
          try {
            await apiFetch(
              `/api/projects/${projectId}/estimates/${estimateId}/sublist/${sub.id}/use-bid`,
              { method: "POST" },
            );
            toast.success("Bid flowed into estimate");
          } catch (err) {
            showEstimateError(
              "Use bid failed",
              err,
              `estimate-use-bid-${sub.id}`,
            );
          }
        })();
      }
    },
    [
      estimateId,
      expandedBidSubIds,
      focusSubRow,
      getSubPursuitStatus,
      handleEnsureRows,
      openCallLog,
      projectId,
      toggleBidExpand,
    ],
  );

  const getPrimaryActionLabel = React.useCallback(
    (sub: SublistSub) => {
      switch (getSubPursuitStatus(sub).key) {
        case "empty":
          return "Pick company";
        case "needs_contact":
          return "Fix contact";
        case "not_invited":
          return sub.email?.trim() ? "Create invite" : "Log call";
        case "follow_up":
          return "Log call";
        case "declined":
          return "Add bidder";
        case "bid_received":
          return "Map scope";
        case "ready_to_award":
          return "Review bid";
        case "awarded":
          return sub.price && sub.price > 0 ? "Use bid" : null;
        default:
          return null;
      }
    },
    [getSubPursuitStatus],
  );

  const toolbarFilters = React.useMemo<FilterConfig[]>(
    () => [
      {
        id: "intend_to_submit",
        label: "Intent to submit",
        type: "select",
        options: [
          { value: "Yes", label: "Yes" },
          { value: "No", label: "No" },
        ],
      },
      {
        id: "bid_received",
        label: "Bid received",
        type: "select",
        options: [
          { value: "Yes", label: "Yes" },
          { value: "No", label: "No" },
        ],
      },
      {
        id: "pursuit_status",
        label: "Pursuit status",
        type: "select",
        options: PURSUIT_STATUS_OPTIONS.filter(
          (option) => option.value !== "all",
        ).map((option) => ({ value: option.value, label: option.label })),
      },
    ],
    [],
  );

  const activeToolbarFilters = React.useMemo(
    () => ({
      intend_to_submit: filterIntend === "all" ? undefined : filterIntend,
      bid_received: filterBid === "all" ? undefined : filterBid,
      pursuit_status: filterPursuit === "all" ? undefined : filterPursuit,
    }),
    [filterBid, filterIntend, filterPursuit],
  );

  const toolbarColumns = React.useMemo<ColumnConfig[]>(
    () => [
      { id: "contact", label: "Contact", defaultVisible: true },
      { id: "email", label: "Email", defaultVisible: true },
      { id: "phone", label: "Phone", defaultVisible: true },
      { id: "intend", label: "Intent to submit", defaultVisible: true },
      { id: "bid", label: "Bid received", defaultVisible: true },
      { id: "outreach", label: "Outreach", defaultVisible: true },
      { id: "comments", label: "Comments", defaultVisible: true },
    ],
    [],
  );

  const handleToolbarFilterChange = React.useCallback(
    (
      filters: Record<
        string,
        string | string[] | number | boolean | null | undefined
      >,
    ) => {
      setFilterIntend(
        typeof filters.intend_to_submit === "string"
          ? filters.intend_to_submit
          : "all",
      );
      setFilterBid(
        typeof filters.bid_received === "string" ? filters.bid_received : "all",
      );
      setFilterPursuit(
        typeof filters.pursuit_status === "string"
          ? (filters.pursuit_status as BidPursuitStatusKey)
          : "all",
      );
      setSortConfig(null);
    },
    [],
  );

  const clearToolbarFilters = React.useCallback(() => {
    setFilterIntend("all");
    setFilterBid("all");
    setFilterPursuit("all");
    setSortConfig(null);
  }, []);

  const selectedVisibleCount = React.useMemo(
    () => filteredSubs.filter((sub) => selectedSubIds.has(sub.id)).length,
    [filteredSubs, selectedSubIds],
  );

  const allVisibleSelected =
    filteredSubs.length > 0 && selectedVisibleCount === filteredSubs.length;
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;

  const toggleSelectAllVisible = React.useCallback(
    (checked: boolean) => {
      setSelectedSubIds((prev) => {
        const next = new Set(prev);
        if (checked) {
          filteredSubs.forEach((sub) => next.add(sub.id));
        } else {
          filteredSubs.forEach((sub) => next.delete(sub.id));
        }
        return next;
      });
    },
    [filteredSubs],
  );

  const toggleSelectedSub = React.useCallback(
    (subId: number, checked: boolean) => {
      setSelectedSubIds((prev) => {
        const next = new Set(prev);
        if (checked) next.add(subId);
        else next.delete(subId);
        return next;
      });
    },
    [],
  );

  const handleBulkDelete = React.useCallback(async () => {
    const selectedSubs = filteredSubs.filter((sub) =>
      selectedSubIds.has(sub.id),
    );
    if (selectedSubs.length === 0) return;
    if (
      !window.confirm(
        `Delete ${selectedSubs.length} selected sublist row${selectedSubs.length === 1 ? "" : "s"}?`,
      )
    )
      return;

    const results = await Promise.all(
      selectedSubs.map(async (sub) => ({
        sub,
        deleted: await onDeleteSub(sub),
      })),
    );

    let deletedCount = 0;
    let failedCount = 0;

    results.forEach(({ sub, deleted }) => {
      if (deleted) {
        deletedCount += 1;
        removeDeletedSubState(sub);
      } else {
        failedCount += 1;
      }
    });

    if (deletedCount > 0) {
      toast.success(
        `Deleted ${deletedCount} sublist row${deletedCount === 1 ? "" : "s"}`,
      );
    }
    if (failedCount > 0) {
      toast.error("Some selected sublist rows could not be deleted", {
        description: `${failedCount} row${failedCount === 1 ? "" : "s"} remain.`,
      });
    }
  }, [filteredSubs, onDeleteSub, removeDeletedSubState, selectedSubIds]);

  const showColumn = React.useCallback(
    (columnId: string) => visibleColumns.includes(columnId),
    [visibleColumns],
  );

  const visibleFieldCount =
    Number(showColumn("contact")) +
    Number(showColumn("email")) +
    Number(showColumn("phone")) +
    Number(showColumn("intend")) +
    Number(showColumn("bid")) +
    Number(showColumn("outreach"));

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Checkbox
            checked={
              allVisibleSelected
                ? true
                : someVisibleSelected
                  ? "indeterminate"
                  : false
            }
            onCheckedChange={(checked) =>
              toggleSelectAllVisible(Boolean(checked))
            }
            aria-label="Select visible sublist rows"
            className="h-4 w-4"
          />
          <ExpandableSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search company or contact..."
            ariaLabel="Search sublist"
          />
          <FilterMenu
            filters={toolbarFilters}
            activeFilters={activeToolbarFilters}
            onFilterChange={handleToolbarFilterChange}
            onClearFilters={clearToolbarFilters}
          />
          <ColumnToggle
            columns={toolbarColumns}
            visibleColumns={visibleColumns}
            onColumnVisibilityChange={setVisibleColumns}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            disabled={selectedSubIds.size === 0}
            onClick={() => void handleBulkDelete()}
            aria-label="Delete selected sublist rows"
            title={
              selectedSubIds.size > 0
                ? `Delete ${selectedSubIds.size} selected`
                : "Delete selected"
            }
          >
            <Trash2
              className={`h-4 w-4 ${selectedSubIds.size > 0 ? "text-destructive" : ""}`}
            />
          </Button>
          {(hasActiveFilter || searchQuery) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 px-2 text-xs text-muted-foreground"
              onClick={() => {
                setSearchQuery("");
                clearToolbarFilters();
              }}
            >
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
          )}
          <div className="ml-auto text-sm text-muted-foreground">
            {selectedVisibleCount > 0
              ? `${selectedVisibleCount} of ${filteredSubs.length} selected`
              : `${filteredSubs.length} sub${filteredSubs.length !== 1 ? "s" : ""}${hasActiveFilter ? " matching" : " total"}`}
          </div>
        </div>

        <div className="space-y-4">
          {visibleDivisions.map((div) => {
            const divRows = filteredSubs.filter(
              (s) => s.division_code === div.code,
            );
            const draftRows = hasActiveFilter
              ? []
              : (draftSubsByDivision[div.code] ?? []);
            const displayRows = [...divRows, ...draftRows];
            const isAddingSub = addingSubDivisions.has(div.code);

            return (
              <section
                key={div.code}
                className="overflow-hidden rounded-md border border-border"
              >
                <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="font-mono text-[11px] font-semibold tabular-nums text-muted-foreground">
                      {div.code}
                    </span>
                    <div className="truncate text-base font-semibold text-foreground">
                      {div.name}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                      onClick={() => toggleScopeDiv(div.code)}
                    >
                      {expandedScopeDivs.has(div.code) ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                      Scope
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        const existingIds = divRows
                          .map((s) => s.company_id)
                          .filter(Boolean) as string[];
                        toggleSuggestions(div.code, existingIds);
                      }}
                    >
                      {expandedSuggestions.has(div.code) ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                      Suggest
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                      onClick={() => addDraftRows(div.code, div.name)}
                    >
                      <Plus className="h-3 w-3" />
                      Add bidder
                    </Button>
                  </div>
                </div>

                {expandedScopeDivs.has(div.code) && (
                  <div className="border-b border-border bg-muted/10 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Scope Package — Division {div.code}
                      </p>
                      <Button
                        variant="ghost"
                        type="button"
                        size="sm"
                        className="h-6 gap-1 px-2 text-[10px] text-muted-foreground hover:text-primary"
                        onClick={async () => {
                          try {
                            const result = await apiFetch<{
                              seeded: number;
                              items: ScopeItem[];
                            }>(
                              `/api/projects/${projectId}/estimates/${estimateId}/scope-items/seed`,
                              {
                                method: "POST",
                                body: JSON.stringify({
                                  division_code: div.code,
                                }),
                              },
                            );
                            if (result && result.seeded > 0) {
                              setScopeItemsByDiv((prev) => ({
                                ...prev,
                                [div.code]: [
                                  ...(prev[div.code] ?? []),
                                  ...result.items,
                                ],
                              }));
                              toast.success(
                                `Added ${result.seeded} scope items from estimate`,
                              );
                            } else {
                              toast.info("No new items to seed from estimate");
                            }
                          } catch (error) {
                            console.error(
                              "Failed to seed estimate scope items",
                              error,
                            );
                            showEstimateError(
                              "Scope seed issue",
                              error,
                              `estimate-scope-seed-${div.code}`,
                            );
                          }
                        }}
                      >
                        <Plus className="h-3 w-3" /> Seed from estimate
                      </Button>
                    </div>
                    <div className="mb-3 space-y-1">
                      {(scopeItemsByDiv[div.code] ?? []).length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No scope items yet. Add items below or seed from the
                          estimate.
                        </p>
                      ) : (
                        (scopeItemsByDiv[div.code] ?? []).map((item) => (
                          <div
                            key={item.id}
                            className="group flex items-start gap-2"
                          >
                            <Checkbox
                              checked={item.is_checked}
                              onCheckedChange={() =>
                                void toggleScopeItemChecked(div.code, item)
                              }
                              className="mt-0.5 h-3.5 w-3.5 shrink-0"
                            />
                            <span
                              className={`flex-1 text-xs ${item.is_checked ? "text-foreground" : "text-muted-foreground line-through"}`}
                            >
                              {item.description}
                              {item.notes && (
                                <span className="ml-1 text-muted-foreground">
                                  — {item.notes}
                                </span>
                              )}
                            </span>
                            <Button
                              variant="ghost"
                              type="button"
                              size="icon"
                              className="h-4 w-4 shrink-0 opacity-0 group-hover:opacity-100"
                              onClick={() =>
                                void deleteScopeItem(div.code, item.id)
                              }
                            >
                              <X className="h-2.5 w-2.5" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      <Input
                        placeholder="Add scope item…"
                        value={newScopeDesc[div.code] ?? ""}
                        onChange={(e) =>
                          setNewScopeDesc((prev) => ({
                            ...prev,
                            [div.code]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void addScopeItem(div.code);
                        }}
                        className="h-8 flex-1 text-xs"
                      />
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 px-3 text-xs"
                        onClick={() => void addScopeItem(div.code)}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                )}

                {expandedSuggestions.has(div.code) && (
                  <div className="border-b border-border bg-muted/10 p-4">
                    <p className="mb-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Suggested Subs — Division {div.code}
                    </p>
                    {!suggestionsCache[div.code] ? (
                      <p className="text-xs text-muted-foreground">
                        Loading suggestions…
                      </p>
                    ) : suggestionsCache[div.code]!.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No suggestions found for this division.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {suggestionsCache[div.code]!.map((company) => (
                          <div
                            key={company.id}
                            className="flex items-center gap-3 rounded-md border border-border/60 bg-background px-3 py-2"
                          >
                            <div className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-foreground">
                                {company.name}
                                {company.is_trade_match && (
                                  <span className="rounded bg-primary/10 px-1 py-0.5 text-[9px] font-medium text-primary">
                                    Trade
                                  </span>
                                )}
                                {company.prior_contracts > 0 && (
                                  <span className="text-[9px] text-muted-foreground">
                                    {company.prior_contracts} prior contract
                                    {company.prior_contracts !== 1 ? "s" : ""}
                                  </span>
                                )}
                                {company.bid_history &&
                                  company.bid_history.total > 0 && (
                                    <span className="text-[9px] text-muted-foreground">
                                      ·{" "}
                                      {Math.round(
                                        (company.bid_history.awarded /
                                          company.bid_history.total) *
                                          100,
                                      )}
                                      % win rate
                                    </span>
                                  )}
                              </span>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              type="button"
                              className="h-7 shrink-0 px-2 text-[10px]"
                              disabled={isAddingSub}
                              onClick={async () => {
                                const newSub = await handleEnsureRows(
                                  div.code,
                                  div.name,
                                );
                                if (newSub) {
                                  await onPatchSub(newSub.id, {
                                    company: company.name,
                                    company_id: company.id,
                                    contact_name: company.contact_name ?? null,
                                    email: company.contact_email ?? null,
                                    cell: company.contact_phone ?? null,
                                  });
                                }
                                setSuggestionsCache((prev) => ({
                                  ...prev,
                                  [div.code]: (prev[div.code] ?? []).filter(
                                    (c) => c.id !== company.id,
                                  ),
                                }));
                              }}
                            >
                              + Add
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="divide-y divide-border/20">
                  {displayRows.map((sub, idx) => {
                    const isDraft = "isDraft" in sub;
                    const pursuitStatus = isDraft
                      ? {
                          label: "Needs bidder",
                          tone: "muted" as const,
                          nextAction: "Select a company",
                          key: "empty" as const,
                        }
                      : getSubPursuitStatus(sub);
                    const scopeCoverage = isDraft
                      ? null
                      : getSubScopeCoverage(sub);
                    return (
                      <div
                        key={sub.id}
                        ref={(node) => {
                          subRowRefs.current[sub.id] = node;
                        }}
                        className={`bg-background ${
                          focusedSubId === sub.id
                            ? "ring-1 ring-inset ring-primary/30"
                            : sub.is_awarded
                              ? "bg-status-warning/5"
                              : ""
                        }`}
                      >
                        <div className="flex flex-col gap-4 p-4 xl:flex-row xl:items-start">
                          <div className="min-w-0 flex-1 space-y-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="mb-1 flex items-center gap-2">
                                  <Checkbox
                                    checked={selectedSubIds.has(sub.id)}
                                    onCheckedChange={(checked) =>
                                      toggleSelectedSub(
                                        sub.id,
                                        Boolean(checked),
                                      )
                                    }
                                    aria-label={`Select ${sub.company ?? "sublist row"}`}
                                    className="h-4 w-4"
                                  />
                                  <span className="font-mono text-[10px] text-muted-foreground">
                                    #{sub.position ?? idx + 1}
                                  </span>
                                  <span
                                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                      pursuitStatus.tone === "success"
                                        ? "bg-status-success/10 text-status-success"
                                        : pursuitStatus.tone === "destructive"
                                          ? "bg-destructive/10 text-destructive"
                                          : pursuitStatus.tone === "warning"
                                            ? "bg-status-warning/10 text-status-warning"
                                            : "bg-muted text-muted-foreground"
                                    }`}
                                  >
                                    {pursuitStatus.label}
                                  </span>
                                </div>
                                <div className="relative">
                                  {openComboboxId === sub.id ? (
                                    <div
                                      className="absolute left-0 top-0 z-50 w-72 rounded-md border border-border bg-popover"
                                      data-sublist-company-picker-id={sub.id}
                                      onBlur={(event) => {
                                        const nextTarget =
                                          event.relatedTarget as HTMLElement | null;
                                        if (
                                          nextTarget?.closest(
                                            `[data-sublist-company-picker-id="${sub.id}"]`,
                                          )
                                        )
                                          return;
                                        setOpenComboboxId((prev) =>
                                          prev === sub.id ? null : prev,
                                        );
                                      }}
                                    >
                                      <div className="border-b border-border p-2">
                                        <Input
                                          autoFocus
                                          placeholder="Search company..."
                                          value={companySearch}
                                          onChange={(e) =>
                                            setCompanySearch(e.target.value)
                                          }
                                          className="h-7 text-xs"
                                          onKeyDown={(e) => {
                                            if (e.key === "Escape") {
                                              setOpenComboboxId(null);
                                              setCompanySearch("");
                                              return;
                                            }
                                            if (e.key === "Enter") {
                                              e.preventDefault();
                                              const trimmed =
                                                companySearch.trim();
                                              if (!trimmed) return;
                                              if (exactCompanyMatch) {
                                                void selectCompany(
                                                  sub,
                                                  exactCompanyMatch,
                                                );
                                                return;
                                              }
                                              void commitManualCompany(
                                                sub,
                                                trimmed,
                                              );
                                            }
                                          }}
                                        />
                                      </div>
                                      <div className="max-h-48 overflow-y-auto">
                                        {companySearch.trim() &&
                                        !exactCompanyMatch ? (
                                          <Button
                                            variant="ghost"
                                            type="button"
                                            className="flex h-auto w-full flex-col items-start gap-0.5 rounded-none border-b border-border px-3 py-2 text-left text-xs"
                                            onClick={() =>
                                              void commitManualCompany(
                                                sub,
                                                companySearch,
                                              )
                                            }
                                          >
                                            <span className="font-medium text-foreground">
                                              Use "{companySearch.trim()}"
                                            </span>
                                            <span className="text-[10px] text-muted-foreground">
                                              Save as a manual bidder name
                                              without linking a directory
                                              company.
                                            </span>
                                          </Button>
                                        ) : null}
                                        {filteredCompanies.length === 0 ? (
                                          <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                                            No companies found
                                          </p>
                                        ) : (
                                          filteredCompanies.map((c) => {
                                            const isTradeMatch =
                                              companyMatchesDivision(
                                                c,
                                                sub.division_code,
                                              );
                                            return (
                                              <Button
                                                key={c.id}
                                                variant="ghost"
                                                type="button"
                                                className="flex h-auto w-full flex-col items-start gap-0.5 rounded-none px-3 py-1.5 text-xs"
                                                onClick={() =>
                                                  void selectCompany(sub, c)
                                                }
                                              >
                                                <span className="flex w-full items-center gap-1.5">
                                                  <span className="font-medium text-foreground">
                                                    {c.name}
                                                  </span>
                                                  {isTradeMatch && (
                                                    <span className="rounded bg-primary/10 px-1 py-0.5 text-[9px] font-medium text-primary">
                                                      Trade
                                                    </span>
                                                  )}
                                                </span>
                                                {(c.type ?? c.vendor_class) && (
                                                  <span className="text-[10px] text-muted-foreground">
                                                    {c.type ?? c.vendor_class}
                                                  </span>
                                                )}
                                              </Button>
                                            );
                                          })
                                        )}
                                      </div>
                                    </div>
                                  ) : null}
                                  <InlineText
                                    value={sub.company ?? ""}
                                    onChange={(v) =>
                                      void commitManualCompany(sub, v)
                                    }
                                    placeholder="Company name"
                                    className="h-9 px-0 text-base font-medium"
                                    onFocus={() => {
                                      setOpenComboboxId(sub.id);
                                      setOpenComboboxDivision(
                                        sub.division_code,
                                      );
                                      setCompanySearch(sub.company ?? "");
                                      if (
                                        !isDraft &&
                                        sub.company_id &&
                                        !bidHistoryCache[sub.company_id]
                                      )
                                        void loadBidHistory(sub.company_id);
                                    }}
                                    onBlur={(event) => {
                                      const nextTarget =
                                        event.relatedTarget as HTMLElement | null;
                                      if (
                                        nextTarget?.closest(
                                          `[data-sublist-company-picker-id="${sub.id}"]`,
                                        )
                                      )
                                        return;
                                      setTimeout(
                                        () =>
                                          setOpenComboboxId((prev) =>
                                            prev === sub.id ? null : prev,
                                          ),
                                        150,
                                      );
                                    }}
                                  />
                                  {!isDraft &&
                                    sub.company_id &&
                                    (() => {
                                      const history =
                                        bidHistoryCache[sub.company_id];
                                      if (!history || history.total_bids === 0)
                                        return null;
                                      return (
                                        <span
                                          className="mt-1 block text-[10px] text-muted-foreground"
                                          title={`${history.total_bids} bid${history.total_bids !== 1 ? "s" : ""} — ${history.win_rate}% win rate${history.avg_price ? ` — avg ${formatCurrencyFull(history.avg_price)}` : ""}`}
                                        >
                                          {history.total_bids} bid
                                          {history.total_bids !== 1
                                            ? "s"
                                            : ""}{" "}
                                          · {history.win_rate}% wins
                                        </span>
                                      );
                                    })()}
                                </div>
                              </div>

                              <div className="space-y-2 lg:w-56">
                                <div className="text-xs text-muted-foreground">
                                  {pursuitStatus.nextAction}
                                </div>
                                {scopeCoverage && (
                                  <div className="text-xs text-muted-foreground">
                                    Scope coverage {scopeCoverage.coveredCount}/
                                    {scopeCoverage.requiredCount}
                                  </div>
                                )}
                                {!isDraft && getPrimaryActionLabel(sub) ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    type="button"
                                    className="h-8 px-3 text-xs"
                                    onClick={() => void runPrimaryAction(sub)}
                                  >
                                    {getPrimaryActionLabel(sub)}
                                  </Button>
                                ) : null}
                              </div>
                            </div>

                            <div
                              className={`grid gap-3 ${visibleFieldCount >= 3 ? "md:grid-cols-2 xl:grid-cols-3" : visibleFieldCount === 2 ? "md:grid-cols-2" : "grid-cols-1"}`}
                            >
                              {showColumn("contact") && (
                                <div className="space-y-1">
                                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                    Contact
                                  </div>
                                  <InlineText
                                    value={sub.contact_name ?? ""}
                                    onChange={(v) =>
                                      isDraft
                                        ? void persistDraftSub(sub, {
                                            contact_name: v || null,
                                          })
                                        : void onPatchSub(sub.id, {
                                            contact_name: v || null,
                                          })
                                    }
                                    placeholder="Name"
                                  />
                                </div>
                              )}
                              {showColumn("email") && (
                                <div className="space-y-1">
                                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                    Email
                                  </div>
                                  <InlineText
                                    value={sub.email ?? ""}
                                    onChange={(v) =>
                                      isDraft
                                        ? void persistDraftSub(sub, {
                                            email: v || null,
                                          })
                                        : void onPatchSub(sub.id, {
                                            email: v || null,
                                          })
                                    }
                                    placeholder="email@..."
                                  />
                                </div>
                              )}
                              {showColumn("phone") && (
                                <div className="space-y-1">
                                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                    Phone
                                  </div>
                                  <InlineText
                                    value={sub.cell ?? ""}
                                    onChange={(v) =>
                                      isDraft
                                        ? void persistDraftSub(sub, {
                                            cell: v || null,
                                          })
                                        : void onPatchSub(sub.id, {
                                            cell: v || null,
                                          })
                                    }
                                    placeholder="Phone"
                                  />
                                </div>
                              )}
                              {showColumn("intend") && (
                                <div className="space-y-1">
                                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                    Intent to submit
                                  </div>
                                  <InlineSelect
                                    value={sub.intend_to_submit ?? ""}
                                    options={INTEND_OPTIONS}
                                    onValueChange={(v) =>
                                      isDraft
                                        ? void persistDraftSub(sub, {
                                            intend_to_submit: v || null,
                                          })
                                        : void onPatchSub(sub.id, {
                                            intend_to_submit: v || null,
                                          })
                                    }
                                    placeholder="—"
                                  />
                                </div>
                              )}
                              {showColumn("bid") && (
                                <div className="space-y-1">
                                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                    Bid received
                                  </div>
                                  <InlineSelect
                                    value={sub.bid_received ?? ""}
                                    options={BID_OPTIONS}
                                    onValueChange={(v) =>
                                      isDraft
                                        ? void persistDraftSub(sub, {
                                            bid_received: v || null,
                                          })
                                        : void onPatchSub(sub.id, {
                                            bid_received: v || null,
                                          })
                                    }
                                    placeholder="—"
                                  />
                                </div>
                              )}
                              {showColumn("outreach") && (
                                <div className="space-y-1">
                                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                    Outreach
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    {isDraft ? (
                                      <span className="text-xs text-muted-foreground/50">
                                        Save a bidder first
                                      </span>
                                    ) : sub.email_sent === "Yes" ? (
                                      <span className="flex items-center gap-1 text-xs text-status-success">
                                        <Mail className="h-3 w-3" /> Invite sent
                                      </span>
                                    ) : sub.email ? (
                                      <Button
                                        variant="ghost"
                                        type="button"
                                        size="sm"
                                        className="h-7 gap-1 px-2 text-xs text-primary hover:text-primary"
                                        onClick={() =>
                                          setBidInviteSubId(sub.id)
                                        }
                                      >
                                        <Mail className="h-3 w-3" /> Send invite
                                      </Button>
                                    ) : (
                                      <span className="text-xs text-muted-foreground/50">
                                        No email
                                      </span>
                                    )}
                                    <div className="relative">
                                      <Button
                                        variant="ghost"
                                        type="button"
                                        size="sm"
                                        className="h-7 px-2 text-xs"
                                        onClick={() =>
                                          !isDraft && openCallLog(sub.id)
                                        }
                                        disabled={isDraft}
                                      >
                                        {sub.phone_follow_up === "Yes"
                                          ? "Reached"
                                          : sub.phone_follow_up
                                            ? "No contact"
                                            : "Log call"}
                                      </Button>
                                      {!isDraft &&
                                        openCallLogSubId === sub.id && (
                                          <div
                                            className="absolute left-0 top-8 z-50 w-72 rounded-md border border-border bg-popover p-3"
                                            onMouseDown={(e) =>
                                              e.stopPropagation()
                                            }
                                          >
                                            <div className="mb-2 flex items-center justify-between">
                                              <span className="text-xs font-medium">
                                                Log phone call
                                              </span>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                type="button"
                                                className="h-5 w-5"
                                                onClick={() =>
                                                  setOpenCallLogSubId(null)
                                                }
                                              >
                                                <X className="h-3 w-3" />
                                              </Button>
                                            </div>
                                            <div className="mb-2 grid grid-cols-2 gap-1">
                                              {(
                                                [
                                                  "Reached",
                                                  "Voicemail",
                                                  "No Answer",
                                                  "Declined",
                                                ] as const
                                              ).map((outcome) => (
                                                <Button
                                                  key={outcome}
                                                  variant={
                                                    callLogOutcome === outcome
                                                      ? "default"
                                                      : "outline"
                                                  }
                                                  type="button"
                                                  size="sm"
                                                  className="h-7 text-xs"
                                                  onClick={() =>
                                                    setCallLogOutcome(outcome)
                                                  }
                                                >
                                                  {outcome}
                                                </Button>
                                              ))}
                                            </div>
                                            <Input
                                              placeholder="Notes (optional)"
                                              value={callLogNotes}
                                              onChange={(e) =>
                                                setCallLogNotes(e.target.value)
                                              }
                                              className="mb-2 h-7 text-xs"
                                            />
                                            <Button
                                              type="button"
                                              size="sm"
                                              className="h-7 w-full text-xs"
                                              disabled={
                                                !callLogOutcome ||
                                                callLogSubmitting
                                              }
                                              onClick={() =>
                                                void submitCallLog(sub.id)
                                              }
                                            >
                                              {callLogSubmitting
                                                ? "Saving…"
                                                : "Log call"}
                                            </Button>
                                            {(callLogsBySubId[sub.id] ?? [])
                                              .length > 0 && (
                                              <div className="mt-3 border-t border-border pt-2">
                                                <p className="mb-1 text-[10px] font-medium uppercase text-muted-foreground">
                                                  History
                                                </p>
                                                <div className="max-h-32 space-y-1 overflow-y-auto">
                                                  {(
                                                    callLogsBySubId[sub.id] ??
                                                    []
                                                  ).map((log) => (
                                                    <div
                                                      key={log.id}
                                                      className="text-[10px] text-muted-foreground"
                                                    >
                                                      <span className="font-medium text-foreground">
                                                        {log.outcome}
                                                      </span>
                                                      {" — "}
                                                      {new Date(
                                                        log.called_at,
                                                      ).toLocaleDateString()}
                                                      {log.notes && (
                                                        <span className="block pl-2 text-muted-foreground">
                                                          {log.notes}
                                                        </span>
                                                      )}
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {showColumn("comments") && (
                              <div className="space-y-1">
                                <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                  Comments
                                </div>
                                <InlineText
                                  value={sub.comments ?? ""}
                                  onChange={(v) =>
                                    isDraft
                                      ? void persistDraftSub(sub, {
                                          comments: v || null,
                                        })
                                      : void onPatchSub(sub.id, {
                                          comments: v || null,
                                        })
                                  }
                                  placeholder="Comments"
                                />
                              </div>
                            )}
                          </div>

                          <div className="w-full border-t border-border pt-4 xl:w-64 xl:border-l xl:border-t-0 xl:pl-4 xl:pt-0">
                            <div className="space-y-3">
                              <div className="space-y-1">
                                <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                  Bid price
                                </div>
                                <div className="flex items-center gap-1">
                                  <InlineNumber
                                    value={sub.price ?? 0}
                                    onChange={(v) =>
                                      isDraft
                                        ? void persistDraftSub(sub, {
                                            price: v || null,
                                          })
                                        : void onPatchSub(sub.id, {
                                            price: v || null,
                                          })
                                    }
                                    className="flex-1 text-right"
                                    currency
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    type="button"
                                    className="h-7 w-7 shrink-0 text-muted-foreground/40 hover:text-primary"
                                    title="Detail bid"
                                    onClick={() =>
                                      !isDraft && toggleBidExpand(sub.id)
                                    }
                                    disabled={isDraft}
                                  >
                                    {expandedBidSubIds.has(sub.id) ? (
                                      <ChevronDown className="h-3.5 w-3.5" />
                                    ) : (
                                      <ChevronRight className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                              <div className="flex items-center justify-end gap-1">
                                {isDraft ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    type="button"
                                    className="h-7 w-7 text-muted-foreground/40 hover:text-destructive"
                                    title="Remove blank row"
                                    onClick={() => removeDraftSub(sub.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                ) : (
                                  <>
                                    {sub.is_awarded &&
                                      sub.price &&
                                      sub.price > 0 && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          type="button"
                                          className="h-7 gap-1 px-2 text-[10px] text-muted-foreground hover:text-primary"
                                          title="Flow this bid into the estimate detail"
                                          onClick={() => {
                                            void (async () => {
                                              try {
                                                await apiFetch(
                                                  `/api/projects/${projectId}/estimates/${estimateId}/sublist/${sub.id}/use-bid`,
                                                  { method: "POST" },
                                                );
                                                toast.success(
                                                  "Bid flowed into estimate",
                                                );
                                              } catch (err) {
                                                showEstimateError(
                                                  "Use bid failed",
                                                  err,
                                                  `estimate-use-bid-${sub.id}`,
                                                );
                                              }
                                            })();
                                          }}
                                        >
                                          Use bid
                                        </Button>
                                      )}
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      type="button"
                                      className={`h-7 w-7 ${sub.is_awarded ? "text-status-warning hover:text-status-warning/80" : "text-muted-foreground/30 hover:text-status-warning"}`}
                                      title={
                                        sub.is_awarded
                                          ? "Revoke award"
                                          : "Award this sub"
                                      }
                                      onClick={() =>
                                        void onAwardSub(sub.id, sub.is_awarded)
                                      }
                                    >
                                      <CheckCircle2 className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      type="button"
                                      className="h-7 w-7 text-muted-foreground/40 hover:text-destructive"
                                      title="Delete sub"
                                      aria-label={`Delete ${sub.company || "sub"} from sublist`}
                                      onClick={() => void deleteSub(sub)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {!isDraft && expandedBidSubIds.has(sub.id) && (
                          <div className="border-t border-border bg-muted/10 px-4 py-4">
                            <div className="max-w-3xl">
                              <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                Bid Line Items — {sub.company ?? "Sub"}
                              </p>
                              {(() => {
                                const divisionScopeItems =
                                  scopeItemsByDiv[sub.division_code] ?? [];
                                const uncoveredScopeItems =
                                  getUncoveredScopeItems(sub);
                                const firstUnmappedIncludedBidItem = (
                                  bidItemsBySubId[sub.id] ?? []
                                ).find(
                                  (item) =>
                                    !item.is_excluded && !item.scope_item_id,
                                );
                                const scopeLabelById = new Map(
                                  divisionScopeItems.map((item) => [
                                    item.id,
                                    item.description,
                                  ]),
                                );
                                return (
                                  <>
                                    {uncoveredScopeItems.length > 0 && (
                                      <div className="mb-2 rounded-md border border-status-warning/30 bg-status-warning/5 px-3 py-2">
                                        <div className="text-[10px] font-medium uppercase tracking-wide text-status-warning">
                                          Scope gaps
                                        </div>
                                        <div className="mt-1 text-xs text-foreground">
                                          {uncoveredScopeItems.length} required
                                          scope item
                                          {uncoveredScopeItems.length !== 1
                                            ? "s are"
                                            : " is"}{" "}
                                          still uncovered for this bidder.
                                        </div>
                                        <div className="mt-1 text-[10px] text-muted-foreground">
                                          {uncoveredScopeItems
                                            .slice(0, 3)
                                            .map((item) => item.description)
                                            .join(" • ")}
                                          {uncoveredScopeItems.length > 3
                                            ? ` • +${uncoveredScopeItems.length - 3} more`
                                            : ""}
                                        </div>
                                        <div className="mt-1 text-[10px] text-muted-foreground">
                                          {firstUnmappedIncludedBidItem
                                            ? "Start by mapping the first unmapped bid line item below."
                                            : "Add a bid line item and map it to one of the uncovered scope items below."}
                                        </div>
                                      </div>
                                    )}
                                    <div className="mb-2 space-y-1">
                                      {(bidItemsBySubId[sub.id] ?? [])
                                        .length === 0 ? (
                                        <p className="text-xs text-muted-foreground">
                                          No line items. Add items below or
                                          enter lump sum in the price field.
                                        </p>
                                      ) : (
                                        (bidItemsBySubId[sub.id] ?? []).map(
                                          (item) => (
                                            <div
                                              key={item.id}
                                              className="group flex items-center gap-2"
                                            >
                                              <Checkbox
                                                checked={!item.is_excluded}
                                                onCheckedChange={(v) =>
                                                  void patchBidItem(
                                                    sub.id,
                                                    item.id,
                                                    { is_excluded: !v },
                                                  )
                                                }
                                                className="h-3.5 w-3.5 shrink-0"
                                                title={
                                                  item.is_excluded
                                                    ? "Excluded from total"
                                                    : "Included"
                                                }
                                              />
                                              <div className="min-w-0 flex-1">
                                                <span
                                                  className={`block truncate text-xs ${item.is_excluded ? "text-muted-foreground line-through" : "text-foreground"}`}
                                                >
                                                  {item.description}
                                                </span>
                                                {item.scope_item_id && (
                                                  <span className="block truncate text-[10px] text-muted-foreground">
                                                    Scope:{" "}
                                                    {scopeLabelById.get(
                                                      item.scope_item_id,
                                                    ) ??
                                                      `Item ${item.scope_item_id}`}
                                                  </span>
                                                )}
                                              </div>
                                              {divisionScopeItems.length >
                                                0 && (
                                                <Select
                                                  value={
                                                    item.scope_item_id
                                                      ? String(
                                                          item.scope_item_id,
                                                        )
                                                      : "none"
                                                  }
                                                  onValueChange={(value) =>
                                                    void patchBidItem(
                                                      sub.id,
                                                      item.id,
                                                      {
                                                        scope_item_id:
                                                          value === "none"
                                                            ? null
                                                            : Number(value),
                                                      },
                                                    )
                                                  }
                                                >
                                                  <SelectTrigger
                                                    className="h-7 w-44 shrink-0 text-xs"
                                                    data-scope-map-select={
                                                      !item.scope_item_id &&
                                                      !item.is_excluded
                                                        ? String(sub.id)
                                                        : undefined
                                                    }
                                                  >
                                                    <SelectValue placeholder="Scope" />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    <SelectItem
                                                      value="none"
                                                      className="text-xs"
                                                    >
                                                      No scope mapping
                                                    </SelectItem>
                                                    {divisionScopeItems.map(
                                                      (scopeItem) => (
                                                        <SelectItem
                                                          key={scopeItem.id}
                                                          value={String(
                                                            scopeItem.id,
                                                          )}
                                                          className="text-xs"
                                                        >
                                                          {
                                                            scopeItem.description
                                                          }
                                                        </SelectItem>
                                                      ),
                                                    )}
                                                  </SelectContent>
                                                </Select>
                                              )}
                                              <span
                                                className={`w-24 shrink-0 text-right text-xs ${item.is_excluded ? "text-muted-foreground line-through" : "font-medium text-foreground"}`}
                                              >
                                                {formatCurrencyFull(
                                                  Number(item.amount),
                                                )}
                                              </span>
                                              <Button
                                                variant="ghost"
                                                type="button"
                                                size="icon"
                                                className="h-4 w-4 shrink-0 opacity-0 group-hover:opacity-100"
                                                onClick={() =>
                                                  void deleteBidItem(
                                                    sub.id,
                                                    item.id,
                                                  )
                                                }
                                              >
                                                <X className="h-2.5 w-2.5" />
                                              </Button>
                                            </div>
                                          ),
                                        )
                                      )}
                                      {(bidItemsBySubId[sub.id] ?? []).length >
                                        0 && (
                                        <div className="border-t border-border/40 pt-1 text-right text-xs font-semibold text-foreground">
                                          Total:{" "}
                                          {formatCurrencyFull(
                                            (bidItemsBySubId[sub.id] ?? [])
                                              .filter((b) => !b.is_excluded)
                                              .reduce(
                                                (s, b) => s + Number(b.amount),
                                                0,
                                              ),
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    <div className="grid gap-1.5 md:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)_6rem_auto]">
                                      <Input
                                        placeholder="Description"
                                        value={newBidDesc[sub.id] ?? ""}
                                        onChange={(e) =>
                                          setNewBidDesc((prev) => ({
                                            ...prev,
                                            [sub.id]: e.target.value,
                                          }))
                                        }
                                        className="h-7 flex-1 text-xs"
                                        data-bid-item-desc-input={sub.id}
                                      />
                                      <Select
                                        value={
                                          newBidScopeItemId[sub.id] ?? "none"
                                        }
                                        onValueChange={(value) =>
                                          setNewBidScopeItemId((prev) => ({
                                            ...prev,
                                            [sub.id]:
                                              value === "none" ? "" : value,
                                          }))
                                        }
                                      >
                                        <SelectTrigger className="h-7 text-xs">
                                          <SelectValue placeholder="Map to scope" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem
                                            value="none"
                                            className="text-xs"
                                          >
                                            No scope mapping
                                          </SelectItem>
                                          {divisionScopeItems.map(
                                            (scopeItem) => (
                                              <SelectItem
                                                key={scopeItem.id}
                                                value={String(scopeItem.id)}
                                                className="text-xs"
                                              >
                                                {scopeItem.description}
                                              </SelectItem>
                                            ),
                                          )}
                                        </SelectContent>
                                      </Select>
                                      <Input
                                        placeholder="$0"
                                        type="number"
                                        value={newBidAmount[sub.id] ?? ""}
                                        onChange={(e) =>
                                          setNewBidAmount((prev) => ({
                                            ...prev,
                                            [sub.id]: e.target.value,
                                          }))
                                        }
                                        className="h-7 w-24 text-right text-xs"
                                      />
                                      <Button
                                        type="button"
                                        size="sm"
                                        className="h-7 px-2 text-xs"
                                        onClick={() => void addBidItem(sub.id)}
                                      >
                                        Add
                                      </Button>
                                    </div>
                                    {divisionScopeItems.length === 0 && (
                                      <p className="mt-1 text-[10px] text-muted-foreground">
                                        Open Scope and seed or add items to
                                        enable bid leveling by scope.
                                      </p>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {visibleDivisions.length === 0 && (
            <div className="py-12 text-center">
              <div className="space-y-2">
                <div className="text-sm font-medium text-foreground">
                  No subs match the current filters
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-muted-foreground"
                  onClick={() => {
                    setSearchQuery("");
                    setFilterIntend("all");
                    setFilterBid("all");
                    setFilterPursuit("all");
                    setSortConfig(null);
                  }}
                >
                  Clear filters
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Bid Comparison Summary (PRP 3.3) ─────────────────────────────── */}
      {(() => {
        const divsWithBids = ALL_DIVISIONS.filter((div) => {
          const rows = sublistSubs.filter(
            (s) => s.division_code === div.code && s.price && s.price > 0,
          );
          return rows.length > 0;
        });
        if (divsWithBids.length === 0) return null;

        return (
          <div className="overflow-hidden rounded-md border border-border">
            <div className="border-b border-border bg-muted/30 px-4 py-2">
              <span className="text-xs font-semibold text-foreground">
                Bid Comparison
              </span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50 text-left text-muted-foreground">
                  <th className="py-2 pl-4 font-medium">Division</th>
                  <th className="px-3 py-2 text-right font-medium">
                    Est. Budget
                  </th>
                  <th className="px-3 py-2 text-right font-medium">Bids</th>
                  <th className="px-3 py-2 font-medium">Scope</th>
                  <th className="px-3 py-2 text-right font-medium">Low Bid</th>
                  <th className="px-3 py-2 text-right font-medium">Avg Bid</th>
                  <th className="px-3 py-2 text-right font-medium">Δ Budget</th>
                  <th className="px-3 py-2 font-medium">Awarded</th>
                </tr>
              </thead>
              <tbody>
                {divsWithBids.map((div) => {
                  const rows = sublistSubs.filter(
                    (s) =>
                      s.division_code === div.code && s.price && s.price > 0,
                  );
                  const budget = detailTotalsByDiv[div.code] ?? 0;
                  const prices = rows.map((r) => r.price!);
                  const low = Math.min(...prices);
                  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
                  const delta = budget > 0 ? low - budget : null;
                  const awarded = sublistSubs.find(
                    (s) => s.division_code === div.code && s.is_awarded,
                  );
                  const requiredScopeCount = (
                    scopeItemsByDiv[div.code] ?? []
                  ).filter((item) => item.is_checked).length;
                  const gapCount = rows.filter(
                    (row) => getSubPursuitStatus(row).key === "bid_received",
                  ).length;
                  const readyCount = rows.filter(
                    (row) => getSubPursuitStatus(row).key === "ready_to_award",
                  ).length;
                  const bestCoverage = rows.reduce((best, row) => {
                    const coverage = getSubScopeCoverage(row);
                    return coverage ? Math.max(best, coverage.percent) : best;
                  }, 0);
                  return (
                    <tr
                      key={div.code}
                      className="border-b border-border/20 hover:bg-muted/20"
                    >
                      <td className="py-2 pl-4 font-medium text-foreground">
                        {div.code} – {div.name}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {budget > 0 ? formatCurrencyFull(budget) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {rows.length}
                      </td>
                      <td className="px-3 py-2 text-[10px] text-muted-foreground">
                        {requiredScopeCount > 0 ? (
                          <span className="inline-flex flex-col">
                            <span>
                              {readyCount} ready · {gapCount} gaps
                            </span>
                            <span>
                              Best {bestCoverage}% of {requiredScopeCount}
                            </span>
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium text-foreground">
                        {formatCurrencyFull(low)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {formatCurrencyFull(avg)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right tabular-nums font-medium ${delta === null ? "text-muted-foreground" : delta <= 0 ? "text-status-success" : "text-destructive"}`}
                      >
                        {delta === null
                          ? "—"
                          : `${delta > 0 ? "+" : ""}${formatCurrencyFull(delta)}`}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {awarded ? (
                          <span className="font-medium text-status-warning">
                            ★ {awarded.company ?? "—"}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* ── Bid Leveling View (PRP 3.2) ───────────────────────────────────── */}
      {(() => {
        // Only show for divisions that have scope items loaded AND at least 2 subs with bid items
        const levelableDivs = ALL_DIVISIONS.filter((div) => {
          const scopeItems = scopeItemsByDiv[div.code] ?? [];
          const subsWithBids = sublistSubs.filter(
            (s) =>
              s.division_code === div.code &&
              (bidItemsBySubId[s.id] ?? []).length > 0,
          );
          return scopeItems.length > 0 && subsWithBids.length >= 1;
        });
        if (levelableDivs.length === 0) return null;

        return (
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">
                Bid Leveling
              </span>
              <span className="text-[10px] text-muted-foreground">
                (open scope + bid items to populate)
              </span>
            </div>
            {levelableDivs.map((div) => {
              const scopeItems = scopeItemsByDiv[div.code] ?? [];
              const divSubs = sublistSubs.filter(
                (s) =>
                  s.division_code === div.code &&
                  (bidItemsBySubId[s.id] ?? []).length > 0,
              );

              return (
                <div
                  key={div.code}
                  className="overflow-hidden rounded-md border border-border"
                >
                  <div className="border-b border-border bg-muted/30 px-4 py-2">
                    <span className="text-xs font-semibold text-foreground">
                      Division {div.code} — {div.name}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/40 bg-muted/10">
                          <th className="min-w-48 px-3 py-2 text-left font-medium text-muted-foreground">
                            Scope Item
                          </th>
                          {divSubs.map((sub) => (
                            <th
                              key={sub.id}
                              className="min-w-28 px-3 py-2 text-right font-medium text-muted-foreground"
                            >
                              {sub.company ?? `Sub ${sub.position ?? sub.id}`}
                              {sub.is_awarded && (
                                <span className="ml-1 text-status-warning">
                                  ★
                                </span>
                              )}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {scopeItems.map((scopeItem) => (
                          <tr
                            key={scopeItem.id}
                            className="border-b border-border/20"
                          >
                            <td
                              className={`px-3 py-1.5 ${!scopeItem.is_checked ? "text-muted-foreground line-through" : "text-foreground"}`}
                            >
                              {scopeItem.description}
                            </td>
                            {divSubs.map((sub) => {
                              const bidItem = (
                                bidItemsBySubId[sub.id] ?? []
                              ).find((b) => b.scope_item_id === scopeItem.id);
                              if (!bidItem)
                                return (
                                  <td
                                    key={sub.id}
                                    className="px-3 py-1.5 text-right text-muted-foreground/50"
                                  >
                                    —
                                  </td>
                                );
                              return (
                                <td
                                  key={sub.id}
                                  className={`px-3 py-1.5 text-right ${bidItem.is_excluded ? "text-muted-foreground line-through" : "font-medium text-foreground"}`}
                                >
                                  {bidItem.is_excluded ? (
                                    <span className="text-[10px]">Excl.</span>
                                  ) : (
                                    formatCurrencyFull(Number(bidItem.amount))
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                        {/* Totals row */}
                        <tr className="border-t border-border/60 bg-muted/20">
                          <td className="px-3 py-2 font-semibold text-foreground">
                            Total
                          </td>
                          {divSubs.map((sub) => {
                            const total = (bidItemsBySubId[sub.id] ?? [])
                              .filter((b) => !b.is_excluded)
                              .reduce((s, b) => s + Number(b.amount), 0);
                            const budget = detailTotalsByDiv[div.code] ?? 0;
                            const delta = budget > 0 ? total - budget : null;
                            return (
                              <td key={sub.id} className="px-3 py-2 text-right">
                                <div className="font-semibold text-foreground">
                                  {formatCurrencyFull(total)}
                                </div>
                                {delta !== null && (
                                  <div
                                    className={`text-[10px] ${delta > 0 ? "text-destructive" : "text-status-success"}`}
                                  >
                                    {delta > 0 ? "+" : ""}
                                    {formatCurrencyFull(delta)} vs budget
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ── Bid Invitation Modal (PRP 2.2) ────────────────────────────────── */}
      <Dialog
        open={bidInviteSubId !== null}
        onOpenChange={(open) => {
          if (!open) setBidInviteSubId(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send Bid Invitation</DialogTitle>
            <DialogDescription>
              {(() => {
                const sub = sublistSubs.find((s) => s.id === bidInviteSubId);
                return sub
                  ? `Draft an Outlook bid invitation to ${sub.company ?? "this sub"} (${sub.email ?? "—"}).`
                  : "Draft a bid invitation email via Outlook.";
              })()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Bid Due Date (optional)
              </Label>
              <Input
                type="date"
                value={bidInviteDueDate}
                onChange={(e) => setBidInviteDueDate(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Additional message (optional)
              </Label>
              <Textarea
                value={bidInviteMessage}
                onChange={(e) => setBidInviteMessage(e.target.value)}
                placeholder="Any special instructions or notes to include..."
                rows={3}
                className="text-sm"
              />
            </div>
            <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
              A draft email will be created in your Outlook inbox. The draft
              includes the project name, division, scope of work items, and due
              date. Review and send from Outlook.
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => setBidInviteSubId(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={bidInviteSending}
              onClick={() => void sendBidInvitation()}
              className="gap-1.5"
            >
              <Mail className="h-3.5 w-3.5" />
              {bidInviteSending ? "Creating draft…" : "Create Outlook Draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary Tab
// ---------------------------------------------------------------------------

const ALLEATO_CONTACTS = [
  {
    name: "Brandon Clymer",
    title: "CEO",
    email: "bclymer@alleatogroup.com",
    phone: "317.760.0088",
  },
  {
    name: "Jesse Dawson",
    title: "Vice President",
    email: "jdawson@alleatogroup.com",
    phone: "502.612.2089",
  },
] as const;

function SummaryTab({
  estimate,
  projectName,
  gcItems,
  detailItems,
  gcTotal,
  detailTotalsByDiv,
  subtotal,
  contingencyAmount,
  insuranceRate,
  feeRate,
  insurance,
  fee,
  grandTotal,
  durationMonths,
  durationWeeks,
  onContingencyBlur,
  onInsuranceRateBlur,
  onFeeRateBlur,
}: {
  estimate: EstimateRow;
  projectName: string;
  gcItems: GcItem[];
  detailItems: DetailItem[];
  gcTotal: number;
  detailTotalsByDiv: Record<string, number>;
  subtotal: number;
  contingencyAmount: number;
  insuranceRate: number;
  feeRate: number;
  insurance: number;
  fee: number;
  grandTotal: number;
  durationMonths: number;
  durationWeeks: number;
  onContingencyBlur: (v: number) => void;
  onInsuranceRateBlur: (v: number) => void;
  onFeeRateBlur: (v: number) => void;
}) {
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const toggle = (code: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  return (
    <div className="space-y-5">
      {/* ── Letterhead ─────────────────────────────────────────────── */}
      <div className="rounded-lg p-5">
        <div className="flex flex-col items-start justify-between gap-6 lg:flex-row">
          {/* Logo + address */}
          <div className="flex items-start gap-4">
            <img
              src="/Alleato-Group-Logo_Dark.png"
              alt="Alleato Group LLC"
              className="h-12 w-auto object-contain"
            />
          </div>

          {/* Contacts */}
          <div className="flex shrink-0 gap-8">
            {ALLEATO_CONTACTS.map((c) => (
              <div key={c.email} className="text-xs">
                <p className="font-semibold text-foreground">{c.name}</p>
                <p className="text-muted-foreground">{c.title}</p>
                <p className="text-muted-foreground">{c.email}</p>
                <p className="text-muted-foreground">{c.phone}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Project info bar */}
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-1 text-xs text-foreground">
          <span>
            <span>Project: </span>
            <span className="font-medium">{projectName}</span>
          </span>
          {estimate.location && (
            <span>
              <span>Location: </span>
              <span className="font-medium">{estimate.location}</span>
            </span>
          )}
          {estimate.estimate_date && (
            <span>
              <span>Date: </span>
              <span className="font-medium">{estimate.estimate_date}</span>
            </span>
          )}
          {estimate.estimator && (
            <span>
              <span>Estimator: </span>
              <span className="font-medium">{estimate.estimator}</span>
            </span>
          )}
          <span>
            <span>Revision: </span>
            <span className="font-medium">R{estimate.revision}</span>
          </span>
        </div>
      </div>

      {/* ── Division breakdown (expandable) ─────────────────────────── */}
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="border-b border-border bg-muted/30 px-4 py-2.5">
          <span className="text-xs font-semibold text-foreground">
            Division Breakdown
          </span>
        </div>
        <table className="w-full text-xs">
          <thead />
          <tbody>
            {/* ── GC – Division 01 ── */}
            {gcTotal > 0 && (
              <>
                <tr
                  className="cursor-pointer border-b border-border/40 hover:bg-muted/20"
                  onClick={() => toggle("01")}
                >
                  <td className="flex items-center gap-1.5 py-2.5 pl-4 pr-2 font-medium text-foreground">
                    {expanded.has("01") ? (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span>01 – General Conditions</span>
                  </td>
                  <td className="py-2.5 pr-4 text-right font-medium tabular-nums text-foreground">
                    {formatCurrencyFull(gcTotal)}
                  </td>
                </tr>
                {expanded.has("01") &&
                  gcItems.map((item) => {
                    const qty = getEffectiveQty(
                      item,
                      durationMonths,
                      durationWeeks,
                    );
                    const rowTotal =
                      qty * (item.rate ?? 0) * (item.allocation ?? 0);
                    return (
                      <tr
                        key={item.id}
                        className="border-b border-border/20 bg-muted/10"
                      >
                        <td className="py-1.5 pl-10 pr-2 text-muted-foreground">
                          <span className="font-mono text-[10px] text-muted-foreground/70">
                            {item.cost_code}
                          </span>
                          <span className="ml-2">{item.description}</span>
                        </td>
                        <td className="py-1.5 pr-4 text-right tabular-nums text-muted-foreground">
                          {rowTotal > 0 ? formatCurrencyFull(rowTotal) : "—"}
                        </td>
                      </tr>
                    );
                  })}
              </>
            )}

            {/* ── Other divisions ── */}
            {ALL_DIVISIONS.map((div) => {
              const total = detailTotalsByDiv[div.code] ?? 0;
              const rows = detailItems.filter(
                (i) => i.division_code === div.code,
              );
              const isOpen = expanded.has(div.code);
              return (
                <React.Fragment key={div.code}>
                  <tr
                    className={`border-b border-border/20 ${total > 0 ? "cursor-pointer hover:bg-muted/20" : ""}`}
                    onClick={() => total > 0 && toggle(div.code)}
                  >
                    <td className="flex items-center gap-1.5 py-2 pl-4 pr-2 text-foreground">
                      {total > 0 ? (
                        isOpen ? (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )
                      ) : (
                        <span className="h-3.5 w-3.5" />
                      )}
                      <span
                        className={total === 0 ? "text-muted-foreground" : ""}
                      >
                        {div.code} – {div.name}
                      </span>
                    </td>
                    <td
                      className={`py-2 pr-4 text-right tabular-nums ${total > 0 ? "font-medium text-foreground" : "text-muted-foreground"}`}
                    >
                      {total > 0 ? formatCurrencyFull(total) : "—"}
                    </td>
                  </tr>
                  {isOpen &&
                    rows.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-border/20 bg-muted/10"
                      >
                        <td className="py-1.5 pl-10 pr-2 text-muted-foreground">
                          {item.cost_code && (
                            <span className="font-mono text-[10px] text-muted-foreground/70 mr-2">
                              {item.cost_code}
                            </span>
                          )}
                          <span>
                            {item.cost_code_name ??
                              item.work_description ??
                              "—"}
                          </span>
                          {item.sub_name && (
                            <span className="ml-2 text-[10px] text-muted-foreground/60">
                              · {item.sub_name}
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 pr-4 text-right tabular-nums text-muted-foreground">
                          {(item.estimated_amount ?? 0) > 0
                            ? formatCurrencyFull(item.estimated_amount ?? 0)
                            : "—"}
                        </td>
                      </tr>
                    ))}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/20">
              <td className="py-2.5 pl-4 text-xs font-semibold text-foreground">
                Subtotal
              </td>
              <td className="py-2.5 pr-4 text-right text-sm font-bold tabular-nums text-foreground">
                {formatCurrencyFull(subtotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Financial rollup ────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="border-b border-border bg-muted/30 px-4 py-2.5">
          <span className="text-xs font-semibold text-foreground">
            Markups &amp; Fees
          </span>
        </div>
        <div className="divide-y divide-border/30">
          <SummaryMarkupLine
            label="Contingency"
            rateValue={null}
            dollarValue={contingencyAmount}
            onDollarChange={onContingencyBlur}
          />
          <SummaryMarkupLine
            label="Insurance"
            rateValue={insuranceRate * 100}
            dollarValue={insurance}
            onRateChange={onInsuranceRateBlur}
            rateSuffix="%"
          />
          <SummaryMarkupLine
            label="Fee"
            rateValue={feeRate * 100}
            dollarValue={fee}
            onRateChange={onFeeRateBlur}
            rateSuffix="%"
          />
          <div className="flex items-center justify-between bg-foreground/5 px-4 py-3">
            <span className="text-sm font-bold text-foreground">
              Grand Total
            </span>
            <span className="text-base font-bold tabular-nums text-primary">
              {formatCurrencyFull(grandTotal)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryMarkupLine({
  label,
  rateValue,
  dollarValue,
  onRateChange,
  onDollarChange,
  rateSuffix,
}: {
  label: string;
  rateValue: number | null;
  dollarValue: number;
  onRateChange?: (v: number) => void;
  onDollarChange?: (v: number) => void;
  rateSuffix?: string;
}) {
  const [localRate, setLocalRate] = React.useState(
    rateValue !== null ? String(rateValue) : "",
  );
  const [localDollar, setLocalDollar] = React.useState(String(dollarValue));

  React.useEffect(() => {
    if (rateValue !== null) setLocalRate(String(rateValue));
  }, [rateValue]);
  React.useEffect(() => {
    setLocalDollar(String(dollarValue));
  }, [dollarValue]);

  const commitRate = () => {
    const parsed = parseFloat(localRate);
    if (!Number.isNaN(parsed) && onRateChange) onRateChange(parsed);
    else setLocalRate(rateValue !== null ? String(rateValue) : "");
  };
  const commitDollar = () => {
    const parsed = parseFloat(localDollar);
    if (!Number.isNaN(parsed) && onDollarChange) onDollarChange(parsed);
    else setLocalDollar(String(dollarValue));
  };

  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3">
        {/* rate input */}
        {rateValue !== null && onRateChange && (
          <div className="flex items-center gap-1">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={localRate}
              onChange={(e) => setLocalRate(e.target.value)}
              onBlur={commitRate}
              onKeyDown={(e) => e.key === "Enter" && commitRate()}
              className="h-6 w-16 text-right text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            {rateSuffix && (
              <span className="text-xs text-muted-foreground">
                {rateSuffix}
              </span>
            )}
          </div>
        )}
        {/* dollar amount */}
        {onDollarChange ? (
          <div className="flex items-center gap-1">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={localDollar}
              onChange={(e) => setLocalDollar(e.target.value)}
              onBlur={commitDollar}
              onKeyDown={(e) => e.key === "Enter" && commitDollar()}
              className="h-6 w-28 text-right text-xs tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>
        ) : (
          <span className="w-28 text-right text-xs tabular-nums text-foreground">
            {formatCurrencyFull(dollarValue)}
          </span>
        )}
      </div>
    </div>
  );
}
