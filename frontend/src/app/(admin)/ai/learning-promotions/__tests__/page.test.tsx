/** @jest-environment jsdom */

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

import { requireAppAdminPageAccess } from "@/lib/auth/require-app-admin";
import { serviceDb } from "@/lib/supabase/service-db";
import AiLearningPromotionsPage from "../page";

jest.mock("@/lib/auth/require-app-admin", () => ({
  requireAppAdminPageAccess: jest.fn(),
}));

jest.mock("@/lib/supabase/service-db", () => ({
  serviceDb: {
    from: jest.fn(),
  },
}));

jest.mock("@/components/layout", () => ({
  PageShell: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));

jest.mock("../promotions-client", () => ({
  AiLearningPromotionsClient: () => <div>Learning review queue</div>,
}));

describe("AiLearningPromotionsPage", () => {
  it("uses the database app-admin gate before loading the review queue", async () => {
    const query = {
      select: jest.fn(() => query),
      eq: jest.fn(() => query),
      order: jest.fn(() => query),
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
    };
    jest.mocked(serviceDb.from).mockReturnValue(query as never);

    render(await AiLearningPromotionsPage());

    expect(requireAppAdminPageAccess).toHaveBeenCalledTimes(1);
    expect(serviceDb.from).toHaveBeenCalledWith("ai_learning_promotions");
    expect(screen.getByText("Learning review queue")).toBeInTheDocument();
  });
});
