import { NextRequest } from "next/server";

import { getFmdsFigureEvidenceUrl } from "@/lib/fmds/fmds-figures.server";
import { GET } from "../route";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";

jest.mock("@/lib/fmds/fmds-figures.server", () => ({
  getFmdsFigureEvidenceUrl: jest.fn(),
}));

const getEvidenceUrlMock = getFmdsFigureEvidenceUrl as jest.MockedFunction<
  typeof getFmdsFigureEvidenceUrl
>;

describe("GET /api/fmds/figures/[figureId]/evidence", () => {
  beforeEach(() => jest.clearAllMocks());

  it("redirects to freshly signed evidence for the exact FMDS0834 figure", async () => {
    getEvidenceUrlMock.mockResolvedValue(
      "https://storage.example.com/figure-2-2-1-4-1-1.png?token=test",
    );

    const response = await GET(new NextRequest("http://localhost/api/fmds"), {
      params: Promise.resolve({ figureId: "figure-1" }),
    });

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://storage.example.com/figure-2-2-1-4-1-1.png?token=test",
    );
    expect(getEvidenceUrlMock).toHaveBeenCalledWith("figure-1");
  });

  it("fails loudly when the figure is not part of FMDS0834", async () => {
    getEvidenceUrlMock.mockResolvedValue(null);

    const response = await GET(new NextRequest("http://localhost/api/fmds"), {
      params: Promise.resolve({ figureId: "other-document-figure" }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        success: false,
        error_code: "NOT_FOUND",
        error_message: "FMDS0834 figure evidence not found.",
      }),
    );
  });
});
