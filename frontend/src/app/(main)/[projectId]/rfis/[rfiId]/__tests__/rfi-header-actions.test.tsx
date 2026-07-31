/**
 * @jest-environment jsdom
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { RfiHeaderActions } from "../rfi-header-actions";
import { apiFetch } from "@/lib/api-client";
import { toast } from "sonner";

const push = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => "/876/rfis/fe13bf4e-dbb6-494a-bb50-b8fc821b694e",
  useRouter: () => ({
    push,
    refresh: jest.fn(),
  }),
}));

jest.mock("@/lib/api-client", () => ({
  apiFetch: jest.fn(),
}));

jest.mock("@/hooks/use-rfis", () => ({
  useUpdateRfi: () => ({
    mutateAsync: jest.fn(),
  }),
  useDeleteRfi: () => ({
    mutateAsync: jest.fn(),
  }),
}));

jest.mock("@/lib/report-non-critical-failure", () => ({
  reportNonCriticalFailure: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("@/components/ds", () => {
  const React = require("react");
  const { Button: UIButton } = require("@/components/ui/button");

  return {
    Button: ({
      children,
      onClick,
      disabled,
      type = "button",
    }: {
      children: React.ReactNode;
      onClick?: () => void;
      disabled?: boolean;
      type?: "button" | "submit" | "reset";
    }) => (
      <UIButton type={type} onClick={onClick} disabled={disabled}>
        {children}
      </UIButton>
    ),
    DetailActions: ({
      onEdit,
      onDelete,
    }: {
      onEdit: () => void;
      onDelete: () => void;
    }) => (
      <div>
        <UIButton type="button" onClick={onEdit}>
          Edit
        </UIButton>
        <UIButton type="button" onClick={onDelete}>
          Delete
        </UIButton>
      </div>
    ),
    AlertDialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    AlertDialogAction: ({
      children,
      onClick,
    }: {
      children: React.ReactNode;
      onClick?: () => void;
    }) => (
      <UIButton type="button" onClick={onClick}>
        {children}
      </UIButton>
    ),
    AlertDialogCancel: ({ children }: { children: React.ReactNode }) => (
      <UIButton type="button">{children}</UIButton>
    ),
    AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    AlertDialogDescription: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

const mockApiFetch = jest.mocked(apiFetch);
const toastSuccess = jest.mocked(toast.success);
const toastError = jest.mocked(toast.error);

describe("RfiHeaderActions", () => {
  beforeEach(() => {
    push.mockReset();
    mockApiFetch.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("creates a change event and navigates to the new change-event detail route", async () => {
    mockApiFetch.mockResolvedValueOnce({
      id: "ce-123",
    });

    render(
      <RfiHeaderActions
        projectId={876}
        rfi={{ id: "rfi-123", number: "1", status: "open", subject: "New Opening" }}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Create Change Event" }),
    );

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/projects/876/change-events",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            title: "New Opening",
            type: "TBD",
            scope: "TBD",
            origin: "rfis",
            originId: "rfi-123",
            status: "Open",
          }),
        }),
      );
    });

    expect(toastSuccess).toHaveBeenCalledWith("Change event created from RFI");
    expect(push).toHaveBeenCalledWith("/876/change-events/ce-123");
  });

  it("fails loudly when the create response is missing the new change-event id", async () => {
    mockApiFetch.mockResolvedValueOnce({});

    render(
      <RfiHeaderActions
        projectId={876}
        rfi={{ id: "rfi-123", number: "1", status: "open", subject: "New Opening" }}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Create Change Event" }),
    );

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        "Change event creation succeeded without returning an id.",
      );
    });

    expect(push).not.toHaveBeenCalled();
  });
});
