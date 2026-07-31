/** @jest-environment jsdom */

import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Button } from "@/components/ui/button";
import { DrawingPhotoPreview } from "../DrawingPhotoPreview";

const usePhotoMock = jest.fn();
const useUpdatePhotoMock = jest.fn();

jest.mock("@/hooks/use-photos", () => ({
  usePhoto: (...args: unknown[]) => usePhotoMock(...args),
  useUpdatePhoto: (...args: unknown[]) => useUpdatePhotoMock(...args),
}));

const HoverOpenContext = React.createContext(false);

jest.mock("@/components/ui/hover-card", () => ({
  HoverCard: ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
  }) => (
    <HoverOpenContext.Provider value={open}>
      <div
        data-testid="hover-region"
        onMouseEnter={() => onOpenChange(true)}
        onMouseLeave={() => onOpenChange(false)}
      >
        {children}
      </div>
    </HoverOpenContext.Provider>
  ),
  HoverCardTrigger: ({ children }: { children: React.ReactNode }) => children,
  HoverCardContent: ({ children }: { children: React.ReactNode }) =>
    React.useContext(HoverOpenContext) ? (
      <div role="tooltip">{children}</div>
    ) : null,
}));

jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { role: "heading", "aria-level": 2 }, children),
}));

describe("DrawingPhotoPreview", () => {
  beforeEach(() => {
    useUpdatePhotoMock.mockReturnValue({
      isPending: false,
      mutate: jest.fn((input, options) => options.onSuccess({ title: input.title })),
    });
    usePhotoMock.mockImplementation((_projectId, _photoId, options) => ({
      data: options.enabled
        ? { title: "South entrance", file_url: "https://example.com/photo.jpg" }
        : undefined,
      isLoading: false,
      isError: false,
    }));
  });

  it("loads on hover and removes the temporary preview when hover ends", () => {
    render(
      <DrawingPhotoPreview
        projectId="67"
        photoId="645"
        label="Photo #645"
        trigger={<Button type="button">Photo #645</Button>}
      />,
    );

    expect(usePhotoMock).toHaveBeenLastCalledWith(67, 645, { enabled: false });
    fireEvent.mouseEnter(screen.getByTestId("hover-region"));
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    expect(screen.getByAltText("South entrance")).toBeInTheDocument();
    expect(usePhotoMock).toHaveBeenLastCalledWith(67, 645, { enabled: true });

    fireEvent.mouseLeave(screen.getByTestId("hover-region"));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("opens the photo in a dialog when clicked", () => {
    render(
      <DrawingPhotoPreview
        projectId="67"
        photoId="645"
        label="Photo #645"
        trigger={<Button type="button">Photo #645</Button>}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Photo #645" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "South entrance" }),
    ).toBeInTheDocument();
    expect(screen.getByAltText("South entrance")).toBeInTheDocument();
  });

  it("supports opening the lightbox without a sidebar trigger", () => {
    render(
      <DrawingPhotoPreview
        projectId="67"
        photoId="645"
        label="Photo #645"
        open
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByAltText("South entrance")).toBeInTheDocument();
  });

  it("keeps the photo preview open after a pin click until the image is clicked", () => {
    render(
      <DrawingPhotoPreview
        projectId="67"
        photoId="645"
        label="Photo #645"
        triggerClickOpensDialog={false}
        trigger={<Button type="button">Photo #645</Button>}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Photo #645" }));

    const previewImage = screen.getByRole("tooltip").querySelector("img");
    expect(previewImage).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open South entrance in lightbox" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(previewImage!);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("edits the photo name from the lightbox overlay", () => {
    render(
      <DrawingPhotoPreview
        projectId="67"
        photoId="645"
        label="Photo #645"
        open
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit photo name" }));
    const titleInput = screen.getByRole("textbox", { name: "Photo name" });
    fireEvent.change(titleInput, { target: { value: "Renamed photo" } });
    fireEvent.click(screen.getByRole("button", { name: "Save photo name" }));

    expect(screen.getByRole("heading", { name: "Renamed photo" })).toBeInTheDocument();
  });
});
