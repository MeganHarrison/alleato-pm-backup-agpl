process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";

import { getApiRouteUser } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";
import { HEAD } from "../route";

jest.mock("@/lib/supabase/server", () => ({
  getApiRouteUser: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
}));

jest.mock("@/lib/supabase/service-db", () => ({
  serviceDb: { from: jest.fn() },
}));

const getApiRouteUserMock = getApiRouteUser as jest.Mock;
const serviceDbFromMock = serviceDb.from as jest.Mock;

function params() {
  return {
    params: Promise.resolve({ projectId: "67", drawingId: "drawing-123" }),
  };
}

describe("drawing PDF proxy HEAD", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" });
    serviceDbFromMock.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          current_revision: {
            file_url: "https://storage.example.com/drawing.pdf",
            file_size: 19_175_463,
            file_type: "application/pdf",
          },
        },
        error: null,
      }),
    });
  });

  it("returns PDF metadata without downloading the upstream document", async () => {
    const upstreamFetch = jest.spyOn(global, "fetch");

    const response = await HEAD(
      new NextRequest(
        "http://localhost/api/projects/67/drawings/drawing-123/pdf-proxy",
        { method: "HEAD" },
      ),
      params(),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-length")).toBe("19175463");
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(upstreamFetch).not.toHaveBeenCalled();
    upstreamFetch.mockRestore();
  });
});
