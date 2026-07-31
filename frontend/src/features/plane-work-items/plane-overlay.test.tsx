/** @vitest-environment jsdom */

import { cleanup, render, waitFor } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  AlertDialog,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetTitle } from "@/components/ui/sheet";
import { Modal, ModalTitle } from "@/components/ui/unified-modal";
import {
  buildPlaneOutlookIntakeUrl,
  resolvePlaneIntakeLoadingState,
} from "@/features/plane-intake/plane-intake-client";

import {
  PlaneAlertDialogContent,
  PlaneDialogContent,
  PlaneDropdownMenuContent,
  PlaneModalContent,
  PlaneOverlayProvider,
  PlanePopoverContent,
  PlaneSelectContent,
  PlaneSheetContent,
} from "./plane-overlay";

beforeAll(() => {
  Element.prototype.scrollIntoView = () => undefined;
});

afterEach(() => cleanup());

function PlaneOverlayFixture({ children }: { children: ReactNode }) {
  return (
    <div
      data-plane-workspace-root
      className="fixed inset-0 z-[2147483000] isolate"
    >
      <PlaneOverlayProvider>
        <div data-plane-workspace-content>Workspace content</div>
        {children}
      </PlaneOverlayProvider>
    </div>
  );
}

async function expectPlaneOwnedOverlay(kind: string) {
  await waitFor(() => {
    expect(
      document.querySelector(`[data-plane-overlay-content="${kind}"]`),
    ).not.toBeNull();
  });

  const workspace = document.querySelector("[data-plane-workspace-root]");
  const host = document.querySelector("[data-plane-overlay-host]");
  const content = document.querySelector(
    `[data-plane-overlay-content="${kind}"]`,
  );

  expect(workspace?.contains(host)).toBe(true);
  expect(host?.contains(content)).toBe(true);
  expect(host?.classList.contains("z-[200]")).toBe(true);
  const raisedContent = ["alert-dialog", "dialog", "sheet", "modal"].includes(
    kind,
  );
  expect(content?.classList.contains(raisedContent ? "z-20" : "z-10")).toBe(
    true,
  );
}

describe("Plane-scoped overlay boundary", () => {
  it("keeps dropdown content inside the Plane overlay host", async () => {
    render(
      <PlaneOverlayFixture>
        <DropdownMenu open modal={false}>
          <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
          <PlaneDropdownMenuContent>
            <DropdownMenuItem>Menu item</DropdownMenuItem>
          </PlaneDropdownMenuContent>
        </DropdownMenu>
      </PlaneOverlayFixture>,
    );

    await expectPlaneOwnedOverlay("dropdown-menu");
  });

  it("keeps popover content inside the Plane overlay host", async () => {
    render(
      <PlaneOverlayFixture>
        <Popover open>
          <PopoverTrigger>Open popover</PopoverTrigger>
          <PlanePopoverContent>Popover content</PlanePopoverContent>
        </Popover>
      </PlaneOverlayFixture>,
    );

    await expectPlaneOwnedOverlay("popover");
  });

  it("keeps select content inside the Plane overlay host", async () => {
    render(
      <PlaneOverlayFixture>
        <Select open value="one">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <PlaneSelectContent>
            <SelectItem value="one">One</SelectItem>
          </PlaneSelectContent>
        </Select>
      </PlaneOverlayFixture>,
    );

    await expectPlaneOwnedOverlay("select");
  });

  it("keeps modal overlay and content inside the Plane overlay host", async () => {
    render(
      <PlaneOverlayFixture>
        <AlertDialog open>
          <PlaneAlertDialogContent>
            <AlertDialogTitle>Confirm action</AlertDialogTitle>
            <AlertDialogDescription>
              This action requires confirmation.
            </AlertDialogDescription>
          </PlaneAlertDialogContent>
        </AlertDialog>
      </PlaneOverlayFixture>,
    );

    await expectPlaneOwnedOverlay("alert-dialog");
    const host = document.querySelector("[data-plane-overlay-host]");
    expect(
      host?.contains(
        document.querySelector(
          '[data-plane-overlay-content="alert-dialog-overlay"]',
        ),
      ),
    ).toBe(true);
  });

  it("keeps ordinary dialog overlay and content inside the Plane overlay host", async () => {
    render(
      <PlaneOverlayFixture>
        <Dialog open>
          <PlaneDialogContent>
            <DialogTitle>Edit cycle</DialogTitle>
          </PlaneDialogContent>
        </Dialog>
      </PlaneOverlayFixture>,
    );

    await expectPlaneOwnedOverlay("dialog");
    const host = document.querySelector("[data-plane-overlay-host]");
    expect(
      host?.contains(
        document.querySelector('[data-plane-overlay-content="dialog-overlay"]'),
      ),
    ).toBe(true);
  });

  it("keeps sheet overlay and content inside the Plane overlay host", async () => {
    render(
      <PlaneOverlayFixture>
        <Sheet open>
          <PlaneSheetContent>
            <SheetTitle>Module details</SheetTitle>
          </PlaneSheetContent>
        </Sheet>
      </PlaneOverlayFixture>,
    );

    await expectPlaneOwnedOverlay("sheet");
    const host = document.querySelector("[data-plane-overlay-host]");
    expect(
      host?.contains(
        document.querySelector('[data-plane-overlay-content="sheet-overlay"]'),
      ),
    ).toBe(true);
  });

  it("keeps unified modal overlay and content inside the Plane overlay host", async () => {
    render(
      <PlaneOverlayFixture>
        <Modal open>
          <PlaneModalContent size="lg">
            <ModalTitle>Create module</ModalTitle>
          </PlaneModalContent>
        </Modal>
      </PlaneOverlayFixture>,
    );

    await expectPlaneOwnedOverlay("modal");
    const host = document.querySelector("[data-plane-overlay-host]");
    expect(
      host?.contains(
        document.querySelector('[data-plane-overlay-content="modal-overlay"]'),
      ),
    ).toBe(true);
  });
});

describe("Plane Intake progressive source loading", () => {
  it("renders loaded task rows while optional Outlook sources settle", () => {
    expect(
      resolvePlaneIntakeLoadingState({
        tasksLoading: false,
        outlookEnabled: true,
        outlookOpenLoading: true,
        outlookClosedLoading: true,
      }),
    ).toEqual({
      listLoading: false,
      countsSettled: false,
    });
  });

  it("settles counts only after every enabled source settles", () => {
    expect(
      resolvePlaneIntakeLoadingState({
        tasksLoading: false,
        outlookEnabled: true,
        outlookOpenLoading: false,
        outlookClosedLoading: false,
      }),
    ).toEqual({
      listLoading: false,
      countsSettled: true,
    });

    expect(
      resolvePlaneIntakeLoadingState({
        tasksLoading: false,
        outlookEnabled: false,
        outlookOpenLoading: true,
        outlookClosedLoading: true,
      }),
    ).toEqual({
      listLoading: false,
      countsSettled: true,
    });
  });

  it("scopes both Outlook requests to the active project", () => {
    expect(buildPlaneOutlookIntakeUrl("31")).toBe(
      "/api/outlook-intake?project_id=31",
    );
    expect(buildPlaneOutlookIntakeUrl("31", "ignored")).toBe(
      "/api/outlook-intake?project_id=31&match_status=ignored",
    );
  });
});
