/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HeaderUserMenu } from "../header-user-menu";

const mockSetTheme = jest.fn();
const mockUseTheme = jest.fn();

jest.mock("next-themes", () => ({
  useTheme: () => mockUseTheme(),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

jest.mock("@/lib/supabase/logout", () => ({
  logout: jest.fn(),
}));

jest.mock("@/lib/navigation-config", () => ({
  adminSettingsTools: [],
  buildToolUrl: jest.fn(),
  filterToolsByPermission: jest.fn(() => []),
}));

const user = {
  email: "megan@example.com",
  user_metadata: { full_name: "Megan Harrison" },
} as never;

function renderMenu() {
  return render(
    <HeaderUserMenu
      user={user}
      projectId={null}
      activeToolName=""
      permissions={{}}
      isAppAdmin={false}
      userType={null}
    />
  );
}

describe("HeaderUserMenu theme action", () => {
  beforeEach(() => {
    mockSetTheme.mockReset();
  });

  it("offers dark theme when light is active and changes the stored theme", async () => {
    mockUseTheme.mockReturnValue({ resolvedTheme: "light", setTheme: mockSetTheme });
    renderMenu();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Open user menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Switch to dark theme" }));

    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("offers light theme when dark is active and changes the stored theme", async () => {
    mockUseTheme.mockReturnValue({ resolvedTheme: "dark", setTheme: mockSetTheme });
    renderMenu();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Open user menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Switch to light theme" }));

    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });
});
