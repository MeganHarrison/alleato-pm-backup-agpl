jest.mock("server-only", () => ({}));

const mockCanAccess = jest.fn();
const mockRequire = jest.fn();

jest.mock("@/lib/app-capabilities", () => ({
  canCurrentUserAccessAppCapability: mockCanAccess,
  requireCurrentUserAppCapability: mockRequire,
}));

import {
  loadCurrentUserExecutiveVisibility,
  requireCurrentUserExecutiveDetail,
} from "../executive-visibility";

describe("executive visibility", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns no view, summary view, or detail view from the two explicit capabilities", async () => {
    mockCanAccess.mockResolvedValueOnce(false);
    await expect(loadCurrentUserExecutiveVisibility()).resolves.toBeNull();

    mockCanAccess.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(loadCurrentUserExecutiveVisibility()).resolves.toBe("summary");

    mockCanAccess.mockResolvedValueOnce(true).mockResolvedValueOnce(true);
    await expect(loadCurrentUserExecutiveVisibility()).resolves.toBe("detail");
  });

  it("requires briefing admission before protected detail access", async () => {
    mockRequire.mockResolvedValue({ user: { id: "executive-1" } });
    await expect(requireCurrentUserExecutiveDetail("executive-test")).resolves.toEqual({ user: { id: "executive-1" } });
    expect(mockRequire).toHaveBeenNthCalledWith(1, "view_executive_briefing", "executive-test", "Executive briefing access required.");
    expect(mockRequire).toHaveBeenNthCalledWith(2, "view_executive_details", "executive-test", expect.stringContaining("summary"));
  });
});
