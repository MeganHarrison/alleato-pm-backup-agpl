/** @jest-environment jsdom */

import { render } from "@testing-library/react";

import { VeltGlobalLayer } from "../VeltGlobalLayer";

const mockVeltComments = jest.fn(() => <div data-testid="velt-comments" />);
const mockVeltCommentsSidebar = jest.fn(() => (
  <div data-testid="velt-comments-sidebar" />
));
const mockRecorderControlPanel = jest.fn(() => (
  <div data-testid="velt-recorder-control-panel" />
));
const mockRecorderNotes = jest.fn(() => (
  <div data-testid="velt-recorder-notes" />
));
const mockRecorderPlayer = jest.fn(() => (
  <div data-testid="velt-recorder-player" />
));
const mockSetDocument = jest.fn();
let mockPathname = "/67/budget";

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

jest.mock("@/lib/api-client", () => ({
  apiFetch: jest.fn(),
}));

jest.mock("@/hooks/use-current-user-profile", () => ({
  useCurrentUserProfile: () => ({ profile: null }),
}));

jest.mock("@/lib/stores/comments-visibility-store", () => ({
  useCommentsVisibilityStore: (selector: (state: { visible: boolean }) => unknown) =>
    selector({ visible: true }),
}));

jest.mock("@/components/velt/annotation-sanitizer", () => ({
  observeMalformedVeltAnnotations: jest.fn(() => () => undefined),
}));

jest.mock("@/components/velt/velt-dialog-polish", () => ({
  observeVeltCommentDialogPolish: jest.fn(() => () => undefined),
}));

jest.mock("@veltdev/react", () => ({
  VeltComments: (props: unknown) => mockVeltComments(props),
  VeltCommentsSidebar: (props: unknown) => mockVeltCommentsSidebar(props),
  VeltRecorderControlPanel: (props: unknown) => mockRecorderControlPanel(props),
  VeltRecorderNotes: (props: unknown) => mockRecorderNotes(props),
  VeltRecorderPlayer: (props: unknown) => mockRecorderPlayer(props),
  useCommentEventCallback: () => null,
  useCommentModeState: () => false,
  useCommentUtils: () => null,
  useSetDocument: (...args: unknown[]) => mockSetDocument(...args),
  useVeltClient: () => ({ client: null }),
}));

describe("VeltGlobalLayer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = "/67/budget";
  });

  it("keeps page comments attachments-only and does not re-enable recorder controls", () => {
    render(<VeltGlobalLayer />);

    expect(mockSetDocument).toHaveBeenCalledWith("site-feedback:/67/budget", {
      documentName: "/67/budget",
    });

    expect(mockVeltComments).toHaveBeenCalledTimes(1);
    const props = mockVeltComments.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(props.screenshot).toBeUndefined();
    expect(props.attachments).toBe(true);
    expect(props.reactions).toBe(false);
    expect(props.recordings).toBeUndefined();
    expect(props.recordingTranscription).toBeUndefined();
    expect(props.recordingCountdown).toBeUndefined();

    expect(mockRecorderControlPanel).not.toHaveBeenCalled();
    expect(mockRecorderNotes).not.toHaveBeenCalled();
    expect(mockRecorderPlayer).not.toHaveBeenCalled();
  });

  it("keeps viewer annotations on the drawing route and leaves its sidebar embedded", () => {
    mockPathname =
      "/1142/drawings/viewer/61ea4d2e-ef30-434a-a210-8cddb10dfa90";

    render(<VeltGlobalLayer />);

    expect(mockSetDocument).toHaveBeenCalledWith(mockPathname, {
      documentName: mockPathname,
    });
    expect(mockVeltComments).toHaveBeenCalledTimes(1);
    expect(mockVeltCommentsSidebar).not.toHaveBeenCalled();
  });

  it("does not leak global page-comment controls onto drawings collection routes", () => {
    mockPathname = "/1142/drawings";

    render(<VeltGlobalLayer />);

    expect(mockSetDocument).toHaveBeenCalledWith("site-feedback:/1142/drawings", {
      documentName: "/1142/drawings",
    });
    expect(mockVeltComments).not.toHaveBeenCalled();
    expect(mockVeltCommentsSidebar).not.toHaveBeenCalled();
  });
});
