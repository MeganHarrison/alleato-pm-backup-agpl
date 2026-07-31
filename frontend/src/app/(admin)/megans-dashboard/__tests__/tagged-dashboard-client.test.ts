import type { InventoryRoute } from "@/app/(admin)/site-map/site-map-client";
import type { ReactElement } from "react";
import {
  BRANDONS_DASHBOARD_TAG_SLUG,
  filterRoutesByTag,
  MEGANS_DASHBOARD_TAG_SLUG,
  type PageTagAssignment,
} from "@/lib/page-tags";
import BrandonsDashboardPage from "../../brandons-dashboard/page";
import MegansDashboardPage from "../page";

jest.mock("@/components/layout", () => ({ PageShell: () => null }));
jest.mock("@/lib/route-inventory", () => ({
  readRouteInventory: jest.fn(() => []),
}));
jest.mock("../megans-dashboard-client", () => ({
  __esModule: true,
  default: () => null,
}));

const routes = [
  { route: "/accounting", page: "Accounting" },
  { route: "/daily-brief", page: "Daily Brief" },
  { route: "/site-map", page: "Site Map" },
] as InventoryRoute[];

const assignments: PageTagAssignment[] = [
  { route: "/accounting", tagSlug: BRANDONS_DASHBOARD_TAG_SLUG },
  { route: "/daily-brief", tagSlug: MEGANS_DASHBOARD_TAG_SLUG },
  { route: "/site-map", tagSlug: BRANDONS_DASHBOARD_TAG_SLUG },
];

describe("filterRoutesByTag", () => {
  it("returns only routes assigned to Brandon's dashboard tag", () => {
    expect(
      filterRoutesByTag(routes, assignments, BRANDONS_DASHBOARD_TAG_SLUG).map(
        (route) => route.route,
      ),
    ).toEqual(["/accounting", "/site-map"]);
  });

  it("keeps Megan's dashboard scope independent", () => {
    expect(
      filterRoutesByTag(routes, assignments, MEGANS_DASHBOARD_TAG_SLUG).map(
        (route) => route.route,
      ),
    ).toEqual(["/daily-brief"]);
  });
});

describe("tagged dashboard route wiring", () => {
  function getDashboardProps(page: ReactElement) {
    return (page.props as { children: ReactElement }).children.props as {
      tagSlug: string;
      dashboardTitle: string;
    };
  }

  it("wires Brandon's route to Brandon's tag", () => {
    expect(getDashboardProps(BrandonsDashboardPage())).toMatchObject({
      tagSlug: BRANDONS_DASHBOARD_TAG_SLUG,
      dashboardTitle: "Brandon's Dashboard",
    });
  });

  it("keeps Megan's route explicitly wired to Megan's tag", () => {
    expect(getDashboardProps(MegansDashboardPage())).toMatchObject({
      tagSlug: MEGANS_DASHBOARD_TAG_SLUG,
      dashboardTitle: "Megan's Dashboard",
    });
  });
});
