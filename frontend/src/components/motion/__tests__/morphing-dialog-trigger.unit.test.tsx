/**
 * @jest-environment jsdom
 *
 * Regression test for the product-board drag-and-drop outage.
 *
 * The board cards make themselves draggable by spreading dnd-kit's
 * `attributes` + `listeners` (notably `onPointerDown`, which starts a drag)
 * onto <MorphingDialogTrigger>. If the trigger silently drops unknown props
 * instead of forwarding them to its underlying <button>, the pointer handler
 * never attaches and drag-and-drop stops working — which is exactly what broke.
 *
 * This test fails if MorphingDialogTrigger stops forwarding arbitrary props.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { MorphingDialog, MorphingDialogTrigger } from "../morphing-dialog";

describe("MorphingDialogTrigger prop forwarding", () => {
  it("forwards an onPointerDown listener (drag start) to the button", () => {
    const onPointerDown = jest.fn();

    render(
      <MorphingDialog>
        <MorphingDialogTrigger onPointerDown={onPointerDown} data-testid="trigger">
          Card
        </MorphingDialogTrigger>
      </MorphingDialog>,
    );

    const trigger = screen.getByTestId("trigger");
    fireEvent.pointerDown(trigger);

    expect(onPointerDown).toHaveBeenCalledTimes(1);
  });

  it("forwards dnd-kit sortable attributes (e.g. role, aria-roledescription)", () => {
    render(
      <MorphingDialog>
        <MorphingDialogTrigger
          role="button"
          aria-roledescription="sortable"
          data-testid="trigger"
        >
          Card
        </MorphingDialogTrigger>
      </MorphingDialog>,
    );

    const trigger = screen.getByTestId("trigger");
    expect(trigger).toHaveAttribute("aria-roledescription", "sortable");
  });

  it("still opens the dialog on click (its own handler is not clobbered)", () => {
    render(
      <MorphingDialog>
        <MorphingDialogTrigger data-testid="trigger">Card</MorphingDialogTrigger>
      </MorphingDialog>,
    );

    const trigger = screen.getByTestId("trigger");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });
});
