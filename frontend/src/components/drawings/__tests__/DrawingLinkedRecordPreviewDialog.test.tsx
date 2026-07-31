/** @jest-environment jsdom */

import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DrawingLinkedRecordPreviewDialog } from "../DrawingLinkedRecordPreviewDialog";

const push = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div role="heading" aria-level={2}>{children}</div>,
}));

describe("DrawingLinkedRecordPreviewDialog", () => {
  it("shows a linked record summary and routes only from its explicit CTA", () => {
    const onOpenChange = jest.fn();
    render(
      <DrawingLinkedRecordPreviewDialog
        projectId="1142"
        onOpenChange={onOpenChange}
        pin={{
          id: "pin-1", drawing_id: "drawing-1", project_id: 1142, x_pct: 40, y_pct: 50, page: 1,
          pin_type: "rfi", entity_id: "rfi-1", entity_number: "#1", entity_label: "Confirm paving scope",
          entity_description: "Please confirm the paving extent at the south entrance.", entity_status: "open",
          color: null, created_by: null, created_at: "2026-07-16T00:00:00.000Z",
        }}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Confirm paving scope" })).toBeInTheDocument();
    expect(screen.getByText("Please confirm the paving extent at the south entrance.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View rfi" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(push).toHaveBeenCalledWith("/1142/rfis/rfi-1");
  });
});
