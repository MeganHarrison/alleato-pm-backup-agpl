process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";

import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";
import { POST } from "../route";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  getApiRouteUser: jest.fn(),
}));

jest.mock("@/lib/supabase/service-db", () => ({
  serviceDb: { from: jest.fn() },
}));

const createClientMock = createClient as jest.Mock;
const getApiRouteUserMock = getApiRouteUser as jest.Mock;
const serviceDbFromMock = serviceDb.from as jest.Mock;

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/admin/page-tags", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("page-tags POST bulk-assign-tags", () => {
  let upsertMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({ id: "admin-1" });
    createClientMock.mockResolvedValue({
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest
          .fn()
          .mockResolvedValue({ data: { is_admin: true }, error: null }),
      })),
    });

    upsertMock = jest.fn().mockResolvedValue({ error: null });
    serviceDbFromMock.mockImplementation((table: string) => {
      if (table === "app_page_tags") {
        return {
          select: jest.fn().mockReturnThis(),
          in: jest
            .fn()
            .mockResolvedValue({ data: [{ slug: "internal" }], error: null }),
        };
      }
      if (table === "app_page_tag_assignments") {
        return { upsert: upsertMock };
      }
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("adds the tag to every selected route without clearing existing tags", async () => {
    const response = await POST(
      postRequest({
        action: "bulk-assign-tags",
        routes: ["/admin", "/site-map"],
        tagSlugs: ["internal"],
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      routes: ["/admin", "/site-map"],
      tagSlugs: ["internal"],
      assignments: [
        { route: "/admin", tagSlug: "internal" },
        { route: "/site-map", tagSlug: "internal" },
      ],
    });

    // Additive upsert (ignoreDuplicates), never a delete-then-insert replace.
    expect(upsertMock).toHaveBeenCalledWith(
      [
        { route: "/admin", tag_slug: "internal", created_by: "admin-1" },
        { route: "/site-map", tag_slug: "internal", created_by: "admin-1" },
      ],
      { onConflict: "route,tag_slug", ignoreDuplicates: true },
    );
  });

  it("rejects unknown tag slugs instead of creating dangling assignments", async () => {
    const response = await POST(
      postRequest({
        action: "bulk-assign-tags",
        routes: ["/admin"],
        tagSlugs: ["does-not-exist"],
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(400);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("rejects an empty route list", async () => {
    const response = await POST(
      postRequest({ action: "bulk-assign-tags", routes: [], tagSlugs: ["internal"] }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(400);
    expect(upsertMock).not.toHaveBeenCalled();
  });
});
