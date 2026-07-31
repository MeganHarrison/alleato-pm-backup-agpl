/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";

import { VeltAuthProvider } from "../VeltAuthProvider";

const mockVeltProvider = jest.fn(
  ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
);
let mockProfile: {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: null;
  isAdmin: boolean;
} | null = null;
let mockIsLoading = true;

jest.mock("next/navigation", () => ({
  usePathname: () => "/67/drawings/viewer/drawing-123",
}));

jest.mock("@veltdev/react", () => ({
  VeltProvider: (props: { children: React.ReactNode }) => mockVeltProvider(props),
}));

jest.mock("@/hooks/use-current-user-profile", () => ({
  useCurrentUserProfile: () => ({ profile: mockProfile, isLoading: mockIsLoading }),
}));

jest.mock("@/lib/performance/runtime-gates", () => ({
  shouldForceCollaborationRuntime: () => true,
}));

jest.mock("@/lib/stores/collaboration-runtime-store", () => ({
  useCollaborationRuntimeStore: () => false,
}));

describe("VeltAuthProvider", () => {
  const originalApiKey = process.env.NEXT_PUBLIC_VELT_API_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_VELT_API_KEY = "test-velt-key";
    mockProfile = null;
    mockIsLoading = true;
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_VELT_API_KEY = originalApiKey;
  });

  it("does not mount Velt anonymously while the authenticated profile is loading", () => {
    render(
      <VeltAuthProvider>
        <div>Drawing viewer</div>
      </VeltAuthProvider>,
    );

    expect(screen.getByText("Drawing viewer")).toBeInTheDocument();
    expect(mockVeltProvider).not.toHaveBeenCalled();
  });

  it("skips Velt without logging an error when no API key is configured", () => {
    delete process.env.NEXT_PUBLIC_VELT_API_KEY;
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    render(
      <VeltAuthProvider>
        <div>Applicant Tracker</div>
      </VeltAuthProvider>,
    );

    expect(screen.getByText("Applicant Tracker")).toBeInTheDocument();
    expect(mockVeltProvider).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it("treats a whitespace-only API key as unconfigured", () => {
    process.env.NEXT_PUBLIC_VELT_API_KEY = "   ";

    render(
      <VeltAuthProvider>
        <div>Applicant Tracker</div>
      </VeltAuthProvider>,
    );

    expect(screen.getByText("Applicant Tracker")).toBeInTheDocument();
    expect(mockVeltProvider).not.toHaveBeenCalled();
  });

  it("mounts Velt once the authenticated profile is available", () => {
    mockIsLoading = false;
    mockProfile = {
      id: "user-123",
      fullName: "Drawing Tester",
      email: "drawing.tester@example.com",
      avatarUrl: null,
      isAdmin: false,
    };

    render(
      <VeltAuthProvider>
        <div>Drawing viewer</div>
      </VeltAuthProvider>,
    );

    expect(mockVeltProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        authProvider: expect.objectContaining({
          user: expect.objectContaining({ userId: "user-123" }),
        }),
      }),
    );
  });
});
