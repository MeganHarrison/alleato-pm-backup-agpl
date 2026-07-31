import CompanyBrainPage from "../page";
import { CompanyBrainPageContent } from "@/features/company-brain/company-brain-page";
import { loadCompanyBrainOverview } from "@/features/company-brain/company-brain-data";
import { buildCompanyBrainFixture } from "@/features/company-brain/company-brain-fixture";
import { requireBrainUser } from "@/features/brain/brain-data";

jest.mock("@/features/brain/brain-data", () => ({
  requireBrainUser: jest.fn(),
}));

jest.mock("@/features/company-brain/company-brain-data", () => ({
  loadCompanyBrainOverview: jest.fn(),
}));

jest.mock("@/features/company-brain/company-brain-fixture", () => ({
  buildCompanyBrainFixture: jest.fn(),
}));

jest.mock("@/features/company-brain/company-brain-experience", () => ({
  CompanyBrainExperience: () => <div>Company Brain experience</div>,
}));

jest.mock("@/app/(main)/ai-dashboard/workspace-shell", () => ({
  AiDashboardWorkspaceShell: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

jest.mock("@/components/layout", () => ({
  PageShell: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

const requireBrainUserMock = jest.mocked(requireBrainUser);
const loadCompanyBrainOverviewMock = jest.mocked(loadCompanyBrainOverview);
const buildCompanyBrainFixtureMock = jest.mocked(buildCompanyBrainFixture);

describe("Company Brain route authorization order", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * The auth boundary lives in `CompanyBrainPageContent`, not in the route
   * component — the route only returns the element, so React runs the check
   * when it renders the child. Assert on the component that owns the check.
   */
  it("does not serialize fixtures or query overview data before authentication", async () => {
    requireBrainUserMock.mockRejectedValue(new Error("redirect"));

    await expect(
      CompanyBrainPageContent({
        searchParams: Promise.resolve({ fixture: "ready" }),
      }),
    ).rejects.toThrow("redirect");

    expect(requireBrainUserMock).toHaveBeenCalledTimes(1);
    expect(buildCompanyBrainFixtureMock).not.toHaveBeenCalled();
    expect(loadCompanyBrainOverviewMock).not.toHaveBeenCalled();
  });

  /**
   * Guardrail: the route must delegate to the authenticated loader rather than
   * fetching anything itself, or the check above stops covering this entry.
   */
  it("delegates the route to the authenticated shared loader", async () => {
    requireBrainUserMock.mockResolvedValue(undefined as never);

    const element = await CompanyBrainPage({
      searchParams: Promise.resolve({}),
    });

    expect(element.props.children.type).toBe(CompanyBrainPageContent);
    expect(buildCompanyBrainFixtureMock).not.toHaveBeenCalled();
    expect(loadCompanyBrainOverviewMock).not.toHaveBeenCalled();
  });
});
